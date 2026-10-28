/**
 * The ONE real M1 action: rotate the warmup topic deck.
 *
 * Why not reuse POST /topics: that route broadcasts warmupTopicsStatus =
 * 'generating', clears warmupReadyUserIds, and has no idempotency key — it is a
 * host-initiated regenerate, not a bounded agent action. This action instead:
 * - generates OUTSIDE the transaction (one shared 6s accept→terminal deadline),
 * - commits in ONE row-locked transaction,
 * - increments warmupTopicSetRevision exactly once,
 * - preserves ready state and never broadcasts a global "generating",
 * - claims (socialSessionId, idempotencyKey) via the episode unique index.
 */

import type { SocialSessionState } from '@shared/socialIcebreaker';
import type { AIResponseMeta } from '@shared/types/aiMeta';
import { resolveRosterArchetype } from '@shared/personality/archetypeNames';
import {
  getCuratedWarmupTopics,
  generateWarmupTopics,
} from '../socialIcebreakerAIService';
import { FALLBACK_WARMUP_TOPICS } from '../socialIcebreakerAI/warmupTopics';
import { LLMCallTimeoutError, raceWithTimeout } from '../socialIcebreakerAICore';
import { canUseAgentLlm } from './xiaoyueAgentPolicy';
import { listParticipants, updateSessionAtomic } from './socialIcebreakerStore';
import { appendSocialAgentEvent, findSocialAgentActionCommitByIdempotencyKey } from '../repositories/socialAgentEventsRepo';
import { commitWholeTopicSet } from './warmupTopicSetRevision';
import { getWarmupTopicServedKeys } from './warmupServedTopics';
import { logger } from './logger';
import type { AtmosphereMood } from '@shared/socialIcebreaker';

export type XiaoyueAgentActionStatus = 'succeeded' | 'failed' | 'unknown';

export interface XiaoyueAgentActionOutcome {
  status: XiaoyueAgentActionStatus;
  state: SocialSessionState;
  topicSetRevision?: number;
  dedupeRelaxed?: boolean;
  errorCode?: string;
}

/** In-process single-flight guard, mirroring the auto-advance fuse. */
const agentActionsInFlight = new Set<string>();

const AGENT_TOPIC_CALL_ESTIMATE_YUAN = 0.0104;

export const AGENT_ACTION_DEADLINE_MS = 6_000;
export const AGENT_ACTION_DEADLINE_EXCEEDED = 'AGENT_ACTION_DEADLINE_EXCEEDED';

class AgentActionDeadlineError extends Error {
  constructor(readonly deadlineAtMs: number) {
    super(`Accepted agent action exceeded its shared deadline at ${deadlineAtMs}`);
    this.name = 'AgentActionDeadlineError';
  }
}

export function isAgentActionDeadlineError(error: unknown): boolean {
  return error instanceof AgentActionDeadlineError;
}

/**
 * Run one stage inside the remaining slice of a single accepted-action budget.
 * The factory is not invoked after expiry, so a timed-out earlier stage can
 * never start generation or a commit with a fresh timeout of its own.
 */
export async function runWithAgentActionDeadline<T>(
  deadlineAtMs: number,
  operation: () => Promise<T>,
): Promise<T> {
  const remainingMs = deadlineAtMs - Date.now();
  if (remainingMs <= 0) throw new AgentActionDeadlineError(deadlineAtMs);

  let result: T;
  try {
    result = await raceWithTimeout(operation(), remainingMs);
  } catch (error) {
    if (error instanceof LLMCallTimeoutError) {
      throw new AgentActionDeadlineError(deadlineAtMs);
    }
    throw error;
  }
  // Promise settlement and timer callbacks can race at the exact boundary.
  // The wall-clock deadline is authoritative in either ordering.
  if (Date.now() >= deadlineAtMs) throw new AgentActionDeadlineError(deadlineAtMs);
  return result;
}

function moodForState(state: SocialSessionState): AtmosphereMood {
  return state.selectedMood ?? 'relaxed';
}

export async function executeWarmupTopicRotation(input: {
  state: SocialSessionState;
  socialSessionId: string;
  userId: string;
  askId: string;
  idempotencyKey: string;
  now?: number;
  /** Absolute wall-clock deadline shared with the accepted route. */
  deadlineAtMs?: number;
}): Promise<XiaoyueAgentActionOutcome> {
  const { socialSessionId, userId, askId, idempotencyKey } = input;
  const startedAt = input.now ?? Date.now();
  const deadlineAtMs = input.deadlineAtMs ?? Date.now() + AGENT_ACTION_DEADLINE_MS;
  const deadlineUnknown = (): XiaoyueAgentActionOutcome => {
    logger.warn('[XiaoyueAgent] warmup topic rotation exceeded the shared action deadline', {
      socialSessionId,
      askId,
      deadlineAtMs,
    });
    // Terminal evidence is best-effort after the deadline; awaiting a hung
    // episode write would extend the very response bound it records.
    void appendSocialAgentEvent({
      socialSessionId,
      phase: input.state.currentPhase,
      kind: 'action_failed',
      askId,
      actorUserId: userId,
      payload: {
        idempotencyKey,
        status: 'unknown',
        errorCode: AGENT_ACTION_DEADLINE_EXCEEDED,
      },
    }).catch(() => undefined);
    return {
      status: 'unknown',
      state: input.state,
      errorCode: AGENT_ACTION_DEADLINE_EXCEEDED,
    };
  };

  // Idempotent replay: a committed claim is the result, never a second deck.
  try {
    const committed = await runWithAgentActionDeadline(
      deadlineAtMs,
      () => findSocialAgentActionCommitByIdempotencyKey(socialSessionId, idempotencyKey),
    );
    if (committed) {
      const resultRevision = committed.payload?.resultRevision;
      return {
        status: 'succeeded',
        state: input.state,
        topicSetRevision: typeof resultRevision === 'number' ? resultRevision : undefined,
      };
    }
  } catch (error) {
    if (isAgentActionDeadlineError(error)) return deadlineUnknown();
    logger.warn('[XiaoyueAgent] action claim lookup failed; continuing', {
      socialSessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if (Date.now() >= deadlineAtMs) return deadlineUnknown();

  if (agentActionsInFlight.has(askId)) {
    return { status: 'unknown', state: input.state, errorCode: 'AGENT_ACTION_IN_FLIGHT' };
  }
  agentActionsInFlight.add(askId);

  try {
    const baseState = input.state;
    const ask = baseState.xiaoyueAgent?.ask;
    if (!ask || ask.id !== askId) {
      return { status: 'failed', state: baseState, errorCode: 'AGENT_ASK_NOT_FOUND' };
    }
    if (baseState.currentPhase !== 'warmup' || ask.phase !== 'warmup') {
      return { status: 'failed', state: baseState, errorCode: 'AGENT_PHASE_MISMATCH' };
    }
    if (ask.status !== 'pending' && ask.status !== 'failed' && ask.status !== 'unknown') {
      return { status: 'failed', state: baseState, errorCode: 'AGENT_ASK_EXPIRED' };
    }

    const allowLlm = canUseAgentLlm(baseState, AGENT_TOPIC_CALL_ESTIMATE_YUAN);
    let topics: SocialSessionState['warmupTopics'];
    let meta: AIResponseMeta;
    let usedLlm = false;

    // Match manual /topics enrichment, but project only the two aggregate-input
    // fields the existing generator consumes. Failure keeps the no-roster path.
    const participants = await runWithAgentActionDeadline(
      deadlineAtMs,
      () => listParticipants(socialSessionId).catch((error) => {
        logger.warn('[XiaoyueAgent] topic roster enrichment unavailable; continuing without roster context', {
          socialSessionId,
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      }),
    );
    const roster = participants.map((participant) => ({
      archetype:
        resolveRosterArchetype(participant.primaryArchetype, participant.archetype) ??
        participant.archetype,
      interests: participant.interests,
    }));
    const avoidKeys = [...new Set([
      ...(baseState.servedTopicKeys ?? []),
      ...(baseState.warmupTopics ?? []).flatMap(getWarmupTopicServedKeys),
    ])];

    if (allowLlm) {
      try {
        const generated = await runWithAgentActionDeadline(
          deadlineAtMs,
          () => generateWarmupTopics({
            mood: moodForState(baseState),
            eventType: baseState.eventType || '活动',
            participantCount: Math.max(1, baseState.playerCount),
            roster,
            avoidTopics: avoidKeys,
            vibe: baseState.vibe,
            highlights: baseState.highlights,
          }),
        );
        topics = generated.data;
        meta = generated.meta;
        usedLlm = !generated.meta.fallbackUsed;
      } catch (error) {
        if (isAgentActionDeadlineError(error)) throw error;
        logger.warn('[XiaoyueAgent] topic generation failed; using curated fallback', {
          socialSessionId,
          error: error instanceof Error ? error.message : String(error),
        });
        topics = getCuratedWarmupTopics(moodForState(baseState), baseState.vibe, {
          avoidKeys,
        });
        meta = {
          generatedAt: new Date().toISOString(),
          fromCache: false,
          provider: null,
          fallbackUsed: true,
          promptVersion: 'social-warmup-topics-curated-fallback-v1',
          aigc: { aiGenerated: false },
        };
      }
    } else {
      topics = getCuratedWarmupTopics(moodForState(baseState), baseState.vibe, {
        avoidKeys,
      });
      meta = {
        generatedAt: new Date().toISOString(),
        fromCache: false,
        provider: null,
        fallbackUsed: true,
        promptVersion: 'social-warmup-topics-curated-budget-v1',
        aigc: { aiGenerated: false },
      };
    }

    let outcome: XiaoyueAgentActionOutcome | undefined;
    let commitDedupeRelaxed: boolean | undefined;
    const committedAt = Date.now();
    // If the DB settles after the race, that unavoidable commit is reconciled
    // by resync; this request still returns deadline-unknown, never late success.
    const atomic = await runWithAgentActionDeadline(
      deadlineAtMs,
      () => updateSessionAtomic(
        socialSessionId,
      (latest) => {
        const latestAsk = latest.xiaoyueAgent?.ask;
        if (!latestAsk || latestAsk.id !== askId) {
          outcome = { status: 'failed', state: latest, errorCode: 'AGENT_ASK_NOT_FOUND' };
          return false;
        }
        if (latest.currentPhase !== 'warmup') {
          outcome = { status: 'failed', state: latest, errorCode: 'AGENT_PHASE_MISMATCH' };
          return false;
        }
        if ((latest.warmupTopicSetRevision ?? 0) !== ask.baseTopicSetRevision) {
          // Someone else replaced the deck while we generated. Never overwrite
          // their newer content: unknown is the honest answer.
          outcome = { status: 'unknown', state: latest, errorCode: 'REVISION_CONFLICT' };
          return false;
        }

        const committedDeck = commitWholeTopicSet(latest, {
          topics: topics as NonNullable<SocialSessionState['warmupTopics']>,
          curatedFallbackCandidates: FALLBACK_WARMUP_TOPICS,
          meta,
          provenance: 'agent',
          now: committedAt,
        });
        commitDedupeRelaxed = committedDeck.dedupeRelaxed;
        latestAsk.status = 'succeeded';
        latestAsk.decisionAt = committedAt;
        latest.xiaoyueAgent = {
          ...latest.xiaoyueAgent!,
          ask: latestAsk,
          lastAction: {
            askId,
            idempotencyKey,
            status: 'succeeded',
            startedAt,
            finishedAt: committedAt,
            baseTopicSetRevision: ask.baseTopicSetRevision,
            resultRevision: latest.warmupTopicSetRevision,
            fallbackUsed: meta.fallbackUsed,
            dedupeRelaxed: commitDedupeRelaxed,
          },
          agentLlmCallCount: (latest.xiaoyueAgent?.agentLlmCallCount ?? 0) + (usedLlm ? 1 : 0),
          agentEstimatedCostYuan:
            (latest.xiaoyueAgent?.agentEstimatedCostYuan ?? 0) +
            (usedLlm ? AGENT_TOPIC_CALL_ESTIMATE_YUAN : 0),
        };
        outcome = {
          status: 'succeeded',
          state: latest,
          topicSetRevision: latest.warmupTopicSetRevision,
          dedupeRelaxed: commitDedupeRelaxed,
        };
        return true;
      },
      async (latest, tx) => {
        await appendSocialAgentEvent(
          {
            socialSessionId,
            phase: latest.currentPhase,
            kind: 'ask_decision',
            askId,
            actorUserId: userId,
            payload: {
              decision: 'accepted',
              idempotencyKey,
              askKind: ask.kind,
              reason: ask.reason,
            },
          },
          tx,
        );
        await appendSocialAgentEvent(
          {
            socialSessionId,
            phase: latest.currentPhase,
            kind: 'action_commit',
            askId,
            idempotencyKey,
            actorUserId: userId,
            payload: {
              status: 'succeeded',
              result: 'succeeded',
              idempotencyKey,
              baseTopicSetRevision: ask.baseTopicSetRevision,
              resultRevision: latest.warmupTopicSetRevision,
              fallbackUsed: meta.fallbackUsed,
              reason: ask.reason,
              dedupeRelaxed: commitDedupeRelaxed,
              aiGenerated: meta.aigc?.aiGenerated === true,
              llmCallCount: usedLlm ? 1 : 0,
              estimatedCostYuan: usedLlm ? AGENT_TOPIC_CALL_ESTIMATE_YUAN : 0,
            },
          },
          tx,
        );
      },
    ));

    if (atomic.outcome === 'updated' && outcome) return outcome;
    if (atomic.outcome === 'not_found') {
      return { status: 'failed', state: input.state, errorCode: 'SESSION_EXPIRED' };
    }
    if (outcome) {
      const failed = outcome;
      void appendSocialAgentEvent({
        socialSessionId,
        phase: failed.state.currentPhase,
        kind: 'action_failed',
        askId,
        actorUserId: userId,
        payload: {
          idempotencyKey,
          status: failed.status,
          errorCode: failed.errorCode,
          askKind: ask.kind,
        },
      }).catch(() => undefined);
      return failed;
    }
    return { status: 'unknown', state: atomic.state, errorCode: 'AGENT_ACTION_UNKNOWN' };
  } catch (error) {
    if (isAgentActionDeadlineError(error)) return deadlineUnknown();
    logger.error('[XiaoyueAgent] warmup topic rotation failed', {
      socialSessionId,
      askId,
      error: error instanceof Error ? error.message : String(error),
    });
    void appendSocialAgentEvent({
      socialSessionId,
      phase: input.state.currentPhase,
      kind: 'action_failed',
      askId,
      actorUserId: userId,
      payload: {
        idempotencyKey,
        status: 'failed',
        errorCode: 'AGENT_ACTION_ERROR',
      },
    }).catch(() => undefined);
    return { status: 'failed', state: input.state, errorCode: 'AGENT_ACTION_ERROR' };
  } finally {
    agentActionsInFlight.delete(askId);
  }
}

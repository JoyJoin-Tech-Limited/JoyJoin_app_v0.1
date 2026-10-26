/**
 * The ONE real M1 action: rotate the warmup topic deck.
 *
 * Why not reuse POST /topics: that route broadcasts warmupTopicsStatus =
 * 'generating', clears warmupReadyUserIds, and has no idempotency key — it is a
 * host-initiated regenerate, not a bounded agent action. This action instead:
 * - generates OUTSIDE the transaction (6s hard bound inside the generator),
 * - commits in ONE row-locked transaction,
 * - increments warmupTopicSetRevision exactly once,
 * - preserves ready state and never broadcasts a global "generating",
 * - claims (socialSessionId, idempotencyKey) via the episode unique index.
 */

import type { SocialSessionState } from '@shared/socialIcebreaker';
import type { AIResponseMeta } from '@shared/types/aiMeta';
import { getCuratedWarmupTopics, generateWarmupTopics } from '../socialIcebreakerAIService';
import { canUseAgentLlm } from './xiaoyueAgentPolicy';
import { updateSessionAtomic } from './socialIcebreakerStore';
import { appendSocialAgentEvent, findSocialAgentActionCommitByIdempotencyKey } from '../repositories/socialAgentEventsRepo';
import { commitWholeTopicSet } from './warmupTopicSetRevision';
import { logger } from './logger';
import type { AtmosphereMood } from '@shared/socialIcebreaker';

export type XiaoyueAgentActionStatus = 'succeeded' | 'failed' | 'unknown';

export interface XiaoyueAgentActionOutcome {
  status: XiaoyueAgentActionStatus;
  state: SocialSessionState;
  topicSetRevision?: number;
  errorCode?: string;
}

/** In-process single-flight guard, mirroring the auto-advance fuse. */
const agentActionsInFlight = new Set<string>();

const AGENT_TOPIC_CALL_ESTIMATE_YUAN = 0.0104;

function moodForState(state: SocialSessionState): AtmosphereMood {
  return state.selectedMood ?? 'relaxed';
}

function errorCodeForReason(reason: string): string {
  return reason.toUpperCase();
}

export async function executeWarmupTopicRotation(input: {
  state: SocialSessionState;
  socialSessionId: string;
  userId: string;
  askId: string;
  idempotencyKey: string;
  now?: number;
}): Promise<XiaoyueAgentActionOutcome> {
  const { socialSessionId, userId, askId, idempotencyKey } = input;
  const startedAt = input.now ?? Date.now();

  // Idempotent replay: a committed claim is the result, never a second deck.
  try {
    const committed = await findSocialAgentActionCommitByIdempotencyKey(socialSessionId, idempotencyKey);
    if (committed) {
      const resultRevision = committed.payload?.resultRevision;
      return {
        status: 'succeeded',
        state: input.state,
        topicSetRevision: typeof resultRevision === 'number' ? resultRevision : undefined,
      };
    }
  } catch (error) {
    logger.warn('[XiaoyueAgent] action claim lookup failed; continuing', {
      socialSessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

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

    if (allowLlm) {
      try {
        const generated = await generateWarmupTopics({
          mood: moodForState(baseState),
          eventType: baseState.eventType || '活动',
          participantCount: Math.max(1, baseState.playerCount),
          avoidTopics: (baseState.warmupTopics ?? []).map((topic) => topic.question),
          vibe: baseState.vibe,
          dedupeKey: baseState.icebreakerSessionId,
          highlights: baseState.highlights,
        });
        topics = generated.data;
        meta = generated.meta;
        usedLlm = !generated.meta.fallbackUsed;
      } catch (error) {
        logger.warn('[XiaoyueAgent] topic generation failed; using curated fallback', {
          socialSessionId,
          error: error instanceof Error ? error.message : String(error),
        });
        topics = getCuratedWarmupTopics(moodForState(baseState), baseState.vibe, {
          dedupeKey: baseState.icebreakerSessionId,
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
        dedupeKey: baseState.icebreakerSessionId,
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
    const committedAt = Date.now();
    const atomic = await updateSessionAtomic(
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

        commitWholeTopicSet(latest, {
          topics: topics as NonNullable<SocialSessionState['warmupTopics']>,
          meta,
          provenance: 'agent',
          now: committedAt,
        });
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
              aiGenerated: meta.aigc?.aiGenerated === true,
              llmCallCount: usedLlm ? 1 : 0,
              estimatedCostYuan: usedLlm ? AGENT_TOPIC_CALL_ESTIMATE_YUAN : 0,
            },
          },
          tx,
        );
      },
    );

    if (atomic.outcome === 'updated' && outcome) return outcome;
    if (atomic.outcome === 'not_found') {
      return { status: 'failed', state: input.state, errorCode: 'SESSION_EXPIRED' };
    }
    if (outcome) {
      const failed = outcome;
      await appendSocialAgentEvent({
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
    logger.error('[XiaoyueAgent] warmup topic rotation failed', {
      socialSessionId,
      askId,
      error: error instanceof Error ? error.message : String(error),
    });
    await appendSocialAgentEvent({
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

// Exported for route-level error mapping tests.
export function agentErrorCode(status: XiaoyueAgentActionStatus, code?: string): string {
  if (code) return code;
  return `AGENT_ACTION_${errorCodeForReason(status)}`;
}

/**
 * Poll-time runtime for the M1 bounded copilot. One GET /:id poll may advance
 * the deterministic candidate window, create at most one Ask, or expire a
 * stale Ask. Every write is a row-locked atomic mutation, so concurrent polls
 * (host tab + rejoin) cannot duplicate an Ask or double-create a candidate.
 *
 * This module never calls an LLM: Ask copy is curated and the action route
 * owns generation. Observability failures are fail-open for the poll path.
 */

import { randomUUID } from 'node:crypto';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import { applyXiaoyueAgentAskDecision, createEmptyXiaoyueAgentState, decideAgentTick } from './xiaoyueAgentPolicy';
import { updateSessionAtomic } from './socialIcebreakerStore';
import { appendSocialAgentEvent } from '../repositories/socialAgentEventsRepo';
import { appendDueRecoverySnapshots } from './xiaoyueAgentRecovery';
import { logger } from './logger';

export async function runXiaoyueAgentTick(input: {
  state: SocialSessionState;
  socialSessionId: string;
  userId: string;
  flagEnabled: boolean;
  now?: number;
}): Promise<SocialSessionState> {
  const { socialSessionId, userId } = input;
  const now = input.now ?? Date.now();
  // Close the outcome-observation loop before making the next decision. This
  // is raw +60/+180 evidence, not a quality verdict or a reward signal.
  const state = input.flagEnabled
    ? await appendDueRecoverySnapshots({
        state: input.state,
        socialSessionId,
        userId,
        now,
      })
    : input.state;
  const decision = decideAgentTick({
    state,
    now,
    viewerIsHost: true,
    flagEnabled: input.flagEnabled,
  });

  if (decision.type === 'none' || decision.type === 'suppress') return state;

  try {
    if (decision.type === 'mark_candidate') {
      const atomic = await updateSessionAtomic(socialSessionId, (latest) => {
        if (latest.currentPhase !== 'warmup' || latest.xiaoyueAgent?.ask) return false;
        const agent = latest.xiaoyueAgent ?? createEmptyXiaoyueAgentState();
        latest.xiaoyueAgent = {
          ...agent,
          candidate: { key: decision.key, since: decision.since },
        };
        return true;
      });
      return atomic.outcome === 'updated' ? atomic.state : state;
    }

    if (decision.type === 'clear_candidate') {
      const atomic = await updateSessionAtomic(socialSessionId, (latest) => {
        if (!latest.xiaoyueAgent?.candidate) return false;
        const { candidate: _candidate, ...agent } = latest.xiaoyueAgent;
        latest.xiaoyueAgent = agent;
        return true;
      });
      return atomic.outcome === 'updated' ? atomic.state : state;
    }

    if (decision.type === 'expire_ask') {
      const atomic = await updateSessionAtomic(
        socialSessionId,
        (latest) => {
          if (!latest.xiaoyueAgent?.ask || latest.xiaoyueAgent.ask.id !== decision.askId) return false;
          if (latest.xiaoyueAgent.ask.status !== 'pending') return false;
          const next = applyXiaoyueAgentAskDecision(latest, 'expired', now);
          Object.assign(latest, next);
          return true;
        },
        async (latest, tx) => {
          await appendSocialAgentEvent(
            {
              socialSessionId,
              phase: latest.currentPhase,
              kind: 'ask_decision',
              askId: decision.askId,
              actorUserId: userId,
              payload: {
                decision: 'expired',
                reason: decision.reason,
                askKind: 'warmup_rotate_topics',
              },
            },
            tx,
          );
        },
      );
      return atomic.outcome === 'updated' ? atomic.state : state;
    }

    if (decision.type === 'auto_disable') {
      const atomic = await updateSessionAtomic(socialSessionId, (latest) => {
        const agent = latest.xiaoyueAgent;
        if (!agent || agent.policy.proactiveDisabled) return false;
        agent.policy.proactiveDisabled = true;
        return true;
      });
      return atomic.outcome === 'updated' ? atomic.state : state;
    }

    if (decision.type === 'create_ask') {
      const askId = `ask_${randomUUID()}`;
      let created = false;
      const atomic = await updateSessionAtomic(
        socialSessionId,
        (latest) => {
          if (latest.currentPhase !== 'warmup') return false;
          if (latest.xiaoyueAgent?.ask) return false;
          const agent = latest.xiaoyueAgent ?? createEmptyXiaoyueAgentState();
          const ask = {
            ...decision.draft,
            id: askId,
            createdAt: now,
            status: 'pending' as const,
          };
          latest.xiaoyueAgent = {
            ...agent,
            ask,
            candidate: undefined,
            policy: {
              ...agent.policy,
              lastAskAt: now,
              askCount: (agent.policy.askCount ?? 0) + 1,
              askCountByPhase: {
                ...agent.policy.askCountByPhase,
                [ask.phase]: (agent.policy.askCountByPhase?.[ask.phase] ?? 0) + 1,
              },
            },
          };
          created = true;
          return true;
        },
        async (latest, tx) => {
          if (!created) return;
          await appendSocialAgentEvent(
            {
              socialSessionId,
              phase: latest.currentPhase,
              kind: 'ask_created',
              askId,
              actorUserId: userId,
              signals: {
                baseTopicSetRevision: decision.draft.baseTopicSetRevision,
              },
              payload: {
                reason: decision.draft.reason,
                askKind: decision.draft.kind,
                promptVersion: decision.draft.meta.promptVersion,
                fallbackUsed: decision.draft.meta.fallbackUsed,
                aiGenerated: decision.draft.meta.aigc?.aiGenerated === true,
              },
            },
            tx,
          );
        },
      );
      return atomic.outcome === 'updated' ? atomic.state : state;
    }
  } catch (error) {
    // Poll must never fail because observability or a race lost.
    logger.warn('[XiaoyueAgent] poll-time decision failed; serving current state', {
      socialSessionId,
      decision: decision.type,
      error: error instanceof Error ? error.message : String(error),
    });
    return state;
  }

  return state;
}

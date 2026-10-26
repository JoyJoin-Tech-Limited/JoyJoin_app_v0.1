/**
 * M1 outcome observation (raw facts only): +60s / +180s after a successful
 * rotation, record what the table looks like. This closes the *feedback*
 * branch of observe → ask → execute → observe.
 *
 * These are deliberately NOT conversation-quality labels. activeRate, taps,
 * ready counts and phase progress can move in either direction while people
 * are having a good conversation; they stay as numeric/boolean evidence for
 * later offline analysis, never as a runtime reward.
 */

import type {
  SocialSessionState,
  XiaoyueAgentActionState,
} from '@shared/socialIcebreaker';
import { deriveAgentSignals } from './xiaoyueAgentPolicy';
import { updateSessionAtomic } from './socialIcebreakerStore';
import { appendSocialAgentEvent } from '../repositories/socialAgentEventsRepo';
import { logger } from './logger';

export const XIAOYUE_AGENT_RECOVERY_OFFSETS = [60, 180] as const;
export type XiaoyueAgentRecoveryOffset = (typeof XIAOYUE_AGENT_RECOVERY_OFFSETS)[number];

export function getDueRecoverySnapshotOffsets(
  action: XiaoyueAgentActionState | undefined,
  now: number,
): XiaoyueAgentRecoveryOffset[] {
  if (!action || action.status !== 'succeeded') return [];
  const finishedAt = action.finishedAt;
  if (finishedAt === undefined || !Number.isFinite(finishedAt) || finishedAt > now) return [];
  const written = new Set(action.recoverySnapshotOffsets ?? []);
  return XIAOYUE_AGENT_RECOVERY_OFFSETS.filter(
    (offset) => now - finishedAt >= offset * 1_000 && !written.has(offset),
  );
}

export async function appendDueRecoverySnapshots(input: {
  state: SocialSessionState;
  socialSessionId: string;
  userId: string;
  now: number;
}): Promise<SocialSessionState> {
  const { state, socialSessionId, userId, now } = input;
  const initialAction = state.xiaoyueAgent?.lastAction;
  if (getDueRecoverySnapshotOffsets(initialAction, now).length === 0) return state;

  let writtenOffsets: XiaoyueAgentRecoveryOffset[] = [];
  let action: XiaoyueAgentActionState | undefined;

  try {
    const atomic = await updateSessionAtomic(
      socialSessionId,
      (latest) => {
        const latestAction = latest.xiaoyueAgent?.lastAction;
        if (!latestAction || latestAction.askId !== initialAction?.askId) return false;
        const due = getDueRecoverySnapshotOffsets(latestAction, now);
        if (due.length === 0) return false;

        latestAction.recoverySnapshotOffsets = [
          ...(latestAction.recoverySnapshotOffsets ?? []),
          ...due,
        ];
        writtenOffsets = due;
        action = { ...latestAction };
        return true;
      },
      async (latest, tx) => {
        if (!action) return;
        const signals = deriveAgentSignals(latest, now);
        for (const offset of writtenOffsets) {
          await appendSocialAgentEvent(
            {
              socialSessionId,
              phase: latest.currentPhase,
              kind: 'signal_snapshot',
              askId: action.askId,
              actorUserId: userId,
              signals: {
                activePlayerCount: signals.activePlayerCount,
                playerCount: signals.playerCount,
                activeRate: signals.activeRate,
                pulseLow: signals.pulseLow,
                phaseOverrun: signals.phaseOverrun,
                topicStall: signals.topicStall,
                warmupReadyCount: latest.warmupReadyUserIds?.length ?? 0,
                currentTopicIndex: latest.currentTopicIndex ?? 0,
                topicSetRevision: latest.warmupTopicSetRevision ?? 0,
                challengeCompletedCount: latest.challengeCompletedBy?.length ?? 0,
                elapsedSinceActionMs: Math.max(0, now - (action.finishedAt ?? now)),
              },
              payload: {
                snapshotScope: 'action_recovery',
                snapshotKey: `${action.askId}:${offset}`,
                recoveryOffsetSeconds: offset,
                phaseStartedAt: latest.phaseStartedAt,
                observationWindowStart: action.finishedAt,
              },
            },
            tx,
          );
        }
      },
    );

    return atomic.outcome === 'updated' ? atomic.state : state;
  } catch (error) {
    // Observation is best-effort and must never break the live poll.
    logger.warn('[XiaoyueAgent] recovery snapshot failed; continuing poll', {
      socialSessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return state;
  }
}

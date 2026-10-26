import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocialSessionState, XiaoyueAgentActionState } from '@shared/socialIcebreaker';

const h = vi.hoisted(() => ({ append: vi.fn(), atomic: vi.fn() }));

vi.mock('../lib/socialIcebreakerStore', () => ({
  updateSessionAtomic: (...args: unknown[]) => h.atomic(...args),
}));
vi.mock('../repositories/socialAgentEventsRepo', () => ({
  appendSocialAgentEvent: (...args: unknown[]) => h.append(...args),
}));
vi.mock('../lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import {
  appendDueRecoverySnapshots,
  getDueRecoverySnapshotOffsets,
} from '../lib/xiaoyueAgentRecovery';

const NOW = 1_800_000_000_000;

function makeAction(overrides: Partial<XiaoyueAgentActionState> = {}): XiaoyueAgentActionState {
  return {
    askId: 'ask_recovery',
    idempotencyKey: 'idem_recovery',
    status: 'succeeded',
    startedAt: NOW - 200_000,
    finishedAt: NOW - 180_000,
    baseTopicSetRevision: 1,
    resultRevision: 2,
    ...overrides,
  };
}

function makeState(action = makeAction()): SocialSessionState {
  return {
    socialSessionId: 'social_recovery',
    icebreakerSessionId: 'recovery',
    currentPhase: 'warmup',
    hostUserId: 'host',
    hostDisplayName: 'Host',
    playerCount: 6,
    activePlayerCount: 4,
    phaseStartedAt: NOW - 400_000,
    sessionStartedAt: NOW - 400_000,
    completedPhases: [],
    warmupTopicSetRevision: 2,
    currentTopicIndex: 0,
    warmupReadyUserIds: ['a', 'b'],
    xiaoyueAgent: {
      policy: {
        proactiveDisabled: false,
        ignoredStreak: 0,
        cooldownUntilByKind: {},
        askCount: 1,
        askCountByPhase: { warmup: 1 },
      },
      lastAction: action,
      agentLlmCallCount: 1,
      agentEstimatedCostYuan: 0.01,
    },
  };
}

describe('recovery snapshot scheduling — raw +60/+180 evidence only', () => {
  it('is due only for a finished successful action and never before its offset', () => {
    expect(getDueRecoverySnapshotOffsets(makeAction({ status: 'failed' }), NOW)).toEqual([]);
    expect(getDueRecoverySnapshotOffsets(makeAction({ finishedAt: undefined }), NOW)).toEqual([]);
    expect(getDueRecoverySnapshotOffsets(makeAction({ finishedAt: NOW - 59_999 }), NOW)).toEqual([]);
    expect(getDueRecoverySnapshotOffsets(makeAction({ finishedAt: NOW - 60_000 }), NOW)).toEqual([60]);
    expect(getDueRecoverySnapshotOffsets(makeAction({ finishedAt: NOW - 180_000 }), NOW)).toEqual([60, 180]);
    expect(
      getDueRecoverySnapshotOffsets(makeAction({ recoverySnapshotOffsets: [60] }), NOW),
    ).toEqual([180]);
    expect(
      getDueRecoverySnapshotOffsets(makeAction({ recoverySnapshotOffsets: [60, 180] }), NOW),
    ).toEqual([]);
  });
});

describe('appendDueRecoverySnapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.append.mockResolvedValue({ event: {}, replayed: false });
    h.atomic.mockImplementation(
      async (
        _id: string,
        mutator: (state: SocialSessionState) => boolean,
        afterWrite?: (state: SocialSessionState, tx: unknown) => Promise<void>,
      ) => {
        const state = makeState();
        if (mutator(state) === false) return { outcome: 'aborted', state };
        if (afterWrite) await afterWrite(state, { tx: true });
        return { outcome: 'updated', state };
      },
    );
  });

  it('writes both snapshots exactly once with aggregate, non-text signals', async () => {
    const first = await appendDueRecoverySnapshots({
      state: makeState(),
      socialSessionId: 'social_recovery',
      userId: 'host',
      now: NOW,
    });
    expect(first.xiaoyueAgent?.lastAction?.recoverySnapshotOffsets).toEqual([60, 180]);
    expect(h.append).toHaveBeenCalledTimes(2);
    expect(h.append.mock.calls.map(([event]) => event.payload.recoveryOffsetSeconds)).toEqual([60, 180]);
    expect(h.append.mock.calls[0][0]).toMatchObject({
      kind: 'signal_snapshot',
      askId: 'ask_recovery',
      signals: expect.objectContaining({ activeRate: 4 / 6, topicSetRevision: 2 }),
    });

    h.append.mockClear();
    const second = await appendDueRecoverySnapshots({
      state: first,
      socialSessionId: 'social_recovery',
      userId: 'host',
      now: NOW + 3_000,
    });
    expect(second).toBe(first);
    expect(h.append).not.toHaveBeenCalled();
  });
});

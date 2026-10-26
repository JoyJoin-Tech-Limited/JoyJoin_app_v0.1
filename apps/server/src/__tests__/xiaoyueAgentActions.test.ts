import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIResponseMeta } from '@shared/types/aiMeta';
import type { SocialSessionState } from '@shared/socialIcebreaker';

const h = vi.hoisted(() => ({
  generate: vi.fn(),
  findCommit: vi.fn(),
  append: vi.fn(),
  atomic: vi.fn(),
}));

vi.mock('../socialIcebreakerAIService', () => ({
  generateWarmupTopics: (...args: unknown[]) => h.generate(...args),
  getCuratedWarmupTopics: vi.fn(() => [
    { id: 'curated', question: 'Curated', mood: 'relaxed', emoji: '' },
  ]),
}));

vi.mock('../lib/socialIcebreakerStore', () => ({
  updateSessionAtomic: (...args: unknown[]) => h.atomic(...args),
}));

vi.mock('../repositories/socialAgentEventsRepo', () => ({
  findSocialAgentActionCommitByIdempotencyKey: (...args: unknown[]) => h.findCommit(...args),
  appendSocialAgentEvent: (...args: unknown[]) => h.append(...args),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { executeWarmupTopicRotation } from '../lib/xiaoyueAgentActions';

const NOW = 1_800_000_000_000;
const meta: AIResponseMeta = {
  generatedAt: new Date(NOW).toISOString(),
  fromCache: false,
  provider: null,
  fallbackUsed: true,
  aigc: { aiGenerated: false },
};

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_action',
    icebreakerSessionId: 'action',
    currentPhase: 'warmup',
    hostUserId: 'host',
    hostDisplayName: 'Host',
    playerCount: 6,
    phaseStartedAt: NOW,
    sessionStartedAt: NOW,
    completedPhases: [],
    warmupTopics: [{ id: 'old', question: 'Old', mood: 'relaxed', emoji: '' }],
    warmupTopicSetRevision: 3,
    warmupReadyUserIds: ['a', 'b'],
    warmupTopicsStatus: 'ready',
    xiaoyueAgent: {
      policy: {
        proactiveDisabled: false,
        ignoredStreak: 0,
        cooldownUntilByKind: {},
        askCount: 1,
        askCountByPhase: { warmup: 1 },
      },
      ask: {
        id: 'ask_action',
        kind: 'warmup_rotate_topics',
        phase: 'warmup',
        reason: 'topic_stall',
        createdAt: NOW,
        baseTopicSetRevision: 3,
        copy: {
          kicker: '悦仔想确认一下',
          question: '这组先聊到这里吗？换一组新话题就好。',
          hint: '你确认后，全桌一起换新',
          cta: '换一组话题卡',
        },
        meta,
        status: 'pending',
      },
      agentLlmCallCount: 0,
      agentEstimatedCostYuan: 0,
    },
    ...overrides,
  };
}

describe('executeWarmupTopicRotation — one real bounded action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.findCommit.mockResolvedValue(undefined);
    h.generate.mockResolvedValue({
      data: [{ id: 'new', question: 'New', mood: 'relaxed', emoji: '' }],
      meta,
    });
    h.append.mockResolvedValue({ event: {}, replayed: false });
    h.atomic.mockImplementation(
      async (
        _id: string,
        mutator: (state: SocialSessionState) => boolean,
        afterWrite?: (state: SocialSessionState, tx: unknown) => Promise<void>,
      ) => {
        const state = makeState();
        const mutated = mutator(state);
        if (mutated === false) return { outcome: 'aborted', state };
        if (afterWrite) await afterWrite(state, { tx: true });
        return { outcome: 'updated', state };
      },
    );
  });

  it('commits one revision bump, preserves ready state, and writes episode facts in the same transaction', async () => {
    const outcome = await executeWarmupTopicRotation({
      state: makeState(),
      socialSessionId: 'social_action',
      userId: 'host',
      askId: 'ask_action',
      idempotencyKey: 'idem_action_1',
      now: NOW,
    });

    expect(outcome.status).toBe('succeeded');
    expect(outcome.state.warmupTopicSetRevision).toBe(4);
    expect(outcome.state.warmupReadyUserIds).toEqual(['a', 'b']);
    expect(outcome.state.warmupTopicsStatus).toBe('ready');
    expect(outcome.state.xiaoyueAgent?.ask?.status).toBe('succeeded');
    expect(outcome.state.xiaoyueAgent?.lastAction?.resultRevision).toBe(4);
    expect(h.append).toHaveBeenCalledTimes(2);
    expect(h.append.mock.calls.map(([event]) => event.kind)).toEqual([
      'ask_decision',
      'action_commit',
    ]);
    expect(h.append.mock.calls[1][0]).toMatchObject({
      idempotencyKey: 'idem_action_1',
      payload: { resultRevision: 4 },
    });
  });

  it('returns a replay for an already committed idempotency key without generating again', async () => {
    h.findCommit.mockResolvedValue({ payload: { resultRevision: 9 } });
    const outcome = await executeWarmupTopicRotation({
      state: makeState(),
      socialSessionId: 'social_action',
      userId: 'host',
      askId: 'ask_action',
      idempotencyKey: 'idem_action_1',
      now: NOW,
    });
    expect(outcome).toMatchObject({ status: 'succeeded', topicSetRevision: 9 });
    expect(h.generate).not.toHaveBeenCalled();
    expect(h.atomic).not.toHaveBeenCalled();
  });

  it('never overwrites a newer deck: revision conflict is unknown, not success', async () => {
    h.atomic.mockImplementation(
      async (_id: string, mutator: (state: SocialSessionState) => boolean) => {
        const state = makeState({ warmupTopicSetRevision: 5 });
        return mutator(state) === false
          ? { outcome: 'aborted', state }
          : { outcome: 'updated', state };
      },
    );
    const outcome = await executeWarmupTopicRotation({
      state: makeState(),
      socialSessionId: 'social_action',
      userId: 'host',
      askId: 'ask_action',
      idempotencyKey: 'idem_conflict',
      now: NOW,
    });
    expect(outcome.status).toBe('unknown');
    expect(h.append).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'action_failed', payload: expect.objectContaining({ errorCode: 'REVISION_CONFLICT' }) }),
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIResponseMeta } from '@shared/types/aiMeta';
import type { SocialSessionState } from '@shared/socialIcebreaker';

const h = vi.hoisted(() => ({
  generate: vi.fn(),
  curated: vi.fn(),
  findCommit: vi.fn(),
  append: vi.fn(),
  atomic: vi.fn(),
  listParticipants: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('../socialIcebreakerAIService', () => ({
  generateWarmupTopics: (...args: unknown[]) => h.generate(...args),
  getCuratedWarmupTopics: (...args: unknown[]) => h.curated(...args),
}));

vi.mock('../lib/socialIcebreakerStore', () => ({
  updateSessionAtomic: (...args: unknown[]) => h.atomic(...args),
  listParticipants: (...args: unknown[]) => h.listParticipants(...args),
}));

vi.mock('../repositories/socialAgentEventsRepo', () => ({
  findSocialAgentActionCommitByIdempotencyKey: (...args: unknown[]) => h.findCommit(...args),
  appendSocialAgentEvent: (...args: unknown[]) => h.append(...args),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: h.loggerWarn, error: vi.fn() },
}));

import { executeWarmupTopicRotation } from '../lib/xiaoyueAgentActions';
import { FALLBACK_WARMUP_TOPICS } from '../socialIcebreakerAI/warmupTopics';

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
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    h.findCommit.mockResolvedValue(undefined);
    h.curated.mockReturnValue([
      { id: 'curated', question: 'Curated', mood: 'relaxed', emoji: '' },
    ]);
    h.generate.mockResolvedValue({
      data: [{ id: 'new', question: 'New', mood: 'relaxed', emoji: '' }],
      meta,
    });
    h.append.mockResolvedValue({ event: {}, replayed: false });
    h.listParticipants.mockResolvedValue([
      {
        userId: 'user-alice',
        displayName: 'Alice Raw Name',
        archetype: 'corgi',
        interests: ['咖啡', '徒步'],
        profile: { bio: 'RAW BIO', individualTrait: 'RAW TRAIT' },
      },
      {
        userId: 'user-bob',
        displayName: 'Bob Raw Name',
        archetype: 'owl',
        interests: ['咖啡', '摄影'],
        profile: { bio: 'OTHER RAW BIO' },
      },
    ]);
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
    expect(outcome.state.xiaoyueAgent?.lastAction?.dedupeRelaxed).toBe(false);
    expect(outcome.state.servedTopicKeys).toEqual(expect.arrayContaining(['id:old', 'id:new']));
    expect(h.generate).toHaveBeenCalledTimes(1);
    expect(h.append).toHaveBeenCalledTimes(2);
    expect(h.append.mock.calls.map(([event]) => event.kind)).toEqual([
      'ask_decision',
      'action_commit',
    ]);
    expect(h.append.mock.calls[1][0]).toMatchObject({
      idempotencyKey: 'idem_action_1',
      payload: {
        resultRevision: 4,
        reason: 'topic_stall',
        dedupeRelaxed: false,
      },
    });
  });

  it('passes the manual-topics roster projection without names, IDs, bios, traits, or rotation reason', async () => {
    const outcome = await executeWarmupTopicRotation({
      state: makeState(),
      socialSessionId: 'social_action',
      userId: 'host',
      askId: 'ask_action',
      idempotencyKey: 'idem_roster_parity',
      now: NOW,
    });

    expect(outcome.status).toBe('succeeded');
    const generationInput = h.generate.mock.calls[0][0];
    expect(generationInput.roster).toEqual([
      { archetype: 'corgi', interests: ['咖啡', '徒步'] },
      { archetype: 'owl', interests: ['咖啡', '摄影'] },
    ]);
    expect(generationInput).not.toHaveProperty('reason');
    const rosterWire = JSON.stringify(generationInput.roster);
    for (const forbidden of [
      'Alice Raw Name',
      'Bob Raw Name',
      'user-alice',
      'user-bob',
      'RAW BIO',
      'RAW TRAIT',
      'topic_stall',
    ]) {
      expect(rosterWire).not.toContain(forbidden);
    }
  });

  it('logs roster enrichment failure and continues through the existing no-roster path', async () => {
    h.listParticipants.mockRejectedValueOnce(new Error('roster unavailable'));
    const outcome = await executeWarmupTopicRotation({
      state: makeState(),
      socialSessionId: 'social_action',
      userId: 'host',
      askId: 'ask_action',
      idempotencyKey: 'idem_roster_failure',
      now: NOW,
    });

    expect(outcome.status).toBe('succeeded');
    expect(h.generate).toHaveBeenCalledTimes(1);
    expect(h.generate.mock.calls[0][0].roster).toEqual([]);
    expect(h.loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('roster enrichment unavailable'),
      expect.objectContaining({ socialSessionId: 'social_action' }),
    );
  });

  it('records deterministic dedupe relaxation in the result and episode evidence', async () => {
    h.generate.mockResolvedValue({
      data: [{ id: 'old', question: 'Old', mood: 'relaxed', emoji: '' }],
      meta,
    });
    const servedTopicKeys = [
      'id:old',
      'q:Old',
      ...FALLBACK_WARMUP_TOPICS.flatMap((entry) => [`id:${entry.id}`, `q:${entry.question}`]),
    ];
    h.atomic.mockImplementation(
      async (
        _id: string,
        mutator: (state: SocialSessionState) => boolean,
        afterWrite?: (state: SocialSessionState, tx: unknown) => Promise<void>,
      ) => {
        const state = makeState({ servedTopicKeys });
        const mutated = mutator(state);
        if (mutated === false) return { outcome: 'aborted', state };
        if (afterWrite) await afterWrite(state, { tx: true });
        return { outcome: 'updated', state };
      },
    );

    const outcome = await executeWarmupTopicRotation({
      state: makeState({ servedTopicKeys }),
      socialSessionId: 'social_action',
      userId: 'host',
      askId: 'ask_action',
      idempotencyKey: 'idem_dedupe_relaxed',
      now: NOW,
    });

    expect(outcome.status).toBe('succeeded');
    expect(outcome.dedupeRelaxed).toBe(true);
    expect(outcome.state.warmupTopics).toHaveLength(1);
    expect(outcome.state.xiaoyueAgent?.lastAction?.dedupeRelaxed).toBe(true);
    expect(h.append.mock.calls[1][0].payload).toMatchObject({
      reason: 'topic_stall',
      dedupeRelaxed: true,
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

  it('never overwrites a newer deck or records its uncommitted candidate: revision conflict is unknown', async () => {
    let latestState: SocialSessionState | undefined;
    h.atomic.mockImplementation(
      async (_id: string, mutator: (state: SocialSessionState) => boolean) => {
        const state = makeState({
          warmupTopicSetRevision: 5,
          servedTopicKeys: ['existing-only'],
        });
        latestState = state;
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
    expect(latestState?.servedTopicKeys).toEqual(['existing-only']);
    expect(latestState?.warmupTopics?.map((entry) => entry.id)).toEqual(['old']);
    expect(h.append).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'action_failed', payload: expect.objectContaining({ errorCode: 'REVISION_CONFLICT' }) }),
    );
  });

  it('passes durable served keys and the legacy current deck to live and curated avoid lists without global dedupe', async () => {
    h.generate.mockRejectedValueOnce(new Error('provider unavailable'));
    const servedTopicKeys = ['id:previous', 'q:Earlier question', 'q:normalized'];

    const outcome = await executeWarmupTopicRotation({
      state: makeState({ servedTopicKeys }),
      socialSessionId: 'social_action',
      userId: 'host',
      askId: 'ask_action',
      idempotencyKey: 'idem_avoid_keys',
      now: NOW,
    });

    expect(outcome.status).toBe('succeeded');
    const generationInput = h.generate.mock.calls[0][0];
    expect(generationInput.avoidTopics).toEqual(expect.arrayContaining([
      ...servedTopicKeys,
      'id:old',
      'q:Old',
    ]));
    expect(generationInput).not.toHaveProperty('dedupeKey');
    expect(h.curated).toHaveBeenCalledTimes(1);
    const curatedOptions = h.curated.mock.calls[0][2];
    expect(curatedOptions.avoidKeys).toEqual(expect.arrayContaining([
      ...servedTopicKeys,
      'id:old',
      'q:Old',
    ]));
    expect(curatedOptions).not.toHaveProperty('dedupeKey');
  });

  it('honors an aligned deadline that route reads already consumed before claim lookup', async () => {
    const outcome = await executeWarmupTopicRotation({
      state: makeState(),
      socialSessionId: 'social_action',
      userId: 'host',
      askId: 'ask_action',
      idempotencyKey: 'idem_expired_deadline',
      now: NOW,
      deadlineAtMs: Date.now() - 1,
    });

    expect(outcome).toMatchObject({
      status: 'unknown',
      errorCode: 'AGENT_ACTION_DEADLINE_EXCEEDED',
    });
    expect(outcome.state.warmupTopics?.map((topic) => topic.id)).toEqual(['old']);
    expect(h.findCommit).not.toHaveBeenCalled();
    expect(h.generate).not.toHaveBeenCalled();
    expect(h.atomic).not.toHaveBeenCalled();
  });

  it('returns unknown at 6s for a hung claim lookup without starting later stages or awaiting failure logging', async () => {
    vi.useFakeTimers();
    h.findCommit.mockImplementation(() => new Promise(() => {}));
    h.append.mockImplementation(() => new Promise(() => {}));

    const action = executeWarmupTopicRotation({
      state: makeState(),
      socialSessionId: 'social_action',
      userId: 'host',
      askId: 'ask_action',
      idempotencyKey: 'idem_hung_claim',
      now: NOW,
    });
    await vi.advanceTimersByTimeAsync(6_000);

    await expect(action).resolves.toMatchObject({
      status: 'unknown',
      errorCode: 'AGENT_ACTION_DEADLINE_EXCEEDED',
    });
    expect(h.listParticipants).not.toHaveBeenCalled();
    expect(h.generate).not.toHaveBeenCalled();
    expect(h.atomic).not.toHaveBeenCalled();
    expect(h.append).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'action_failed',
      payload: expect.objectContaining({
        status: 'unknown',
        errorCode: 'AGENT_ACTION_DEADLINE_EXCEEDED',
      }),
    }));
  });

  it('returns unknown at 6s for hung roster enrichment and never starts generation or commit', async () => {
    vi.useFakeTimers();
    h.listParticipants.mockImplementation(() => new Promise(() => {}));

    const action = executeWarmupTopicRotation({
      state: makeState(),
      socialSessionId: 'social_action',
      userId: 'host',
      askId: 'ask_action',
      idempotencyKey: 'idem_hung_roster',
      now: NOW,
    });
    await vi.advanceTimersByTimeAsync(6_000);

    await expect(action).resolves.toMatchObject({
      status: 'unknown',
      errorCode: 'AGENT_ACTION_DEADLINE_EXCEEDED',
    });
    expect(h.generate).not.toHaveBeenCalled();
    expect(h.atomic).not.toHaveBeenCalled();
  });

  it('returns unknown for a hung generation without converting the deadline into a curated commit', async () => {
    vi.useFakeTimers();
    h.generate.mockImplementation(() => new Promise(() => {}));

    const action = executeWarmupTopicRotation({
      state: makeState(),
      socialSessionId: 'social_action',
      userId: 'host',
      askId: 'ask_action',
      idempotencyKey: 'idem_hung_generation',
      now: NOW,
    });
    await vi.advanceTimersByTimeAsync(6_000);

    await expect(action).resolves.toMatchObject({
      status: 'unknown',
      errorCode: 'AGENT_ACTION_DEADLINE_EXCEEDED',
    });
    expect(h.curated).not.toHaveBeenCalled();
    expect(h.atomic).not.toHaveBeenCalled();
  });

  it('uses remaining time rather than a fresh per-stage budget after a slow claim lookup', async () => {
    vi.useFakeTimers();
    h.findCommit.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve(undefined), 4_000);
    }));
    h.listParticipants.mockImplementation(() => new Promise(() => {}));

    const action = executeWarmupTopicRotation({
      state: makeState(),
      socialSessionId: 'social_action',
      userId: 'host',
      askId: 'ask_action',
      idempotencyKey: 'idem_shared_budget',
      now: NOW,
    });
    await vi.advanceTimersByTimeAsync(4_000);
    expect(h.listParticipants).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(action).resolves.toMatchObject({
      status: 'unknown',
      errorCode: 'AGENT_ACTION_DEADLINE_EXCEEDED',
    });
    expect(h.generate).not.toHaveBeenCalled();
    expect(h.atomic).not.toHaveBeenCalled();
  });

  it('returns unknown for a hung commit and keeps that answer even if the underlying commit later finishes', async () => {
    vi.useFakeTimers();
    let finishAtomic: (() => Promise<void>) | undefined;
    h.atomic.mockImplementation((
      _id: string,
      mutator: (state: SocialSessionState) => boolean,
      afterWrite?: (state: SocialSessionState, tx: unknown) => Promise<void>,
    ) => new Promise((resolve) => {
      finishAtomic = async () => {
        const state = makeState();
        const mutated = mutator(state);
        if (mutated === false) {
          resolve({ outcome: 'aborted', state });
          return;
        }
        if (afterWrite) await afterWrite(state, { tx: true });
        resolve({ outcome: 'updated', state });
      };
    }));

    const action = executeWarmupTopicRotation({
      state: makeState(),
      socialSessionId: 'social_action',
      userId: 'host',
      askId: 'ask_action',
      idempotencyKey: 'idem_hung_commit',
      now: NOW,
    });
    await vi.advanceTimersByTimeAsync(6_000);

    const outcome = await action;
    expect(outcome).toMatchObject({
      status: 'unknown',
      errorCode: 'AGENT_ACTION_DEADLINE_EXCEEDED',
    });
    expect(outcome.state.warmupTopicSetRevision).toBe(3);
    expect(outcome.state.warmupTopics?.map((topic) => topic.id)).toEqual(['old']);

    await finishAtomic?.();
    await expect(action).resolves.toMatchObject({
      status: 'unknown',
      errorCode: 'AGENT_ACTION_DEADLINE_EXCEEDED',
    });
  });
});

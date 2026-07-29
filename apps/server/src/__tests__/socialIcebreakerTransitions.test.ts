import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';

const {
  updateSessionMock,
  listParticipantsMock,
  savePhaseMetricMock,
  loadSessionLieTruthsMock,
  generateMicroChallengesMock,
  generateRecapSummaryMock,
  getSessionWithExpiryMock,
} = vi.hoisted(() => ({
  updateSessionMock: vi.fn(async () => {}),
  listParticipantsMock: vi.fn(async () => [
    { userId: 'host-user', displayName: 'Host', archetype: '社牛柯基', joinedAt: 1 },
  ]),
  savePhaseMetricMock: vi.fn(async () => {}),
  loadSessionLieTruthsMock: vi.fn(async () => new Map()),
  generateMicroChallengesMock: vi.fn(async () => ({
    data: [
      {
        id: 'mc-1',
        title: '互相问3个问题',
        description: '每人准备3个能真正了解对方的问题，轮流问。',
        durationSeconds: 180,
        completionCTA: '我完成了',
      },
    ],
    meta: {
      generatedAt: new Date().toISOString(),
      fromCache: false,
      provider: null,
      fallbackUsed: false,
    },
  })),
  generateRecapSummaryMock: vi.fn(async () => ({
    data: { headline: '今晚到这儿，刚刚好', closingLine: '下次见', moments: [] },
    meta: { generatedAt: new Date().toISOString(), fromCache: false, provider: null, fallbackUsed: false },
  })),
  getSessionWithExpiryMock: vi.fn(async () => ({ state: null as SocialSessionState | null, expired: false })),
}));

vi.mock('../lib/socialIcebreakerStore', () => ({
  updateSession: updateSessionMock,
  listParticipants: listParticipantsMock,
  savePhaseMetric: savePhaseMetricMock,
  loadSessionLieTruths: loadSessionLieTruthsMock,
  getSessionWithExpiry: getSessionWithExpiryMock,
  getParticipant: vi.fn(async () => null),
  setLieTruths: vi.fn(async () => {}),
  getLieTruths: vi.fn(async () => null),
}));

vi.mock('../socialIcebreakerAIService', () => ({
  generateMicroChallenges: generateMicroChallengesMock,
  generateRecapSummary: generateRecapSummaryMock,
  buildLieDetectiveV2RecapData: vi.fn(() => ({ aiWinRate: 0, hardestRound: 0, fooledEveryone: 0 })),
}));

vi.mock('../services/socialIcebreakerBotService', () => ({
  seedSingleTestBotsWarmupReady: vi.fn(() => {}),
}));

vi.mock('../lib/isSingleTestMode', () => ({
  isSingleTestMode: vi.fn(() => false),
}));

vi.mock('../lib/medalCuration', () => ({
  curateMedals: vi.fn(() => []),
}));

vi.mock('../lib/contextInjector', () => ({
  buildArchetypeContext: vi.fn(() => ({ mixText: '' })),
}));

vi.mock('../services/customModeService', () => ({
  isCustomMode: vi.fn(() => false),
  computeSelectablePhases: vi.fn(() => []),
  generatePhaseSelectionId: vi.fn(() => 'psel_test'),
}));

import {
  isPhaseNaturallyComplete,
  isWarmupTopicsGenerating,
  processAutoAdvance,
  transitionPhase,
} from '../routes/socialIcebreakerHelpers';
import { isSingleTestMode } from '../lib/isSingleTestMode';

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_test',
    icebreakerSessionId: 'icebreaker_test',
    currentPhase: 'micro_challenge',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 4,
    phaseStartedAt: Date.now() - 60_000,
    sessionStartedAt: Date.now() - 600_000,
    completedPhases: ['warmup'],
    autoAdvanceEnabled: true,
    ...overrides,
  } as SocialSessionState;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isSingleTestMode).mockReturnValue(false);
  getSessionWithExpiryMock.mockResolvedValue({ state: null, expired: false });
});

describe('isPhaseNaturallyComplete', () => {
  it('micro_challenge: complete when everyone finished and a challenge exists', () => {
    const state = makeState({
      currentChallenge: { id: 'mc-1', title: 't', description: 'd', durationSeconds: 180, completionCTA: 'c' },
      challengeCompletedBy: ['a', 'b', 'c', 'd'],
    });
    expect(isPhaseNaturallyComplete(state)).toBe(true);
  });

  it('micro_challenge: incomplete without a generated challenge (wedge guard)', () => {
    const state = makeState({
      currentChallenge: undefined,
      challengeCompletedBy: ['a', 'b', 'c', 'd'],
    });
    expect(isPhaseNaturallyComplete(state)).toBe(false);
  });

  it('personality_dice: completed + passed union covers the roster', () => {
    const state = makeState({
      currentPhase: 'personality_dice',
      diceCompletedBy: ['a', 'b', 'c'],
      dicePassedBy: ['d'],
    });
    expect(isPhaseNaturallyComplete(state)).toBe(true);
  });

  it('warmup: requires topics before readiness counts', () => {
    const state = makeState({
      currentPhase: 'warmup',
      warmupTopics: [],
      warmupReadyUserIds: ['a', 'b', 'c', 'd'],
    });
    expect(isPhaseNaturallyComplete(state)).toBe(false);
  });
});

describe.skip('processAutoAdvance — retired all-ready fast fuse', () => {
  it('schedules a short visible fuse (~7s) instead of the legacy 30s schedule', async () => {
    const before = Date.now();
    const state = makeState({
      currentChallenge: { id: 'mc-1', title: 't', description: 'd', durationSeconds: 180, completionCTA: 'c' },
      challengeCompletedBy: ['a', 'b', 'c', 'd'],
    });

    const result = await processAutoAdvance(state);

    expect(result.currentPhase).toBe('micro_challenge');
    expect(result.autoAdvanceScheduledAt).toBeDefined();
    const fuseInMs = (result.autoAdvanceScheduledAt ?? 0) - before;
    expect(fuseInMs).toBeGreaterThanOrEqual(5_000);
    expect(fuseInMs).toBeLessThanOrEqual(8_000);
    expect(result.advanceFuseKind).toBe('all_ready');
  });

  it('uses the longer test-mode fuse for single-test sessions', async () => {
    vi.mocked(isSingleTestMode).mockReturnValue(true);
    const before = Date.now();
    const state = makeState({
      currentChallenge: { id: 'mc-1', title: 't', description: 'd', durationSeconds: 180, completionCTA: 'c' },
      challengeCompletedBy: ['a', 'b', 'c', 'd'],
      singleTest: { version: 2, groupId: 'g', isTestModeSkip: true, runBots: true, bots: [], botPersonas: [] },
    });

    const result = await processAutoAdvance(state);
    const fuseInMs = (result.autoAdvanceScheduledAt ?? 0) - before;
    expect(fuseInMs).toBeGreaterThanOrEqual(9_000);
    expect(fuseInMs).toBeLessThanOrEqual(11_000);
  });

  it('executes a due fuse through the unified pipeline and generates the micro-challenge (wedge fix)', async () => {
    const state = makeState({
      currentPhase: 'warmup',
      completedPhases: [],
      warmupTopics: [{ question: 'q', depthLevel: 1, style: 'binary', safety: 'gentle' } as never],
      warmupReadyUserIds: ['a', 'b', 'c', 'd'],
      autoAdvanceScheduledAt: Date.now() - 1_000,
      advanceFuseKind: 'all_ready',
      enabledPhases: ['warmup', 'micro_challenge', 'lie_detective'],
    });

    const result = await processAutoAdvance(state);

    expect(result.currentPhase).toBe('micro_challenge');
    expect(generateMicroChallengesMock).toHaveBeenCalledOnce();
    expect(result.currentChallenge?.title).toBe('互相问3个问题');
    expect(result.challengeCompletedBy).toEqual([]);
    expect(result.lastAdvanceTrigger).toBe('auto_all_ready');
    expect(result.autoAdvanceScheduledAt).toBeUndefined();
    expect(result.completedPhases).toContain('warmup');
    expect(savePhaseMetricMock).toHaveBeenCalledOnce();
  });

  it('runs transitionPhase exactly once when two readers see the same due fuse concurrently', async () => {
    const fuseAt = Date.now() - 1_000;
    const makeDueState = () =>
      makeState({
        currentPhase: 'warmup',
        completedPhases: [],
        warmupTopics: [{ question: 'q', depthLevel: 1, style: 'binary', safety: 'gentle' } as never],
        warmupReadyUserIds: ['a', 'b', 'c', 'd'],
        autoAdvanceScheduledAt: fuseAt,
        advanceFuseKind: 'all_ready',
        enabledPhases: ['warmup', 'micro_challenge', 'lie_detective'],
      });

    // The re-verify read sees the fuse still due; the R3 clear-persist blocks
    // so executor 1 holds the in-flight claim while reader 2 arrives.
    getSessionWithExpiryMock.mockImplementation(async () => ({
      state: makeDueState(),
      expired: false,
    }));
    let releaseClearPersist!: () => void;
    const clearPersistGate = new Promise<void>((resolve) => {
      releaseClearPersist = resolve;
    });
    updateSessionMock.mockImplementationOnce(() => clearPersistGate);

    const p1 = processAutoAdvance(makeDueState());
    await vi.waitFor(() => {
      expect(updateSessionMock).toHaveBeenCalledTimes(1);
    });

    const stateB = makeDueState();
    const p2 = await processAutoAdvance(stateB);

    // Reader 2 saw the claim and bailed without executing anything.
    expect(p2.currentPhase).toBe('warmup');
    expect(generateMicroChallengesMock).not.toHaveBeenCalled();

    releaseClearPersist();
    const result1 = await p1;

    expect(result1.currentPhase).toBe('micro_challenge');
    expect(generateMicroChallengesMock).toHaveBeenCalledTimes(1);
  });

  it('skips execution when the persisted fuse was already cleared by another executor', async () => {
    const state = makeState({
      currentPhase: 'warmup',
      completedPhases: [],
      warmupTopics: [{ question: 'q', depthLevel: 1, style: 'binary', safety: 'gentle' } as never],
      warmupReadyUserIds: ['a', 'b', 'c', 'd'],
      autoAdvanceScheduledAt: Date.now() - 1_000,
      advanceFuseKind: 'all_ready',
      enabledPhases: ['warmup', 'micro_challenge', 'lie_detective'],
    });
    // Another executor already cleared + persisted the fuse.
    getSessionWithExpiryMock.mockResolvedValue({
      state: makeState({ autoAdvanceScheduledAt: undefined }),
      expired: false,
    });

    const result = await processAutoAdvance(state);

    expect(result.currentPhase).toBe('warmup');
    expect(generateMicroChallengesMock).not.toHaveBeenCalled();
    expect(updateSessionMock).not.toHaveBeenCalled();
  });

  it('pauses at the bonus gate instead of auto-entering mini_script', async () => {
    const state = makeState({
      currentPhase: 'lie_detective',
      lieDetectivePlayers: [
        { userId: 'a', displayName: 'a', statements: [] },
        { userId: 'b', displayName: 'b', statements: [] },
        { userId: 'c', displayName: 'c', statements: [] },
        { userId: 'd', displayName: 'd', statements: [] },
      ],
      lieDetectiveCompletedUserIds: ['a', 'b', 'c', 'd'],
      autoAdvanceScheduledAt: Date.now() - 1_000,
      advanceFuseKind: 'all_ready',
      enabledPhases: ['warmup', 'lie_detective', 'mini_script'],
    });

    const result = await processAutoAdvance(state);

    expect(result.currentPhase).toBe('lie_detective');
    expect(result.bonusGateOffered).toBe(true);
    expect(result.autoAdvanceScheduledAt).toBeUndefined();
  });
});

describe.skip('processAutoAdvance — retired stall path', () => {
  it('nudges the host first instead of silently scheduling an advance', async () => {
    const state = makeState({
      currentChallenge: { id: 'mc-1', title: 't', description: 'd', durationSeconds: 180, completionCTA: 'c' },
      challengeCompletedBy: ['a', 'b', 'c'], // 75% completion
      phaseStartedAt: Date.now() - 3 * 60_000, // ≥2min elapsed → advance_ready
    });

    const result = await processAutoAdvance(state);

    expect(result.stallNudgeAt).toBeDefined();
    expect(result.autoAdvanceScheduledAt).toBeUndefined();
    expect(result.currentPhase).toBe('micro_challenge');
  });

  it('schedules a stall_recovery fuse only after the grace period', async () => {
    const state = makeState({
      currentChallenge: { id: 'mc-1', title: 't', description: 'd', durationSeconds: 180, completionCTA: 'c' },
      challengeCompletedBy: ['a', 'b', 'c'],
      phaseStartedAt: Date.now() - 3 * 60_000,
      stallNudgeAt: Date.now() - 80_000, // grace (75s) elapsed
    });

    const result = await processAutoAdvance(state);

    expect(result.stallNudgeAt).toBeUndefined();
    expect(result.advanceFuseKind).toBe('stall_recovery');
    expect(result.autoAdvanceScheduledAt).toBeGreaterThan(Date.now());
  });

  it('stays silent when the host dismissed the nudge for this phase', async () => {
    const state = makeState({
      currentChallenge: { id: 'mc-1', title: 't', description: 'd', durationSeconds: 180, completionCTA: 'c' },
      challengeCompletedBy: ['a', 'b', 'c'],
      phaseStartedAt: Date.now() - 3 * 60_000,
      stallSuppressedForPhase: 'micro_challenge',
    });

    const result = await processAutoAdvance(state);

    expect(result.stallNudgeAt).toBeUndefined();
    expect(result.autoAdvanceScheduledAt).toBeUndefined();
  });
});

describe.skip('processAutoAdvance — retired warmup stall machinery', () => {
  it('never nudges or fuses while warmup topics are generating', async () => {
    const state = makeState({
      currentPhase: 'warmup',
      completedPhases: [],
      warmupTopicsStatus: 'generating',
      warmupTopicsGeneratingAt: Date.now(),
      phaseStartedAt: Date.now() - 20 * 60_000, // past the phase timeout — without suppression this WOULD nudge
    });

    const result = await processAutoAdvance(state);

    expect(result.currentPhase).toBe('warmup');
    expect(result.stallNudgeAt).toBeUndefined();
    expect(result.autoAdvanceScheduledAt).toBeUndefined();
  });

  it('resumes the stall machinery when the generating marker is wedged (>30s)', async () => {
    const state = makeState({
      currentPhase: 'warmup',
      completedPhases: [],
      warmupTopicsStatus: 'generating',
      warmupTopicsGeneratingAt: Date.now() - 31_000,
      phaseStartedAt: Date.now() - 20 * 60_000,
    });

    const result = await processAutoAdvance(state);

    expect(result.stallNudgeAt).toBeDefined();
  });

  it('resumes the stall machinery immediately once topics are ready', async () => {
    const state = makeState({
      currentPhase: 'warmup',
      completedPhases: [],
      warmupTopicsStatus: 'ready',
      phaseStartedAt: Date.now() - 20 * 60_000,
    });

    const result = await processAutoAdvance(state);

    expect(result.stallNudgeAt).toBeDefined();
  });
});

describe('processAutoAdvance — countdown retirement', () => {
  it('clears a legacy fuse without advancing a completed phase', async () => {
    const state = makeState({
      currentPhase: 'quip_battle',
      quipBattleRevealed: true,
      autoAdvanceEnabled: true,
      autoAdvanceScheduledAt: Date.now() - 1_000,
      advanceFuseKind: 'all_ready',
    });

    const result = await processAutoAdvance(state);

    expect(result.currentPhase).toBe('quip_battle');
    expect(result.autoAdvanceEnabled).toBe(false);
    expect(result.autoAdvanceScheduledAt).toBeUndefined();
    expect(result.advanceFuseKind).toBeUndefined();
    expect(updateSessionMock).toHaveBeenCalledOnce();
  });

  it('does not schedule a fuse when Group Mirror is complete', async () => {
    const state = makeState({
      currentPhase: 'group_mirror',
      groupMirrorRevealed: true,
      autoAdvanceEnabled: true,
    });

    const result = await processAutoAdvance(state);

    expect(result.currentPhase).toBe('group_mirror');
    expect(result.autoAdvanceEnabled).toBe(false);
    expect(result.autoAdvanceScheduledAt).toBeUndefined();
    expect(updateSessionMock).toHaveBeenCalledOnce();
  });
});

describe('isWarmupTopicsGenerating', () => {
  it('is false outside warmup, without the marker, and past the window', () => {
    const now = Date.now();
    expect(isWarmupTopicsGenerating(makeState({
      currentPhase: 'micro_challenge',
      warmupTopicsStatus: 'generating',
      warmupTopicsGeneratingAt: now,
    }), now)).toBe(false);
    expect(isWarmupTopicsGenerating(makeState({
      currentPhase: 'warmup',
      warmupTopicsStatus: 'generating',
    }), now)).toBe(false);
    expect(isWarmupTopicsGenerating(makeState({
      currentPhase: 'warmup',
      warmupTopicsStatus: 'generating',
      warmupTopicsGeneratingAt: now - 31_000,
    }), now)).toBe(false);
    expect(isWarmupTopicsGenerating(makeState({
      currentPhase: 'warmup',
      warmupTopicsStatus: 'generating',
      warmupTopicsGeneratingAt: now - 5_000,
    }), now)).toBe(true);
  });
});

describe('transitionPhase', () => {
  it('clears a pending fuse so a manual advance never double-advances', async () => {
    const state = makeState({
      currentPhase: 'warmup',
      autoAdvanceScheduledAt: Date.now() + 5_000,
      advanceFuseKind: 'all_ready',
      stallNudgeAt: Date.now() - 1_000,
      enabledPhases: ['warmup', 'micro_challenge'],
    });

    const result = await transitionPhase({ state, socialSessionId: state.socialSessionId, trigger: 'host_tap' });

    expect(result.transitioned).toBe(true);
    expect(state.autoAdvanceScheduledAt).toBeUndefined();
    expect(state.advanceFuseKind).toBeUndefined();
    expect(state.stallNudgeAt).toBeUndefined();
    expect(state.lastAdvanceTrigger).toBe('host_tap');
  });

  it('early-end does not count the skipped phase as played', async () => {
    const state = makeState({
      completedPhases: ['warmup'],
    });

    const result = await transitionPhase({
      state,
      socialSessionId: state.socialSessionId,
      trigger: 'early_end_jump',
      targetPhase: 'recap',
      countCurrentPhaseCompleted: false,
      skipBonusGate: true,
    });

    expect(result.transitioned).toBe(true);
    expect(result.nextPhase).toBe('recap');
    expect(state.completedPhases).toEqual(['warmup']);
    expect(state.recapSnapshot).toBeDefined();
  });

  it('cancels an all-ready fuse when completion regressed during the window (R2)', async () => {
    const state = makeState({
      currentChallenge: { id: 'mc-1', title: 't', description: 'd', durationSeconds: 180, completionCTA: 'c' },
      challengeCompletedBy: ['a', 'b'], // no longer all ready
      autoAdvanceScheduledAt: Date.now() - 1_000,
      advanceFuseKind: 'all_ready',
    });

    const result = await processAutoAdvance(state);

    expect(result.currentPhase).toBe('micro_challenge');
    expect(result.autoAdvanceScheduledAt).toBeUndefined();
    expect(result.advanceFuseKind).toBeUndefined();
  });

  it('recap snapshot is built from pre-cleanup state (R5: auction lines survive early-end)', async () => {
    const state = makeState({
      currentPhase: 'auction',
      completedPhases: ['warmup'],
      auctionAllLotsClosed: true,
      auctionRecapLines: ['表演节目由Host以10币拍下'],
    });

    await transitionPhase({
      state,
      socialSessionId: state.socialSessionId,
      trigger: 'early_end_jump',
      targetPhase: 'recap',
      countCurrentPhaseCompleted: false,
      skipBonusGate: true,
    });

    expect(state.recapSnapshot).toBeDefined();
    expect(generateRecapSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({ auctionRecapLines: ['表演节目由Host以10币拍下'] }),
    );
  });

  it('skips the dwell metric when the phase was already counted (R6: bonus-gate decline re-entry)', async () => {
    const state = makeState({
      currentPhase: 'lie_detective',
      completedPhases: ['warmup', 'micro_challenge', 'lie_detective'],
    });

    await transitionPhase({
      state,
      socialSessionId: state.socialSessionId,
      trigger: 'host_tap',
      targetPhase: 'recap',
      skipBonusGate: true,
    });

    expect(savePhaseMetricMock).not.toHaveBeenCalled();
  });

  it('builds the lie V2 recapData on automated transitions out of lie_detective (O1)', async () => {
    const state = makeState({
      currentPhase: 'lie_detective',
      lieDetectiveRevealHistory: [{ round: 1, correctRate: 0.5 }],
      enabledPhases: ['warmup', 'lie_detective', 'micro_challenge'],
    });

    await transitionPhase({
      state,
      socialSessionId: state.socialSessionId,
      trigger: 'auto_all_ready',
    });

    expect(state.recapData?.lieDetective).toBeDefined();
  });
});

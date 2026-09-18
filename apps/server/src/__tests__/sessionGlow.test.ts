/**
 * Session Glow 高光值 core mechanics (sprint wave4-sessionGlow):
 *  - AC-04: D1 accumulation table — per-source points, caps, banked-marker
 *    idempotency (verifier N4), participation marks (incl. M2 mini_script
 *    ready∨vote∨result)
 *  - AC-05: transitionPhase PRE-CLEANUP integration — load-bearing banking
 *    for every wiped source (V-1 list incl. miniScriptRevealedPlayerResults,
 *    the spec-gap catch), bonus-gate double-fire safety, extractor-throw
 *    fail-open, preCleanupState dual-write
 *  - AC-06: medal honesty iron rule (verifier R4) — flag-ON zero-data →
 *    zero medals + no crash; thresholds; distinct winners; cap 4;
 *    determinism; flag-OFF shuffle fallback untouched
 *  - AC-07: recapSnapshot.glow derivation — tiers (6/12 thresholds),
 *    one-computation dual-write (verifier N5), exactly-3 tableLine variants
 *    (verifier M3), idempotency, all-zero honest empty state
 *  - AC-08: flag-off byte identity — no glow fields written, no glow key
 *  - AC-09: sanitizeStateForClient — self-only glowPoints projection,
 *    glowParticipation/glowBanked stripped, no-numeric-leak shape proof
 *
 * Harness cloned from highlightsInjectorFlag.test.ts (stateful in-memory
 * feature-flag DB rows + in-memory session store).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  GlowPointBreakdown,
  SocialSessionState,
  SocialIcebreakerPhase,
} from '@shared/socialIcebreaker';
import { logger } from '../lib/logger';

const { flagDbRows, testSessions, mockGenerateRecapSummary } = vi.hoisted(() => ({
  flagDbRows: new Map<string, boolean>(),
  testSessions: new Map<string, SocialSessionState>(),
  mockGenerateRecapSummary: vi.fn(async (_params: Record<string, unknown>) => ({
    data: { headline: 'h', moments: ['m'], closingLine: 'c' },
    meta: { promptVersion: 'test-recap', fallbackUsed: false, fromCache: false, provider: null, generatedAt: new Date().toISOString() },
  })),
}));

vi.mock('../lib/featureFlags', async (importActual) => {
  const actual = await importActual<typeof import('../lib/featureFlags')>();
  const resolve = (key: string, fallback = false): boolean => {
    if (flagDbRows.has(key)) return flagDbRows.get(key)!;
    const envKey = actual.FLAG_ENV_MAP[key];
    const envVal = envKey ? process.env[envKey] : undefined;
    if (envVal !== undefined) return envVal.toLowerCase() === 'true';
    return actual.DEFAULT_FLAG_VALUES[key] ?? fallback;
  };
  return {
    ...actual,
    getFeatureFlag: vi.fn(async (key: string, fallback = false) => resolve(key, fallback)),
  };
});

vi.mock('../lib/socialIcebreakerStore', () => ({
  getSessionWithExpiry: async (socialSessionId: string) => ({
    state: testSessions.get(socialSessionId) ?? null,
    expired: false,
  }),
  updateSession: async (socialSessionId: string, state: SocialSessionState) => {
    testSessions.set(socialSessionId, state);
  },
  listParticipants: async (socialSessionId: string) => {
    const state = testSessions.get(socialSessionId);
    return (
      state?.joinedParticipants?.map((p) => ({
        ...p,
        joinedAt: p.joinedAt ?? new Date().toISOString(),
        lastSeenAt: p.lastSeenAt ?? new Date().toISOString(),
        isActive: true,
      })) ?? []
    );
  },
  loadSessionLieTruths: async () => [],
  savePhaseMetric: async () => {},
}));

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

vi.mock('../lib/aiTraceLogger', () => ({
  createAiCorrelationId: () => 'test-trace-id',
  logAITrace: vi.fn(),
}));

vi.mock('../socialIcebreakerAIService', async (importActual) => {
  const actual = await importActual<typeof import('../socialIcebreakerAIService')>();
  return {
    ...actual,
    generateRecapSummary: mockGenerateRecapSummary,
    generateMicroChallenges: vi.fn(async () => ({
      data: [],
      meta: { promptVersion: 'test-micro', fallbackUsed: true, fromCache: false, provider: null, generatedAt: new Date().toISOString() },
    })),
  };
});

const {
  transitionPhase,
  ensureRecapSnapshot,
  sanitizeStateForClient,
} = await import('../routes/socialIcebreakerHelpers');
const { curateMedals, GLOW_MEDAL_MAX_PER_SESSION } = await import('../lib/medalCuration');
const {
  accumulateGlowForPhase,
  deriveGlowTier,
  deriveGlowTiers,
  glowTotal,
  hasFullGlowAttendance,
  resolveOfferedGlowPhases,
  selectGlowTableLineVariant,
} = await import('../lib/sessionGlow');
const { GLOW_MEDAL_COPY } = await import('@shared/copy/sessionGlow');

const ROSTER = ['host-user', 'p1', 'p2', 'p3'].map((userId) => ({
  userId,
  displayName: userId,
}));

function makeState(id: string, overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: id,
    icebreakerSessionId: `ice-${id}`,
    currentPhase: 'warmup',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 4,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: [],
    enabledPhases: ['warmup', 'quip_battle', 'group_mirror', 'recap'],
    joinedParticipants: ['host-user', 'p1', 'p2', 'p3'].map((userId) => ({
      userId,
      displayName: userId,
      joinedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      isActive: true,
    })),
    ...overrides,
  } as SocialSessionState;
}

function glow(overrides: Partial<GlowPointBreakdown> = {}): GlowPointBreakdown {
  return {
    quip: 0,
    mirror: 0,
    auction: 0,
    miniscript: 0,
    undercover: 0,
    challenge: 0,
    dice: 0,
    lie: 0,
    ...overrides,
  };
}

async function transition(
  state: SocialSessionState,
  targetPhase: SocialIcebreakerPhase,
  opts: { skipBonusGate?: boolean } = {},
) {
  testSessions.set(state.socialSessionId, state);
  return transitionPhase({
    state,
    socialSessionId: state.socialSessionId,
    trigger: 'host_tap',
    targetPhase,
    skipBonusGate: opts.skipBonusGate ?? true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  flagDbRows.clear();
  testSessions.clear();
  delete process.env.SESSION_GLOW_ENABLED;
});

afterEach(() => {
  delete process.env.SESSION_GLOW_ENABLED;
});

// ─── AC-04: accumulateGlowForPhase — D1 table, caps, idempotency ────────────

describe('accumulateGlowForPhase (AC-04)', () => {
  it('quip: +2 per vote received via answerId `${userId}::` prefix, cap 8', () => {
    const state = makeState('acc-quip', {
      quipBattleVotes: [
        { voterId: 'p2', answerId: 'p1::promptA', promptId: 'promptA' },
        { voterId: 'p3', answerId: 'p1::promptA', promptId: 'promptA' },
        { voterId: 'p1', answerId: 'p2::promptA', promptId: 'promptA' },
        { voterId: 'p3', answerId: 'p1::promptB', promptId: 'promptB' },
        { voterId: 'p2', answerId: 'p1::promptB', promptId: 'promptB' },
      ],
      quipBattleSubmittedUserIds: ['p1', 'p2'],
    });

    accumulateGlowForPhase(state, 'quip_battle');

    expect(state.glowPoints?.p1.quip).toBe(8); // 5 votes → capped at 8
    expect(state.glowPoints?.p2.quip).toBe(2);
    expect(state.glowParticipation?.p1).toContain('quip_battle');
    expect(state.glowParticipation?.p2).toContain('quip_battle');
    expect(state.glowParticipation?.p3 ?? []).not.toContain('quip_battle');
  });

  it('mirror: +2 per nomination from groupMirrorVotes, falls back to answers, cap 8', () => {
    const state = makeState('acc-mirror', {
      groupMirrorVotes: [
        { userId: 'p2', displayName: 'p2', questionId: 'q1', targetUserId: 'p1' },
        { userId: 'p3', displayName: 'p3', questionId: 'q1', targetUserId: 'p1' },
      ],
      groupMirrorSubmittedUserIds: ['p1', 'p2', 'p3'],
    });

    accumulateGlowForPhase(state, 'group_mirror');

    expect(state.glowPoints?.p1.mirror).toBe(4);
    expect(state.glowParticipation?.p3).toContain('group_mirror');
  });

  it('auction: +3 per lot won (cap 6), banked marker makes double-fire a no-op and honest re-runs bank only new lots', () => {
    const lot = (lotIndex: number, winnerUserId: string | null) => ({
      lotIndex,
      lotId: `lot-${lotIndex}`,
      title: `Lot ${lotIndex}`,
      winnerUserId,
      winningAmount: winnerUserId ? 20 : null,
      bidCount: 2,
      wasAllIn: false,
    });
    const state = makeState('acc-auction', {
      auctionLotResults: [lot(0, 'p1'), lot(1, 'p1'), lot(2, null)],
      auctionBidHistory: [
        { userId: 'p1', amount: 10, at: 1, lotIndex: 0 },
        { userId: 'p2', amount: 15, at: 2, lotIndex: 1 },
      ],
    });

    accumulateGlowForPhase(state, 'auction');
    expect(state.glowPoints?.p1.auction).toBe(6); // 2 wins → capped at 6
    expect(state.glowBanked?.auctionLots).toBe(3);
    expect(state.glowParticipation?.p2).toContain('auction'); // bidder
    expect(state.glowParticipation?.p1).toContain('auction');

    // Double-fire: no new results → no change.
    accumulateGlowForPhase(state, 'auction');
    expect(state.glowPoints?.p1.auction).toBe(6);

    // Honest re-run: a NEW appended result banks only the new entry.
    state.auctionLotResults = [...(state.auctionLotResults ?? []), lot(3, 'p2')];
    accumulateGlowForPhase(state, 'auction');
    expect(state.glowPoints?.p1.auction).toBe(6);
    expect(state.glowPoints?.p2.auction).toBe(3);
    expect(state.glowBanked?.auctionLots).toBe(4);
  });

  it('miniscript: +3 only for dual-correct (round1+round2); participation = ready∨vote∨result (verifier M2)', () => {
    const state = makeState('acc-mini', {
      miniScriptRevealedPlayerResults: [
        { userId: 'p1', round1Correct: true, round2Correct: true },
        { userId: 'p2', round1Correct: true, round2Correct: false },
      ],
      miniScriptPlayerReady: { p3: true, 'host-user': false },
      miniScriptVotes: [{ userId: 'p2', suspectRoleSlot: 1, votedAt: 1 }],
    });

    accumulateGlowForPhase(state, 'mini_script');

    expect(state.glowPoints?.p1.miniscript).toBe(3);
    expect(state.glowPoints?.p2?.miniscript ?? 0).toBe(0);
    // Ready-only player still counts toward 全勤 (verifier M2).
    expect(state.glowParticipation?.p3).toContain('mini_script');
    expect(state.glowParticipation?.p2).toContain('mini_script'); // voter
    expect(state.glowParticipation?.p1).toContain('mini_script'); // result
    expect(state.glowParticipation?.['host-user'] ?? []).not.toContain('mini_script');
  });

  it('undercover: hidden success +3 to the undercover; caught → +2 to correct voters only', () => {
    const hidden = makeState('acc-uc-hidden', {
      undercoverWordResults: {
        undercoverUserId: 'p1',
        undercoverDisplayName: 'p1',
        civilianWord: 'a',
        undercoverWord: 'b',
        voteCounts: {},
        caught: false,
      },
      undercoverWordVotedUserIds: ['p2', 'p3'],
    });
    accumulateGlowForPhase(hidden, 'undercover_word');
    expect(hidden.glowPoints?.p1.undercover).toBe(3);
    expect(hidden.glowParticipation?.p1).toContain('undercover_word');
    expect(hidden.glowParticipation?.p2).toContain('undercover_word');

    const caught = makeState('acc-uc-caught', {
      undercoverWordResults: {
        undercoverUserId: 'p1',
        undercoverDisplayName: 'p1',
        civilianWord: 'a',
        undercoverWord: 'b',
        voteCounts: {},
        caught: true,
      },
      undercoverWordVotes: [
        { voterId: 'p2', targetUserId: 'p1' },
        { voterId: 'p3', targetUserId: 'host-user' },
      ],
    });
    accumulateGlowForPhase(caught, 'undercover_word');
    expect(caught.glowPoints?.p2.undercover).toBe(2);
    expect(caught.glowPoints?.p3?.undercover ?? 0).toBe(0);
    expect(caught.glowPoints?.p1?.undercover ?? 0).toBe(0);
  });

  it('challenge: +2 per completion (cap 2) via banked marker; dice +2; lie +1 — opt-out never negative', () => {
    const state = makeState('acc-challenge', { challengeCompletedBy: ['p1', 'p2'] });
    accumulateGlowForPhase(state, 'micro_challenge');
    expect(state.glowPoints?.p1.challenge).toBe(2);
    expect(state.glowBanked?.challengeCompleted).toBe(2);
    // Double-fire: no-op.
    accumulateGlowForPhase(state, 'micro_challenge');
    expect(state.glowPoints?.p1.challenge).toBe(2);

    const dice = makeState('acc-dice', { diceCompletedBy: ['p1'], dicePassedBy: ['p2'] });
    accumulateGlowForPhase(dice, 'personality_dice');
    expect(dice.glowPoints?.p1.dice).toBe(2);
    expect(dice.glowParticipation?.p2).toContain('personality_dice'); // honest pass counts

    const lie = makeState('acc-lie', { lieDetectiveCompletedUserIds: ['p1'] });
    accumulateGlowForPhase(lie, 'lie_detective');
    expect(lie.glowPoints?.p1.lie).toBe(1);

    // Opt-out / silence: no sources → no glowPoints written at all.
    const silent = makeState('acc-silent');
    accumulateGlowForPhase(silent, 'micro_challenge');
    expect(silent.glowPoints).toBeUndefined();
  });
});

// ─── AC-05: transitionPhase PRE-CLEANUP integration (load-bearing, V-1) ─────

describe('transitionPhase glow accumulation (AC-05, V-1 load-bearing)', () => {
  it('quip exit: points banked even though cleanup wipes quipBattleVotes', async () => {
    const state = makeState('lb-quip', {
      sessionGlowEnabled: true,
      currentPhase: 'quip_battle',
      completedPhases: ['warmup'],
      quipBattleVotes: [{ voterId: 'p2', answerId: 'p1::promptA', promptId: 'promptA' }],
      quipBattleSubmittedUserIds: ['p1'],
    });

    await transition(state, 'warmup');

    expect(state.quipBattleVotes).toBeUndefined(); // cleanup ran
    expect(state.glowPoints?.p1.quip).toBe(2); // banked BEFORE the wipe
    expect(state.glowParticipation?.p1).toContain('quip_battle');
  });

  it('mirror exit: banked before groupMirrorVotes wipe', async () => {
    const state = makeState('lb-mirror', {
      sessionGlowEnabled: true,
      currentPhase: 'group_mirror',
      completedPhases: ['warmup'],
      groupMirrorVotes: [
        { userId: 'p2', displayName: 'p2', questionId: 'q1', targetUserId: 'p1' },
      ],
      groupMirrorSubmittedUserIds: ['p1', 'p2'],
    });

    await transition(state, 'warmup');

    expect(state.groupMirrorVotes).toBeUndefined();
    expect(state.glowPoints?.p1.mirror).toBe(2);
  });

  it('undercover exit: banked before undercoverWordVotes + results wipe', async () => {
    const state = makeState('lb-uc', {
      sessionGlowEnabled: true,
      currentPhase: 'undercover_word',
      completedPhases: ['warmup'],
      undercoverWordResults: {
        undercoverUserId: 'p1',
        undercoverDisplayName: 'p1',
        civilianWord: 'a',
        undercoverWord: 'b',
        voteCounts: {},
        caught: true,
      },
      undercoverWordVotes: [{ voterId: 'p2', targetUserId: 'p1' }],
      undercoverWordVotedUserIds: ['p2'],
    });

    await transition(state, 'warmup');

    expect(state.undercoverWordVotes).toBeUndefined();
    expect(state.undercoverWordResults).toBeUndefined();
    expect(state.glowPoints?.p2.undercover).toBe(2);
  });

  it('mini_script exit: banked before miniScriptRevealedPlayerResults wipe (spec-gap catch, V-1)', async () => {
    const state = makeState('lb-mini', {
      sessionGlowEnabled: true,
      currentPhase: 'mini_script',
      completedPhases: ['warmup'],
      miniScriptRevealedPlayerResults: [
        { userId: 'p1', round1Correct: true, round2Correct: true },
      ],
      miniScriptPlayerReady: { p2: true },
    });

    await transition(state, 'warmup');

    expect(state.miniScriptRevealedPlayerResults).toBeUndefined();
    expect(state.glowPoints?.p1.miniscript).toBe(3);
    expect(state.glowParticipation?.p2).toContain('mini_script');
  });

  it('dice + lie exits: banked before diceCompletedBy / lieDetectiveCompletedUserIds wipes', async () => {
    const dice = makeState('lb-dice', {
      sessionGlowEnabled: true,
      currentPhase: 'personality_dice',
      completedPhases: ['warmup'],
      diceCompletedBy: ['p1'],
    });
    await transition(dice, 'warmup');
    expect(dice.diceCompletedBy).toBeUndefined();
    expect(dice.glowPoints?.p1.dice).toBe(2);

    const lie = makeState('lb-lie', {
      sessionGlowEnabled: true,
      currentPhase: 'lie_detective',
      completedPhases: ['warmup'],
      lieDetectiveCompletedUserIds: ['p1'],
    });
    await transition(lie, 'warmup');
    expect(lie.lieDetectiveCompletedUserIds).toBeUndefined();
    expect(lie.glowPoints?.p1.lie).toBe(1);
  });

  it('bonus-gate double-fire is safe: pause-pass accumulates, gate-resolution re-exit adds nothing', async () => {
    const state = makeState('lb-gate', {
      sessionGlowEnabled: true,
      currentPhase: 'quip_battle',
      completedPhases: ['warmup'],
      enabledPhases: ['warmup', 'quip_battle', 'mini_script', 'recap'],
      quipBattleVotes: [{ voterId: 'p2', answerId: 'p1::promptA', promptId: 'promptA' }],
      quipBattleSubmittedUserIds: ['p1'],
    });

    const paused = await transition(state, 'mini_script', { skipBonusGate: false });
    expect(paused.pausedAtBonusGate).toBe(true);
    expect(state.glowPoints?.p1.quip).toBe(2);

    state.bonusGateAccepted = true;
    const resumed = await transition(state, 'mini_script', { skipBonusGate: false });
    expect(resumed.transitioned).toBe(true);
    // Cleanup wiped the votes on the pause pass — the second exit adds 0.
    expect(state.glowPoints?.p1.quip).toBe(2);
  });

  it('accumulation throw fails open: transition proceeds, warn logged, glow untouched', async () => {
    const state = makeState('lb-throw', {
      sessionGlowEnabled: true,
      currentPhase: 'quip_battle',
      completedPhases: ['warmup'],
      // Malformed: truthy non-array → for..of throws inside accumulate.
      quipBattleVotes: {} as unknown as Array<{ voterId: string; answerId: string; promptId: string }>,
    });

    const result = await transition(state, 'warmup');

    expect(result.transitioned).toBe(true);
    expect(state.currentPhase).toBe('warmup');
    expect(state.glowPoints).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      '[SocialIcebreaker] glow accumulation failed; continuing without glow',
      expect.objectContaining({ socialSessionId: 'lb-throw' }),
    );
  });

  it('flag off (undefined snapshot): no accumulation, no glow fields — byte-identical behavior', async () => {
    const state = makeState('lb-off', {
      currentPhase: 'quip_battle',
      completedPhases: ['warmup'],
      quipBattleVotes: [{ voterId: 'p2', answerId: 'p1::promptA', promptId: 'promptA' }],
    });

    await transition(state, 'warmup');

    expect(state.glowPoints).toBeUndefined();
    expect(state.glowParticipation).toBeUndefined();
    expect(state.glowBanked).toBeUndefined();
    expect(state.sessionGlowEnabled).toBeUndefined();
  });

  it('dual-write: direct quip→recap transition derives recapSnapshot.glow from the pre-cleanup banking', async () => {
    const state = makeState('lb-recap', {
      sessionGlowEnabled: true,
      currentPhase: 'quip_battle',
      completedPhases: ['warmup'],
      quipBattleVotes: [
        { voterId: 'p2', answerId: 'p1::promptA', promptId: 'promptA' },
        { voterId: 'p3', answerId: 'p1::promptA', promptId: 'promptA' },
      ],
      quipBattleSubmittedUserIds: ['p1', 'p2'],
    });

    await transition(state, 'recap');

    expect(state.recapSnapshot?.glow).toBeDefined();
    expect(state.recapSnapshot?.glow?.tiers.p1).toBe('ember'); // 4 pts < 6
    expect(state.recapSnapshot?.glow?.medals.map((m) => m.title)).toContain('接梗王');
    // One computation, dual write (verifier N5): same array content.
    expect(state.recapSnapshot?.glow?.medals).toEqual(state.recapSnapshot?.medals);
    expect(typeof state.recapSnapshot?.glow?.tableLine).toBe('string');
  });
});

// ─── AC-06: medal honesty iron rule (verifier R4) ───────────────────────────

describe('curateMedals honesty (AC-06, verifier R4)', () => {
  it('flag ON + zero data → ZERO medals, no crash (honest empty state)', () => {
    const state = makeState('medal-zero', { sessionGlowEnabled: true });
    const medals = curateMedals(state, ROSTER);
    expect(medals).toEqual([]);
  });

  it('flag OFF + zero data → legacy shuffle fallback still awards 3 medals (byte-identical OFF path)', () => {
    const state = makeState('medal-off-shuffle');
    const medals = curateMedals(state, ROSTER);
    expect(medals).toHaveLength(3);
    expect(medals.map((m) => m.title)).toEqual(['最佳侦探', '挑战先锋', '话题王']);
  });

  it('接梗王 threshold: 1 vote (2 pts) → no medal; 2 votes (4 pts) → medal', () => {
    const below = makeState('medal-quip-below', {
      sessionGlowEnabled: true,
      glowPoints: { p1: glow({ quip: 2 }) },
    });
    expect(curateMedals(below, ROSTER).find((m) => m.title === '接梗王')).toBeUndefined();

    const at = makeState('medal-quip-at', {
      sessionGlowEnabled: true,
      glowPoints: { p1: glow({ quip: 4 }) },
    });
    const medal = curateMedals(at, ROSTER).find((m) => m.title === '接梗王');
    expect(medal?.recipientDisplayName).toBe('p1');
  });

  it('暖心雷达 threshold: ≥2 nominations (4 pts)', () => {
    const state = makeState('medal-mirror', {
      sessionGlowEnabled: true,
      glowPoints: { p2: glow({ mirror: 4 }) },
    });
    expect(curateMedals(state, ROSTER).find((m) => m.title === '暖心雷达')?.recipientDisplayName).toBe('p2');
  });

  it('豪气担当: ≥1 lot won, most wins, tie → earliest first win', () => {
    const lot = (lotIndex: number, winnerUserId: string) => ({
      lotIndex,
      lotId: `lot-${lotIndex}`,
      title: `Lot ${lotIndex}`,
      winnerUserId,
      winningAmount: 20,
      bidCount: 2,
      wasAllIn: false,
    });
    const state = makeState('medal-auction', {
      sessionGlowEnabled: true,
      // p1 and p2 each win 1 — p2 won the EARLIER lot → p2 wins the medal.
      auctionLotResults: [lot(2, 'p1'), lot(0, 'p2')],
    });
    expect(curateMedals(state, ROSTER).find((m) => m.title === '豪气担当')?.recipientDisplayName).toBe('p2');
  });

  it('全勤小可爱: requires completing EVERY offered source phase (V-5), via participation marks', () => {
    const state = makeState('medal-attendance', {
      sessionGlowEnabled: true,
      enabledPhases: ['warmup', 'quip_battle', 'group_mirror', 'recap'],
      glowParticipation: {
        p1: ['quip_battle', 'group_mirror'],
        p2: ['quip_battle'],
      },
    });
    const medals = curateMedals(state, ROSTER);
    const full = medals.find((m) => m.title === '全勤小可爱');
    expect(full?.recipientDisplayName).toBe('p1');
  });

  it('全勤小可爱 respects runPlan.segments over enabledPhases (V-5)', () => {
    const state = makeState('medal-attendance-plan', {
      sessionGlowEnabled: true,
      enabledPhases: ['warmup', 'quip_battle', 'group_mirror', 'lie_detective', 'recap'],
      runPlan: {
        version: 1,
        segments: [{ phase: 'quip_battle' }],
      } as unknown as SocialSessionState['runPlan'],
      glowParticipation: { p1: ['quip_battle'] },
    });
    expect(resolveOfferedGlowPhases(state)).toEqual(['quip_battle']);
    expect(hasFullGlowAttendance(state, 'p1')).toBe(true);
    expect(curateMedals(state, ROSTER).find((m) => m.title === '全勤小可爱')?.recipientDisplayName).toBe('p1');
  });

  it('honest rework: empty legacy weight chains → NOT awarded on the ON path (no shuffle)', () => {
    const state = makeState('medal-honest-legacy', {
      sessionGlowEnabled: true,
      // quip medal present, but zero lie/challenge/topic data.
      glowPoints: { p1: glow({ quip: 4 }) },
    });
    const medals = curateMedals(state, ROSTER);
    expect(medals.map((m) => m.title)).toEqual(['接梗王']);
  });

  it('cap 4 with distinct winners; miniscript dual-correct earns NO medal', () => {
    const state = makeState('medal-cap', {
      sessionGlowEnabled: true,
      enabledPhases: ['warmup', 'quip_battle', 'group_mirror', 'auction', 'mini_script', 'recap'],
      glowPoints: {
        p1: glow({ quip: 8, mirror: 8, auction: 6, miniscript: 3 }),
        p2: glow({ quip: 6, mirror: 6, auction: 3 }),
        p3: glow({ quip: 4, mirror: 4 }),
        'host-user': glow({ quip: 4 }),
      },
      auctionLotResults: [
        { lotIndex: 0, lotId: 'l0', title: 'L0', winnerUserId: 'p1', winningAmount: 10, bidCount: 1, wasAllIn: false },
        { lotIndex: 1, lotId: 'l1', title: 'L1', winnerUserId: 'p2', winningAmount: 10, bidCount: 1, wasAllIn: false },
      ],
      glowParticipation: { p1: ['quip_battle', 'group_mirror', 'auction', 'mini_script'] },
    });
    const medals = curateMedals(state, ROSTER);
    expect(medals.length).toBeLessThanOrEqual(GLOW_MEDAL_MAX_PER_SESSION);
    expect(medals.length).toBe(GLOW_MEDAL_MAX_PER_SESSION);
    const winners = medals.map((m) => m.recipientDisplayName);
    expect(new Set(winners).size).toBe(winners.length);
    // No miniscript medal exists (honor line is its recognition, spec §5).
    expect(medals.find((m) => m.title.includes('剧本') || m.title.includes('侦探') && m.title !== '最佳侦探')).toBeUndefined();
  });

  it('determinism: same input ×3 → identical output', () => {
    const build = () => makeState('medal-det', {
      sessionGlowEnabled: true,
      glowPoints: { p1: glow({ quip: 6 }), p2: glow({ quip: 4, mirror: 4 }) },
    });
    const a = curateMedals(build(), ROSTER);
    const b = curateMedals(build(), ROSTER);
    const c = curateMedals(build(), ROSTER);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('new medal copy comes from the centralized copy module (🔴 reviewable)', () => {
    const state = makeState('medal-copy', {
      sessionGlowEnabled: true,
      glowPoints: { p1: glow({ quip: 4 }) },
    });
    const medal = curateMedals(state, ROSTER).find((m) => m.title === '接梗王');
    expect(medal?.description).toBe(GLOW_MEDAL_COPY.quipKing.description);
    expect(medal?.emoji).toBe(GLOW_MEDAL_COPY.quipKing.emoji);
  });
});

// ─── AC-07: recapSnapshot.glow derivation ───────────────────────────────────

describe('recapSnapshot.glow derivation (AC-07, verifier M3/N5)', () => {
  it('tier thresholds: 5 → ember, 6 → warm, 12 → blazing; floor is always ember', () => {
    expect(deriveGlowTier(0)).toBe('ember');
    expect(deriveGlowTier(5)).toBe('ember');
    expect(deriveGlowTier(6)).toBe('warm');
    expect(deriveGlowTier(11)).toBe('warm');
    expect(deriveGlowTier(12)).toBe('blazing');

    const state = makeState('tiers', {
      glowPoints: { p1: glow({ quip: 6 }), p2: glow({ quip: 8, mirror: 4 }) },
    });
    const tiers = deriveGlowTiers(state, ['p1', 'p2', 'p3']);
    expect(tiers).toEqual({ p1: 'warm', p2: 'blazing', p3: 'ember' });
  });

  it('tableLine: exactly 3 variants selected by aggregate average (M3 — determinism + count, never copy)', () => {
    const quiet = makeState('tl-quiet');
    expect(selectGlowTableLineVariant(quiet, 4)).toBe('quiet');

    const warm = makeState('tl-warm', {
      glowPoints: { p1: glow({ quip: 8 }), p2: glow({ mirror: 8 }) }, // 16/4 = 4
    });
    expect(selectGlowTableLineVariant(warm, 4)).toBe('warm');

    const hot = makeState('tl-hot', {
      glowPoints: { p1: glow({ quip: 8, auction: 6, mirror: 8, challenge: 2, dice: 2, lie: 1, miniscript: 3, undercover: 3 }), p2: glow({ quip: 8, mirror: 4 }) }, // 33+12=45/4 ≥ 10
    });
    expect(selectGlowTableLineVariant(hot, 4)).toBe('hot');

    // Determinism: same input → same variant.
    expect(selectGlowTableLineVariant(warm, 4)).toBe('warm');
  });

  it('flag ON: recapSnapshot.glow derived with tiers/medals/tableLine; recapSnapshot.medals dual-written (N5)', async () => {
    const state = makeState('recap-glow', {
      sessionGlowEnabled: true,
      glowPoints: { p1: glow({ quip: 6 }), p2: glow() },
    });
    testSessions.set(state.socialSessionId, state);

    await ensureRecapSnapshot(state, state.socialSessionId, false);

    expect(state.recapSnapshot?.glow).toBeDefined();
    expect(state.recapSnapshot?.glow?.tiers.p1).toBe('warm');
    expect(state.recapSnapshot?.glow?.tiers.p2).toBe('ember');
    expect(state.recapSnapshot?.glow?.tiers['host-user']).toBe('ember');
    expect(state.recapSnapshot?.glow?.medals).toEqual(state.recapSnapshot?.medals);
    expect(state.recapSnapshot?.glow?.medals.map((m) => m.title)).toContain('接梗王');
    expect(state.recapSnapshot?.glow?.tableLine.length).toBeGreaterThan(0);
  });

  it('all-zero table: zero medals + all-ember + quiet table line (honest empty state, spec D5)', async () => {
    const state = makeState('recap-zero', { sessionGlowEnabled: true });
    testSessions.set(state.socialSessionId, state);

    await ensureRecapSnapshot(state, state.socialSessionId, false);

    expect(state.recapSnapshot?.glow?.medals).toEqual([]);
    expect(state.recapSnapshot?.medals).toEqual([]);
    expect(Object.values(state.recapSnapshot?.glow?.tiers ?? {})).toEqual(
      Array(4).fill('ember'),
    );
    expect(selectGlowTableLineVariant(state, 4)).toBe('quiet');
  });

  it('idempotent: a second ensureRecapSnapshot does not re-derive (existing guard)', async () => {
    const state = makeState('recap-idem', {
      sessionGlowEnabled: true,
      glowPoints: { p1: glow({ quip: 6 }) },
    });
    testSessions.set(state.socialSessionId, state);

    await ensureRecapSnapshot(state, state.socialSessionId, false);
    const first = state.recapSnapshot;
    await ensureRecapSnapshot(state, state.socialSessionId, false);

    expect(state.recapSnapshot).toBe(first);
    expect(mockGenerateRecapSummary).toHaveBeenCalledTimes(1);
  });

  it('flag OFF: recapSnapshot carries NO glow key (byte identity)', async () => {
    const state = makeState('recap-off');
    testSessions.set(state.socialSessionId, state);

    await ensureRecapSnapshot(state, state.socialSessionId, false);

    expect(state.recapSnapshot).toBeDefined();
    expect('glow' in (state.recapSnapshot ?? {})).toBe(false);
  });
});

// ─── AC-09: sanitizeStateForClient privacy ──────────────────────────────────

describe('sanitizeStateForClient glow privacy (AC-09)', () => {
  // Distinctive multi-digit sentinels — must not collide with timestamps or
  // other numeric fields when the full payload is serialized.
  const SENTINEL_A = 424242;
  const SENTINEL_B = 989898;

  function privacyState(): SocialSessionState {
    return makeState('privacy', {
      sessionGlowEnabled: true,
      glowPoints: {
        p1: glow({ quip: SENTINEL_A }),
        p2: glow({ quip: SENTINEL_B }),
      },
      glowParticipation: { p1: ['quip_battle'], p2: ['quip_battle'] },
      glowBanked: { auctionLots: 2, challengeCompleted: 1 },
      recapSnapshot: {
        medals: [],
        glow: {
          tiers: { p1: 'warm', p2: 'blazing' },
          medals: [],
          tableLine: 'tl',
        },
      },
    });
  }

  it("projects glowPoints to the requesting user's own entry only (sentinel A/B)", () => {
    const state = privacyState();

    const forP1 = sanitizeStateForClient(state, 'p1');
    expect(forP1.glowPoints?.p1.quip).toBe(SENTINEL_A);
    expect(forP1.glowPoints?.p2).toBeUndefined();

    const forP2 = sanitizeStateForClient(state, 'p2');
    expect(forP2.glowPoints?.p2.quip).toBe(SENTINEL_B);
    expect(forP2.glowPoints?.p1).toBeUndefined();

    // Host is just another viewer — sees only their own breakdown.
    const forHost = sanitizeStateForClient(state, 'host-user');
    expect(forHost.glowPoints).toBeUndefined();

    // No requester (defensive path): nothing leaks.
    const anonymous = sanitizeStateForClient(state, undefined);
    expect(anonymous.glowPoints).toBeUndefined();
  });

  it('strips glowParticipation + glowBanked for EVERYONE (host and non-host)', () => {
    const state = privacyState();
    for (const requester of ['host-user', 'p1', undefined]) {
      const sanitized = sanitizeStateForClient(state, requester);
      expect('glowParticipation' in sanitized).toBe(false);
      expect('glowBanked' in sanitized).toBe(false);
    }
  });

  it('recapSnapshot.glow (tier words + medals + table line) stays visible to all — word-level only', () => {
    const state = privacyState();
    const sanitized = sanitizeStateForClient(state, 'p3');
    expect(sanitized.recapSnapshot?.glow?.tiers.p2).toBe('blazing');
    expect(sanitized.recapSnapshot?.glow?.tableLine).toBe('tl');
  });

  it('static no-leak proof: other players see NO numeric glow fields anywhere in the payload', () => {
    const state = privacyState();
    const sanitized = sanitizeStateForClient(state, 'p3'); // p3 has no data

    // 1. No glowPoints at all for a data-less requester.
    expect(sanitized.glowPoints).toBeUndefined();
    // 2. recapSnapshot.glow carries tier WORDS (strings), medals (no numeric
    //    fields in the Medal shape), and a table-line string — no per-user
    //    point numbers, no totals, no ordering information.
    const glowPayload = sanitized.recapSnapshot?.glow;
    expect(glowPayload).toBeDefined();
    for (const tier of Object.values(glowPayload?.tiers ?? {})) {
      expect(['ember', 'warm', 'blazing']).toContain(tier);
    }
    const serialized = JSON.stringify(glowPayload);
    expect(serialized).not.toContain(String(SENTINEL_A));
    expect(serialized).not.toContain(String(SENTINEL_B));
    // 3. The whole sanitized payload contains neither sentinel value.
    const fullSerialized = JSON.stringify(sanitized);
    expect(fullSerialized).not.toContain(String(SENTINEL_A));
    expect(fullSerialized).not.toContain(String(SENTINEL_B));
  });

  it('legacy V1 state (no glow fields anywhere) round-trips sanitization without error (AC-03)', () => {
    const state = makeState('legacy-v1');
    const sanitized = sanitizeStateForClient(state, 'p1');
    expect(sanitized.glowPoints).toBeUndefined();
    expect('glowParticipation' in sanitized).toBe(false);
    expect('glowBanked' in sanitized).toBe(false);
  });
});

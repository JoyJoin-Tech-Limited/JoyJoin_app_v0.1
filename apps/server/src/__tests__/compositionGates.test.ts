/**
 * Item 5 (V4 engine upgrade): literature-prior composition gates behind the
 * compositionGatesEnabled flag (COMPOSITION_GATES_ENABLED).
 *
 *   (i)   min-E floor 25 (Barrick et al. 1998 — minimum member score matters)
 *   (ii)  mean-A floor 45 (Bell 2007 — team-level Agreeableness)
 *   (iii) exactly-one spark (reported X ≥ 70 ∨ P ≥ 70), bidirectional pool
 *         exemption (deficit AND surplus), admission-time steering + backstop
 *   (iv)  X-variance hard cap 750 (harmonyScore variance pattern → trait X)
 *
 * Coverage:
 *   - gate predicates + cold-start skip (AC-5.1b: members without a complete
 *     reported vector skip gates (i)/(ii)/(iv))
 *   - admission-time steering nudges (R4 argmax-only pattern)
 *   - commit-gate backstop + per-gate rejection stats
 *   - AC-5.2 non-monotonic re-evaluation inside magnetismRulesSatisfiedFor
 *     (H4 absorption + Phase-2 whole-group formation)
 *   - AC-5.4 duo atomic-unit invariants under gates-on
 *   - AC-5.5 gate-off byte-identity (trait data present but inert)
 *
 * Mock pattern mirrors magnetismGroupRules.test.ts: db, chemistry, and
 * feature flags are mocked; the gate helpers and greedy core are real code.
 */
import { describe, expect, it, vi } from 'vitest';

const schemaMocks = vi.hoisted(() => ({
  eventPoolsTable: Symbol('eventPools'),
  eventPoolRegistrationsTable: Symbol('eventPoolRegistrations'),
  eventPoolGroupsTable: Symbol('eventPoolGroups'),
  eventsTable: Symbol('events'),
  eventAttendanceTable: Symbol('eventAttendance'),
  usersTable: Symbol('users'),
  userInterestsTable: Symbol('userInterests'),
  invitationUsesTable: Symbol('invitationUses'),
  invitationsTable: Symbol('invitations'),
  couponsTable: Symbol('coupons'),
  userCouponsTable: Symbol('userCoupons'),
  matchHistoryTable: Symbol('matchHistory'),
  assessmentSessionsTable: Symbol('assessmentSessions'),
}));

vi.mock('@shared/schema', () => ({
  eventPools: schemaMocks.eventPoolsTable,
  eventPoolRegistrations: schemaMocks.eventPoolRegistrationsTable,
  eventPoolGroups: schemaMocks.eventPoolGroupsTable,
  events: schemaMocks.eventsTable,
  eventAttendance: schemaMocks.eventAttendanceTable,
  users: schemaMocks.usersTable,
  userInterests: schemaMocks.userInterestsTable,
  invitationUses: schemaMocks.invitationUsesTable,
  invitations: schemaMocks.invitationsTable,
  coupons: schemaMocks.couponsTable,
  userCoupons: schemaMocks.userCouponsTable,
  matchHistory: schemaMocks.matchHistoryTable,
  assessmentSessions: schemaMocks.assessmentSessionsTable,
}));

vi.mock('drizzle-orm', () => ({
  eq: (_field: unknown, value: unknown) => ({ type: 'eq', value }),
  and: (...conditions: unknown[]) => ({ type: 'and', conditions }),
  inArray: (_field: unknown, values: unknown[]) => ({ type: 'inArray', values }),
  desc: (field: unknown) => ({ type: 'desc', field }),
  isNull: (field: unknown) => ({ type: 'isNull', field }),
  sql: () => ({}),
}));

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: () => {
        const runWhere = () => Promise.resolve([]);
        const joinable: any = { where: runWhere };
        joinable.innerJoin = () => joinable;
        return joinable;
      },
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([]),
          then: (resolve: (v: unknown) => unknown) => Promise.resolve([]).then(resolve),
        }),
      }),
    }),
    query: {
      eventPools: {
        findFirst: () => Promise.resolve(null),
      },
    },
    transaction: vi.fn(),
  },
}));

vi.mock('../wsService', () => ({
  wsService: { broadcastToUser: vi.fn() },
}));
vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: vi.fn((_key: string, defaultValue: boolean) => Promise.resolve(defaultValue)),
}));
vi.mock('../lib/matchingPostMatchEffects', () => ({
  executePostMatchCommitSideEffects: vi.fn(),
}));
vi.mock('../venueAssignmentService', () => ({
  assignVenuesToGroups: vi.fn().mockResolvedValue({ assignments: new Map(), unassigned: new Map() }),
  saveVenueAssignments: vi.fn(),
}));
vi.mock('../eventThemeGeneratorService', () => ({
  generateAndSaveEventTheme: vi.fn(),
}));
vi.mock('../services/eventThemeTitleGenerator', () => ({
  generateEventThemeTitle: vi.fn().mockResolvedValue({
    eventThemeTitle: null,
    themeTagline: null,
    emoji: null,
    reasoning: null,
  }),
}));

vi.mock('../archetypeChemistry', () => ({
  chemistryMatrix: { 'koala': { 'koala': 90 } },
  ARCHETYPE_ENERGY: { 'corgi': 95, 'koala': 70, 'owl': 55 },
}));

vi.mock('../archetypeChemistryCalibration', () => ({
  getArchetypePairCalibrationMap: vi.fn().mockResolvedValue(new Map()),
  getCalibratedChemistryScore: vi.fn().mockImplementation(() => 90),
}));

const {
  evaluateCompositionGates,
  computeSparkPoolState,
  isCompositionSpark,
  hasCompleteTraitVector,
  adjustScoreForCompositionGates,
  createCompositionGateStats,
  runGreedyPoolMatchingCore,
  COMPOSITION_MIN_E_FLOOR,
  COMPOSITION_MEAN_A_FLOOR,
  COMPOSITION_SPARK_TRAIT_THRESHOLD,
  COMPOSITION_X_VARIANCE_CAP,
  COMPOSITION_SECOND_SPARK_RANKING_PENALTY,
  COMPOSITION_SPARKLESS_GROUP_SPARK_BONUS,
  COMPOSITION_LOW_E_RANKING_PENALTY,
  COMPOSITION_MEAN_A_LIFT_BONUS,
  COMPOSITION_MEAN_A_DRAG_PENALTY,
  COMPOSITION_X_VARIANCE_RANKING_PENALTY,
} = await import('../poolMatchingService');
import type {
  UserWithProfile,
  UserInterestsCache,
  CompositionTraitVector,
} from '../poolMatchingService';

// ── helpers ──────────────────────────────────────────────────────────

/** Neutral reported vector: all traits 50 (no spark, above all floors). */
const NEUTRAL_TRAITS: CompositionTraitVector = { A: 50, C: 50, E: 50, O: 50, X: 50, P: 50 };

function makeUser(id: string, overrides: Partial<UserWithProfile> = {}): UserWithProfile {
  return {
    userId: id,
    registrationId: `reg-${id}`,
    gender: '男性',
    birthdate: '1995-01-01',
    industryNiche: 'tech',
    industryNicheLabel: '科技',
    industryCategoryLabel: '互联网',
    educationLevel: '本科',
    archetype: 'koala',
    secondaryArchetype: null,
    lifeStage: '职场老手',
    workMode: 'employed',
    hometown: null,
    hometownAffinityOptin: false,
    budgetRange: null,
    barBudgetRange: null,
    preferredLanguages: ['中文'],
    eventIntent: null,
    userIntent: null,
    cuisinePreferences: null,
    dietaryRestrictions: null,
    barThemes: null,
    alcoholComfort: null,
    eventType: '饭局',
    ageMatchPreference: null,
    tableVibePreference: null,
    preferenceStrictness: null,
    genderCompositionPreference: null,
    traitScores: { ...NEUTRAL_TRAITS },
    ...overrides,
  };
}

/** Seed every pair under a cache-key prefix; default 90 (above minPairScore 60). */
function seedPairScores(
  ids: string[],
  overrides: Record<string, number> = {},
  defaultScore = 90,
  prefix: 'legacy' | 'adaptive' = 'legacy',
): Map<string, number> {
  const normalized = new Map(
    Object.entries(overrides).map(([k, v]) => [k.split('|').sort().join('|'), v]),
  );
  const cache = new Map<string, number>();
  const head = prefix === 'adaptive' ? 'legacy|adaptive' : 'legacy';
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
      cache.set(`${head}|${a}|${b}`, normalized.get(`${a}|${b}`) ?? defaultScore);
    }
  }
  return cache;
}

const CORE_POOL = { minGroupSize: 4, maxGroupSize: 6, targetGroups: 1, genderBalanceMode: 'none' };

async function runCore(
  users: UserWithProfile[],
  pairScoreCache: Map<string, number>,
  options: {
    gatesEnabled?: boolean;
    pool?: Partial<typeof CORE_POOL>;
    duoPairs?: Array<{ inviterId: string; inviteeId: string }>;
    customWeights?: object;
    stats?: ReturnType<typeof createCompositionGateStats>;
  } = {},
) {
  return runGreedyPoolMatchingCore(
    users,
    { ...CORE_POOL, ...options.pool },
    new Map() as UserInterestsCache,
    pairScoreCache,
    undefined, // semanticProfileCache
    false,     // semanticSimilarityEnabled
    undefined, // chemistryCalibrationMap
    [],        // invitationPairs
    options.customWeights as any, // customWeights
    undefined, // matchHistoryLookup
    50,        // strictness
    false,     // matchNeverMeetSentinelEnabled
    false,     // useWeightProfileV2
    false,     // magnetismGroupRulesEnabled
    options.duoPairs ?? [],
    options.gatesEnabled ?? false,
    options.stats,
  );
}

/** Pool state with exactly-one spark enforcement (no exemption). */
const ENFORCED_POOL = { sparkCount: 1, expectedGroups: 1, deficitExempt: false, surplusExempt: false };

// =============================================================================
// Gate predicates — evaluateCompositionGates
// =============================================================================

describe('composition gate predicates', () => {
  it('(i) min-E floor: rejects a group whose minimum reported E is below the floor', () => {
    const members = [
      makeUser('a', { traitScores: { ...NEUTRAL_TRAITS, E: 60 } }),
      makeUser('b', { traitScores: { ...NEUTRAL_TRAITS, E: COMPOSITION_MIN_E_FLOOR - 1 } }),
    ];
    const result = evaluateCompositionGates(members, ENFORCED_POOL);
    expect(result.minEFloorSatisfied).toBe(false);
    expect(result.satisfied).toBe(false);
  });

  it('(i) passes at exactly the floor (inclusive)', () => {
    const members = [
      makeUser('a', { traitScores: { ...NEUTRAL_TRAITS, E: COMPOSITION_MIN_E_FLOOR } }),
      makeUser('b', { traitScores: { ...NEUTRAL_TRAITS, E: 80 } }),
    ];
    expect(evaluateCompositionGates(members, ENFORCED_POOL).minEFloorSatisfied).toBe(true);
  });

  it('(ii) mean-A floor: rejects a group whose mean reported A is below the floor', () => {
    const members = [
      makeUser('a', { traitScores: { ...NEUTRAL_TRAITS, A: COMPOSITION_MEAN_A_FLOOR - 10 } }),
      makeUser('b', { traitScores: { ...NEUTRAL_TRAITS, A: COMPOSITION_MEAN_A_FLOOR - 10 } }),
    ];
    const result = evaluateCompositionGates(members, ENFORCED_POOL);
    expect(result.meanAFloorSatisfied).toBe(false);
    expect(result.satisfied).toBe(false);
  });

  it('(iv) X-variance cap: rejects a group whose X spread exceeds the cap', () => {
    // X values 5/95 → variance (45² + 45²)/2 = 2025 > cap.
    const members = [
      makeUser('a', { traitScores: { ...NEUTRAL_TRAITS, X: 5 } }),
      makeUser('b', { traitScores: { ...NEUTRAL_TRAITS, X: 95 } }),
    ];
    const result = evaluateCompositionGates(members, ENFORCED_POOL);
    expect(result.xVarianceCapSatisfied).toBe(false);
    expect(result.satisfied).toBe(false);
  });

  it('(iv) passes when X spread is within the cap', () => {
    const members = [
      makeUser('a', { traitScores: { ...NEUTRAL_TRAITS, X: 40 } }),
      makeUser('b', { traitScores: { ...NEUTRAL_TRAITS, X: 60 } }),
    ];
    expect(evaluateCompositionGates(members, ENFORCED_POOL).xVarianceCapSatisfied).toBe(true);
  });

  it('cold-start skip (AC-5.1b): a member without a complete vector skips gates (i)/(ii)/(iv)', () => {
    const members = [
      makeUser('a', { traitScores: { ...NEUTRAL_TRAITS, E: 1, A: 1, X: 95 } }), // would fail i/ii/iv
      makeUser('b', { traitScores: null }), // cold-start
    ];
    const result = evaluateCompositionGates(members, ENFORCED_POOL);
    expect(result.evaluated.minE).toBe(false);
    expect(result.evaluated.meanA).toBe(false);
    expect(result.evaluated.xVariance).toBe(false);
    expect(result.minEFloorSatisfied).toBe(true);
    expect(result.meanAFloorSatisfied).toBe(true);
    expect(result.xVarianceCapSatisfied).toBe(true);
  });

  it('cold-start skip also applies to incomplete vectors (missing trait keys)', () => {
    const members = [
      makeUser('a', { traitScores: { ...NEUTRAL_TRAITS, E: 1 } }),
      makeUser('b', { traitScores: { A: 50 } }), // incomplete
    ];
    expect(hasCompleteTraitVector(members[1])).toBe(false);
    const result = evaluateCompositionGates(members, ENFORCED_POOL);
    expect(result.evaluated.minE).toBe(false);
    expect(result.minEFloorSatisfied).toBe(true);
  });

  it('(iii) spark definition (LOCKED): X ≥ 70 ∨ P ≥ 70; missing traits count as non-spark', () => {
    expect(isCompositionSpark(makeUser('a', { traitScores: { ...NEUTRAL_TRAITS, X: COMPOSITION_SPARK_TRAIT_THRESHOLD } }))).toBe(true);
    expect(isCompositionSpark(makeUser('b', { traitScores: { ...NEUTRAL_TRAITS, P: COMPOSITION_SPARK_TRAIT_THRESHOLD } }))).toBe(true);
    expect(isCompositionSpark(makeUser('c', { traitScores: { ...NEUTRAL_TRAITS, X: 69, P: 69 } }))).toBe(false);
    expect(isCompositionSpark(makeUser('d', { traitScores: null }))).toBe(false);
  });

  it('(iii) exactly-one: 0 sparks fails and 2 sparks fail when fully enforced', () => {
    const noSpark = [makeUser('a'), makeUser('b')];
    expect(evaluateCompositionGates(noSpark, ENFORCED_POOL).sparkRuleSatisfied).toBe(false);
    const twoSparks = [
      makeUser('a', { traitScores: { ...NEUTRAL_TRAITS, X: 80 } }),
      makeUser('b', { traitScores: { ...NEUTRAL_TRAITS, P: 80 } }),
    ];
    expect(evaluateCompositionGates(twoSparks, ENFORCED_POOL).sparkRuleSatisfied).toBe(false);
    const oneSpark = [
      makeUser('a', { traitScores: { ...NEUTRAL_TRAITS, X: 80 } }),
      makeUser('b'),
    ];
    expect(evaluateCompositionGates(oneSpark, ENFORCED_POOL).sparkRuleSatisfied).toBe(true);
  });

  it('(iii) bidirectional exemption: deficit pools skip ≥1, surplus pools skip ≤1', () => {
    const deficit = computeSparkPoolState([makeUser('a'), makeUser('b')], 2);
    expect(deficit.deficitExempt).toBe(true);
    expect(deficit.surplusExempt).toBe(false);
    const noSpark = [makeUser('a'), makeUser('b')];
    const deficitResult = evaluateCompositionGates(noSpark, deficit);
    expect(deficitResult.evaluated.sparkMin).toBe(false);
    expect(deficitResult.sparkRuleSatisfied).toBe(true);

    const spark = () => makeUser('s', { traitScores: { ...NEUTRAL_TRAITS, X: 80 } });
    const surplus = computeSparkPoolState([spark(), spark(), spark()], 1);
    expect(surplus.surplusExempt).toBe(true);
    expect(surplus.deficitExempt).toBe(false);
    const twoSparks = [spark(), spark()];
    const surplusResult = evaluateCompositionGates(twoSparks, surplus);
    expect(surplusResult.evaluated.sparkMax).toBe(false);
    expect(surplusResult.sparkRuleSatisfied).toBe(true);
  });
});

// =============================================================================
// Admission-time steering — adjustScoreForCompositionGates (R4 nudge pattern)
// =============================================================================

describe('composition steering (argmax-only nudges)', () => {
  it('penalizes a second-spark admission only when the pool is NOT surplus-exempt', () => {
    const spark = makeUser('c', { traitScores: { ...NEUTRAL_TRAITS, X: 80 } });
    const group = [makeUser('a', { traitScores: { ...NEUTRAL_TRAITS, X: 80 } })];
    const enforced = adjustScoreForCompositionGates(spark, null, group, 70, ENFORCED_POOL);
    expect(enforced).toBe(70 - COMPOSITION_SECOND_SPARK_RANKING_PENALTY);
    const surplusPool = { sparkCount: 3, expectedGroups: 1, deficitExempt: false, surplusExempt: true };
    const exempt = adjustScoreForCompositionGates(spark, null, group, 70, surplusPool);
    expect(exempt).toBe(70); // no penalty in surplus pools — penalizing would strand sparks
  });

  it('bonuses a spark joining a sparkless group only when NOT deficit-exempt', () => {
    const spark = makeUser('c', { traitScores: { ...NEUTRAL_TRAITS, X: 80 } });
    const group = [makeUser('a'), makeUser('b')];
    expect(adjustScoreForCompositionGates(spark, null, group, 70, ENFORCED_POOL))
      .toBe(70 + COMPOSITION_SPARKLESS_GROUP_SPARK_BONUS);
    const deficitPool = { sparkCount: 0, expectedGroups: 2, deficitExempt: true, surplusExempt: false };
    expect(adjustScoreForCompositionGates(spark, null, group, 70, deficitPool)).toBe(70);
  });

  it('penalizes a sub-floor-E candidate (stability steering)', () => {
    const lowE = makeUser('c', { traitScores: { ...NEUTRAL_TRAITS, E: COMPOSITION_MIN_E_FLOOR - 5 } });
    expect(adjustScoreForCompositionGates(lowE, null, [makeUser('a')], 70, ENFORCED_POOL))
      .toBe(70 - COMPOSITION_LOW_E_RANKING_PENALTY);
  });

  it('mean-A steering is preventive: lifts high-A and drags low-A units when the PROJECTED mean is sub-floor', () => {
    const lowGroup = [
      makeUser('a', { traitScores: { ...NEUTRAL_TRAITS, A: 30 } }),
      makeUser('b', { traitScores: { ...NEUTRAL_TRAITS, A: 30 } }),
    ];
    const highA = makeUser('c', { traitScores: { ...NEUTRAL_TRAITS, A: 80 } });
    const lowA = makeUser('d', { traitScores: { ...NEUTRAL_TRAITS, A: 30 } });
    // Projected mean with c: (30+30+80)/3 ≈ 46.7 ≥ floor → NO nudge (c already lifts over).
    expect(adjustScoreForCompositionGates(highA, null, lowGroup, 70, ENFORCED_POOL)).toBe(70);
    // Projected mean with d: 30 < floor → drag penalty.
    expect(adjustScoreForCompositionGates(lowA, null, lowGroup, 70, ENFORCED_POOL))
      .toBe(70 - COMPOSITION_MEAN_A_DRAG_PENALTY);
    // Deeper hole: A 20/20, candidate A 80 → projected 40 < floor → lift bonus.
    const deepLowGroup = [
      makeUser('e', { traitScores: { ...NEUTRAL_TRAITS, A: 20 } }),
      makeUser('f', { traitScores: { ...NEUTRAL_TRAITS, A: 20 } }),
    ];
    expect(adjustScoreForCompositionGates(highA, null, deepLowGroup, 70, ENFORCED_POOL))
      .toBe(70 + COMPOSITION_MEAN_A_LIFT_BONUS);
  });

  it('penalizes an admission whose projected X-variance breaches the cap', () => {
    const group = [makeUser('a', { traitScores: { ...NEUTRAL_TRAITS, X: 90 } })];
    const lowX = makeUser('c', { traitScores: { ...NEUTRAL_TRAITS, X: 5 } });
    // Projected var: (42.5² + 42.5²)/2 = 1806 > cap.
    expect(adjustScoreForCompositionGates(lowX, null, group, 70, ENFORCED_POOL))
      .toBe(70 - COMPOSITION_X_VARIANCE_RANKING_PENALTY);
  });

  it('[DUO] steers a duo candidate as a UNIT — partner traits count', () => {
    // Candidate is neutral, partner is a spark joining a sparkless group.
    const candidate = makeUser('c');
    const partner = makeUser('p', { traitScores: { ...NEUTRAL_TRAITS, P: 80 } });
    expect(adjustScoreForCompositionGates(candidate, partner, [makeUser('a')], 70, ENFORCED_POOL))
      .toBe(70 + COMPOSITION_SPARKLESS_GROUP_SPARK_BONUS);
  });
});

// =============================================================================
// Commit-gate backstop (integration through the greedy core)
// =============================================================================

describe('composition commit-gate backstop', () => {
  it('rejects a sub-floor mean-A group at commit; gate-off control commits it', async () => {
    const users = ['u1', 'u2', 'u3', 'u4'].map((id) =>
      makeUser(id, { traitScores: { ...NEUTRAL_TRAITS, A: 30 } }),
    );
    const cache = seedPairScores(users.map((u) => u.userId));

    const offGroups = await runCore(users, new Map(cache), { gatesEnabled: false });
    expect(offGroups.length).toBe(1);

    const onGroups = await runCore(users, new Map(cache), { gatesEnabled: true });
    expect(onGroups.length).toBe(0); // mean-A 30 < 45 → rejected before commit
  });

  it('records per-gate rejection counts in the optional stats collector', async () => {
    const users = ['u1', 'u2', 'u3', 'u4'].map((id) =>
      makeUser(id, { traitScores: { ...NEUTRAL_TRAITS, A: 30 } }),
    );
    const cache = seedPairScores(users.map((u) => u.userId));
    const stats = createCompositionGateStats();
    await runCore(users, cache, { gatesEnabled: true, stats });
    expect(stats.commitRejections.meanAFloor).toBeGreaterThan(0);
    expect(stats.commitRejections.total).toBeGreaterThan(0);
    expect(stats.commitRejections.minEFloor).toBe(0);
  });

  it('cold-start pool: members without trait vectors skip gates and commit normally', async () => {
    const users = ['u1', 'u2', 'u3', 'u4'].map((id) => makeUser(id, { traitScores: null }));
    const cache = seedPairScores(users.map((u) => u.userId));
    const groups = await runCore(users, cache, { gatesEnabled: true });
    expect(groups.length).toBe(1);
    expect(groups[0].members.length).toBe(4);
  });
});

// =============================================================================
// AC-5.2 — non-monotonic re-evaluation in magnetismRulesSatisfiedFor
// (H4 absorption + Phase-2 whole-group formation; customWeights enables H4)
// =============================================================================

describe('AC-5.2 non-monotonic gate re-evaluation in redistribution', () => {
  const CUSTOM_WEIGHTS = {
    chemistryWeight: 28,
    interestWeight: 28,
    socialAffinityWeight: 20,
    backgroundDiversityWeight: 15,
    preferenceWeight: 5,
    languageWeight: 4,
  };

  it('H4 absorption: a stranded sub-floor-E member is NOT absorbed (min-E re-evaluated); gate-off absorbs', async () => {
    // 6 users, min 4 / max 5: greedy seats u1–u5 (u6 blocked by the fail-fast
    // admission rule), then H4 Phase-3 overflow absorption tries u6.
    const users = ['u1', 'u2', 'u3', 'u4', 'u5'].map((id) => makeUser(id));
    users.push(makeUser('u6', { traitScores: { ...NEUTRAL_TRAITS, E: COMPOSITION_MIN_E_FLOOR - 10 } }));
    const ids = users.map((u) => u.userId);
    const cache = seedPairScores(ids, {}, 95, 'adaptive');
    const pool = { minGroupSize: 4, maxGroupSize: 5, targetGroups: 10 };

    const offGroups = await runCore(users, new Map(cache), {
      gatesEnabled: false,
      pool,
      customWeights: CUSTOM_WEIGHTS,
    });
    expect(offGroups.length).toBe(1);
    expect(offGroups[0].members.length).toBe(6); // absorbed (legacy behavior)

    const onGroups = await runCore(users, new Map(cache), {
      gatesEnabled: true,
      pool,
      customWeights: CUSTOM_WEIGHTS,
    });
    expect(onGroups.length).toBe(1);
    expect(onGroups[0].members.length).toBe(5); // absorption REJECTED by re-evaluated min-E gate
    expect(onGroups[0].members.some((m) => m.userId === 'u6')).toBe(false);
  });

  it('H4 Phase-2: a remainder group below the mean-A floor is not formed; gate-off forms it', async () => {
    // u1–u4 high-score clique; u5–u8 pairs all below the 60 admission
    // threshold so the main loop cannot seat them — they become the Phase-2
    // remainder set. Their mean A is 30 < 45.
    const clique = ['u1', 'u2', 'u3', 'u4'].map((id) => makeUser(id));
    const remainder = ['u5', 'u6', 'u7', 'u8'].map((id) =>
      makeUser(id, { traitScores: { ...NEUTRAL_TRAITS, A: 30 } }),
    );
    const users = [...clique, ...remainder];
    const ids = users.map((u) => u.userId);
    const overrides: Record<string, number> = {};
    for (const a of ids) {
      for (const b of ids) {
        if (a === b) continue;
        const key = [a, b].sort().join('|');
        const inClique = a < 'u5' && b < 'u5';
        overrides[key] = inClique ? 95 : 55; // below minPairScore 60
      }
    }
    const cache = seedPairScores(ids, overrides, 55, 'adaptive');
    const pool = { minGroupSize: 4, maxGroupSize: 4, targetGroups: 10 };

    const offGroups = await runCore(users, new Map(cache), {
      gatesEnabled: false,
      pool,
      customWeights: CUSTOM_WEIGHTS,
    });
    expect(offGroups.length).toBe(2); // clique + remainder group (legacy)

    const onGroups = await runCore(users, new Map(cache), {
      gatesEnabled: true,
      pool,
      customWeights: CUSTOM_WEIGHTS,
    });
    expect(onGroups.length).toBe(1); // remainder group rejected by re-evaluated mean-A gate
    expect(onGroups[0].members.every((m) => m.userId < 'u5')).toBe(true);
  });
});

// =============================================================================
// AC-5.4 — duo atomic-unit invariants under gates-on
// =============================================================================

describe('composition gates × 双人成行 duo atomicity', () => {
  it('a duo with a sub-floor-E partner strands TOGETHER (never split, never force-placed)', async () => {
    const duo = [
      makeUser('d1'),
      makeUser('d2', { traitScores: { ...NEUTRAL_TRAITS, E: COMPOSITION_MIN_E_FLOOR - 10 } }),
    ];
    const others = ['o1', 'o2', 'o3', 'o4'].map((id) => makeUser(id));
    const users = [...duo, ...others];
    const ids = users.map((u) => u.userId);
    const cache = seedPairScores(ids, {}, 95);
    const duoPairs = [{ inviterId: 'd1', inviteeId: 'd2' }];

    const groups = await runCore(users, cache, { gatesEnabled: true, duoPairs });
    const matchedIds = new Set(groups.flatMap((g) => g.members.map((m) => m.userId)));
    // Atomicity: both duo members unmatched together (整组顺延 semantics).
    expect(matchedIds.has('d1')).toBe(false);
    expect(matchedIds.has('d2')).toBe(false);
    // The other four still form a valid group.
    expect(groups.length).toBe(1);
    expect(groups[0].members.length).toBe(4);
  });

  it('a healthy duo stays co-located under gates-on (atomic seed + admission intact)', async () => {
    const duo = [makeUser('d1'), makeUser('d2')];
    const others = ['o1', 'o2', 'o3', 'o4'].map((id) => makeUser(id));
    const users = [...duo, ...others];
    const ids = users.map((u) => u.userId);
    // Make the duo pair the top seed so the duo path is exercised first.
    const cache = seedPairScores(ids, { 'd1|d2': 99 }, 90);
    const duoPairs = [{ inviterId: 'd1', inviteeId: 'd2' }];

    const groups = await runCore(users, cache, { gatesEnabled: true, duoPairs });
    const groupOf = (id: string) => groups.findIndex((g) => g.members.some((m) => m.userId === id));
    expect(groupOf('d1')).toBeGreaterThanOrEqual(0);
    expect(groupOf('d1')).toBe(groupOf('d2')); // co-located
  });

  it('gate rejection of a group containing a duo releases BOTH partners together', async () => {
    // Duo d1/d2 + two low-A members: any group containing the low-A members
    // drops below the mean-A floor. The duo itself is healthy; the gate must
    // release the whole forming group — never strand one partner inside.
    const duo = [makeUser('d1'), makeUser('d2')];
    const lowA = ['x1', 'x2'].map((id) => makeUser(id, { traitScores: { ...NEUTRAL_TRAITS, A: 20 } }));
    const users = [...duo, ...lowA];
    const ids = users.map((u) => u.userId);
    const cache = seedPairScores(ids, { 'd1|d2': 99, 'd1|x1': 98, 'd2|x1': 98, 'd1|x2': 97, 'd2|x2': 97, 'x1|x2': 96 }, 50);
    const duoPairs = [{ inviterId: 'd1', inviteeId: 'd2' }];

    const groups = await runCore(users, cache, {
      gatesEnabled: true,
      duoPairs,
      pool: { minGroupSize: 4, maxGroupSize: 4, targetGroups: 1 },
    });
    // The only possible 4-member group has mean A = (50+50+20+20)/4 = 35 < 45
    // → rejected at commit. No group forms; duo stays together (both unmatched).
    const matchedIds = new Set(groups.flatMap((g) => g.members.map((m) => m.userId)));
    expect(matchedIds.has('d1')).toBe(matchedIds.has('d2'));
    expect(groups.length).toBe(0);
  });
});

// =============================================================================
// AC-5.5 — gate-off byte-identity (trait data present but inert)
// =============================================================================

describe('gate-off byte-identity', () => {
  it('traitScores on members never perturb the gate-off result', async () => {
    const withTraits = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'].map((id, i) =>
      makeUser(id, {
        traitScores: { A: 30 + i * 5, C: 50, E: 20 + i * 10, O: 50, X: 90 - i * 10, P: 40 },
      }),
    );
    const withoutTraits = withTraits.map((u) => ({ ...u, traitScores: undefined }));
    const cache1 = seedPairScores(withTraits.map((u) => u.userId), {}, 88);
    const cache2 = seedPairScores(withTraits.map((u) => u.userId), {}, 88);

    const a = await runCore(withTraits, cache1, { gatesEnabled: false });
    const b = await runCore(withoutTraits, cache2, { gatesEnabled: false });

    const serialize = (groups: typeof a) =>
      groups.map((g) => ({
        members: g.members.map((m) => m.userId),
        avgPairScore: g.avgPairScore,
        diversityScore: g.diversityScore,
        communicationBalance: g.communicationBalance,
        overallScore: g.overallScore,
      }));
    expect(serialize(a)).toEqual(serialize(b));
  });
});

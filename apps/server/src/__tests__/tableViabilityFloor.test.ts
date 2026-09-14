/**
 * W2 (gm-debrief): table-viability floor — R1 无孤立者 + R2 能量编排.
 *
 * OD-W2 (locked): W2 owns the R1/R2 commit gate. Energizer = item5 spark
 * (reported X ≥ 70 ∨ P ≥ 70) when a complete trait vector exists, else
 * ARCHETYPE_ENERGY ≥ 75 fallback. W6 owns `calculateEnergyBalance`.
 *
 * Coverage:
 *   - AC-W2.1: gate-off red repro — a 0-energizer group commits today.
 *   - AC-W2.2: energizer definition + constant; commit-gate enforcement; R1/R2
 *              pool-level no-deadlock exemptions; redistribution re-evaluation.
 *   - AC-W2.3: odd-roster absorption always runs under W2 (decoupled from
 *              customWeights/allowOverflow); 1–3 stranded absorb up to
 *              maxGroupSize+1 when R1/R2 hold, else unmatched. Under
 *              allowOverflow (strictness ≤ 0) the bound is enforced too:
 *              Phase 1/3 stop growing a group at maxGroupSize+1 and Phase 2
 *              whole-remainder formation refuses an oversized remainder.
 *   - AC-W2.6: gate-off byte-identity with W2 trait data present but inert.
 *
 * Mock pattern mirrors compositionGates.test.ts: db, chemistry, and feature
 * flags are mocked; the gate helpers and greedy core are REAL code.
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
        const rows: unknown[] = [];
        // Production shapes: `await ...where(...)` (array) AND
        // `await ...where(...).limit(1)` (getUserInterests). Return a thenable
        // that also exposes `.limit` so both work.
        const runWhere = () => {
          const thenable = Promise.resolve(rows) as Promise<unknown[]> & {
            limit: (n: number) => Promise<unknown[]>;
          };
          thenable.limit = () => Promise.resolve(rows);
          return thenable;
        };
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
  runGreedyPoolMatchingCore,
  isTableViabilityEnergizer,
  groupSatisfiesEnergizerRule,
  computeEnergizerPoolState,
  groupSatisfiesStrongTieRule,
  TABLE_VIABILITY_ENERGIZER_THRESHOLD,
  MAGNETISM_ENERGIZER_THRESHOLD,
  COMPOSITION_SPARK_TRAIT_THRESHOLD,
  createCompositionGateStats,
} = await import('../poolMatchingService');
import type {
  UserWithProfile,
  UserInterestsCache,
  CompositionTraitVector,
} from '../poolMatchingService';

// ── helpers ──────────────────────────────────────────────────────────

/** Neutral reported vector: all 50 (non-spark, above composition floors). */
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

/** A complete-vector energizer (X ≥ 70). */
const energizer = (id: string, overrides: Partial<UserWithProfile> = {}) =>
  makeUser(id, { traitScores: { ...NEUTRAL_TRAITS, X: COMPOSITION_SPARK_TRAIT_THRESHOLD }, ...overrides });

/** A non-energizer with a complete vector. */
const nonEnergizer = (id: string, overrides: Partial<UserWithProfile> = {}) =>
  makeUser(id, { traitScores: { ...NEUTRAL_TRAITS, X: 50 }, ...overrides });

/** Seed every pair under a cache-key prefix; default 90. */
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

const CUSTOM_WEIGHTS = {
  chemistryWeight: 28,
  interestWeight: 28,
  socialAffinityWeight: 20,
  backgroundDiversityWeight: 15,
  preferenceWeight: 5,
  languageWeight: 4,
};

async function runCore(
  users: UserWithProfile[],
  pairScoreCache: Map<string, number>,
  options: {
    w2Enabled?: boolean;
    gatesEnabled?: boolean;
    pool?: Partial<typeof CORE_POOL>;
    duoPairs?: Array<{ inviterId: string; inviteeId: string }>;
    customWeights?: object;
    stats?: ReturnType<typeof createCompositionGateStats>;
    /** Match-Compass strictness; ≤ 0 flips allowOverflow on (W2 overflow test). */
    strictness?: number;
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
    options.strictness ?? 50, // strictness
    false,     // matchNeverMeetSentinelEnabled
    false,     // useWeightProfileV2
    false,     // magnetismGroupRulesEnabled
    options.duoPairs ?? [],
    options.gatesEnabled ?? false,
    options.stats, // compositionGateStats
    false,     // derivedChemistryEnabled
    options.w2Enabled ?? false,
  );
}

const matchedIds = (groups: Awaited<ReturnType<typeof runGreedyPoolMatchingCore>>) =>
  new Set(groups.flatMap((g) => g.members.map((m) => m.userId)));

// =============================================================================
// Energizer definition (OD-W2, locked)
// =============================================================================

describe('W2 energizer predicate (OD-W2)', () => {
  it('exposes a named constant equal to the archetype-level R2 threshold', () => {
    expect(TABLE_VIABILITY_ENERGIZER_THRESHOLD).toBe(MAGNETISM_ENERGIZER_THRESHOLD);
    expect(TABLE_VIABILITY_ENERGIZER_THRESHOLD).toBe(75);
  });

  it('adopts the item5 spark definition when a complete trait vector exists', () => {
    expect(isTableViabilityEnergizer(energizer('a'))).toBe(true);
    expect(isTableViabilityEnergizer(makeUser('b', { traitScores: { ...NEUTRAL_TRAITS, P: 70 } }))).toBe(true);
    // Below both spark thresholds → NOT an energizer even with a high-energy archetype.
    const lowTraitCorgi = makeUser('c', { archetype: 'corgi', traitScores: { ...NEUTRAL_TRAITS, X: 69, P: 69 } });
    expect(isTableViabilityEnergizer(lowTraitCorgi)).toBe(false);
  });

  it('falls back to ARCHETYPE_ENERGY ≥ 75 only when the trait vector is missing/incomplete', () => {
    expect(isTableViabilityEnergizer(makeUser('d', { archetype: 'corgi', traitScores: null }))).toBe(true);
    expect(isTableViabilityEnergizer(makeUser('e', { archetype: 'koala', traitScores: null }))).toBe(false);
    expect(isTableViabilityEnergizer(makeUser('f', { archetype: 'corgi', traitScores: { A: 50 } as CompositionTraitVector }))).toBe(true);
  });

  it('groupSatisfiesEnergizerRule respects the pool-level exemption', () => {
    const members = [nonEnergizer('a'), nonEnergizer('b')];
    expect(groupSatisfiesEnergizerRule(members, false)).toBe(false);
    expect(groupSatisfiesEnergizerRule(members, true)).toBe(true);
    expect(groupSatisfiesEnergizerRule([energizer('a'), nonEnergizer('b')], false)).toBe(true);
  });

  it('computeEnergizerPoolState marks energizer-deficit pools exempt (no deadlock)', () => {
    const noE = [nonEnergizer('a'), nonEnergizer('b'), nonEnergizer('c'), nonEnergizer('d')];
    expect(computeEnergizerPoolState(noE, 1).energizerDeficitExempt).toBe(true);
    expect(computeEnergizerPoolState(noE, 2).energizerDeficitExempt).toBe(true);
    const threeE = [energizer('a'), energizer('b'), energizer('c'), nonEnergizer('d')];
    expect(computeEnergizerPoolState(threeE, 1).energizerDeficitExempt).toBe(false);
    expect(computeEnergizerPoolState(threeE, 3).energizerDeficitExempt).toBe(false);
    expect(computeEnergizerPoolState(threeE, 4).energizerDeficitExempt).toBe(true);
  });

  it('R1 predicate: every member needs ≥1 strong tie', async () => {
    const a = nonEnergizer('a');
    const b = nonEnergizer('b');
    const getPairScore = async (u1: UserWithProfile, u2: UserWithProfile) =>
      [u1.userId, u2.userId].sort().join('|') === 'a|b' ? 65 : 30;
    expect(await groupSatisfiesStrongTieRule([a, b], getPairScore)).toBe(true);
    const c = nonEnergizer('c');
    const isolated = await groupSatisfiesStrongTieRule([a, b, c], async (u1, u2) =>
      u1.userId === 'c' || u2.userId === 'c' ? 30 : 65,
    );
    expect(isolated).toBe(false);
  });
});

// =============================================================================
// AC-W2.1 / AC-W2.2 — commit gate
// =============================================================================

describe('W2 commit gate (AC-W2.1 red repro / AC-W2.2 enforcement)', () => {
  it('AC-W2.1: gate-off commits a 0-energizer group; gate-on rejects it', async () => {
    // 8 users, 4 energizers + 4 non-energizers; targetGroups 2 → pool is NOT
    // energizer-deficit (4 ≥ 2), so R2 is enforced. The greediest pairs are the
    // non-energizer ones, so the gate-off arm commits a 4× non-energizer group.
    const users = [
      ...['n1', 'n2', 'n3', 'n4'].map((id) => nonEnergizer(id)),
      ...['e1', 'e2', 'e3', 'e4'].map((id) => energizer(id)),
    ];
    const ids = users.map((u) => u.userId);
    const overrides: Record<string, number> = {};
    for (const a of ['n1', 'n2', 'n3', 'n4']) {
      for (const b of ['n1', 'n2', 'n3', 'n4']) if (a < b) overrides[`${a}|${b}`] = 99;
    }
    const cache = seedPairScores(ids, overrides, 95);
    const pool = { minGroupSize: 4, maxGroupSize: 4, targetGroups: 2 };

    const offGroups = await runCore(users, new Map(cache), { w2Enabled: false, pool });
    expect(offGroups.length).toBeGreaterThan(0);
    expect(
      offGroups.some((g) => g.members.every((m) => !isTableViabilityEnergizer(m))),
    ).toBe(true); // RED REPRO: 0-energizer group committed

    const onGroups = await runCore(users, new Map(cache), { w2Enabled: true, pool });
    expect(onGroups.length).toBeGreaterThan(0);
    for (const g of onGroups) {
      expect(g.members.some(isTableViabilityEnergizer)).toBe(true);
    }
  });

  it('does not reject an energizer-less group when the pool is energizer-deficit (no deadlock)', async () => {
    const users = ['a', 'b', 'c', 'd'].map((id) => nonEnergizer(id));
    const cache = seedPairScores(users.map((u) => u.userId), {}, 90);
    const pool = { minGroupSize: 4, maxGroupSize: 4, targetGroups: 1 };
    const groups = await runCore(users, cache, { w2Enabled: true, pool });
    expect(groups.length).toBe(1); // deficit-exempt → R2 skipped
  });
});

// =============================================================================
// AC-W2.2 — redistribution re-evaluation (R1)
// =============================================================================

describe('W2 redistribution re-evaluation (AC-W2.2)', () => {
  it('rejects H4 absorption of an isolate (R1) while the legacy arm absorbs it', async () => {
    // Clique u1–u4 (95); stranded u5 has only 55 to the clique → avg 55 ≥ 50
    // would be absorbed by legacy H4, but u5 has NO strong tie (≥60) → R1 blocks.
    const users = ['u1', 'u2', 'u3', 'u4'].map((id) => energizer(id));
    users.push(nonEnergizer('u5'));
    const ids = users.map((u) => u.userId);
    const overrides: Record<string, number> = {};
    for (const a of ['u1', 'u2', 'u3', 'u4']) {
      for (const b of ['u1', 'u2', 'u3', 'u4']) if (a < b) overrides[`${a}|${b}`] = 95;
      overrides[`${a}|u5`] = 55;
    }
    const cache = seedPairScores(ids, overrides, 55, 'adaptive');
    const w2Cache = seedPairScores(ids, overrides, 55);
    const pool = { minGroupSize: 4, maxGroupSize: 4, targetGroups: 1 };

    const legacy = await runCore(users, new Map(cache), {
      w2Enabled: false,
      pool,
      customWeights: CUSTOM_WEIGHTS, // enable legacy H4
    });
    expect(legacy.length).toBe(1);
    expect(legacy[0].members.length).toBe(5); // legacy absorbed u5
    expect(matchedIds(legacy).has('u5')).toBe(true);

    const w2 = await runCore(users, w2Cache, { w2Enabled: true, pool });
    expect(w2.length).toBe(1);
    expect(w2[0].members.length).toBe(4); // R1 rejects the isolate
    expect(w2[0].members.some((m) => m.userId === 'u5')).toBe(false);
  });
});

// =============================================================================
// AC-W2.3 — always-on odd-roster absorption
// =============================================================================

describe('W2 odd-roster absorption (AC-W2.3)', () => {
  it('always runs under W2 and absorbs a stranded member to maxGroupSize+1 when R1/R2 hold', async () => {
    // 7 users: clique u1–u4 (95); stranded u5/u6/u7 have 55 among themselves
    // (cannot form a group) and 65 toward the clique (absorbable but not a
    // strong tie? 65 ≥ 60 → R1 holds).
    const users = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'].map((id) => energizer(id));
    const ids = users.map((u) => u.userId);
    const clique = ['u1', 'u2', 'u3', 'u4'];
    const stranded = ['u5', 'u6', 'u7'];
    const overrides: Record<string, number> = {};
    for (const a of clique) for (const b of clique) if (a < b) overrides[`${a}|${b}`] = 95;
    for (const a of stranded) for (const b of stranded) if (a < b) overrides[`${a}|${b}`] = 55;
    for (const a of clique) for (const b of stranded) overrides[`${a}|${b}`] = 65;
    const cache = seedPairScores(ids, overrides, 55);
    const pool = { minGroupSize: 4, maxGroupSize: 4, targetGroups: 1 };

    // gate-off (no customWeights, no allowOverflow): no redistribution at all.
    const off = await runCore(users, new Map(cache), { w2Enabled: false, pool });
    expect(off.length).toBe(1);
    expect(off[0].members.length).toBe(4);
    expect(matchedIds(off).size).toBe(4);

    // W2 on: absorption pass ALWAYS runs (decoupled) → one stranded absorbed,
    // pushing the group to maxGroupSize+1 = 5.
    const on = await runCore(users, new Map(cache), { w2Enabled: true, pool });
    expect(on.length).toBe(1);
    expect(on[0].members.length).toBe(5);
    expect(matchedIds(on).size).toBe(5);
  });

  it('bounds absorption at maxGroupSize+1 even under Match-Compass relaxed allowOverflow', async () => {
    // 4-member clique (maxGroupSize 4) + 5 stranded whose only viable ties are
    // to the clique (stranded–stranded 10 < 50 → cannot form their own group).
    // At strictness 0, allowOverflow=true: without the W2 bound, Phase-1
    // absorption swallows EVERY stranded member into the one group (size 9) —
    // the pre-existing legacy behavior. The W2 floor must cap it at
    // maxGroupSize+1 = 5.
    const cliqueIds = ['c1', 'c2', 'c3', 'c4'];
    const strandedIds = ['s1', 's2', 's3', 's4', 's5'];
    const users = [...cliqueIds.map((id) => energizer(id)), ...strandedIds.map((id) => energizer(id))];
    const ids = users.map((u) => u.userId);
    const overrides: Record<string, number> = {};
    // Clique-internal strictly highest → the initial greedy group is exactly
    // the clique; stranded only reach groups through redistribution.
    for (const a of cliqueIds) for (const b of cliqueIds) if (a < b) overrides[`${a}|${b}`] = 99;
    for (const a of strandedIds) for (const b of strandedIds) if (a < b) overrides[`${a}|${b}`] = 10;
    for (const a of cliqueIds) for (const b of strandedIds) overrides[`${a}|${b}`] = 95;
    // strictness 0 → formationWeights is set → cache key carries `|adaptive`.
    const cache = seedPairScores(ids, overrides, 10, 'adaptive');
    const pool = { minGroupSize: 4, maxGroupSize: 4, targetGroups: 1 };

    // Control: W2 off + relaxed overflow = legacy unbounded absorption.
    const legacy = await runCore(users, new Map(cache), { w2Enabled: false, pool, strictness: 0 });
    expect(legacy.length).toBe(1);
    expect(legacy[0].members.length).toBe(9);

    // W2 on: the overflow bound caps the group at maxGroupSize+1.
    const bounded = await runCore(users, new Map(cache), { w2Enabled: true, pool, strictness: 0 });
    expect(bounded.length).toBe(1);
    expect(bounded[0].members.length).toBe(5);
  });

  it('does not form an oversized whole-remainder group via Phase 2 under allowOverflow + W2', async () => {
    // All pair scores below minPairScore → the initial greedy commits NOTHING,
    // so all 9 users reach the redistribution remainder. Legacy (W2 off) forms
    // one 9-seat whole-remainder group; W2's bounded contract must refuse it.
    const ids = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9'];
    const users = ids.map((id) => energizer(id));
    const cache = seedPairScores(ids, {}, 10, 'adaptive');
    const pool = { minGroupSize: 4, maxGroupSize: 4, targetGroups: 1 };

    const legacy = await runCore(users, new Map(cache), { w2Enabled: false, pool, strictness: 0 });
    expect(legacy.length).toBe(1);
    expect(legacy[0].members.length).toBe(9);

    const bounded = await runCore(users, new Map(cache), { w2Enabled: true, pool, strictness: 0 });
    expect(bounded.length).toBe(0);
  });
});

// =============================================================================
// AC-W2.6 — gate-off byte-identity (W2 trait data present but inert)
// =============================================================================

describe('W2 gate-off byte-identity (AC-W2.6)', () => {
  it('trait data never perturbs the flag-off result', async () => {
    const withTraits = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'].map((id, i) =>
      makeUser(id, {
        traitScores: { A: 30 + i * 5, C: 50, E: 20 + i * 10, O: 50, X: 90 - i * 10, P: 40 },
      }),
    );
    const withoutTraits = withTraits.map((u) => ({ ...u, traitScores: undefined }));
    const cache1 = seedPairScores(withTraits.map((u) => u.userId), {}, 88);
    const cache2 = seedPairScores(withTraits.map((u) => u.userId), {}, 88);

    const a = await runCore(withTraits, cache1, { w2Enabled: false });
    const b = await runCore(withoutTraits, cache2, { w2Enabled: false });

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

  it('stats collector stays untouched when W2 is off', async () => {
    const users = ['u1', 'u2', 'u3', 'u4'].map((id) => nonEnergizer(id));
    const cache = seedPairScores(users.map((u) => u.userId), {}, 90);
    const stats = createCompositionGateStats();
    const groups = await runCore(users, cache, { w2Enabled: false, stats });
    expect(groups.length).toBe(1);
    expect(stats.commitRejections.noIsolate).toBe(0);
    expect(stats.commitRejections.energizer).toBe(0);
    expect(stats.redistributionRejections.noIsolate).toBe(0);
    expect(stats.redistributionRejections.energizer).toBe(0);
  });

  it('records R2 rejections in the commit-gate stats collector when W2 is on', async () => {
    const users = [
      ...['n1', 'n2', 'n3', 'n4'].map((id) => nonEnergizer(id)),
      ...['e1', 'e2', 'e3', 'e4'].map((id) => energizer(id)),
    ];
    const ids = users.map((u) => u.userId);
    const overrides: Record<string, number> = {};
    for (const a of ['n1', 'n2', 'n3', 'n4']) {
      for (const b of ['n1', 'n2', 'n3', 'n4']) if (a < b) overrides[`${a}|${b}`] = 99;
    }
    const cache = seedPairScores(ids, overrides, 95);
    const pool = { minGroupSize: 4, maxGroupSize: 4, targetGroups: 2 };
    const stats = createCompositionGateStats();
    await runCore(users, new Map(cache), { w2Enabled: true, pool, stats });
    expect(stats.commitRejections.energizer).toBeGreaterThan(0);
    expect(stats.commitRejections.total).toBeGreaterThan(0);
    expect(stats.commitRejections.noIsolate).toBe(0); // all strong-tie seeded
  });
});

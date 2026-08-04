/**
 * 磁场引擎 惊艳开局包 (P1): group-composition rules behind the
 * magnetismGroupRulesEnabled flag (MAGNETISM_GROUP_RULES_ENABLED).
 *
 *   R1 无孤立者 — commit gate: every member needs ≥1 intra-group pair score ≥ 60
 *   R2 能量编排 — commit gate: ≥1 member with archetype energy ≥ 75 (pool-exempt)
 *   R3 话题锚点 — commit gate: shared macro category OR topic shared by ≥ ⌈n/2⌉
 *   R4 新奇分散 — expansion ranking nudge: 2nd explore-intent candidate −8
 *
 * Mock pattern mirrors matchingDimensions.test.ts / poolMatchingService.test.ts:
 * db, archetypeChemistry, archetypeChemistryCalibration, and feature flags are
 * mocked; the rule helpers and greedy core under test are the real code.
 */
import { describe, expect, it, vi } from 'vitest';

const {
  eventPoolsTable,
  eventPoolRegistrationsTable,
  eventPoolGroupsTable,
  eventsTable,
  eventAttendanceTable,
  usersTable,
  userInterestsTable,
  invitationUsesTable,
  invitationsTable,
  couponsTable,
  userCouponsTable,
  matchHistoryTable,
} = vi.hoisted(() => ({
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
}));

vi.mock('@shared/schema', () => ({
  eventPools: eventPoolsTable,
  eventPoolRegistrations: eventPoolRegistrationsTable,
  eventPoolGroups: eventPoolGroupsTable,
  events: eventsTable,
  eventAttendance: eventAttendanceTable,
  users: usersTable,
  userInterests: userInterestsTable,
  invitationUses: invitationUsesTable,
  invitations: invitationsTable,
  coupons: couponsTable,
  userCoupons: userCouponsTable,
  matchHistory: matchHistoryTable,
}));

vi.mock('drizzle-orm', () => ({
  eq: (_field: unknown, value: unknown) => ({ type: 'eq', value }),
  and: (...conditions: unknown[]) => ({ type: 'and', conditions }),
  inArray: (_field: unknown, values: unknown[]) => ({ type: 'inArray', values }),
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

// Energizer threshold is 75: corgi (95) qualifies; koala (70) and owl (55) do not.
vi.mock('../archetypeChemistry', () => ({
  chemistryMatrix: { 'koala': { 'koala': 90 } },
  ARCHETYPE_ENERGY: { 'corgi': 95, 'koala': 70, 'owl': 55 },
}));

vi.mock('../archetypeChemistryCalibration', () => ({
  getArchetypePairCalibrationMap: vi.fn().mockResolvedValue(new Map()),
  getCalibratedChemistryScore: vi.fn().mockImplementation(() => 90),
}));

const {
  groupSatisfiesStrongTieRule,
  groupHasEnergizer,
  groupHasTopicAnchor,
  adjustScoreForNoveltyDispersion,
  userArchetypeEnergy,
  runGreedyPoolMatchingCore,
} = await import('../poolMatchingService');
import type { UserWithProfile, UserInterestsCache } from '../poolMatchingService';

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
    ...overrides,
  };
}

function interestsCache(
  entries: Record<string, { topics: string[]; heatMap: Record<string, number> }>,
): UserInterestsCache {
  return new Map(Object.entries(entries));
}

/** Seed every pair under the legacy cache key; `overrides` keyed by `a|b` (either order). */
function seedPairScores(
  ids: string[],
  overrides: Record<string, number> = {},
  defaultScore = 90,
): Map<string, number> {
  const normalized = new Map(
    Object.entries(overrides).map(([k, v]) => [k.split('|').sort().join('|'), v]),
  );
  const cache = new Map<string, number>();
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
      cache.set(`legacy|${a}|${b}`, normalized.get(`${a}|${b}`) ?? defaultScore);
    }
  }
  return cache;
}

const CORE_POOL = { minGroupSize: 4, maxGroupSize: 4, targetGroups: 1, genderBalanceMode: 'none' };

async function runCore(
  users: UserWithProfile[],
  pairScoreCache: Map<string, number>,
  options: {
    rulesEnabled?: boolean;
    interests?: UserInterestsCache;
    invitationPairs?: Array<{ inviterId: string; inviteeId: string }>;
    pool?: Partial<typeof CORE_POOL>;
  } = {},
) {
  return runGreedyPoolMatchingCore(
    users,
    { ...CORE_POOL, ...options.pool },
    options.interests ?? new Map(),
    pairScoreCache,
    undefined, // semanticProfileCache
    false,     // semanticSimilarityEnabled
    undefined, // chemistryCalibrationMap
    options.invitationPairs ?? [],
    undefined, // customWeights
    undefined, // matchHistoryLookup
    50,        // strictness
    false,     // matchNeverMeetSentinelEnabled
    false,     // useWeightProfileV2
    options.rulesEnabled ?? true,
  );
}

// =============================================================================
// R1 无孤立者 (groupSatisfiesStrongTieRule)
// =============================================================================

describe('R1 无孤立者 — groupSatisfiesStrongTieRule', () => {
  const scoreBook = (scores: Record<string, number>) => {
    const lookup = new Map(Object.entries(scores));
    return async (u1: UserWithProfile, u2: UserWithProfile): Promise<number> =>
      lookup.get([u1.userId, u2.userId].sort().join('|')) ?? 0;
  };

  it('passes when every member has at least one intra-group tie ≥ 60', async () => {
    const members = [makeUser('a'), makeUser('b'), makeUser('c'), makeUser('d')];
    const getScore = scoreBook({ 'a|b': 60, 'b|c': 70, 'c|d': 80, 'a|d': 90, 'a|c': 10, 'b|d': 10 });
    expect(await groupSatisfiesStrongTieRule(members, getScore)).toBe(true);
  });

  it('treats exactly-at-60 as a strong tie (boundary)', async () => {
    const members = [makeUser('a'), makeUser('b')];
    expect(await groupSatisfiesStrongTieRule(members, scoreBook({ 'a|b': 60 }))).toBe(true);
    expect(await groupSatisfiesStrongTieRule(members, scoreBook({ 'a|b': 59 }))).toBe(false);
  });

  it('rejects when any member is isolated (all their pairs below 60)', async () => {
    const members = [makeUser('a'), makeUser('b'), makeUser('c'), makeUser('d')];
    const getScore = scoreBook({ 'a|b': 90, 'a|c': 90, 'b|c': 90, 'a|d': 55, 'b|d': 55, 'c|d': 55 });
    expect(await groupSatisfiesStrongTieRule(members, getScore)).toBe(false);
  });
});

// =============================================================================
// R2 能量编排 (groupHasEnergizer / userArchetypeEnergy)
// =============================================================================

describe('R2 能量编排 — groupHasEnergizer / userArchetypeEnergy', () => {
  it('passes when at least one member has energy ≥ 75 (corgi = 95)', () => {
    const members = [makeUser('a', { archetype: 'koala' }), makeUser('b', { archetype: 'corgi' })];
    expect(groupHasEnergizer(members)).toBe(true);
  });

  it('rejects when no member reaches 75 (koala = 70, owl = 55)', () => {
    const members = [makeUser('a', { archetype: 'koala' }), makeUser('b', { archetype: 'owl' })];
    expect(groupHasEnergizer(members)).toBe(false);
  });

  it('defaults missing/unknown archetypes to 60 — never an energizer', () => {
    expect(userArchetypeEnergy(makeUser('a', { archetype: null }))).toBe(60);
    expect(userArchetypeEnergy(makeUser('b', { archetype: 'unknown_archetype' }))).toBe(60);
    expect(groupHasEnergizer([makeUser('c', { archetype: 'unknown_archetype' })])).toBe(false);
  });
});

// =============================================================================
// R3 话题锚点 (groupHasTopicAnchor) — uses the real INTEREST_TAXONOMY
// =============================================================================

describe('R3 话题锚点 — groupHasTopicAnchor', () => {
  it('passes via (a): different topics, one macro category carried by every member', () => {
    const members = [makeUser('a'), makeUser('b'), makeUser('c'), makeUser('d')];
    const cache = interestsCache({
      a: { topics: ['hotpot', 'hiking'], heatMap: {} },   // food + sports
      b: { topics: ['bbq', 'script_kill'], heatMap: {} }, // food + play
      c: { topics: ['dessert'], heatMap: {} },            // food
      d: { topics: ['wine', 'cinema'], heatMap: {} },     // food + culture
    });
    // Every member carries a food topic → macro-category anchor.
    expect(groupHasTopicAnchor(members, cache)).toBe(true);
  });

  it('passes via (b): one topic shared by exactly ⌈n/2⌉ members (any heat)', () => {
    const members = [makeUser('a'), makeUser('b'), makeUser('c'), makeUser('d')];
    const cache = interestsCache({
      a: { topics: ['hotpot'], heatMap: {} },      // food — shared
      b: { topics: ['hotpot'], heatMap: {} },      // food — shared (2 of 4 = ⌈4/2⌉)
      c: { topics: ['script_kill'], heatMap: {} }, // play
      d: { topics: ['hiking'], heatMap: {} },      // sports
    });
    // (a) fails (no common category across all four); (b) passes on hotpot ×2.
    expect(groupHasTopicAnchor(members, cache)).toBe(true);
  });

  it('rejects below the ⌈n/2⌉ sharing threshold with no common category', () => {
    // 5 members → need ⌈5/2⌉ = 3 sharing one topic; hotpot has only 2.
    const members = ['a', 'b', 'c', 'd', 'e'].map(id => makeUser(id));
    const cache = interestsCache({
      a: { topics: ['hotpot'], heatMap: {} },
      b: { topics: ['hotpot'], heatMap: {} },
      c: { topics: ['script_kill'], heatMap: {} },
      d: { topics: ['hiking'], heatMap: {} },
      e: { topics: ['cinema'], heatMap: {} },
    });
    expect(groupHasTopicAnchor(members, cache)).toBe(false);
  });

  it('rejects when members share neither a category nor a topic (4 disjoint members)', () => {
    const members = [makeUser('a'), makeUser('b'), makeUser('c'), makeUser('d')];
    const cache = interestsCache({
      a: { topics: ['hotpot'], heatMap: {} },      // food
      b: { topics: ['script_kill'], heatMap: {} }, // play
      c: { topics: ['hiking'], heatMap: {} },      // sports
      d: { topics: ['cinema'], heatMap: {} },      // culture
    });
    expect(groupHasTopicAnchor(members, cache)).toBe(false);
  });

  it('skips the rule when any member has empty topics (cold-start safety)', () => {
    const members = [makeUser('a'), makeUser('b')];
    const cache = interestsCache({
      a: { topics: ['hotpot'], heatMap: {} },
      b: { topics: [], heatMap: {} },
    });
    expect(groupHasTopicAnchor(members, cache)).toBe(true);
  });

  it('skips the rule when any member is missing from the cache entirely', () => {
    const members = [makeUser('a'), makeUser('ghost')];
    const cache = interestsCache({ a: { topics: ['hotpot'], heatMap: {} } });
    expect(groupHasTopicAnchor(members, cache)).toBe(true);
  });
});

// =============================================================================
// R4 新奇分散 (adjustScoreForNoveltyDispersion)
// =============================================================================

describe('R4 新奇分散 — adjustScoreForNoveltyDispersion', () => {
  it('docks an explore candidate by 8 when the group already has an explorer', () => {
    const candidate = makeUser('c', { eventIntent: ['explore'] });
    const group = [makeUser('a', { eventIntent: ['explore'] }), makeUser('b', { eventIntent: ['fun'] })];
    expect(adjustScoreForNoveltyDispersion(candidate, group, 70)).toBe(62);
  });

  it('leaves an explore candidate untouched when the group has no explorer', () => {
    const candidate = makeUser('c', { eventIntent: ['explore'] });
    const group = [makeUser('a', { eventIntent: ['fun'] }), makeUser('b', { eventIntent: ['networking'] })];
    expect(adjustScoreForNoveltyDispersion(candidate, group, 70)).toBe(70);
  });

  it('leaves non-explore candidates untouched even in an explorer group', () => {
    const candidate = makeUser('c', { eventIntent: ['friends'] });
    const group = [makeUser('a', { eventIntent: ['explore'] })];
    expect(adjustScoreForNoveltyDispersion(candidate, group, 70)).toBe(70);
  });

  it('reads explore from userIntent when eventIntent is empty (getEffectiveIntent fallback)', () => {
    const candidate = makeUser('c', { eventIntent: [], userIntent: ['explore'] });
    const group = [makeUser('a', { eventIntent: null, userIntent: ['explore'] })];
    expect(adjustScoreForNoveltyDispersion(candidate, group, 70)).toBe(62);
  });
});

// =============================================================================
// Greedy-core integration (magnetismGroupRulesEnabled threaded in)
// =============================================================================

describe('greedy core integration — magnetism group rules', () => {
  it('forms a compliant group when all rules pass (rules ON)', async () => {
    const users = [
      makeUser('a', { archetype: 'corgi' }), // energizer 95 → R2 ✓
      makeUser('b'),
      makeUser('c'),
      makeUser('d'),
    ];
    const cache = seedPairScores(['a', 'b', 'c', 'd']); // all pairs 90 → R1 ✓
    const interests = interestsCache(Object.fromEntries(
      ['a', 'b', 'c', 'd'].map(id => [id, { topics: ['hotpot'], heatMap: { hotpot: 25 } }]),
    )); // shared topic → R3 ✓

    const groups = await runCore(users, cache, { interests });
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map(m => m.userId).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('R1: rejects a group whose invited member has no pair ≥ 60 (rules ON), forms it when OFF', async () => {
    // x is carried in by the +20 invitation boost on the x|y seed (50 → 70);
    // every raw pair involving x is < 60, so R1 rejects the committed group.
    const users = [makeUser('x'), makeUser('y'), makeUser('a'), makeUser('b')];
    const cache = seedPairScores(['x', 'y', 'a', 'b'], {
      'x|y': 50, 'x|a': 55, 'x|b': 55, 'y|a': 70, 'y|b': 70, 'a|b': 90,
    });
    const invitationPairs = [{ inviterId: 'y', inviteeId: 'x' }];

    const offGroups = await runCore(users, new Map(cache), { rulesEnabled: false, invitationPairs });
    expect(offGroups).toHaveLength(1);
    expect(offGroups[0].members.map(m => m.userId).sort()).toEqual(['a', 'b', 'x', 'y']);

    const onGroups = await runCore(users, new Map(cache), { rulesEnabled: true, invitationPairs });
    expect(onGroups).toHaveLength(0);
  });

  it('R2: rejects an energizer-free group when the pool has an energizer, forms it when OFF', async () => {
    // e (corgi, 95) has terrible pair scores and never groups, but its presence
    // in the eligible pool means R2 is enforced against the all-koala group.
    const users = [
      makeUser('a'), makeUser('b'), makeUser('c'), makeUser('d'),
      makeUser('e', { archetype: 'corgi' }),
    ];
    const cache = seedPairScores(['a', 'b', 'c', 'd', 'e'], { 'a|e': 10, 'b|e': 10, 'c|e': 10, 'd|e': 10 });

    const offGroups = await runCore(users, new Map(cache), { rulesEnabled: false });
    expect(offGroups).toHaveLength(1);

    const onGroups = await runCore(users, new Map(cache), { rulesEnabled: true });
    expect(onGroups).toHaveLength(0);
  });

  it('R2: exempts the rule entirely when NO eligible user is an energizer', async () => {
    const users = [makeUser('a'), makeUser('b'), makeUser('c'), makeUser('d')]; // all koala (70)
    const cache = seedPairScores(['a', 'b', 'c', 'd']);
    const groups = await runCore(users, cache, { rulesEnabled: true });
    expect(groups).toHaveLength(1);
  });

  it('R3: rejects a group with no topic anchor (rules ON), forms it when OFF', async () => {
    const users = [makeUser('a'), makeUser('b'), makeUser('c'), makeUser('d')]; // all koala → R2 exempt
    const cache = seedPairScores(['a', 'b', 'c', 'd']);
    const interests = interestsCache({
      a: { topics: ['hotpot'], heatMap: {} },      // food
      b: { topics: ['script_kill'], heatMap: {} }, // play
      c: { topics: ['hiking'], heatMap: {} },      // sports
      d: { topics: ['cinema'], heatMap: {} },      // culture
    });

    const offGroups = await runCore(users, new Map(cache), { rulesEnabled: false, interests });
    expect(offGroups).toHaveLength(1);

    const onGroups = await runCore(users, new Map(cache), { rulesEnabled: true, interests });
    expect(onGroups).toHaveLength(0);
  });

  it('R3: cold-start members (empty interests) skip the rule — group still forms', async () => {
    const users = [makeUser('a', { archetype: 'corgi' }), makeUser('b'), makeUser('c'), makeUser('d')];
    const cache = seedPairScores(['a', 'b', 'c', 'd']);
    const groups = await runCore(users, cache, { rulesEnabled: true, interests: new Map() });
    expect(groups).toHaveLength(1);
  });

  it('R4: a second explore candidate is deprioritized (rules ON) vs picked (rules OFF)', async () => {
    // Seed pair s1|s2 (s2 explore). Candidates: x (explore, avg 70) vs y (fun, avg 65).
    // Rules OFF → x joins (70 > 65); rules ON → x nudged to 62 < 65 → y joins.
    const mkUsers = () => [
      makeUser('s1', { eventIntent: ['fun'] }),
      makeUser('s2', { eventIntent: ['explore'] }),
      makeUser('x', { eventIntent: ['explore'] }),
      makeUser('y', { eventIntent: ['fun'] }),
    ];
    const mkCache = () => seedPairScores(['s1', 's2', 'x', 'y'], {
      's1|s2': 90, 's1|x': 70, 's2|x': 70, 's1|y': 65, 's2|y': 65, 'x|y': 10,
    });
    const pool = { minGroupSize: 3, maxGroupSize: 3, targetGroups: 1, genderBalanceMode: 'none' };

    const offGroups = await runCore(mkUsers(), mkCache(), { rulesEnabled: false, pool });
    expect(offGroups).toHaveLength(1);
    expect(offGroups[0].members.map(m => m.userId).sort()).toEqual(['s1', 's2', 'x']);

    const onGroups = await runCore(mkUsers(), mkCache(), { rulesEnabled: true, pool });
    expect(onGroups).toHaveLength(1);
    expect(onGroups[0].members.map(m => m.userId).sort()).toEqual(['s1', 's2', 'y']);
  });

  it('R4: an explore candidate is still admitted when it is the only viable option (nudge, not ban)', async () => {
    const users = [
      makeUser('s1', { eventIntent: ['fun'] }),
      makeUser('s2', { eventIntent: ['explore'] }),
      makeUser('x', { eventIntent: ['explore'] }), // avg 70 — penalized to 62 in ranking
      makeUser('y', { eventIntent: ['fun'] }),     // avg 55 — below the 60 admission gate
    ];
    const cache = seedPairScores(['s1', 's2', 'x', 'y'], {
      's1|s2': 90, 's1|x': 70, 's2|x': 70, 's1|y': 55, 's2|y': 55, 'x|y': 10,
    });
    const pool = { minGroupSize: 3, maxGroupSize: 3, targetGroups: 1, genderBalanceMode: 'none' };

    const groups = await runCore(users, cache, { rulesEnabled: true, pool });
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map(m => m.userId).sort()).toEqual(['s1', 's2', 'x']);
  });
});

// =============================================================================
// H4 redistribution — the greedy-commit rules (R1/R2/R3) must also gate the
// absorption / remainder-group paths. Redistribution only runs when adaptive
// weights are passed or Match Compass relaxed mode is on (allowOverflow); the
// pair-cache key then carries the `|adaptive` segment.
// =============================================================================

const ADAPTIVE_WEIGHTS = {
  chemistryWeight: 28,
  interestWeight: 28,
  socialAffinityWeight: 20,
  backgroundDiversityWeight: 15,
  preferenceWeight: 5,
  languageWeight: 4,
};

/** Seed every pair under the adaptive cache key (customWeights redistributions). */
function seedAdaptivePairScores(
  ids: string[],
  overrides: Record<string, number> = {},
  defaultScore = 90,
): Map<string, number> {
  const normalized = new Map(
    Object.entries(overrides).map(([k, v]) => [k.split('|').sort().join('|'), v]),
  );
  const cache = new Map<string, number>();
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
      cache.set(`legacy|adaptive|${a}|${b}`, normalized.get(`${a}|${b}`) ?? defaultScore);
    }
  }
  return cache;
}

async function runCoreWithRedistribution(
  users: UserWithProfile[],
  pairScoreCache: Map<string, number>,
  options: {
    rulesEnabled?: boolean;
    interests?: UserInterestsCache;
    pool?: Partial<typeof CORE_POOL>;
  } = {},
) {
  return runGreedyPoolMatchingCore(
    users,
    { ...CORE_POOL, ...options.pool },
    options.interests ?? new Map(),
    pairScoreCache,
    undefined, // semanticProfileCache
    false,     // semanticSimilarityEnabled
    undefined, // chemistryCalibrationMap
    [],
    ADAPTIVE_WEIGHTS, // customWeights → triggers the redistribution pass
    undefined, // matchHistoryLookup
    50,        // strictness
    false,     // matchNeverMeetSentinelEnabled
    false,     // useWeightProfileV2
    options.rulesEnabled ?? true,
  );
}

describe('H4 redistribution — absorption respects magnetism rules', () => {
  it('Phase 1: refuses to absorb a stranded user with no strong tie (R1) when rules ON, absorbs when OFF', async () => {
    // Greedy commits {a,b,c,d} at 90s; e pairs with everyone at 55 — above the
    // 50 redistribution floor but below the 60 R1 strong-tie threshold.
    const users = [
      makeUser('a', { archetype: 'corgi' }),
      makeUser('b'),
      makeUser('c'),
      makeUser('d'),
      makeUser('e'),
    ];
    const mkCache = () => seedAdaptivePairScores(['a', 'b', 'c', 'd', 'e'], {
      'a|e': 55, 'b|e': 55, 'c|e': 55, 'd|e': 55,
    });
    const pool = { minGroupSize: 4, maxGroupSize: 5, targetGroups: 1, genderBalanceMode: 'none' };

    const offGroups = await runCoreWithRedistribution(users, mkCache(), { rulesEnabled: false, pool });
    expect(offGroups).toHaveLength(1);
    expect(offGroups[0].members.map(m => m.userId).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);

    const onGroups = await runCoreWithRedistribution(users, mkCache(), { rulesEnabled: true, pool });
    expect(onGroups).toHaveLength(1);
    expect(onGroups[0].members.map(m => m.userId).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('Phase 2: refuses to form a remainder group that violates R1 when rules ON, forms when OFF', async () => {
    // Greedy commits {a,b,c,d} (all 90); e,f,g,h pair at 55 with everyone,
    // so greedy strands them and Phase 2 would form a remainder group.
    const users = [
      makeUser('a', { archetype: 'corgi' }),
      makeUser('b'),
      makeUser('c'),
      makeUser('d'),
      makeUser('e'),
      makeUser('f'),
      makeUser('g'),
      makeUser('h'),
    ];
    const mkCache = () => seedAdaptivePairScores(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], {
      'a|e': 55, 'a|f': 55, 'a|g': 55, 'a|h': 55,
      'b|e': 55, 'b|f': 55, 'b|g': 55, 'b|h': 55,
      'c|e': 55, 'c|f': 55, 'c|g': 55, 'c|h': 55,
      'd|e': 55, 'd|f': 55, 'd|g': 55, 'd|h': 55,
    });
    const pool = { minGroupSize: 4, maxGroupSize: 4, targetGroups: 1, genderBalanceMode: 'none' };

    const offGroups = await runCoreWithRedistribution(users, mkCache(), { rulesEnabled: false, pool });
    expect(offGroups).toHaveLength(2);
    expect(offGroups.some(g => g.members.length === 4 && g.members.every(m => ['a', 'b', 'c', 'd'].includes(m.userId)))).toBe(true);
    expect(offGroups.some(g => ['e', 'f', 'g', 'h'].every(id => g.members.some(m => m.userId === id)))).toBe(true);

    const onGroups = await runCoreWithRedistribution(users, mkCache(), { rulesEnabled: true, pool });
    expect(onGroups).toHaveLength(1);
    expect(onGroups[0].members.map(m => m.userId).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('Phase 3: refuses soft-overflow absorption of a stranded user with no strong tie (R1) when rules ON, absorbs when OFF', async () => {
    // maxGroupSize=4 → Phase 1 skips (group full); Phase 2 skips (only 1
    // stranded); Phase 3 soft-overflow would absorb e at avg 55 ≥ 50.
    const users = [
      makeUser('a', { archetype: 'corgi' }),
      makeUser('b'),
      makeUser('c'),
      makeUser('d'),
      makeUser('e'),
    ];
    const mkCache = () => seedAdaptivePairScores(['a', 'b', 'c', 'd', 'e'], {
      'a|e': 55, 'b|e': 55, 'c|e': 55, 'd|e': 55,
    });
    const pool = { minGroupSize: 4, maxGroupSize: 4, targetGroups: 1, genderBalanceMode: 'none' };

    const offGroups = await runCoreWithRedistribution(users, mkCache(), { rulesEnabled: false, pool });
    expect(offGroups).toHaveLength(1);
    expect(offGroups[0].members.map(m => m.userId).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);

    const onGroups = await runCoreWithRedistribution(users, mkCache(), { rulesEnabled: true, pool });
    expect(onGroups).toHaveLength(1);
    expect(onGroups[0].members.map(m => m.userId).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

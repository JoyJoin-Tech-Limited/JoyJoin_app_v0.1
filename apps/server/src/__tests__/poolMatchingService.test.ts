import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockState,
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
  mockState: {
    userInterestsByUserId: new Map<string, any>(),
    updateSetCalls: [] as any[],
    updateReturningQueue: [] as any[],
    updateWhereQueue: [] as any[],
    poolRow: { id: 'pool-1', title: 'Test Pool', eventType: '饭局', city: '上海', district: '徐汇', dateTime: new Date(), createdBy: 'host-1' } as any | null,
    registrations: [] as any[],
    throwCouponsSelect: false,
    transactionImpl: vi.fn(),
  },
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

function makeAwaitable(value: unknown) {
  return {
    limit: () => Promise.resolve(value),
    returning: () => Promise.resolve(value),
    then: (resolve: (v: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  };
}

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => {
        const runWhere = (condition: any) => {
          if (table === eventPoolsTable) {
            return makeAwaitable(mockState.poolRow ? [mockState.poolRow] : []);
          }
          if (table === eventPoolRegistrationsTable) {
            return makeAwaitable(mockState.registrations);
          }
          if (table === userInterestsTable) {
            if (condition?.type === 'inArray') {
              const rows = (condition.values as string[])
                .map((userId) => mockState.userInterestsByUserId.get(userId))
                .filter(Boolean);
              return makeAwaitable(rows);
            }
            const row = mockState.userInterestsByUserId.get(condition?.value);
            return {
              limit: () => Promise.resolve(row ? [row] : []),
              then: (resolve: (v: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
                Promise.resolve(row ? [row] : []).then(resolve, reject),
            };
          }
          if (table === couponsTable && mockState.throwCouponsSelect) {
            throw new Error('coupon lookup failed');
          }
          return makeAwaitable([]);
        };
        // innerJoin chains (used by matchEventPool's registration query) resolve
        // back to the same where() logic — additive, existing callers unaffected.
        const joinable: any = { where: runWhere };
        joinable.innerJoin = () => joinable;
        return joinable;
      },
    }),
    update: (_table: unknown) => ({
      set: (values: any) => {
        mockState.updateSetCalls.push(values);
        return {
          where: () => {
            const returningValue = mockState.updateReturningQueue.shift();
            const whereValue = mockState.updateWhereQueue.shift() ?? [];
            return {
              returning: () => Promise.resolve(returningValue ?? []),
              then: (resolve: (v: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
                Promise.resolve(whereValue).then(resolve, reject),
            };
          },
        };
      },
    }),
    query: {
      eventPools: {
        findFirst: () => Promise.resolve(mockState.poolRow),
      },
    },
    transaction: (...args: any[]) => mockState.transactionImpl(...args),
  },
}));

vi.mock('../wsService', () => ({
  wsService: { broadcastToUser: vi.fn() },
}));
vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: vi.fn(),
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
  ARCHETYPE_ENERGY: { 'koala': 60 },
}));
vi.mock('../archetypeChemistryCalibration', () => ({
  getArchetypePairCalibrationMap: vi.fn().mockResolvedValue(new Map()),
  getCalibratedChemistryScore: vi.fn().mockImplementation((_a: string, _b: string) => 90),
}));

const {
  calculateInterestScoreAsync,
  preloadUserInterests,
  saveMatchResults,
  runGreedyPoolMatchingCore,
  matchEventPool,
  calculateGroupDiversity,
  classifyDisclosedGender,
  countDisclosedGenders,
  groupSatisfiesGenderFloor,
  groupHasExactGenderBalance,
} = await import('../poolMatchingService');
import type { UserWithProfile, MatchGroup } from '../poolMatchingService';
import { logger } from '../lib/logger';
const { getFeatureFlag } = await import('../lib/featureFlags');
const { executePostMatchCommitSideEffects } = await import('../lib/matchingPostMatchEffects');

describe('poolMatchingService', () => {
  beforeEach(() => {
    mockState.userInterestsByUserId = new Map([
      ['u1', { userId: 'u1', selections: [{ topicId: 't1', heat: 25 }, { topicId: 't2', heat: 10 }] }],
      ['u2', { userId: 'u2', selections: [{ topicId: 't1', heat: 25 }, { topicId: 't3', heat: 10 }] }],
    ]);
    mockState.updateSetCalls.length = 0;
    mockState.updateReturningQueue.length = 0;
    mockState.updateWhereQueue.length = 0;
    mockState.poolRow = { id: 'pool-1', title: 'Test Pool', eventType: '饭局', city: '上海', district: '徐汇', dateTime: new Date(), createdBy: 'host-1' };
    mockState.registrations = [];
    mockState.throwCouponsSelect = false;
    mockState.transactionImpl.mockReset();
    (getFeatureFlag as ReturnType<typeof vi.fn>).mockImplementation((key: string, defaultValue: boolean) => {
      if (key === 'matchingOperatorReviewEnabled') return Promise.resolve(false);
      return Promise.resolve(defaultValue);
    });
    (executePostMatchCommitSideEffects as ReturnType<typeof vi.fn>).mockClear();
  });

  it('returns the same interest score with preloaded cache as without cache', async () => {
    const uncached = await calculateInterestScoreAsync('u1', 'u2');
    const cache = await preloadUserInterests(['u1', 'u2']);
    const cached = await calculateInterestScoreAsync('u1', 'u2', cache);

    expect(cached).toBe(uncached);
  });

  it('rejects duplicate/concurrent saveMatchResults runs when the pool guard is already held', async () => {
    mockState.updateReturningQueue.push([]); // guard CAS updated 0 rows

    await expect(saveMatchResults('pool-1', [])).rejects.toThrow(/Guard rejected/);
    expect(mockState.transactionImpl).not.toHaveBeenCalled();
  });

  it('throws a clear not-found error before attempting the pool guard', async () => {
    mockState.poolRow = null;

    await expect(saveMatchResults('missing-pool', [])).rejects.toThrow(/Pool not found/);
    expect(mockState.updateSetCalls).toHaveLength(0);
    expect(mockState.transactionImpl).not.toHaveBeenCalled();
  });

  it('resets the pool status back to active when the transactional match save fails', async () => {
    mockState.updateReturningQueue.push([{ id: 'pool-1' }]); // guard acquisition
    mockState.updateWhereQueue.push([]); // reset status update
    mockState.transactionImpl.mockRejectedValueOnce(new Error('tx failed'));

    await expect(saveMatchResults('pool-1', [])).rejects.toThrow('tx failed');

    expect(mockState.updateSetCalls[0]).toMatchObject({ status: 'matching' });
    expect(mockState.updateSetCalls[1]).toMatchObject({ status: 'active' });
  });

  it('keeps match persistence successful when invitation reward processing fails', async () => {
    mockState.updateReturningQueue.push([{ id: 'pool-1' }]); // guard acquisition
    mockState.throwCouponsSelect = true;
    mockState.transactionImpl.mockResolvedValueOnce(undefined);

    await expect(saveMatchResults('pool-1', [])).resolves.toBeUndefined();

    expect(mockState.updateSetCalls[0]).toMatchObject({ status: 'matching' });
  });

  it('skips post-match side effects when operator review is enabled', async () => {
    mockState.updateReturningQueue.push([{ id: 'pool-1' }]); // guard acquisition
    mockState.transactionImpl.mockResolvedValueOnce(undefined);
    (getFeatureFlag as ReturnType<typeof vi.fn>).mockImplementation((key: string, defaultValue: boolean) => {
      if (key === 'matchingOperatorReviewEnabled') return Promise.resolve(true);
      return Promise.resolve(defaultValue);
    });

    await expect(saveMatchResults('pool-1', [])).resolves.toBeUndefined();

    expect(executePostMatchCommitSideEffects).not.toHaveBeenCalled();
  });

  it('runs post-match side effects when operator review is disabled', async () => {
    mockState.updateReturningQueue.push([{ id: 'pool-1' }]); // guard acquisition
    mockState.transactionImpl.mockResolvedValueOnce(undefined);

    await expect(saveMatchResults('pool-1', [])).resolves.toBeUndefined();

    expect(executePostMatchCommitSideEffects).toHaveBeenCalledWith(
      'pool-1',
      [],
      expect.any(Array),
      expect.any(Object),
    );
  });
});

// =============================================================================
// Gender ratio enforcement (Sprint 2026-07-14 — D1–D9)
// =============================================================================

function makeGenderUser(
  id: string,
  gender: string | null,
  overrides?: Partial<UserWithProfile>,
): UserWithProfile {
  return {
    userId: id,
    registrationId: `reg-${id}`,
    gender,
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
    eventIntent: ['networking'],
    userIntent: null,
    cuisinePreferences: null,
    dietaryRestrictions: null,
    tasteIntensity: null,
    barThemes: null,
    alcoholComfort: null,
    eventType: '饭局',
    ageMatchPreference: null,
    tableVibePreference: null,
    vibeVector: null,
    preferenceStrictness: null,
    preferredDistricts: null,
    genderCompositionPreference: null,
    acceptPairs: null,
    kolComfortLevel: null,
    ...overrides,
  };
}

/** Uniform pair scores, seeded under BOTH legacy and adaptive cache keys so the
 *  greedy core is fully deterministic regardless of which weights path is active. */
function buildUniformPairCache(users: UserWithProfile[], score = 90): Map<string, number> {
  const cache = new Map<string, number>();
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const key = `${users[i].userId}|${users[j].userId}`;
      cache.set(`legacy|${key}`, score);
      cache.set(`legacy|adaptive|${key}`, score);
    }
  }
  return cache;
}

// Passing customWeights (param 9) activates the H4 redistribution pass.
const ADAPTIVE_WEIGHTS = {
  chemistryWeight: 28,
  interestWeight: 28,
  socialAffinityWeight: 20,
  backgroundDiversityWeight: 15,
  preferenceWeight: 5,
  languageWeight: 4,
};

describe('gender classification helpers (REL-01)', () => {
  it('classifies disclosed and undisclosed genders', () => {
    expect(classifyDisclosedGender('女性')).toBe('female');
    expect(classifyDisclosedGender('女')).toBe('female');
    expect(classifyDisclosedGender('female')).toBe('female');
    expect(classifyDisclosedGender('男性')).toBe('male');
    expect(classifyDisclosedGender('男')).toBe('male');
    expect(classifyDisclosedGender('male')).toBe('male');
    expect(classifyDisclosedGender('不透露')).toBeNull();
    expect(classifyDisclosedGender(null)).toBeNull();
    expect(classifyDisclosedGender(undefined)).toBeNull();
    expect(classifyDisclosedGender('')).toBeNull();
    expect(classifyDisclosedGender('something-else')).toBeNull();
  });

  it('counts undisclosed genders toward neither floor', () => {
    const members = [
      makeGenderUser('f1', '女性'),
      makeGenderUser('m1', '男性'),
      makeGenderUser('n1', null),
      makeGenderUser('n2', '不透露'),
    ];
    expect(countDisclosedGenders(members)).toEqual({ male: 1, female: 1 });
    expect(groupSatisfiesGenderFloor(members, 1, 1)).toBe(true);
    expect(groupSatisfiesGenderFloor(members, 2, 0)).toBe(false); // only 1 disclosed female
    expect(groupSatisfiesGenderFloor(members, 0, 2)).toBe(false); // only 1 disclosed male
  });

  it('exact balance requires equal disclosed counts and at least one male', () => {
    expect(
      groupHasExactGenderBalance([makeGenderUser('f1', '女性'), makeGenderUser('m1', '男性')]),
    ).toBe(true);
    expect(
      groupHasExactGenderBalance([makeGenderUser('f1', '女性'), makeGenderUser('f2', '女性')]),
    ).toBe(false);
    expect(
      groupHasExactGenderBalance([makeGenderUser('n1', null), makeGenderUser('n2', '不透露')]),
    ).toBe(false);
    expect(groupHasExactGenderBalance([])).toBe(false);
  });
});

describe('calculateGroupDiversity soft-mode balance bonus (AC-04, D8)', () => {
  // 2M/2F, identical industry/archetype/lifeStage → base = round(6.25+12.5+6.25+6.25) = 31
  const balancedLowDiversity = [
    makeGenderUser('m1', '男性'),
    makeGenderUser('f1', '女性'),
    makeGenderUser('m2', '男性'),
    makeGenderUser('f2', '女性'),
  ];

  it('adds the bonus for exactly balanced groups in soft mode', () => {
    expect(calculateGroupDiversity(balancedLowDiversity)).toBe(31);
    expect(calculateGroupDiversity(balancedLowDiversity, 'soft', 15)).toBe(46);
    expect(calculateGroupDiversity(balancedLowDiversity, 'soft', 20)).toBe(51);
  });

  it('withholds the bonus for imbalanced groups', () => {
    const imbalanced = ['m1', 'm2', 'm3', 'm4'].map((id) => makeGenderUser(id, '男性'));
    const base = calculateGroupDiversity(imbalanced);
    expect(calculateGroupDiversity(imbalanced, 'soft', 15)).toBe(base);
  });

  it('withholds the bonus outside soft mode (hard / none / legacy default)', () => {
    expect(calculateGroupDiversity(balancedLowDiversity, 'hard', 15)).toBe(31);
    expect(calculateGroupDiversity(balancedLowDiversity, 'none', 15)).toBe(31);
  });

  it('keeps the bonus observable beyond the [0,100] clamp (post-clamp semantics)', () => {
    const highDiversityBalanced = [
      makeGenderUser('m1', '男性', { industryNiche: 'tech', archetype: 'koala', lifeStage: '职场老手' }),
      makeGenderUser('f1', '女性', { industryNiche: 'finance', archetype: 'corgi', lifeStage: '学生党' }),
      makeGenderUser('m2', '男性', { industryNiche: 'medical', archetype: 'fox', lifeStage: '创业中' }),
      makeGenderUser('f2', '女性', { industryNiche: 'design', archetype: 'dolphin', lifeStage: '自由职业' }),
    ];
    // base = 25 + 12.5 + 25 + 25 = 87.5 → 88
    expect(calculateGroupDiversity(highDiversityBalanced)).toBe(88);
    // Pre-clamp semantics would yield min(100, 88+15) = 100 — bonus invisible.
    // Locked D8 post-clamp semantics: 88 + 15 = 103.
    expect(calculateGroupDiversity(highDiversityBalanced, 'soft', 15)).toBe(103);
  });
});

describe('hard-mode gender floor at commit gate (AC-02, AC-03, AC-10, REL-01)', () => {
  it('AC-02: blocks the all-male group and commits the all-female group under minFemaleCount=2', async () => {
    const users = [
      makeGenderUser('m1', '男性'),
      makeGenderUser('m2', '男性'),
      makeGenderUser('m3', '男性'),
      makeGenderUser('m4', '男性'),
      makeGenderUser('f1', '女性'),
      makeGenderUser('f2', '女性'),
      makeGenderUser('f3', '女性'),
      makeGenderUser('f4', '女性'),
    ];
    const infoSpy = vi.spyOn(logger, 'info');
    const debugSpy = vi.spyOn(logger, 'debug');

    const groups = await runGreedyPoolMatchingCore(
      users,
      {
        minGroupSize: 4,
        maxGroupSize: 4,
        targetGroups: 10,
        genderBalanceMode: 'hard',
        minFemaleCount: 2,
        minMaleCount: 0,
      },
      new Map(),
      buildUniformPairCache(users),
      undefined,
      false,
      undefined,
      [],
    );

    // Only the all-female group satisfies minFemaleCount=2; the 4M group is blocked.
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(4);
    for (const g of groups) {
      expect(countDisclosedGenders(g.members).female).toBeGreaterThanOrEqual(2);
    }

    // AC-10(a): activation log; AC-10(c): rejection at debug level; AC-10(b): summary.
    expect(infoSpy).toHaveBeenCalledWith(
      '[Pool Matching] hard gender-balance mode active',
      expect.objectContaining({ mode: 'hard', minFemaleCount: 2, minMaleCount: 0 }),
    );
    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('gender floor'),
      expect.objectContaining({ male: 4, female: 0 }),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      '[Pool Matching] gender-balance summary',
      expect.objectContaining({ groupsFormed: 1, groupsSatisfyingFloor: 1 }),
    );

    infoSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it('AC-03: skewed 9M/1F pool still forms a group; floor-violating remainders are not committed', async () => {
    const users = [
      ...Array.from({ length: 9 }, (_, i) => makeGenderUser(`m${i + 1}`, '男性')),
      makeGenderUser('f1', '女性'),
    ];

    const groups = await runGreedyPoolMatchingCore(
      users,
      {
        minGroupSize: 4,
        maxGroupSize: 6,
        targetGroups: 10,
        genderBalanceMode: 'hard',
        minFemaleCount: 1,
      },
      new Map(),
      buildUniformPairCache(users),
      undefined,
      false,
      undefined,
      [],
    );

    expect(groups.length).toBeGreaterThanOrEqual(1);
    for (const g of groups) {
      expect(countDisclosedGenders(g.members).female).toBeGreaterThanOrEqual(1);
    }
    // The 4M remainder must NOT appear as a committed group.
    for (const g of groups) {
      const { male, female } = countDisclosedGenders(g.members);
      expect(male === 4 && female === 0).toBe(false);
    }
  });

  it('REL-01: null/不透露 members count toward neither floor without throwing', async () => {
    const users = [
      makeGenderUser('f1', '女性'),
      makeGenderUser('m1', '男性'),
      makeGenderUser('n1', null),
      makeGenderUser('n2', '不透露'),
    ];

    const groups = await runGreedyPoolMatchingCore(
      users,
      {
        minGroupSize: 4,
        maxGroupSize: 4,
        targetGroups: 1,
        genderBalanceMode: 'hard',
        minFemaleCount: 1,
        minMaleCount: 1,
      },
      new Map(),
      buildUniformPairCache(users),
      undefined,
      false,
      undefined,
      [],
    );

    // Disclosed counts are 1F/1M — floor satisfied; undisclosed members ignored.
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(4);
  });
});

describe('genderRestriction skips all balance logic (AC-05, D5)', () => {
  it('forms all-female groups even with impossible floors configured, and emits no floor logs', async () => {
    const users = Array.from({ length: 4 }, (_, i) => makeGenderUser(`f${i + 1}`, '女性'));
    const infoSpy = vi.spyOn(logger, 'info');
    const debugSpy = vi.spyOn(logger, 'debug');

    const groups = await runGreedyPoolMatchingCore(
      users,
      {
        minGroupSize: 4,
        maxGroupSize: 4,
        targetGroups: 1,
        genderBalanceMode: 'hard',
        minFemaleCount: 4,
        minMaleCount: 4, // impossible for an all-female pool — must be ignored
        genderRestriction: '女性',
      },
      new Map(),
      buildUniformPairCache(users),
      undefined,
      false,
      undefined,
      [],
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(4);

    const floorRejections = debugSpy.mock.calls.filter(
      ([msg]) => typeof msg === 'string' && msg.includes('gender floor'),
    );
    expect(floorRejections).toHaveLength(0);
    const activations = infoSpy.mock.calls.filter(
      ([msg]) => typeof msg === 'string' && msg.includes('hard gender-balance mode active'),
    );
    expect(activations).toHaveLength(0);

    infoSpy.mockRestore();
    debugSpy.mockRestore();
  });
});

describe('H4 redistribution gender-floor enforcement (AC-06, D6)', () => {
  it('Phase 2: floor-failing remainder group is not committed; all committed groups satisfy the floor', async () => {
    const users = [
      makeGenderUser('f1', '女性'),
      makeGenderUser('f2', '女性'),
      makeGenderUser('f3', '女性'),
      ...Array.from({ length: 9 }, (_, i) => makeGenderUser(`m${i + 1}`, '男性')),
    ];
    const debugSpy = vi.spyOn(logger, 'debug');

    const groups = await runGreedyPoolMatchingCore(
      users,
      {
        minGroupSize: 4,
        maxGroupSize: 6,
        targetGroups: 10,
        genderBalanceMode: 'hard',
        minFemaleCount: 2,
      },
      new Map(),
      buildUniformPairCache(users),
      undefined,
      false,
      undefined,
      [],
      ADAPTIVE_WEIGHTS, // param 9: activates H4 redistribution
    );

    // Greedy commits [f1,f2,f3,m1,m2,m3]; the 6M remainder fails the floor in
    // both the main loop AND Phase 2 — it must not appear in the output.
    expect(groups).toHaveLength(1);
    expect(countDisclosedGenders(groups[0].members)).toEqual({ male: 3, female: 3 });
    for (const g of groups) {
      expect(groupSatisfiesGenderFloor(g.members, 2, 0)).toBe(true);
    }

    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('phase-2 remainder group blocked'),
      expect.objectContaining({ male: 6, female: 0 }),
    );
    debugSpy.mockRestore();
  });

  it('Phase 3: existing-group absorption never emits a floor violation (defensive check)', async () => {
    const users = [
      makeGenderUser('f1', '女性'),
      makeGenderUser('f2', '女性'),
      makeGenderUser('f3', '女性'),
      ...Array.from({ length: 5 }, (_, i) => makeGenderUser(`m${i + 1}`, '男性')),
    ];

    const groups = await runGreedyPoolMatchingCore(
      users,
      {
        minGroupSize: 4,
        maxGroupSize: 6,
        targetGroups: 10,
        genderBalanceMode: 'hard',
        minFemaleCount: 2,
      },
      new Map(),
      buildUniformPairCache(users),
      undefined,
      false,
      undefined,
      [],
      ADAPTIVE_WEIGHTS,
    );

    // group1 = [f1,f2,f3,m1,m2,m3]; m4 absorbed in Phase 3 (group at maxGroupSize,
    // not above); m5 stays stranded (group now exceeds maxGroupSize).
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(7);
    expect(countDisclosedGenders(groups[0].members)).toEqual({ male: 4, female: 3 });
    expect(groupSatisfiesGenderFloor(groups[0].members, 2, 0)).toBe(true);
  });

  it('Phase 1: overflow absorption never emits a floor violation (defensive check)', async () => {
    const original = process.env.MATCH_COMPASS_STRICTNESS_ENABLED;
    process.env.MATCH_COMPASS_STRICTNESS_ENABLED = 'true';
    try {
      const users = [
        makeGenderUser('f1', '女性'),
        makeGenderUser('f2', '女性'),
        makeGenderUser('f3', '女性'),
        ...Array.from({ length: 4 }, (_, i) => makeGenderUser(`m${i + 1}`, '男性')),
      ];

      const groups = await runGreedyPoolMatchingCore(
        users,
        {
          minGroupSize: 4,
          maxGroupSize: 6,
          targetGroups: 10,
          genderBalanceMode: 'hard',
          minFemaleCount: 2,
        },
        new Map(),
        buildUniformPairCache(users),
        undefined,
        false,
        undefined,
        [],
        undefined, // no customWeights
        undefined, // no matchHistoryLookup
        0, // strictness=0 → allowOverflow → H4 active
      );

      // group1 = [f1,f2,f3,m1,m2,m3]; m4 absorbed via Phase-1 overflow.
      expect(groups).toHaveLength(1);
      expect(groups[0].members).toHaveLength(7);
      expect(groupSatisfiesGenderFloor(groups[0].members, 2, 0)).toBe(true);
    } finally {
      if (original === undefined) delete process.env.MATCH_COMPASS_STRICTNESS_ENABLED;
      else process.env.MATCH_COMPASS_STRICTNESS_ENABLED = original;
    }
  });
});

describe('matchEventPool threads pool gender config into the core (AC-12)', () => {
  function seedRegistrations(users: UserWithProfile[]) {
    mockState.registrations = users;
    for (const u of users) {
      mockState.userInterestsByUserId.set(u.userId, {
        userId: u.userId,
        selections: [
          { topicId: 't1', heat: 25 },
          { topicId: 't2', heat: 10 },
        ],
      });
    }
  }

  it('end-to-end: hard+floor pool commits no floor-violating group and logs activation with poolId', async () => {
    const users = [
      makeGenderUser('m1', '男性'),
      makeGenderUser('m2', '男性'),
      makeGenderUser('m3', '男性'),
      makeGenderUser('m4', '男性'),
      makeGenderUser('f1', '女性'),
      makeGenderUser('f2', '女性'),
      makeGenderUser('f3', '女性'),
      makeGenderUser('f4', '女性'),
    ];
    mockState.poolRow = {
      id: 'pool-hard',
      title: 'Hard Pool',
      eventType: '饭局',
      city: '深圳',
      dateTime: new Date(),
      createdBy: 'host-1',
      minGroupSize: 4,
      maxGroupSize: 6,
      targetGroups: 2,
      genderBalanceMode: 'hard',
      genderBalanceBonusPoints: 15,
      minFemaleCount: 2,
      minMaleCount: 2,
    };
    seedRegistrations(users);
    const infoSpy = vi.spyOn(logger, 'info');

    const groups = await matchEventPool('pool-hard');

    expect(groups.length).toBeGreaterThanOrEqual(1);
    for (const g of groups) {
      expect(groupSatisfiesGenderFloor(g.members, 2, 2)).toBe(true);
    }
    expect(infoSpy).toHaveBeenCalledWith(
      '[Pool Matching] hard gender-balance mode active',
      expect.objectContaining({ poolId: 'pool-hard', minFemaleCount: 2, minMaleCount: 2 }),
    );
    infoSpy.mockRestore();
  });

  it('end-to-end: impossible floor (5M/1F, minFemaleCount=2) yields zero committed groups', async () => {
    const users = [
      ...Array.from({ length: 5 }, (_, i) => makeGenderUser(`m${i + 1}`, '男性')),
      makeGenderUser('f1', '女性'),
    ];
    mockState.poolRow = {
      id: 'pool-impossible',
      title: 'Impossible Pool',
      eventType: '饭局',
      city: '深圳',
      dateTime: new Date(),
      createdBy: 'host-1',
      minGroupSize: 4,
      maxGroupSize: 6,
      targetGroups: 1,
      genderBalanceMode: 'hard',
      minFemaleCount: 2,
    };
    seedRegistrations(users);

    const groups = await matchEventPool('pool-impossible');

    // No 4-6 member subset of 5M/1F can reach 2 disclosed females.
    expect(groups).toHaveLength(0);
  });
});

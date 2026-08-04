import { describe, expect, it, vi } from 'vitest';

/**
 * 磁场引擎 惊艳开局包 P2 — switchable weight profile v2
 * (flag: magnetismWeightProfileV2Enabled, env MAGNETISM_WEIGHT_PROFILE_V2_ENABLED).
 *
 * Covers:
 *   1. All four default weight tables sum to 1.00 (v1 regression + v2)
 *   2. Flag OFF → calculateWeightedPairScore output identical to v1
 *   3. Flag ON → hand-computed v2 values, 6D and 7D paths
 *   4. customWeights / strictness overrides still short-circuit (v2 flag inert)
 *   5. pairScoreCache key embeds the `|v2` segment (no cross-profile contamination)
 *
 * Note: isSemanticSimilarityEnabled() resolves from env and is true under
 * vitest — every call below passes enableSemanticSimilarity explicitly.
 */

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
    matchHistoryRows: [] as any[],
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
          if (table === matchHistoryTable) {
            return makeAwaitable(mockState.matchHistoryRows);
          }
          if (table === couponsTable && mockState.throwCouponsSelect) {
            throw new Error('coupon lookup failed');
          }
          return makeAwaitable([]);
        };
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
  LEGACY_PAIR_SCORE_WEIGHTS,
  SEMANTIC_PAIR_SCORE_WEIGHTS,
  LEGACY_PAIR_SCORE_WEIGHTS_V2,
  SEMANTIC_PAIR_SCORE_WEIGHTS_V2,
  calculateWeightedPairScore,
} = await import('../matchingSemantic');
const { calculatePairScore } = await import('../poolMatchingService');
import type { UserWithProfile } from '../poolMatchingService';

// Same dimension set for every pure-function assertion so the expected values
// below are directly hand-checkable against the weight tables.
const DIMENSIONS = {
  chemistry: 80,
  interest: 72,
  socialAffinity: 64,
  backgroundDiversity: 58,
  preference: 70,
  language: 100,
  semanticSimilarity: 90,
};

describe('weight profile tables', () => {
  it('all four default tables (v1 + v2, 6D + 7D) sum to 1.00', () => {
    for (const table of [
      LEGACY_PAIR_SCORE_WEIGHTS,
      SEMANTIC_PAIR_SCORE_WEIGHTS,
      LEGACY_PAIR_SCORE_WEIGHTS_V2,
      SEMANTIC_PAIR_SCORE_WEIGHTS_V2,
    ]) {
      const sum = Object.values(table).reduce((acc, w) => acc + w, 0);
      expect(sum).toBeCloseTo(1, 10);
    }
  });
});

describe('calculateWeightedPairScore with the v2 profile flag', () => {
  it('flag OFF is byte-identical to the v1 default (6D and 7D)', () => {
    // v1 6D: 80*.28 + 72*.28 + 64*.20 + 58*.15 + 70*.05 + 100*.04 = 71.56 → 72
    expect(calculateWeightedPairScore(DIMENSIONS, false)).toBe(72);
    expect(calculateWeightedPairScore(DIMENSIONS, false, undefined, false)).toBe(72);
    // v1 7D: 80*.26 + 72*.26 + 64*.19 + 58*.14 + 70*.05 + 100*.04 + 90*.06 = 72.7 → 73
    expect(calculateWeightedPairScore(DIMENSIONS, true)).toBe(73);
    expect(calculateWeightedPairScore(DIMENSIONS, true, undefined, false)).toBe(73);
  });

  it('flag ON selects the v2 tables (6D path)', () => {
    // v2 6D: 80*.20 + 72*.32 + 64*.23 + 58*.15 + 70*.05 + 100*.05 = 70.96 → 71
    expect(calculateWeightedPairScore(DIMENSIONS, false, undefined, true)).toBe(71);
  });

  it('flag ON selects the v2 tables (7D semantic path)', () => {
    // v2 7D: 80*.19 + 72*.30 + 64*.21 + 58*.14 + 70*.05 + 100*.05 + 90*.06 = 72.26 → 72
    expect(calculateWeightedPairScore(DIMENSIONS, true, undefined, true)).toBe(72);
  });

  it('customWeights short-circuit first and stay pinned to v1 fallbacks regardless of the flag', () => {
    // Partial override (percent scale, long form): chemistry → 0.50; every
    // missing key falls back to the v1 LEGACY values (adaptive weights were
    // tuned against v1) even when the v2 profile is active. RuntimeMatchingWeights
    // types both forms as all-keys-required, so the deliberately-partial object
    // is cast — the runtime `??` fallback under test here is intentional API.
    const partial = { chemistryWeight: 50 } as any;
    // 80*.50 + 72*.28 + 64*.20 + 58*.15 + 70*.05 + 100*.04 = 89.16 → 89
    const expected = 89;
    expect(calculateWeightedPairScore(DIMENSIONS, false, partial, false)).toBe(expected);
    expect(calculateWeightedPairScore(DIMENSIONS, false, partial, true)).toBe(expected);
    // Semantic term stays disabled under customWeights even on the 7D path.
    expect(calculateWeightedPairScore(DIMENSIONS, true, partial, true)).toBe(expected);
  });

  it('strictness-style full overrides (short-form keys) ignore the v2 flag entirely', () => {
    // Match Compass strictness weights reach calculateWeightedPairScore through
    // the same customWeights parameter (resolveStrictnessWeights output), so a
    // full override must be completely unaffected by the profile flag.
    const strictnessStyle = { chemistry: 10, interest: 40, socialAffinity: 30, backgroundDiversity: 10, preference: 5, language: 5 };
    // 80*.10 + 72*.40 + 64*.30 + 58*.10 + 70*.05 + 100*.05 = 70.3 → 70
    const expected = 70;
    expect(calculateWeightedPairScore(DIMENSIONS, false, strictnessStyle, false)).toBe(expected);
    expect(calculateWeightedPairScore(DIMENSIONS, false, strictnessStyle, true)).toBe(expected);
  });
});

// =============================================================================
// pairScoreCache key separation (calculatePairScore level, mocked DB harness)
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

// Empty interests for both users → interest dimension falls back to the
// neutral 70; no DB access needed.
const emptyInterestsCache = new Map([
  ['a', { topics: [], heatMap: {} }],
  ['b', { topics: [], heatMap: {} }],
]) as any;

describe('pairScoreCache key embeds the weight profile segment', () => {
  it('v1 and v2 runs sharing one cache map compute and store independently', async () => {
    const a = makeGenderUser('a', '女性');
    const b = makeGenderUser('b', '男性');
    const cache = new Map<string, number>();

    const v1 = await calculatePairScore(
      a, b, emptyInterestsCache, cache, undefined, false, undefined, undefined, undefined, false, false,
    );
    const v2 = await calculatePairScore(
      a, b, emptyInterestsCache, cache, undefined, false, undefined, undefined, undefined, false, true,
    );

    expect(cache.get('legacy|a|b')).toBe(v1);
    expect(cache.get('legacy|v2|a|b')).toBe(v2);
    expect(cache.size).toBe(2);
  });

  it('a pre-seeded v1 entry is invisible to a v2 run sharing the cache (and vice versa)', async () => {
    const a = makeGenderUser('a', '女性');
    const b = makeGenderUser('b', '男性');
    const cache = new Map<string, number>([['legacy|a|b', 42]]);

    // v2 run must NOT hit the v1 entry — it computes fresh under its own key.
    const v2 = await calculatePairScore(
      a, b, emptyInterestsCache, cache, undefined, false, undefined, undefined, undefined, false, true,
    );
    expect(v2).not.toBe(42);
    expect(cache.get('legacy|a|b')).toBe(42); // v1 entry untouched
    expect(cache.get('legacy|v2|a|b')).toBe(v2);

    // v1 run still hits its own pre-seeded entry.
    const v1 = await calculatePairScore(
      a, b, emptyInterestsCache, cache, undefined, false, undefined, undefined, undefined, false, false,
    );
    expect(v1).toBe(42);
  });

  it('customWeights short-circuit the v2 profile at the calculatePairScore level too', async () => {
    const a = makeGenderUser('a', '女性');
    const b = makeGenderUser('b', '男性');
    const customWeights = {
      chemistryWeight: 28,
      interestWeight: 28,
      socialAffinityWeight: 20,
      backgroundDiversityWeight: 15,
      preferenceWeight: 5,
      languageWeight: 4,
    };

    const flagOff = await calculatePairScore(
      a, b, emptyInterestsCache, undefined, undefined, false, undefined, customWeights, undefined, false, false,
    );
    const flagOn = await calculatePairScore(
      a, b, emptyInterestsCache, undefined, undefined, false, undefined, customWeights, undefined, false, true,
    );

    expect(flagOn).toBe(flagOff);
  });
});

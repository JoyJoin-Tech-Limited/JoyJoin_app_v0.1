/**
 * Dimension-math test lock (Magnetism Engine Phase-0, W4).
 *
 * Locks the CURRENT numeric behavior of each pair-scoring dimension and the
 * group score composition in poolMatchingService.ts. These tests exist so
 * future refactors cannot silently change scores. Do not update expectations
 * unless the scoring change is intentional and reviewed.
 *
 * Mock pattern mirrors poolMatchingService.test.ts: db, archetypeChemistry,
 * archetypeChemistryCalibration, and feature flags are mocked; scoring math
 * under test is the real implementation.
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
vi.mock('../archetypeChemistry', () => ({
  chemistryMatrix: { 'koala': { 'koala': 90 } },
  ARCHETYPE_ENERGY: { 'koala': 60 },
}));

// Per-pair calibrated chemistry values so the 70/15/15 blend is sensitive to
// each term. Unlisted pairs (e.g. koala×koala) fall back to 90.
vi.mock('../archetypeChemistryCalibration', () => ({
  getArchetypePairCalibrationMap: vi.fn().mockResolvedValue(new Map()),
  getCalibratedChemistryScore: vi.fn().mockImplementation((a: string, b: string) => {
    const table: Record<string, number> = {
      'corgi|dolphin': 80,
      'corgi|owl': 60,
      'fox|dolphin': 40,
    };
    return table[`${a}|${b}`] ?? 90;
  }),
}));

const {
  calculateInterestScoreAsync,
  calculateLanguageScore,
  calculatePreferenceScore,
  calculateLifeStageAffinity,
  calculateEducationAffinityScore,
  calculateHometownAffinityScore,
  calculateBackgroundDiversityScore,
  calculateChemistryScore,
  calculateEnergyBalance,
  runGreedyPoolMatchingCore,
} = await import('../poolMatchingService');
import type { UserWithProfile, UserInterestsCache } from '../poolMatchingService';

function makeDimUser(id: string, overrides: Partial<UserWithProfile> = {}): UserWithProfile {
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

// =============================================================================
// Interest (calculateInterestScoreAsync): jaccard × 85 + 15 base, heat bonus, caps
// =============================================================================

describe('interest score (heat-weighted Jaccard)', () => {
  it('returns 70 when both users have no interests, 30 when only one does', async () => {
    const bothEmpty = interestsCache({
      a: { topics: [], heatMap: {} },
      b: { topics: [], heatMap: {} },
    });
    expect(await calculateInterestScoreAsync('a', 'b', bothEmpty)).toBe(70);

    const oneEmpty = interestsCache({
      a: { topics: ['t1'], heatMap: { t1: 25 } },
      b: { topics: [], heatMap: {} },
    });
    expect(await calculateInterestScoreAsync('a', 'b', oneEmpty)).toBe(30);
  });

  it('locks base = round(jaccard × 85 + 15) plus +15 when both heats are 25', async () => {
    // common={t1}, union={t1,t2,t3} → base round(1/3 × 85 + 15) = 43; heat +15 → 58
    const cache = interestsCache({
      a: { topics: ['t1', 't2'], heatMap: { t1: 25, t2: 25 } },
      b: { topics: ['t1', 't3'], heatMap: { t1: 25, t3: 25 } },
    });
    expect(await calculateInterestScoreAsync('a', 'b', cache)).toBe(58);
  });

  it('locks +10 for 25↔10 heat overlap', async () => {
    // common={t1}, union={t1,t2} → base round(1/2 × 85 + 15) = 58; heat +10 → 68
    const cache = interestsCache({
      a: { topics: ['t1', 't2'], heatMap: { t1: 25, t2: 25 } },
      b: { topics: ['t1'], heatMap: { t1: 10 } },
    });
    expect(await calculateInterestScoreAsync('a', 'b', cache)).toBe(68);
  });

  it('locks +8 when both heats are 10', async () => {
    // base 58; heat +8 → 66
    const cache = interestsCache({
      a: { topics: ['t1', 't2'], heatMap: { t1: 10, t2: 25 } },
      b: { topics: ['t1'], heatMap: { t1: 10 } },
    });
    expect(await calculateInterestScoreAsync('a', 'b', cache)).toBe(66);
  });

  it('locks +3 for other positive-heat overlaps (e.g. level 1 ↔ level 2)', async () => {
    // base 58; heat +3 → 61
    const cache = interestsCache({
      a: { topics: ['t1', 't2'], heatMap: { t1: 3, t2: 25 } },
      b: { topics: ['t1'], heatMap: { t1: 10 } },
    });
    expect(await calculateInterestScoreAsync('a', 'b', cache)).toBe(61);
  });

  it('caps the heat bonus at +20', async () => {
    // common={t1,t2} both 25/25 → raw bonus 30 → capped 20; base 58 → 78
    const cache = interestsCache({
      a: { topics: ['t1', 't2', 't3'], heatMap: { t1: 25, t2: 25, t3: 25 } },
      b: { topics: ['t1', 't2', 't4'], heatMap: { t1: 25, t2: 25, t4: 25 } },
    });
    expect(await calculateInterestScoreAsync('a', 'b', cache)).toBe(78);
  });

  it('caps the total score at 100', async () => {
    // jaccard 1 → base 100; heat +15 would overflow → 100
    const cache = interestsCache({
      a: { topics: ['t1'], heatMap: { t1: 25 } },
      b: { topics: ['t1'], heatMap: { t1: 25 } },
    });
    expect(await calculateInterestScoreAsync('a', 'b', cache)).toBe(100);
  });
});

// =============================================================================
// Language (calculateLanguageScore)
// =============================================================================

describe('language score', () => {
  it('returns 70 when either side has no language data', () => {
    expect(calculateLanguageScore(
      makeDimUser('a', { preferredLanguages: [] }),
      makeDimUser('b', { preferredLanguages: ['中文'] }),
    )).toBe(70);
    expect(calculateLanguageScore(
      makeDimUser('a', { preferredLanguages: null }),
      makeDimUser('b', { preferredLanguages: ['中文'] }),
    )).toBe(70);
  });

  it('returns 100 on any overlap, 30 on none', () => {
    expect(calculateLanguageScore(
      makeDimUser('a', { preferredLanguages: ['中文', 'English'] }),
      makeDimUser('b', { preferredLanguages: ['English'] }),
    )).toBe(100);
    expect(calculateLanguageScore(
      makeDimUser('a', { preferredLanguages: ['中文'] }),
      makeDimUser('b', { preferredLanguages: ['English'] }),
    )).toBe(30);
  });
});

// =============================================================================
// Preference (calculatePreferenceScore)
// =============================================================================

describe('preference score', () => {
  it('returns 70 when no preference factors are present', () => {
    expect(calculatePreferenceScore(makeDimUser('a'), makeDimUser('b'))).toBe(70);
  });

  it('locks intent overlap ratio over max length', () => {
    // overlap 1 / max(2,1) → 50
    expect(calculatePreferenceScore(
      makeDimUser('a', { eventIntent: ['networking', 'fun'] }),
      makeDimUser('b', { eventIntent: ['networking'] }),
    )).toBe(50);
  });

  it("filters 'flexible' out of intent lists", () => {
    // filtered: [networking] vs [networking] → 100
    expect(calculatePreferenceScore(
      makeDimUser('a', { eventIntent: ['flexible', 'networking'] }),
      makeDimUser('b', { eventIntent: ['networking'] }),
    )).toBe(100);
    // flexible-only on both sides → no factor → default 70
    expect(calculatePreferenceScore(
      makeDimUser('a', { eventIntent: ['flexible'] }),
      makeDimUser('b', { eventIntent: ['flexible'] }),
    )).toBe(70);
  });

  it('falls back to userIntent when eventIntent is empty', () => {
    expect(calculatePreferenceScore(
      makeDimUser('a', { eventIntent: [], userIntent: ['networking'] }),
      makeDimUser('b', { eventIntent: null, userIntent: ['networking'] }),
    )).toBe(100);
  });

  it('scores one-sided dietary restrictions as 100', () => {
    expect(calculatePreferenceScore(
      makeDimUser('a', { dietaryRestrictions: ['素食'] }),
      makeDimUser('b', { dietaryRestrictions: null }),
    )).toBe(100);
  });

  it('locks both-sided dietary overlap as shared/union × 100', () => {
    // shared 1 / union 3 → 33
    expect(calculatePreferenceScore(
      makeDimUser('a', { dietaryRestrictions: ['素食', '无麸质'] }),
      makeDimUser('b', { dietaryRestrictions: ['无麸质', '清真'] }),
    )).toBe(33);
  });

  it('averages multiple factors equally', () => {
    // dietary one-sided (100) + intent 50 → round(150/2) = 75
    expect(calculatePreferenceScore(
      makeDimUser('a', { dietaryRestrictions: ['素食'], eventIntent: ['networking', 'fun'] }),
      makeDimUser('b', { dietaryRestrictions: null, eventIntent: ['networking'] }),
    )).toBe(75);
  });

  it('locks 酒局 barThemes / alcoholComfort factors', () => {
    // themes 1/2 → 50, alcohol 1/1 → 100 → avg 75
    expect(calculatePreferenceScore(
      makeDimUser('a', { eventType: '酒局', barThemes: ['hiphop', 'craft'], alcoholComfort: ['微醺'] }),
      makeDimUser('b', { eventType: '酒局', barThemes: ['hiphop'], alcoholComfort: ['微醺'] }),
    )).toBe(75);
    // 酒局 with no bar data and no other factors → default 70
    expect(calculatePreferenceScore(
      makeDimUser('a', { eventType: '酒局' }),
      makeDimUser('b', { eventType: '酒局' }),
    )).toBe(70);
  });
});

// =============================================================================
// Life-stage affinity (calculateLifeStageAffinity, 5×5 matrix + intent modulation)
// =============================================================================

describe('life-stage affinity (5×5 aspiration matrix)', () => {
  it('returns the neutral 50 when either side is missing lifeStage', () => {
    expect(calculateLifeStageAffinity(
      makeDimUser('a', { lifeStage: null }),
      makeDimUser('b', { lifeStage: '学生党' }),
    )).toBe(50);
  });

  it('returns the neutral 50 for unknown lifeStage keys', () => {
    expect(calculateLifeStageAffinity(
      makeDimUser('a', { lifeStage: '未知阶段' }),
      makeDimUser('b', { lifeStage: '学生党' }),
    )).toBe(50);
  });

  it('spot-checks asymmetric matrix cells averaged both directions', () => {
    // 学生党→创业中 85, 创业中→学生党 75 → 80
    expect(calculateLifeStageAffinity(
      makeDimUser('a', { lifeStage: '学生党' }),
      makeDimUser('b', { lifeStage: '创业中' }),
    )).toBe(80);
    // 创业中→职场新人 80, 职场新人→创业中 85 → round(82.5) = 83
    expect(calculateLifeStageAffinity(
      makeDimUser('a', { lifeStage: '创业中' }),
      makeDimUser('b', { lifeStage: '职场新人' }),
    )).toBe(83);
    // 职场老手→职场老手 60
    expect(calculateLifeStageAffinity(
      makeDimUser('a', { lifeStage: '职场老手' }),
      makeDimUser('b', { lifeStage: '职场老手' }),
    )).toBe(60);
    // 自由职业→自由职业 70
    expect(calculateLifeStageAffinity(
      makeDimUser('a', { lifeStage: '自由职业' }),
      makeDimUser('b', { lifeStage: '自由职业' }),
    )).toBe(70);
  });

  it('applies the networking ×1.2 boost per side', () => {
    // 学生党×学生党 base 70; one-sided networking: (70×1.2 + 70)/2 = 77
    expect(calculateLifeStageAffinity(
      makeDimUser('a', { lifeStage: '学生党', eventIntent: ['networking'] }),
      makeDimUser('b', { lifeStage: '学生党' }),
    )).toBe(77);
  });

  it('applies the fun ×0.7 dampen per side', () => {
    // 学生党×学生党 base 70; one-sided fun: (70×0.7 + 70)/2 = 59.5 → 60
    expect(calculateLifeStageAffinity(
      makeDimUser('a', { lifeStage: '学生党', eventIntent: ['fun'] }),
      makeDimUser('b', { lifeStage: '学生党' }),
    )).toBe(60);
  });

  it('caps each direction at 100', () => {
    // 创业中×创业中 base 85; both networking: min(85×1.2,100)=100 each → 100
    expect(calculateLifeStageAffinity(
      makeDimUser('a', { lifeStage: '创业中', eventIntent: ['networking'] }),
      makeDimUser('b', { lifeStage: '创业中', eventIntent: ['networking'] }),
    )).toBe(100);
    // one-sided networking: (100 + 85)/2 = 92.5 → 93
    expect(calculateLifeStageAffinity(
      makeDimUser('a', { lifeStage: '创业中', eventIntent: ['networking'] }),
      makeDimUser('b', { lifeStage: '创业中' }),
    )).toBe(93);
  });
});

// =============================================================================
// Education affinity (calculateEducationAffinityScore, piecewise ordinal)
// =============================================================================

describe('education affinity (piecewise ordinal)', () => {
  it('locks distance 0/1/2/≥3 → 100/75/50/25', () => {
    expect(calculateEducationAffinityScore('本科', '本科')).toBe(100);
    // 中专 and 大专 share ordinal 1 → distance 0
    expect(calculateEducationAffinityScore('中专', '大专')).toBe(100);
    expect(calculateEducationAffinityScore('本科', '硕士')).toBe(75);
    expect(calculateEducationAffinityScore('大专', '本科')).toBe(75);
    expect(calculateEducationAffinityScore('高中及以下', '本科')).toBe(50);
    expect(calculateEducationAffinityScore('本科', '博士')).toBe(50);
    expect(calculateEducationAffinityScore('高中及以下', '硕士')).toBe(25);
    expect(calculateEducationAffinityScore('高中及以下', '博士')).toBe(25);
  });

  it('returns the neutral 50 for unknown levels', () => {
    expect(calculateEducationAffinityScore('未知学历', '本科')).toBe(50);
    expect(calculateEducationAffinityScore('未知学历', '未知学历')).toBe(50);
  });
});

// =============================================================================
// Hometown affinity (calculateHometownAffinityScore, both-opt-in gated)
// =============================================================================

describe('hometown affinity', () => {
  it('requires both users to opt in', () => {
    expect(calculateHometownAffinityScore(
      makeDimUser('a', { hometownAffinityOptin: true, hometown: '广东深圳' }),
      makeDimUser('b', { hometownAffinityOptin: false, hometown: '广东深圳' }),
    )).toBe(0);
  });

  it('returns 0 when hometown data is missing despite opt-in', () => {
    expect(calculateHometownAffinityScore(
      makeDimUser('a', { hometownAffinityOptin: true, hometown: null }),
      makeDimUser('b', { hometownAffinityOptin: true, hometown: '广东深圳' }),
    )).toBe(0);
  });

  it('locks same city = 100, same province = 70, different = 0', () => {
    const shenzhen = makeDimUser('a', { hometownAffinityOptin: true, hometown: '广东深圳' });
    expect(calculateHometownAffinityScore(
      shenzhen,
      makeDimUser('b', { hometownAffinityOptin: true, hometown: '广东深圳' }),
    )).toBe(100);
    expect(calculateHometownAffinityScore(
      shenzhen,
      makeDimUser('b', { hometownAffinityOptin: true, hometown: '广东广州' }),
    )).toBe(70);
    expect(calculateHometownAffinityScore(
      shenzhen,
      makeDimUser('b', { hometownAffinityOptin: true, hometown: '湖南长沙' }),
    )).toBe(0);
  });

  it('treats direct-administered cities as their own province', () => {
    expect(calculateHometownAffinityScore(
      makeDimUser('a', { hometownAffinityOptin: true, hometown: '北京' }),
      makeDimUser('b', { hometownAffinityOptin: true, hometown: '北京市朝阳区' }),
    )).toBe(70);
  });
});

// =============================================================================
// Background diversity (calculateBackgroundDiversityScore)
// =============================================================================

describe('background diversity', () => {
  it('locks different = 70 / same = 30 per present factor', () => {
    expect(calculateBackgroundDiversityScore(
      makeDimUser('a', { industryNiche: 'tech', gender: '男性' }),
      makeDimUser('b', { industryNiche: 'finance', gender: '女性' }),
    )).toBe(70);
    expect(calculateBackgroundDiversityScore(
      makeDimUser('a', { industryNiche: 'tech', gender: '男性' }),
      makeDimUser('b', { industryNiche: 'tech', gender: '男性' }),
    )).toBe(30);
    // mixed: industry same (30) + gender different (70) → 50
    expect(calculateBackgroundDiversityScore(
      makeDimUser('a', { industryNiche: 'tech', gender: '男性' }),
      makeDimUser('b', { industryNiche: 'tech', gender: '女性' }),
    )).toBe(50);
    // only industry present, different → 70
    expect(calculateBackgroundDiversityScore(
      makeDimUser('a', { industryNiche: 'tech', gender: null }),
      makeDimUser('b', { industryNiche: 'finance', gender: null }),
    )).toBe(70);
  });

  it('returns the neutral 50 when no factors are present', () => {
    expect(calculateBackgroundDiversityScore(
      makeDimUser('a', { industryNiche: null, gender: null }),
      makeDimUser('b', { industryNiche: null, gender: null }),
    )).toBe(50);
  });
});

// =============================================================================
// Chemistry (calculateChemistryScore) — archetype-only after W5 vibeVector removal
// =============================================================================

describe('chemistry score (archetype 70/15/15 blend)', () => {
  it('locks the primary 70% + secondary cross 15%×2 blend', () => {
    // 80×0.7 + 60×0.15 + 40×0.15 = 56 + 9 + 6 = 71
    const score = calculateChemistryScore(
      makeDimUser('a', { archetype: 'corgi', secondaryArchetype: 'fox' }),
      makeDimUser('b', { archetype: 'dolphin', secondaryArchetype: 'owl' }),
    );
    expect(score).toBe(71);
  });

  it('ignores vibeVector data entirely (dead branch removed in W5)', () => {
    const plain = calculateChemistryScore(
      makeDimUser('a', { archetype: 'corgi', secondaryArchetype: 'fox' }),
      makeDimUser('b', { archetype: 'dolphin', secondaryArchetype: 'owl' }),
    );
    const withVibe = calculateChemistryScore(
      makeDimUser('a', { archetype: 'corgi', secondaryArchetype: 'fox' }),
      makeDimUser('b', { archetype: 'dolphin', secondaryArchetype: 'owl' }),
    );
    const a = makeDimUser('a', { archetype: 'corgi', secondaryArchetype: 'fox' });
    const b = makeDimUser('b', { archetype: 'dolphin', secondaryArchetype: 'owl' });
    // Simulate legacy bot-written rows: even if vibeVector data is present at
    // runtime, the score must be identical to the archetype-only blend.
    (a as any).vibeVector = { energy: 0.9, depth: 0.9, play: 0.9, structure: 0.9 };
    (b as any).vibeVector = { energy: 0.9, depth: 0.9, play: 0.9, structure: 0.9 };
    expect(calculateChemistryScore(a, b)).toBe(plain);
    expect(plain).toBe(withVibe);
  });
});

// =============================================================================
// Group score composition: overall = avgPair×0.6 + diversity×0.25 + energy×0.15
// =============================================================================

describe('group score composition', () => {
  it('locks calculateEnergyBalance: mid-band uniform energy → 100, <2 members → 50', () => {
    // ARCHETYPE_ENERGY mock: koala = 60 → mean 60 (in 50–70 band → 100), stdDev 0 → harmony 100
    const members = ['a', 'b', 'c', 'd'].map((id) => makeDimUser(id));
    expect(calculateEnergyBalance(members)).toBe(100);
    expect(calculateEnergyBalance([makeDimUser('a')])).toBe(50);
  });

  it('locks overallScore = round(avgPair×0.6 + diversity×0.25 + energyBalance×0.15)', async () => {
    const users = ['d1', 'd2', 'd3', 'd4'].map((id) => makeDimUser(id));

    // Uniform pair scores of 90, seeded under the legacy cache key so the
    // greedy core is fully deterministic.
    const pairScoreCache = new Map<string, number>();
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        pairScoreCache.set(`legacy|${users[i].userId}|${users[j].userId}`, 90);
      }
    }

    const groups = await runGreedyPoolMatchingCore(
      users,
      { minGroupSize: 4, maxGroupSize: 4, targetGroups: 1, genderBalanceMode: 'none' },
      new Map(),
      pairScoreCache,
      undefined,
      false,
      undefined,
      [],
    );

    expect(groups).toHaveLength(1);
    const group = groups[0];
    expect(group.avgPairScore).toBe(90);
    // All members share industry/gender/archetype/lifeStage → 4×(1/4 × 25) = 25
    expect(group.diversityScore).toBe(25);
    expect(group.communicationBalance).toBe(100);
    // round(90×0.6 + 25×0.25 + 100×0.15) = round(75.25) = 75
    expect(group.overallScore).toBe(75);
    expect(group.temperatureLevel).toBe('warm');
  });
});

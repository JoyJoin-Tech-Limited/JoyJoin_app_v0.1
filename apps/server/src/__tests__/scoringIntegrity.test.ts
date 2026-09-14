/**
 * W6 (gm-debrief) — Scoring integrity red-repro + golden lock.
 *
 * Contract: `.git/.orchestration/sprints/sprint-contract.gm-debrief-w6.md`
 *
 * This file holds the AC-W6.1 red repros (P-7/P-7b/P-7c/P-7d) plus the golden
 * locks for the fixes. The repros are written against the PUBLIC pre-fix API
 * (calculateEnergyBalance / calculatePairScore / calculateInterestScoreAsync /
 * calculateChemistryScore) so they fail on the un-fixed code; the new named
 * helpers (composeEnergyBalance, aggregateMatchHistorySignals, …) are accessed
 * through the namespace object so the rest of the file still runs pre-fix.
 *
 * Mock pattern mirrors poolMatchingService.test.ts: db, chemistry, and feature
 * flags are mocked; the scoring math under test is the real implementation.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

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
  blindBoxEventsTable,
  assessmentSessionsTable,
  loggerWarn,
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
  blindBoxEventsTable: Symbol('blindBoxEvents'),
  assessmentSessionsTable: Symbol('assessmentSessions'),
  loggerWarn: vi.fn(),
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
  blindBoxEvents: blindBoxEventsTable,
  assessmentSessions: assessmentSessionsTable,
}));

vi.mock('drizzle-orm', () => ({
  eq: (_field: unknown, value: unknown) => ({ type: 'eq', value }),
  and: (...conditions: unknown[]) => ({ type: 'and', conditions }),
  inArray: (_field: unknown, values: unknown[]) => ({ type: 'inArray', values }),
  isNull: (field: unknown) => ({ type: 'isNull', field }),
  desc: (field: unknown) => ({ type: 'desc', field }),
  sql: () => ({}),
}));

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: () => {
        const runWhere = () => Promise.resolve([]);
        const joinable: any = { where: runWhere, orderBy: runWhere };
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
    query: { eventPools: { findFirst: () => Promise.resolve(null) } },
    transaction: vi.fn(),
  },
}));

vi.mock('../wsService', () => ({ wsService: { broadcastToUser: vi.fn() } }));
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
vi.mock('../eventThemeGeneratorService', () => ({ generateAndSaveEventTheme: vi.fn() }));
vi.mock('../services/eventThemeTitleGenerator', () => ({
  generateEventThemeTitle: vi.fn().mockResolvedValue({
    eventThemeTitle: null,
    themeTagline: null,
    emoji: null,
    reasoning: null,
  }),
}));
vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: loggerWarn, error: vi.fn(), debug: vi.fn() },
}));

// Real ARCHETYPE_ENERGY values (so the golden energy tables are the production
// archetypes), minimal chemistry matrix + calibrated lookup.
vi.mock('../archetypeChemistry', () => ({
  chemistryMatrix: { koala: { koala: 90 } },
  ARCHETYPE_ENERGY: {
    corgi: 95,
    rooster: 90,
    hamster_praise: 85,
    fox: 82,
    dolphin_calm: 75,
    spider: 72,
    koala: 70,
    octopus: 68,
    owl: 55,
    elephant: 52,
    turtle: 38,
    cat: 30,
  },
}));
vi.mock('../archetypeChemistryCalibration', () => ({
  getArchetypePairCalibrationMap: vi.fn().mockResolvedValue(new Map()),
  refreshArchetypePairCalibrationMap: vi.fn().mockResolvedValue(new Map()),
  getCalibratedChemistryScore: vi.fn().mockImplementation((a: string, b: string) => {
    // Explicit unknown-handling fallback — mirrors the production matrix's 50.
    if (a === 'ghost' || b === 'ghost') return 50;
    return 90;
  }),
}));

const poolMatching = await import('../poolMatchingService');
const {
  calculateInterestScoreAsync,
  calculatePairScore,
  calculateChemistryScore,
  calculateEnergyBalance,
} = poolMatching;
const { calculateWeightedPairScore } = await import('../matchingSemantic');
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

function interestCache(
  entries: Record<string, { topics: string[]; heatMap: Record<string, number> }>,
): UserInterestsCache {
  return new Map(Object.entries(entries));
}

// =============================================================================
// P-7 — energy metric must rank a lively table above a bland all-mid table
// =============================================================================

describe('P-7 / AC-W6.2 energy composition gate', () => {
  // Real production archetype energies:
  //   lively = corgi(95) rooster(90) elephant(52) turtle(38)
  //   bland  = dolphin_calm(75) spider(72) koala(70) octopus(68)
  const lively = ['corgi', 'rooster', 'elephant', 'turtle'].map((a, i) =>
    makeUser(`l${i}`, { archetype: a }),
  );
  const bland = ['dolphin_calm', 'spider', 'koala', 'octopus'].map((a, i) =>
    makeUser(`b${i}`, { archetype: a }),
  );

  it('ranks [95,90,52,38] ABOVE [75,72,70,68] (pre-fix: 95 < 99)', () => {
    const livelyScore = calculateEnergyBalance(lively);
    const blandScore = calculateEnergyBalance(bland);
    expect(livelyScore).toBeGreaterThan(blandScore);
  });

  it('does not reward a dead all-introvert table (pre-fix: ≥94)', () => {
    const allIntrovert = ['turtle', 'cat', 'owl', 'elephant'].map((a, i) =>
      makeUser(`i${i}`, { archetype: a }),
    );
    expect(calculateEnergyBalance(allIntrovert)).toBeLessThan(70);
  });

  it('composeEnergyBalance golden table (W6.2 named metric)', () => {
    const compose = (poolMatching as any).composeEnergyBalance as
      | ((levels: number[]) => number)
      | undefined;
    expect(typeof compose).toBe('function');
    expect(compose!([95, 90, 52, 38])).toBeGreaterThan(compose!([75, 72, 70, 68]));
  });
});

// =============================================================================
// P-7b — missing data must not beat declared data; no Jaccard broad-user penalty
// =============================================================================

describe('P-7b / AC-W6.3 + AC-W6.4 interest + renormalization', () => {
  it('does not punish a broad-interest user who shares a niche topic (overlap coefficient)', async () => {
    const cache = interestCache({
      broad: { topics: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10'], heatMap: { t1: 25 } },
      niche: { topics: ['t1'], heatMap: { t1: 25 } },
    });
    // Pre-fix Jaccard = 1/10 → 39; overlap coefficient = 1/1 → 100.
    expect(await calculateInterestScoreAsync('broad', 'niche', cache)).toBeGreaterThanOrEqual(85);
  });

  it('drops an absent dimension from the denominator, not a neutral value', () => {
    const dims = {
      chemistry: 80,
      interest: 0,
      socialAffinity: 80,
      backgroundDiversity: 80,
      preference: 80,
      language: 80,
    };
    const legacy = calculateWeightedPairScore(dims, false, undefined, false);
    const renormalized = calculateWeightedPairScore(dims, false, undefined, false, {
      interest: false,
    } as any);
    expect(renormalized).toBe(80);
    expect(renormalized).toBeGreaterThan(legacy);
  });

  it('declared (broad, shared-topic) pair outranks blank-profile pair', async () => {
    const cache = interestCache({
      a: { topics: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10'], heatMap: { t1: 25 } },
      b: { topics: ['t1'], heatMap: { t1: 25 } },
      blank1: { topics: [], heatMap: {} },
      blank2: { topics: [], heatMap: {} },
    });
    const declared = await calculatePairScore(
      makeUser('a'),
      makeUser('b'),
      cache,
    );
    const blank = await calculatePairScore(
      makeUser('blank1'),
      makeUser('blank2'),
      cache,
    );
    expect(declared).toBeGreaterThan(blank);
  });
});

// =============================================================================
// P-7c — unknown archetype must not silently masquerade as koala; no debug spam
// =============================================================================

describe('P-7c / AC-W6.5 unknown archetype', () => {
  it('scores an unknown/absent archetype as the explicit neutral, not koala', () => {
    const score = calculateChemistryScore(
      makeUser('a', { archetype: null, secondaryArchetype: null }),
      makeUser('b', { archetype: null, secondaryArchetype: null }),
    );
    // Pre-fix: koala × koala = 90. Post-fix: neutral 50.
    expect(score).toBe(50);
  });

  it('no longer emits [ChemistryDebug] for a defaulted (50) chemistry term', () => {
    loggerWarn.mockClear();
    calculateChemistryScore(
      makeUser('a', { archetype: 'ghost', secondaryArchetype: 'ghost' }),
      makeUser('b', { archetype: 'ghost', secondaryArchetype: 'ghost' }),
    );
    expect(loggerWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('[ChemistryDebug]'),
    );
  });

  it('the production read path leaves archetype nullable (no SQL koala coalesce)', () => {
    const source = readFileSync(
      new URL('../matching/matchRun.ts', import.meta.url),
      'utf8',
    );
    const archetypeSelect = source
      .split('\n')
      .find((line) => line.includes('coalesce(${users.primaryArchetype}'));
    expect(archetypeSelect).toBeDefined();
    // AC-W6.5 end-to-end: the eligible-user query must NOT fabricate a koala, or
    // resolveChemistryArchetype never sees null and the neutral path + log are
    // unreachable in production. It must be explicitly nullable.
    expect(archetypeSelect).not.toContain("'koala'");
    expect(archetypeSelect).toContain('sql<string | null>');
  });
});

// =============================================================================
// P-7d — match-history lookup must be deterministic with >1 row per pair
// =============================================================================

describe('P-7d / AC-W6.6a deterministic match-history', () => {
  it('aggregates multiple rows per pair deterministically (row-order independent)', async () => {
    const mod = await import('../services/matchHistoryDerivation');
    const aggregate = (mod as any).aggregateMatchHistorySignals as
      | ((rows: any[], now: Date) => Map<string, any>)
      | undefined;
    expect(typeof aggregate).toBe('function');

    const now = new Date('2026-09-12T00:00:00Z');
    const rows = [
      { user1Id: 'a', user2Id: 'b', wouldMeetAgain: true, matchedAt: new Date('2026-01-01T00:00:00Z') },
      { user1Id: 'b', user2Id: 'a', wouldMeetAgain: false, matchedAt: new Date('2026-06-01T00:00:00Z') },
    ];
    const forward = aggregate!(rows, now);
    const reversed = aggregate!([...rows].reverse(), now);
    expect(forward.get('a|b')).toEqual(reversed.get('a|b'));
    expect(forward.get('a|b')?.wouldMeetAgain).toBe(false); // newest meeting wins
    expect(forward.get('a|b')?.negativeCount).toBe(1);
  });

  it('the preload query carries a deterministic ORDER BY (AC-W6.6a)', () => {
    const source = readFileSync(
      new URL('../matching/matchRun.ts', import.meta.url),
      'utf8',
    );
    expect(source).toMatch(/from\(matchHistory\)[\s\S]{0,500}orderBy\(/);
  });
});

// =============================================================================
// AC-W6.6b — named negative policy (two-strike, OD-2)
// =============================================================================

describe('AC-W6.6b two-strike negative policy', () => {
  it('does not hard-skip on 0/1 negative; hard-skips on 2 in-window negatives', async () => {
    const mod = await import('../services/matchHistoryDerivation');
    const should = (mod as any).shouldHardSkipPair as
      | ((signal: any) => boolean)
      | undefined;
    expect(typeof should).toBe('function');
    expect(should!(undefined)).toBe(false);
    expect(should!({ negativeCount: 0 })).toBe(false);
    expect(should!({ negativeCount: 1 })).toBe(false);
    expect(should!({ negativeCount: 2 })).toBe(true);
    expect(should!({ negativeCount: 5 })).toBe(true);
  });

  it('expires negatives outside the window (180d) during aggregation', async () => {
    const mod = await import('../services/matchHistoryDerivation');
    const aggregate = (mod as any).aggregateMatchHistorySignals as
      | ((rows: any[], now: Date) => Map<string, any>)
      | undefined;
    const now = new Date('2026-09-12T00:00:00Z');
    const oldNegative = { user1Id: 'a', user2Id: 'b', wouldMeetAgain: false, matchedAt: new Date('2025-01-01T00:00:00Z') };
    const freshNegative = { user1Id: 'a', user2Id: 'b', wouldMeetAgain: false, matchedAt: new Date('2026-08-01T00:00:00Z') };
    expect(aggregate!([oldNegative], now).get('a|b')?.negativeCount).toBe(0);
    expect(aggregate!([oldNegative, freshNegative], now).get('a|b')?.negativeCount).toBe(1);
  });
});

// =============================================================================
// AC-W6.6c — anti-clique novelty constraint for returning users
// =============================================================================

describe('AC-W6.6c anti-clique novelty rule', () => {
  it('caps repeat-likes per group (the +5 bonus cannot pair them unopposed)', async () => {
    const mod = await import('../services/matchHistoryDerivation');
    const rule = (mod as any).groupSatisfiesRematchNoveltyRule as
      | ((ids: string[], lookup: Map<string, any> | undefined) => boolean)
      | undefined;
    expect(typeof rule).toBe('function');

    const lookup = new Map<string, any>([
      ['a|b', { wouldMeetAgain: true, negativeCount: 0, latestNegativeAt: null }],
      ['a|c', { wouldMeetAgain: true, negativeCount: 0, latestNegativeAt: null }],
      ['b|c', { wouldMeetAgain: true, negativeCount: 0, latestNegativeAt: null }],
    ]);
    expect(rule!(['a', 'b'], lookup)).toBe(true); // 1 repeat ≤ cap
    expect(rule!(['a', 'b', 'c'], lookup)).toBe(false); // 3 repeats > cap
    expect(rule!(['a', 'b', 'c'], undefined)).toBe(true); // inert without lookup
  });
});

// =============================================================================
// W6-F (gm-debrief follow-up) — bounded X-variance dispersion nudge
// =============================================================================

describe('W6-F bounded X-variance dispersion nudge', () => {
  const {
    traitXVariance,
    adjustScoreForXVarianceDispersion,
    XVAR_DISPERSION_MAX_PENALTY,
    XVAR_DISPERSION_MAX_BONUS,
  } = poolMatching;

  /** A member with a complete ACOEXP vector whose only varying trait is X. */
  function withX(id: string, x: number): UserWithProfile {
    return makeUser(id, { traitScores: { A: 50, C: 50, E: 50, O: 50, X: x, P: 50 } });
  }

  it('computes population variance deterministically', () => {
    expect(traitXVariance([])).toBe(0);
    expect(traitXVariance([42])).toBe(0);
    expect(traitXVariance([0, 10])).toBe(25);
    expect(traitXVariance([0, 0, 20, 20])).toBe(100);
  });

  it('is cold-start safe: unchanged when any involved member lacks a complete vector', () => {
    const group = [withX('a', 40), withX('b', 50)];
    expect(adjustScoreForXVarianceDispersion(makeUser('c'), null, group, 77)).toBe(77);
    const groupWithCold = [withX('a', 40), makeUser('b')];
    expect(adjustScoreForXVarianceDispersion(withX('c', 90), null, groupWithCold, 77)).toBe(77);
  });

  it('penalises an admission that pushes X variance over target, bounded to the cap', () => {
    const group = [withX('a', 40), withX('b', 50)];
    const adjusted = adjustScoreForXVarianceDispersion(withX('c', 90), null, group, 80);
    expect(adjusted).toBeLessThan(80);
    expect(80 - adjusted).toBeLessThanOrEqual(XVAR_DISPERSION_MAX_PENALTY);
  });

  it('leaves a sub-target admission untouched (not a blanket X-clone rule)', () => {
    const group = [withX('a', 45), withX('b', 50)];
    expect(adjustScoreForXVarianceDispersion(withX('c', 55), null, group, 80)).toBe(80);
  });

  it('monotonic: a farther-X candidate ranks no higher than a central one', () => {
    const group = [withX('a', 40), withX('b', 50)];
    const central = adjustScoreForXVarianceDispersion(withX('c', 45), null, group, 80);
    const far = adjustScoreForXVarianceDispersion(withX('d', 95), null, group, 80);
    expect(far).toBeLessThanOrEqual(central);
  });

  it('counts a duo unit as both members (the unit is never split)', () => {
    const group = [withX('a', 40), withX('b', 50)];
    const solo = adjustScoreForXVarianceDispersion(withX('c', 90), null, group, 80);
    const duo = adjustScoreForXVarianceDispersion(withX('c', 90), withX('d', 88), group, 80);
    expect(duo).toBeLessThanOrEqual(solo);
  });

  it('bounds total adjustment so it can never dominate the pair score', () => {
    const group = [withX('a', 15), withX('b', 45), withX('c', 50), withX('d', 55), withX('e', 85)];
    const adjusted = adjustScoreForXVarianceDispersion(withX('f', 50), null, group, 80);
    expect(Math.abs(adjusted - 80)).toBeLessThanOrEqual(
      Math.max(XVAR_DISPERSION_MAX_PENALTY, XVAR_DISPERSION_MAX_BONUS),
    );
  });

  it('is wired behind the MATCH_X_VARIANCE_DISPERSION_ENABLED kill switch (source lock)', () => {
    const source = [
      readFileSync(new URL('../matching/matchRun.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('../matching/poolFormation.ts', import.meta.url), 'utf8'),
    ].join('\n');
    expect(source).toContain('MATCH_X_VARIANCE_DISPERSION_ENABLED');
    expect(source).toMatch(
      /if \(xVarianceDispersionEnabled\) \{\s*rankingScore = adjustScoreForXVarianceDispersion/,
    );
  });
});

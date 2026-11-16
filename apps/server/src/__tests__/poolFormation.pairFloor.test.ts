/**
 * D3 pair-floor curve — formation-core tests.
 *
 * The per-person admission gate (`minPairScore`, 52/60/70 by strictness) and R1
 * (`MAGNETISM_STRONG_TIE_THRESHOLD = 60`) are time-flat, so near the event the
 * admission gate is ~13 points stricter than the group gate that judges the
 * table. `runGreedyPoolMatchingCore` now accepts the resolved `pairFloor` as a
 * trailing number and both sites read it.
 *
 * Locked here:
 *   - legacy (param omitted or explicit `null`) keeps today's behavior and marks
 *     groups `legacy`
 *   - a 45–51-average pool is rejected by legacy and admitted at `pairFloor: 45`
 *   - R1 (commit gate + table-viability backstop) follows the SAME number: an
 *     all-47 pool commits at 45 only because R1 also reads 45 (it would be
 *     rejected at the legacy 60)
 *   - the resolved floor is what `pairFloorPolicy` records (`curve_v1`)
 *   - duo atomic units still hold at the reduced floor
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoggerWarn = vi.fn();
vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  },
}));

vi.mock('../archetypeChemistry', () => ({
  chemistryMatrix: {
    corgi: { corgi: 90, koala: 50 },
    koala: { corgi: 50, koala: 90 },
  },
  ARCHETYPE_ENERGY: {
    corgi: 95,
    koala: 70,
  },
}));

vi.mock('../archetypeChemistryCalibration', () => ({
  getArchetypePairCalibrationMap: vi.fn().mockResolvedValue(new Map()),
  getCalibratedChemistryScore: vi.fn().mockReturnValue(90),
}));

vi.mock('../matchingSemantic', () => ({
  isSemanticSimilarityEnabled: vi.fn().mockReturnValue(false),
  calculateSemanticSimilarityScore: vi.fn().mockReturnValue(50),
}));

const { runGreedyPoolMatchingCore } = await import('../poolMatchingService');
import type { UserWithProfile } from '../poolMatchingService';

function makeUser(id: string, archetype = 'corgi'): UserWithProfile {
  return {
    userId: id,
    registrationId: `reg-${id}`,
    gender: 'male',
    birthdate: '1995-01-01',
    industryNiche: 'tech',
    industryNicheLabel: '科技',
    industryCategoryLabel: '互联网',
    educationLevel: '本科',
    archetype,
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
  };
}

/** Pre-populate the pair-score cache; keys use sorted ids like the service. */
function buildPairScoreCache(
  userIds: string[],
  scoreFor: (a: string, b: string) => number,
): Map<string, number> {
  const cache = new Map<string, number>();
  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      const [a, b] = [userIds[i], userIds[j]].sort();
      cache.set(`legacy|${a}|${b}`, scoreFor(userIds[i], userIds[j]));
    }
  }
  return cache;
}

const SIX_IDS = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
const ONE_TABLE = { minGroupSize: 6, maxGroupSize: 6, targetGroups: 1 };

type CoreOptions = {
  pairFloor?: number | null;
  tableViabilityFloorEnabled?: boolean;
  magnetismGroupRulesEnabled?: boolean;
  duoPairs?: Array<{ inviterId: string; inviteeId: string }>;
  strictness?: number;
};

/**
 * Calls the core with every gate pinned off except the ones a case opts into,
 * so a failure can only come from the pair-floor wiring under test.
 */
async function runCore(
  users: UserWithProfile[],
  cache: Map<string, number>,
  options: CoreOptions = {},
) {
  return runGreedyPoolMatchingCore(
    users,
    ONE_TABLE,
    new Map(), // interests cache (empty → R3 cold-start skip)
    cache,
    undefined, // semantic profile cache
    false, // semanticSimilarityEnabled
    undefined, // chemistry calibration map
    [], // invitation pairs
    undefined, // customWeights
    undefined, // matchHistoryLookup
    options.strictness ?? 50,
    false, // matchNeverMeetSentinelEnabled
    false, // useWeightProfileV2
    options.magnetismGroupRulesEnabled ?? false,
    options.duoPairs ?? [],
    false, // compositionGatesEnabled
    undefined, // compositionGateStats
    false, // derivedChemistryEnabled
    options.tableViabilityFloorEnabled ?? false,
    false, // matchHistoryNoveltyEnabled
    false, // xVarianceDispersionEnabled
    options.pairFloor === undefined ? null : options.pairFloor,
  );
}

describe('runGreedyPoolMatchingCore — D3 pair floor (admission + policy)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a 47-average single-table pool under legacy admission', async () => {
    const users = SIX_IDS.map((id) => makeUser(id));
    const cache = buildPairScoreCache(SIX_IDS, () => 47);

    // Omitted param → null → legacy `minPairScore` (60 at strictness 50).
    const omitted = await runGreedyPoolMatchingCore(
      users,
      ONE_TABLE,
      new Map(),
      cache,
      undefined,
      false,
      undefined,
      [],
      undefined,
      undefined,
      50,
    );
    expect(omitted).toEqual([]);

    // Explicit null is the "flag off" signal and must not be re-resolved.
    expect(await runCore(users, cache, { pairFloor: null })).toEqual([]);
  });

  it('admits the same pool at pairFloor 45 near the event', async () => {
    const users = SIX_IDS.map((id) => makeUser(id));
    const cache = buildPairScoreCache(SIX_IDS, () => 47);

    const groups = await runCore(users, cache, { pairFloor: 45 });

    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(6);
    expect(groups[0].avgPairScore).toBe(47);
    expect(groups[0].pairFloorPolicy).toBe('curve_v1');
  });

  it('keeps the admission comparison inclusive (>= floor) and records legacy otherwise', async () => {
    const users = SIX_IDS.map((id) => makeUser(id));
    const atFloor = await runCore(users, buildPairScoreCache(SIX_IDS, () => 47), {
      pairFloor: 47,
    });
    expect(atFloor).toHaveLength(1);

    const justBelow = await runCore(users, buildPairScoreCache(SIX_IDS, () => 47), {
      pairFloor: 48,
    });
    expect(justBelow).toEqual([]);
  });

  it('records legacy policy for a table that only qualifies under legacy admission', async () => {
    const users = SIX_IDS.map((id) => makeUser(id));

    // 65-average pool forms under both rulers; without a resolved floor the
    // committed group is attributed to the prospective legacy baseline.
    const legacy = await runCore(users, buildPairScoreCache(SIX_IDS, () => 65));
    expect(legacy).toHaveLength(1);
    expect(legacy[0].avgPairScore).toBe(65);
    expect(legacy[0].pairFloorPolicy).toBe('legacy');
  });
});

describe('runGreedyPoolMatchingCore — D3 pair floor (R1 / table viability)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Every pair scores 47: admission passes at 45, and each member's only ties
   * are 47. R1 therefore passes at 45 and would fail at the legacy 60 — the
   * commit gate, the table-viability backstop, and the pool-level exemption must
   * all read the resolved number, not the constant.
   */
  it('commits an all-47 table at pairFloor 45 with the table-viability floor on', async () => {
    const users = SIX_IDS.map((id) => makeUser(id));
    const cache = buildPairScoreCache(SIX_IDS, () => 47);

    const atFloor = await runCore(users, cache, {
      pairFloor: 45,
      tableViabilityFloorEnabled: true,
    });
    expect(atFloor).toHaveLength(1);
    expect(atFloor[0].members).toHaveLength(6);
    expect(atFloor[0].pairFloorPolicy).toBe('curve_v1');

    // Forcing the legacy 60 rejects the same fixture at the admission gate.
    const atLegacyBar = await runCore(users, buildPairScoreCache(SIX_IDS, () => 47), {
      pairFloor: 60,
      tableViabilityFloorEnabled: true,
    });
    expect(atLegacyBar).toEqual([]);
    // …and so does the flag-off path (no floor → 60).
    expect(
      await runCore(users, buildPairScoreCache(SIX_IDS, () => 47), {
        tableViabilityFloorEnabled: true,
      }),
    ).toEqual([]);
  });

  it('binds the magnetism R1 commit gate to the same number', async () => {
    const users = SIX_IDS.map((id) => makeUser(id));

    const atFloor = await runCore(users, buildPairScoreCache(SIX_IDS, () => 47), {
      pairFloor: 45,
      magnetismGroupRulesEnabled: true,
    });
    expect(atFloor).toHaveLength(1);
    expect(atFloor[0].members).toHaveLength(6);

    const atLegacyBar = await runCore(users, buildPairScoreCache(SIX_IDS, () => 47), {
      pairFloor: 60,
      magnetismGroupRulesEnabled: true,
    });
    expect(atLegacyBar).toEqual([]);
  });

  it('does not resurrect the legacy 60 on the redistribution absorption path', async () => {
    // 8 users, maxGroupSize 7: the seven 70-scoring users fill one table and the
    // eighth (55 against everyone) is stranded. Phase-3 absorption admits it at
    // pairFloor 45 because R1 also reads 45; at the legacy 60 R1 vetoes it.
    const ids = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'b1'];
    const users = ids.map((id) => makeUser(id));
    const cache = buildPairScoreCache(ids, (a, b) => (a === 'b1' || b === 'b1' ? 55 : 70));

    const sevenSeat = { minGroupSize: 6, maxGroupSize: 7, targetGroups: 1 };
    const core = (pairFloor: number | null) =>
      runGreedyPoolMatchingCore(
        users,
        sevenSeat,
        new Map(),
        cache,
        undefined,
        false,
        undefined,
        [],
        undefined,
        undefined,
        50,
        false,
        false,
        false,
        [],
        false,
        undefined,
        false,
        true, // tableViabilityFloorEnabled → redistribution pass runs
        false,
        false,
        pairFloor,
      );

    const withFloor = await core(45);
    expect(withFloor).toHaveLength(1);
    expect(withFloor[0].members).toHaveLength(8);

    const legacy = await core(null);
    expect(legacy).toHaveLength(1);
    expect(legacy[0].members).toHaveLength(7);
  });
});

describe('runGreedyPoolMatchingCore — D3 pair floor (duo atomicity)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps a duo atomic and excluded from group metrics at pairFloor 45', async () => {
    const users = SIX_IDS.map((id) => makeUser(id));
    // Duo-internal pair scores 95; every other pair 47. Including the internal
    // pair would lift avgPairScore to 50 — the exclusion must keep it at 47.
    const cache = buildPairScoreCache(SIX_IDS, (a, b) =>
      [a, b].sort().join('|') === 'u1|u2' ? 95 : 47,
    );

    const groups = await runCore(users, cache, {
      pairFloor: 45,
      duoPairs: [{ inviterId: 'u1', inviteeId: 'u2' }],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(6);
    const memberIds = groups[0].members.map((m) => m.userId);
    expect(memberIds).toContain('u1');
    expect(memberIds).toContain('u2');
    expect(groups[0].avgPairScore).toBe(47);
    expect(groups[0].pairFloorPolicy).toBe('curve_v1');
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });
});

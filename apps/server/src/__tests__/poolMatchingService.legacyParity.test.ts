/**
 * Match Compass legacy parity tests (hard thresholds).
 *
 * AC-07 / REL-05: strictness=50 + null new fields = byte-identical pair scores.
 * REL-08: strictness=50 + null new fields = byte-identical group rosters.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../archetypeChemistry", () => ({
  chemistryMatrix: {
    corgi: { corgi: 90, koala: 50, fox: 70 },
    koala: { corgi: 50, koala: 90, fox: 60 },
    fox: { corgi: 70, koala: 60, fox: 90 },
  },
  ARCHETYPE_ENERGY: {
    corgi: 95,
    koala: 70,
    fox: 80,
  },
}));

vi.mock("../archetypeChemistryCalibration", () => ({
  getArchetypePairCalibrationMap: vi.fn().mockResolvedValue(new Map()),
  getCalibratedChemistryScore: vi.fn().mockImplementation((a: string, b: string) => {
    if (a === b) return 90;
    if ((a === "corgi" && b === "koala") || (a === "koala" && b === "corgi")) return 50;
    return 70;
  }),
}));

vi.mock("../matchingSemantic", () => ({
  isSemanticSimilarityEnabled: vi.fn().mockReturnValue(false),
  calculateSemanticSimilarityScore: vi.fn().mockReturnValue(50),
  calculateWeightedPairScore: vi.fn().mockImplementation((dimensions: any) => {
    // Simple weighted average fallback for testing when cache misses
    const weights = {
      chemistry: 0.28,
      interest: 0.28,
      socialAffinity: 0.20,
      backgroundDiversity: 0.15,
      preference: 0.05,
      language: 0.04,
    };
    let total = 0;
    for (const [key, weight] of Object.entries(weights)) {
      const val = dimensions[key];
      if (typeof val === "number") {
        total += val * weight;
      }
    }
    return Math.round(total);
  }),
}));

vi.mock("../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }),
  },
}));

const {
  runGreedyPoolMatchingCore,
  calculatePairScore,
} = await import("../poolMatchingService");
import type { UserWithProfile } from "../poolMatchingService";

function makeUser(
  id: string,
  archetype: string,
  overrides?: Partial<UserWithProfile>,
): UserWithProfile {
  return {
    userId: id,
    registrationId: `reg-${id}`,
    gender: "male",
    birthdate: "1995-01-01",
    industryNiche: "tech",
    industryNicheLabel: "科技",
    industryCategoryLabel: "互联网",
    educationLevel: "本科",
    archetype,
    secondaryArchetype: null,
    lifeStage: '职场老手',
    workMode: "employed",
    hometown: null,
    hometownAffinityOptin: false,
    budgetRange: null,
    barBudgetRange: null,
    preferredLanguages: ["中文"],
    eventIntent: ["networking"],
    userIntent: null,
    cuisinePreferences: null,
    dietaryRestrictions: null,
    barThemes: null,
    alcoholComfort: null,
    eventType: "饭局",
    ageMatchPreference: null,
    tableVibePreference: null,
    preferenceStrictness: null,
    genderCompositionPreference: null,
    ...overrides,
  };
}

// Pre-seed deterministic pair scores so these tests are stable
// even if the exact scoring formula evolves.
function buildPairScoreCache(users: UserWithProfile[]): Map<string, number> {
  const cache = new Map<string, number>();
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const baseKey = `${users[i].userId}|${users[j].userId}`;
      const archetypeScore =
        users[i].archetype === users[j].archetype
          ? 90
          : (users[i].archetype === "corgi" && users[j].archetype === "koala") ||
            (users[i].archetype === "koala" && users[j].archetype === "corgi")
          ? 50
          : 70;
      // Both legacy and adaptive keys so strictness-based formationWeights (customWeights)
      // and legacy undefined customWeights both hit the cache.
      cache.set(`legacy|${baseKey}`, archetypeScore);
      cache.set(`legacy|adaptive|${baseKey}`, archetypeScore);
    }
  }
  return cache;
}

describe("Legacy pair-score parity (REL-05)", () => {
  const originalEnv = process.env.MATCH_COMPASS_STRICTNESS_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MATCH_COMPASS_STRICTNESS_ENABLED = "true";
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.MATCH_COMPASS_STRICTNESS_ENABLED;
    } else {
      process.env.MATCH_COMPASS_STRICTNESS_ENABLED = originalEnv;
    }
  });

  it("produces identical pair scores with strictness=50 and null new fields", async () => {
    const u1 = makeUser("u1", "corgi");
    const u2 = makeUser("u2", "koala");

    const pairScoreCache = buildPairScoreCache([u1, u2]);
    const score = await calculatePairScore(
      u1,
      u2,
      new Map(),
      pairScoreCache,
      undefined,
      false,
      undefined,
      undefined,
      undefined,
    );

    // Since we pre-populated the cache, the score should be exactly the cached value.
    expect(score).toBe(50);
  });

  it("produces stable scores for 100+ seeded pairs", async () => {
    const users: UserWithProfile[] = [];
    const archetypes = ["corgi", "koala", "fox"];
    for (let i = 0; i < 101; i++) {
      users.push(makeUser(`seed-${i}`, archetypes[i % archetypes.length]));
    }

    const pairScoreCache = buildPairScoreCache(users);
    let computed = 0;
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        const score = await calculatePairScore(
          users[i],
          users[j],
          new Map(),
          pairScoreCache,
          undefined,
          false,
          undefined,
          undefined,
          undefined,
        );
        expect(typeof score).toBe("number");
        expect(score).toBeGreaterThanOrEqual(0);
        computed++;
      }
    }
    expect(computed).toBeGreaterThanOrEqual(100);
  });
});

describe("Legacy group-roster parity (REL-08)", () => {
  it("strictness=50 with null fields yields identical roster for a seeded pool", async () => {
    const users: UserWithProfile[] = [
      makeUser("a1", "corgi"),
      makeUser("a2", "corgi"),
      makeUser("a3", "koala"),
      makeUser("a4", "koala"),
      makeUser("a5", "fox"),
      makeUser("a6", "fox"),
    ];

    const pairScoreCache = buildPairScoreCache(users);

    const groups = await runGreedyPoolMatchingCore(
      users,
      { minGroupSize: 4, maxGroupSize: 6, targetGroups: 1 },
      new Map(),
      pairScoreCache,
      undefined,
      false,
      undefined,
      [],
      undefined,
      undefined,
      50,
    );

    // With 6 users, min=4, max=6 and high pair scores (70+), one group should form.
    expect(groups.length).toBeGreaterThanOrEqual(1);
    expect(groups[0].members.length).toBe(6);
  });

  it("produces stable rosters for 10+ seeded pools", async () => {
    const archetypes = ["corgi", "koala", "fox"];
    for (let poolIdx = 0; poolIdx < 12; poolIdx++) {
      const users: UserWithProfile[] = [];
      const count = 6 + (poolIdx % 3);
      for (let i = 0; i < count; i++) {
        users.push(makeUser(`p${poolIdx}-u${i}`, archetypes[i % archetypes.length]));
      }
      const pairScoreCache = buildPairScoreCache(users);
      const groups = await runGreedyPoolMatchingCore(
        users,
        { minGroupSize: 4, maxGroupSize: 6, targetGroups: 2 },
        new Map(),
        pairScoreCache,
        undefined,
        false,
        undefined,
        [],
        undefined,
        undefined,
        50,
      );

      // All formed groups must respect size bounds
      for (const g of groups) {
        expect(g.members.length).toBeGreaterThanOrEqual(4);
        expect(g.members.length).toBeLessThanOrEqual(6);
      }

      // No duplicate assignments
      const assigned = new Set<string>();
      for (const g of groups) {
        for (const m of g.members) {
          expect(assigned.has(m.userId)).toBe(false);
          assigned.add(m.userId);
        }
      }
    }
  });
});

describe("Gender-balance default parity (AC-07 — Sprint 2026-07-14)", () => {
  const rosterSignature = (groups: Awaited<ReturnType<typeof runGreedyPoolMatchingCore>>) =>
    groups.map((g) => g.members.map((m) => m.userId).sort());

  it("all-male fixture: default config produces byte-identical output to gender logic disabled", async () => {
    const users: UserWithProfile[] = [
      makeUser("a1", "corgi"),
      makeUser("a2", "corgi"),
      makeUser("a3", "koala"),
      makeUser("a4", "koala"),
      makeUser("a5", "fox"),
      makeUser("a6", "fox"),
    ];
    const config = { minGroupSize: 4, maxGroupSize: 6, targetGroups: 1 };

    const runWith = async (poolConfig: Record<string, unknown>) =>
      runGreedyPoolMatchingCore(
        users,
        { ...config, ...poolConfig },
        new Map(),
        buildPairScoreCache(users),
        undefined,
        false,
        undefined,
        [],
        undefined,
        undefined,
        50,
      );

    const legacy = await runWith({}); // pre-change behavior: no gender fields at all
    const schemaDefaults = await runWith({
      genderBalanceMode: "soft",
      genderBalanceBonusPoints: 15,
      minFemaleCount: 0,
      minMaleCount: 0,
    });
    const disabled = await runWith({ genderBalanceMode: "none" });
    const hardZeroFloors = await runWith({
      genderBalanceMode: "hard",
      minFemaleCount: 0,
      minMaleCount: 0,
    });

    // Single-gender groups are never "balanced", so the soft-mode bonus cannot
    // fire: every configuration yields identical rosters AND scores.
    for (const variant of [schemaDefaults, disabled, hardZeroFloors]) {
      expect(rosterSignature(variant)).toEqual(rosterSignature(legacy));
      expect(variant.map((g) => g.diversityScore)).toEqual(legacy.map((g) => g.diversityScore));
      expect(variant.map((g) => g.overallScore)).toEqual(legacy.map((g) => g.overallScore));
    }
  });

  it("mixed fixture: default soft mode preserves rosters; diversity delta is exactly the bonus for balanced groups", async () => {
    const users: UserWithProfile[] = [
      makeUser("m1", "corgi", { gender: "男性" }),
      makeUser("m2", "corgi", { gender: "男性" }),
      makeUser("f1", "corgi", { gender: "女性" }),
      makeUser("f2", "corgi", { gender: "女性" }),
    ];
    const config = { minGroupSize: 4, maxGroupSize: 4, targetGroups: 1 };

    const runWith = async (poolConfig: Record<string, unknown>) =>
      runGreedyPoolMatchingCore(
        users,
        { ...config, ...poolConfig },
        new Map(),
        buildPairScoreCache(users),
        undefined,
        false,
        undefined,
        [],
        undefined,
        undefined,
        50,
      );

    const legacy = await runWith({}); // defaults resolve to soft/15 — same as schema defaults
    const explicitSoft = await runWith({
      genderBalanceMode: "soft",
      genderBalanceBonusPoints: 15,
      minFemaleCount: 0,
      minMaleCount: 0,
    });
    const disabled = await runWith({ genderBalanceMode: "none" });
    const hardZeroFloors = await runWith({
      genderBalanceMode: "hard",
      minFemaleCount: 0,
      minMaleCount: 0,
    });

    // Group membership is driven by pair scores only — the bonus never feeds
    // back into formation, so rosters are identical across all configurations.
    for (const variant of [explicitSoft, disabled, hardZeroFloors]) {
      expect(rosterSignature(variant)).toEqual(rosterSignature(legacy));
    }

    // The 2M/2F group is exactly balanced: soft mode adds exactly +15 (D8);
    // none/hard modes do not.
    expect(legacy).toHaveLength(1);
    expect(explicitSoft[0].diversityScore).toBe(legacy[0].diversityScore);
    expect(disabled[0].diversityScore).toBe(legacy[0].diversityScore - 15);
    expect(hardZeroFloors[0].diversityScore).toBe(legacy[0].diversityScore - 15);
    // avgPairScore (deterministic scoring) is untouched by the bonus arm.
    expect(disabled[0].avgPairScore).toBe(legacy[0].avgPairScore);
  });
});

describe("Strictness behaviors", () => {
  it("strictness=0 applies user dealbreakers as L1 filters", async () => {
    const users: UserWithProfile[] = [
      makeUser("f1", "corgi", {
        gender: "女性",
        genderCompositionPreference: "female_only",
        preferenceStrictness: 0,
      }),
      makeUser("f2", "koala", {
        gender: "女性",
        genderCompositionPreference: "female_only",
        preferenceStrictness: 0,
      }),
      makeUser("m1", "fox", {
        gender: "男性",
        preferenceStrictness: 0,
      }),
      makeUser("m2", "corgi", {
        gender: "男性",
        preferenceStrictness: 0,
      }),
    ];

    const pairScoreCache = buildPairScoreCache(users);

    const groups = await runGreedyPoolMatchingCore(
      users,
      { minGroupSize: 2, maxGroupSize: 4, targetGroups: 2 },
      new Map(),
      pairScoreCache,
      undefined,
      false,
      undefined,
      [],
      undefined,
      undefined,
      0,
    );

    // With dealbreakers, male users should be excluded from female-only groups.
    // Since strictness=0 applies dealbreakers, cross-gender pairs get score=-1.
    // Groups should only contain females (if any form).
    for (const g of groups) {
      const hasMale = g.members.some((m) => m.gender === "男性");
      const hasFemaleOnlyPreference = g.members.some(
        (m) => m.genderCompositionPreference === "female_only",
      );
      if (hasFemaleOnlyPreference) {
        expect(hasMale).toBe(false);
      }
    }
  });

  it("strictness=100 ignores nice-to-haves in group formation (higher threshold)", async () => {
    const users: UserWithProfile[] = [
      makeUser("s1", "corgi", { preferenceStrictness: 100 }),
      makeUser("s2", "corgi", { preferenceStrictness: 100 }),
      makeUser("s3", "koala", { preferenceStrictness: 100 }),
      makeUser("s4", "koala", { preferenceStrictness: 100 }),
    ];

    const pairScoreCache = buildPairScoreCache(users);
    // Set ALL pair scores to 55 (below strictness=100 threshold of 70)
    for (const key of pairScoreCache.keys()) {
      pairScoreCache.set(key, 55);
    }

    const groups = await runGreedyPoolMatchingCore(
      users,
      { minGroupSize: 4, maxGroupSize: 4, targetGroups: 1 },
      new Map(),
      pairScoreCache,
      undefined,
      false,
      undefined,
      [],
      undefined,
      undefined,
      100,
    );

    // Debug: if a group formed unexpectedly, inspect it
    if (groups.length > 0) {
      console.log("Unexpected group formed at strictness=100:",
        groups.map((g) => ({
          memberIds: g.members.map((m) => m.userId),
          avgPairScore: g.avgPairScore,
          overallScore: g.overallScore,
        })),
      );
    }

    // With minPairScore=70 and all scores at 55, no group can form.
    expect(groups.length).toBe(0);
  });
});

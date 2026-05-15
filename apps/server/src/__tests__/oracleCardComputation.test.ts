import { describe, it, expect } from "vitest";
import { computeOracleCardFields } from "../lib/oracleCardComputation";
import type { OracleCardInput } from "../lib/oracleCardComputation";

function makeInput(
  overrides: Partial<OracleCardInput> = {}
): OracleCardInput {
  return {
    pool: {
      id: "pool-1",
      registrationDeadline: new Date(Date.now() + 48 * 3_600_000),
      price: null,
    },
    allArchetypes: [],
    userArchetype: null,
    registrationCount: 0,
    now: new Date(),
    ...overrides,
  };
}

describe("computeOracleCardFields", () => {
  // ── Price resolution ──
  it("resolves pool.price when present", () => {
    const result = computeOracleCardFields(
      makeInput({ pool: { id: "p1", price: 68 } as any })
    );
    expect(result.price).toBe(68);
  });

  it("returns null when price is null", () => {
    const result = computeOracleCardFields(
      makeInput({ pool: { id: "p1", price: null } as any })
    );
    expect(result.price).toBeNull();
  });

  it("returns null when no price data", () => {
    const result = computeOracleCardFields(
      makeInput({ pool: { id: "p1", price: null } as any })
    );
    expect(result.price).toBeNull();
  });

  // ── User type count & rarity ──
  it("counts user's archetype presence correctly", () => {
    const result = computeOracleCardFields(
      makeInput({
        userArchetype: "corgi",
        allArchetypes: [
          { archetype: "corgi", count: 3 },
          { archetype: "owl", count: 2 },
        ],
        registrationCount: 5,
      })
    );
    expect(result.userTypeCount).toBe(3);
  });

  it("returns 0 userTypeCount when archetype is null", () => {
    const result = computeOracleCardFields(
      makeInput({
        userArchetype: null,
        allArchetypes: [{ archetype: "corgi", count: 5 }],
        registrationCount: 5,
      })
    );
    expect(result.userTypeCount).toBe(0);
    expect(result.userTypeRarity).toBe("present");
  });

  it("marks 'rare' when count <= 2 and total >= 8", () => {
    const result = computeOracleCardFields(
      makeInput({
        userArchetype: "corgi",
        allArchetypes: [
          { archetype: "corgi", count: 1 },
          { archetype: "owl", count: 10 },
        ],
        registrationCount: 11,
      })
    );
    expect(result.userTypeRarity).toBe("rare");
  });

  it("marks 'dominant' when count >= 40% of total", () => {
    const result = computeOracleCardFields(
      makeInput({
        userArchetype: "corgi",
        allArchetypes: [
          { archetype: "corgi", count: 5 },
          { archetype: "owl", count: 5 },
        ],
        registrationCount: 10,
      })
    );
    expect(result.userTypeRarity).toBe("dominant");
  });

  it("marks 'present' for common-case ratios", () => {
    const result = computeOracleCardFields(
      makeInput({
        userArchetype: "corgi",
        allArchetypes: [
          { archetype: "corgi", count: 3 },
          { archetype: "owl", count: 7 },
        ],
        registrationCount: 10,
      })
    );
    expect(result.userTypeRarity).toBe("present");
  });

  it("never marks 'rare' when total < 8 even if count <= 2", () => {
    const result = computeOracleCardFields(
      makeInput({
        userArchetype: "corgi",
        allArchetypes: [
          { archetype: "corgi", count: 1 },
          { archetype: "owl", count: 4 },
        ],
        registrationCount: 5,
      })
    );
    expect(result.userTypeRarity).toBe("present");
  });

  // ── High chemistry count ──
  it("excludes self from high chemistry count", () => {
    const result = computeOracleCardFields(
      makeInput({
        userArchetype: "corgi",
        allArchetypes: [
          { archetype: "corgi", count: 3 },
          { archetype: "rooster", count: 2 }, // compat 88 >= 70
        ],
        registrationCount: 5,
      })
    );
    // corgi-rooster = 88, so 2 count included; corgi self excluded
    expect(result.highChemistryCount).toBe(2);
  });

  it("returns 0 high chemistry when no user archetype", () => {
    const result = computeOracleCardFields(
      makeInput({
        userArchetype: null,
        allArchetypes: [{ archetype: "corgi", count: 5 }],
        registrationCount: 5,
      })
    );
    expect(result.highChemistryCount).toBe(0);
  });

  it("returns 0 for empty pool", () => {
    const result = computeOracleCardFields(
      makeInput({
        userArchetype: "corgi",
        allArchetypes: [],
        registrationCount: 0,
      })
    );
    expect(result.highChemistryCount).toBe(0);
  });

  it("only counts archetypes with score >= 70", () => {
    const result = computeOracleCardFields(
      makeInput({
        userArchetype: "corgi",
        allArchetypes: [
          { archetype: "rooster", count: 2 }, // 88 >= 70 ✓
          { archetype: "turtle", count: 3 }, // 68 < 70 ✗
        ],
        registrationCount: 5,
      })
    );
    expect(result.highChemistryCount).toBe(2);
  });

  // ── Top complementary type ──
  it("finds highest complementary type with score >= 85", () => {
    const result = computeOracleCardFields(
      makeInput({
        userArchetype: "corgi",
        allArchetypes: [
          { archetype: "rooster", count: 1 }, // 88
          { archetype: "koala", count: 1 }, // 92
        ],
        registrationCount: 2,
      })
    );
    expect(result.topComplementaryType).toBe("koala"); // 92 > 88
  });

  it("returns null when no type meets >= 85 threshold", () => {
    const result = computeOracleCardFields(
      makeInput({
        userArchetype: "corgi",
        allArchetypes: [
          { archetype: "turtle", count: 1 }, // 68
          { archetype: "cat", count: 1 }, // 65
        ],
        registrationCount: 2,
      })
    );
    expect(result.topComplementaryType).toBeNull();
  });

  it("returns null when user has no archetype", () => {
    const result = computeOracleCardFields(
      makeInput({
        userArchetype: null,
        allArchetypes: [{ archetype: "corgi", count: 5 }],
        registrationCount: 5,
      })
    );
    expect(result.topComplementaryType).toBeNull();
  });

  // ── Narrative pivot ──
  it("selects 'rare' pivot when rarity is rare", () => {
    const result = computeOracleCardFields(
      makeInput({
        userArchetype: "corgi",
        allArchetypes: [
          { archetype: "corgi", count: 1 },
          { archetype: "owl", count: 10 },
        ],
        registrationCount: 11,
      })
    );
    expect(result.narrativePivot).toBe("rare");
  });

  it("selects 'present' pivot when rarity is present", () => {
    const result = computeOracleCardFields(
      makeInput({
        userArchetype: "corgi",
        allArchetypes: [
          { archetype: "corgi", count: 3 },
          { archetype: "owl", count: 7 },
        ],
        registrationCount: 10,
      })
    );
    expect(result.narrativePivot).toBe("present");
  });

  it("selects 'dominant' pivot when rarity is dominant", () => {
    const result = computeOracleCardFields(
      makeInput({
        userArchetype: "corgi",
        allArchetypes: [
          { archetype: "corgi", count: 5 },
          { archetype: "owl", count: 5 },
        ],
        registrationCount: 10,
      })
    );
    expect(result.narrativePivot).toBe("dominant");
  });

  // ── Hours until deadline ──
  it("computes hours until deadline correctly", () => {
    const now = new Date("2026-05-13T12:00:00Z");
    const result = computeOracleCardFields(
      makeInput({
        pool: { id: "p1", registrationDeadline: new Date("2026-05-15T12:00:00Z") } as any,
        now,
      })
    );
    expect(result.hoursUntilDeadline).toBe(48);
  });

  it("returns 0 when deadline has passed", () => {
    const now = new Date("2026-05-15T12:00:00Z");
    const result = computeOracleCardFields(
      makeInput({
        pool: { id: "p1", registrationDeadline: new Date("2026-05-13T12:00:00Z") } as any,
        now,
      })
    );
    expect(result.hoursUntilDeadline).toBe(0);
  });

  it("returns 0 when deadline is null", () => {
    const result = computeOracleCardFields(
      makeInput({
        pool: { id: "p1", registrationDeadline: null } as any,
      })
    );
    expect(result.hoursUntilDeadline).toBe(0);
  });

  // ── Division-by-zero guard ──
  it("handles empty pool without crashing", () => {
    const result = computeOracleCardFields(
      makeInput({
        userArchetype: "corgi",
        allArchetypes: [],
        registrationCount: 0,
      })
    );
    expect(result.userTypeCount).toBe(0);
    expect(result.userTypeRarity).toBe("present");
    expect(result.highChemistryCount).toBe(0);
    expect(result.topComplementaryType).toBeNull();
    expect(result.narrativePivot).toBe("empty");
  });
});

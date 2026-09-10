import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  compatibilityMatrix,
  getChemistryScore as canonicalGetChemistryScore,
  getChemistryScoreForMode as canonicalGetChemistryScoreForMode,
  getDerivedArchetypeChemistry as canonicalGetDerivedArchetypeChemistry,
  deriveChemistry as canonicalDeriveChemistry,
  DERIVED_CHEMISTRY_MATRIX as canonicalDerivedMatrix,
} from "@shared/personality/archetypeCompatibility";
import {
  chemistryMatrix,
  getChemistryScore,
  getChemistryScoreForMode,
  getDerivedArchetypeChemistry,
  deriveChemistry,
  DERIVED_CHEMISTRY_MATRIX,
} from "../archetypeChemistry";

const {
  aggregateArchetypePairFeedbackRowsMock,
  listArchetypePairFeedbackStatsMock,
  upsertArchetypePairFeedbackStatsMock,
} = vi.hoisted(() => ({
  aggregateArchetypePairFeedbackRowsMock: vi.fn(),
  listArchetypePairFeedbackStatsMock: vi.fn(),
  upsertArchetypePairFeedbackStatsMock: vi.fn(),
}));

vi.mock("../repositories/archetypePairFeedbackStatsRepo", () => ({
  aggregateArchetypePairFeedbackRows: aggregateArchetypePairFeedbackRowsMock,
  listArchetypePairFeedbackStats: listArchetypePairFeedbackStatsMock,
  upsertArchetypePairFeedbackStats: upsertArchetypePairFeedbackStatsMock,
}));

import {
  CHEMISTRY_CALIBRATION_MAX_DELTA,
  CHEMISTRY_CALIBRATION_MIN_SAMPLES,
  calculateCalibratedChemistryBreakdown,
  calculateEmpiricalChemistryScore,
  getArchetypePairCalibrationMap,
  refreshArchetypePairCalibrationMap,
} from "../archetypeChemistryCalibration";

describe("archetypeChemistryCalibration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps sparse pairs on the base matrix score", () => {
    const breakdown = calculateCalibratedChemistryBreakdown(82, CHEMISTRY_CALIBRATION_MIN_SAMPLES - 1, 0.9, 4.6);

    expect(breakdown.hasSufficientSamples).toBe(false);
    expect(breakdown.empiricalScore).toBe(90);
    expect(breakdown.appliedDelta).toBe(0);
    expect(breakdown.calibratedScore).toBe(82);
  });

  it("computes explainable empirical scores from meet-again and atmosphere outcomes", () => {
    expect(calculateEmpiricalChemistryScore(0.75, 4)).toBe(75);
  });

  it("bounds positive calibration deltas", () => {
    const breakdown = calculateCalibratedChemistryBreakdown(40, CHEMISTRY_CALIBRATION_MIN_SAMPLES, 1, 5);

    expect(breakdown.hasSufficientSamples).toBe(true);
    expect(breakdown.empiricalScore).toBe(100);
    expect(breakdown.appliedDelta).toBe(CHEMISTRY_CALIBRATION_MAX_DELTA);
    expect(breakdown.calibratedScore).toBe(42);
  });

  it("bounds negative calibration deltas", () => {
    const breakdown = calculateCalibratedChemistryBreakdown(90, CHEMISTRY_CALIBRATION_MIN_SAMPLES, 0, 1);

    expect(breakdown.hasSufficientSamples).toBe(true);
    expect(breakdown.empiricalScore).toBe(0);
    expect(breakdown.appliedDelta).toBe(-CHEMISTRY_CALIBRATION_MAX_DELTA);
    expect(breakdown.calibratedScore).toBe(88);
  });

  it("loads only persisted calibration stats on the non-refresh path", async () => {
    listArchetypePairFeedbackStatsMock.mockResolvedValueOnce([
      {
        archetypeA: "corgi",
        archetypeB: "rooster",
        baseScore: 88,
        sampleCount: 12,
        avgMeetAgain: "0.750",
        avgAtmosphere: "4.000",
        empiricalScore: "75.00",
        appliedDelta: "0.00",
        calibratedScore: "88.00",
        lastAggregatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    ]);

    const calibrationMap = await getArchetypePairCalibrationMap();

    expect(aggregateArchetypePairFeedbackRowsMock).not.toHaveBeenCalled();
    expect(listArchetypePairFeedbackStatsMock).toHaveBeenCalledTimes(1);
    expect(Array.from(calibrationMap.values())[0]?.calibratedScore).toBe(88);
  });

  it("refreshes persisted stats only on the explicit refresh path", async () => {
    aggregateArchetypePairFeedbackRowsMock.mockResolvedValueOnce([
      {
        archetypeA: "corgi",
        archetypeB: "rooster",
        sampleCount: CHEMISTRY_CALIBRATION_MIN_SAMPLES,
        avgMeetAgain: 0.75,
        avgAtmosphere: 4,
      },
    ]);
    upsertArchetypePairFeedbackStatsMock.mockResolvedValueOnce([
      {
        archetypeA: "corgi",
        archetypeB: "rooster",
        baseScore: 88,
        sampleCount: CHEMISTRY_CALIBRATION_MIN_SAMPLES,
        avgMeetAgain: "0.750",
        avgAtmosphere: "4.000",
        empiricalScore: "75.00",
        appliedDelta: "-0.65",
        calibratedScore: "87.35",
        lastAggregatedAt: new Date("2026-04-02T00:00:00.000Z"),
      },
    ]);

    const calibrationMap = await refreshArchetypePairCalibrationMap();

    expect(aggregateArchetypePairFeedbackRowsMock).toHaveBeenCalledTimes(1);
    expect(upsertArchetypePairFeedbackStatsMock).toHaveBeenCalledTimes(1);
    expect(Array.from(calibrationMap.values())[0]?.empiricalScore).toBe(75);
  });

  it("re-exports the canonical chemistryMatrix by identity (no divergent runtime copy)", () => {
    // The previous "144 ordered pairs" loop compared an object to itself: the
    // server `chemistryMatrix` is a literal re-export of the canonical
    // `compatibilityMatrix`, so the pair-by-pair comparison could never fail
    // (tautological — Item 10 verifier finding). Assert OBJECT IDENTITY
    // instead, which is the actual canonical/runtime sync invariant.
    expect(chemistryMatrix).toBe(compatibilityMatrix);
    expect(Object.keys(compatibilityMatrix)).toHaveLength(12);
  });
});

/**
 * Plan Item 10 — derived chemistry canonical/runtime sync + flag-off identity.
 * The personality skill requires the canonical (shared `archetypeCompatibility`)
 * and runtime (this app's `archetypeChemistry`) copies to stay in sync.
 */
describe("derived chemistry — canonical/runtime sync (Item 10)", () => {
  const archetypes = Object.keys(compatibilityMatrix);
  expect(archetypes.length).toBe(12);

  it("runtime and canonical share the same derived function identities", () => {
    expect(getDerivedArchetypeChemistry).toBe(canonicalGetDerivedArchetypeChemistry);
    expect(deriveChemistry).toBe(canonicalDeriveChemistry);
    expect(getChemistryScoreForMode).toBe(canonicalGetChemistryScoreForMode);
  });

  it("re-exports the canonical derived matrix by identity (no divergent runtime copy)", () => {
    // Same reasoning as the chemistryMatrix test above: the runtime
    // `DERIVED_CHEMISTRY_MATRIX` is a literal re-export, so pair-by-pair
    // comparison was tautological. Identity is the real sync contract.
    expect(DERIVED_CHEMISTRY_MATRIX).toBe(canonicalDerivedMatrix);
  });

  it("flag-off is byte-identical to the hand-authored getChemistryScore path", () => {
    for (const a of archetypes) {
      for (const b of archetypes) {
        expect(getChemistryScoreForMode(a, b, false)).toBe(getChemistryScore(a, b));
        expect(getChemistryScoreForMode(a, b, false)).toBe(canonicalGetChemistryScore(a, b));
      }
    }
  });

  it("flag-on returns the derived matrix", () => {
    for (const a of archetypes) {
      for (const b of archetypes) {
        expect(getChemistryScoreForMode(a, b, true)).toBe(canonicalGetDerivedArchetypeChemistry(a, b));
      }
    }
  });
});

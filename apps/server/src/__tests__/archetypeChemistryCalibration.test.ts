import { describe, expect, it, vi } from "vitest";

vi.mock("../repositories/archetypePairFeedbackStatsRepo", () => ({
  aggregateArchetypePairFeedbackRows: vi.fn(),
  listArchetypePairFeedbackStats: vi.fn(),
  upsertArchetypePairFeedbackStats: vi.fn(),
}));

import {
  CHEMISTRY_CALIBRATION_MAX_DELTA,
  CHEMISTRY_CALIBRATION_MIN_SAMPLES,
  calculateCalibratedChemistryBreakdown,
  calculateEmpiricalChemistryScore,
} from "../archetypeChemistryCalibration";

describe("archetypeChemistryCalibration", () => {
  it("keeps sparse pairs on the base matrix score", () => {
    const breakdown = calculateCalibratedChemistryBreakdown(82, CHEMISTRY_CALIBRATION_MIN_SAMPLES - 1, 0.9, 4.6);

    expect(breakdown.hasSufficientSamples).toBe(false);
    expect(breakdown.empiricalScore).toBeNull();
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
});

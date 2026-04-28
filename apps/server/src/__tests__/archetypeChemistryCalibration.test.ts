import { beforeEach, describe, expect, it, vi } from "vitest";

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
});

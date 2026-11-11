import { describe, expect, it } from "vitest";
import {
  calculateDecayedThreshold,
  resolvePairFloor,
  PAIR_FLOOR_MAX,
  PAIR_FLOOR_MIN,
} from "../matching/matchingCurve";
import type { MatchingThresholdsConfig } from "../lib/matchingThresholds";

/**
 * Default production fallbacks, copied as a plain object so this test never
 * imports the DB-backed matchingThresholds module at runtime.
 */
const baseConfig = {
  highCompatibilityThreshold: 85,
  mediumCompatibilityThreshold: 70,
  timeDecayEnabled: true,
  timeDecayRate: 5,
  minThresholdAfterDecay: 50,
} as unknown as MatchingThresholdsConfig;

describe("matchingCurve — D3 single ruler", () => {
  it("reproduces the approved floor table exactly", () => {
    const rows: Array<[hours: number, group: number, floor: number]> = [
      [-1, 50, 45],
      [0, 50, 45],
      [24, 55, 45],
      [48, 60, 47],
      [72, 65, 52],
      [96, 70, 57],
      [120, 75, 62],
      [144, 80, 65],
      [168, 85, 65],
      [720, 85, 65],
    ];

    for (const [hours, group, floor] of rows) {
      expect(
        calculateDecayedThreshold(
          baseConfig.mediumCompatibilityThreshold,
          hours,
          baseConfig,
        ),
      ).toBe(group);
      expect(resolvePairFloor(hours, baseConfig)).toBe(floor);
    }
  });

  it("never rises as the event gets closer and never leaves [45, 65]", () => {
    const values = Array.from({ length: 121 }, (_, i) =>
      resolvePairFloor(i * 6, baseConfig),
    );

    for (let i = 1; i < values.length; i++) {
      // h increases → the event is farther away → the floor may rise, never fall.
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(PAIR_FLOOR_MIN);
      expect(value).toBeLessThanOrEqual(PAIR_FLOOR_MAX);
    }
  });

  it("follows config instead of hardcoded 50/70", () => {
    const raisedFloor = {
      ...baseConfig,
      minThresholdAfterDecay: 55,
    } as MatchingThresholdsConfig;

    // 72h: group = round(55 + (85 - 55) × 3/7) = 68; pair floor = 55.
    expect(resolvePairFloor(72, raisedFloor)).toBe(55);
    // 24h: group = round(55 + 30/7) = 59; pair floor = 46.
    expect(resolvePairFloor(24, raisedFloor)).toBe(46);
    expect(resolvePairFloor(72, raisedFloor)).not.toBe(
      resolvePairFloor(72, baseConfig),
    );
  });

  it("returns the base threshold when time decay is disabled", () => {
    const disabled = {
      ...baseConfig,
      timeDecayEnabled: false,
    } as MatchingThresholdsConfig;

    expect(calculateDecayedThreshold(70, 168, disabled)).toBe(70);
    expect(resolvePairFloor(168, disabled)).toBe(57);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFeatureFlag: vi.fn(),
  getMatchingThresholdConfig: vi.fn(),
}));

vi.mock("../lib/featureFlags", () => ({
  getFeatureFlag: mocks.getFeatureFlag,
}));

vi.mock("../lib/matchingThresholds", () => ({
  getMatchingThresholdConfig: mocks.getMatchingThresholdConfig,
}));

import {
  PAIR_FLOOR_CURVE_FLAG,
  PAIR_FLOOR_PILOT_POOL_ENV,
  PAIR_FLOOR_ROLLOUT_SCOPE_ENV,
  isPairFloorCurveExposed,
  parsePairFloorRolloutScope,
  resolvePairFloorForPool,
} from "../lib/pairFloorRollout";
import type { MatchingThresholdsConfig } from "../lib/matchingThresholds";

const config = {
  highCompatibilityThreshold: 85,
  mediumCompatibilityThreshold: 70,
  timeDecayEnabled: true,
  timeDecayRate: 5,
  minThresholdAfterDecay: 50,
} as unknown as MatchingThresholdsConfig;

describe("pairFloorRollout — fail-closed exposure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[PAIR_FLOOR_ROLLOUT_SCOPE_ENV];
    delete process.env[PAIR_FLOOR_PILOT_POOL_ENV];
  });

  it("defaults scope to pilot and treats invalid values as off", () => {
    expect(parsePairFloorRolloutScope(undefined)).toBe("pilot");
    expect(parsePairFloorRolloutScope("pilot")).toBe("pilot");
    expect(parsePairFloorRolloutScope("global")).toBe("global");
    expect(parsePairFloorRolloutScope("PILOT")).toBe("pilot");
    expect(parsePairFloorRolloutScope("")).toBe("off");
    expect(parsePairFloorRolloutScope("bogus")).toBe("off");
  });

  it("requires the master flag, a valid scope, and a matching pilot pool", () => {
    const base = { poolId: "pool-1", pilotPoolId: "pool-1" };

    expect(
      isPairFloorCurveExposed({ ...base, enabled: false, scope: "global" }),
    ).toBe(false);
    expect(
      isPairFloorCurveExposed({ ...base, enabled: true, scope: "off" }),
    ).toBe(false);
    expect(
      isPairFloorCurveExposed({ ...base, enabled: true, scope: "global" }),
    ).toBe(true);
    expect(
      isPairFloorCurveExposed({ ...base, enabled: true, scope: "pilot" }),
    ).toBe(true);
    expect(
      isPairFloorCurveExposed({
        ...base,
        poolId: "pool-2",
        enabled: true,
        scope: "pilot",
      }),
    ).toBe(false);
    expect(
      isPairFloorCurveExposed({
        ...base,
        pilotPoolId: "",
        enabled: true,
        scope: "pilot",
      }),
    ).toBe(false);
  });

  it("returns legacy/null when the master flag is off", async () => {
    mocks.getFeatureFlag.mockResolvedValue(false);
    process.env[PAIR_FLOOR_ROLLOUT_SCOPE_ENV] = "global";

    const result = await resolvePairFloorForPool(
      { id: "pool-1", dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      { config, hoursUntilEvent: 24 },
    );

    expect(result).toEqual({ pairFloor: null, policy: "legacy" });
    expect(mocks.getFeatureFlag).toHaveBeenCalledWith(
      PAIR_FLOOR_CURVE_FLAG,
      false,
    );
  });

  it("resolves the curve only for the allowlisted pilot pool", async () => {
    mocks.getFeatureFlag.mockResolvedValue(true);
    process.env[PAIR_FLOOR_ROLLOUT_SCOPE_ENV] = "pilot";
    process.env[PAIR_FLOOR_PILOT_POOL_ENV] = "pool-1";

    const exposed = await resolvePairFloorForPool(
      { id: "pool-1", dateTime: new Date() },
      { config, hoursUntilEvent: 24 },
    );
    expect(exposed).toEqual({ pairFloor: 45, policy: "curve_v1" });

    const notExposed = await resolvePairFloorForPool(
      { id: "pool-2", dateTime: new Date() },
      { config, hoursUntilEvent: 24 },
    );
    expect(notExposed).toEqual({ pairFloor: null, policy: "legacy" });
  });

  it("returns legacy/null for a missing pilot id or invalid scope", async () => {
    mocks.getFeatureFlag.mockResolvedValue(true);
    process.env[PAIR_FLOOR_ROLLOUT_SCOPE_ENV] = "pilot";

    expect(
      await resolvePairFloorForPool(
        { id: "pool-1", dateTime: new Date() },
        { config, hoursUntilEvent: 24 },
      ),
    ).toEqual({ pairFloor: null, policy: "legacy" });

    process.env[PAIR_FLOOR_ROLLOUT_SCOPE_ENV] = "bogus";
    expect(
      await resolvePairFloorForPool(
        { id: "pool-1", dateTime: new Date() },
        { config, hoursUntilEvent: 24 },
      ),
    ).toEqual({ pairFloor: null, policy: "legacy" });
  });

  it("resolves config and the event clock when the scan does not pass them", async () => {
    mocks.getFeatureFlag.mockResolvedValue(true);
    mocks.getMatchingThresholdConfig.mockResolvedValue(config);
    process.env[PAIR_FLOOR_ROLLOUT_SCOPE_ENV] = "global";

    const result = await resolvePairFloorForPool({
      id: "pool-1",
      dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    expect(result).toEqual({ pairFloor: 45, policy: "curve_v1" });
    expect(mocks.getMatchingThresholdConfig).toHaveBeenCalledTimes(1);
  });
});

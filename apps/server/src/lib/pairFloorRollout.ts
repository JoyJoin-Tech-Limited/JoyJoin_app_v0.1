import { getFeatureFlag } from "./featureFlags";
import { getMatchingThresholdConfig, type MatchingThresholdsConfig } from "./matchingThresholds";
import { resolvePairFloor } from "../matching/matchingCurve";

export const PAIR_FLOOR_CURVE_FLAG = "pairFloorCurveEnabled";
export const PAIR_FLOOR_ROLLOUT_SCOPE_ENV = "PAIR_FLOOR_CURVE_ROLLOUT_SCOPE";
export const PAIR_FLOOR_PILOT_POOL_ENV = "PAIR_FLOOR_CURVE_PILOT_POOL_ID";

export type PairFloorPolicy = "legacy" | "curve_v1";
export type PairFloorRolloutScope = "off" | "pilot" | "global";

/**
 * Defaults to `pilot` so turning the master flag on never becomes a global
 * rollout by accident. Unknown values fail closed.
 */
export function parsePairFloorRolloutScope(
  raw: string | undefined = process.env[PAIR_FLOOR_ROLLOUT_SCOPE_ENV],
): PairFloorRolloutScope {
  const normalized = (raw ?? "pilot").trim().toLowerCase();
  if (normalized === "global") return "global";
  if (normalized === "pilot") return "pilot";
  return "off";
}

export function isPairFloorCurveExposed(input: {
  poolId: string;
  enabled: boolean;
  scope: PairFloorRolloutScope;
  pilotPoolId?: string | null;
}): boolean {
  if (!input.enabled) return false;
  if (input.scope === "global") return true;
  if (input.scope !== "pilot") return false;
  const pilotPoolId = input.pilotPoolId?.trim();
  return Boolean(pilotPoolId && input.poolId === pilotPoolId);
}

function hoursUntil(dateTime: Date | string | null | undefined): number {
  if (!dateTime) return 0;
  const timestamp = dateTime instanceof Date ? dateTime.getTime() : new Date(dateTime).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.round((timestamp - Date.now()) / (60 * 60 * 1000)));
}

/**
 * Resolves the per-person admission floor for one pool.
 *
 * The scan calls this once and passes the number into the formation core, so
 * the clock never enters the deterministic matching module. Direct callers
 * (admin re-run, tests) may omit the number and let this helper resolve it.
 */
export async function resolvePairFloorForPool(
  pool: { id: string; dateTime?: Date | string | null },
  options: {
    config?: MatchingThresholdsConfig;
    hoursUntilEvent?: number;
  } = {},
): Promise<{ pairFloor: number | null; policy: PairFloorPolicy }> {
  const enabled = await getFeatureFlag(PAIR_FLOOR_CURVE_FLAG, false);
  const scope = parsePairFloorRolloutScope();
  const exposed = isPairFloorCurveExposed({
    poolId: pool.id,
    enabled,
    scope,
    pilotPoolId: process.env[PAIR_FLOOR_PILOT_POOL_ENV],
  });

  if (!exposed) return { pairFloor: null, policy: "legacy" };

  const config = options.config ?? (await getMatchingThresholdConfig());
  const hours = options.hoursUntilEvent ?? hoursUntil(pool.dateTime);
  return { pairFloor: resolvePairFloor(hours, config), policy: "curve_v1" };
}

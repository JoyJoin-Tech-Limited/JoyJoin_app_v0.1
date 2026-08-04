/**
 * Matching Thresholds Config Reader (匹配阈值配置统一读取入口)
 *
 * Single read path for the live pool-matching threshold config
 * (`matching_thresholds` table). All consumers must use this module instead of
 * re-implementing inline defaults, so the fallback values exist in exactly one
 * place.
 *
 * Fallback values mirror the DB column defaults in
 * `packages/shared/src/schema/_definitions.ts` (`matching_thresholds`) — keep
 * them in sync. Admin write/read surfaces: `routes/domains/matchingAdmin.ts`
 * (`/api/admin/matching-thresholds`).
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import { matchingThresholds } from "@shared/schema";

/**
 * Fallback config used when no active `matching_thresholds` row exists.
 * Values match the DB column defaults (85/70/55).
 *
 * NOTE: lowCompatibilityThreshold and optimalGroupSize are currently not
 * consumed by matching (Phase 1 will wire or remove).
 */
export const MATCHING_THRESHOLD_FALLBACKS = {
  highCompatibilityThreshold: 85,
  mediumCompatibilityThreshold: 70,
  lowCompatibilityThreshold: 55,
  timeDecayEnabled: true,
  timeDecayRate: 5,
  minThresholdAfterDecay: 50,
  minGroupSizeForMatch: 4,
  optimalGroupSize: 6,
  scanIntervalMinutes: 60,
  predictiveRerankEnabled: false,
  predictiveRerankExposurePercent: 50,
  predictiveRerankMaxPositionShift: 2,
  predictiveRerankConfidenceThreshold: 70,
  predictiveRerankAutoDisableEnabled: true,
  predictiveRerankMinShadowExperiments: 10,
  predictiveRerankAutoDisabledAt: null,
  predictiveRerankAutoDisabledReason: null,
};

/**
 * Read the active matching-threshold config.
 *
 * - No active row → returns `MATCHING_THRESHOLD_FALLBACKS`.
 * - Active row with unset (null/0) numeric threshold or decay fields → those
 *   fields are coalesced to the fallback values so callers never re-implement
 *   inline `|| 85` / `|| 70` style defaults.
 */
export async function getMatchingThresholdConfig() {
  const [config] = await db
    .select()
    .from(matchingThresholds)
    .where(eq(matchingThresholds.isActive, true))
    .limit(1);

  if (!config) {
    return { ...MATCHING_THRESHOLD_FALLBACKS };
  }

  return {
    ...config,
    highCompatibilityThreshold:
      config.highCompatibilityThreshold || MATCHING_THRESHOLD_FALLBACKS.highCompatibilityThreshold,
    mediumCompatibilityThreshold:
      config.mediumCompatibilityThreshold || MATCHING_THRESHOLD_FALLBACKS.mediumCompatibilityThreshold,
    timeDecayRate: config.timeDecayRate || MATCHING_THRESHOLD_FALLBACKS.timeDecayRate,
    minThresholdAfterDecay:
      config.minThresholdAfterDecay || MATCHING_THRESHOLD_FALLBACKS.minThresholdAfterDecay,
  };
}

export type MatchingThresholdsConfig = Awaited<ReturnType<typeof getMatchingThresholdConfig>>;

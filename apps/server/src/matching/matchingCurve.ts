/**
 * Time-decayed matching curve (pure module — no DB, logger, or Date).
 *
 * Both rulers read the same `MatchingThresholdsConfig` so an admin edit to the
 * group threshold moves the pair admission floor with it. Keeping this file
 * free of database imports is deliberate: `runGreedyPoolMatchingCore` imports
 * it, and the formation core must stay deterministic and DB-free.
 */
import type { MatchingThresholdsConfig } from "../lib/matchingThresholds";

/** Number of days over which the threshold ramps from floor to ceiling. */
const EARLY_MATCH_STRICTNESS_DAYS = 7;

/**
 * Measures the observed pair → overall gap at the reference composition
 * (diversity ≈ 67, energy = 100, overall ≈ pair × 0.6 + 31.75). At overall 60
 * this is ≈ 47, so the pair admission floor for a group gate of 60 is 47.
 *
 * This is a local calibration point, not an invertible conversion: diversity
 * and energy still move `overallScore`, and the group gate remains the final
 * quality check.
 */
export const PAIR_OVERALL_GAP = 13;

/** Bounds for the per-person admission floor. */
export const PAIR_FLOOR_MIN = 45;
export const PAIR_FLOOR_MAX = 65;

/**
 * Group-level threshold that decays as the event approaches. Moved verbatim
 * from `poolRealtimeMatchingService.ts` so there is one implementation.
 */
export function calculateDecayedThreshold(
  baseThreshold: number,
  hoursUntilEvent: number,
  config: MatchingThresholdsConfig,
): number {
  if (!config.timeDecayEnabled) return baseThreshold;

  const daysUntilEvent = Math.max(0, hoursUntilEvent) / 24;
  const ceiling = Math.max(
    baseThreshold,
    Math.min(
      config.highCompatibilityThreshold,
      baseThreshold + config.timeDecayRate * EARLY_MATCH_STRICTNESS_DAYS,
    ),
  );
  const strictness = Math.min(1, Math.max(0, daysUntilEvent / EARLY_MATCH_STRICTNESS_DAYS));
  const threshold =
    config.minThresholdAfterDecay + (ceiling - config.minThresholdAfterDecay) * strictness;

  return Math.round(
    Math.min(ceiling, Math.max(config.minThresholdAfterDecay, threshold)),
  );
}

/**
 * Per-person admission floor, derived from the same group ruler used by
 * `evaluateMatchQuality`.
 *
 * Default config yields a group threshold of 50/55/60/65/70/75/80/85 and a
 * pair floor of 45/45/47/52/57/62/65/65 at 0/24/48/72/96/120/144/168h.
 * The floor is a guard against admitting a candidate with no tie to the table;
 * the group-level `overallScore >= currentThreshold` check remains the final
 * quality bar.
 */
export function resolvePairFloor(
  hoursUntilEvent: number,
  config: MatchingThresholdsConfig,
): number {
  const groupThreshold = calculateDecayedThreshold(
    config.mediumCompatibilityThreshold,
    hoursUntilEvent,
    config,
  );
  return Math.min(PAIR_FLOOR_MAX, Math.max(PAIR_FLOOR_MIN, groupThreshold - PAIR_OVERALL_GAP));
}

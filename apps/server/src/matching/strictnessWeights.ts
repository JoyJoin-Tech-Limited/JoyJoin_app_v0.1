/**
 * Match Compass group-formation weights by strictness tier.
 *
 * Extracted verbatim from `poolMatchingService.ts` as a behavior-preserving
 * modularization; re-exported from `poolMatchingService.ts`.
 */
import type { MatchingWeights } from "../matchingWeightsService";

/**
 * Match Compass group-formation weights by strictness tier.
 * At strictness=50, returns undefined (use default/adaptive weights).
 * At strictness=0, diversityWeight +4%.
 * At strictness=100, chemistryWeight +4%.
 * Weights are normalized to sum to 100%.
 */
export function resolveStrictnessWeights(strictness: number): MatchingWeights | undefined {
  const isEnabled = process.env.MATCH_COMPASS_STRICTNESS_ENABLED !== "false";
  if (!isEnabled) return undefined;

  if (strictness === 50) return undefined;

  const base = {
    chemistryWeight: 28,
    interestWeight: 28,
    socialAffinityWeight: 20,
    backgroundDiversityWeight: 15,
    preferenceWeight: 5,
    languageWeight: 4,
  };

  if (strictness <= 0) {
    base.backgroundDiversityWeight += 4;
  } else if (strictness >= 100) {
    base.chemistryWeight += 4;
  } else {
    return undefined;
  }

  const total = Object.values(base).reduce((a, b) => a + b, 0);
  const keys = Object.keys(base) as Array<keyof typeof base>;
  const normalized = {} as MatchingWeights;
  let running = 0;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const value = Math.round((base[key] / total) * 100);
    normalized[key] = value;
    running += value;
  }
  const lastKey = keys[keys.length - 1];
  normalized[lastKey] = 100 - running;
  return normalized;
}

/**
 * Active-flow matching weight vocabulary — aligned with poolMatchingService.ts pair-score dimensions.
 * These defaults match the active 6D weights used in the deterministic matching path.
 *
 * Dimension semantics:
 *   chemistry          — archetype chemistry reaction (性格化学反应)
 *   interest           — heat-weighted interest overlap (兴趣重叠度)
 *   socialAffinity     — life stage + education + hometown affinity (社交同频度)
 *   backgroundDiversity — industry + gender diversity (背景多样性)
 *   preference         — event intent / venue preference (活动偏好)
 *   language           — common language / communication fit (语言沟通)
 *
 * Note: semanticSimilarity is controlled separately via ENABLE_SEMANTIC_SIMILARITY and is
 * intentionally excluded from Thompson Sampling to preserve the semantic rollout boundary.
 */
export const DEFAULT_MATCHING_WEIGHTS = {
  chemistryWeight: 28,
  interestWeight: 28,
  socialAffinityWeight: 20,
  backgroundDiversityWeight: 15,
  preferenceWeight: 5,
  languageWeight: 4,
} as const;

export type MatchingWeightKey = keyof typeof DEFAULT_MATCHING_WEIGHTS;
export type MatchingWeightsShape = Record<MatchingWeightKey, number>;

export const DEFAULT_MATCHING_WEIGHTS_RATIO = Object.fromEntries(
  Object.entries(DEFAULT_MATCHING_WEIGHTS).map(([key, value]) => [key, value / 100]),
) as MatchingWeightsShape;

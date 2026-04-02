export const DEFAULT_MATCHING_WEIGHTS = {
  personalityWeight: 23,
  interestsWeight: 24,
  intentWeight: 13,
  backgroundWeight: 15,
  cultureWeight: 10,
  conversationSignatureWeight: 15,
} as const;

export type MatchingWeightKey = keyof typeof DEFAULT_MATCHING_WEIGHTS;
export type MatchingWeightsShape = Record<MatchingWeightKey, number>;

export const DEFAULT_MATCHING_WEIGHTS_RATIO = Object.fromEntries(
  Object.entries(DEFAULT_MATCHING_WEIGHTS).map(([key, value]) => [key, value / 100]),
) as MatchingWeightsShape;

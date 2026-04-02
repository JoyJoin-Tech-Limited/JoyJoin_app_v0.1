export interface SemanticProfileUser {
  userId: string;
  archetype: string | null;
  secondaryArchetype: string | null;
  workMode: string | null;
  educationLevel: string | null;
  industryNiche: string | null;
  hometown: string | null;
  preferredLanguages: string[] | null;
  eventIntent: string[] | null;
  userIntent: string[] | null;
  barThemes: string[] | null;
  alcoholComfort: string[] | null;
  eventType: string | null;
}

export interface SemanticInterestProfile {
  topics: string[];
  heatMap: Record<string, number>;
}

export interface SemanticProfile {
  userId: string;
  vector: number[];
  featureCount: number;
}

export type SemanticProfileCache = Map<string, SemanticProfile>;
export type PairScoreWeights = {
  chemistry: number;
  interest: number;
  socialAffinity: number;
  backgroundDiversity: number;
  preference: number;
  language: number;
  semanticSimilarity?: number;
};

const HASH_DIMENSIONS = 64;
const SEMANTIC_SCORE_MIN = 35;
const SEMANTIC_SCORE_MAX = 100;
const SEMANTIC_PROFILE_NEUTRAL_SCORE = 50;
const SEMANTIC_PROFILE_PARTIAL_DATA_SCORE = 45;

export const LEGACY_PAIR_SCORE_WEIGHTS: PairScoreWeights = {
  chemistry: 0.28,
  interest: 0.28,
  socialAffinity: 0.20,
  backgroundDiversity: 0.15,
  preference: 0.05,
  language: 0.04,
};

export const SEMANTIC_PAIR_SCORE_WEIGHTS: PairScoreWeights = {
  chemistry: 0.26,
  interest: 0.26,
  socialAffinity: 0.19,
  backgroundDiversity: 0.14,
  preference: 0.05,
  language: 0.04,
  semanticSimilarity: 0.06,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hashToken(token: string): number {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index++) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getEffectiveIntent(user: SemanticProfileUser): string[] {
  if (Array.isArray(user.eventIntent) && user.eventIntent.length > 0) {
    return user.eventIntent;
  }
  if (Array.isArray(user.userIntent) && user.userIntent.length > 0) {
    return user.userIntent;
  }
  return [];
}

function addWeightedToken(vector: number[], token: string, weight: number): void {
  const normalizedToken = token.trim().toLowerCase();
  if (!normalizedToken) return;

  const primaryBucket = hashToken(normalizedToken) % HASH_DIMENSIONS;
  const secondaryBucket = hashToken(`${normalizedToken}|secondary`) % HASH_DIMENSIONS;
  vector[primaryBucket] += weight;
  vector[secondaryBucket] += weight * 0.5;
}

function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}

function getUniqueValues(values: string[] | null | undefined): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

function buildSemanticProfile(
  user: SemanticProfileUser,
  interests: SemanticInterestProfile | undefined,
): SemanticProfile {
  const vector = Array.from({ length: HASH_DIMENSIONS }, () => 0);
  let featureCount = 0;

  const addSingleValue = (prefix: string, value: string | null | undefined, weight: number): void => {
    if (!value) return;
    addWeightedToken(vector, `${prefix}:${value}`, weight);
    featureCount += 1;
  };

  const addManyValues = (prefix: string, values: string[] | null | undefined, weight: number): void => {
    for (const value of getUniqueValues(values)) {
      addWeightedToken(vector, `${prefix}:${value}`, weight);
      featureCount += 1;
    }
  };

  addSingleValue("archetype", user.archetype, 2.5);
  addSingleValue("secondary_archetype", user.secondaryArchetype, 1.25);
  addSingleValue("work_mode", user.workMode, 1.5);
  addSingleValue("education", user.educationLevel, 1.25);
  addSingleValue("industry", user.industryNiche, 1.25);
  addSingleValue("hometown", user.hometown, 0.75);

  addManyValues("language", user.preferredLanguages, 0.75);
  addManyValues("intent", getEffectiveIntent(user), 1);

  if ((user.eventType ?? "饭局") === "酒局") {
    addManyValues("bar_theme", user.barThemes, 0.75);
    addManyValues("alcohol", user.alcoholComfort, 0.5);
  }

  const interestTopics = interests?.topics ?? [];
  const interestHeatMap = interests?.heatMap ?? {};
  for (const topicId of interestTopics.slice(0, 10)) {
    const heat = interestHeatMap[topicId] ?? 0;
    const weight = 1 + clamp(heat, 0, 25) / 25;
    addWeightedToken(vector, `interest:${topicId}`, weight);
    featureCount += 1;
  }

  return {
    userId: user.userId,
    vector: normalizeVector(vector),
    featureCount,
  };
}

export function isSemanticSimilarityEnabled(): boolean {
  return process.env.ENABLE_SEMANTIC_SIMILARITY === "true";
}

export function buildSemanticProfileCache(
  users: SemanticProfileUser[],
  interestsByUserId: Map<string, SemanticInterestProfile>,
): SemanticProfileCache {
  const cache: SemanticProfileCache = new Map();
  for (const user of users) {
    cache.set(user.userId, buildSemanticProfile(user, interestsByUserId.get(user.userId)));
  }
  return cache;
}

export function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length || vectorA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < vectorA.length; index++) {
    dotProduct += vectorA[index] * vectorB[index];
    normA += vectorA[index] * vectorA[index];
    normB += vectorB[index] * vectorB[index];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return clamp(dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)), 0, 1);
}

export function calculateSemanticSimilarityScore(
  user1: SemanticProfileUser,
  user2: SemanticProfileUser,
  cache?: SemanticProfileCache,
): number {
  const profile1 = cache?.get(user1.userId);
  const profile2 = cache?.get(user2.userId);

  if (!profile1 && !profile2) {
    return SEMANTIC_PROFILE_NEUTRAL_SCORE;
  }
  if (!profile1 || !profile2) {
    return SEMANTIC_PROFILE_PARTIAL_DATA_SCORE;
  }
  if (profile1.featureCount === 0 && profile2.featureCount === 0) {
    return SEMANTIC_PROFILE_NEUTRAL_SCORE;
  }
  if (profile1.featureCount === 0 || profile2.featureCount === 0) {
    return SEMANTIC_PROFILE_PARTIAL_DATA_SCORE;
  }

  const similarity = cosineSimilarity(profile1.vector, profile2.vector);
  return Math.round(
    clamp(
      SEMANTIC_SCORE_MIN + similarity * (SEMANTIC_SCORE_MAX - SEMANTIC_SCORE_MIN),
      SEMANTIC_SCORE_MIN,
      SEMANTIC_SCORE_MAX,
    ),
  );
}

export function calculateWeightedPairScore(
  dimensions: {
    chemistry: number;
    interest: number;
    socialAffinity: number;
    backgroundDiversity: number;
    preference: number;
    language: number;
    semanticSimilarity?: number;
  },
  enableSemanticSimilarity = isSemanticSimilarityEnabled(),
): number {
  const weights = enableSemanticSimilarity
    ? SEMANTIC_PAIR_SCORE_WEIGHTS
    : LEGACY_PAIR_SCORE_WEIGHTS;

  const total =
    dimensions.chemistry * weights.chemistry +
    dimensions.interest * weights.interest +
    dimensions.socialAffinity * weights.socialAffinity +
    dimensions.backgroundDiversity * weights.backgroundDiversity +
    dimensions.preference * weights.preference +
    dimensions.language * weights.language +
    (enableSemanticSimilarity
      ? (dimensions.semanticSimilarity ?? 50) * (weights.semanticSimilarity ?? 0)
      : 0);

  return Math.round(total);
}

/**
 * Deterministic pair-compatibility scoring.
 *
 * Extracted verbatim from `poolMatchingService.ts` as a behavior-preserving
 * modularization; the public API is re-exported from `poolMatchingService.ts`.
 */
import type { UserInterestsCache, UserWithProfile } from "./poolMatchingTypes";
import {
  calculateSemanticSimilarityScore,
  calculateWeightedPairScore,
  isSemanticSimilarityEnabled,
  type SemanticProfileCache,
} from "../matchingSemantic";
import { observeSemanticSimilarityMetrics } from "../matchingMetrics";
import type { MatchingWeights } from "../matchingWeightsService";
import type { ChemistryCalibrationMap } from "../archetypeChemistryCalibration";
import {
  shouldHardSkipPair,
  type MatchHistoryLookup,
  type MatchHistorySignal,
} from "../services/matchHistoryDerivation";
import { calculateChemistryScore, resolveChemistryArchetype } from "./chemistryScoring";
import { calculateInterestScoreForPair, getUserInterests } from "./interestScoring";
import {
  calculateBackgroundDiversityScore,
  calculateLanguageScore,
  calculatePreferenceScore,
  calculateSocialAffinityScore,
  getEffectiveIntent,
  pairHasBackgroundDiversityData,
  pairHasPreferenceData,
  pairHasSocialAffinityData,
} from "./pairDimensionScoring";

/**
 * Mutual romance tension bonus: applied post-weight (additive, capped at 100)
 * only when BOTH pair members indicated `romance` intent. Kept deliberately
 * small — a nudge ("一点浪漫张力"), not a pipeline override. One-sided
 * romance receives nothing.
 */
const MUTUAL_ROMANCE_TENSION_BONUS = 5;

/**
 * Pair-score cache key — single source of truth for the precompute loop and
 * any post-hoc cache lookup (e.g. the 磁场引擎 R1 commit gate). The key embeds
 * the weight mode (`semantic`/`legacy`), `|adaptive` (custom weights), and
 * `|v2` (magnetismWeightProfileV2Enabled) so runs with different scoring
 * configs sharing a cache cannot cross-contaminate scores.
 */
function pairScoreCacheKey(
  userId1: string,
  userId2: string,
  semanticSimilarityEnabled: boolean,
  customWeights?: MatchingWeights,
  useWeightProfileV2 = false,
): string {
  const sortedUserIds = userId1 < userId2 ? `${userId1}|${userId2}` : `${userId2}|${userId1}`;
  return `${semanticSimilarityEnabled ? "semantic" : "legacy"}${customWeights ? "|adaptive" : ""}${useWeightProfileV2 ? "|v2" : ""}|${sortedUserIds}`;
}

/**
 * 计算两个用户的配对兼容性分数 (0-100)
 *
 * ✅ ACTIVE 匹配权重配置:
 * - Legacy path (default, 6维度): chemistry 28 / interest 28 / socialAffinity 20 / backgroundDiversity 15 / preference 5 / language 4
 * - Flagged path (ENABLE_SEMANTIC_SIMILARITY=true, 7维度): chemistry 26 / interest 26 / socialAffinity 19 / backgroundDiversity 14 / preference 5 / language 4 / semanticSimilarity 6
 * - Weight profile v2 (magnetismWeightProfileV2Enabled, default OFF): swaps the default tables for
 *   LEGACY/SEMANTIC_PAIR_SCORE_WEIGHTS_V2 (chemistry 20 / interest 32 / socialAffinity 23 / … / language 5;
 *   7D: 19/30/21/14/5/5 + semantic 6). Strictness/adaptive customWeights still short-circuit above it.
 * 
 * Note — Language (4%): 普通话覆盖率高，语言维度区分力有限，保留为轻量兼容信号。
 * Note — Preference (5%): 目前酒吧/饭店活动场景分化有限，保留为轻量场景适配信号。
 */
export async function calculatePairScore(
  user1: UserWithProfile,
  user2: UserWithProfile,
  interestsCache?: UserInterestsCache,
  pairScoreCache?: Map<string, number>,
  semanticProfileCache?: SemanticProfileCache,
  semanticSimilarityEnabled = isSemanticSimilarityEnabled(),
  chemistryCalibrationMap?: ChemistryCalibrationMap,
  customWeights?: MatchingWeights,
  matchHistoryLookup?: MatchHistoryLookup,
  matchNeverMeetSentinelEnabled = false,
  useWeightProfileV2 = false,
  /** Plan Item 10: resolved derived-chemistry flag, threaded (hot path — no per-pair lookup). */
  derivedChemistryEnabled = false,
): Promise<number> {
  const sortedUserIds = user1.userId < user2.userId
    ? `${user1.userId}|${user2.userId}`
    : `${user2.userId}|${user1.userId}`;
  const cacheKey = pairScoreCacheKey(user1.userId, user2.userId, semanticSimilarityEnabled, customWeights, useWeightProfileV2);

  const history: MatchHistorySignal | undefined = matchHistoryLookup?.get(sortedUserIds);
  // -1 hard-skip sentinel is gated behind the matchNeverMeetSentinel flag
  // (default OFF). W6 AC-W6.6b: the named two-strike policy replaces the raw
  // `wouldMeetAgain === false` OR-check — a single negative meeting no longer
  // permanently blocks a pair; >= 2 in-window negatives do. The +5 re-match
  // boost below stays unconditional. The flag is read once per matching run in
  // matchEventPool and threaded in — never per pair.
  if (matchNeverMeetSentinelEnabled && shouldHardSkipPair(history)) return -1;

  if (pairScoreCache?.has(cacheKey)) {
    return pairScoreCache.get(cacheKey)!;
  }

  const chemistry = calculateChemistryScore(user1, user2, chemistryCalibrationMap, derivedChemistryEnabled);
  const interests1 = interestsCache?.get(user1.userId) ?? await getUserInterests(user1.userId);
  const interests2 = interestsCache?.get(user2.userId) ?? await getUserInterests(user2.userId);
  const interestResult = calculateInterestScoreForPair(interests1, interests2);
  const interest = interestResult.score;
  const language = calculateLanguageScore(user1, user2);
  const preference = calculatePreferenceScore(user1, user2);

  const socialAffinity = calculateSocialAffinityScore(user1, user2);
  const backgroundDiversity = calculateBackgroundDiversityScore(user1, user2);
  const semanticSimilarity = semanticSimilarityEnabled
    ? calculateSemanticSimilarityScore(user1, user2, semanticProfileCache)
    : undefined;

  // W6 AC-W6.3: per-dimension availability. A dimension with no usable data is
  // dropped from the weighted denominator instead of being scored with a
  // neutral (which let blank profiles outrank declared ones).
  const availability = {
    chemistry: resolveChemistryArchetype(user1.archetype) !== null && resolveChemistryArchetype(user2.archetype) !== null,
    interest: interestResult.available,
    socialAffinity: pairHasSocialAffinityData(user1, user2),
    backgroundDiversity: pairHasBackgroundDiversityData(user1, user2),
    preference: pairHasPreferenceData(user1, user2),
    language: (user1.preferredLanguages?.length ?? 0) > 0 && (user2.preferredLanguages?.length ?? 0) > 0,
    semanticSimilarity: typeof semanticSimilarity === "number",
  };

  const dimensions = {
    chemistry,
    interest,
    socialAffinity,
    backgroundDiversity,
    preference,
    language,
    semanticSimilarity,
  };
  // legacyScore uses the same weight profile as the main score so the
  // semantic-uplift metric (result - legacyScore) isolates the semantic
  // dimension instead of conflating it with the profile switch.
  const legacyScore = calculateWeightedPairScore(dimensions, false, undefined, useWeightProfileV2, availability);
  let result = calculateWeightedPairScore(dimensions, semanticSimilarityEnabled, customWeights, useWeightProfileV2, availability);

  if (semanticSimilarityEnabled && typeof semanticSimilarity === "number" && !customWeights) {
    observeSemanticSimilarityMetrics(semanticSimilarity, result - legacyScore);
  }

  if (history?.wouldMeetAgain === true) {
    result = Math.min(100, result + 5);
  }

  // Mutual romance tension bonus: when BOTH users indicated `romance` intent,
  // allow a small deterministic nudge — one-sided romance never boosts the
  // pair, and weight tables are untouched (post-weight additive, like the
  // wouldMeetAgain bonus above). Product decision 2026-08-03:
  // docs/deliberations/2026-08-03-romance-intent-option-reinstatement.md
  if (
    getEffectiveIntent(user1).includes("romance") &&
    getEffectiveIntent(user2).includes("romance")
  ) {
    result = Math.min(100, result + MUTUAL_ROMANCE_TENSION_BONUS);
  }

  pairScoreCache?.set(cacheKey, result);
  return result;
}

export { pairScoreCacheKey };

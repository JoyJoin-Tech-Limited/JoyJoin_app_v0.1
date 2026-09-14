/**
 * Group-level quality metrics (pair/chemistry averages, diversity) and
 * presentation helpers (temperature tier + explanation copy).
 *
 * Extracted verbatim from `poolMatchingService.ts` as a behavior-preserving
 * modularization; the public API is re-exported from `poolMatchingService.ts`.
 */
import type {
  GenderBalanceMode,
  MatchGroup,
  UserInterestsCache,
  UserWithProfile,
} from "./poolMatchingTypes";
import { isSemanticSimilarityEnabled, type SemanticProfileCache } from "../matchingSemantic";
import type { MatchingWeights } from "../matchingWeightsService";
import type { ChemistryCalibrationMap } from "../archetypeChemistryCalibration";
import type { MatchHistoryLookup } from "../services/matchHistoryDerivation";
import { calculateChemistryScore } from "./chemistryScoring";
import { groupHasExactGenderBalance } from "./genderBalance";
import { calculatePairScore } from "./pairScoring";

/**
 * 计算小组内所有成员的平均配对兼容性分数
 * 包含默认 6D，或启用特性开关后的 7D（额外包含 semanticSimilarity）
 *
 * `excludePairKeys` (sorted "userA|userB" keys) are skipped entirely — used by
 * 双人成行 duo matching so the duo-internal pair never inflates group quality
 * metrics. Default undefined preserves legacy behavior for all other callers.
 */
async function calculateGroupPairScore(
  members: UserWithProfile[],
  interestsCache?: UserInterestsCache,
  pairScoreCache?: Map<string, number>,
  semanticProfileCache?: SemanticProfileCache,
  semanticSimilarityEnabled = isSemanticSimilarityEnabled(),
  chemistryCalibrationMap?: ChemistryCalibrationMap,
  customWeights?: MatchingWeights,
  matchHistoryLookup?: MatchHistoryLookup,
  matchNeverMeetSentinelEnabled = false,
  useWeightProfileV2 = false,
  excludePairKeys?: Set<string>,
  /** Plan Item 10: resolved derived-chemistry flag, threaded through. */
  derivedChemistryEnabled = false,
): Promise<number> {
  if (members.length < 2) return 0;
  
  let totalScore = 0;
  let pairCount = 0;
  
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      if (
        excludePairKeys &&
        excludePairKeys.has([members[i].userId, members[j].userId].sort().join('|'))
      ) {
        continue;
      }
      const pairScore = await calculatePairScore(
        members[i],
        members[j],
        interestsCache,
        pairScoreCache,
        semanticProfileCache,
        semanticSimilarityEnabled,
        chemistryCalibrationMap,
        customWeights,
        matchHistoryLookup,
        matchNeverMeetSentinelEnabled,
        useWeightProfileV2,
        derivedChemistryEnabled,
      );
      // Skip anti-repetition sentinel (-1) pairs — they should not contaminate the average
      if (pairScore >= 0) {
        totalScore += pairScore;
        pairCount++;
      }
    }
  }
  
  return pairCount > 0 ? Math.round(totalScore / pairCount) : 0;
}

/**
 * Calculate the average chemistry-only score for the group members.
 * Used to populate avgChemistryScore (distinct from avgPairScore).
 */
function calculateGroupChemistryScore(
  members: UserWithProfile[],
  chemistryCalibrationMap?: ChemistryCalibrationMap,
  excludePairKeys?: Set<string>,
  /** Plan Item 10: resolved derived-chemistry flag, threaded through. */
  derivedChemistryEnabled = false,
): number {
  if (members.length < 2) return 0;
  let total = 0;
  let count = 0;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      if (
        excludePairKeys &&
        excludePairKeys.has([members[i].userId, members[j].userId].sort().join('|'))
      ) {
        continue;
      }
      total += calculateChemistryScore(members[i], members[j], chemistryCalibrationMap, derivedChemistryEnabled);
      count++;
    }
  }
  return count > 0 ? Math.round(total / count) : 0;
}

/**
 * Calculate group diversity score
 * Evaluates diversity across industries, genders, archetypes, and life stages
 *
 * D8 (soft mode): when the group achieves exact gender balance (equal disclosed
 * male/female counts), `genderBalanceBonusPoints` is added POST-CLAMP so the
 * bonus stays observable for high-diversity groups — a pre-clamp bonus would be
 * eaten by the [0,100] clamp. The bonus may push the result beyond 100;
 * downstream overall-score math and temperature tiers tolerate that.
 * Defaults (`"none"`, 0) preserve pre-change behavior for legacy call sites.
 */
export function calculateGroupDiversity(
  members: UserWithProfile[],
  genderBalanceMode: GenderBalanceMode = "none",
  genderBalanceBonusPoints = 0,
): number {
  if (members.length === 0) return 0;

  const uniqueIndustries = new Set(members.map((m) => m.industryNiche).filter(Boolean)).size;
  const uniqueGenders = new Set(members.map((m) => m.gender).filter(Boolean)).size;
  const uniqueArchetypes = new Set(members.map((m) => m.archetype).filter(Boolean)).size;
  const uniqueLifeStages = new Set(members.map((m) => m.lifeStage).filter(Boolean)).size; // 人生阶段

  // Normalize to 0-100, each of 4 dimensions contributes 25 points
  const maxDiversity = members.length;
  const diversityScore =
    (uniqueIndustries / maxDiversity) * 25 +
    (uniqueGenders / maxDiversity) * 25 +
    (uniqueArchetypes / maxDiversity) * 25 +
    (uniqueLifeStages / maxDiversity) * 25;

  // Clamp to [0, 100] to avoid any floating point drift
  const clamped = Math.round(Math.max(0, Math.min(100, diversityScore)));

  if (
    genderBalanceMode === "soft" &&
    genderBalanceBonusPoints > 0 &&
    groupHasExactGenderBalance(members)
  ) {
    return clamped + genderBalanceBonusPoints;
  }

  return clamped;
}


/**
 * 根据综合分数获取化学反应温度等级
 */
function getTemperatureLevel(overallScore: number): string {
  if (overallScore >= 85) return "fire";    // 🔥炽热
  if (overallScore >= 70) return "warm";    // 🌡️温暖
  if (overallScore >= 55) return "mild";    // 🌤️适宜
  return "cold";                             // ❄️冷淡
}

/**
 * 获取温度等级的emoji显示
 */
export function getTemperatureEmoji(temperatureLevel: string): string {
  const emojiMap: Record<string, string> = {
    "fire": "🔥",
    "warm": "🌡️",
    "mild": "🌤️",
    "cold": "❄️"
  };
  return emojiMap[temperatureLevel] || "🌤️";
}

/**
 * 生成小组匹配解释文案
 */
function generateGroupExplanation(group: MatchGroup): string {
  const archetypes = group.members.map(m => m.archetype || "未知").filter((v, i, a) => a.indexOf(v) === i);
  const industries = group.members.map(m => m.industryNicheLabel || m.industryCategoryLabel || "未知").filter((v, i, a) => a.indexOf(v) === i);
  const tempEmoji = getTemperatureEmoji(group.temperatureLevel);
  
  return `${tempEmoji} 这个小组有${group.members.length}位成员，包含${archetypes.length}种人格类型（${archetypes.join("、")}），来自${industries.length}个行业。配对兼容性${group.avgPairScore}分，多样性${group.diversityScore}分，能量平衡${group.communicationBalance}分，综合匹配度${group.overallScore}分。`;
}

export {
  calculateGroupPairScore,
  calculateGroupChemistryScore,
  getTemperatureLevel,
  generateGroupExplanation,
};

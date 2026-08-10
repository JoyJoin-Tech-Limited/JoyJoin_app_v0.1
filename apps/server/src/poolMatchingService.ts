
//my path:/Users/felixg/projects/JoyJoin3/server/poolMatchingService.ts
/**
 * Pool-Based Matching Service (池内匹配服务)
 * 两阶段匹配模型 - Stage 2: 用户报名后，在活动池内进行智能分组
 * 
 * 匹配逻辑：
 * 1. 硬约束过滤：检查用户是否符合活动池的硬性限制（性别、行业、年龄等）
 * 2. 软约束评分：基于6个维度计算用户之间的配对兼容性分数
 *    - Chemistry     (性格化学反应):  28%  — 原型兼容性矩阵
 *    - Interest      (兴趣重叠度):    28%  — Heat 加权 Jaccard 相似度
 *    - Social Affinity (社交同频度):  20%  — 人生阶段亲和力 + 学历同频 + 同乡亲和（可选）
 *    - Background Diversity (背景多样性): 15% — 行业多样性 + 性别多样性
 *    - Preference    (活动偏好):       5%  — 社交目的 + 酒局偏好（低权重：场景分化力有限）
 *    - Language      (语言沟通):       4%  — 语言共同覆盖（低权重：普通话普及率高，区分度低）
 * 3. 智能分组：使用贪婪+优化算法形成高质量小组
 */

import { db } from "./db";
import { 
  eventPools, 
  eventPoolRegistrations, 
  eventPoolGroups,
  events,
  eventAttendance,
  blindBoxEvents,
  users, 
  userInterests,
  invitationUses,
  invitations,
  coupons,
  userCoupons,
  matchHistory,
} from "@shared/schema";
import { eq, and, inArray, isNull, sql } from "drizzle-orm";
import { logger } from "./lib/logger";
import { calculateAge } from "@shared/utils";
import { INTEREST_TAXONOMY } from "@shared/interests";
import { getFeatureFlag } from "./lib/featureFlags";
import { ARCHETYPE_ENERGY } from "./archetypeChemistry";
import type { ArchetypeName } from "./archetypeConfig";
import {
  getArchetypePairCalibrationMap,
  getCalibratedChemistryScore,
  type ChemistryCalibrationMap,
} from "./archetypeChemistryCalibration";
import { generateEventThemeTitle } from "./services/eventThemeTitleGenerator";
import {
  buildSemanticProfileCache,
  calculateSemanticSimilarityScore,
  calculateWeightedPairScore,
  isSemanticSimilarityEnabled,
  isAdaptiveWeightsEnabled,
  type SemanticProfileCache,
} from "./matchingSemantic";
import { observeSemanticSimilarityMetrics } from "./matchingMetrics";
import { matchingWeightsService, type MatchingWeights } from "./matchingWeightsService";
import { executePostMatchCommitSideEffects } from "./lib/matchingPostMatchEffects";












export interface UserWithProfile {
  userId: string;
  registrationId: string;
  
  // User profile (permanent)
  gender: string | null;
  birthdate: string | null; // Used to calculate age at matching time
  // ✅ UPDATED: Use 3-tier industry classification instead of legacy industry field
  industryNiche: string | null;  // Layer 3 industry (most specific)
  industryNicheLabel: string | null;  // Display name for industry niche
  industryCategoryLabel: string | null;  // Layer 1 display (fallback if niche not available)
  educationLevel: string | null;
  archetype: string | null;
  secondaryArchetype: string | null;
  lifeStage: string | null; // 人生阶段 (学生党 | 职场新人 | 职场老手 | 创业中 | 自由职业)
  workMode: string | null;  // DEPRECATED: kept for one-release fallback only
  // ❌ REMOVED: interestsTop - now use getUserInterests() to fetch from user_interests table
  hometown: string | null;  // 家乡（用于同乡亲和力）
  hometownAffinityOptin: boolean;  // 是否启用同乡匹配加分
  
  // Event preferences (temporary, from registration)
  budgetRange: string[] | null;  // 饭局预算
  barBudgetRange: string[] | null;  // 酒局预算（每杯）
  preferredLanguages: string[] | null;
  eventIntent: string[] | null;  // ✅ RENAMED from socialGoals - 本次活动社交目的
  userIntent: string[] | null;   // 用户档案默认社交偏好（fallback when eventIntent empty）
  cuisinePreferences: string[] | null;  // consumed post-match by venueAssignmentService.calculateCuisineMatch
  dietaryRestrictions: string[] | null;
  
  // 酒局特有偏好
  barThemes: string[] | null;  // 酒吧主题偏好
  alcoholComfort: string[] | null;  // 饮酒程度偏好
  
  // 活动类型（用于判断使用哪种预算）
  eventType: string | null;
  
  // New matching signals
  ageMatchPreference: string | null;
  tableVibePreference: string | null;

  // Match Compass preferences
  preferenceStrictness: number | null;
  genderCompositionPreference: string | null;
}

export interface MatchGroup {
  members: UserWithProfile[];
  avgPairScore: number;  // 平均配对兼容性分数（默认 6D；启用语义特性后为 7D）
  avgChemistryScore: number;  // 平均化学反应分数
  diversityScore: number;  // 小组多样性分数
  communicationBalance: number;  // 能量平衡分数（0-100，评估小组社交能量分布的健康程度，来自ARCHETYPE_ENERGY）
  overallScore: number;  // 综合分数 = avgPairScore × 0.6 + diversityScore × 0.25 + communicationBalance × 0.15
  temperatureLevel: string;  // 化学反应温度等级：fire(🔥炽热85+) | warm(🌡️温暖70-84) | mild(🌤️适宜55-69) | cold(❄️冷淡<55)
  explanation: string;
}

export interface SaveMatchResultsOptions {
  predictiveExperimentArm: "control" | "treatment" | null;
  predictiveRerankApplied: boolean;
  predictiveRerankSummary: {
    modelVersion?: string | null;
    audits?: Array<{
      deterministicRank: number;
      finalRank: number;
      predictedRank: number;
      predictedScore: number;
      predictedOutcomeRate: number;
      confidence: number;
    }>;
    confidenceThreshold?: number;
    maxPositionShift?: number;
    reason?: string;
    autoDisabledReason?: string | null;
  };
}

/**
 * 硬约束检查：验证用户是否符合活动池的所有限制
 * ✅ UPDATED: Added budget as L1 hard constraint
 * ✅ Match Compass: accepts optional strictness parameter for future dealbreaker expansion
 */
function meetsHardConstraints(
  user: UserWithProfile, 
  pool: typeof eventPools.$inferSelect,
  _strictness?: number,
): boolean {
  // 性别限制
  if (pool.genderRestriction && user.gender !== pool.genderRestriction) {
    return false;
  }
  
  // 行业限制
  // ✅ UPDATED: Use industryNiche for matching (Layer 3 of 3-tier classification)
  if (pool.industryRestrictions && pool.industryRestrictions.length > 0) {
    if (!user.industryNiche || !pool.industryRestrictions.includes(user.industryNiche)) {
      return false;
    }
  }
  
  // Seniority restrictions (DEPRECATED - field no longer collected from users)
  // Skip this check since seniority is not collected during onboarding
  // if (pool.seniorityRestrictions && pool.seniorityRestrictions.length > 0) {
  //   if (!user.seniority || !pool.seniorityRestrictions.includes(user.seniority)) {
  //     return false;
  //   }
  // }
  
  // 学历限制
  if (pool.educationLevelRestrictions && pool.educationLevelRestrictions.length > 0) {
    if (!user.educationLevel || !pool.educationLevelRestrictions.includes(user.educationLevel)) {
      return false;
    }
  }
  
  // 年龄限制 (calculated from birthdate)
  const userAge = user.birthdate ? calculateAge(user.birthdate) : null;
  if (pool.ageRangeMin && userAge !== null && userAge < pool.ageRangeMin) {
    return false;
  }
  if (pool.ageRangeMax && userAge !== null && userAge > pool.ageRangeMax) {
    return false;
  }
  
  // ✅ NEW: Budget hard constraint (L1)
  const eventType = pool.eventType || "饭局";
  
  if (eventType === "酒局") {
    // 酒局预算限制
    if (pool.barBudgetRestrictions && pool.barBudgetRestrictions.length > 0) {
      const userBudget = user.barBudgetRange || [];
      const hasOverlap = userBudget.some(b => pool.barBudgetRestrictions!.includes(b));
      if (!hasOverlap) {
        logger.info(`[Matching] User ${user.userId} filtered out: bar budget mismatch`);
        return false;
      }
    }
  } else {
    // 饭局预算限制
    if (pool.budgetRestrictions && pool.budgetRestrictions.length > 0) {
      const userBudget = user.budgetRange || [];
      const hasOverlap = userBudget.some(b => pool.budgetRestrictions!.includes(b));
      if (!hasOverlap) {
        logger.info(`[Matching] User ${user.userId} filtered out: budget mismatch`);
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Match Compass dealbreaker check: evaluates whether two users are compatible
 * based on explicit user-level dealbreakers when strictness < 50.
 * At strictness >= 50, all pairs pass (dealbreakers are ignored).
 */
export function pairMeetsDealbreakers(
  user1: UserWithProfile,
  user2: UserWithProfile,
  strictness: number,
): boolean {
  if (strictness >= 50) return true;

  // Gender composition dealbreaker
  if (user1.genderCompositionPreference === "female_only" && user2.gender === "男性") {
    return false;
  }
  if (user2.genderCompositionPreference === "female_only" && user1.gender === "男性") {
    return false;
  }

  return true;
}

/**
 * 计算两个用户之间的性格化学反应分数 (0-100)
 * 考虑主角色（70%）和次要角色的交叉兼容性（各15%，共30%）
 * (vibeVector blend removed 2026-08: dead branch — no production writer of users.vibeVector)
 */
export function calculateChemistryScore(
  user1: UserWithProfile,
  user2: UserWithProfile,
  chemistryCalibrationMap?: ChemistryCalibrationMap,
): number {
  const primary1 = (user1.archetype || "koala") as ArchetypeName;
  const primary2 = (user2.archetype || "koala") as ArchetypeName;
  const secondary1 = (user1.secondaryArchetype || "koala") as ArchetypeName;
  const secondary2 = (user2.secondaryArchetype || "koala") as ArchetypeName;

  // 主角色化学反应（70%权重）
  const primaryChemistryRaw = getCalibratedChemistryScore(primary1, primary2, chemistryCalibrationMap);
  const primaryChemistry = primaryChemistryRaw * 0.70;

  // 次要角色交叉加成（各15%权重，共30%）
  const crossChemistry1Raw = getCalibratedChemistryScore(primary1, secondary2, chemistryCalibrationMap);
  const crossChemistry2Raw = getCalibratedChemistryScore(secondary1, primary2, chemistryCalibrationMap);
  const crossChemistry1 = crossChemistry1Raw * 0.15;
  const crossChemistry2 = crossChemistry2Raw * 0.15;

  const score = primaryChemistry + crossChemistry1 + crossChemistry2;

  // Temporary debug log for Phase 0 verification (OBS-01)
  if (primaryChemistryRaw === 50) {
    logger.warn(`[ChemistryDebug] Primary chemistry defaulted to 50 for pair: ${primary1} × ${primary2}`);
  }

  return Math.round(score);
}

/**
 * Per-run user interest cache type.
 * Key: userId → { topics, heatMap }
 */
export type UserInterestsCache = Map<string, { topics: string[]; heatMap: Record<string, number> }>;

/**
 * 获取用户兴趣 (统一从 user_interests 表)
 * @returns { topics: string[], heatMap: Record<string, number> }
 */
async function getUserInterests(userId: string): Promise<{
  topics: string[];
  heatMap: Record<string, number>;
}> {
  const result = await db
    .select()
    .from(userInterests)
    .where(eq(userInterests.userId, userId))
    .limit(1);
  
  if (result.length === 0) {
    return { topics: [], heatMap: {} };
  }
  
  const selections = result[0].selections as any[];
  
  return {
    topics: selections.map((s: any) => s.topicId),
    heatMap: Object.fromEntries(
      selections.map((s: any) => [s.topicId, s.heat])
    )
  };
}

/**
 * Preload user_interests for a list of userIds in one batch query.
 * Returns a cache map: userId -> { topics, heatMap }.
 * Used to avoid N×(N-1)/2 repeated DB lookups inside pair-score loops.
 */
export async function preloadUserInterests(userIds: string[]): Promise<UserInterestsCache> {
  const cache: UserInterestsCache = new Map();
  if (userIds.length === 0) return cache;

  const rows = await db
    .select()
    .from(userInterests)
    .where(inArray(userInterests.userId, userIds));

  for (const row of rows) {
    const selections = (row.selections as any[]) || [];
    cache.set(row.userId, {
      topics: selections.map((s: any) => s.topicId),
      heatMap: Object.fromEntries(selections.map((s: any) => [s.topicId, s.heat])),
    });
  }

  // Fill missing users with empty interests so every userId has an entry
  for (const userId of userIds) {
    if (!cache.has(userId)) {
      cache.set(userId, { topics: [], heatMap: {} });
    }
  }

  return cache;
}

/**
 * 计算兴趣重叠度 (Heat Level 加权 Jaccard)
 * 使用 user_interests 表中的兴趣选择和热度信息
 *
 * BOUNDARY INVARIANT: this function reads ONLY from `user_interests`.
 * `user_interest_signals` (discussion style / conversation depth) are intentionally
 * excluded from deterministic pair scoring. They are valid only for prompt
 * enrichment in matchExplanationService / conversationTopicsService.
 * Do NOT add user_interest_signals reads to this function.
 */
export async function calculateInterestScoreAsync(
  user1Id: string,
  user2Id: string,
  cache?: UserInterestsCache,
): Promise<number> {
  const interests1 = cache?.get(user1Id) ?? await getUserInterests(user1Id);
  const interests2 = cache?.get(user2Id) ?? await getUserInterests(user2Id);
  
  if (interests1.topics.length === 0 && interests2.topics.length === 0) {
    return 70; // 默认中等分数
  }
  if (interests1.topics.length === 0 || interests2.topics.length === 0) {
    return 30; // 一方缺失数据
  }
  
  // 基础重叠 (Jaccard)
  const commonTopics = interests1.topics.filter(t => 
    interests2.topics.includes(t)
  );
  const union = new Set([...interests1.topics, ...interests2.topics]);
  const jaccardRatio = commonTopics.length / union.size;
  const baseScore = Math.round(jaccardRatio * 85 + 15);
  
  // Heat Level 加权匹配
  let heatBonus = 0;
  for (const topic of commonTopics) {
    const heat1 = interests1.heatMap[topic] || 0;
    const heat2 = interests2.heatMap[topic] || 0;
    
    if (heat1 === 25 && heat2 === 25) {
      heatBonus += 15; // 双方都是 level 3
    } else if (heat1 === 10 && heat2 === 10) {
      heatBonus += 8;  // 双方都是 level 2
    } else if ((heat1 === 25 && heat2 === 10) || (heat1 === 10 && heat2 === 25)) {
      heatBonus += 10; // 一方 level 3, 一方 level 2
    } else if (heat1 > 0 && heat2 > 0) {
      heatBonus += 3;  // 其他情况
    }
  }
  
  heatBonus = Math.min(heatBonus, 20);

  return Math.min(100, baseScore + heatBonus);
}

/**
 * 计算兴趣重叠度 (0-100) - Legacy同步版本
 * 使用Jaccard系数：交集 / 并集
 * @deprecated 保留用于向后兼容，新代码应使用 calculateInterestScoreAsync
 * Note: interestsTop field removed - returning default score
 */
function calculateInterestScore(user1: UserWithProfile, user2: UserWithProfile): number {
  // interestsTop field was removed - return default middle score
  return 70; // Default middle score since interests are now managed separately
  
  /* Legacy code (commented out since interestsTop was removed):
  const interests1 = user1.interestsTop || [];
  const interests2 = user2.interestsTop || [];
  
  if (interests1.length === 0 && interests2.length === 0) return 70; // 都没有兴趣记录，默认中等分数
  if (interests1.length === 0 || interests2.length === 0) return 30; // 一方没有记录，低分
  
  const overlap = interests1.filter((i: string) => interests2.includes(i)).length;
  const union = new Set([...interests1, ...interests2]).size;
  
  // Jaccard系数：(交集大小 / 并集大小) * 85 + 15
  // 无重叠=15分，完全重叠=100分
  const jaccardRatio = overlap / union;
  return Math.round(jaccardRatio * 85 + 15);
  */
}

/**
 * 计算语言沟通兼容性 (0-100)
 * ✅ UPDATED: Uses preferredLanguages from event registration
 */
export function calculateLanguageScore(user1: UserWithProfile, user2: UserWithProfile): number {
  const langs1 = user1.preferredLanguages || [];
  const langs2 = user2.preferredLanguages || [];
  
  if (langs1.length === 0 || langs2.length === 0) return 70; // 默认假设可以沟通
  
  const overlap = langs1.filter(l => langs2.includes(l)).length;
  return overlap > 0 ? 100 : 30; // 有共同语言=100，无共同语言=30
}

/**
 * Get effective intent for matching with fallback chain:
 * 1. Event-specific intent (eventIntent from registration)
 * 2. User's global profile intent (users.intent)
 * 3. No-intent fallback (empty array = flexible / no preference)
 */
function getEffectiveIntent(user: UserWithProfile): string[] {
  const isValidIntent = (v: unknown): v is string[] => Array.isArray(v) && (v as string[]).length > 0;
  if (isValidIntent(user.eventIntent)) return user.eventIntent;
  if (isValidIntent(user.userIntent)) return user.userIntent;
  // No explicit intent provided: treat as no preference (empty list),
  // so intent scoring can fall back to the neutral/default score.
  return [];
}

/**
 * 计算活动偏好兼容性 (0-100)
 * ✅ UPDATED: Removed budget (now L1 hard constraint) and food preferences (deprecated)
 * Only score: eventIntent overlap + barThemes/alcoholComfort for 酒局
 */
const DEFAULT_PREFERENCE_SCORE = 70; // Default compatibility when no preference data available

export function calculatePreferenceScore(user1: UserWithProfile, user2: UserWithProfile): number {
  let score = 0;
  let factors = 0;
  
  const eventType = user1.eventType || user2.eventType || "饭局";
  
  if (eventType === "酒局") {
    const barThemes1 = user1.barThemes || [];
    const barThemes2 = user2.barThemes || [];
    if (barThemes1.length > 0 && barThemes2.length > 0) {
      const themeOverlap = barThemes1.filter(t => barThemes2.includes(t)).length;
      score += (themeOverlap / Math.max(barThemes1.length, barThemes2.length)) * 100;
      factors++;
    }
    
    const alcohol1 = user1.alcoholComfort || [];
    const alcohol2 = user2.alcoholComfort || [];
    if (alcohol1.length > 0 && alcohol2.length > 0) {
      const alcoholOverlap = alcohol1.filter(a => alcohol2.includes(a)).length;
      score += (alcoholOverlap / Math.max(alcohol1.length, alcohol2.length)) * 100;
      factors++;
    }
  }
  
  const diet1 = user1.dietaryRestrictions || [];
  const diet2 = user2.dietaryRestrictions || [];
  if (diet1.length > 0 || diet2.length > 0) {
    // Only one side has restrictions: no conflict → 100
    if (diet1.length === 0 || diet2.length === 0) {
      score += 100;
    } else {
      // Both have restrictions: compute overlap ratio
      const allDiets = new Set([...diet1, ...diet2]);
      const shared = diet1.filter(d => diet2.includes(d));
      const compatibility = allDiets.size > 0
        ? (shared.length / allDiets.size) * 100
        : 100;
      score += Math.min(compatibility, 100);
    }
    factors++;
  }
  
  const goals1Raw = getEffectiveIntent(user1);
  const goals2Raw = getEffectiveIntent(user2);
  const goals1 = goals1Raw.filter(g => g !== "flexible");
  const goals2 = goals2Raw.filter(g => g !== "flexible");
  if (goals1.length > 0 && goals2.length > 0) {
    const goalsOverlap = goals1.filter(g => goals2.includes(g)).length;
    score += (goalsOverlap / Math.max(goals1.length, goals2.length)) * 100;
    factors++;
  }
  
  return factors > 0 ? Math.round(score / factors) : DEFAULT_PREFERENCE_SCORE;
}

/**
 * 计算同乡亲和力分数 (0-100)
 * 仅当双方都启用同乡匹配时生效
 */
export function calculateHometownAffinityScore(user1: UserWithProfile, user2: UserWithProfile): number {
  // 仅当双方都启用同乡匹配且都有家乡信息时才计算
  if (!user1.hometownAffinityOptin || !user2.hometownAffinityOptin) {
    return 0; // 未启用，返回0（不参与加分）
  }
  
  if (!user1.hometown || !user2.hometown) {
    return 0; // 缺少家乡信息
  }
  
  // 完全匹配：100分
  if (user1.hometown === user2.hometown) {
    return 100;
  }
  
  // 同省匹配：提取省份并比较（简化处理）
  const getProvince = (hometown: string): string => {
    // 处理直辖市和常见省份格式
    const directCities = ["北京", "上海", "天津", "重庆"];
    for (const city of directCities) {
      if (hometown.includes(city)) return city;
    }
    // 提取省份（假设格式为"省份+城市"或"省份"）
    const provinces = ["广东", "广西", "湖南", "湖北", "四川", "江苏", "浙江", "福建", "山东", "河南", "河北", "陕西", "甘肃", "云南", "贵州", "江西", "安徽", "辽宁", "吉林", "黑龙江", "内蒙古", "新疆", "西藏", "青海", "宁夏", "海南", "山西"];
    for (const prov of provinces) {
      if (hometown.includes(prov)) return prov;
    }
    return hometown;
  };
  
  const province1 = getProvince(user1.hometown);
  const province2 = getProvince(user2.hometown);
  
  if (province1 === province2) {
    return 70; // 同省：70分
  }
  
  return 0; // 不同省：不加分
}

/**
 * 人生阶段 Aspiration Affinity Matrix (5×5)
 * Score 0-100: How much person in row WANTS to meet person in column
 * Uses the canonical lifeStage vocabulary: 学生党, 职场新人, 职场老手, 创业中, 自由职业.
 * We average both directions for the pair score.
 */
/** Neutral score returned when a user has no lifeStage set (neither a boost nor a penalty). */
const NEUTRAL_LIFE_STAGE_SCORE = 50;

const LIFE_STAGE_AFFINITY: Record<string, Record<string, number>> = {
  //                       学生党  职场新人  职场老手  创业中  自由职业
  "学生党":   { "学生党": 70, "职场新人": 75, "职场老手": 80, "创业中": 85, "自由职业": 70 },
  "职场新人": { "学生党": 80, "职场新人": 65, "职场老手": 70, "创业中": 85, "自由职业": 65 },
  "职场老手": { "学生党": 70, "职场新人": 75, "职场老手": 60, "创业中": 75, "自由职业": 65 },
  "创业中":   { "学生党": 75, "职场新人": 80, "职场老手": 75, "创业中": 85, "自由职业": 75 },
  "自由职业": { "学生党": 65, "职场新人": 65, "职场老手": 65, "创业中": 75, "自由职业": 70 },
};

/**
 * 计算人生阶段亲和力分数 (0-100)
 * Uses asymmetric aspiration matrix averaged both directions.
 * Intent modulation: networking boosts cross-stage affinity, fun dampens it.
 */
export function calculateLifeStageAffinity(user1: UserWithProfile, user2: UserWithProfile): number {
  if (!user1.lifeStage || !user2.lifeStage) return NEUTRAL_LIFE_STAGE_SCORE;

  const baseForward = LIFE_STAGE_AFFINITY[user1.lifeStage]?.[user2.lifeStage] ?? NEUTRAL_LIFE_STAGE_SCORE;
  const baseReverse = LIFE_STAGE_AFFINITY[user2.lifeStage]?.[user1.lifeStage] ?? NEUTRAL_LIFE_STAGE_SCORE;

  // Intent modulation: networking intent amplifies cross-stage affinity
  const intent1 = getEffectiveIntent(user1);
  const intent2 = getEffectiveIntent(user2);

  const user1NetworkingBoost = intent1.includes('networking') ? 1.2 : 1.0;
  const user2NetworkingBoost = intent2.includes('networking') ? 1.2 : 1.0;

  // Fun intent dampens career-stage sensitivity
  const user1FunDampen = intent1.includes('fun') ? 0.7 : 1.0;
  const user2FunDampen = intent2.includes('fun') ? 0.7 : 1.0;

  const forward = Math.min(baseForward * user1NetworkingBoost * user1FunDampen, 100);
  const reverse = Math.min(baseReverse * user2NetworkingBoost * user2FunDampen, 100);

  return Math.round((forward + reverse) / 2);
}

/**
 * Education level ordinal mapping for proximity-based affinity scoring.
 * Closer ordinal values → higher affinity score (同频).
 * 中专 and 大专 share ordinal 1 as parallel vocational/associate tracks at the same level.
 */
const EDUCATION_ORDINAL: Record<string, number> = {
  "高中及以下": 0,
  "中专": 1,
  "大专": 1,   // parallel vocational track — same level as 中专
  "本科": 2,
  "硕士": 3,
  "博士": 4,
};

/**
 * Calculate education affinity score (0-100).
 * AFFINITY model: same or nearby education level = higher score (学历同频度).
 * This is NOT a diversity signal — closer levels score better.
 */
export function calculateEducationAffinityScore(edu1: string, edu2: string): number {
  const ord1 = EDUCATION_ORDINAL[edu1] ?? -1;
  const ord2 = EDUCATION_ORDINAL[edu2] ?? -1;
  if (ord1 === -1 || ord2 === -1) return 50; // unknown level → neutral
  const distance = Math.abs(ord1 - ord2);
  if (distance === 0) return 100;
  if (distance === 1) return 75;
  if (distance === 2) return 50;
  return 25; // distance >= 3
}

/**
 * Calculate age match preference compatibility (0-100).
 */
function calculateAgePreferenceAffinity(
  pref1: string | null,
  pref2: string | null,
): number {
  if (!pref1 || !pref2) return 50;
  if (pref1 === pref2) return 100;
  if (pref1 === "都可以" || pref2 === "都可以") return 75;
  const complementary =
    (pref1 === "偏年轻" && pref2 === "偏成熟") ||
    (pref1 === "偏成熟" && pref2 === "偏年轻");
  if (complementary) return 70;
  return 40;
}

/**
 * Calculate table vibe preference compatibility (0-100).
 */
function calculateVibePreferenceAffinity(
  vibe1: string | null,
  vibe2: string | null,
): number {
  if (!vibe1 || !vibe2) return 50;
  if (vibe1 === vibe2) return 100;
  const compatible = ['light_fun', 'natural_chat'];
  if (compatible.includes(vibe1) && compatible.includes(vibe2)) return 75;
  if ((vibe1 === 'deep_talk' && vibe2 === 'natural_chat') ||
      (vibe2 === 'deep_talk' && vibe1 === 'natural_chat')) return 65;
  if ((vibe1 === 'deep_talk' && vibe2 === 'light_fun') ||
      (vibe2 === 'deep_talk' && vibe1 === 'light_fun')) return 30;
  return 50;
}

/**
 * Calculate Social Affinity score (0-100) — 社交同频度
 * Captures same-frequency / resonance-style signals:
 *   - Life stage affinity
 *   - Education affinity
 *   - Hometown affinity (opt-in)
 *   - Age preference affinity (NEW)
 *   - Table vibe preference affinity (NEW)
 */
function calculateSocialAffinityScore(user1: UserWithProfile, user2: UserWithProfile): number {
  let score = 0;
  let factors = 0;

  if (user1.lifeStage && user2.lifeStage) {
    score += calculateLifeStageAffinity(user1, user2);
    factors++;
  }

  if (user1.educationLevel && user2.educationLevel) {
    score += calculateEducationAffinityScore(user1.educationLevel, user2.educationLevel);
    factors++;
  }

  if (user1.hometownAffinityOptin && user2.hometownAffinityOptin) {
    score += calculateHometownAffinityScore(user1, user2);
    factors++;
  }

  if (user1.ageMatchPreference && user2.ageMatchPreference) {
    score += calculateAgePreferenceAffinity(user1.ageMatchPreference, user2.ageMatchPreference);
    factors++;
  }

  if (user1.tableVibePreference && user2.tableVibePreference) {
    score += calculateVibePreferenceAffinity(user1.tableVibePreference, user2.tableVibePreference);
    factors++;
  }

  return factors > 0 ? Math.round(score / factors) : 50;
}

/**
 * Calculate Background Diversity score (0-100) — 背景多样性
 * Captures diversity-oriented dimensions (different background = higher score):
 *   - Industry diversity (行业多样性)
 *   - Gender diversity (性别多样性)
 * Note: Education is an AFFINITY signal (see calculateSocialAffinityScore), not diversity.
 */
const DIVERSITY_DIFFERENT_SCORE = 70;
const DIVERSITY_SAME_SCORE = 30;

export function calculateBackgroundDiversityScore(user1: UserWithProfile, user2: UserWithProfile): number {
  let score = 0;
  let factors = 0;

  // Industry diversity: different industry = higher score
  if (user1.industryNiche && user2.industryNiche) {
    score += user1.industryNiche !== user2.industryNiche ? DIVERSITY_DIFFERENT_SCORE : DIVERSITY_SAME_SCORE;
    factors++;
  }

  // Gender diversity: different gender = higher score
  if (user1.gender && user2.gender) {
    score += user1.gender !== user2.gender ? DIVERSITY_DIFFERENT_SCORE : DIVERSITY_SAME_SCORE;
    factors++;
  }

  return factors > 0 ? Math.round(score / factors) : 50;
}

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
  matchHistoryLookup?: Map<string, { wouldMeetAgain: boolean | null }>,
  matchNeverMeetSentinelEnabled = false,
  useWeightProfileV2 = false,
): Promise<number> {
  const sortedUserIds = user1.userId < user2.userId
    ? `${user1.userId}|${user2.userId}`
    : `${user2.userId}|${user1.userId}`;
  const cacheKey = pairScoreCacheKey(user1.userId, user2.userId, semanticSimilarityEnabled, customWeights, useWeightProfileV2);

  const history = matchHistoryLookup?.get(sortedUserIds);
  // -1 hard-skip sentinel is gated behind the matchNeverMeetSentinel flag
  // (default OFF — policy-pending, see docs/systems/MAGNETISM_ENGINE.md §7).
  // The +5 re-match boost below stays unconditional. The flag is read once
  // per matching run in matchEventPool and threaded in — never per pair.
  if (matchNeverMeetSentinelEnabled && history?.wouldMeetAgain === false) return -1;

  if (pairScoreCache?.has(cacheKey)) {
    return pairScoreCache.get(cacheKey)!;
  }

  const chemistry = calculateChemistryScore(user1, user2, chemistryCalibrationMap);
  const interest = await calculateInterestScoreAsync(user1.userId, user2.userId, interestsCache);
  const language = calculateLanguageScore(user1, user2);
  const preference = calculatePreferenceScore(user1, user2);

  const socialAffinity = calculateSocialAffinityScore(user1, user2);
  const backgroundDiversity = calculateBackgroundDiversityScore(user1, user2);
  const semanticSimilarity = semanticSimilarityEnabled
    ? calculateSemanticSimilarityScore(user1, user2, semanticProfileCache)
    : undefined;

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
  const legacyScore = calculateWeightedPairScore(dimensions, false, undefined, useWeightProfileV2);
  let result = calculateWeightedPairScore(dimensions, semanticSimilarityEnabled, customWeights, useWeightProfileV2);

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
  matchHistoryLookup?: Map<string, { wouldMeetAgain: boolean | null }>,
  matchNeverMeetSentinelEnabled = false,
  useWeightProfileV2 = false,
  excludePairKeys?: Set<string>,
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
      total += calculateChemistryScore(members[i], members[j], chemistryCalibrationMap);
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
 * Calculate group energy balance score (0-100)
 * Evaluates whether the group has a healthy mix of social energy levels.
 * 
 * Two components (equal weight):
 *   1. avgScore     — penalises groups where mean energy is too high (>70, chaotic) or too low (<50, silent)
 *   2. harmonyScore — penalises high energy variance (all same energy = can be boring; extreme spread = tension)
 * 
 * Ideal group: mean energy 50–70, moderate variance (some high + some low = natural dynamic)
 * 
 * Source for energy values: ARCHETYPE_ENERGY in apps/server/src/archetypeChemistry.ts
 * DB column: energy_balance (integer) in event_pool_groups table
 */
export function calculateEnergyBalance(members: UserWithProfile[]): number {
  if (members.length < 2) return 50;

  // Look up energy for each member's primary archetype; default to 60 (mid) if unknown
  const energyLevels = members.map(userArchetypeEnergy);

  const avgEnergy = energyLevels.reduce((sum, e) => sum + e, 0) / energyLevels.length;

  // avgScore: ideal band is 50–70 (balanced but energised)
  // Outside this band: linearly penalise at 2pts per unit away from nearest boundary
  let avgScore: number;
  if (avgEnergy >= 50 && avgEnergy <= 70) {
    avgScore = 100;
  } else {
    const distFromIdeal = avgEnergy < 50 ? 50 - avgEnergy : avgEnergy - 70;
    avgScore = Math.max(0, 100 - distFromIdeal * 2);
  }

  // harmonyScore: no penalty for natural stdDev (≤20); penalise only variance beyond that threshold
  // stdDev of ~20 is expected in a well-mixed group; >40 starts to cause real tension
  const variance = energyLevels.reduce((sum, e) => sum + Math.pow(e - avgEnergy, 2), 0) / energyLevels.length;
  const stdDev = Math.sqrt(variance);
  const harmonyPenalty = Math.max(0, stdDev - 20); // only penalise variance beyond the "natural" level
  const harmonyScore = Math.max(0, 100 - harmonyPenalty * 2.5);

  return Math.round((avgScore + harmonyScore) / 2);
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

/**
 * Match Compass group-formation weights by strictness tier.
 * At strictness=50, returns undefined (use default/adaptive weights).
 * At strictness=0, diversityWeight +4%.
 * At strictness=100, chemistryWeight +4%.
 * Weights are normalized to sum to 100%.
 */
function resolveStrictnessWeights(strictness: number): MatchingWeights | undefined {
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

export type GreedyPoolMatchingConfig = {
  minGroupSize?: number | null;
  maxGroupSize?: number | null;
  targetGroups?: number | null;
  // Gender-balance controls (Sprint 2026-07-14 — gender ratio enforcement, D1–D9).
  // Defaults mirror the eventPools schema: mode "soft", bonus 15, floors 0.
  genderBalanceMode?: string | null;
  genderBalanceBonusPoints?: number | null;
  minFemaleCount?: number | null;
  minMaleCount?: number | null;
  // D5: when set (single-gender pool), ALL gender-balance logic is skipped.
  genderRestriction?: string | null;
};

export type GenderBalanceMode = "none" | "soft" | "hard";

/**
 * Classify a stored gender value for floor/balance math.
 * Only disclosed male/female values count; `null`, `不透露`, and any unknown
 * value count toward NEITHER floor (REL-01).
 */
export function classifyDisclosedGender(gender: string | null | undefined): "male" | "female" | null {
  if (!gender) return null;
  const g = gender.trim().toLowerCase();
  if (g === "女性" || g === "女" || g === "female" || g === "f") return "female";
  if (g === "男性" || g === "男" || g === "male" || g === "m") return "male";
  return null;
}

/** Count disclosed male/female members of a candidate group (REL-01 safe). */
export function countDisclosedGenders(members: UserWithProfile[]): { male: number; female: number } {
  let male = 0;
  let female = 0;
  for (const m of members) {
    const g = classifyDisclosedGender(m.gender);
    if (g === "male") male++;
    else if (g === "female") female++;
  }
  return { male, female };
}

/**
 * D3/D4: commit-time gender floor check — authoritative in `hard` mode.
 * Undisclosed genders (null / 不透露) count toward neither floor.
 */
export function groupSatisfiesGenderFloor(
  members: UserWithProfile[],
  minFemaleCount: number,
  minMaleCount: number,
): boolean {
  const { male, female } = countDisclosedGenders(members);
  return female >= minFemaleCount && male >= minMaleCount;
}

/**
 * D8: exact gender balance = equal disclosed male/female counts with at least
 * one disclosed male. Single-gender groups (0 males or 0 females) are never
 * "balanced" — which naturally satisfies D5's bonus-skip for restricted pools.
 */
export function groupHasExactGenderBalance(members: UserWithProfile[]): boolean {
  const { male, female } = countDisclosedGenders(members);
  return male > 0 && male === female;
}

// ── 磁场引擎 惊艳开局包 (P1): group-composition rules ─────────────────────
// Four rules behind the magnetismGroupRulesEnabled flag (MAGNETISM_GROUP_RULES_ENABLED).
// R1–R3 are commit gates on the FINAL group composition; R4 is a ranking-only
// nudge during expansion. Everything below is inert when the flag is off.

/** R1 无孤立者: every member needs ≥1 intra-group pair score at/above this. */
export const MAGNETISM_STRONG_TIE_THRESHOLD = 60;
/** R2 能量编排: a committed group needs ≥1 member at/above this archetype energy. */
export const MAGNETISM_ENERGIZER_THRESHOLD = 75;
/** R4 新奇分散: ranking penalty for an explore-intent candidate joining a group that already has an explorer. */
export const MAGNETISM_EXPLORE_RANKING_PENALTY = 8;

/**
 * Archetype energy lookup shared by R2 and calculateEnergyBalance.
 * Missing/unknown archetype defaults to 60 (mid) — same as calculateEnergyBalance.
 */
export function userArchetypeEnergy(user: UserWithProfile): number {
  return ARCHETYPE_ENERGY[user.archetype as keyof typeof ARCHETYPE_ENERGY] ?? 60;
}

/**
 * R1 无孤立者 (no isolated member): every member must have ≥1 intra-group pair
 * score ≥ threshold. Pair scores are supplied by the caller via `getPairScore`
 * so the greedy core can serve them from its precomputed cache.
 */
export async function groupSatisfiesStrongTieRule(
  members: UserWithProfile[],
  getPairScore: (user1: UserWithProfile, user2: UserWithProfile) => Promise<number>,
  threshold: number = MAGNETISM_STRONG_TIE_THRESHOLD,
): Promise<boolean> {
  for (const member of members) {
    let hasStrongTie = false;
    for (const other of members) {
      if (other.userId === member.userId) continue;
      if ((await getPairScore(member, other)) >= threshold) {
        hasStrongTie = true;
        break;
      }
    }
    if (!hasStrongTie) return false;
  }
  return true;
}

/**
 * R2 能量编排 (energy choreography): the group must contain ≥1 energizer
 * (archetype energy ≥ threshold). The pool-level exemption (no energizer among
 * eligible users → rule skipped) is decided once per run by the caller.
 */
export function groupHasEnergizer(
  members: UserWithProfile[],
  threshold: number = MAGNETISM_ENERGIZER_THRESHOLD,
): boolean {
  return members.some(m => userArchetypeEnergy(m) >= threshold);
}

// topicId → macroCategory lookup for R3, built once from the canonical taxonomy.
const INTEREST_TOPIC_MACRO_CATEGORY = new Map<string, string>();
for (const interest of INTEREST_TAXONOMY) {
  INTEREST_TOPIC_MACRO_CATEGORY.set(interest.id, interest.macroCategory);
}

/**
 * R3 话题锚点 (topic anchor): a committed group must share conversation fuel.
 * Cold-start safety: if ANY member's interestsCache entry is missing or empty,
 * the rule is skipped (returns true). Otherwise the group passes when EITHER
 *   (a) some macro category has ≥1 topic from EVERY member, OR
 *   (b) some single topicId is shared by ≥ ⌈n/2⌉ members (any heat).
 */
export function groupHasTopicAnchor(
  members: UserWithProfile[],
  interestsCache: UserInterestsCache,
): boolean {
  const memberTopics: string[][] = [];
  for (const m of members) {
    const entry = interestsCache.get(m.userId);
    if (!entry || entry.topics.length === 0) return true; // cold-start → skip rule
    memberTopics.push(entry.topics);
  }
  if (memberTopics.length === 0) return true;

  // (a) a macro category in which every member carries ≥1 topic
  let sharedCategories: Set<string> | null = null;
  for (const topics of memberTopics) {
    const categories = new Set<string>();
    for (const topic of topics) {
      const category = INTEREST_TOPIC_MACRO_CATEGORY.get(topic);
      if (category) categories.add(category);
    }
    if (sharedCategories === null) {
      sharedCategories = categories;
    } else {
      sharedCategories = new Set<string>([...sharedCategories].filter((c: string) => categories.has(c)));
    }
    if (sharedCategories.size === 0) break;
  }
  if (sharedCategories && sharedCategories.size > 0) return true;

  // (b) one concrete topic shared by ≥ ⌈n/2⌉ members
  const required = Math.ceil(memberTopics.length / 2);
  const topicMemberCounts = new Map<string, number>();
  for (const topics of memberTopics) {
    for (const topic of new Set(topics)) {
      topicMemberCounts.set(topic, (topicMemberCounts.get(topic) ?? 0) + 1);
    }
  }
  for (const count of topicMemberCounts.values()) {
    if (count >= required) return true;
  }
  return false;
}

/**
 * R4 新奇分散 (novelty dispersion): ranking-only nudge during group expansion.
 * An explore-intent candidate joining a group that already has an explorer is
 * penalised for the argmax ONLY — cached pair scores and the admission
 * threshold never see the adjustment (nudge, not ban).
 */
export function adjustScoreForNoveltyDispersion(
  candidate: UserWithProfile,
  groupMembers: UserWithProfile[],
  avgScore: number,
): number {
  if (!getEffectiveIntent(candidate).includes("explore")) return avgScore;
  const groupHasExplorer = groupMembers.some(m => getEffectiveIntent(m).includes("explore"));
  return groupHasExplorer ? avgScore - MAGNETISM_EXPLORE_RANKING_PENALTY : avgScore;
}

/**
 * In-memory greedy pool matching (same algorithm as `matchEventPool` after eligibility + caches).
 * Exported for stress benchmarks and tests — **not** an HTTP entrypoint.
 */
export async function runGreedyPoolMatchingCore(
  eligibleUsers: UserWithProfile[],
  pool: GreedyPoolMatchingConfig,
  interestsCache: UserInterestsCache,
  pairScoreCache: Map<string, number>,
  semanticProfileCache: SemanticProfileCache | undefined,
  semanticSimilarityEnabled: boolean,
  chemistryCalibrationMap: ChemistryCalibrationMap | undefined,
  invitationPairs: Array<{ inviterId: string; inviteeId: string }>,
  customWeights?: MatchingWeights,
  matchHistoryLookup?: Map<string, { wouldMeetAgain: boolean | null }>,
  strictness: number = 50,
  matchNeverMeetSentinelEnabled = false,
  useWeightProfileV2 = false,
  magnetismGroupRulesEnabled = false,
  // 双人成行 (duo registration, 2026-08-07): hard atomic units. Each pair must
  // be placed into the SAME group occupying 2 seats, with MAX 1 duo per group.
  // Trailing optional param — default [] keeps zero-duo pools byte-identical.
  duoPairs: Array<{ inviterId: string; inviteeId: string }> = [],
): Promise<MatchGroup[]> {
  // 4. 贪婪分组算法（优先处理邀请关系）
  const groups: MatchGroup[] = [];
  const used = new Set<string>();
  const targetGroupSize = pool.maxGroupSize || 6;
  const minGroupSize = pool.minGroupSize || 4;
  const maxGroupSize = pool.maxGroupSize || 6;

  // ── Gender-balance configuration (Sprint 2026-07-14, D1–D9) ──
  // D1: defaults mirror the schema — mode "soft", bonus 15, floors 0.
  // D4: floors enforced only in `hard` mode; `soft` = bonus only; `none` = off.
  // D5: single-gender pools (genderRestriction set) skip ALL balance logic.
  // D9: no special-casing for test pools — logic applies uniformly.
  const rawGenderBalanceMode = (pool.genderBalanceMode ?? "soft") as GenderBalanceMode;
  const genderBalanceBonusPoints = pool.genderBalanceBonusPoints ?? 15;
  const minFemaleCount = pool.minFemaleCount ?? 0;
  const minMaleCount = pool.minMaleCount ?? 0;
  const genderBalanceMode: GenderBalanceMode =
    pool.genderRestriction || rawGenderBalanceMode === "none" ? "none" : rawGenderBalanceMode;
  const hardFloorActive = genderBalanceMode === "hard" && (minFemaleCount > 0 || minMaleCount > 0);
  const poolIdForLog = (pool as GreedyPoolMatchingConfig & { id?: string | null }).id ?? null;

  if (hardFloorActive) {
    // AC-10(a): hard-mode activation logged once per run.
    logger.info("[Pool Matching] hard gender-balance mode active", {
      poolId: poolIdForLog,
      mode: genderBalanceMode,
      minFemaleCount,
      minMaleCount,
    });
  }

  // ── 双人成行 (duo) atomic units: variant A 整组顺延 (spec §D.3) ───────────
  // Duo = hard atomic unit: both members together or unmatched together.
  // MAX 1 duo per group. Fallback semantics live in guards marked [DUO].
  const duoPartnerOf = new Map<string, string>();
  const duoInternalPairKeys = new Set<string>();
  for (const duo of duoPairs) {
    duoPartnerOf.set(duo.inviterId, duo.inviteeId);
    duoPartnerOf.set(duo.inviteeId, duo.inviterId);
    duoInternalPairKeys.add([duo.inviterId, duo.inviteeId].sort().join('|'));
  }
  const isDuoInternalPair = (userAId: string, userBId: string): boolean =>
    duoInternalPairKeys.has([userAId, userBId].sort().join('|'));
  // Exclusion set for group-quality metrics (duo-internal pair must not
  // inflate avgPairScore). Undefined when the pool has no duos → zero change.
  const duoQualityExclusions = duoInternalPairKeys.size > 0 ? duoInternalPairKeys : undefined;

  if (duoPairs.length > 0) {
    logger.info("[Pool Matching] duo atomic units active", {
      poolId: poolIdForLog,
      duoCount: duoPairs.length,
    });
  }

  const isStrictnessEnabled = process.env.MATCH_COMPASS_STRICTNESS_ENABLED !== "false";
  const effectiveStrictness = isStrictnessEnabled ? strictness : 50;
  const hasExplicitCustomWeights = !!customWeights;
  const formationWeights = resolveStrictnessWeights(effectiveStrictness) ?? customWeights;

  // minPairScore threshold by strictness tier
  let minPairScore = 60;
  if (effectiveStrictness <= 0) minPairScore = 52;
  else if (effectiveStrictness >= 100) minPairScore = 70;

  // allowOverflow: relaxed mode permits soft overflow during redistribution
  const allowOverflow = effectiveStrictness <= 0 && isStrictnessEnabled;

  // 计算所有可能的配对分数，并为邀请关系加权
  const pairScores: { user1: UserWithProfile; user2: UserWithProfile; score: number; isInvited: boolean }[] = [];
  for (let i = 0; i < eligibleUsers.length; i++) {
    for (let j = i + 1; j < eligibleUsers.length; j++) {
      const user1 = eligibleUsers[i] as UserWithProfile;
      const user2 = eligibleUsers[j] as UserWithProfile;

      // Match Compass L1 dealbreaker filter (strictness < 50 only)
      if (isStrictnessEnabled && effectiveStrictness < 50) {
        if (!pairMeetsDealbreakers(user1, user2, effectiveStrictness)) {
          pairScores.push({ user1, user2, score: -1, isInvited: false });
          continue;
        }
      }

      let score = await calculatePairScore(
        user1,
        user2,
        interestsCache,
        pairScoreCache,
        semanticProfileCache,
        semanticSimilarityEnabled,
        chemistryCalibrationMap,
        formationWeights,
        matchHistoryLookup,
        matchNeverMeetSentinelEnabled,
        useWeightProfileV2,
      );

      // Check if this pair has an invitation relationship
      const isInvited = invitationPairs.some(pair =>
        (pair.inviterId === user1.userId && pair.inviteeId === user2.userId) ||
        (pair.inviterId === user2.userId && pair.inviteeId === user1.userId)
      );

      // Boost score for invited pairs (soft constraint)
      if (isInvited) {
        score = Math.min(100, score + 20); // Add 20 points bonus
      }

      pairScores.push({
        user1,
        user2,
        score,
        isInvited
      });
    }
  }

  // 按分数降序排序（邀请关系会自动排在前面因为有加分）
  pairScores.sort((a, b) => b.score - a.score);

  // ── 磁场引擎 惊艳开局包 (P1) group-composition rules ──
  // R2 pool-level exemption, computed once per run: when NO eligible user is
  // an energizer, R2 can never pass — skip the rule instead of rejecting
  // every group. Forced false when the flag is off (rule inert).
  const poolHasEnergizer =
    magnetismGroupRulesEnabled &&
    eligibleUsers.some(u => userArchetypeEnergy(u) >= MAGNETISM_ENERGIZER_THRESHOLD);

  // R1 pair-score lookup: served from the precomputed cache (every eligible
  // pair was scored above). A cache miss should not happen; fall back to
  // calculatePairScore defensively (it re-caches) rather than crashing.
  const getCachedPairScore = (user1: UserWithProfile, user2: UserWithProfile): Promise<number> => {
    const cached = pairScoreCache.get(
      pairScoreCacheKey(user1.userId, user2.userId, semanticSimilarityEnabled, formationWeights, useWeightProfileV2),
    );
    if (cached !== undefined) return Promise.resolve(cached);
    return calculatePairScore(
      user1,
      user2,
      interestsCache,
      pairScoreCache,
      semanticProfileCache,
      semanticSimilarityEnabled,
      chemistryCalibrationMap,
      formationWeights,
      matchHistoryLookup,
      matchNeverMeetSentinelEnabled,
      useWeightProfileV2,
    );
  };

  // [DUO] R1 无孤立者 for duo members: the duo-internal pair never counts as a
  // strong tie — each duo member must satisfy R1 against the REST of the group
  // individually. Inert when the pool has no duos.
  const getR1PairScore = duoInternalPairKeys.size === 0
    ? getCachedPairScore
    : async (user1: UserWithProfile, user2: UserWithProfile): Promise<number> =>
        isDuoInternalPair(user1.userId, user2.userId) ? -1 : getCachedPairScore(user1, user2);

  // [DUO] Count distinct duo units already inside a forming group (a unit =
  // both partners present). Used for the MAX 1 duo per group admission cap.
  const countDuoUnits = (members: UserWithProfile[]): number => {
    if (duoPartnerOf.size === 0) return 0;
    const memberIds = new Set(members.map((m) => m.userId));
    let units = 0;
    const seen = new Set<string>();
    for (const id of memberIds) {
      const partnerId = duoPartnerOf.get(id);
      if (partnerId && memberIds.has(partnerId) && !seen.has(id) && !seen.has(partnerId)) {
        units++;
        seen.add(id);
        seen.add(partnerId);
      }
    }
    return units;
  };

  // 贪婪组建小组
  for (const pair of pairScores) {
    if (used.has(pair.user1.userId) || used.has(pair.user2.userId)) continue;

    // 以这对高分用户为核心，找到其他合适的成员
    const groupMembers = [pair.user1, pair.user2];
    used.add(pair.user1.userId);
    used.add(pair.user2.userId);

    // [DUO] Atomic seed: if a seed member belongs to a duo, the partner is
    // force-included in the SAME group. The seed is abandoned (BOTH members
    // stay unmatched together) when the partner cannot fit (capacity), or when
    // the seed pair links members of TWO different duos — MAX 1 duo per group
    // holds from the very first seat.
    let duoSeedFits = true;
    if (duoPartnerOf.size > 0) {
      for (const seedMember of [pair.user1, pair.user2]) {
        const partnerId = duoPartnerOf.get(seedMember.userId);
        if (!partnerId || used.has(partnerId)) continue;
        if (countDuoUnits(groupMembers) >= 1) { // duo cap at seed time
          duoSeedFits = false;
          break;
        }
        const partner = eligibleUsers.find((u) => u.userId === partnerId);
        if (partner && groupMembers.length < maxGroupSize) {
          groupMembers.push(partner);
          used.add(partner.userId);
        } else {
          duoSeedFits = false;
        }
      }
    }
    if (!duoSeedFits) {
      groupMembers.forEach((m) => used.delete(m.userId));
      continue;
    }

    // 继续添加成员直到达到目标人数
    while (groupMembers.length < targetGroupSize) {
      let bestCandidate: UserWithProfile | null = null;
      // [DUO] When the best candidate belongs to a duo, its partner is admitted
      // in the same step (atomic unit occupying 2 seats).
      let bestCandidatePartner: UserWithProfile | null = null;
      let bestScore = 0;
      // True pair-score average of bestCandidate (pre-R4 nudge) — the admission
      // gate uses this, never the ranking-adjusted score.
      let bestAvgScore = 0;

      for (const candidate of eligibleUsers as UserWithProfile[]) {
        if (used.has(candidate.userId)) continue;

        // [DUO] Resolve the candidate's duo partner and enforce the admission
        // guards at the same hook point as the capacity check:
        //   - MAX 1 duo per group (group already contains a duo unit)
        //   - atomic capacity: the unit needs 2 seats
        //   - partner must be available (unused)
        let candidatePartner: UserWithProfile | null = null;
        if (duoPartnerOf.size > 0) {
          const partnerId = duoPartnerOf.get(candidate.userId);
          if (partnerId) {
            if (countDuoUnits(groupMembers) >= 1) continue; // duo cap
            if (groupMembers.length + 2 > maxGroupSize) continue; // unit needs 2 seats
            const partner = eligibleUsers.find((u) => u.userId === partnerId);
            if (!partner || used.has(partner.userId)) continue;
            candidatePartner = partner;
          }
        }

        // Match Compass: apply dealbreakers during group expansion too (strictness < 50)
        // [DUO] the partner must independently pass dealbreakers vs the group.
        if (isStrictnessEnabled && effectiveStrictness < 50) {
          let passesDealbreakers = true;
          for (const unitMember of candidatePartner ? [candidate, candidatePartner] : [candidate]) {
            for (const member of groupMembers) {
              if (!pairMeetsDealbreakers(unitMember, member, effectiveStrictness)) {
                passesDealbreakers = false;
                break;
              }
            }
            if (!passesDealbreakers) break;
          }
          if (!passesDealbreakers) continue;
        }

        // 计算候选人与当前小组成员的平均分数 (uses cached pair scores)
        const scoreAgainstGroup = async (user: UserWithProfile): Promise<number> => {
          let totalScore = 0;
          for (const member of groupMembers) {
            totalScore += await calculatePairScore(
              user,
              member,
              interestsCache,
              pairScoreCache,
              semanticProfileCache,
              semanticSimilarityEnabled,
              chemistryCalibrationMap,
              formationWeights,
              matchHistoryLookup,
              matchNeverMeetSentinelEnabled,
              useWeightProfileV2,
            );
          }
          return totalScore / groupMembers.length;
        };

        // [DUO] Unit-to-group score = mean of BOTH duo members' averages
        // (mean of both directions); solo candidates keep the legacy average.
        const candidateAvg = await scoreAgainstGroup(candidate);
        const avgScore = candidatePartner
          ? (candidateAvg + (await scoreAgainstGroup(candidatePartner))) / 2
          : candidateAvg;

        // R4 新奇分散 (flag-gated): an explore-intent candidate is nudged down
        // in the ranking when the forming group already has an explorer. The
        // adjustment affects ONLY the argmax — cached pair scores are never
        // mutated and the admission gate below still uses the true avgScore
        // (nudge, not ban).
        const rankingScore = magnetismGroupRulesEnabled
          ? adjustScoreForNoveltyDispersion(candidate, groupMembers, avgScore)
          : avgScore;

        if (rankingScore > bestScore) {
          bestScore = rankingScore;
          bestAvgScore = avgScore;
          bestCandidate = candidate;
          bestCandidatePartner = candidatePartner;
        }
      }

      if (bestCandidate && bestAvgScore >= minPairScore) { // 最低质量门槛（Match Compass可调节）
        groupMembers.push(bestCandidate);
        used.add(bestCandidate.userId);
        // [DUO] Atomic admission: partner joins in the same step — a duo can
        // never be split across groups by the greedy loop.
        if (bestCandidatePartner) {
          groupMembers.push(bestCandidatePartner);
          used.add(bestCandidatePartner.userId);
        }
      } else {
        break; // 没有合适的候选人
      }
    }

    // D3/D4: commit-time gender floor check (hard mode only) — authoritative.
    // Floors are per-group and non-monotonic (a partial [M,M] group violates
    // minFemaleCount=2 at size 2 yet becomes valid at size 4), so the check
    // runs only on the FINAL composition, never mid-loop.
    const genderFloorSatisfied =
      !hardFloorActive || groupSatisfiesGenderFloor(groupMembers, minFemaleCount, minMaleCount);
    if (!genderFloorSatisfied) {
      // AC-10(c): floor rejections at debug level to avoid log spam at scale.
      logger.debug("[Pool Matching] group rejected by gender floor at commit gate", {
        poolId: poolIdForLog,
        memberCount: groupMembers.length,
        ...countDisclosedGenders(groupMembers),
        minFemaleCount,
        minMaleCount,
      });
    }

    // 磁场引擎 惊艳开局包 (P1) commit gates — R1 无孤立者 / R2 能量编排 / R3 话题锚点.
    // Evaluated only for groups that would otherwise commit (size + gender floor
    // pass); rejections fall through to the existing release path below.
    let magnetismRulesSatisfied = true;
    if (magnetismGroupRulesEnabled && groupMembers.length >= minGroupSize && genderFloorSatisfied) {
      // [DUO] R1 uses getR1PairScore so the duo-internal pair never counts as
      // a strong tie — each duo member individually needs a non-duo strong tie.
      const strongTieSatisfied = await groupSatisfiesStrongTieRule(groupMembers, getR1PairScore);
      // R2 is skipped entirely when the pool has no energizer (see above).
      const energizerSatisfied = !poolHasEnergizer || groupHasEnergizer(groupMembers);
      const topicAnchorSatisfied = groupHasTopicAnchor(groupMembers, interestsCache);
      magnetismRulesSatisfied = strongTieSatisfied && energizerSatisfied && topicAnchorSatisfied;
      if (!magnetismRulesSatisfied) {
        logger.info("[Pool Matching] group rejected by magnetism group rules", {
          poolId: poolIdForLog,
          memberCount: groupMembers.length,
          strongTieSatisfied,
          energizerSatisfied,
          topicAnchorSatisfied,
        });
      }
    }

    // 只保留达到最小人数且满足性别下限的小组
    if (groupMembers.length >= minGroupSize && genderFloorSatisfied && magnetismRulesSatisfied) {
      const avgPairScore = await calculateGroupPairScore(
        groupMembers,
        interestsCache,
        pairScoreCache,
        semanticProfileCache,
        semanticSimilarityEnabled,
        chemistryCalibrationMap,
        formationWeights,
        matchHistoryLookup,
        matchNeverMeetSentinelEnabled,
        useWeightProfileV2,
        // [DUO] duo-internal pair excluded from group quality metrics
        duoQualityExclusions,
      );
      // E: Compute true chemistry-only average (distinct from avgPairScore)
      const avgChemistryScore = calculateGroupChemistryScore(groupMembers, chemistryCalibrationMap, duoQualityExclusions);
      const diversity = calculateGroupDiversity(groupMembers, genderBalanceMode, genderBalanceBonusPoints);
      const communicationBalance = calculateEnergyBalance(groupMembers);
      const overall = Math.round((avgPairScore * 0.6) + (diversity * 0.25) + (communicationBalance * 0.15));
      const temperatureLevel = getTemperatureLevel(overall);

      const group: MatchGroup = {
        members: groupMembers,
        avgPairScore: avgPairScore,
        avgChemistryScore: avgChemistryScore,
        diversityScore: diversity,
        communicationBalance: communicationBalance,
        overallScore: overall,
        temperatureLevel: temperatureLevel,
        explanation: ""
      };

      group.explanation = generateGroupExplanation(group);
      groups.push(group);
    } else {
      // 释放这些成员，允许他们加入其他组
      groupMembers.forEach(m => used.delete(m.userId));
    }

    // 达到目标组数就停止
    if (groups.length >= (pool.targetGroups || 1)) {
      break;
    }
  }

  // 磁场引擎 惊艳开局包 (P1): R1/R2/R3 are commit gates in the greedy loop,
  // but the H4 redistribution pass below also changes final group composition
  // (absorption adds members, Phase 2 forms whole groups). Those paths must
  // respect the same rules — otherwise an absorbed or remainder member could
  // be stranded with no strong tie. Inert when the flag is off (returns true),
  // so default redistribution behavior is unchanged.
  const magnetismRulesSatisfiedFor = async (members: UserWithProfile[]): Promise<boolean> => {
    if (!magnetismGroupRulesEnabled) return true;
    // [DUO] R1 excludes duo-internal ties (same wrapper as the commit gate).
    const strongTieSatisfied = await groupSatisfiesStrongTieRule(members, getR1PairScore);
    const energizerSatisfied = !poolHasEnergizer || groupHasEnergizer(members);
    const topicAnchorSatisfied = groupHasTopicAnchor(members, interestsCache);
    if (!strongTieSatisfied || !energizerSatisfied || !topicAnchorSatisfied) {
      logger.info("[Pool Matching] redistribution candidate rejected by magnetism group rules", {
        poolId: poolIdForLog,
        memberCount: members.length,
        strongTieSatisfied,
        energizerSatisfied,
        topicAnchorSatisfied,
      });
    }
    return strongTieSatisfied && energizerSatisfied && topicAnchorSatisfied;
  };

  // H4: Redistribution pass for stranded users (behind adaptive-weights or Match Compass relaxed flag)
  // Only run when adaptive weights are explicitly enabled or allowOverflow is true — this is an experimental
  // quality-of-life improvement that needs real-world calibration.
  // Match Compass formation weights (strictness != 50) do NOT trigger redistribution,
  // because strict mode should not force-form low-quality groups.
  if (hasExplicitCustomWeights || allowOverflow) {
    const strandedUsers = eligibleUsers.filter(u => !used.has(u.userId));

    if (strandedUsers.length > 0) {
      logger.info(`[Pool Matching] Redistribution pass: ${strandedUsers.length} stranded users`);

      // Phase 1: Try to place each stranded user into the best existing group
      // that has room (below maxGroupSize).
      for (const stranded of strandedUsers) {
        // [DUO] FALLBACK (variant A): duo members are never absorbed solo —
        // placing one without the partner would split the atomic unit. Both
        // stay unmatched together (顺延 pipeline).
        if (duoPartnerOf.has(stranded.userId)) continue;
        let bestGroup: MatchGroup | null = null;
        let bestScore = -1;

        for (const group of groups) {
          if (group.members.length >= maxGroupSize && !allowOverflow) continue;

          let totalScore = 0;
          for (const member of group.members) {
            totalScore += await calculatePairScore(
              stranded,
              member,
              interestsCache,
              pairScoreCache,
              semanticProfileCache,
              semanticSimilarityEnabled,
              chemistryCalibrationMap,
              formationWeights,
              matchHistoryLookup,
              matchNeverMeetSentinelEnabled,
              useWeightProfileV2,
            );
          }
          const avgScore = totalScore / group.members.length;

          if (avgScore > bestScore) {
            bestScore = avgScore;
            bestGroup = group;
          }
        }

        if (bestGroup && bestScore >= 50) {
          // D6 Phase-1 defensive floor check: under commit-time floors gender
          // counts only grow, so this can only fail if a group was committed in
          // violation (should never happen) — defense-in-depth.
          if (hardFloorActive && !groupSatisfiesGenderFloor([...bestGroup.members, stranded], minFemaleCount, minMaleCount)) {
            logger.debug("[Pool Matching] H4 phase-1 absorption blocked by gender floor", {
              poolId: poolIdForLog,
              strandedUserId: stranded.userId,
              groupSize: bestGroup.members.length,
              minFemaleCount,
              minMaleCount,
            });
            continue;
          }
          // 磁场引擎 (P1): absorption must not break the commit rules — an
          // absorbed member still needs a strong tie (R1) and the group must
          // keep its topic anchor (R3). R2 is monotonic under absorption.
          if (!(await magnetismRulesSatisfiedFor([...bestGroup.members, stranded]))) {
            continue;
          }
          bestGroup.members.push(stranded);
          used.add(stranded.userId);
          // Recalculate group stats
          bestGroup.avgPairScore = await calculateGroupPairScore(
            bestGroup.members,
            interestsCache,
            pairScoreCache,
            semanticProfileCache,
            semanticSimilarityEnabled,
            chemistryCalibrationMap,
            formationWeights,
            matchHistoryLookup,
            matchNeverMeetSentinelEnabled,
            useWeightProfileV2,
            duoQualityExclusions,
          );
          bestGroup.avgChemistryScore = calculateGroupChemistryScore(bestGroup.members, chemistryCalibrationMap, duoQualityExclusions);
          bestGroup.diversityScore = calculateGroupDiversity(bestGroup.members, genderBalanceMode, genderBalanceBonusPoints);
          bestGroup.communicationBalance = calculateEnergyBalance(bestGroup.members);
          bestGroup.overallScore = Math.round(
            (bestGroup.avgPairScore * 0.6) +
            (bestGroup.diversityScore * 0.25) +
            (bestGroup.communicationBalance * 0.15)
          );
          bestGroup.temperatureLevel = getTemperatureLevel(bestGroup.overallScore);
          bestGroup.explanation = generateGroupExplanation(bestGroup);
        }
      }

      // Phase 2: If there are still stranded users, try to form a new group
      // from the remainders (only if enough to meet minGroupSize).
      let stillStranded = eligibleUsers.filter(u => !used.has(u.userId));
      // [DUO] MAX 1 duo per group also caps remainder groups: a remainder set
      // containing 2+ duo units is not formed (all stay unmatched, 顺延).
      const phase2DuoCapSatisfied = countDuoUnits(stillStranded) <= 1;
      if (!phase2DuoCapSatisfied) {
        logger.info("[Pool Matching] H4 phase-2 remainder group blocked by duo cap", {
          poolId: poolIdForLog,
          memberCount: stillStranded.length,
          duoUnits: countDuoUnits(stillStranded),
        });
      }
      if (stillStranded.length >= minGroupSize && phase2DuoCapSatisfied) {
        // D6 Phase-2 floor check: a remainder group that cannot satisfy the
        // hard-mode floor is NOT formed — members stay unmatched (per D2).
        const phase2FloorSatisfied =
          !hardFloorActive || groupSatisfiesGenderFloor(stillStranded, minFemaleCount, minMaleCount);
        if (!phase2FloorSatisfied) {
          // Floor-blocked: skip BOTH the push and the used-marking below so
          // Phase-3 absorption can still place these members into existing
          // floor-satisfying groups (Verifier implementation note).
          logger.debug("[Pool Matching] H4 phase-2 remainder group blocked by gender floor", {
            poolId: poolIdForLog,
            memberCount: stillStranded.length,
            ...countDisclosedGenders(stillStranded),
            minFemaleCount,
            minMaleCount,
          });
        } else if (await magnetismRulesSatisfiedFor(stillStranded)) {
          const avgPairScore = await calculateGroupPairScore(
            stillStranded,
            interestsCache,
            pairScoreCache,
            semanticProfileCache,
            semanticSimilarityEnabled,
            chemistryCalibrationMap,
            formationWeights,
            matchHistoryLookup,
            matchNeverMeetSentinelEnabled,
            useWeightProfileV2,
            duoQualityExclusions,
          );
          const avgChemistryScore = calculateGroupChemistryScore(stillStranded, chemistryCalibrationMap, duoQualityExclusions);
          const diversity = calculateGroupDiversity(stillStranded, genderBalanceMode, genderBalanceBonusPoints);
          const communicationBalance = calculateEnergyBalance(stillStranded);
          const overall = Math.round((avgPairScore * 0.6) + (diversity * 0.25) + (communicationBalance * 0.15));
          const temperatureLevel = getTemperatureLevel(overall);

          const newGroup: MatchGroup = {
            members: stillStranded,
            avgPairScore,
            avgChemistryScore,
            diversityScore: diversity,
            communicationBalance,
            overallScore: overall,
            temperatureLevel,
            explanation: "",
          };
          newGroup.explanation = generateGroupExplanation(newGroup);
          groups.push(newGroup);
          stillStranded.forEach(u => used.add(u.userId));
          logger.info(`[Pool Matching] Formed remainder group with ${stillStranded.length} users`);
        } else {
          // 磁场引擎 (P1): remainder group did not pass commit rules — members
          // stay unmatched here so Phase-3 absorption can still place them into
          // compliant existing groups (Rule-gated under the flag only).
          logger.info("[Pool Matching] H4 phase-2 remainder group rejected by magnetism group rules", {
            poolId: poolIdForLog,
            memberCount: stillStranded.length,
          });
        }
      }

      // Phase 3: Absorption — if stranded users remain after Phase 1+2,
      // allow any existing group to exceed maxGroupSize by 1 (soft overflow)
      // so long as the candidate scores ≥ 50 with the group. Each group may
      // absorb at most one extra member because the skip condition becomes
      // active once length > maxGroupSize. This is gated by adaptive weights
      // or Match Compass relaxed mode for safe calibration.
      stillStranded = eligibleUsers.filter(u => !used.has(u.userId));
      if (stillStranded.length > 0 && stillStranded.length < minGroupSize) {
        for (const stranded of stillStranded) {
          // [DUO] FALLBACK (variant A): same no-solo-absorption rule as Phase 1.
          if (duoPartnerOf.has(stranded.userId)) continue;
          let bestGroup: MatchGroup | null = null;
          let bestScore = -1;

          for (const group of groups) {
            if (group.members.length > maxGroupSize && !allowOverflow) continue;

            let totalScore = 0;
            for (const member of group.members) {
              totalScore += await calculatePairScore(
                stranded,
                member,
                interestsCache,
                pairScoreCache,
                semanticProfileCache,
                semanticSimilarityEnabled,
                chemistryCalibrationMap,
                formationWeights,
                matchHistoryLookup,
                matchNeverMeetSentinelEnabled,
                useWeightProfileV2,
              );
            }
            const avgScore = totalScore / group.members.length;

            if (avgScore > bestScore) {
              bestScore = avgScore;
              bestGroup = group;
            }
          }

          if (bestGroup && bestScore >= 50) {
            // D6 Phase-3 defensive floor check (same rationale as Phase 1 —
            // vacuous under commit-time floors, kept as defense-in-depth).
            if (hardFloorActive && !groupSatisfiesGenderFloor([...bestGroup.members, stranded], minFemaleCount, minMaleCount)) {
              logger.debug("[Pool Matching] H4 phase-3 absorption blocked by gender floor", {
                poolId: poolIdForLog,
                strandedUserId: stranded.userId,
                groupSize: bestGroup.members.length,
                minFemaleCount,
                minMaleCount,
              });
              continue;
            }
            // 磁场引擎 (P1): same rule gate as Phase-1 absorption.
            if (!(await magnetismRulesSatisfiedFor([...bestGroup.members, stranded]))) {
              continue;
            }
            bestGroup.members.push(stranded);
            used.add(stranded.userId);
            bestGroup.avgPairScore = await calculateGroupPairScore(
              bestGroup.members,
              interestsCache,
              pairScoreCache,
              semanticProfileCache,
              semanticSimilarityEnabled,
              chemistryCalibrationMap,
              formationWeights,
              matchHistoryLookup,
              matchNeverMeetSentinelEnabled,
              useWeightProfileV2,
              duoQualityExclusions,
            );
            bestGroup.avgChemistryScore = calculateGroupChemistryScore(bestGroup.members, chemistryCalibrationMap, duoQualityExclusions);
            bestGroup.diversityScore = calculateGroupDiversity(bestGroup.members, genderBalanceMode, genderBalanceBonusPoints);
            bestGroup.communicationBalance = calculateEnergyBalance(bestGroup.members);
            bestGroup.overallScore = Math.round(
              (bestGroup.avgPairScore * 0.6) +
              (bestGroup.diversityScore * 0.25) +
              (bestGroup.communicationBalance * 0.15)
            );
            bestGroup.temperatureLevel = getTemperatureLevel(bestGroup.overallScore);
            bestGroup.explanation = generateGroupExplanation(bestGroup);
          }
        }
      }

      stillStranded = eligibleUsers.filter(u => !used.has(u.userId));
      if (stillStranded.length > 0) {
        logger.info(`[Pool Matching] ${stillStranded.length} users remain unmatched after redistribution`);
      }
    }
  }

  // AC-10(b): post-match gender-balance summary — single info line per run,
  // computed from the formed groups without extra DB reads (OBS-02).
  if (genderBalanceMode !== "none") {
    logger.info("[Pool Matching] gender-balance summary", {
      poolId: poolIdForLog,
      mode: genderBalanceMode,
      groupsFormed: groups.length,
      groupsSatisfyingExactBalance: groups.filter((g) => groupHasExactGenderBalance(g.members)).length,
      groupsSatisfyingFloor: hardFloorActive
        ? groups.filter((g) => groupSatisfiesGenderFloor(g.members, minFemaleCount, minMaleCount)).length
        : groups.length,
    });
  }

  return groups;
}

/**
 * 主匹配算法：贪婪+优化策略
 * 1. 按匹配分数排序所有可能的配对
 * 2. 贪婪地组建小组，确保每个小组质量
 * 3. 优化：调整边界成员以提升整体分数
 */
export async function matchEventPool(poolId: string): Promise<MatchGroup[]> {
  // 1. 获取活动池配置
  const pool = await db.query.eventPools.findFirst({
    where: eq(eventPools.id, poolId)
  });
  
  if (!pool) {
    throw new Error("活动池不存在");
  }
  
  // 2. 获取所有报名者 + 用户资料
  const registrations = (await db
    .select({
      registrationId: eventPoolRegistrations.id,
      userId: eventPoolRegistrations.userId,
      budgetRange: eventPoolRegistrations.budgetRange,
      preferredLanguages: eventPoolRegistrations.preferredLanguages,
      eventIntent: eventPoolRegistrations.eventIntent,
      userIntent: users.intent,
      cuisinePreferences: eventPoolRegistrations.cuisinePreferences,
      dietaryRestrictions: eventPoolRegistrations.dietaryRestrictions,
      gender: users.gender,
      birthdate: users.birthdate,
      // ✅ UPDATED: Use 3-tier industry classification
      industryNiche: users.industryNiche,
      industryNicheLabel: users.industryNicheLabel,
      industryCategoryLabel: users.industryCategoryLabel,
      educationLevel: users.educationLevel,
      archetype: sql<string>`coalesce(${users.primaryArchetype}, ${users.archetype}, 'koala')`,
      secondaryArchetype: users.secondaryArchetype,
      lifeStage: users.lifeStage,  // canonical life stage for matching
      workMode: users.workMode,    // DEPRECATED: one-release fallback only
      hometown: users.hometownRegionCity,
      hometownAffinityOptin: users.hometownAffinityOptin,
      eventType: eventPools.eventType,
      barBudgetRange: eventPoolRegistrations.barBudgetRange,
      barThemes: eventPoolRegistrations.barThemes,
      alcoholComfort: eventPoolRegistrations.alcoholComfort,
      ageMatchPreference: users.ageMatchPreference,
      tableVibePreference: users.tableVibePreference,
      preferenceStrictness: eventPoolRegistrations.preferenceStrictness,
      genderCompositionPreference: eventPoolRegistrations.genderCompositionPreference,
    })
    .from(eventPoolRegistrations)
    .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
    .innerJoin(eventPools, eq(eventPoolRegistrations.poolId, eventPools.id))
    .where(
      and(
        eq(eventPoolRegistrations.poolId, poolId),
        eq(eventPoolRegistrations.matchStatus, "pending")
      )
    )) as UserWithProfile[];
  
  // 3. 硬约束过滤
  const eligibleUsers = registrations.filter((reg) => 
    meetsHardConstraints(reg, pool, reg.preferenceStrictness ?? 50)
  );
  
  // Match Compass: compute effective strictness for this pool
  const isStrictnessEnabled = process.env.MATCH_COMPASS_STRICTNESS_ENABLED !== "false";
  let effectiveStrictness = 50;
  if (isStrictnessEnabled && eligibleUsers.length > 0) {
    const strictnessValues = eligibleUsers.map((u) => u.preferenceStrictness ?? 50);
    effectiveStrictness = Math.round(
      strictnessValues.reduce((a, b) => a + b, 0) / strictnessValues.length
    );
  }
  
  if (eligibleUsers.length < (pool.minGroupSize || 4)) {
    throw new Error(`报名人数不足，至少需要${pool.minGroupSize}人`);
  }

  const eligibleUserIds = eligibleUsers.map(user => user.userId);
  const semanticSimilarityEnabled = isSemanticSimilarityEnabled();

  // 3.5 Preload user_interests for all eligible users in one batch query (C: runtime hardening)
  const interestsCache = await preloadUserInterests(eligibleUserIds);
  const semanticProfileCache = semanticSimilarityEnabled
    ? buildSemanticProfileCache(eligibleUsers, interestsCache)
    : undefined;
  // Chemistry calibration read path is gated: Phase 0 only accumulates stats
  // (writer is live via match_history derivation); calibrated deltas activate
  // in Phase 3 after shadow evidence + operator sign-off.
  const chemistryCalibrationEnabled = await getFeatureFlag("matchChemistryCalibrationEnabled", false);
  const chemistryCalibrationMap = chemistryCalibrationEnabled
    ? await getArchetypePairCalibrationMap()
    : undefined;

  // In-memory pair score cache for this run
  const pairScoreCache = new Map<string, number>();

  // Preload matchHistory for eligible users (anti-repetition + re-match boost)
  const matchHistoryLookup = new Map<string, { wouldMeetAgain: boolean | null }>();
  if (eligibleUserIds.length >= 2) {
    const historyRows = await db
      .select({
        user1Id: matchHistory.user1Id,
        user2Id: matchHistory.user2Id,
        wouldMeetAgain: matchHistory.wouldMeetAgain,
      })
      .from(matchHistory)
      .where(
        and(
          inArray(matchHistory.user1Id, eligibleUserIds),
          inArray(matchHistory.user2Id, eligibleUserIds),
        ),
      );
    for (const row of historyRows) {
      const key = [row.user1Id, row.user2Id].sort().join('|');
      matchHistoryLookup.set(key, { wouldMeetAgain: row.wouldMeetAgain });
    }
  }

  // Magnetism Engine Phase 0 / W2: read the never-meet sentinel flag ONCE per
  // run (calculatePairScore is a hot path — no per-pair flag lookups) and
  // thread it through. Default OFF: the -1 hard-skip is policy-pending; the
  // +5 re-match boost is unconditional.
  const matchNeverMeetSentinelEnabled = await getFeatureFlag("matchNeverMeetSentinel", false);

  // Magnetism Engine 惊艳开局包 / P2: weight profile v2 — read ONCE per run and
  // threaded through (calculatePairScore is a hot path — no per-pair flag
  // lookups). Default OFF: v1 tables remain the scoring default until test-pool
  // dual-run validation. Strictness/adaptive overrides are unaffected.
  const useWeightProfileV2 = await getFeatureFlag("magnetismWeightProfileV2Enabled", false);

  // Magnetism Engine 惊艳开局包 / P1: group-composition rules (R1 无孤立者 /
  // R2 能量编排 / R3 话题锚点 / R4 新奇分散) — read ONCE per run and threaded
  // into the greedy core like the flags above. Default OFF.
  const magnetismGroupRulesEnabled = await getFeatureFlag("magnetismGroupRulesEnabled", false);
  
  // 3.6 获取邀请关系 (invitation relationships)
  // Batch query all invitation uses for registrations in this pool, then join in memory.
  const registrationIds = eligibleUsers.map(u => u.registrationId);
  const allInviteUses = registrationIds.length > 0
    ? await db.select().from(invitationUses)
        .where(inArray(invitationUses.poolRegistrationId, registrationIds))
    : [];

  // D: Fix — invitationUses.invitationId is a FK to invitations.id (not invitations.code)
  const invitationIds = allInviteUses
    .map((u: any) => u.invitationId)
    .filter(Boolean) as string[];
  const relatedInvitations = invitationIds.length > 0
    ? await db.select().from(invitations)
        .where(inArray(invitations.id, invitationIds))
    : [];

  const invitationById = new Map(relatedInvitations.map((inv: any) => [inv.id, inv]));

  // Build invitation map: inviteeUserId -> inviterUserId
  // 双人成行 (2026-08-07): duo-scoped invitations (invitationType='duo' AND
  // poolId = this pool) become HARD atomic units in the greedy core — they no
  // longer take the +20 soft boost. Legacy event-scoped invitation rows keep
  // the legacy +20 path unchanged.
  const invitationPairs: Array<{inviterId: string, inviteeId: string}> = [];
  const duoPairs: Array<{inviterId: string, inviteeId: string}> = [];
  for (const inviteUse of allInviteUses) {
    if (!(inviteUse as any).invitationId) continue;
    const invitation = invitationById.get((inviteUse as any).invitationId);
    if (!invitation) continue;
    const inviter = eligibleUsers.find((u) => u.userId === (invitation as any).inviterId);
    const invitee = eligibleUsers.find((u) => u.registrationId === (inviteUse as any).poolRegistrationId);
    // Both users must be registered (eligible) in THIS pool — a duo never
    // binds a user outside the pool.
    if (inviter && invitee && inviter.userId !== invitee.userId) {
      const pair = { inviterId: inviter.userId, inviteeId: invitee.userId };
      const isDuoScoped =
        (invitation as any).invitationType === "duo" &&
        (invitation as any).poolId === poolId;
      if (isDuoScoped) {
        duoPairs.push(pair);
      } else {
        invitationPairs.push(pair);
      }
    }
  }

  // H3: Fetch adaptive weights when Thompson Sampling is enabled.
  // Weights are fetched once per matching run (not per pair) and cached
  // for the duration via matchingWeightsService's internal 60s TTL.
  const adaptiveWeightsEnabled = isAdaptiveWeightsEnabled();
  let customWeights: MatchingWeights | undefined;
  if (adaptiveWeightsEnabled) {
    try {
      customWeights = await matchingWeightsService.getActiveWeights();
      logger.info(`[Pool Matching] Using adaptive weights:`, customWeights);
    } catch (error) {
      logger.error(`[Pool Matching] Failed to fetch adaptive weights, falling back to defaults:`, { error: error instanceof Error ? error.message : String(error) });
      customWeights = undefined;
    }
  }

  return runGreedyPoolMatchingCore(
    eligibleUsers,
    pool,
    interestsCache,
    pairScoreCache,
    semanticProfileCache,
    semanticSimilarityEnabled,
    chemistryCalibrationMap,
    invitationPairs,
    customWeights,
    matchHistoryLookup,
    effectiveStrictness,
    matchNeverMeetSentinelEnabled,
    useWeightProfileV2,
    magnetismGroupRulesEnabled,
    duoPairs,
  );
}

/**
 * 保存匹配结果到数据库
 *
 * A: Core DB writes are wrapped in a single transaction so the pool can never
 *    be left in a partial state if any write fails mid-way.
 * B: An atomic pool-status CAS (active → matching) acts as an execution guard:
 *    only one matching run can commit for a given pool at a time.  If the guard
 *    is already held the call throws immediately and no duplicate groups are
 *    created.
 *
 * Side-effects that are intentionally kept OUTSIDE the transaction:
 *   - WebSocket notifications (cannot be rolled back, sent after commit)
 *   - Venue assignment (best-effort, non-critical)
 *   - Async theme generation / title broadcast (fire-and-forget)
 *   - Invitation reward coupons (best-effort, separate idempotency guard)
 */
export async function saveMatchResults(
  poolId: string,
  groups: MatchGroup[],
  options?: SaveMatchResultsOptions,
): Promise<void> {
  // 获取活动池信息用于通知
  const [pool] = await db.select().from(eventPools).where(eq(eventPools.id, poolId));

  if (!pool) {
    throw new Error(`[Pool Matching] Pool not found: ${poolId}`);
  }

  // B: Execution guard — atomically set status from 'active' to 'matching'.
  // If 0 rows are updated another run is already in progress; bail out safely.
  const guardResult = await db
    .update(eventPools)
    .set({ status: "matching", updatedAt: new Date() })
    .where(and(eq(eventPools.id, poolId), eq(eventPools.status, "active")))
    .returning({ id: eventPools.id });

  if (guardResult.length === 0) {
    throw new Error(`[Pool Matching] Guard rejected: pool ${poolId} is not in 'active' state — concurrent or duplicate run prevented`);
  }

  const operatorReviewEnabled = await getFeatureFlag('matchingOperatorReviewEnabled', false);
  if (operatorReviewEnabled) {
    logger.info(`[Pool Matching] Operator review enabled for pool ${poolId}; groups will be held pending review`);
  }
  // Precompute theme-title metadata outside the transaction so DB locks are held
  // only during the actual persistence work.
  const themeMetadata = await Promise.all(groups.map(async (group, i) => {
    const memberUserIds = group.members.map(m => m.userId);
    try {
      const themeTitleResult = await generateEventThemeTitle(memberUserIds, poolId);
      logger.info(`[Pool Matching] Generated event theme title for group ${i + 1}: ${themeTitleResult.eventThemeTitle} - ${themeTitleResult.themeTagline} ${themeTitleResult.emoji}`);
      return {
        eventThemeTitle: themeTitleResult.eventThemeTitle,
        themeTagline: themeTitleResult.themeTagline,
        themeEmoji: themeTitleResult.emoji,
        themeReasoning: themeTitleResult.reasoning,
      };
    } catch (error) {
      logger.error(`[Pool Matching] Failed to generate event theme title for group ${i + 1}:`, { error: error instanceof Error ? error.message : String(error) });
      return {
        eventThemeTitle: null,
        themeTagline: null,
        themeEmoji: null,
        themeReasoning: null,
      };
    }
  }));

  // Collect per-group data needed for WebSocket notifications (populated inside tx)
  // and fire-and-forget theme generation tasks are rebuilt in the shared side-effect
  // runner so the same runner can be invoked from admin approval.
  const persistedGroupIds: string[] = [];

  try {
    // A: Single transaction wrapping all core DB mutations
    await (db as any).transaction(async (tx: any) => {
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const memberUserIds = group.members.map(m => m.userId);
        const { eventThemeTitle, themeTagline, themeEmoji, themeReasoning } = themeMetadata[i];
        const predictiveAudit = options?.predictiveRerankSummary?.audits?.find(
          (audit) => audit.finalRank === i + 1,
        );

        // 1. 创建小组记录
        const [groupRecord] = await tx.insert(eventPoolGroups).values({
          poolId,
          groupNumber: i + 1,
          memberCount: group.members.length,
          avgChemistryScore: group.avgChemistryScore,
          diversityScore: group.diversityScore,
          communicationBalance: group.communicationBalance,
          overallScore: group.overallScore,
          temperatureLevel: group.temperatureLevel,
          matchExplanation: group.explanation,
          predictiveExperimentArm: options?.predictiveExperimentArm ?? null,
          predictiveModelVersion: options?.predictiveRerankSummary?.modelVersion ?? null,
          predictiveRerankApplied: options?.predictiveRerankApplied ?? false,
          predictiveRerankAudit: predictiveAudit ? {
            ...predictiveAudit,
            experimentArm: options?.predictiveExperimentArm ?? null,
            applied: options?.predictiveRerankApplied ?? false,
            confidenceThreshold: options?.predictiveRerankSummary?.confidenceThreshold ?? null,
            maxPositionShift: options?.predictiveRerankSummary?.maxPositionShift ?? null,
            reason: options?.predictiveRerankSummary?.reason ?? null,
            autoDisabledReason: options?.predictiveRerankSummary?.autoDisabledReason ?? null,
          } : null,
          theme: eventThemeTitle,
          subtitle: themeTagline,
          themeEmoji: themeEmoji,
          themeReasoning: themeReasoning,
          themeGeneratedAt: (eventThemeTitle || themeTagline || themeEmoji || themeReasoning) ? new Date() : null,
          status: "confirmed",
          operatorReviewStatus: operatorReviewEnabled ? "pending" : "none",
        }).returning();
        if (groupRecord?.id) {
          persistedGroupIds.push(groupRecord.id);
        }

        // 2. 更新用户报名状态
        const memberRegistrationIds = group.members.map(m => m.registrationId);
        await tx.update(eventPoolRegistrations)
          .set({
            matchStatus: operatorReviewEnabled ? "pending" : "matched",
            assignedGroupId: groupRecord.id,
            matchScore: group.overallScore,
            updatedAt: new Date()
          })
          .where(inArray(eventPoolRegistrations.id, memberRegistrationIds));

        // 2.5 创建对应的events记录
        const location = pool?.district ? `${pool.city} ${pool.district}` : pool?.city || "待定";
        const [eventRecord] = await tx.insert(events).values({
          title: `${pool?.title || "盲盒活动"} - 第${i + 1}组`,
          description: `来自活动池匹配：${pool?.description || ""}\n匹配分数: ${group.overallScore}\n化学反应: ${group.temperatureLevel}`,
          dateTime: pool?.dateTime || new Date(),
          location: location,
          area: pool?.district || null,
          maxAttendees: group.members.length,
          currentAttendees: group.members.length,
          hostId: pool?.createdBy || null,
          status: "matched",
          iconName: pool?.eventType === "饭局" ? "utensils" : pool?.eventType === "酒局" ? "wine" : "calendar",
        }).returning();

        // 2.6 为每个成员创建eventAttendance记录
        for (const member of group.members) {
          await tx.insert(eventAttendance).values({
            eventId: eventRecord.id,
            userId: member.userId,
            status: "confirmed",
          });
        }

        // 2.7 创建blind_box_events记录（确保确认出席流程可用）
        const [blindBoxEventRecord] = await tx.insert(blindBoxEvents).values({
          poolId,
          userId: memberUserIds[0] || pool.createdBy || "",
          title: pool?.title ?? "盲盒匹配活动",
          eventType: pool?.eventType ?? "饭局",
          city: pool?.city ?? "",
          district: pool?.district ?? "",
          dateTime: pool?.dateTime ?? new Date(),
          budgetTier: pool?.budgetTier ?? "",
          status: "matched",
          progress: 100,
          currentParticipants: group.members.length,
          totalParticipants: group.members.length,
          matchedAttendees: group.members.map((m) => ({
            userId: m.userId,
            archetype: m.archetype,
          })),
          matchExplanation: group.explanation ?? null,
        }).returning();

        // 2.8 将生成的 events / blind_box_events 记录关联到小组，便于拒绝时清理
        await tx.update(eventPoolGroups)
          .set({
            eventId: eventRecord.id,
            blindBoxEventId: blindBoxEventRecord?.id ?? null,
            updatedAt: new Date(),
          })
          .where(eq(eventPoolGroups.id, groupRecord.id));


        logger.info(`[Pool Matching] Created event ${eventRecord.id} for group ${i + 1} with ${memberUserIds.length} attendees`);
      }

      // 4. 更新活动池状态 → 'matched'
      await tx.update(eventPools)
        .set({
          status: "matched",
          successfulMatches: groups.reduce((sum, g) => sum + g.members.length, 0),
          matchedAt: new Date(),
          updatedAt: new Date(),
          operatorReviewStatus: operatorReviewEnabled ? "pending" : "none",
        })
        .where(eq(eventPools.id, poolId));

      // 5. 标记未匹配用户
      // Only mark the truly stranded: registrations still pending AND not
      // assigned to any group in step 2. With the operator-review gate enabled,
      // step 2 leaves matched members at 'pending' too — without the
      // assignedGroupId-IS-NULL guard this step would flip them to 'unmatched',
      // wiping the group out of the 足迹 list and breaking confirm-attendance.
      await tx.update(eventPoolRegistrations)
        .set({
          matchStatus: "unmatched",
          updatedAt: new Date()
        })
        .where(
          and(
            eq(eventPoolRegistrations.poolId, poolId),
            eq(eventPoolRegistrations.matchStatus, "pending"),
            isNull(eventPoolRegistrations.assignedGroupId)
          )
        );
    });
  } catch (error) {
    logger.error(`[Pool Matching] Transaction failed for pool ${poolId}, resetting status`, { error: String(error) });
    // If the transaction failed, reset the pool status back to 'active' so it can be retried.
    // (If the guard CAS succeeded but the tx failed, status is still 'matching' — we reset it.)
    try {
      await db.update(eventPools)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(eventPools.id, poolId));
    } catch (resetErr) {
      logger.error(`[Pool Matching] ⚠️ Failed to reset pool status after transaction error:`, { error: resetErr instanceof Error ? resetErr.message : String(resetErr) });
    }
    throw error;
  }

  // ── Post-commit side effects ──────────────────────────────────────────────
  // When operator review is enabled, groups are persisted but the matching is not
  // finalized. Side effects run only after an operator approves the review.
  if (operatorReviewEnabled) {
    logger.info(`[Pool Matching] Pool ${poolId} held for operator review; skipping notifications, venue assignment and invitation rewards`);
    return;
  }

  await executePostMatchCommitSideEffects(poolId, groups, persistedGroupIds, pool);
}


//my path:/Users/felixg/projects/JoyJoin3/server/poolMatchingService.ts
/**
 * Pool-Based Matching Service (池内匹配服务)
 * 两阶段匹配模型 - Stage 2: 用户报名后，在活动池内进行智能分组
 * 
 * 匹配逻辑：
 * 1. 硬约束过滤：检查用户是否符合活动池的硬性限制（性别、行业、年龄等）
 * 2. 软约束评分：基于5个维度计算用户之间的匹配分数
 *    - Personality Chemistry (性格兼容性): 28%
 *    - Interest Overlap (兴趣重叠度): 28%
 *    - Background Score (背景评估 — 行业多样性 + 人生阶段亲和力 + 同乡 + 学历): 17% (ALWAYS ACTIVE)
 *    - Conversation Compatibility (语言沟通): 12%
 *    - Event Preferences (活动偏好: 社交目的 + 酒局偏好): 15%
 * 3. 智能分组：使用贪婪+优化算法形成高质量小组
 */

import { db } from "./db";
import { 
  eventPools, 
  eventPoolRegistrations, 
  eventPoolGroups,
  events,
  eventAttendance,
  users, 
  userInterests,
  matchingConfig,
  invitationUses,
  invitations,
  coupons,
  userCoupons
} from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { calculateAge } from "@shared/utils";
import { wsService } from "./wsService";
import type { PoolMatchedData } from "@shared/wsEvents";
import { chemistryMatrix as CHEMISTRY_MATRIX } from "./archetypeChemistry";
import type { ArchetypeName } from "./archetypeConfig";
import { assignVenuesToGroups, saveVenueAssignments } from "./venueAssignmentService";
import { generateAndSaveEventTheme } from "./eventThemeGeneratorService";
import { generateEventThemeTitle } from "./services/eventThemeTitleGenerator";


















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
  workMode: string | null;  // 人生阶段 ('founder' | 'employed' | 'student' | 'successor' | etc.)
  // ❌ REMOVED: interestsTop - now use getUserInterests() to fetch from user_interests table
  hometown: string | null;  // 家乡（用于同乡亲和力）
  hometownAffinityOptin: boolean;  // 是否启用同乡匹配加分
  
  // Event preferences (temporary, from registration)
  budgetRange: string[] | null;  // 饭局预算
  barBudgetRange: string[] | null;  // 酒局预算（每杯）
  preferredLanguages: string[] | null;
  eventIntent: string[] | null;  // ✅ RENAMED from socialGoals - 本次活动社交目的
  userIntent: string[] | null;   // 用户档案默认社交偏好（fallback when eventIntent empty）
  cuisinePreferences: string[] | null;
  dietaryRestrictions: string[] | null;
  tasteIntensity: string[] | null;
  
  // 酒局特有偏好
  barThemes: string[] | null;  // 酒吧主题偏好
  alcoholComfort: string[] | null;  // 饮酒程度偏好
  
  // 活动类型（用于判断使用哪种预算）
  eventType: string | null;
}

export interface MatchGroup {
  members: UserWithProfile[];
  avgPairScore: number;  // 平均配对兼容性分数（chemistry + interest + preference + language）
  avgChemistryScore: number;  // 平均化学反应分数
  diversityScore: number;  // 小组多样性分数
  communicationBalance: number;  // 沟通平衡分数（0-100，评估小组语言沟通兼容性）
  overallScore: number;  // 综合分数 = avgPairScore × 0.6 + diversityScore × 0.25 + communicationBalance × 0.15
  temperatureLevel: string;  // 化学反应温度等级：fire(🔥炽热85+) | warm(🌡️温暖70-84) | mild(🌤️适宜55-69) | cold(❄️冷淡<55)
  explanation: string;
}

/**
 * 硬约束检查：验证用户是否符合活动池的所有限制
 * ✅ UPDATED: Added budget as L1 hard constraint
 */
function meetsHardConstraints(
  user: UserWithProfile, 
  pool: typeof eventPools.$inferSelect
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
        console.log(`[Matching] User ${user.userId} filtered out: bar budget mismatch`);
        return false;
      }
    }
  } else {
    // 饭局预算限制
    if (pool.budgetRestrictions && pool.budgetRestrictions.length > 0) {
      const userBudget = user.budgetRange || [];
      const hasOverlap = userBudget.some(b => pool.budgetRestrictions!.includes(b));
      if (!hasOverlap) {
        console.log(`[Matching] User ${user.userId} filtered out: budget mismatch`);
        return false;
      }
    }
  }
  
  return true;
}

/**
 * 计算两个用户之间的性格化学反应分数 (0-100)
 * 考虑主角色（70%）和次要角色的交叉兼容性（各15%，共30%）
 */
function calculateChemistryScore(user1: UserWithProfile, user2: UserWithProfile): number {
  const primary1 = (user1.archetype || "暖心熊") as ArchetypeName;
  const primary2 = (user2.archetype || "暖心熊") as ArchetypeName;
  const secondary1 = (user1.secondaryArchetype || "暖心熊") as ArchetypeName;
  const secondary2 = (user2.secondaryArchetype || "暖心熊") as ArchetypeName;
  
  // 主角色化学反应（70%权重）
  const primaryChemistry = (CHEMISTRY_MATRIX[primary1]?.[primary2] || 50) * 0.70;
  
  // 次要角色交叉加成（各15%权重，共30%）
  const crossChemistry1 = (CHEMISTRY_MATRIX[primary1]?.[secondary2] || 50) * 0.15;
  const crossChemistry2 = (CHEMISTRY_MATRIX[secondary1]?.[primary2] || 50) * 0.15;
  
  return Math.round(primaryChemistry + crossChemistry1 + crossChemistry2);
}

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
 * 计算兴趣重叠度 (升级版 - 支持 Heat Level 加权)
 * 优先使用 user_interests 表，回退到 legacy interestsTop
 */
async function calculateInterestScoreAsync(
  user1Id: string, 
  user2Id: string
): Promise<number> {
  const interests1 = await getUserInterests(user1Id);
  const interests2 = await getUserInterests(user2Id);
  
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
function calculateLanguageScore(user1: UserWithProfile, user2: UserWithProfile): number {
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

function calculatePreferenceScore(user1: UserWithProfile, user2: UserWithProfile): number {
  let score = 0;
  let factors = 0;
  
  // 根据活动类型选择偏好字段
  const eventType = user1.eventType || user2.eventType || "饭局";
  
  if (eventType === "酒局") {
    // ❌ REMOVED: Budget scoring (now L1 hard constraint)
    
    // 酒吧主题偏好兼容性
    const barThemes1 = user1.barThemes || [];
    const barThemes2 = user2.barThemes || [];
    if (barThemes1.length > 0 && barThemes2.length > 0) {
      const themeOverlap = barThemes1.filter(t => barThemes2.includes(t)).length;
      score += (themeOverlap / Math.max(barThemes1.length, barThemes2.length)) * 100;
      factors++;
    }
    
    // 饮酒程度兼容性
    const alcohol1 = user1.alcoholComfort || [];
    const alcohol2 = user2.alcoholComfort || [];
    if (alcohol1.length > 0 && alcohol2.length > 0) {
      const alcoholOverlap = alcohol1.filter(a => alcohol2.includes(a)).length;
      score += (alcoholOverlap / Math.max(alcohol1.length, alcohol2.length)) * 100;
      factors++;
    }
  }
  
  // ❌ REMOVED: Cuisine preferences and taste intensity (饭局 food preferences deprecated)
  
  // 社交目的兼容性（两种活动都使用）- fallback chain applied
  // Note: Treat "flexible" as neutral (no strong intent); do not let it create a perfect match.
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
function calculateHometownAffinityScore(user1: UserWithProfile, user2: UserWithProfile): number {
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
 * 人生阶段 Aspiration Affinity Matrix (7×7)
 * Score 0-100: How much person in row WANTS to meet person in column
 * 
 * This is ASYMMETRIC. A student wanting to meet a founder ≠ a founder wanting to meet a student.
 * We average both directions for the pair score.
 */
/** Neutral score returned when a user has no workMode set (neither a boost nor a penalty). */
const NEUTRAL_LIFE_STAGE_SCORE = 50;

const LIFE_STAGE_AFFINITY: Record<string, Record<string, number>> = {
  //                       founder  self_emp  employed  student  transition  caregiver  successor
  founder:           { founder: 90, self_employed: 80, employed: 60, student: 40, transitioning: 70, caregiver_retired: 30, successor: 80 },
  self_employed:     { founder: 85, self_employed: 70, employed: 55, student: 35, transitioning: 60, caregiver_retired: 40, successor: 55 },
  employed:          { founder: 75, self_employed: 65, employed: 50, student: 30, transitioning: 45, caregiver_retired: 35, successor: 50 },
  student:           { founder: 80, self_employed: 60, employed: 70, student: 40, transitioning: 35, caregiver_retired: 20, successor: 45 },
  transitioning:     { founder: 85, self_employed: 75, employed: 60, student: 40, transitioning: 50, caregiver_retired: 40, successor: 55 },
  caregiver_retired: { founder: 40, self_employed: 55, employed: 50, student: 30, transitioning: 45, caregiver_retired: 60, successor: 35 },
  successor:         { founder: 85, self_employed: 50, employed: 55, student: 45, transitioning: 55, caregiver_retired: 35, successor: 90 },
};

/**
 * 计算人生阶段亲和力分数 (0-100)
 * Uses asymmetric aspiration matrix averaged both directions.
 * Intent modulation: networking boosts cross-stage affinity, fun dampens it.
 */
function calculateLifeStageAffinity(user1: UserWithProfile, user2: UserWithProfile): number {
  if (!user1.workMode || !user2.workMode) return NEUTRAL_LIFE_STAGE_SCORE;

  const baseForward = LIFE_STAGE_AFFINITY[user1.workMode]?.[user2.workMode] ?? NEUTRAL_LIFE_STAGE_SCORE;
  const baseReverse = LIFE_STAGE_AFFINITY[user2.workMode]?.[user1.workMode] ?? NEUTRAL_LIFE_STAGE_SCORE;

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
 * Calculate unified background score (0-100)
 * Fixed-weight breakdown:
 *   Industry diversity:  30% (different = 70, same = 30)
 *   Life stage affinity: 30% (asymmetric LIFE_STAGE_AFFINITY matrix via workMode / 人生阶段)
 *   Hometown affinity:   20% when both opted in; redistributed to industry+life stage when not
 *   Education diversity: 20% (different = 60, same = 30)
 * Note: Gender is no longer part of pair-level background; it is captured in group diversity.
 */
function calculateBackgroundScore(user1: UserWithProfile, user2: UserWithProfile): number {
  // Use neutral defaults when data is missing
  const industryScore = (user1.industryNiche && user2.industryNiche)
    ? (user1.industryNiche !== user2.industryNiche ? 70 : 30)
    : 50;

  const lifeStageScore = (user1.workMode && user2.workMode)
    ? calculateLifeStageAffinity(user1, user2)
    : 50;

  const educationScore = (user1.educationLevel && user2.educationLevel)
    ? (user1.educationLevel !== user2.educationLevel ? 60 : 30)
    : 50;

  const hometownOptedIn = user1.hometownAffinityOptin && user2.hometownAffinityOptin;

  if (hometownOptedIn) {
    // All 4 factors: industry 30% + life stage 30% + hometown 20% + education 20%
    const hometownScore = calculateHometownAffinityScore(user1, user2);
    return Math.round(
      industryScore  * 0.30 +
      lifeStageScore * 0.30 +
      hometownScore  * 0.20 +
      educationScore * 0.20
    );
  } else {
    // Hometown not opted in: redistribute its 20% equally to industry and life stage
    return Math.round(
      industryScore  * 0.40 +
      lifeStageScore * 0.40 +
      educationScore * 0.20
    );
  }
}

/**
 * Calculate background diversity score (0-100)
 * Different industry, education, gender = higher score (encourages diversity)
 * ✅ UPDATED: Use industryNiche from 3-tier classification
 * Note: Used for group-level diversity; pair-level uses calculateBackgroundScore instead.
 */
function calculateDiversityScore(user1: UserWithProfile, user2: UserWithProfile): number {
  let diversityPoints = 0;

  // Different industry +40 (primary diversity dimension)
  if (user1.industryNiche && user2.industryNiche && user1.industryNiche !== user2.industryNiche) {
    diversityPoints += 40;
  }

  // Different education level +30
  if (user1.educationLevel && user2.educationLevel && user1.educationLevel !== user2.educationLevel) {
    diversityPoints += 30;
  }

  // Different gender +30
  if (user1.gender && user2.gender && user1.gender !== user2.gender) {
    diversityPoints += 30;
  }

  return Math.min(diversityPoints, 100);
}

/**
 * 计算两个用户的配对兼容性分数 (0-100)
 * 
 * 匹配权重配置:
 * - Chemistry (性格化学反应): 28%
 * - Interest (兴趣重叠): 28%
 * - Preference (活动偏好): 15%
 * - Language (语言沟通): 12%
 * - Background (背景评估 — 含人生阶段亲和力 + 同乡 + 行业/学历/性别多样性): 17% (ALWAYS ACTIVE)
 */
async function calculatePairScore(user1: UserWithProfile, user2: UserWithProfile): Promise<number> {
  const chemistry = calculateChemistryScore(user1, user2);
  const interest = await calculateInterestScoreAsync(user1.userId, user2.userId);
  const language = calculateLanguageScore(user1, user2);
  const preference = calculatePreferenceScore(user1, user2);

  // ✅ UPDATED: Unified background score (includes industry diversity, life stage affinity,
  // hometown when opted in, education diversity, gender diversity). ALWAYS ACTIVE at 17%.
  const background = calculateBackgroundScore(user1, user2);

  const weights = {
    chemistry: 0.28,    // 性格兼容性 28%
    interest: 0.28,     // 兴趣重叠 28%
    language: 0.12,     // 语言沟通 12%
    preference: 0.15,   // 活动偏好 15%
    background: 0.17,   // 背景评估 17% (ALWAYS ACTIVE — hometown folded in)
  };

  const totalScore =
    chemistry * weights.chemistry +
    interest * weights.interest +
    language * weights.language +
    preference * weights.preference +
    background * weights.background;

  return Math.round(totalScore);
}

/**
 * 计算小组内所有成员的平均配对兼容性分数
 * 包含：chemistry + interest + preference + language（不含diversity）
 */
async function calculateGroupPairScore(members: UserWithProfile[]): Promise<number> {
  if (members.length < 2) return 0;
  
  let totalScore = 0;
  let pairCount = 0;
  
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      totalScore += await calculatePairScore(members[i], members[j]);
      pairCount++;
    }
  }
  
  return pairCount > 0 ? Math.round(totalScore / pairCount) : 0;
}

/**
 * Calculate group diversity score
 * Evaluates diversity across industries, genders, archetypes, and life stages
 */
function calculateGroupDiversity(members: UserWithProfile[]): number {
  if (members.length === 0) return 0;

  const uniqueIndustries = new Set(members.map((m) => m.industryNiche).filter(Boolean)).size;
  const uniqueGenders = new Set(members.map((m) => m.gender).filter(Boolean)).size;
  const uniqueArchetypes = new Set(members.map((m) => m.archetype).filter(Boolean)).size;
  const uniqueLifeStages = new Set(members.map((m) => m.workMode).filter(Boolean)).size; // 人生阶段

  // Normalize to 0-100, each of 4 dimensions contributes 25 points
  const maxDiversity = members.length;
  const diversityScore =
    (uniqueIndustries / maxDiversity) * 25 +
    (uniqueGenders / maxDiversity) * 25 +
    (uniqueArchetypes / maxDiversity) * 25 +
    (uniqueLifeStages / maxDiversity) * 25;

  // Clamp to [0, 100] to avoid any floating point drift
  return Math.round(Math.max(0, Math.min(100, diversityScore)));
}

/**
 * 计算小组的沟通兼容性分数 (0-100)
 * 评估小组成员之间的语言沟通兼容性，确保小组内大多数成员能有效交流。
 * 分数 = 组内所有配对的平均语言兼容分数。
 */
function calculateCommunicationBalance(members: UserWithProfile[]): number {
  if (members.length < 2) return 50;

  let totalScore = 0;
  let pairCount = 0;

  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      totalScore += calculateLanguageScore(members[i], members[j]);
      pairCount++;
    }
  }

  return pairCount > 0 ? Math.round(totalScore / pairCount) : 50;
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
  
  return `${tempEmoji} 这个小组有${group.members.length}位成员，包含${archetypes.length}种人格类型（${archetypes.join("、")}），来自${industries.length}个行业。配对兼容性${group.avgPairScore}分，多样性${group.diversityScore}分，沟通兼容性${group.communicationBalance}分，综合匹配度${group.overallScore}分。`;
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
      tasteIntensity: eventPoolRegistrations.tasteIntensity,
      gender: users.gender,
      birthdate: users.birthdate,
      // ✅ UPDATED: Use 3-tier industry classification
      industryNiche: users.industryNiche,
      industryNicheLabel: users.industryNicheLabel,
      industryCategoryLabel: users.industryCategoryLabel,
      educationLevel: users.educationLevel,
      archetype: users.archetype,
      secondaryArchetype: users.secondaryArchetype,
      workMode: users.workMode,  // 人生阶段 for matching
      hometown: users.hometownRegionCity,
      hometownAffinityOptin: users.hometownAffinityOptin,
      eventType: eventPools.eventType,
      barBudgetRange: eventPoolRegistrations.barBudgetRange,
      barThemes: eventPoolRegistrations.barThemes,
      alcoholComfort: eventPoolRegistrations.alcoholComfort,
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
    meetsHardConstraints(reg, pool)
  );
  
  if (eligibleUsers.length < (pool.minGroupSize || 4)) {
    throw new Error(`报名人数不足，至少需要${pool.minGroupSize}人`);
  }
  
  // 3.5 获取邀请关系 (invitation relationships)
  // Query all invitation uses for registrations in this pool
  const registrationIds = eligibleUsers.map(u => u.registrationId);
  
  // Build invitation map: inviteeUserId -> inviterUserId
  // This will help us prioritize matching invited users with their inviters
  const invitationPairs: Array<{inviterId: string, inviteeId: string}> = [];
  
  for (const user of eligibleUsers) {
    // Check if this user was invited (is an invitee)
    const [inviteUse]: any = await db
      .select()
      .from(invitationUses)
      .where(eq(invitationUses.poolRegistrationId, user.registrationId))
      .limit(1);
    
    if (inviteUse && inviteUse.invitationId) {
      // Get the invitation to find who invited this user
      const [invitation]: any = await db
        .select()
        .from(invitations)
        .where(eq(invitations.code, inviteUse.invitationId))
        .limit(1);
      
      if (invitation) {
        // Check if inviter is also in this pool
        const inviter = eligibleUsers.find((u) => u.userId === invitation.inviterId);
        if (inviter) {
          invitationPairs.push({
            inviterId: inviter.userId,
            inviteeId: user.userId
          });
        }
      }
    }
  }
  
  // 4. 贪婪分组算法（优先处理邀请关系）
  const groups: MatchGroup[] = [];
  const used = new Set<string>();
  const targetGroupSize = pool.maxGroupSize || 6;
  const minGroupSize = pool.minGroupSize || 4;
  
  // 计算所有可能的配对分数，并为邀请关系加权
  const pairScores: { user1: UserWithProfile; user2: UserWithProfile; score: number; isInvited: boolean }[] = [];
  for (let i = 0; i < eligibleUsers.length; i++) {
    for (let j = i + 1; j < eligibleUsers.length; j++) {
      let score = await calculatePairScore(
        eligibleUsers[i] as UserWithProfile, 
        eligibleUsers[j] as UserWithProfile
      );
      
      // Check if this pair has an invitation relationship
      const user1 = eligibleUsers[i] as UserWithProfile;
      const user2 = eligibleUsers[j] as UserWithProfile;
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
  
  // 贪婪组建小组
  for (const pair of pairScores) {
    if (used.has(pair.user1.userId) || used.has(pair.user2.userId)) continue;
    
    // 以这对高分用户为核心，找到其他合适的成员
    const groupMembers = [pair.user1, pair.user2];
    used.add(pair.user1.userId);
    used.add(pair.user2.userId);
    
    // 继续添加成员直到达到目标人数
    while (groupMembers.length < targetGroupSize) {
      let bestCandidate: UserWithProfile | null = null;
      let bestScore = 0;
      
      for (const candidate of eligibleUsers as UserWithProfile[]) {
        if (used.has(candidate.userId)) continue;
        
        // 计算候选人与当前小组成员的平均分数
        let totalScore = 0;
        for (const member of groupMembers) {
          totalScore += await calculatePairScore(candidate, member);
        }
        const avgScore = totalScore / groupMembers.length;
        
        if (avgScore > bestScore) {
          bestScore = avgScore;
          bestCandidate = candidate;
        }
      }
      
      if (bestCandidate && bestScore >= 60) { // 最低质量门槛
        groupMembers.push(bestCandidate);
        used.add(bestCandidate.userId);
      } else {
        break; // 没有合适的候选人
      }
    }
    
    // 只保留达到最小人数的小组
    if (groupMembers.length >= minGroupSize) {
      const avgPairScore = await calculateGroupPairScore(groupMembers);
      const diversity = calculateGroupDiversity(groupMembers);
      const communicationBalance = calculateCommunicationBalance(groupMembers);
      const overall = Math.round((avgPairScore * 0.6) + (diversity * 0.25) + (communicationBalance * 0.15));
      const temperatureLevel = getTemperatureLevel(overall);
      
      const group: MatchGroup = {
        members: groupMembers,
        avgPairScore: avgPairScore,
        avgChemistryScore: avgPairScore, // Same as avgPairScore for now
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
  
  return groups;
}

/**
 * 保存匹配结果到数据库
 */
export async function saveMatchResults(poolId: string, groups: MatchGroup[]): Promise<void> {
  // 获取活动池信息用于通知
  const [pool] = await db.select().from(eventPools).where(eq(eventPools.id, poolId));
  
  // 1. 创建小组记录并发送WebSocket通知
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    
    // 1.1 Generate event theme title for this group
    let eventThemeTitle: string | null = null;
    let themeTagline: string | null = null;
    let themeEmoji: string | null = null;
    let themeReasoning: string | null = null;
    
    const memberUserIds = group.members.map(m => m.userId);
    
    try {
      const themeTitleResult = await generateEventThemeTitle(memberUserIds, poolId);
      eventThemeTitle = themeTitleResult.eventThemeTitle;
      themeTagline = themeTitleResult.themeTagline;
      themeEmoji = themeTitleResult.emoji;
      themeReasoning = themeTitleResult.reasoning;
      
      console.log(`[Pool Matching] Generated event theme title for group ${i + 1}: ${eventThemeTitle} - ${themeTagline} ${themeEmoji}`);
    } catch (error) {
      console.error(`[Pool Matching] Failed to generate event theme title for group ${i + 1}:`, error);
      // Continue without event theme title - it's not critical for matching
    }
    
    const [groupRecord] = await db.insert(eventPoolGroups).values({
      poolId,
      groupNumber: i + 1,
      memberCount: group.members.length,
      avgChemistryScore: group.avgPairScore,
      diversityScore: group.diversityScore,
      communicationBalance: group.communicationBalance,
      overallScore: group.overallScore,
      temperatureLevel: group.temperatureLevel,
      matchExplanation: group.explanation,
      theme: eventThemeTitle,
      subtitle: themeTagline,
      themeEmoji: themeEmoji,
      themeReasoning: themeReasoning,
      themeGeneratedAt: (eventThemeTitle || themeTagline || themeEmoji || themeReasoning) ? new Date() : null,
      status: "confirmed"
    }).returning();
    
    // 1.5 Generate and save event theme (mystery box 盲盒主题)
    // Fire-and-forget to avoid blocking match save
    generateAndSaveEventTheme(groupRecord.id, memberUserIds, poolId)
      .then(() => {
        console.log(`[Pool Matching] ✅ Generated event theme for group ${i + 1}`);
      })
      .catch((error) => {
        console.error(`[Pool Matching] ⚠️ Theme generation failed for group ${i + 1}:`, error);
      });
    
    // 2. 更新用户报名状态
    const memberRegistrationIds = group.members.map(m => m.registrationId);
    await db.update(eventPoolRegistrations)
      .set({
        matchStatus: "matched",
        assignedGroupId: groupRecord.id,
        matchScore: group.overallScore,
        updatedAt: new Date()
      })
      .where(inArray(eventPoolRegistrations.id, memberRegistrationIds));
    
    // 2.5 创建对应的events记录，使其出现在活动管理模块
    const location = pool?.district ? `${pool.city} ${pool.district}` : pool?.city || "待定";
    
    const [eventRecord] = await db.insert(events).values({
      title: `${pool?.title || "盲盒活动"} - 第${i + 1}组`,
      description: `来自活动池匹配：${pool?.description || ""}\n匹配分数: ${group.overallScore}\n化学反应: ${group.temperatureLevel}`,
      dateTime: pool?.dateTime || new Date(),
      location: location,
      area: pool?.district || null,
      maxAttendees: group.members.length,
      currentAttendees: group.members.length,
      hostId: pool?.createdBy || null,
      status: "matched", // 匹配成功的状态
      iconName: pool?.eventType === "饭局" ? "utensils" : pool?.eventType === "酒局" ? "wine" : "calendar",
    }).returning();
    
    // 2.6 为每个成员创建eventAttendance记录
    for (const member of group.members) {
      await db.insert(eventAttendance).values({
        eventId: eventRecord.id,
        userId: member.userId,
        status: "confirmed",
      });
    }
    
    // 2.7 更新groupRecord关联的eventId（如果需要的话，可以在eventPoolGroups表添加eventId字段）
    // 这里暂时不修改schema，只是创建关联记录
    
    console.log(`[Pool Matching] Created event ${eventRecord.id} for group ${i + 1} with ${memberUserIds.length} attendees`);
    
    // 3. 发送WebSocket通知给每个匹配到的用户
    const notificationData: PoolMatchedData = {
      poolId,
      poolTitle: pool?.title || "活动池",
      groupId: groupRecord.id,
      groupNumber: i + 1,
      matchScore: group.overallScore,
      memberCount: group.members.length,
      temperatureLevel: group.temperatureLevel
    };
    
    memberUserIds.forEach(userId => {
      wsService.broadcastToUser(userId, {
        type: "POOL_MATCHED",
        data: notificationData,
        timestamp: new Date().toISOString()
      });
    });
    
    console.log(`[Pool Matching] Sent POOL_MATCHED notification to ${memberUserIds.length} users for group ${i + 1}`);
  }
  
  // 4. 更新活动池状态
  await db.update(eventPools)
    .set({
      status: "matched",
      successfulMatches: groups.reduce((sum, g) => sum + g.members.length, 0),
      matchedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(eventPools.id, poolId));
  
  // 5. 标记未匹配用户
  await db.update(eventPoolRegistrations)
    .set({
      matchStatus: "unmatched",
      updatedAt: new Date()
    })
    .where(
      and(
        eq(eventPoolRegistrations.poolId, poolId),
        eq(eventPoolRegistrations.matchStatus, "pending")
      )
    );
  
  // 6. 发放邀请奖励优惠券 (Invitation Reward Coupons)
  await processInvitationRewards(poolId, groups);
  
  // 7. 自动分配场地 (Automatic Venue Assignment)
  console.log(`[Pool Matching] ✅ ${groups.length} groups created, starting venue assignment...`);
  
  try {
    const venueAssignments = await assignVenuesToGroups(
      groups,
      poolId,
      pool?.dateTime || new Date(),
      pool?.city || "",
      pool?.district,
      pool?.eventType || "饭局"
    );
    
    // Save venue assignments to database
    await saveVenueAssignments(poolId, venueAssignments);
    
    console.log(`[Pool Matching] ✅ Venue assignment complete: ${venueAssignments.size}/${groups.length} groups assigned`);
  } catch (error) {
    console.error(`[Pool Matching] ⚠️ Venue assignment failed:`, error);
    // Don't throw - matching already succeeded, venue assignment is best-effort
  }

  // 8. 异步生成活动主题标题并广播 (Async Event Theme Title Generation & Broadcast)
  // Use setImmediate to queue event theme title generation without blocking
  setImmediate(() => {
    void (async () => {
      console.log(`[Pool Matching] Starting async event theme title generation for ${groups.length} groups...`);
      
      try {
        const { generateAndAssignEventThemeTitle } = await import('./eventThemeTitleGenerator');
        
        // Pre-fetch all group records for this pool to avoid per-group queries
        const groupRecords = await db.select().from(eventPoolGroups)
          .where(eq(eventPoolGroups.poolId, poolId));
        
        const groupIdByNumber = new Map<number, string>();
        for (const record of groupRecords) {
          // Assumes groupNumber is unique per pool
          groupIdByNumber.set(record.groupNumber, record.id);
        }
        
        for (let i = 0; i < groups.length; i++) {
          const group = groups[i];
          const groupId = groupIdByNumber.get(i + 1);
          
          if (!groupId) continue;
          
          try {
            const themeTitleResult = await generateAndAssignEventThemeTitle(
              groupId,
              group,
              pool?.eventType || "饭局"
            );
            
            if (themeTitleResult) {
              // Broadcast EVENT_THEME_TITLE_REVEALED to all group members
              const memberUserIds = group.members.map(m => m.userId);
              
              memberUserIds.forEach(userId => {
                wsService.broadcastToUser(userId, {
                  type: "EVENT_THEME_TITLE_REVEALED",
                  data: {
                    poolId,
                    groupId,
                    eventThemeTitle: themeTitleResult.eventThemeTitle,
                    themeTagline: themeTitleResult.themeTagline,
                    themeEmoji: themeTitleResult.themeEmoji,
                    themeHighlights: themeTitleResult.themeHighlights,
                    themeVibe: themeTitleResult.themeVibe
                  },
                  timestamp: new Date().toISOString()
                });
              });
              
              console.log(`[Pool Matching] ✅ Event theme title revealed for group ${i + 1}: ${themeTitleResult.themeEmoji} ${themeTitleResult.eventThemeTitle}`);
            }
          } catch (error) {
            console.error(`[Pool Matching] ⚠️ Event theme title generation failed for group ${i + 1}:`, error);
            // Don't throw - matching already succeeded, event theme title is optional
          }
        }
      } catch (error) {
        console.error(`[Pool Matching] ⚠️ Async event theme title generation failed:`, error);
        // Don't throw - matching already succeeded, event theme titles are best-effort
      }
    })();
  });
}

/**
 * 处理邀请奖励：为成功匹配的邀请关系发放优惠券
 */
async function processInvitationRewards(poolId: string, groups: MatchGroup[]): Promise<void> {
  // 查找邀请奖励优惠券（管理员需要预先创建code为"INVITE_REWARD"的优惠券）
  const [inviteRewardCoupon] = await db.select()
    .from(coupons)
    .where(eq(coupons.code, "INVITE_REWARD"))
    .limit(1);
  
  if (!inviteRewardCoupon || !inviteRewardCoupon.isActive) {
    console.log('[Invitation Reward] No active INVITE_REWARD coupon found, skipping rewards');
    return;
  }
  
  // 获取该pool的所有成功匹配的用户
  const allMatchedUserIds = groups.flatMap(g => g.members.map(m => m.userId));
  
  // 查找所有涉及该pool的邀请使用记录
  const poolRegistrations = await db.select()
    .from(eventPoolRegistrations)
    .where(eq(eventPoolRegistrations.poolId, poolId));
  
  const registrationIds = poolRegistrations.map((r: any) => r.id);
  
  if (registrationIds.length === 0) return;
  
  const inviteUses = await db.select()
    .from(invitationUses)
    .where(inArray(invitationUses.poolRegistrationId, registrationIds));
  
  // 对于每个邀请使用记录，检查是否成功匹配到同一局
  for (const inviteUse of inviteUses) {
    if (inviteUse.rewardIssued || !inviteUse.invitationId) continue;
    
    // 获取邀请信息
    const [invitation] = await db.select()
      .from(invitations)
      .where(eq(invitations.code, inviteUse.invitationId))
      .limit(1);
    
    if (!invitation) continue;
    
    const inviterId = invitation.inviterId;
    const inviteeId = inviteUse.inviteeId;
    
    // 检查inviter和invitee是否都在匹配用户列表中
    if (!allMatchedUserIds.includes(inviterId) || !allMatchedUserIds.includes(inviteeId)) {
      continue;
    }
    
    // 检查他们是否在同一个group中
    let matchedTogether = false;
    for (const group of groups) {
      const groupUserIds = group.members.map(m => m.userId);
      if (groupUserIds.includes(inviterId) && groupUserIds.includes(inviteeId)) {
        matchedTogether = true;
        break;
      }
    }
    
    if (matchedTogether) {
      // 发放优惠券给邀请人
      try {
        await db.insert(userCoupons).values({
          userId: inviterId,
          couponId: inviteRewardCoupon.id,
          source: "invitation_reward",
          sourceId: invitation.id,
          isUsed: false
        });
        
        // 标记奖励已发放
        await db.update(invitationUses)
          .set({
            matchedTogether: true,
            rewardIssued: true,
            matchedAt: new Date()
          })
          .where(eq(invitationUses.id, inviteUse.id));
        
        console.log(`[Invitation Reward] Issued coupon to user ${inviterId} for inviting ${inviteeId}`);
      } catch (error) {
        console.error(`[Invitation Reward] Failed to issue coupon:`, error);
      }
    }
  }
}

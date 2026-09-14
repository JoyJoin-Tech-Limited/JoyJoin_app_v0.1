/**
 * Shared matching-domain types.
 *
 * Extracted verbatim from `poolMatchingService.ts` as a behavior-preserving
 * modularization; the public API is re-exported from `poolMatchingService.ts`.
 */

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

  // Item 5 (V4 engine upgrade): REPORTED ACOEXP trait vector from the user's
  // latest COMPLETED assessment session — the explicit trait-carrying input
  // for the literature-prior composition gates (AC-5.1b). Optional and inert
  // unless `compositionGatesEnabled` is threaded into the core: pair scoring
  // NEVER reads this field. Cold-start policy: members without a complete
  // vector skip gates (i)/(ii)/(iv) (R3 skip-on-missing-cache precedent).
  traitScores?: CompositionTraitVector | null;
}

/**
 * Reported ACOEXP vector (0–100 per trait) consumed by the Item 5
 * composition gates. All six keys must be finite numbers for the vector to
 * be usable; anything less is treated as cold-start (gates skip).
 */
export interface CompositionTraitVector {
  A?: number;
  C?: number;
  E?: number;
  O?: number;
  X?: number;
  P?: number;
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
 * Per-run user interest cache type.
 * Key: userId → { topics, heatMap }
 */
export type UserInterestsCache = Map<string, { topics: string[]; heatMap: Record<string, number> }>;


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

/**
 * Pair-dimension affinity/diversity helpers — language, event preference,
 * hometown, life-stage, education, age/vibe preference, social affinity, and
 * background diversity — plus the per-dimension data-availability predicates.
 *
 * Extracted verbatim from `poolMatchingService.ts` as a behavior-preserving
 * modularization; the public API is re-exported from `poolMatchingService.ts`.
 */
import type { UserWithProfile } from "../poolMatchingService";

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
export function getEffectiveIntent(user: UserWithProfile): string[] {
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
export function calculateSocialAffinityScore(user1: UserWithProfile, user2: UserWithProfile): number {
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

// ── W6 (gm-debrief) AC-W6.3: per-dimension data availability ────────────────
// A dimension is "available" only when the pair actually supplies the inputs
// the scorer reads. Mirrors each dimension function's factor list so an absent
// dimension is dropped from the weighted denominator rather than neutral-scored.

export function pairHasPreferenceData(user1: UserWithProfile, user2: UserWithProfile): boolean {
  const eventType = user1.eventType || user2.eventType || "饭局";
  if (eventType === "酒局") {
    if ((user1.barThemes?.length ?? 0) > 0 && (user2.barThemes?.length ?? 0) > 0) return true;
    if ((user1.alcoholComfort?.length ?? 0) > 0 && (user2.alcoholComfort?.length ?? 0) > 0) return true;
  }
  if ((user1.dietaryRestrictions?.length ?? 0) > 0 || (user2.dietaryRestrictions?.length ?? 0) > 0) return true;
  const goals1 = getEffectiveIntent(user1).filter((g) => g !== "flexible");
  const goals2 = getEffectiveIntent(user2).filter((g) => g !== "flexible");
  return goals1.length > 0 && goals2.length > 0;
}

export function pairHasSocialAffinityData(user1: UserWithProfile, user2: UserWithProfile): boolean {
  if (user1.lifeStage && user2.lifeStage) return true;
  if (user1.educationLevel && user2.educationLevel) return true;
  if (user1.hometownAffinityOptin && user2.hometownAffinityOptin) return true;
  if (user1.ageMatchPreference && user2.ageMatchPreference) return true;
  if (user1.tableVibePreference && user2.tableVibePreference) return true;
  return false;
}

export function pairHasBackgroundDiversityData(user1: UserWithProfile, user2: UserWithProfile): boolean {
  if (user1.industryNiche && user2.industryNiche) return true;
  if (user1.gender && user2.gender) return true;
  return false;
}

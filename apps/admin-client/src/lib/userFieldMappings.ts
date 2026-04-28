/**
 * User field Chinese mappings for displaying demographic information
 */

import { getIntentLabel, INTENT_OPTIONS, INTENT_FLEXIBLE_OPTION } from "@shared/constants";

export const genderMap: Record<string, string> = {
  "Woman": "女",
  "Man": "男",
  "Nonbinary": "非二元",
  "Self-describe": "自定义",
  "Prefer not to say": "不便透露",
};

export const genderIconMap: Record<string, string> = {
  "Woman": "♀",
  "Man": "♂",
  "Nonbinary": "⚧",
  "Self-describe": "◆",
  "Prefer not to say": "•",
};

export const educationLevelMap: Record<string, string> = {
  "High school/below": "高中及以下",
  "Some college/Associate": "大专",
  "Bachelor's": "本科",
  "Master's": "硕士",
  "Doctorate": "博士",
  "Trade/Vocational": "职业技术",
  "Prefer not to say": "不便透露",
};

export const relationshipStatusMap: Record<string, string> = {
  "Single": "单身",
  "In a relationship": "恋爱中",
  "Married/Partnered": "已婚",
  "It's complicated": "复杂",
  "Prefer not to say": "不便透露",
};

export const studyLocaleMap: Record<string, string> = {
  "Local": "本地",
  "Overseas": "海外",
  "Both": "都有",
  "Prefer not to say": "不便透露",
};

export const childrenMap: Record<string, string> = {
  "No kids": "无孩子",
  "Expecting": "期待中",
  "0-5": "0-5岁",
  "6-12": "6-12岁",
  "13-18": "13-18岁",
  "Adult": "成年",
  "Prefer not to say": "不便透露",
};

// Intent label map derived from shared constants (for backward compatibility)
export const intentMap: Record<string, string> = Object.fromEntries(
  [...INTENT_OPTIONS.map(o => [o.value, o.label]), [INTENT_FLEXIBLE_OPTION.value, INTENT_FLEXIBLE_OPTION.label]]
);

// Intent options derived from shared constants (with descriptions for selection UI)
export const intentOptions = [
  ...INTENT_OPTIONS.map(o => ({ value: o.value, label: o.label, description: o.subtitle })),
  { value: INTENT_FLEXIBLE_OPTION.value, label: INTENT_FLEXIBLE_OPTION.label, description: INTENT_FLEXIBLE_OPTION.description },
] as const;

/**
 * Format age with Chinese unit
 */
export function formatAge(age: number | null | undefined): string {
  if (!age || age <= 0) return "";
  return `${age}岁`;
}

/**
 * Calculate age from birthdate
 */
export function calculateAge(birthdate: string | null | undefined): number {
  if (!birthdate) return 0;
  const today = new Date();
  const birth = new Date(birthdate + 'T00:00:00');
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Get gender display text
 */
export function getGenderDisplay(gender: string | null | undefined): string {
  if (!gender) return "";
  return genderMap[gender] || gender;
}

/**
 * Get gender icon
 */
export function getGenderIcon(gender: string | null | undefined): string {
  if (!gender) return "";
  return genderIconMap[gender] || "•";
}

/**
 * Get education level display text
 */
export function getEducationDisplay(educationLevel: string | null | undefined): string {
  if (!educationLevel) return "";
  return educationLevelMap[educationLevel] || educationLevel;
}

/**
 * Get relationship status display text
 */
export function getRelationshipDisplay(relationshipStatus: string | null | undefined): string {
  if (!relationshipStatus) return "";
  return relationshipStatusMap[relationshipStatus] || relationshipStatus;
}

/**
 * Get study locale display text
 */
export function getStudyLocaleDisplay(studyLocale: string | null | undefined): string {
  if (!studyLocale) return "";
  return studyLocaleMap[studyLocale] || studyLocale;
}

/**
 * Get children status display text
 */
export function getChildrenDisplay(children: string | null | undefined): string {
  if (!children) return "";
  return childrenMap[children] || children;
}

/**
 * Get intent display text (supports both single string and array)
 */
export function getIntentDisplay(intent: string | string[] | null | undefined): string {
  if (!intent) return "";
  if (Array.isArray(intent)) {
    if (intent.length === 0) return "";
    return intent.map(i => getIntentLabel(i)).join("、");
  }
  return getIntentLabel(intent);
}

/**
 * Format array with bullet separator
 */
export function formatArray(arr: string[] | null | undefined): string {
  if (!arr || arr.length === 0) return "";
  return arr.join(" · ");
}

/**
 * 12个社交氛围原型映射
 */
export const archetypeMap: Record<string, string> = {
  "corgi": "corgi 🐶",
  "rooster": "rooster 🐔",
  "hamster_praise": "hamster_praise 🐹",
  "fox": "fox 🦊",
  "dolphin_calm": "dolphin_calm 🐬",
  "spider": "spider 🕷️",
  "koala": "koala 🐨",
  "octopus": "octopus 🐙",
  "owl": "owl 🦉",
  "elephant": "elephant 🐘",
  "turtle": "turtle 🐢",
  "cat": "cat 🐱",
};

export const archetypeNicknameMap: Record<string, string> = {
  "corgi": "摇尾点火官",
  "rooster": "咯咯小太阳",
  "hamster_praise": "掌声发动机",
  "fox": "巷口密探",
  "dolphin_calm": "气氛冲浪手",
  "spider": "关系织网师",
  "koala": "怀抱故事熊",
  "octopus": "脑洞喷墨章",
  "owl": "推镜思考官",
  "elephant": "象鼻定心锚",
  "turtle": "慢语真知龟",
  "cat": "安静伴伴猫",
};

export const archetypeOptions = [
  { value: "corgi", label: "corgi 🐶", nickname: "摇尾点火官", energy: 95 },
  { value: "rooster", label: "rooster 🐔", nickname: "咯咯小太阳", energy: 90 },
  { value: "hamster_praise", label: "hamster_praise 🐹", nickname: "掌声发动机", energy: 85 },
  { value: "fox", label: "fox 🦊", nickname: "巷口密探", energy: 82 },
  { value: "dolphin_calm", label: "dolphin_calm 🐬", nickname: "气氛冲浪手", energy: 75 },
  { value: "spider", label: "spider 🕷️", nickname: "关系织网师", energy: 72 },
  { value: "koala", label: "koala 🐨", nickname: "怀抱故事熊", energy: 70 },
  { value: "octopus", label: "octopus 🐙", nickname: "脑洞喷墨章", energy: 68 },
  { value: "owl", label: "owl 🦉", nickname: "推镜思考官", energy: 55 },
  { value: "elephant", label: "elephant 🐘", nickname: "象鼻定心锚", energy: 52 },
  { value: "turtle", label: "turtle 🐢", nickname: "慢语真知龟", energy: 38 },
  { value: "cat", label: "cat 🐱", nickname: "安静伴伴猫", energy: 30 },
] as const;

/**
 * Get archetype display text (with emoji)
 */
export function getArchetypeDisplay(archetype: string | null | undefined): string {
  if (!archetype) return "";
  return archetypeMap[archetype] || archetype;
}

/**
 * Get archetype nickname
 */
export function getArchetypeNickname(archetype: string | null | undefined): string {
  if (!archetype) return "";
  return archetypeNicknameMap[archetype] || "";
}

// ============================================
// 兴趣/话题字段统一访问接口
// 支持新旧字段的向后兼容
// ============================================

interface UserWithInterests {
  primaryInterests?: string[] | null;
  interestsTop?: string[] | null;
  interestFavorite?: string | null;
  topicAvoidances?: string[] | null;
  topicsAvoid?: string[] | null;
  topicsHappy?: string[] | null;
}

/**
 * 获取用户主要兴趣（优先使用新字段 primaryInterests）
 * 向后兼容旧字段 interestsTop
 */
export function getUserPrimaryInterests(user: UserWithInterests | null | undefined): string[] {
  if (!user) return [];
  return user.primaryInterests || user.interestsTop || [];
}

/**
 * 获取用户话题排斥（优先使用新字段 topicAvoidances）
 * 向后兼容旧字段 topicsAvoid
 */
export function getUserTopicAvoidances(user: UserWithInterests | null | undefined): string[] {
  if (!user) return [];
  return user.topicAvoidances || user.topicsAvoid || [];
}

/**
 * 获取用户喜欢的话题（旧字段，仅用于兼容）
 * 新流程使用"排斥法"，不再收集喜欢的话题
 */
export function getUserTopicsHappy(user: UserWithInterests | null | undefined): string[] {
  if (!user) return [];
  return user.topicsHappy || [];
}

/**
 * 获取用户所有兴趣（包含主要兴趣和普通兴趣）
 */
export function getUserAllInterests(user: UserWithInterests | null | undefined): string[] {
  if (!user) return [];
  const primary = user.primaryInterests || [];
  const all = user.interestsTop || [];
  // 合并去重，主要兴趣排前面
  const combined = [...primary];
  for (const interest of all) {
    if (!combined.includes(interest)) {
      combined.push(interest);
    }
  }
  return combined;
}

/**
 * 检查用户是否有话题冲突
 * 用于匹配算法：A喜欢的话题 vs B排斥的话题
 */
export function hasTopicConflict(
  userATopicsHappy: string[] | null | undefined,
  userBTopicAvoidances: string[] | null | undefined
): boolean {
  if (!userATopicsHappy || !userBTopicAvoidances) return false;
  return userATopicsHappy.some(topic => userBTopicAvoidances.includes(topic));
}

/**
 * User field Chinese mappings for displaying demographic information
 */

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

export const seniorityMap: Record<string, string> = {
  "Intern": "实习生",
  "Junior": "初级",
  "Mid": "中级",
  "Senior": "高级",
  "Founder": "创始人",
  "Executive": "高管",
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

export const intentMap: Record<string, string> = {
  "networking": "拓展人脉",
  "friends": "交朋友",
  "discussion": "深度讨论",
  "fun": "娱乐放松",
  "romance": "浪漫社交",
  "flexible": "灵活开放·都可以",
};

// Intent options with descriptions for selection UI
export const intentOptions = [
  { value: "networking", label: "拓展人脉", description: "结识专业人士，扩大社交圈" },
  { value: "friends", label: "交朋友", description: "寻找志同道合的朋友" },
  { value: "discussion", label: "深度讨论", description: "交流想法，深入探讨话题" },
  { value: "fun", label: "娱乐放松", description: "轻松愉快，享受社交时光" },
  { value: "romance", label: "浪漫社交", description: "认识潜在的恋爱对象" },
  { value: "flexible", label: "灵活开放·都可以", description: "对所有活动类型保持开放" },
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
  const birth = new Date(birthdate);
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
 * Get seniority display text
 */
export function getSeniorityDisplay(seniority: string | null | undefined): string {
  if (!seniority) return "";
  return seniorityMap[seniority] || seniority;
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
    return intent.map(i => intentMap[i] || i).join("、");
  }
  return intentMap[intent] || intent;
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
  "开心柯基": "开心柯基 🐶",
  "太阳鸡": "太阳鸡 🐔",
  "夸夸豚": "夸夸豚 🐹",
  "机智狐": "机智狐 🦊",
  "淡定海豚": "淡定海豚 🐬",
  "织网蛛": "织网蛛 🕷️",
  "暖心熊": "暖心熊 🐨",
  "灵感章鱼": "灵感章鱼 🐙",
  "沉思猫头鹰": "沉思猫头鹰 🦉",
  "定心大象": "定心大象 🐘",
  "稳如龟": "稳如龟 🐢",
  "隐身猫": "隐身猫 🐱",
};

export const archetypeNicknameMap: Record<string, string> = {
  "开心柯基": "摇尾点火官",
  "太阳鸡": "咯咯小太阳",
  "夸夸豚": "掌声发动机",
  "机智狐": "巷口密探",
  "淡定海豚": "气氛冲浪手",
  "织网蛛": "关系织网师",
  "暖心熊": "怀抱故事熊",
  "灵感章鱼": "脑洞喷墨章",
  "沉思猫头鹰": "推镜思考官",
  "定心大象": "象鼻定心锚",
  "稳如龟": "慢语真知龟",
  "隐身猫": "安静伴伴猫",
};

export const archetypeOptions = [
  { value: "开心柯基", label: "开心柯基 🐶", nickname: "摇尾点火官", energy: 95 },
  { value: "太阳鸡", label: "太阳鸡 🐔", nickname: "咯咯小太阳", energy: 90 },
  { value: "夸夸豚", label: "夸夸豚 🐹", nickname: "掌声发动机", energy: 85 },
  { value: "机智狐", label: "机智狐 🦊", nickname: "巷口密探", energy: 82 },
  { value: "淡定海豚", label: "淡定海豚 🐬", nickname: "气氛冲浪手", energy: 75 },
  { value: "织网蛛", label: "织网蛛 🕷️", nickname: "关系织网师", energy: 72 },
  { value: "暖心熊", label: "暖心熊 🐨", nickname: "怀抱故事熊", energy: 70 },
  { value: "灵感章鱼", label: "灵感章鱼 🐙", nickname: "脑洞喷墨章", energy: 68 },
  { value: "沉思猫头鹰", label: "沉思猫头鹰 🦉", nickname: "推镜思考官", energy: 55 },
  { value: "定心大象", label: "定心大象 🐘", nickname: "象鼻定心锚", energy: 52 },
  { value: "稳如龟", label: "稳如龟 🐢", nickname: "慢语真知龟", energy: 38 },
  { value: "隐身猫", label: "隐身猫 🐱", nickname: "安静伴伴猫", energy: 30 },
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

/**
 * Unified Chinese enums for all user fields
 * Single source of truth to ensure consistency across registration and profile editing
 */

// Gender options
export const GENDER_OPTIONS = ["女性", "男性", "不透露"] as const;
export type Gender = typeof GENDER_OPTIONS[number];

// Education level options — ordered highest to lowest
export const EDUCATION_LEVEL_OPTIONS = ["博士", "硕士", "本科", "大专", "中专", "高中及以下"] as const;
export type EducationLevel = typeof EDUCATION_LEVEL_OPTIONS[number];

/**
 * Ordinal proximity mapping for education levels.
 * Used by display/sorting logic that needs a linear academic progression scale.
 * NOTE: The matching algorithm's affinity scoring uses its own local mapping
 * (poolMatchingService.ts EDUCATION_ORDINAL) which treats 中专 and 大专 as the
 * same tier for social-frequency scoring purposes.
 * Labels not in this map are treated as unknown.
 */
export const EDU_ORDINAL: Partial<Record<EducationLevel, number>> = {
  "博士": 6,
  "硕士": 5,
  "本科": 4,
  "大专": 3,
  "中专": 2,
  "高中及以下": 1,
};

// Seniority options (deprecated - use WORK_MODE_OPTIONS)
export const SENIORITY_OPTIONS = ["实习生", "初级", "中级", "高级", "资深", "创始人", "高管"] as const;
export type Seniority = typeof SENIORITY_OPTIONS[number];

// Work mode options (legacy standardized occupation system)
// DEPRECATED: new code should read/write users.lifeStage instead. Kept for one-release fallback.
export const WORK_MODE_OPTIONS = ["founder", "self_employed", "employed", "student", "transitioning", "caregiver_retired", "successor"] as const;
export type WorkMode = typeof WORK_MODE_OPTIONS[number];

// Work mode display labels (Chinese) — legacy fallback only
export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  founder: "创业中",
  self_employed: "自由职业",
  employed: "在职",
  student: "学生",
  transitioning: "探索期",
  caregiver_retired: "家庭为主",
  successor: "准备继承家业",
};

// Life stage canonical vocabulary — single source of truth for onboarding / matching / profile
export const LIFE_STAGE_OPTIONS = ["学生党", "职场新人", "职场老手", "创业中", "自由职业"] as const;
export type LifeStage = typeof LIFE_STAGE_OPTIONS[number];

// Work mode descriptions (Chinese) — legacy fallback only
export const WORK_MODE_DESCRIPTIONS: Record<WorkMode, string> = {
  founder: "创业中，自己当老板",
  self_employed: "独立工作，灵活接活",
  employed: "在企业、机构或组织任职",
  student: "在读、实习或Gap中",
  transitioning: "求职中、休整、转型中",
  caregiver_retired: "全职家长、照顾家人、退休、在家躺平",
  successor: "家族企业接班、二代培养",
};

// Relationship status options
export const RELATIONSHIP_STATUS_OPTIONS = ["单身", "恋爱中", "已婚/伴侣", "离异", "丧偶", "不透露"] as const;
export type RelationshipStatus = typeof RELATIONSHIP_STATUS_OPTIONS[number];

// Children/kids options
export const CHILDREN_OPTIONS = ["无孩子", "期待中", "0-5岁", "6-12岁", "13-18岁", "成年", "不透露"] as const;
export type Children = typeof CHILDREN_OPTIONS[number];

// Study locale options
export const STUDY_LOCALE_OPTIONS = ["本地", "海外", "都有"] as const;
export type StudyLocale = typeof STUDY_LOCALE_OPTIONS[number];

// Pronouns options
export const PRONOUNS_OPTIONS = ["她/She", "他/He", "它们/They", "自定义", "不透露"] as const;
export type Pronouns = typeof PRONOUNS_OPTIONS[number];

// Age visibility options (simplified: default shows age range to matched attendees)
export const AGE_VISIBILITY_OPTIONS = ["hide_all", "show_age_range"] as const;
export type AgeVisibility = typeof AGE_VISIBILITY_OPTIONS[number];

// Age visibility display labels (includes legacy value fallbacks)
export const AGE_VISIBILITY_LABELS: Record<string, string> = {
  hide_all: "完全隐藏",
  show_age_range: "显示年龄段给同桌人",
  // Legacy values - map to current options
  show_generation: "显示年龄段给同桌人",
  show_exact_age: "显示年龄段给同桌人",
};

// Normalize legacy ageVisibility values to new binary options
export function normalizeAgeVisibility(value: string | null | undefined): AgeVisibility {
  if (!value || value === "hide_all") return "hide_all";
  // All other values (show_age_range, show_generation, show_exact_age) map to show_age_range
  return "show_age_range";
}

// Work visibility options
export const WORK_VISIBILITY_OPTIONS = ["完全隐藏", "仅显示行业"] as const;
export type WorkVisibility = typeof WORK_VISIBILITY_OPTIONS[number];

// Education visibility options
export const EDUCATION_VISIBILITY_OPTIONS = ["完全隐藏", "仅显示学历", "显示学历和专业"] as const;
export type EducationVisibility = typeof EDUCATION_VISIBILITY_OPTIONS[number];

// Current city options (for 现居城市)
export const CURRENT_CITY_OPTIONS = ["香港", "深圳", "广州", "东莞", "珠海", "澳门", "其他"] as const;
export type CurrentCity = typeof CURRENT_CITY_OPTIONS[number];

// Activity time preference options (活动时段偏好)
export const ACTIVITY_TIME_PREFERENCE_OPTIONS = ["工作日晚上", "周末白天", "周末晚上", "都可以"] as const;
export type ActivityTimePreference = typeof ACTIVITY_TIME_PREFERENCE_OPTIONS[number];

// Social frequency options (聚会频率)
export const SOCIAL_FREQUENCY_OPTIONS = ["每周社交", "每两周一次", "每月一两次", "看心情"] as const;
export type SocialFrequency = typeof SOCIAL_FREQUENCY_OPTIONS[number];

// Languages comfort options - sorted by number of speakers (most to least)
export const LANGUAGES_COMFORT_OPTIONS = [
  "普通话",
  "粤语",
  "英语",
  "四川话",
  "东北话",
  "河南话",
  "山东话",
  "湖北话",
  "湖南话",
  "闽南话",
  "上海话",
  "客家话",
  "潮汕话",
  "温州话",
  "日语",
  "韩语",
  "法语",
  "德语",
  "西班牙语",
] as const;
export type LanguagesComfort = typeof LANGUAGES_COMFORT_OPTIONS[number];

// Dietary restriction canonical options (DB-stored values)
// NOTE: Some legacy/app-local surfaces store English machine values (e.g. "vegetarian",
// "halal", "seafood_allergy", "none"). Use normalizeDietaryRestrictionValue() to coerce.
export const DIETARY_RESTRICTION_OPTIONS = [
  { value: "素食", label: "素食", aliases: ["vegetarian", "vegan"] },
  { value: "不吃辣", label: "不吃辣", aliases: ["no_spicy", "no spicy"] },
  { value: "清真", label: "清真", aliases: ["halal"] },
  { value: "海鲜过敏", label: "海鲜过敏", aliases: ["seafood_allergy", "seafood allergy"] },
  { value: "无限制", label: "无限制", aliases: ["none", "no_restriction", "no restriction"] },
] as const;
export type DietaryRestriction = typeof DIETARY_RESTRICTION_OPTIONS[number]["value"];

// Preferred language canonical options (DB-stored values)
// NOTE: Some surfaces store simplified values like "普通话"/"粤语"/"英语" or locale
// codes. Use normalizeLanguagePreferenceValue() to coerce to the canonical form.
export const PREFERRED_LANGUAGE_OPTIONS = [
  { value: "中文（国语）", label: "中文（国语）", aliases: ["普通话", "国语", "中文", "zh-CN", "Mandarin", " Mandarin"] },
  { value: "中文（粤语）", label: "中文（粤语）", aliases: ["粤语", "zh-HK", "Cantonese"] },
  { value: "英语", label: "英语", aliases: ["English", "en", "en-US", "en-GB"] },
] as const;
export type PreferredLanguage = typeof PREFERRED_LANGUAGE_OPTIONS[number]["value"];

/** Normalize a dietary restriction value to the canonical DB-stored Chinese value. */
export function normalizeDietaryRestrictionValue(raw: string): string {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return "";
  for (const option of DIETARY_RESTRICTION_OPTIONS) {
    if (option.value === trimmed) return option.value;
    const normalizedAliases = option.aliases.map((a) => a.toLowerCase().replace(/\s+/g, "_"));
    const normalizedRaw = trimmed.toLowerCase().replace(/\s+/g, "_");
    if (normalizedAliases.includes(normalizedRaw)) return option.value;
  }
  return trimmed;
}

/** Normalize a language preference value to the canonical DB-stored Chinese value. */
export function normalizeLanguagePreferenceValue(raw: string): string {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return "";
  for (const option of PREFERRED_LANGUAGE_OPTIONS) {
    if (option.value === trimmed) return option.value;
    const normalizedAliases = option.aliases.map((a) => a.toLowerCase().replace(/\s+/g, "_"));
    const normalizedRaw = trimmed.toLowerCase().replace(/\s+/g, "_");
    if (normalizedAliases.includes(normalizedRaw)) return option.value;
  }
  return trimmed;
}

/** Get the Chinese display label for a canonical dietary restriction value. */
export function getDietaryRestrictionLabel(value: string): string {
  const canonical = normalizeDietaryRestrictionValue(value);
  return DIETARY_RESTRICTION_OPTIONS.find((o) => o.value === canonical)?.label ?? value;
}

/** Get the Chinese display label for a canonical language preference value. */
export function getLanguagePreferenceLabel(value: string): string {
  const canonical = normalizeLanguagePreferenceValue(value);
  return PREFERRED_LANGUAGE_OPTIONS.find((o) => o.value === canonical)?.label ?? value;
}


// Industry options (shared for onboarding)
export const INDUSTRY_OPTIONS = [
  { value: "tech", label: "互联网/科技" },
  { value: "finance", label: "金融/投资" },
  { value: "education", label: "教育/培训" },
  { value: "media", label: "媒体/创意" },
  { value: "consulting", label: "咨询/专业服务" },
  { value: "healthcare", label: "医疗/健康" },
  { value: "manufacturing", label: "制造/工程" },
  { value: "retail", label: "零售/消费" },
  { value: "real_estate", label: "房地产" },
  { value: "government", label: "政府/公共服务" },
  { value: "other", label: "其他行业" },
] as const;
export type IndustryOption = typeof INDUSTRY_OPTIONS[number];

// Intent/Social Goals options
export const INTENT_OPTIONS = [
  { value: "friends", label: "交新朋友", subtitle: "认识有趣的人", emoji: "👋", iconHint: "Users" },
  { value: "networking", label: "拓展人脉", subtitle: "扩大社交圈", emoji: "🤝", iconHint: "Network" },
  { value: "discussion", label: "深度交流", subtitle: "走心的对话", emoji: "💬", iconHint: "MessageCircle" },
  { value: "fun", label: "轻松娱乐", subtitle: "开心就好", emoji: "🎉", iconHint: "PartyPopper" },
  { value: "romance", label: "浪漫邂逅", subtitle: "遇见心动", emoji: "💕", iconHint: "Heart" },
] as const;

export const INTENT_FLEXIBLE_OPTION = {
  value: "flexible",
  label: "随缘",
  subtitle: "交给悦仔推荐",
  emoji: "🎲",
  iconHint: "Shuffle",
  description: "我都感兴趣，帮我安排"
} as const;

/** Union of all valid icon hint strings used by intent options. */
export type IntentIconHint = typeof INTENT_OPTIONS[number]["iconHint"] | typeof INTENT_FLEXIBLE_OPTION["iconHint"];

/** All valid intent values (including flexible). */
export const ALL_INTENT_VALUES = [
  ...INTENT_OPTIONS.map((o) => o.value),
  INTENT_FLEXIBLE_OPTION.value,
] as const;

/** Returns the Chinese display label for a given intent value. */
export function getIntentLabel(intent: string): string {
  const all = [...INTENT_OPTIONS, INTENT_FLEXIBLE_OPTION];
  return all.find((o) => o.value === intent)?.label ?? intent;
}

/** Returns the emoji for a given intent value. */
export function getIntentEmoji(intent: string): string {
  const all = [...INTENT_OPTIONS, INTENT_FLEXIBLE_OPTION];
  return all.find((o) => o.value === intent)?.emoji ?? "🎯";
}

/**
 * Toggles an intent value in the current selection, respecting the max selection
 * cap and the special "flexible" option. Flexible means no strong preference, so
 * it is mutually exclusive with explicit intents.
 *
 * Returns `null` when the toggle is blocked by the cap (caller should show
 * feedback). Returns the updated array on success.
 */
export function toggleIntentValue(
  current: string[],
  value: string,
  options: { maxExplicit?: number; flexibleValue?: string } = {},
): string[] | null {
  const { maxExplicit = 3, flexibleValue = INTENT_FLEXIBLE_OPTION.value } = options;

  // Deselecting is always allowed.
  if (current.includes(value)) {
    return current.filter((item) => item !== value);
  }

  // Flexible means "no strong preference"; selecting it clears explicit intents.
  if (value === flexibleValue) {
    return [flexibleValue];
  }

  const withoutFlexible = current.filter((item) => item !== flexibleValue);
  const explicitCount = current.filter((item) => item !== flexibleValue).length;
  if (explicitCount >= maxExplicit) {
    return null;
  }

  return [...withoutFlexible, value];
}

// ============ 契合点系统 ============

export const CONNECTION_POINT_TYPES = {
  // Common tier (frequently matched)
  SAME_CITY: { id: "same_city", label: "同城", emoji: "🏙️", tier: "common" as const },
  SAME_INDUSTRY: { id: "same_industry", label: "同行", emoji: "💼", tier: "common" as const },
  SAME_EDUCATION: { id: "same_education", label: "同学历", emoji: "🎓", tier: "common" as const },
  SAME_RELATIONSHIP: { id: "same_relationship", label: "同状态", emoji: "💫", tier: "common" as const },

  // Rare tier (less frequent, higher value)
  SAME_HOMETOWN: { id: "same_hometown", label: "老乡", emoji: "🏠", tier: "rare" as const },
  SAME_ARCHETYPE_BAND: { id: "same_archetype_band", label: "同频", emoji: "🎵", tier: "rare" as const },
  SAME_WORK_INDUSTRY: { id: "same_work_industry", label: "同领域同模式", emoji: "🤝", tier: "rare" as const },
  COMPLEMENTARY_ARCHETYPE: { id: "complementary_archetype", label: "性格互补", emoji: "🧩", tier: "rare" as const },

  // Epic tier (very rare, highest value)
  EXACT_ARCHETYPE: { id: "exact_archetype", label: "同款人格", emoji: "✨", tier: "epic" as const },
  HOMETOWN_INDUSTRY_COMPOUND: { id: "hometown_industry", label: "老乡+同行", emoji: "🔥", tier: "epic" as const },
  DEEP_INTEREST_OVERLAP: { id: "deep_interest_overlap", label: "深度同好", emoji: "💎", tier: "epic" as const },
} as const;

export type ConnectionPointTier = "common" | "rare" | "epic";

export const CONNECTION_POINT_TIER_CONFIG = {
  common: { label: "普通契合", color: "#6B7280", bgColor: "#F3F4F6" },
  rare: { label: "稀有契合", color: "#8B5CF6", bgColor: "#EDE9FE" },
  epic: { label: "史诗契合", color: "#F59E0B", bgColor: "#FEF3C7" },
} as const;

// Rarity tiers for education levels (common → epic, higher degree = rarer)
export const EDUCATION_LEVEL_RARITY: Record<string, ConnectionPointTier> = {
  "高中及以下": "common",
  "中专": "common",
  "大专": "common",
  "本科": "common",
  "硕士": "rare",
  "博士": "epic",
};

// Chinese display labels for relationship status match descriptions
export const RELATIONSHIP_MATCH_LABELS: Record<string, { text: string; tier: ConnectionPointTier }> = {
  "单身": { text: "同为单身贵族", tier: "common" },
  "恋爱中": { text: "都在甜蜜恋爱中", tier: "common" },
  "已婚/伴侣": { text: "同为有伴一族", tier: "common" },
  "离异": { text: "都经历过婚姻", tier: "common" },
  "丧偶": { text: "都经历过失去伴侣", tier: "common" },
};


// Chinese display labels for interest signal discussion styles
export const DISCUSSION_STYLE_LABELS: Record<string, string> = {
  casual_vibes: "随便聊聊",
  character_people: "角色/人物党",
  plot_worldbuilding: "剧情/世界观",
  meme_humor: "梗和搞笑",
  deeper_analysis: "深度讨论",
};

// ============ Connection Point Rarity Rules ============

export const CONNECTION_POINT_RARITY_RULES: Record<string, 'common' | 'rare' | 'epic'> = {
  // Common
  '同城': 'common',
  '同行': 'common',
  '同状态': 'common',
  '话题深度相近': 'common',
  // Rare
  '同乡': 'rare',
  '同频': 'rare',
  '性格互补': 'rare',
  '同款聊法': 'rare',
  '同领域同模式': 'rare',
  // Epic
  '同款人格': 'epic',
  '老乡+同行': 'epic',
  '深度同好': 'epic',
};

/** Deterministic rarity assignment for any connection-point text.
 *  Matches exact labels first, then handles dynamic text patterns
 *  (e.g. "火锅同款聊法（随便聊聊）", "深度同好（5个共同深度兴趣）").
 */
export function getConnectionPointRarity(text: string): 'common' | 'rare' | 'epic' {
  // Exact match first
  if (CONNECTION_POINT_RARITY_RULES[text]) {
    return CONNECTION_POINT_RARITY_RULES[text];
  }
  // Prefix / substring matching for dynamic text patterns
  // Epic tier
  if (text.includes('老乡+同行')) return 'epic';
  if (text.includes('同款人格')) return 'epic';
  if (text.includes('深度同好')) return 'epic';
  if (text.includes('同学历') && (text.includes('硕士') || text.includes('博士'))) return 'epic';
  // Rare tier
  if (text.includes('同在') && text.includes('·')) return 'rare';           // 同在科技·互联网
  if (text.includes('同款聊法')) return 'rare';                             // 火锅同款聊法（...）
  if (text.includes('同领域同模式')) return 'rare';
  if (text.includes('同学历')) return 'rare';
  if (text.includes('同乡')) return 'rare';
  if (text.includes('同频')) return 'rare';
  if (text.includes('性格互补')) return 'rare';
  // Common tier
  if (text.includes('话题深度相近')) return 'common';
  if (text.includes('同行')) return 'common';
  if (text.includes('同城')) return 'common';
  if (text.includes('同状态')) return 'common';
  // Default fallback
  return 'common';
}

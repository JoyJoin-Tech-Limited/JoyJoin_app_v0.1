/**
 * Unified Chinese enums for all user fields
 * Single source of truth to ensure consistency across registration and profile editing
 */

// Gender options
export const GENDER_OPTIONS = ["女性", "男性", "不透露"] as const;
export type Gender = typeof GENDER_OPTIONS[number];

// Education level options
export const EDUCATION_LEVEL_OPTIONS = ["高中及以下", "大专", "本科", "硕士", "博士", "职业培训"] as const;
export type EducationLevel = typeof EDUCATION_LEVEL_OPTIONS[number];

// Seniority options (deprecated - use WORK_MODE_OPTIONS)
export const SENIORITY_OPTIONS = ["实习生", "初级", "中级", "高级", "资深", "创始人", "高管"] as const;
export type Seniority = typeof SENIORITY_OPTIONS[number];

// Work mode options (new standardized occupation system)
export const WORK_MODE_OPTIONS = ["founder", "self_employed", "employed", "student", "transitioning", "caregiver_retired"] as const;
export type WorkMode = typeof WORK_MODE_OPTIONS[number];

// Work mode display labels (Chinese)
export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  founder: "创始人/合伙人",
  self_employed: "自由职业",
  employed: "在职人士",
  student: "学生/实习",
  transitioning: "职业过渡期",
  caregiver_retired: "家庭为主",
};

// Work mode descriptions (Chinese)
export const WORK_MODE_DESCRIPTIONS: Record<WorkMode, string> = {
  founder: "创业中，自己当老板",
  self_employed: "独立工作，灵活接活",
  employed: "在企业、机构或组织任职",
  student: "在读、实习或Gap中",
  transitioning: "求职中、休整、转型、预备接班",
  caregiver_retired: "全职家长、照顾家人、退休、在家躺平",
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
  { value: "friends", label: "交新朋友", subtitle: "认识有趣的人" },
  { value: "networking", label: "拓展人脉", subtitle: "扩大社交圈" },
  { value: "discussion", label: "深度交流", subtitle: "走心的对话" },
  { value: "fun", label: "轻松娱乐", subtitle: "开心就好" },
  { value: "romance", label: "浪漫邂逅", subtitle: "遇见心动" },
] as const;

export const INTENT_FLEXIBLE_OPTION = {
  value: "flexible",
  label: "随缘",
  subtitle: "交给小悦推荐",
  description: "我都感兴趣，帮我安排"
} as const;

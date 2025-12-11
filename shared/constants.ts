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
export const WORK_MODE_OPTIONS = ["founder", "self_employed", "employed", "student"] as const;
export type WorkMode = typeof WORK_MODE_OPTIONS[number];

// Work mode display labels (Chinese)
export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  founder: "创始人/合伙人",
  self_employed: "自由职业",
  employed: "在职员工",
  student: "学生",
};

// Work mode descriptions (Chinese)
export const WORK_MODE_DESCRIPTIONS: Record<WorkMode, string> = {
  founder: "创业中，自己当老板",
  self_employed: "独立工作，灵活接活",
  employed: "在公司/机构工作",
  student: "在读或Gap中",
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

// Age visibility options
export const AGE_VISIBILITY_OPTIONS = ["完全隐藏", "仅显示年龄段", "显示具体年龄"] as const;
export type AgeVisibility = typeof AGE_VISIBILITY_OPTIONS[number];

// Work visibility options
export const WORK_VISIBILITY_OPTIONS = ["完全隐藏", "仅显示行业"] as const;
export type WorkVisibility = typeof WORK_VISIBILITY_OPTIONS[number];

// Education visibility options
export const EDUCATION_VISIBILITY_OPTIONS = ["完全隐藏", "仅显示学历", "显示学历和专业"] as const;
export type EducationVisibility = typeof EDUCATION_VISIBILITY_OPTIONS[number];

// Current city options (for 现居城市)
export const CURRENT_CITY_OPTIONS = ["香港", "深圳", "广州", "东莞", "珠海", "澳门", "其他"] as const;
export type CurrentCity = typeof CURRENT_CITY_OPTIONS[number];

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

import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  date,
  numeric,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  GENDER_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  SENIORITY_OPTIONS,
  WORK_MODE_OPTIONS,
  RELATIONSHIP_STATUS_OPTIONS,
  CHILDREN_OPTIONS,
  STUDY_LOCALE_OPTIONS,
  PRONOUNS_OPTIONS,
  LANGUAGES_COMFORT_OPTIONS,
  ACTIVITY_TIME_PREFERENCE_OPTIONS,
  SOCIAL_FREQUENCY_OPTIONS,
} from "./constants";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  
  // Profile fields
  displayName: varchar("display_name"),
  hasCompletedProfileSetup: boolean("has_completed_profile_setup").default(false),
  hasCompletedVoiceQuiz: boolean("has_completed_voice_quiz").default(false),
  
  // Registration fields - Identity
  birthdate: date("birthdate"), // Used to calculate age
  age: integer("age"), // Deprecated - calculated from birthdate
  ageVisibility: varchar("age_visibility").default("show_age_range"), // hide_all, show_age_range (legacy: show_generation, show_exact_age)
  gender: varchar("gender"), // 女性, 男性, 不透露
  pronouns: varchar("pronouns"), // 她/She, 他/He, 它们/They, 自定义, 不透露
  
  // Registration fields - Background
  relationshipStatus: varchar("relationship_status"), // 单身, 恋爱中, 已婚/伴侣, 离异, 丧偶, 不透露
  children: varchar("children"), // 无孩子, 期待中, 0-5岁, 6-12岁, 13-18岁, 成年, 不透露
  hasPets: boolean("has_pets"), // 是否有毛孩子
  petTypes: text("pet_types").array(), // 宠物类型: 猫, 狗, 兔子, 仓鼠, etc.
  hasSiblings: boolean("has_siblings"), // 是否有亲兄弟姐妹 (false = 独生子女)
  hasKids: boolean("has_kids"), // Deprecated in favor of children
  
  // Registration fields - Life Stage & Age Preferences
  lifeStage: varchar("life_stage"), // 学生党, 职场新人, 职场老手, 创业中, 自由职业
  ageMatchPreference: varchar("age_match_preference"), // 同龄人, 偏年轻, 偏成熟, 都可以
  
  // Registration fields - Education
  educationLevel: varchar("education_level"), // 高中及以下, 大专, 本科, 硕士, 博士, 职业培训
  studyLocale: varchar("study_locale"), // 本地, 海外, 都有
  overseasRegions: text("overseas_regions").array(), // NA, Europe, East Asia, SE Asia, etc.
  fieldOfStudy: varchar("field_of_study"), // Business, Engineering, CS, Arts/Design, etc.
  educationVisibility: varchar("education_visibility").default("hide_all"), // hide_all, show_level_only, show_level_and_field
  
  // Registration fields - Work (New standardized occupation system)
  occupationId: varchar("occupation_id"), // Standardized occupation ID from occupations.ts
  workMode: varchar("work_mode"), // founder, self_employed, employed, student
  
  // Legacy work fields (kept for backward compatibility)
  industry: varchar("industry"), // 学生, 大厂, 金融等中文行业 - now auto-derived from occupationId
  roleTitleShort: varchar("role_title_short"), // Optional short text - deprecated, use occupationId
  seniority: varchar("seniority"), // 实习生, 初级, 中级, 高级, 资深, 创始人, 高管 - deprecated, use workMode
  companyName: varchar("company_name"), // 公司名称（可选，用于职场社交匹配）
  workVisibility: varchar("work_visibility").default("show_industry_only"), // hide_all, show_industry_only
  
  // Registration fields - Culture & Language
  hometownCountry: varchar("hometown_country"),
  hometownRegionCity: varchar("hometown_region_city"),
  hometownAffinityOptin: boolean("hometown_affinity_optin").default(true),
  currentCity: varchar("current_city"), // 现居城市: 香港, 深圳, 广州, 其他
  languagesComfort: text("languages_comfort").array(), // 普通话, 粤语, 英语等中文语言
  
  // Registration fields - Deprecated/Legacy
  placeOfOrigin: varchar("place_of_origin"), // Deprecated in favor of hometown fields
  longTermBase: varchar("long_term_base"), // Deprecated - use location preferences
  wechatId: varchar("wechat_id"), // WeChat ID
  phoneNumber: varchar("phone_number").unique(), // Phone number for authentication
  password: varchar("password"), // Hashed password for admin login
  
  // Registration fields - Access & Safety
  accessibilityNeeds: text("accessibility_needs"), // Optional text
  safetyNoteHost: text("safety_note_host"), // Private note to host
  
  // Default event intent (can be overridden per event) - multiple selections allowed
  intent: text("intent").array(), // Can include: networking, friends, discussion, fun, romance, flexible
  
  // Onboarding progress
  hasCompletedRegistration: boolean("has_completed_registration").default(false),
  hasCompletedInterestsTopics: boolean("has_completed_interests_topics").default(false),
  hasCompletedPersonalityTest: boolean("has_completed_personality_test").default(false),
  hasSeenGuide: boolean("has_seen_guide").default(false), // Guide page viewed, persisted server-side
  
  // Interests & Topics (Step 2)
  interestsTop: text("interests_top").array(), // 3-7 selected interests
  interestFavorite: text("interest_favorite"), // Deprecated: Single favorite interest - use primaryInterests
  primaryInterests: text("primary_interests").array(), // 1-3 starred main interests for matching priority
  interestsRankedTop3: text("interests_ranked_top3").array(), // Deprecated: Top 3 ranked interests
  topicsHappy: text("topics_happy").array(), // Deprecated: Topics user enjoys discussing - moving to simpler model
  topicsAvoid: text("topics_avoid").array(), // Deprecated: Topics to avoid - use topicAvoidances
  topicAvoidances: text("topic_avoidances").array(), // 饭局酒局不自在话题: politics, dating_pressure, workplace_gossip, money_finance, or empty for "都OK"
  interestsDeep: text("interests_deep").array(), // 深度兴趣（AI对话收集的更详细兴趣描述，语义描述，不含遥测数据）
  interestsTelemetry: jsonb("interests_telemetry"), // 兴趣滑动遥测数据 { version: string, events: [{interestId, choice, reactionTimeMs, timestamp}] }
  
  // Registration fields - Social & Venue Preferences (collected via AI chat)
  socialStyle: varchar("social_style"), // 社交风格: 外向活泼, 内敛沉稳, 看情况
  icebreakerRole: varchar("icebreaker_role"), // 破冰角色: leader(气氛组), supporter(捧场王), observer(观察者), flexible(看情况)
  venueStylePreference: varchar("venue_style_preference"), // 场地偏好: 安静咖啡馆, 热闹酒吧, 户外活动, etc.
  cuisinePreference: text("cuisine_preference").array(), // 菜系偏好: 粤菜, 日料, 西餐, etc.
  favoriteRestaurant: varchar("favorite_restaurant"), // 宝藏餐厅推荐
  favoriteRestaurantReason: text("favorite_restaurant_reason"), // 喜欢这家餐厅的原因
  
  // Registration fields - Activity Preferences (collected via AI chat)
  activityTimePreference: varchar("activity_time_preference"), // 活动时段偏好: 工作日晚上, 周末白天, 周末晚上, 都可以
  socialFrequency: varchar("social_frequency"), // 聚会频率: 每周社交, 每两周一次, 每月一两次, 看心情
  
  // Personality data (Step 3 - Vibe Vector)
  vibeVector: jsonb("vibe_vector"), // {energy, conversation_style, initiative, novelty, humor} scored 0-1
  archetype: varchar("archetype"), // 12个社交氛围原型: 开心柯基, 太阳鸡, 夸夸豚, 机智狐, 淡定海豚, 织网蛛, 暖心熊, 灵感章鱼, 沉思猫头鹰, 定心大象, 稳如龟, 隐身猫
  debateComfort: integer("debate_comfort"), // 1-7 scale
  needsPersonalityRetake: boolean("needs_personality_retake").default(false), // 是否需要重新测评（系统升级后）
  
  // Legacy personality data (deprecated)
  personalityTraits: jsonb("personality_traits"),
  personalityChallenges: text("personality_challenges").array(),
  idealMatch: text("ideal_match"),
  energyLevel: integer("energy_level"),
  
  // Social role (from personality test - now mapped to archetype)
  primaryRole: varchar("primary_role"), // 12 archetypes (animal-based social vibe system)
  secondaryRole: varchar("secondary_role"), // Second highest archetype (used in algorithm, hidden from UI)
  roleSubtype: varchar("role_subtype"),
  
  // Gamification - Legacy counters
  eventsAttended: integer("events_attended").default(0),
  matchesMade: integer("matches_made").default(0),
  
  // Gamification - Level System
  experiencePoints: integer("experience_points").default(0), // 成长值（不可消耗，用于升级）
  joyCoins: integer("joy_coins").default(0), // 悦币（可消耗，用于兑换优惠券）
  currentLevel: integer("current_level").default(1), // 当前等级 (1-10)
  activityStreak: integer("activity_streak").default(0), // 活动连击天数
  lastActivityDate: date("last_activity_date"), // 上次活动日期（用于连击计算）
  streakFreezeAvailable: boolean("streak_freeze_available").default(true), // 是否有连击冻结卡
  
  // Event Pack Credits
  eventCredits: integer("event_credits").default(0),
  eventCreditsExpiry: timestamp("event_credits_expiry"),
  
  // Admin & Moderation
  isAdmin: boolean("is_admin").default(false),
  isBanned: boolean("is_banned").default(false),
  
  // Anti-abuse & Rate Limiting
  violationCount: integer("violation_count").default(0), // 累计违规次数
  dailyTokenUsed: integer("daily_token_used").default(0), // 今日已用token数
  lastTokenResetDate: date("last_token_reset_date"), // 上次token计数重置日期
  aiFrozenUntil: timestamp("ai_frozen_until"), // AI功能冻结到什么时候（null=未冻结）
  lastViolationReason: varchar("last_violation_reason"), // 最近一次违规原因
  
  // Match Reveal Animation tracking
  viewedEventAnimations: text("viewed_event_animations").array(), // Event IDs where animation was already viewed
  
  // A/B Testing tracking
  registrationMethod: varchar("registration_method"), // 'form' or 'chat' for A/B testing
  registrationCompletedAt: timestamp("registration_completed_at"), // When registration was completed
  
  // ============ AI对话签名 (Conversation Signature) ============
  // 用于增强匹配算法的第6维度
  conversationMode: varchar("conversation_mode"), // 对话模式: express, standard, deep, allinone
  primaryLinguisticStyle: varchar("primary_linguistic_style"), // 主要语言风格: direct, implicit, negative, dialect, mixed
  conversationEnergy: integer("conversation_energy"), // 社交能量值 0-100
  negationReliability: numeric("negation_reliability"), // 否定表达可信度 0-1
  inferredTraits: jsonb("inferred_traits"), // AI推断的属性 { city, industry, education, lifeStage, ... }
  inferenceConfidence: numeric("inference_confidence"), // 推断总体置信度 0-1
  
  // ============ 智能信息收集系统 (Smart Info Collection) ============
  // 结构化职业信息（补充现有industry字段）
  industrySegment: varchar("industry_segment"), // 细分领域：PE/VC/并购（金融）、前端/后端/AI（科技）等
  structuredOccupation: varchar("structured_occupation"), // 规范化职位：投资经理/产品经理等（区别于legacy的roleTitleShort）
  // 智能洞察存储（JSONB灵活schema）
  insightLedger: jsonb("insight_ledger"), // SmartInsight[] - 带provenance/confidence的动态事实存储
  
  // ============ 三层行业分类系统 (Three-Tier Industry Classification) ============
  industryCategory: varchar("industry_category", { length: 50 }),           // Layer 1: "tech"
  industryCategoryLabel: varchar("industry_category_label", { length: 100 }), // "科技互联网"
  industrySegmentNew: varchar("industry_segment_new", { length: 100 }),     // Layer 2: "ai_ml" (renamed to avoid conflict)
  industrySegmentLabel: varchar("industry_segment_label", { length: 150 }), // "AI/机器学习"
  industryNiche: varchar("industry_niche", { length: 150 }),                // Layer 3: "medical_ai"
  industryNicheLabel: varchar("industry_niche_label", { length: 200 }),     // "医疗AI"
  
  // 三层分类元数据
  industryRawInput: text("industry_raw_input"),                             // 用户原始输入
  industrySource: varchar("industry_source", { length: 20 }),               // "seed" | "ontology" | "ai" | "manual"
  industryConfidence: numeric("industry_confidence", { precision: 3, scale: 2 }), // 0.00-1.00
  industryClassifiedAt: timestamp("industry_classified_at"),                // 分类时间
  industryLastVerifiedAt: timestamp("industry_last_verified_at"),           // 最后验证时间
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Events table
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  dateTime: timestamp("date_time").notNull(),
  location: varchar("location").notNull(),
  area: varchar("area"),
  price: integer("price"),
  maxAttendees: integer("max_attendees").default(10),
  currentAttendees: integer("current_attendees").default(0),
  iconName: varchar("icon_name"),
  hostId: varchar("host_id").references(() => users.id),
  status: varchar("status").default("upcoming"), // upcoming, ongoing, completed, cancelled
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Event attendance table
export const eventAttendance = pgTable("event_attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow(),
  status: varchar("status").default("confirmed"), // confirmed, cancelled, attended
  intent: text("intent").array(), // Event-specific intent: networking, friends, discussion, fun, romance, flexible
});

// ============ 两阶段匹配模型 - Event Pools ============

// Event Pools table - Admin创建的活动池（硬约束框架）
export const eventPools = pgTable("event_pools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 基本信息
  title: varchar("title").notNull(), // 活动标题，如："周五夜聊酒局"
  description: text("description"), // 活动描述
  eventType: varchar("event_type").notNull(), // 饭局/酒局/其他
  
  // 时间地点（硬约束）
  city: varchar("city").notNull(), // 深圳/香港
  district: varchar("district"), // 南山区/湾仔等
  dateTime: timestamp("date_time").notNull(), // 活动日期时间
  registrationDeadline: timestamp("registration_deadline").notNull(), // 报名截止时间
  
  // 活动限制（硬约束 - 关联用户表字段）
  genderRestriction: varchar("gender_restriction"), // null=不限 | 女性 | 男性
  industryRestrictions: text("industry_restrictions").array(), // 行业限制列表（空=不限）
  seniorityRestrictions: text("seniority_restrictions").array(), // 职级限制
  educationLevelRestrictions: text("education_level_restrictions").array(), // 学历限制
  ageRangeMin: integer("age_range_min"), // 最小年龄
  ageRangeMax: integer("age_range_max"), // 最大年龄
  
  // 性别平衡配置（软约束）
  genderBalanceMode: varchar("gender_balance_mode").default("soft"), // none=不考虑 | soft=软约束加分 | hard=硬约束必须平衡
  genderBalanceBonusPoints: integer("gender_balance_bonus_points").default(15), // 软约束模式下，完美比例的加分值（默认15分）
  
  // 性别最低人数限制（硬约束）
  minFemaleCount: integer("min_female_count").default(0), // 每组最少女性人数，0=不限制
  minMaleCount: integer("min_male_count").default(0), // 每组最少男性人数，0=不限制
  
  // 组局配置
  minGroupSize: integer("min_group_size").default(4), // 最小成局人数
  maxGroupSize: integer("max_group_size").default(6), // 最大成局人数
  targetGroups: integer("target_groups").default(1), // 目标组局数量
  
  // 状态管理
  status: varchar("status").default("active"), // active (招募中) | matching | matched | completed | cancelled
  totalRegistrations: integer("total_registrations").default(0), // 总报名人数
  successfulMatches: integer("successful_matches").default(0), // 成功匹配人数
  
  // 元数据
  createdBy: varchar("created_by").notNull().references(() => users.id), // Admin用户ID
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  matchedAt: timestamp("matched_at"), // 匹配完成时间
});

// Event Pool Registrations table - 用户报名记录 + 个性化偏好（软约束）
export const eventPoolRegistrations = pgTable("event_pool_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 关联
  poolId: varchar("pool_id").notNull().references(() => eventPools.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // 用户临时偏好（软约束 - 仅用于本次活动）
  budgetRange: text("budget_range").array(), // 饭局预算范围，多选：["150以下", "150-200", "200-300", "300-500"]
  preferredLanguages: text("preferred_languages").array(), // 首选语言：["普通话", "粤语", "英语"]
  socialGoals: text("social_goals").array(), // 社交目的：["交朋友", "扩展人脉", "放松心情", "行业交流", "flexible"]
  cuisinePreferences: text("cuisine_preferences").array(), // 饮食偏好：["中餐", "川菜", "粤菜", "日料", "西餐"]
  dietaryRestrictions: text("dietary_restrictions").array(), // 忌口：["素食", "不吃辣", "清真"]
  tasteIntensity: text("taste_intensity").array(), // 口味强度：["爱吃辣", "不辣/清淡为主"]
  decorStylePreferences: text("decor_style_preferences").array(), // 场地风格偏好：["轻奢现代风", "绿植花园风", "复古工业风", "温馨日式风"]
  
  // 酒局特有偏好
  barThemes: text("bar_themes").array(), // 酒吧主题偏好：["精酿", "清吧", "私密调酒·Homebar"]
  alcoholComfort: text("alcohol_comfort").array(), // 饮酒舒适度：["可以喝酒", "微醺就好", "无酒精饮品"]
  barBudgetRange: text("bar_budget_range").array(), // 酒局预算范围（每杯）：["80以下", "80-150"]
  
  // 匹配结果
  matchStatus: varchar("match_status").default("pending"), // pending | matched | unmatched
  assignedGroupId: varchar("assigned_group_id"), // 分配到的组ID（如果匹配成功）
  matchScore: integer("match_score"), // 匹配分数
  
  // 元数据
  registeredAt: timestamp("registered_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Event Pool Groups table - 匹配成功的小组
export const eventPoolGroups = pgTable("event_pool_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  poolId: varchar("pool_id").notNull().references(() => eventPools.id),
  groupNumber: integer("group_number").notNull(), // 组号（同一活动池内）
  
  // 组信息
  memberCount: integer("member_count").default(0),
  avgChemistryScore: integer("avg_chemistry_score"), // 平均化学反应分数
  diversityScore: integer("diversity_score"), // 多样性分数
  energyBalance: integer("energy_balance"), // 能量平衡分数
  genderBalanceScore: integer("gender_balance_score"), // 性别平衡分数（0-100）
  overallScore: integer("overall_score"), // 综合分数
  temperatureLevel: varchar("temperature_level"), // 化学反应温度等级: fire | warm | mild | cold
  matchExplanation: text("match_explanation"), // AI生成的匹配解释
  pairExplanationsCache: jsonb("pair_explanations_cache"), // 缓存的配对解释: [{pairKey, explanation, chemistryScore, sharedInterests, connectionPoints, generatedAt}]
  iceBreakersCache: jsonb("ice_breakers_cache"), // 缓存的破冰话题: {topics: string[], generatedAt: string}
  
  // 活动详情（匹配后生成）
  venueName: varchar("venue_name"),
  venueAddress: text("venue_address"),
  finalDateTime: timestamp("final_date_time"),
  
  // 状态
  status: varchar("status").default("confirmed"), // confirmed | completed | cancelled
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============ 实时匹配系统配置 ============

// Matching Thresholds table - 动态匹配阈值配置（管理员可调整）
export const matchingThresholds = pgTable("matching_thresholds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 阈值配置
  highCompatibilityThreshold: integer("high_compatibility_threshold").default(85), // 高兼容性立即匹配阈值
  mediumCompatibilityThreshold: integer("medium_compatibility_threshold").default(70), // 中等兼容性等待阈值
  lowCompatibilityThreshold: integer("low_compatibility_threshold").default(55), // 最低可接受阈值
  
  // 时间衰减配置
  timeDecayEnabled: boolean("time_decay_enabled").default(true), // 是否启用时间衰减
  timeDecayRate: integer("time_decay_rate").default(5), // 每24小时降低的阈值点数
  minThresholdAfterDecay: integer("min_threshold_after_decay").default(50), // 衰减后的最低阈值
  
  // 组局配置
  minGroupSizeForMatch: integer("min_group_size_for_match").default(4), // 最小成局人数
  optimalGroupSize: integer("optimal_group_size").default(6), // 最优组局人数
  
  // 扫描频率
  scanIntervalMinutes: integer("scan_interval_minutes").default(60), // 定时扫描间隔（分钟）
  
  // 元数据
  isActive: boolean("is_active").default(true), // 是否为当前使用的配置
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  notes: text("notes"), // 管理员备注
});

// Pool Matching Logs table - 记录每次扫描和匹配决策
export const poolMatchingLogs = pgTable("pool_matching_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  poolId: varchar("pool_id").notNull().references(() => eventPools.id),
  scanType: varchar("scan_type").notNull(), // "realtime" | "scheduled" | "manual"
  
  // 扫描快照
  pendingUsersCount: integer("pending_users_count").default(0),
  currentThreshold: integer("current_threshold"), // 本次扫描使用的阈值
  timeUntilEvent: integer("time_until_event"), // 距离活动开始的小时数
  
  // 匹配结果
  groupsFormed: integer("groups_formed").default(0),
  usersMatched: integer("users_matched").default(0),
  avgGroupScore: integer("avg_group_score"),
  
  // 决策信息
  decision: varchar("decision").notNull(), // "matched" | "waiting" | "insufficient"
  reason: text("reason"), // 决策原因说明
  
  // 元数据
  triggeredBy: varchar("triggered_by"), // "user_registration" | "cron_job" | "admin_manual"
  createdAt: timestamp("created_at").defaultNow(),
});

// Match history table - tracks who has been matched together before (anti-repetition)
export const matchHistory = pgTable("match_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user1Id: varchar("user1_id").notNull().references(() => users.id),
  user2Id: varchar("user2_id").notNull().references(() => users.id),
  eventId: varchar("event_id").notNull().references(() => events.id),
  matchedAt: timestamp("matched_at").defaultNow(),
  connectionQuality: integer("connection_quality"), // Post-event feedback: 1-5 score
  wouldMeetAgain: boolean("would_meet_again"), // Whether they'd want to be matched again
  connectionPointTypes: text("connection_point_types").array(), // Types of connection points that led to this match (for feedback correlation)
});

// Chat messages table (for event group chats)
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Direct message threads table (1-on-1 chats unlocked via mutual matching)
export const directMessageThreads = pgTable("direct_message_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user1Id: varchar("user1_id").notNull().references(() => users.id),
  user2Id: varchar("user2_id").notNull().references(() => users.id),
  eventId: varchar("event_id").notNull().references(() => events.id), // Event where they matched
  unlockedAt: timestamp("unlocked_at").defaultNow(), // When mutual matching unlocked the thread
  lastMessageAt: timestamp("last_message_at"), // For sorting threads by activity
  createdAt: timestamp("created_at").defaultNow(),
});

// Direct messages table (1-on-1 private messages)
export const directMessages = pgTable("direct_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => directMessageThreads.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Post-event feedback table
export const eventFeedback = pgTable("event_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Legacy fields (deprecated but kept for backward compatibility)
  rating: integer("rating"), // 1-5 stars
  vibeMatch: integer("vibe_match"), // How well did the vibe match expectations (1-5)
  energyMatch: integer("energy_match"), // How well did the energy match (1-5)
  wouldAttendAgain: boolean("would_attend_again"),
  feedback: text("feedback"),
  connections: text("connections").array(), // User IDs of people they connected with
  
  // New balanced feedback system fields
  // Dimension 1: Overall Atmosphere - Thermometer
  atmosphereScore: integer("atmosphere_score"), // 1-5 (1=尴尬, 2=平淡, 3=舒适, 4=热烈, 5=完美)
  atmosphereNote: text("atmosphere_note"), // Optional supplementary note
  
  // Dimension 2: Attendee Impressions - Trait Tags
  attendeeTraits: jsonb("attendee_traits"), // {userId: {displayName, tags: string[], needsImprovement: boolean, improvementNote: string}}
  
  // Dimension 3: Connection Radar
  connectionRadar: jsonb("connection_radar"), // {topicResonance: 1-5, personalityMatch: 1-5, backgroundDiversity: 1-5, overallFit: 1-5}
  hasNewConnections: boolean("has_new_connections"), // Whether they want to keep in touch with anyone
  connectionStatus: varchar("connection_status"), // "已交换联系方式", "有但还没联系", "没有但很愉快", "没有不太合适"
  
  // Dimension 4: Improvement Suggestions - Magic Recipe Cards
  improvementAreas: text("improvement_areas").array(), // Max 3 areas
  improvementOther: text("improvement_other"), // Custom improvement suggestion
  
  // Dimension 5: Venue Style Rating
  venueStyleRating: varchar("venue_style_rating"), // "like" | "neutral" | "dislike" - 场地风格满意度
  
  // Gamification & Rewards
  completedAt: timestamp("completed_at"),
  rewardsClaimed: boolean("rewards_claimed").default(false),
  rewardPoints: integer("reward_points").default(50), // Points earned for completing feedback
  
  // Deep Feedback (Optional) - User Co-creation Module
  hasDeepFeedback: boolean("has_deep_feedback").default(false),
  
  // Module 1: Match Point Validation
  matchPointValidation: jsonb("match_point_validation"), // {[matchPoint]: {discussed: 'deeply'|'briefly'|'not', notes: string}}
  additionalMatchPoints: text("additional_match_points"), // Other common points that facilitated conversation
  
  // Module 2: Conversation Dynamics
  conversationBalance: integer("conversation_balance"), // 0-100 (0=all them, 50=balanced, 100=all me)
  conversationComfort: integer("conversation_comfort"), // 0-100 comfort level
  conversationNotes: text("conversation_notes"), // Optional notes about dynamics
  
  // Module 3: Matching Preferences
  futurePreferences: text("future_preferences").array(), // Array of preference tags
  futurePreferencesOther: text("future_preferences_other"), // Custom preferences
  
  deepFeedbackCompletedAt: timestamp("deep_feedback_completed_at"),
  
  // AI Evolution System - Trigger Association
  triggersActivated: text("triggers_activated").array(), // 触发器ID列表 (对话中激活的触发器)
  mostImpactfulTrigger: varchar("most_impactful_trigger"), // 最有影响力的触发器
  triggerEffectivenessScore: numeric("trigger_effectiveness_score", { precision: 5, scale: 4 }), // 触发器整体效果 0-1
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Schemas
export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const updateProfileSchema = createInsertSchema(users).pick({
  displayName: true,
  birthdate: true,
}).extend({
  displayName: z.string().min(1, "请输入昵称"),
  birthdate: z.string().optional(),
});

// Comprehensive profile update schema for editing profile
export const updateFullProfileSchema = createInsertSchema(users).pick({
  displayName: true,
  birthdate: true,
  gender: true,
  relationshipStatus: true,
  children: true,
  hasPets: true,
  petTypes: true,
  hasSiblings: true,
  currentCity: true,
  educationLevel: true,
  studyLocale: true,
  overseasRegions: true,
  fieldOfStudy: true,
  industry: true,
  industrySegment: true,  // 智能信息收集：细分领域
  structuredOccupation: true,  // 智能信息收集：规范化职位
  // Three-tier industry classification
  industryCategory: true,
  industryCategoryLabel: true,
  industrySegmentNew: true,
  industrySegmentLabel: true,
  industryNiche: true,
  industryNicheLabel: true,
  industryRawInput: true,
  industrySource: true,
  industryConfidence: true,
  industryClassifiedAt: true,
  industryLastVerifiedAt: true,
  occupationId: true,
  workMode: true,
  roleTitleShort: true,
  seniority: true,
  companyName: true,
  hometownCountry: true,
  hometownRegionCity: true,
  languagesComfort: true,
  intent: true,
  interestsTop: true,
  primaryInterests: true,
  interestsDeep: true,
  interestsTelemetry: true,
  topicsHappy: true,
  topicsAvoid: true,
  topicAvoidances: true,
  cuisinePreference: true,
  socialStyle: true,
  icebreakerRole: true,
  workVisibility: true,
}).partial();

export const updatePersonalitySchema = createInsertSchema(users).pick({
  personalityTraits: true,
  personalityChallenges: true,
  idealMatch: true,
  energyLevel: true,
});

export const insertEventAttendanceSchema = createInsertSchema(eventAttendance).pick({
  eventId: true,
  userId: true,
});

// Event Pool Schemas
export const insertEventPoolSchema = createInsertSchema(eventPools).omit({
  id: true,
  totalRegistrations: true,
  successfulMatches: true,
  createdAt: true,
  updatedAt: true,
  matchedAt: true,
}).extend({
  title: z.string().min(1, "活动标题不能为空"),
  eventType: z.enum(["饭局", "酒局", "其他"]),
  city: z.enum(["深圳", "香港"]),
  dateTime: z.date(),
  registrationDeadline: z.date(),
  minGroupSize: z.number().min(2).max(10).default(4),
  maxGroupSize: z.number().min(2).max(10).default(6),
  targetGroups: z.number().min(1).default(1),
});

export const insertEventPoolRegistrationSchema = createInsertSchema(eventPoolRegistrations).omit({
  id: true,
  matchStatus: true,
  assignedGroupId: true,
  matchScore: true,
  registeredAt: true,
  updatedAt: true,
}).extend({
  poolId: z.string().min(1),
  userId: z.string().min(1),
  budgetRange: z.array(z.string()).optional(),
  preferredLanguages: z.array(z.string()).optional(),
  socialGoals: z.array(z.string()).optional(),
  cuisinePreferences: z.array(z.string()).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  tasteIntensity: z.array(z.string()).optional(),
});

export const insertEventPoolGroupSchema = createInsertSchema(eventPoolGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  eventId: true,
  message: true,
}).extend({
  message: z.string().min(1, "消息不能为空"),
});

export const insertDirectMessageThreadSchema = createInsertSchema(directMessageThreads).pick({
  user1Id: true,
  user2Id: true,
  eventId: true,
});

export const insertDirectMessageSchema = createInsertSchema(directMessages).pick({
  threadId: true,
  message: true,
}).extend({
  message: z.string().min(1, "消息不能为空"),
});

export const insertEventFeedbackSchema = createInsertSchema(eventFeedback).omit({
  id: true,
  createdAt: true,
  userId: true, // Auto-populated from session
}).extend({
  // Legacy fields validation
  rating: z.number().min(1).max(5).optional(),
  vibeMatch: z.number().min(1).max(5).optional(),
  energyMatch: z.number().min(1).max(5).optional(),
  
  // New balanced feedback system validation
  atmosphereScore: z.number().min(1).max(5).optional(),
  atmosphereNote: z.string().optional(),
  attendeeTraits: z.any().optional(), // JSON object
  connectionRadar: z.any().optional(), // JSON object  
  hasNewConnections: z.boolean().optional(),
  connectionStatus: z.enum(["已交换联系方式", "有但还没联系", "没有但很愉快", "没有不太合适"]).optional(),
  improvementAreas: z.array(z.string()).max(3).optional(),
  improvementOther: z.string().optional(),
  
  // Venue style rating validation
  venueStyleRating: z.enum(["like", "neutral", "dislike"]).optional(),
});

// Blind Box Events table
export const blindBoxEvents = pgTable("blind_box_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Basic info
  title: varchar("title").notNull(), // e.g., "周三 19:00 · 饭局"
  eventType: varchar("event_type").notNull(), // 饭局/酒局
  city: varchar("city").notNull(), // 深圳/香港
  district: varchar("district").notNull(), // 南山区
  dateTime: timestamp("date_time").notNull(),
  
  // Budget and preferences
  budgetTier: varchar("budget_tier").notNull(), // "100-200"
  selectedLanguages: text("selected_languages").array(),
  selectedTasteIntensity: text("selected_taste_intensity").array(),
  selectedCuisines: text("selected_cuisines").array(),
  acceptNearby: boolean("accept_nearby").default(false),
  
  // Matching status
  status: varchar("status").notNull().default("pending_match"), // pending_match, matched, completed, canceled
  progress: integer("progress").default(0), // 0-100
  currentParticipants: integer("current_participants").default(1), // Includes creator + joined invites
  etaMinutes: integer("eta_minutes"), // Estimated time to match
  
  // Matched event details (populated when status = matched)
  restaurantName: varchar("restaurant_name"),
  restaurantAddress: varchar("restaurant_address"),
  restaurantLat: varchar("restaurant_lat"),
  restaurantLng: varchar("restaurant_lng"),
  cuisineTags: text("cuisine_tags").array(),
  
  // Participant info (populated when status = matched)
  totalParticipants: integer("total_participants"),
  maleCount: integer("male_count"),
  femaleCount: integer("female_count"),
  isGirlsNight: boolean("is_girls_night").default(false),
  
  // Matched attendee data (populated when status = matched)
  matchedAttendees: jsonb("matched_attendees"), // Array of {userId, displayName, archetype, topInterests, age, industry, ageVisible, industryVisible}
  matchExplanation: text("match_explanation"), // "Why This Table?" auto-generated narrative
  
  // Invite info
  invitedCount: integer("invited_count").default(0),
  invitedJoined: integer("invited_joined").default(0),
  
  // Pool reference (for event pool matching)
  poolId: varchar("pool_id"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schema for blind box events
export const insertBlindBoxEventSchema = createInsertSchema(blindBoxEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  title: z.string().min(1, "活动标题不能为空"),
  eventType: z.string().min(1, "活动类型不能为空"),
  city: z.string().min(1, "城市不能为空"),
  district: z.string().min(1, "商圈不能为空"),
  budgetTier: z.string().min(1, "预算档位不能为空"),
});

// Personality test questions table
export const personalityQuestions = pgTable("personality_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionNumber: integer("question_number").notNull(),
  category: varchar("category").notNull(), // "基础行为模式", "反应偏好", "自我认知"
  questionText: text("question_text").notNull(),
  questionType: varchar("question_type").notNull(), // "single" or "dual"
  options: jsonb("options").notNull(), // Array of {value: string, text: string, roleMapping: string}
  testVersion: integer("test_version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

// Test responses table (stores user answers)
export const testResponses = pgTable("test_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  questionId: varchar("question_id").notNull().references(() => personalityQuestions.id),
  selectedOption: varchar("selected_option"), // For single choice
  mostLikeOption: varchar("most_like_option"), // For dual choice (2 points)
  secondLikeOption: varchar("second_like_option"), // For dual choice (1 point)
  testVersion: integer("test_version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

// Role results table (stores personality test results)
export const roleResults = pgTable("role_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Role scores (12 archetypes)
  primaryRole: varchar("primary_role").notNull(), // Highest scoring archetype
  primaryRoleScore: integer("primary_role_score").notNull(),
  secondaryRole: varchar("secondary_role"), // Second highest archetype (used in algorithm, hidden from UI)
  secondaryRoleScore: integer("secondary_role_score"),
  roleSubtype: varchar("role_subtype"), // Subtype based on answer patterns
  
  // Role score breakdown
  roleScores: jsonb("role_scores").notNull(), // {开心柯基: 18, 太阳鸡: 15, 暖心熊: 12, ...}
  
  // Six-dimensional trait scores (0-10 scale)
  affinityScore: integer("affinity_score").notNull(), // 亲和力
  opennessScore: integer("openness_score").notNull(), // 开放性
  conscientiousnessScore: integer("conscientiousness_score").notNull(), // 责任心
  emotionalStabilityScore: integer("emotional_stability_score").notNull(), // 情绪稳定性
  extraversionScore: integer("extraversion_score").notNull(), // 外向性
  positivityScore: integer("positivity_score").notNull(), // 正能量性
  
  // Insights (generated text)
  strengths: text("strengths"),
  challenges: text("challenges"),
  idealFriendTypes: text("ideal_friend_types").array(),
  
  testVersion: integer("test_version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

// Registration schema (Step 1: The Essentials)
export const registerUserSchema = z.object({
  // Identity
  displayName: z.string().min(1, "请输入昵称"),
  birthdate: z.string().min(1, "请选择生日"), // ISO date string - now required
  ageVisibility: z.enum(["hide_all", "show_age_range"]).default("show_age_range"),
  gender: z.enum(GENDER_OPTIONS, {
    errorMap: () => ({ message: "请选择性别" }),
  }),
  pronouns: z.enum(PRONOUNS_OPTIONS).optional(),
  
  // Background
  relationshipStatus: z.enum(RELATIONSHIP_STATUS_OPTIONS, {
    errorMap: () => ({ message: "请选择关系状态" }),
  }),
  children: z.enum(CHILDREN_OPTIONS).optional(),
  hasPets: z.boolean().optional(), // 是否有毛孩子
  hasSiblings: z.boolean().optional(), // 是否有亲兄弟姐妹
  
  // Education - All required for matching algorithm
  educationLevel: z.enum(EDUCATION_LEVEL_OPTIONS, {
    errorMap: () => ({ message: "请选择教育水平" }),
  }),
  studyLocale: z.enum(STUDY_LOCALE_OPTIONS, {
    errorMap: () => ({ message: "请选择学习地点" }),
  }),
  overseasRegions: z.array(z.string()).optional(),
  fieldOfStudy: z.string().optional(), // Now optional - auto-derived from occupation
  
  // Work - New standardized occupation system
  occupationId: z.string().min(1, "请选择职业"),
  workMode: z.enum(WORK_MODE_OPTIONS, {
    errorMap: () => ({ message: "请选择身份" }),
  }),
  
  // Legacy fields (optional, for backward compatibility)
  industry: z.string().optional(), // Auto-derived from occupationId
  roleTitleShort: z.string().optional(), // Deprecated
  seniority: z.enum(SENIORITY_OPTIONS).optional(), // Deprecated
  
  // Event intent (default, can be overridden per event) - multiple selections allowed
  intent: z.array(z.enum(["networking", "friends", "discussion", "fun", "romance", "flexible"])).min(1, "请至少选择一个活动意图"),
  
  // Culture & Language - Required for matching algorithm
  hometownCountry: z.string().optional(), // Auto-set based on province selection
  hometownRegionCity: z.string().min(1, "请选择家乡"),
  hometownAffinityOptin: z.boolean().optional().default(true), // 同乡亲和力
  currentCity: z.string().min(1, "请选择现居城市"),
  languagesComfort: z.array(z.string()).min(1, "请至少选择一种语言"),
  
  // Privacy controls
  educationVisibility: z.enum(["hide_all", "show_level_only", "show_level_and_field"]).optional().default("hide_all"),
  workVisibility: z.enum(["hide_all", "show_industry_only"]).optional().default("show_industry_only"),
  
  // Access & Safety
  accessibilityNeeds: z.string().optional(),
  safetyNoteHost: z.string().optional(),
  
  // Legacy/Optional
  wechatId: z.string().optional(),
  
  // Chat registration specific fields
  registrationMethod: z.enum(["chat", "form"]).optional(),
  topicAvoidances: z.array(z.string()).optional(),
  cuisinePreference: z.array(z.string()).optional(),
  favoriteRestaurant: z.string().optional(),
  primaryInterests: z.array(z.string()).optional(),
  petTypes: z.array(z.string()).optional(),
  companyName: z.string().optional(),
});

// Interests & Topics schema (Step 2)
export const interestsTopicsSchema = z.object({
  interestsTop: z.array(z.string()).min(3, "请至少选择3个兴趣").max(7, "最多选择7个兴趣"),
  primaryInterests: z.array(z.string()).min(1, "请至少标记1个主要兴趣").max(3, "最多标记3个主要兴趣"),
  topicAvoidances: z.array(z.string()).max(4, "最多选择4个").optional(),
  // Deprecated fields kept for backward compatibility
  interestFavorite: z.string().optional(),
  topicsHappy: z.array(z.string()).optional(),
  topicsAvoid: z.array(z.string()).optional(),
});

// Test response schema
export const insertTestResponseSchema = createInsertSchema(testResponses).omit({
  id: true,
  createdAt: true,
});

// Role result schema
export const insertRoleResultSchema = createInsertSchema(roleResults).omit({
  id: true,
  createdAt: true,
});

// ============ ADMIN PORTAL TABLES ============

// Venues table - Restaurant/Bar partners
export const venues = pgTable("venues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  venueType: text("venue_type").notNull(), // restaurant, bar, homebar, cafe
  address: text("address").notNull(),
  city: text("city").notNull(), // 深圳, 香港
  area: text("area").notNull(), // 南山区, 中环 etc.
  contactPerson: text("contact_person"),
  contactPhone: text("contact_phone"),
  commissionRate: integer("commission_rate").default(20), // percentage
  
  // Venue tags for matching
  tags: text("tags").array(), // atmosphere tags: cozy, lively, upscale, casual
  cuisines: text("cuisines").array(), // 菜系: 中餐, 川菜, 粤菜, 火锅, 烧烤, 西餐, 日料
  priceRange: text("price_range"), // 预算档次: "150以下", "150-200", "200-300", "300-500"
  decorStyle: text("decor_style").array(), // 装修风格: 轻奢现代风, 绿植花园风, 复古工业风, 温馨日式风
  tasteIntensity: text("taste_intensity").array(), // 口味偏好支持: 爱吃辣, 不辣/清淡为主
  
  // 酒吧特有标签 (仅当 venueType='bar' 时使用)
  barThemes: text("bar_themes").array(), // 酒吧主题: 精酿, 清吧, 私密调酒·Homebar
  alcoholOptions: text("alcohol_options").array(), // 支持的饮酒选项: 可以喝酒, 微醺就好, 无酒精饮品
  barPriceRange: text("bar_price_range"), // 酒吧价格档次（每杯）: "80以下", "80-150"
  vibeDescriptor: text("vibe_descriptor"), // 氛围描述（编辑性文字，非结构化标签）
  
  // Capacity management
  capacity: integer("capacity").default(1), // How many events can run at same time
  operatingHours: text("operating_hours"), // e.g., "11:00-22:00"
  
  // ============ 新增字段：合作场地优惠系统 ============
  // 消费信息（使用priceRange预设档次）
  priceNote: text("price_note"), // 价格说明，如"一杯酒约100元"
  
  // 图片
  coverImageUrl: text("cover_image_url"), // 封面图
  galleryImages: text("gallery_images").array(), // 图片集
  
  // 合作状态
  partnerStatus: text("partner_status").default("active"), // active, paused, ended
  partnerSince: date("partner_since"), // 合作开始日期
  
  // Status
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Venue Deals table - 场地优惠
export const venueDeals = pgTable("venue_deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  venueId: varchar("venue_id").notNull().references(() => venues.id),
  
  // 优惠信息
  title: text("title").notNull(), // 优惠标题，如"悦聚专属8折"
  discountType: text("discount_type").notNull(), // percentage, fixed, gift
  discountValue: integer("discount_value"), // 折扣值: percentage=20表示8折, fixed=30表示减30元
  description: text("description"), // 优惠详细说明
  
  // 兑换方式
  redemptionMethod: text("redemption_method").default("show_page"), // show_page, code, qr_code
  redemptionCode: text("redemption_code"), // 兑换码/暗号
  
  // 适用条件
  minSpend: integer("min_spend"), // 最低消费
  maxDiscount: integer("max_discount"), // 最高优惠金额
  perPersonLimit: boolean("per_person_limit").default(false), // 是否每人限用一次
  
  // 有效期
  validFrom: date("valid_from"),
  validUntil: date("valid_until"),
  
  // 使用限制
  terms: text("terms"), // 使用条款
  excludedDates: text("excluded_dates").array(), // 不可用日期
  
  // 状态
  isActive: boolean("is_active").default(true),
  usageCount: integer("usage_count").default(0), // 使用次数统计
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Event Templates table - Recurring time slots and themes
export const eventTemplates = pgTable("event_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // e.g., "周三晚餐局", "Girls Night"
  eventType: varchar("event_type").notNull(), // 饭局, 酒局
  dayOfWeek: integer("day_of_week").notNull(), // 0-6 (Sunday-Saturday)
  timeOfDay: varchar("time_of_day").notNull(), // e.g., "19:00", "21:00"
  
  // Theme and restrictions
  theme: varchar("theme"), // e.g., "Girls Night", "商务社交"
  genderRestriction: varchar("gender_restriction"), // null, "Woman", "Man"
  minAge: integer("min_age"),
  maxAge: integer("max_age"),
  
  // Participant settings
  minParticipants: integer("min_participants").default(5),
  maxParticipants: integer("max_participants").default(10),
  
  // Pricing (for future premium events)
  customPrice: integer("custom_price"), // null = use default pricing (会员免费/非会员¥68)
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subscriptions table - User memberships
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Subscription period
  planType: varchar("plan_type").notNull(), // "monthly", "quarterly"
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  
  // Payment
  amount: integer("amount").notNull(), // ¥199 or ¥499
  paymentId: varchar("payment_id").references(() => payments.id), // References payments table
  
  // Status
  status: varchar("status").notNull().default("pending"), // pending, active, expired, cancelled
  isActive: boolean("is_active").default(true), // Track active status separately
  autoRenew: boolean("auto_renew").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payments table - Unified payment records
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Payment type
  paymentType: varchar("payment_type").notNull(), // "subscription", "event"
  relatedId: varchar("related_id"), // subscription ID or event ID
  
  // Amount
  originalAmount: integer("original_amount").notNull(), // Before discount
  discountAmount: integer("discount_amount").default(0),
  finalAmount: integer("final_amount").notNull(), // After discount
  
  // Coupon
  couponId: varchar("coupon_id"), // null if no coupon used
  
  // WeChat Pay details
  wechatTransactionId: varchar("wechat_transaction_id"), // WeChat Pay transaction ID
  wechatOrderId: varchar("wechat_order_id"), // Our order ID sent to WeChat
  
  // Status
  status: varchar("status").notNull().default("pending"), // pending, completed, failed, refunded
  paidAt: timestamp("paid_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Coupons table - Discount codes
export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // e.g., "WELCOME50"
  
  // Discount details
  discountType: text("discount_type").notNull(), // "fixed_amount", "percentage"
  discountValue: integer("discount_value").notNull(), // ¥50 or 20 (for 20%)
  
  // Usage limits
  minPurchase: integer("min_purchase"), // Minimum purchase amount required
  usageLimit: integer("usage_limit"), // null = unlimited
  usedCount: integer("used_count").default(0),
  
  // Validity
  validFrom: timestamp("valid_from").defaultNow(),
  validUntil: timestamp("valid_until"),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Coupon Usage table - Track coupon redemptions
export const couponUsage = pgTable("coupon_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  couponId: varchar("coupon_id").notNull().references(() => coupons.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  paymentId: varchar("payment_id").notNull().references(() => payments.id),
  
  discountApplied: integer("discount_applied").notNull(), // Actual discount amount
  
  createdAt: timestamp("created_at").defaultNow(),
});

// User Coupons table - Track coupons assigned to users (e.g., rewards, promotions)
export const userCoupons = pgTable("user_coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  couponId: varchar("coupon_id").notNull().references(() => coupons.id),
  
  // How user obtained this coupon
  source: varchar("source").notNull(), // "invitation_reward", "promotion", "admin_grant", etc.
  sourceId: varchar("source_id"), // e.g., invitation_id for invitation rewards
  
  isUsed: boolean("is_used").default(false),
  usedAt: timestamp("used_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Venue Bookings table - Track venue capacity per time slot
export const venueBookings = pgTable("venue_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  venueId: varchar("venue_id").notNull().references(() => venues.id),
  eventId: varchar("event_id").notNull().references(() => blindBoxEvents.id),
  
  bookingDate: timestamp("booking_date").notNull(),
  bookingTime: varchar("booking_time").notNull(), // e.g., "19:00"
  
  participantCount: integer("participant_count").notNull(),
  
  // Sales tracking for commission
  estimatedRevenue: integer("estimated_revenue"), // Per-person average × participant count
  actualRevenue: integer("actual_revenue"), // Updated post-event
  commissionAmount: integer("commission_amount"), // actualRevenue × commissionRate
  
  status: varchar("status").default("confirmed"), // confirmed, completed, cancelled
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reports table - User reports
export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").notNull().references(() => users.id),
  reportedUserId: varchar("reported_user_id").references(() => users.id), // null if reporting content
  
  // Report details
  category: varchar("category").notNull(), // harassment, inappropriate_content, fake_profile, other
  description: text("description").notNull(),
  relatedEventId: varchar("related_event_id").references(() => events.id),
  
  // Moderation
  status: varchar("status").default("pending"), // pending, reviewing, resolved, dismissed
  reviewedBy: varchar("reviewed_by").references(() => users.id), // Admin user ID
  reviewedAt: timestamp("reviewed_at"),
  resolution: text("resolution"), // Admin's resolution notes
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Moderation Logs table - Track admin actions
export const moderationLogs = pgTable("moderation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  
  // Action details
  action: varchar("action").notNull(), // ban_user, unban_user, delete_content, resolve_report
  targetUserId: varchar("target_user_id").references(() => users.id),
  relatedReportId: varchar("related_report_id").references(() => reports.id),
  
  reason: text("reason"),
  notes: text("notes"), // Internal admin notes
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Content Management table - Unified table for all platform content
export const contents = pgTable("contents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Content type: announcement, help_article, faq, community_guideline
  type: varchar("type").notNull(),
  
  // Content details
  title: varchar("title").notNull(),
  content: text("content").notNull(), // Rich text / Markdown
  category: varchar("category"), // Optional categorization (e.g., "安全", "支付", "活动")
  
  // Publishing
  status: varchar("status").default("draft"), // draft, published, archived
  priority: integer("priority").default(0), // Higher = shown first
  publishedAt: timestamp("published_at"),
  
  // Metadata
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============ 邀请系统 - Invitation System ============

// Invitations table - 邀请链接追踪
export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 邀请码（唯一短码，用于生成链接）
  code: varchar("code").notNull().unique(), // e.g., "a3b9c5"
  
  // 邀请人信息
  inviterId: varchar("inviter_id").notNull().references(() => users.id),
  
  // 关联活动
  eventId: varchar("event_id").notNull().references(() => blindBoxEvents.id),
  
  // 邀请类型
  invitationType: varchar("invitation_type").default("pre_match"), // pre_match (匹配前壮胆邀请) | post_match (匹配后补位邀请)
  
  // 状态统计
  totalClicks: integer("total_clicks").default(0), // 链接点击次数
  totalRegistrations: integer("total_registrations").default(0), // 成功注册人数
  totalAcceptances: integer("total_acceptances").default(0), // 接受邀请人数
  successfulMatches: integer("successful_matches").default(0), // 成功匹配到同局的人数
  
  // 元数据
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // 邀请链接过期时间（默认为活动开始时间）
});

// Invitation Uses table - 邀请使用记录
export const invitationUses = pgTable("invitation_uses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 关联邀请
  invitationId: varchar("invitation_id").notNull().references(() => invitations.id),
  
  // 被邀请人信息
  inviteeId: varchar("invitee_id").notNull().references(() => users.id),
  
  // 关联盲盒活动（被邀请人报名的活动）- for old blind box events
  inviteeEventId: varchar("invitee_event_id").references(() => blindBoxEvents.id),
  
  // 关联活动池报名（被邀请人的池报名）- for new pool-based events
  poolRegistrationId: varchar("pool_registration_id").references(() => eventPoolRegistrations.id),
  
  // 匹配结果
  matchedTogether: boolean("matched_together").default(false), // 是否最终匹配到同一局
  rewardIssued: boolean("reward_issued").default(false), // 是否已发放奖励
  
  // 元数据
  createdAt: timestamp("created_at").defaultNow(),
  matchedAt: timestamp("matched_at"), // 匹配成功时间
});

// ============ 用户推荐系统 - User Referral System ============

// Referral Codes table - 用户专属邀请码（与活动无关）
export const referralCodes = pgTable("referral_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 用户关联（每人一个唯一邀请码）
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  
  // 邀请码（唯一短码）
  code: varchar("code").notNull().unique(), // e.g., "abc123"
  
  // 统计
  totalClicks: integer("total_clicks").default(0),
  totalConversions: integer("total_conversions").default(0), // 成功注册人数
  
  // 元数据
  createdAt: timestamp("created_at").defaultNow(),
});

// Referral Conversions table - 推荐转化记录
export const referralConversions = pgTable("referral_conversions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 关联邀请码
  referralCodeId: varchar("referral_code_id").notNull().references(() => referralCodes.id),
  
  // 被邀请人
  invitedUserId: varchar("invited_user_id").notNull().references(() => users.id),
  
  // 奖励状态
  inviterRewardIssued: boolean("inviter_reward_issued").default(false), // 邀请人是否已获得奖励
  inviteeRewardIssued: boolean("invitee_reward_issued").default(false), // 被邀请人是否已获得奖励
  
  // 元数据
  convertedAt: timestamp("converted_at").defaultNow(),
});

// Insert schemas for referral system
export const insertReferralCodeSchema = createInsertSchema(referralCodes).omit({
  id: true,
  createdAt: true,
  totalClicks: true,
  totalConversions: true,
});

export const insertReferralConversionSchema = createInsertSchema(referralConversions).omit({
  id: true,
  convertedAt: true,
});

// Types for referral system
export type InsertReferralCode = z.infer<typeof insertReferralCodeSchema>;
export type ReferralCode = typeof referralCodes.$inferSelect;
export type InsertReferralConversion = z.infer<typeof insertReferralConversionSchema>;
export type ReferralConversion = typeof referralConversions.$inferSelect;

// Insert schemas for admin tables
export const insertVenueSchema = createInsertSchema(venues).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVenueDealSchema = createInsertSchema(venueDeals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
}).extend({
  title: z.string().min(1, "优惠标题不能为空"),
  discountType: z.enum(["percentage", "fixed", "gift"]),
});

export const insertEventTemplateSchema = createInsertSchema(eventTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
});

export const insertCouponSchema = createInsertSchema(coupons).omit({
  id: true,
  createdAt: true,
});

export const insertUserCouponSchema = createInsertSchema(userCoupons).omit({
  id: true,
  createdAt: true,
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
});

export const insertModerationLogSchema = createInsertSchema(moderationLogs).omit({
  id: true,
  createdAt: true,
});

export const insertContentSchema = createInsertSchema(contents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type UpdateFullProfile = z.infer<typeof updateFullProfileSchema>;
export type UpdatePersonality = z.infer<typeof updatePersonalitySchema>;
export type RegisterUser = z.infer<typeof registerUserSchema>;
export type InterestsTopics = z.infer<typeof interestsTopicsSchema>;

export type Event = typeof events.$inferSelect;
export type EventAttendance = typeof eventAttendance.$inferSelect;
export type EventPool = typeof eventPools.$inferSelect;
export type EventPoolRegistration = typeof eventPoolRegistrations.$inferSelect;
export type EventPoolGroup = typeof eventPoolGroups.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type DirectMessageThread = typeof directMessageThreads.$inferSelect;
export type DirectMessage = typeof directMessages.$inferSelect;
export type EventFeedback = typeof eventFeedback.$inferSelect;
export type BlindBoxEvent = typeof blindBoxEvents.$inferSelect;
export type PersonalityQuestion = typeof personalityQuestions.$inferSelect;
export type TestResponse = typeof testResponses.$inferSelect;
export type RoleResult = typeof roleResults.$inferSelect;

export type InsertEventAttendance = z.infer<typeof insertEventAttendanceSchema>;
export type InsertEventPool = z.infer<typeof insertEventPoolSchema>;
export type InsertEventPoolRegistration = z.infer<typeof insertEventPoolRegistrationSchema>;
export type InsertEventPoolGroup = z.infer<typeof insertEventPoolGroupSchema>;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type InsertDirectMessageThread = z.infer<typeof insertDirectMessageThreadSchema>;
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type InsertEventFeedback = z.infer<typeof insertEventFeedbackSchema>;
export type InsertBlindBoxEvent = z.infer<typeof insertBlindBoxEventSchema>;
export type InsertTestResponse = z.infer<typeof insertTestResponseSchema>;
export type InsertRoleResult = z.infer<typeof insertRoleResultSchema>;

// Admin Portal Types
export type Venue = typeof venues.$inferSelect;
export type VenueDeal = typeof venueDeals.$inferSelect;
export type EventTemplate = typeof eventTemplates.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type CouponUsage = typeof couponUsage.$inferSelect;
export type UserCoupon = typeof userCoupons.$inferSelect;
export type VenueBooking = typeof venueBookings.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type ModerationLog = typeof moderationLogs.$inferSelect;
export type Content = typeof contents.$inferSelect;

export type InsertVenue = z.infer<typeof insertVenueSchema>;
export type InsertVenueDeal = z.infer<typeof insertVenueDealSchema>;
export type InsertEventTemplate = z.infer<typeof insertEventTemplateSchema>;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type InsertUserCoupon = z.infer<typeof insertUserCouponSchema>;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type InsertModerationLog = z.infer<typeof insertModerationLogSchema>;
export type InsertContent = z.infer<typeof insertContentSchema>;

// ============ MATCHING ALGORITHM TABLES ============

// Matching configuration table - stores algorithm weights
export const matchingConfig = pgTable("matching_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configName: varchar("config_name").notNull().default("default"), // config version name
  
  // 5个维度的权重 (0-100, 总和应为100)
  personalityWeight: integer("personality_weight").notNull().default(30), // 性格兼容性权重
  interestsWeight: integer("interests_weight").notNull().default(25),     // 兴趣匹配权重
  intentWeight: integer("intent_weight").notNull().default(20),           // 意图匹配权重
  backgroundWeight: integer("background_weight").notNull().default(15),   // 背景多样性权重
  cultureWeight: integer("culture_weight").notNull().default(10),         // 文化语言权重
  
  // 其他匹配参数
  minGroupSize: integer("min_group_size").default(5),
  maxGroupSize: integer("max_group_size").default(10),
  preferredGroupSize: integer("preferred_group_size").default(7),
  
  // 约束条件
  maxSameArchetypeRatio: integer("max_same_archetype_ratio").default(40), // 同一原型最多占比（%）
  minChemistryScore: integer("min_chemistry_score").default(60),          // 最低化学反应分数
  
  // 是否为活跃配置
  isActive: boolean("is_active").default(false),
  
  // 元数据
  notes: text("notes"), // 配置说明
  createdBy: varchar("created_by"), // 创建者ID（admin）
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMatchingConfigSchema = createInsertSchema(matchingConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  configName: z.string().min(1, "配置名称不能为空"),
  personalityWeight: z.number().min(0).max(100),
  interestsWeight: z.number().min(0).max(100),
  intentWeight: z.number().min(0).max(100),
  backgroundWeight: z.number().min(0).max(100),
  cultureWeight: z.number().min(0).max(100),
});

export type MatchingConfig = typeof matchingConfig.$inferSelect;
export type InsertMatchingConfig = z.infer<typeof insertMatchingConfigSchema>;

// Matching results table - stores historical matching results for analysis
export const matchingResults = pgTable("matching_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id"), // 可选，关联到具体活动
  configId: varchar("config_id").references(() => matchingConfig.id),
  
  // 输入数据
  userIds: text("user_ids").array(), // 参与匹配的用户ID列表
  userCount: integer("user_count").notNull(),
  
  // 匹配结果
  groups: jsonb("groups").notNull(), // [{groupId, userIds, chemistryScore, diversityScore, overallScore}]
  groupCount: integer("group_count").notNull(),
  
  // 评分指标
  avgChemistryScore: integer("avg_chemistry_score"), // 平均化学反应分数
  avgDiversityScore: integer("avg_diversity_score"), // 平均多样性分数
  overallMatchQuality: integer("overall_match_quality"), // 整体匹配质量 (0-100)
  
  // 性能指标
  executionTimeMs: integer("execution_time_ms"), // 匹配算法执行时间（毫秒）
  
  // 元数据
  isTestRun: boolean("is_test_run").default(false), // 是否为测试运行
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMatchingResultSchema = createInsertSchema(matchingResults).omit({
  id: true,
  createdAt: true,
});

export type MatchingResult = typeof matchingResults.$inferSelect;
export type InsertMatchingResult = z.infer<typeof insertMatchingResultSchema>;

// Notifications table
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  category: varchar("category").notNull(), // discover, activities, chat
  type: varchar("type").notNull(), // new_activity, matching_progress, match_success, activity_reminder, feedback_reminder, new_message, admin_announcement
  title: varchar("title").notNull(),
  message: text("message"),
  relatedResourceId: varchar("related_resource_id"), // event ID, chat ID, etc.
  isRead: boolean("is_read").default(false),
  sentBy: varchar("sent_by").references(() => users.id), // Admin user ID if sent by admin
  isBroadcast: boolean("is_broadcast").default(false), // Whether this is a broadcast notification
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// Notification count response type
export type NotificationCounts = {
  discover: number;
  activities: number;
  chat: number;
  total: number;
};

// ============ CHAT MODERATION & LOGGING TABLES ============

// Chat reports table - user reports of inappropriate messages
export const chatReports = pgTable("chat_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => chatMessages.id),
  eventId: varchar("event_id").references(() => events.id),
  threadId: varchar("thread_id").references(() => directMessageThreads.id),
  reportedBy: varchar("reported_by").notNull().references(() => users.id),
  reportedUserId: varchar("reported_user_id").notNull().references(() => users.id),
  
  reportType: varchar("report_type").notNull(), // harassment, spam, inappropriate, hate_speech, other
  description: text("description"),
  
  status: varchar("status").notNull().default("pending"), // pending, reviewed, dismissed, action_taken
  reviewedBy: varchar("reviewed_by").references(() => users.id), // Admin who reviewed
  reviewNotes: text("review_notes"),
  actionTaken: varchar("action_taken"), // none, warning, temporary_ban, permanent_ban, message_deleted
  
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

// Chat logs table - technical logs for debugging
export const chatLogs = pgTable("chat_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: varchar("event_type").notNull(), // message_sent, message_failed, connection_error, ws_connected, ws_disconnected
  eventId: varchar("event_id").references(() => events.id),
  threadId: varchar("thread_id").references(() => directMessageThreads.id),
  userId: varchar("user_id").references(() => users.id),
  
  severity: varchar("severity").notNull().default("info"), // info, warning, error
  message: text("message").notNull(),
  metadata: jsonb("metadata"), // Additional context (error details, message ID, etc.)
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("chat_logs_event_id_idx").on(table.eventId),
  index("chat_logs_user_id_idx").on(table.userId),
  index("chat_logs_severity_idx").on(table.severity),
  index("chat_logs_created_at_idx").on(table.createdAt),
]);

export const insertChatReportSchema = createInsertSchema(chatReports).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
}).extend({
  reportType: z.enum(["harassment", "spam", "inappropriate", "hate_speech", "other"]),
  description: z.string().optional(),
});

export const insertChatLogSchema = createInsertSchema(chatLogs).omit({
  id: true,
  createdAt: true,
}).extend({
  eventType: z.string().min(1),
  severity: z.enum(["info", "warning", "error"]),
  message: z.string().min(1),
});

export type ChatReport = typeof chatReports.$inferSelect;
export type ChatLog = typeof chatLogs.$inferSelect;
export type InsertChatReport = z.infer<typeof insertChatReportSchema>;
export type InsertChatLog = z.infer<typeof insertChatLogSchema>;

// ============ Invitation System Schemas ============

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
  totalClicks: true,
  totalRegistrations: true,
  successfulMatches: true,
});

export const insertInvitationUseSchema = createInsertSchema(invitationUses).omit({
  id: true,
  createdAt: true,
  matchedAt: true,
  matchedTogether: true,
  rewardIssued: true,
});

export type Invitation = typeof invitations.$inferSelect;
export type InvitationUse = typeof invitationUses.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type InsertInvitationUse = z.infer<typeof insertInvitationUseSchema>;

// ============ 定价管理系统 - Pricing Management ============

// Pricing Settings table - 动态价格配置
export const pricingSettings = pgTable("pricing_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 套餐类型标识
  planType: varchar("plan_type").notNull().unique(), // "monthly", "quarterly", "event_single"
  
  // 显示信息
  displayName: varchar("display_name").notNull(), // "月度会员", "季度会员", "单次活动"
  displayNameEn: varchar("display_name_en"), // "Monthly", "Quarterly", "Single Event"
  description: text("description"), // 套餐描述
  
  // 价格（单位：分）
  priceInCents: integer("price_in_cents").notNull(), // ¥199 = 19900
  originalPriceInCents: integer("original_price_in_cents"), // 原价，用于显示划线价
  
  // 有效期（天数，仅订阅套餐）
  durationDays: integer("duration_days"), // 30, 90, null for single events
  
  // 排序和状态
  sortOrder: integer("sort_order").default(0), // 排序顺序
  isActive: boolean("is_active").notNull().default(true), // whether this subscription is currently active (for queries using s.is_active)
  isFeatured: boolean("is_featured").default(false), // 是否推荐（高亮显示）
  
  // 生效时间（支持预约调价）
  effectiveFrom: timestamp("effective_from").defaultNow(),
  effectiveUntil: timestamp("effective_until"), // null = 永久有效
  
  // 审计字段
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Pricing History table - 价格变更记录（审计）
export const pricingHistory = pgTable("pricing_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  pricingId: varchar("pricing_id").notNull().references(() => pricingSettings.id),
  
  // 变更前后价格
  oldPriceInCents: integer("old_price_in_cents"),
  newPriceInCents: integer("new_price_in_cents").notNull(),
  
  // 变更原因
  changeReason: text("change_reason"),
  
  // 操作人
  changedBy: varchar("changed_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPricingSettingSchema = createInsertSchema(pricingSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePricingSettingSchema = createInsertSchema(pricingSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
}).partial();

export type PricingSetting = typeof pricingSettings.$inferSelect;
export type InsertPricingSetting = z.infer<typeof insertPricingSettingSchema>;
export type UpdatePricingSetting = z.infer<typeof updatePricingSettingSchema>;

// ============ 一键再约系统 - VIP Reunion System ============

// Reunion Requests table - VIP发起的再约请求（意向局）
export const reunionRequests = pgTable("reunion_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 关联原活动（触发再约的已完成活动）
  originalEventId: varchar("original_event_id").notNull().references(() => blindBoxEvents.id),
  
  // 发起人信息
  initiatorId: varchar("initiator_id").notNull().references(() => users.id),
  
  // 状态管理
  status: varchar("status").notNull().default("pending"), // pending (招募中) | fulfilled (已成局) | expired (已过期) | cancelled (已取消)
  
  // 成局配置
  minParticipants: integer("min_participants").default(4), // 最小成局人数
  maxParticipants: integer("max_participants").default(6), // 最大人数（含发起人）
  currentAccepted: integer("current_accepted").default(1), // 当前已接受人数（发起人算1）
  
  // 时间限制
  expiresAt: timestamp("expires_at").notNull(), // 24小时后过期
  
  // 成局后信息
  resultEventId: varchar("result_event_id").references(() => blindBoxEvents.id), // 成局后创建的新活动
  
  // 匿名通知模板信息
  eventDescription: text("event_description"), // e.g., "上周六咖啡局"
  
  createdAt: timestamp("created_at").defaultNow(),
  fulfilledAt: timestamp("fulfilled_at"), // 成局时间
});

// Reunion Responses table - 用户对再约邀请的响应
export const reunionResponses = pgTable("reunion_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 关联再约请求
  reunionRequestId: varchar("reunion_request_id").notNull().references(() => reunionRequests.id),
  
  // 被邀请用户
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // 响应状态
  status: varchar("status").notNull().default("pending"), // pending (待响应) | accepted (已接受) | declined (已拒绝) | expired (已过期)
  
  // 通知状态
  notificationSent: boolean("notification_sent").default(false),
  notificationSentAt: timestamp("notification_sent_at"),
  
  // 元数据
  createdAt: timestamp("created_at").defaultNow(),
  respondedAt: timestamp("responded_at"), // 响应时间
});

// Insert schemas for reunion system
export const insertReunionRequestSchema = createInsertSchema(reunionRequests).omit({
  id: true,
  createdAt: true,
  fulfilledAt: true,
  currentAccepted: true,
  resultEventId: true,
});

export const insertReunionResponseSchema = createInsertSchema(reunionResponses).omit({
  id: true,
  createdAt: true,
  respondedAt: true,
  notificationSent: true,
  notificationSentAt: true,
});

export type ReunionRequest = typeof reunionRequests.$inferSelect;
export type ReunionResponse = typeof reunionResponses.$inferSelect;
export type InsertReunionRequest = z.infer<typeof insertReunionRequestSchema>;
export type InsertReunionResponse = z.infer<typeof insertReunionResponseSchema>;

// Promotion Banners table - 推广横幅管理（发现页轮播+Landing Page素材）
export const promotionBanners = pgTable("promotion_banners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 基本信息
  imageUrl: varchar("image_url").notNull(), // 图片URL
  title: varchar("title"), // 标题（可选，用于SEO和管理）
  subtitle: varchar("subtitle"), // 副标题（可选，覆盖在图片上）
  
  // 链接配置
  linkUrl: varchar("link_url"), // 点击跳转链接
  linkType: varchar("link_type").default("internal"), // internal(站内) | external(外链) | none(无链接)
  
  // 展示位置和范围
  placement: varchar("placement").default("discover"), // discover(发现页) | landing(落地页) | both(两处都显示)
  city: varchar("city"), // 香港 | 深圳 | null(全部城市)
  
  // 排序和状态
  sortOrder: integer("sort_order").default(0), // 数字越小越靠前
  isActive: boolean("is_active").default(true),
  
  // 有效期
  effectiveFrom: timestamp("effective_from").defaultNow(),
  effectiveUntil: timestamp("effective_until"), // null表示永久有效
  
  // 元数据
  createdBy: varchar("created_by").references(() => users.id), // 创建者（Admin）
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schema for promotion banners
export const insertPromotionBannerSchema = createInsertSchema(promotionBanners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PromotionBanner = typeof promotionBanners.$inferSelect;
export type InsertPromotionBanner = z.infer<typeof insertPromotionBannerSchema>;

// ============ 场地时间段管理系统 ============

// Venue Time Slots table - 场地可用时间段（支持每周固定+具体日期两种模式）
export const venueTimeSlots = pgTable("venue_time_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 关联场地
  venueId: varchar("venue_id").notNull().references(() => venues.id),
  
  // 时间配置（二选一）
  // 每周固定模式：设置 dayOfWeek，specificDate 为 null
  // 具体日期模式：设置 specificDate，dayOfWeek 为 null
  dayOfWeek: integer("day_of_week"), // 0-6 (周日=0, 周一=1, ... 周六=6)
  specificDate: date("specific_date"), // 具体日期，如 2025-01-15
  
  // 时间段
  startTime: varchar("start_time").notNull(), // "18:00" 格式
  endTime: varchar("end_time").notNull(), // "22:00" 格式
  
  // 容量管理
  maxConcurrentEvents: integer("max_concurrent_events").default(1), // 此时间段可容纳的活动数
  
  // 状态
  isActive: boolean("is_active").default(true),
  
  // 备注
  notes: text("notes"), // 管理员备注
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Venue Time Slot Bookings table - 时间段预订记录（用于追踪已占用容量）
export const venueTimeSlotBookings = pgTable("venue_time_slot_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 关联
  timeSlotId: varchar("time_slot_id").notNull().references(() => venueTimeSlots.id),
  eventPoolId: varchar("event_pool_id").references(() => eventPools.id), // 关联的活动池
  eventGroupId: varchar("event_group_id").references(() => eventPoolGroups.id), // 关联的具体小组
  
  // 预订日期（对于每周固定时间段，需要记录具体预订的是哪一天）
  bookingDate: date("booking_date").notNull(),
  
  // 状态
  status: varchar("status").default("confirmed"), // confirmed | cancelled | completed
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas for venue time slots
export const insertVenueTimeSlotSchema = createInsertSchema(venueTimeSlots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVenueTimeSlotBookingSchema = createInsertSchema(venueTimeSlotBookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type VenueTimeSlot = typeof venueTimeSlots.$inferSelect;
export type VenueTimeSlotBooking = typeof venueTimeSlotBookings.$inferSelect;
export type InsertVenueTimeSlot = z.infer<typeof insertVenueTimeSlotSchema>;
export type InsertVenueTimeSlotBooking = z.infer<typeof insertVenueTimeSlotBookingSchema>;

// ============ AI驱动破冰流程系统 ============

// Icebreaker Sessions table - 活动破冰会话（关联到活动组）
export const icebreakerSessions = pgTable("icebreaker_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 关联（三选一：eventId用于旧系统，groupId用于新的eventPool系统，blindBoxEventId用于盲盒活动）
  eventId: varchar("event_id").references(() => events.id),
  groupId: varchar("group_id").references(() => eventPoolGroups.id),
  blindBoxEventId: varchar("blind_box_event_id").unique(), // 盲盒活动ID（唯一约束防止重复创建）
  
  // 会话状态
  currentPhase: varchar("current_phase").default("waiting"), // waiting | checkin | number_assign | icebreaker | ended
  phaseStartedAt: timestamp("phase_started_at"),
  
  // 参与者信息
  expectedAttendees: integer("expected_attendees").default(0), // 预期人数
  checkedInCount: integer("checked_in_count").default(0), // 已签到人数
  
  // AI生成内容缓存
  aiWelcomeMessage: text("ai_welcome_message"), // 个性化欢迎语
  aiClosingMessage: text("ai_closing_message"), // 结束总结语
  recommendedTopics: jsonb("recommended_topics"), // [{topicId, reason, priority}]
  
  // 会话配置
  autoAdvanceTimeout: integer("auto_advance_timeout").default(60), // 自动推进超时（秒）
  minReadyRatio: integer("min_ready_ratio").default(50), // 最小准备就绪比例（百分比）
  atmosphereType: varchar("atmosphere_type"), // 氛围类型
  hostUserId: varchar("host_user_id"), // 主持人用户ID
  
  // 元数据
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Icebreaker Checkins table - 签到记录
export const icebreakerCheckins = pgTable("icebreaker_checkins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  sessionId: varchar("session_id").notNull().references(() => icebreakerSessions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // 号码牌（签到后随机分配）
  numberPlate: integer("number_plate"), // 1, 2, 3... 用于自我介绍顺序
  
  // 签到状态
  checkedInAt: timestamp("checked_in_at").defaultNow(),
  isOnline: boolean("is_online").default(true), // WebSocket连接状态
  lastSeenAt: timestamp("last_seen_at").defaultNow(), // 最后活跃时间
  
  // 用户原型信息（冗余存储用于AI分析）
  userArchetype: varchar("user_archetype"), // 用户的动物原型
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Icebreaker Ready Votes table - 准备就绪投票
export const icebreakerReadyVotes = pgTable("icebreaker_ready_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  sessionId: varchar("session_id").notNull().references(() => icebreakerSessions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // 投票阶段（每个阶段都需要投票推进）
  phase: varchar("phase").notNull(), // number_assign | icebreaker
  
  // 投票时间
  votedAt: timestamp("voted_at").defaultNow(),
  
  // 是否为超时自动投票
  isAutoVote: boolean("is_auto_vote").default(false),
});

// Icebreaker Activity Logs table - 活动日志（用于AI分析和用户行为追踪）
export const icebreakerActivityLogs = pgTable("icebreaker_activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  sessionId: varchar("session_id").notNull().references(() => icebreakerSessions.id),
  userId: varchar("user_id").references(() => users.id), // null for system events
  
  // 活动类型
  activityType: varchar("activity_type").notNull(), // checkin | ready_vote | topic_select | game_start | phase_advance | disconnect | reconnect
  
  // 活动详情
  details: jsonb("details"), // 活动相关数据，如 {topicId: "xxx", gameId: "yyy"}
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for icebreaker tables
export const insertIcebreakerSessionSchema = createInsertSchema(icebreakerSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIcebreakerCheckinSchema = createInsertSchema(icebreakerCheckins).omit({
  id: true,
  createdAt: true,
});

export const insertIcebreakerReadyVoteSchema = createInsertSchema(icebreakerReadyVotes).omit({
  id: true,
});

export const insertIcebreakerActivityLogSchema = createInsertSchema(icebreakerActivityLogs).omit({
  id: true,
  createdAt: true,
});

// Types for icebreaker tables
export type IcebreakerSession = typeof icebreakerSessions.$inferSelect;
export type IcebreakerCheckin = typeof icebreakerCheckins.$inferSelect;
export type IcebreakerReadyVote = typeof icebreakerReadyVotes.$inferSelect;
export type IcebreakerActivityLog = typeof icebreakerActivityLogs.$inferSelect;
export type InsertIcebreakerSession = z.infer<typeof insertIcebreakerSessionSchema>;
export type InsertIcebreakerCheckin = z.infer<typeof insertIcebreakerCheckinSchema>;
export type InsertIcebreakerReadyVote = z.infer<typeof insertIcebreakerReadyVoteSchema>;
export type InsertIcebreakerActivityLog = z.infer<typeof insertIcebreakerActivityLogSchema>;

// ============ 国王游戏多设备同步系统 ============

// King Game Sessions table - 国王游戏会话（多设备同步）
export const kingGameSessions = pgTable("king_game_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 关联到破冰会话
  icebreakerSessionId: varchar("icebreaker_session_id").notNull().references(() => icebreakerSessions.id),
  
  // 游戏配置
  playerCount: integer("player_count").notNull(), // 4-6人
  roundNumber: integer("round_number").default(1), // 当前轮次
  
  // 牌分配（服务端随机生成）
  cardAssignments: jsonb("card_assignments"), // [{participantId, cardNumber, isKing}]
  mysteryNumber: integer("mystery_number"), // 神秘牌号码（国王的号码）
  
  // 发牌员（随机选择的玩家）
  dealerId: varchar("dealer_id").references(() => users.id),
  
  // 游戏阶段
  phase: varchar("phase").default("waiting"), // waiting | dealing | commanding | executing | completed
  
  // 国王命令
  kingUserId: varchar("king_user_id").references(() => users.id), // 当前国王
  currentCommand: text("current_command"), // 选择的命令
  targetNumber: integer("target_number"), // 目标号码
  
  // 元数据
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// King Game Players table - 参与玩家状态
export const kingGamePlayers = pgTable("king_game_players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  sessionId: varchar("session_id").notNull().references(() => kingGameSessions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // 玩家状态
  isReady: boolean("is_ready").default(false), // 是否准备好
  hasDrawnCard: boolean("has_drawn_card").default(false), // 是否已抽牌
  cardNumber: integer("card_number"), // 抽到的牌号（只有本人和服务端知道）
  isKing: boolean("is_king").default(false), // 是否是国王
  
  // 显示名称（冗余存储）
  displayName: varchar("display_name"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for King Game tables
export const insertKingGameSessionSchema = createInsertSchema(kingGameSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKingGamePlayerSchema = createInsertSchema(kingGamePlayers).omit({
  id: true,
  createdAt: true,
});

// Types for King Game tables
export type KingGameSession = typeof kingGameSessions.$inferSelect;
export type KingGamePlayer = typeof kingGamePlayers.$inferSelect;
export type InsertKingGameSession = z.infer<typeof insertKingGameSessionSchema>;
export type InsertKingGamePlayer = z.infer<typeof insertKingGamePlayerSchema>;

// ============ 游戏化等级系统 ============

// XP Transactions table - 经验值/悦币交易日志
export const xpTransactions = pgTable("xp_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // 交易类型
  transactionType: varchar("transaction_type").notNull(), // registration, event_register, event_checkin, event_complete, feedback, streak_bonus, first_match, profile_complete, redeem, admin_adjust
  
  // 交易金额
  xpAmount: integer("xp_amount").default(0), // 经验值变动（正数增加，负数减少）
  coinsAmount: integer("coins_amount").default(0), // 悦币变动
  
  // 交易后余额（便于审计）
  xpBalance: integer("xp_balance").default(0), // 交易后XP余额
  coinsBalance: integer("coins_balance").default(0), // 交易后悦币余额
  
  // 关联信息
  relatedEventId: varchar("related_event_id"), // 关联的活动ID（如果适用）
  relatedFeedbackId: varchar("related_feedback_id"), // 关联的反馈ID（如果适用）
  
  // 描述
  description: text("description"), // 交易描述
  descriptionCn: text("description_cn"), // 中文描述
  
  // 元数据
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schema for xpTransactions
export const insertXpTransactionSchema = createInsertSchema(xpTransactions).omit({
  id: true,
  createdAt: true,
});

// Types for XP Transactions
export type XpTransaction = typeof xpTransactions.$inferSelect;
export type InsertXpTransaction = z.infer<typeof insertXpTransactionSchema>;

// ============ 注册会话遥测系统 ============

// Registration Sessions table - 追踪注册漏斗的完整生命周期
export const registrationSessions = pgTable("registration_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 用户关联（可选，匿名会话开始时可能没有用户）
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  
  // 会话模式
  sessionMode: varchar("session_mode").notNull(), // 'ai_chat', 'form', 'hybrid'
  
  // 生命周期时间戳
  startedAt: timestamp("started_at").defaultNow().notNull(),
  l1CompletedAt: timestamp("l1_completed_at"), // L1必填字段完成时间
  l2EnrichedAt: timestamp("l2_enriched_at"), // L2可选字段首次填写时间
  completedAt: timestamp("completed_at"), // 注册完成时间
  abandonedAt: timestamp("abandoned_at"), // 放弃时间（如果放弃）
  lastTouchAt: timestamp("last_touch_at").defaultNow(), // 最后活跃时间
  
  // L3 AI推断指标
  l3Confidence: numeric("l3_confidence", { precision: 5, scale: 4 }), // 0.0000 - 1.0000
  l3ConfidenceSource: varchar("l3_confidence_source"), // 'dialect', 'communication_style', 'combined'
  
  // 会话统计
  messageCount: integer("message_count").default(0), // AI对话消息数
  l2FieldsFilledCount: integer("l2_fields_filled_count").default(0), // 已填L2字段数
  fatigueReminderTriggered: boolean("fatigue_reminder_triggered").default(false), // 是否触发疲劳提醒
  
  // 设备信息
  deviceChannel: varchar("device_channel"), // 'mobile', 'desktop', 'tablet'
  userAgent: text("user_agent"),
  
  // 元数据
  metadata: jsonb("metadata"), // 额外数据存储
  
  // AI Evolution System - Completion Quality Tracking
  completionQuality: numeric("completion_quality", { precision: 5, scale: 4 }), // 整体完成质量 0-1
  completionQualityFactors: jsonb("completion_quality_factors"), // {informationCompleteness: 0-1, engagementLevel: 0-1, responseQuality: 0-1}
  triggersUsedInSession: text("triggers_used_in_session").array(), // 会话中使用的触发器ID列表
  mostEffectiveTriggerInSession: varchar("most_effective_trigger_in_session"), // 最有效的触发器
  aiResponseQuality: numeric("ai_response_quality", { precision: 5, scale: 4 }), // 小悦回复质量评分 0-1
  
  // 时间戳
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_reg_sessions_user_id").on(table.userId),
  index("idx_reg_sessions_started_at").on(table.startedAt),
  index("idx_reg_sessions_completed_at").on(table.completedAt),
]);

// Insert schema for registrationSessions
export const insertRegistrationSessionSchema = createInsertSchema(registrationSessions).omit({
  id: true,
  updatedAt: true,
});

// Types for Registration Sessions
export type RegistrationSession = typeof registrationSessions.$inferSelect;
export type InsertRegistrationSession = z.infer<typeof insertRegistrationSessionSchema>;

// ============ 小悦进化系统 - AI Evolution System ============

// 黄金话术库 - Golden Dialogues for successful conversation patterns
export const goldenDialogues = pgTable("golden_dialogues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 话术分类
  category: varchar("category").notNull(), // 'greeting', 'gender_ask', 'age_ask', 'interest_probe', 'closing', etc.
  triggerContext: varchar("trigger_context"), // 触发该话术的上下文场景
  
  // 话术内容
  dialogueContent: text("dialogue_content").notNull(), // 原始对话片段
  refinedVersion: text("refined_version"), // 精炼版本（人工优化后）
  
  // 效果指标
  successRate: numeric("success_rate", { precision: 5, scale: 4 }).default("0"), // 成功率 0-1
  usageCount: integer("usage_count").default(0), // 使用次数
  positiveReactions: integer("positive_reactions").default(0), // 正向反应次数
  
  // 标记状态
  isActive: boolean("is_active").default(true),
  isManuallyTagged: boolean("is_manually_tagged").default(false), // 人工标记 vs 自动发现
  taggedByAdminId: varchar("tagged_by_admin_id").references(() => users.id),
  
  // 来源追踪
  sourceSessionId: varchar("source_session_id").references(() => registrationSessions.id),
  sourceUserId: varchar("source_user_id").references(() => users.id),
  
  // 时间戳
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_golden_dialogues_category").on(table.category),
  index("idx_golden_dialogues_success_rate").on(table.successRate),
]);

// 匹配权重配置 - Dynamic Matching Weights (Multi-Armed Bandit)
export const matchingWeightsConfig = pgTable("matching_weights_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 配置标识
  configName: varchar("config_name").notNull().unique(), // 'default', 'experiment_a', 'experiment_b'
  isActive: boolean("is_active").default(false), // 当前是否生效
  
  // 6维权重 (Thompson Sampling参数)
  personalityWeight: numeric("personality_weight", { precision: 5, scale: 4 }).default("0.23"), // 人格 23%
  interestsWeight: numeric("interests_weight", { precision: 5, scale: 4 }).default("0.24"), // 兴趣 24%
  intentWeight: numeric("intent_weight", { precision: 5, scale: 4 }).default("0.13"), // 意图 13%
  backgroundWeight: numeric("background_weight", { precision: 5, scale: 4 }).default("0.15"), // 背景 15%
  cultureWeight: numeric("culture_weight", { precision: 5, scale: 4 }).default("0.10"), // 文化 10%
  conversationSignatureWeight: numeric("conversation_signature_weight", { precision: 5, scale: 4 }).default("0.15"), // 对话签名 15%
  
  // Thompson Sampling 统计 (Beta分布参数)
  personalityAlpha: integer("personality_alpha").default(1),
  personalityBeta: integer("personality_beta").default(1),
  interestsAlpha: integer("interests_alpha").default(1),
  interestsBeta: integer("interests_beta").default(1),
  intentAlpha: integer("intent_alpha").default(1),
  intentBeta: integer("intent_beta").default(1),
  backgroundAlpha: integer("background_alpha").default(1),
  backgroundBeta: integer("background_beta").default(1),
  cultureAlpha: integer("culture_alpha").default(1),
  cultureBeta: integer("culture_beta").default(1),
  conversationSignatureAlpha: integer("conversation_signature_alpha").default(1),
  conversationSignatureBeta: integer("conversation_signature_beta").default(1),
  
  // 累计统计
  totalMatches: integer("total_matches").default(0),
  successfulMatches: integer("successful_matches").default(0), // 满意度>=4的匹配
  averageSatisfaction: numeric("average_satisfaction", { precision: 5, scale: 4 }).default("0"),
  
  // 时间戳
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 权重变化历史 - Weight Change History for visualization
export const matchingWeightsHistory = pgTable("matching_weights_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  configId: varchar("config_id").notNull().references(() => matchingWeightsConfig.id),
  
  // 快照时间点的权重
  personalityWeight: numeric("personality_weight", { precision: 5, scale: 4 }),
  interestsWeight: numeric("interests_weight", { precision: 5, scale: 4 }),
  intentWeight: numeric("intent_weight", { precision: 5, scale: 4 }),
  backgroundWeight: numeric("background_weight", { precision: 5, scale: 4 }),
  cultureWeight: numeric("culture_weight", { precision: 5, scale: 4 }),
  conversationSignatureWeight: numeric("conversation_signature_weight", { precision: 5, scale: 4 }),
  
  // 触发变更的原因
  changeReason: varchar("change_reason"), // 'scheduled_update', 'manual_adjustment', 'bandit_exploration'
  
  // 当时的统计
  matchesSinceLastUpdate: integer("matches_since_last_update").default(0),
  satisfactionSinceLastUpdate: numeric("satisfaction_since_last_update", { precision: 5, scale: 4 }),
  
  recordedAt: timestamp("recorded_at").defaultNow(),
}, (table) => [
  index("idx_weights_history_config").on(table.configId),
  index("idx_weights_history_recorded_at").on(table.recordedAt),
]);

// 对话向量存储 - Dialogue Embeddings (using JSONB for vector storage)
export const dialogueEmbeddings = pgTable("dialogue_embeddings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 来源关联
  sourceSessionId: varchar("source_session_id").references(() => registrationSessions.id),
  sourceUserId: varchar("source_user_id").references(() => users.id),
  
  // 对话内容
  dialogueContent: text("dialogue_content").notNull(), // 原始对话
  dialogueSummary: text("dialogue_summary"), // AI生成的摘要
  
  // 向量存储 (使用JSONB存储，支持未来迁移到pgvector)
  embedding: jsonb("embedding"), // 向量数组 [0.1, 0.2, ...]
  embeddingModel: varchar("embedding_model").default("deepseek"), // 使用的embedding模型
  embeddingDimension: integer("embedding_dimension").default(1536), // 向量维度
  
  // 元数据
  category: varchar("category"), // 对话类别
  sentiment: varchar("sentiment"), // 情感分析结果
  qualityScore: numeric("quality_score", { precision: 5, scale: 4 }), // 质量评分 0-1
  
  // 状态
  isSuccessful: boolean("is_successful").default(false), // 是否来自成功注册
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_dialogue_embeddings_session").on(table.sourceSessionId),
  index("idx_dialogue_embeddings_successful").on(table.isSuccessful),
]);

// 触发器性能追踪 - Trigger Performance Tracking
export const triggerPerformance = pgTable("trigger_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 触发器标识
  triggerId: varchar("trigger_id").notNull(), // 对应38个触发器的ID
  triggerName: varchar("trigger_name").notNull(), // 触发器名称
  triggerCategory: varchar("trigger_category"), // 'greeting', 'probe', 'reaction', 'closing'
  
  // 当前阈值配置
  currentThreshold: numeric("current_threshold", { precision: 5, scale: 4 }).default("0.5"),
  defaultThreshold: numeric("default_threshold", { precision: 5, scale: 4 }).default("0.5"),
  
  // Thompson Sampling 参数
  alpha: integer("alpha").default(1), // 成功次数 + 1
  beta: integer("beta").default(1), // 失败次数 + 1
  
  // 统计指标
  totalTriggers: integer("total_triggers").default(0), // 总触发次数
  successfulTriggers: integer("successful_triggers").default(0), // 触发后用户继续对话
  abandonedAfterTrigger: integer("abandoned_after_trigger").default(0), // 触发后用户放弃
  
  // 效果评分
  effectivenessScore: numeric("effectiveness_score", { precision: 5, scale: 4 }).default("0.5"),
  
  // 最后更新
  lastTriggeredAt: timestamp("last_triggered_at"),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow(),
}, (table) => [
  index("idx_trigger_performance_id").on(table.triggerId),
  index("idx_trigger_performance_effectiveness").on(table.effectivenessScore),
]);

// 对话反馈 - Dialogue Feedback for evolution
export const dialogueFeedback = pgTable("dialogue_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 关联
  sessionId: varchar("session_id").references(() => registrationSessions.id),
  userId: varchar("user_id").references(() => users.id),
  
  // 反馈类型
  feedbackType: varchar("feedback_type").notNull(), // 'completion', 'abandonment', 'implicit', 'explicit'
  
  // 显性反馈 (用户主动提供)
  overallRating: integer("overall_rating"), // 1-5
  helpfulnessRating: integer("helpfulness_rating"), // 1-5
  personalityRating: integer("personality_rating"), // 1-5 (小悦的人格魅力)
  feedbackText: text("feedback_text"), // 文字反馈
  
  // 隐性反馈 (系统自动收集)
  completionTime: integer("completion_time"), // 完成注册所用秒数
  messageCount: integer("message_count"), // 对话轮数
  abandonmentPoint: varchar("abandonment_point"), // 放弃时的问题阶段
  retryCount: integer("retry_count").default(0), // 重试次数
  
  // 触发器关联
  triggersUsed: text("triggers_used").array(), // 本次对话使用的触发器ID列表
  mostEffectiveTrigger: varchar("most_effective_trigger"), // 最有效的触发器
  
  // 对话质量指标
  dialogueQualityScore: numeric("dialogue_quality_score", { precision: 5, scale: 4 }), // AI评估的对话质量
  userEngagementScore: numeric("user_engagement_score", { precision: 5, scale: 4 }), // 用户参与度
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_dialogue_feedback_session").on(table.sessionId),
  index("idx_dialogue_feedback_type").on(table.feedbackType),
  index("idx_dialogue_feedback_rating").on(table.overallRating),
]);

// Insert schemas for evolution system
export const insertGoldenDialogueSchema = createInsertSchema(goldenDialogues).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMatchingWeightsConfigSchema = createInsertSchema(matchingWeightsConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMatchingWeightsHistorySchema = createInsertSchema(matchingWeightsHistory).omit({
  id: true,
  recordedAt: true,
});

export const insertDialogueEmbeddingSchema = createInsertSchema(dialogueEmbeddings).omit({
  id: true,
  createdAt: true,
});

export const insertTriggerPerformanceSchema = createInsertSchema(triggerPerformance).omit({
  id: true,
  lastUpdatedAt: true,
});

export const insertDialogueFeedbackSchema = createInsertSchema(dialogueFeedback).omit({
  id: true,
  createdAt: true,
});

// ============ KPI Tracking System ============

// Daily KPI Snapshots - Aggregated metrics for dashboard visualization
export const kpiSnapshots = pgTable("kpi_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Time period
  snapshotDate: date("snapshot_date").notNull(), // Date for this snapshot
  periodType: varchar("period_type").default("daily"), // daily, weekly, monthly
  
  // User Metrics
  totalUsers: integer("total_users").default(0),
  newUsersToday: integer("new_users_today").default(0),
  activeUsersToday: integer("active_users_today").default(0), // Users who logged in
  activeUsersWeek: integer("active_users_week").default(0), // WAU
  activeUsersMonth: integer("active_users_month").default(0), // MAU
  
  // Onboarding Metrics
  registrationStarts: integer("registration_starts").default(0),
  registrationCompletions: integer("registration_completions").default(0),
  registrationConversionRate: numeric("registration_conversion_rate", { precision: 5, scale: 4 }),
  
  // Event Metrics
  totalEvents: integer("total_events").default(0),
  newEventsToday: integer("new_events_today").default(0),
  eventsMatchedToday: integer("events_matched_today").default(0),
  eventsCompletedToday: integer("events_completed_today").default(0),
  
  // Satisfaction Metrics (CSAT)
  feedbackCount: integer("feedback_count").default(0),
  avgAtmosphereScore: numeric("avg_atmosphere_score", { precision: 3, scale: 2 }), // 1-5 average
  avgConnectionQuality: numeric("avg_connection_quality", { precision: 3, scale: 2 }), // From connectionRadar
  csatScore: numeric("csat_score", { precision: 5, scale: 2 }), // Percentage 0-100
  npsScore: integer("nps_score"), // Net Promoter Score -100 to 100
  
  // Retention Metrics
  repeatAttendanceRate: numeric("repeat_attendance_rate", { precision: 5, scale: 4 }), // % of users attending 2+ events
  day7RetentionRate: numeric("day7_retention_rate", { precision: 5, scale: 4 }),
  day30RetentionRate: numeric("day30_retention_rate", { precision: 5, scale: 4 }),
  churnedUsersCount: integer("churned_users_count").default(0), // Users inactive >30 days
  
  // Engagement Metrics
  avgEventsPerUser: numeric("avg_events_per_user", { precision: 5, scale: 2 }),
  avgMatchScore: numeric("avg_match_score", { precision: 5, scale: 2 }),
  connectionRate: numeric("connection_rate", { precision: 5, scale: 4 }), // % of attendees who made connections
  
  // AI Metrics
  xiaoyueChatCount: integer("xiaoyue_chat_count").default(0),
  avgXiaoyueRating: numeric("avg_xiaoyue_rating", { precision: 3, scale: 2 }),
  insightsCollectedCount: integer("insights_collected_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kpi_snapshot_date").on(table.snapshotDate),
  index("idx_kpi_period_type").on(table.periodType),
]);

// User Engagement Tracking - Per-user metrics for cohort analysis
export const userEngagementMetrics = pgTable("user_engagement_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Activity counters
  totalEventsAttended: integer("total_events_attended").default(0),
  totalEventsHosted: integer("total_events_hosted").default(0),
  totalFeedbackGiven: integer("total_feedback_given").default(0),
  totalConnectionsMade: integer("total_connections_made").default(0),
  
  // Time-based metrics
  firstEventDate: date("first_event_date"),
  lastEventDate: date("last_event_date"),
  lastActiveDate: date("last_active_date"),
  daysSinceLastActivity: integer("days_since_last_activity"),
  
  // Satisfaction aggregates
  avgSatisfactionScore: numeric("avg_satisfaction_score", { precision: 3, scale: 2 }),
  avgConnectionQuality: numeric("avg_connection_quality", { precision: 3, scale: 2 }),
  wouldRecommendCount: integer("would_recommend_count").default(0),
  
  // Churn indicators
  isChurned: boolean("is_churned").default(false), // Inactive > 30 days
  churnRiskScore: numeric("churn_risk_score", { precision: 3, scale: 2 }), // 0-1 (AI predicted)
  churnedAt: date("churned_at"),
  reactivatedAt: date("reactivated_at"),
  
  // Cohort tracking
  registrationCohort: varchar("registration_cohort"), // YYYY-MM format
  registrationMethod: varchar("registration_method"), // form or chat
  
  // Lifetime value indicators
  totalSpend: integer("total_spend").default(0), // In cents
  eventCreditsUsed: integer("event_credits_used").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_engagement_user").on(table.userId),
  index("idx_user_engagement_churned").on(table.isChurned),
  index("idx_user_engagement_last_active").on(table.lastActiveDate),
]);

// Event Satisfaction Summary - Per-event aggregated satisfaction
export const eventSatisfactionSummary = pgTable("event_satisfaction_summary", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull(), // Can be event pool ID or blind box event ID
  eventType: varchar("event_type").notNull(), // 饭局/酒局
  
  // Feedback aggregates
  feedbackCount: integer("feedback_count").default(0),
  avgAtmosphereScore: numeric("avg_atmosphere_score", { precision: 3, scale: 2 }),
  avgConnectionQuality: numeric("avg_connection_quality", { precision: 3, scale: 2 }),
  
  // Connection outcomes
  totalConnectionsMade: integer("total_connections_made").default(0),
  connectionRate: numeric("connection_rate", { precision: 5, scale: 4 }), // % who made connections
  
  // Venue satisfaction
  venueLikeCount: integer("venue_like_count").default(0),
  venueNeutralCount: integer("venue_neutral_count").default(0),
  venueDislikeCount: integer("venue_dislike_count").default(0),
  
  // Match quality
  avgMatchScore: integer("avg_match_score"),
  temperatureLevel: varchar("temperature_level"), // fire/warm/mild/cold
  
  // Repeat indicators
  attendeesWithPriorEvents: integer("attendees_with_prior_events").default(0),
  repeatAttendeeRate: numeric("repeat_attendee_rate", { precision: 5, scale: 4 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_event_satisfaction_event").on(table.eventId),
  index("idx_event_satisfaction_type").on(table.eventType),
]);

// Insert schemas for KPI system
export const insertKpiSnapshotSchema = createInsertSchema(kpiSnapshots).omit({
  id: true,
  createdAt: true,
});

export const insertUserEngagementMetricsSchema = createInsertSchema(userEngagementMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventSatisfactionSummarySchema = createInsertSchema(eventSatisfactionSummary).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for evolution system
export type GoldenDialogue = typeof goldenDialogues.$inferSelect;
export type InsertGoldenDialogue = z.infer<typeof insertGoldenDialogueSchema>;

export type MatchingWeightsConfig = typeof matchingWeightsConfig.$inferSelect;
export type InsertMatchingWeightsConfig = z.infer<typeof insertMatchingWeightsConfigSchema>;

export type MatchingWeightsHistory = typeof matchingWeightsHistory.$inferSelect;
export type InsertMatchingWeightsHistory = z.infer<typeof insertMatchingWeightsHistorySchema>;

export type DialogueEmbedding = typeof dialogueEmbeddings.$inferSelect;
export type InsertDialogueEmbedding = z.infer<typeof insertDialogueEmbeddingSchema>;

export type TriggerPerformance = typeof triggerPerformance.$inferSelect;
export type InsertTriggerPerformance = z.infer<typeof insertTriggerPerformanceSchema>;

export type DialogueFeedback = typeof dialogueFeedback.$inferSelect;
export type InsertDialogueFeedback = z.infer<typeof insertDialogueFeedbackSchema>;

// Types for KPI system
export type KpiSnapshot = typeof kpiSnapshots.$inferSelect;
export type InsertKpiSnapshot = z.infer<typeof insertKpiSnapshotSchema>;

export type UserEngagementMetrics = typeof userEngagementMetrics.$inferSelect;
export type InsertUserEngagementMetrics = z.infer<typeof insertUserEngagementMetricsSchema>;

export type EventSatisfactionSummary = typeof eventSatisfactionSummary.$inferSelect;
export type InsertEventSatisfactionSummary = z.infer<typeof insertEventSatisfactionSummarySchema>;

// ============ Gossip Cache System V3 ============

export const gossipCache = pgTable("gossip_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clusterHash: varchar("cluster_hash", { length: 255 }).notNull(),
  triggerType: varchar("trigger_type", { length: 100 }).notNull(),
  variants: text("variants").array().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  avgRating: numeric("avg_rating", { precision: 3, scale: 2 }),
}, (table) => [
  index("idx_gossip_cache_cluster").on(table.clusterHash),
  index("idx_gossip_cache_trigger").on(table.triggerType),
  index("idx_gossip_cache_cluster_trigger").on(table.clusterHash, table.triggerType),
]);

export const insertGossipCacheSchema = createInsertSchema(gossipCache).omit({
  id: true,
  createdAt: true,
});

export type GossipCache = typeof gossipCache.$inferSelect;
export type InsertGossipCache = z.infer<typeof insertGossipCacheSchema>;

// ============ Pre-signup data cache ============

export const preSignupData = pgTable("pre_signup_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  temporarySessionId: varchar("temporary_session_id").notNull().unique(),
  metadata: jsonb("metadata"),
  answers: jsonb("answers"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_pre_signup_temp_session").on(table.temporarySessionId),
]);

export const insertPreSignupDataSchema = createInsertSchema(preSignupData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PreSignupData = typeof preSignupData.$inferSelect;
export type InsertPreSignupData = z.infer<typeof insertPreSignupDataSchema>;

// ============ V4 Adaptive Personality Assessment ============

export const assessmentSessions = pgTable("assessment_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  phase: varchar("phase").notNull().default("pre_signup"), // pre_signup, post_signup, completed
  currentQuestionIndex: integer("current_question_index").default(0),
  traitScores: jsonb("trait_scores"), // { A: number, C: number, E: number, O: number, X: number, P: number }
  traitConfidences: jsonb("trait_confidences"), // { A: {score, confidence, sampleCount}, ... }
  topArchetypes: jsonb("top_archetypes"), // [{ archetype: string, score: number, confidence: number }]
  preSignupData: jsonb("pre_signup_data"), // Cached answers from before signup
  validityScore: numeric("validity_score", { precision: 3, scale: 2 }),
  totalQuestions: integer("total_questions").default(0),
  isExtended: boolean("is_extended").default(false), // Whether session was extended to 20 questions
  skipCount: integer("skip_count").default(0),
  skippedQuestionIds: jsonb("skipped_question_ids").default("[]"),
  answeredQuestionIds: jsonb("answered_question_ids").default("[]"),
  currentMatches: jsonb("current_matches").default("[]"),
  questionHistory: jsonb("question_history").default("[]"),
  algorithmVersion: varchar("algorithm_version", { length: 20 }), // v1 or v2 matcher algorithm
  matchDetailsJson: jsonb("match_details_json"), // V2 explainable match result with traitDeltas, decisiveReason
  finalResult: jsonb("final_result"), // Complete result JSON including primaryArchetype, traitScores, etc.
  primaryArchetype: varchar("primary_archetype", { length: 50 }), // Final matched archetype
  isDecisive: boolean("is_decisive"), // Whether match was decisive (clear winner)
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_assessment_session_user").on(table.userId),
  index("idx_assessment_session_phase").on(table.phase),
]);

export const assessmentAnswers = pgTable("assessment_answers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => assessmentSessions.id),
  questionId: varchar("question_id").notNull(),
  questionLevel: integer("question_level").notNull(), // 1, 2, or 3
  selectedOption: varchar("selected_option").notNull(),
  traitScores: jsonb("trait_scores").notNull(), // The trait scores from selected option
  answeredAt: timestamp("answered_at").defaultNow(),
}, (table) => [
  index("idx_assessment_answer_session").on(table.sessionId),
  index("idx_assessment_answer_question").on(table.questionId),
]);

export const insertAssessmentSessionSchema = createInsertSchema(assessmentSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAssessmentAnswerSchema = createInsertSchema(assessmentAnswers).omit({
  id: true,
  answeredAt: true,
});

export type AssessmentSession = typeof assessmentSessions.$inferSelect;
export type InsertAssessmentSession = z.infer<typeof insertAssessmentSessionSchema>;

export type AssessmentAnswer = typeof assessmentAnswers.$inferSelect;
export type InsertAssessmentAnswer = z.infer<typeof insertAssessmentAnswerSchema>;

// ============ 三层行业分类系统表 (Three-Tier Industry Classification Tables) ============

// AI分类日志表 - 记录所有AI推断的行业分类
export const industryAiLogs = pgTable("industry_ai_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }),
  
  rawInput: text("raw_input").notNull(),
  
  aiCategory: varchar("ai_category", { length: 50 }),
  aiSegment: varchar("ai_segment", { length: 100 }),
  aiNiche: varchar("ai_niche", { length: 150 }),
  aiConfidence: numeric("ai_confidence", { precision: 3, scale: 2 }),
  aiReasoning: text("ai_reasoning"),
  
  userAccepted: boolean("user_accepted"),
  userCorrectedCategory: varchar("user_corrected_category", { length: 50 }),
  userCorrectedSegment: varchar("user_corrected_segment", { length: 100 }),
  userCorrectedNiche: varchar("user_corrected_niche", { length: 150 }),
  
  processingTimeMs: integer("processing_time_ms"),
  modelVersion: varchar("model_version", { length: 50 }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ai_logs_user_id").on(table.userId),
  index("idx_ai_logs_created_at").on(table.createdAt),
]);

// Seed库候选表 - 用于自动扩展精确匹配库
export const industrySeedCandidates = pgTable("industry_seed_candidates", {
  id: serial("id").primaryKey(),
  rawInput: text("raw_input").notNull().unique(),
  
  frequency: integer("frequency").default(1),
  aiCategory: varchar("ai_category", { length: 50 }),
  aiSegment: varchar("ai_segment", { length: 100 }),
  aiNiche: varchar("ai_niche", { length: 150 }),
  avgConfidence: numeric("avg_confidence", { precision: 3, scale: 2 }),
  
  status: varchar("status", { length: 20 }).default("pending"),           // "pending" | "approved" | "rejected"
  reviewedBy: varchar("reviewed_by", { length: 255 }),
  reviewedAt: timestamp("reviewed_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_seed_candidates_status").on(table.status),
  index("idx_seed_candidates_frequency").on(table.frequency),
]);

export const insertIndustryAiLogSchema = createInsertSchema(industryAiLogs).omit({
  id: true,
  createdAt: true,
});

export const insertIndustrySeedCandidateSchema = createInsertSchema(industrySeedCandidates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type IndustryAiLog = typeof industryAiLogs.$inferSelect;
export type InsertIndustryAiLog = z.infer<typeof insertIndustryAiLogSchema>;

export type IndustrySeedCandidate = typeof industrySeedCandidates.$inferSelect;
export type InsertIndustrySeedCandidate = z.infer<typeof insertIndustrySeedCandidateSchema>;

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
  unique,
  uniqueIndex,
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
  PRONOUNS_OPTIONS,
} from "../constants";

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
  ageVisibility: varchar("age_visibility").default("show_age_range"), // hide_all, show_age_range (legacy: show_generation, show_exact_age)
  gender: varchar("gender"), // 女性, 男性, 不透露
  pronouns: varchar("pronouns"), // 她/She, 他/He, 它们/They, 自定义, 不透露
  
  // Registration fields - Background
  relationshipStatus: varchar("relationship_status"), // 单身, 恋爱中, 已婚/伴侣, 离异, 丧偶, 不透露
  
  // Registration fields - Life Stage & Age Preferences
  lifeStage: varchar("life_stage"), // 学生党, 职场新人, 职场老手, 创业中, 自由职业
  ageMatchPreference: varchar("age_match_preference"), // 同龄人, 偏年轻, 偏成熟, 都可以
  
  // Registration fields - Education
  educationLevel: varchar("education_level"), // 博士, 硕士, 本科, 大专, 中专, 高中及以下
  educationVisibility: varchar("education_visibility").default("hide_all"), // hide_all, show_level_only, show_level_and_field
  
  // Registration fields - Work (New standardized occupation system)
  occupationId: varchar("occupation_id"), // Standardized occupation ID from occupations.ts
  standardizedOccupationId: varchar("standardized_occupation_id"), // Canonical ID matched from catalog/AI (e.g., "diving_instructor")
  workMode: varchar("work_mode"), // founder, self_employed, employed, student
  workVisibility: varchar("work_visibility").default("show_industry_only"), // hide_all, show_industry_only
  
  // ❌ REMOVED DEPRECATED FIELDS (not collected in onboarding):
  // - industry: varchar (legacy field, replaced by 3-tier classification)
  // - roleTitleShort: varchar (deprecated, use occupationId)
  // - seniority: varchar (never collected, removed from matching)
  // - companyName: varchar (not collected in onboarding)
  
  // Registration fields - Culture & Language
  hometownRegionCity: varchar("hometown_region_city"),
  hometownAffinityOptin: boolean("hometown_affinity_optin").default(true),
  currentCity: varchar("current_city"), // 现居城市: 香港, 深圳, 广州, 其他
  
  // Registration fields - Deprecated/Legacy
  placeOfOrigin: varchar("place_of_origin"), // Deprecated in favor of hometown fields
  longTermBase: varchar("long_term_base"), // Deprecated - use location preferences
  wechatId: varchar("wechat_id"), // WeChat ID (legacy field)
  phoneNumber: varchar("phone_number").unique(), // Phone number for authentication (optional; has always been nullable)
  password: varchar("password"), // Hashed password for admin login
  
  // WeChat Mini Program authentication fields (added 2026-02-04)
  wechatOpenId: text("wechat_open_id").unique(), // WeChat unique identifier
  wechatSessionKey: text("wechat_session_key"), // WeChat session key for API calls
  wechatNickname: text("wechat_nickname"), // WeChat user nickname
  wechatAvatarUrl: text("wechat_avatar_url"), // WeChat user avatar URL
  
  // Registration fields - Access & Safety
  accessibilityNeeds: text("accessibility_needs"), // Optional text
  safetyNoteHost: text("safety_note_host"), // Private note to host
  
  // Default event intent (can be overridden per event) - multiple selections allowed
  intent: text("intent").array(), // Can include: networking, friends, discussion, fun, romance, flexible
  
  // Onboarding progress
  // Legacy compatibility flag only. Do not use this for new onboarding logic;
  // prefer server-calculated `nextStep` and `profileEssentialComplete`.
  hasCompletedRegistration: boolean("has_completed_registration").default(false),
  hasCompletedInterestsTopics: boolean("has_completed_interests_topics").default(false),
  hasCompletedPersonalityTest: boolean("has_completed_personality_test").default(false),
  hasSeenProfileReview: boolean("has_seen_profile_review").default(false), // Profile review page viewed, persisted server-side
  hasCompletedInterestsCarousel: boolean("has_completed_interests_carousel").default(false), // New carousel-based interest selection
  onboardingCheckpoint: varchar("onboarding_checkpoint"), // Last completed onboarding step (onboarding, personality-test, essential-data, extended-data, profile-review)
  onboardingCheckpointTimestamp: timestamp("onboarding_checkpoint_timestamp"), // When checkpoint was saved
  
  // Interests & Topics (Step 2)
  // ❌ REMOVED: Legacy interest fields - now managed by user_interests table
  // - interestsTop, primaryInterests, topicAvoidances, topicsHappy, topicsAvoid
  // ✅ Use user_interests table for all interest data (Interest Carousel system)
  interestFavorite: text("interest_favorite"), // Deprecated: Single favorite interest - use primaryInterests
  interestsRankedTop3: text("interests_ranked_top3").array(), // Deprecated: Top 3 ranked interests
  interestsDeep: text("interests_deep").array(), // 深度兴趣（AI对话收集的更详细兴趣描述，语义描述，不含遥测数据）
  interestsTelemetry: jsonb("interests_telemetry"), // 兴趣滑动遥测数据 { version: string, events: [{interestId, choice, reactionTimeMs, timestamp}] }
  
  // ========== Post-onboarding Profile Enrichment Fields (2026-03) ==========
  // Collected via Discover-page "Complete Your Profile" card after onboarding.
  // These reduce friction at event registration by saving reusable defaults.
  bio: varchar("bio", { length: 100 }), // Short one-liner / intro / tagline (enforced at 100 chars in the client)
  preferredLanguages: text("preferred_languages").array(), // Profile-level language preferences: ["中文（国语）", "英语"]
  dietaryRestrictions: text("dietary_restrictions").array(), // Dietary needs: ["素食", "不吃辣", "清真"]
  // Primary vibe enrichment: preferred table/group atmosphere
  tableVibePreference: varchar("table_vibe_preference", { length: 30 }), // Preferred table atmosphere: "light_fun" | "natural_chat" | "deep_talk"
  
  // ========== Match Compass Preference DNA Defaults ==========
  defaultPreferenceStrictness: integer("default_preference_strictness").default(50),
  defaultPreferredDistricts: text("default_preferred_districts").array(),
  defaultGenderComposition: varchar("default_gender_composition", { length: 20 }),
  defaultAcceptPairs: boolean("default_accept_pairs").default(true),
  defaultKolComfort: varchar("default_kol_comfort", { length: 20 }),
  // ========== END Match Compass Preference DNA Defaults ==========
  // ========== END Post-onboarding Profile Enrichment Fields ==========

  // Registration fields - Social & Venue Preferences (collected via AI chat)
  socialStyle: varchar("social_style"), // DEPRECATED - Not used in matching algorithm
  icebreakerRole: varchar("icebreaker_role"), // DEPRECATED - Not used in matching algorithm
  venueStylePreference: varchar("venue_style_preference"), // 场地偏好: 安静咖啡馆, 热闹酒吧, 户外活动, etc.
  cuisinePreference: text("cuisine_preference").array(), // 菜系偏好: 粤菜, 日料, 西餐, etc.
  favoriteRestaurant: varchar("favorite_restaurant"), // 宝藏餐厅推荐
  favoriteRestaurantReason: text("favorite_restaurant_reason"), // 喜欢这家餐厅的原因
  
  // ========== DEPRECATED FIELDS (2026-02-04 - Post-Test Signup Flow) ==========
  // These fields are no longer collected in onboarding
  // Kept in schema for backward compatibility but not actively used
  // See: MIGRATION_2026-02-04_SIGNUP_FLOW.md
  
  // ========== END DEPRECATED FIELDS ==========
  
  // Personality data (Step 3 - Vibe Vector)
  vibeVector: jsonb("vibe_vector"), // {energy, conversation_style, initiative, novelty, humor} scored 0-1
  archetype: varchar("archetype"), // 12个社交氛围原型: 社牛柯基, 小太阳鸡, 夸夸仓鼠, 寻宝狐, 机灵海豚, 人脉蛛, 树洞考拉, 脑洞章鱼, 好奇猫头鹰, 靠谱大象, 慢热龟, 小透明猫
  debateComfort: integer("debate_comfort"), // DEPRECATED: 1-7 scale - not collected in onboarding, kept for legacy data
  needsPersonalityRetake: boolean("needs_personality_retake").default(false), // 是否需要重新测评（系统升级后）
  
  // Legacy personality data (deprecated)
  personalityTraits: jsonb("personality_traits"),
  personalityChallenges: text("personality_challenges").array(),
  idealMatch: text("ideal_match"),
  energyLevel: integer("energy_level"),
  
  // Social role (from personality test - now mapped to archetype)
  primaryArchetype: varchar("primary_archetype"), // 12 archetypes (animal-based social vibe system)
  secondaryArchetype: varchar("secondary_archetype"), // Second highest archetype (used in algorithm, hidden from UI)
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

  // Onboarding restart counter (welcome-back feature)
  onboardingRestartCount: integer("onboarding_restart_count").notNull().default(0),
  
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
  industryNormalized: text("industry_normalized"),                          // AI清理后的标准化输入
  industrySource: varchar("industry_source", { length: 20 }),               // "seed" | "ontology" | "ai" | "manual" | "fallback"
  industryConfidence: numeric("industry_confidence", { precision: 3, scale: 2 }), // 0.00-1.00
  industryClassifiedAt: timestamp("industry_classified_at"),                // 分类时间
  industryLastVerifiedAt: timestamp("industry_last_verified_at"),           // 最后验证时间
  
  // ============ Social Tag System (社交人格印象标签系统) ============
  socialTag: text("social_tag"), // Selected social tag: "数据拓荒人·巷口密探"
  socialTagSelectedAt: timestamp("social_tag_selected_at"), // When tag was selected

  // ============ WeChat Contact ID (微信号) ============
  wechatContactId: varchar("wechat_contact_id"),        // user's WeChat ID (微信号)
  wechatContactIdSetAt: timestamp("wechat_contact_id_set_at"), // when first set, used to show prompt only once
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Interests table - Carousel-based interest selection with heat tracking
// NOTE: This table uses PostgreSQL-specific gen_random_uuid() function
// The project is PostgreSQL-only so this is acceptable
export const userInterests = pgTable("user_interests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Aggregated metrics
  totalHeat: integer("total_heat").notNull().default(0), // Sum of all heat values
  totalSelections: integer("total_selections").notNull().default(0), // Count of selected topics
  
  // Category-level heat distribution
  categoryHeat: jsonb("category_heat").notNull().default('{}'), 
  // { "career": 35, "philosophy": 28, "lifestyle": 32, "culture": 18, "city": 14 }
  
  // Individual topic selections with metadata
  selections: jsonb("selections").notNull().default('[]'),
  // [{ topicId, emoji, label, fullName, category, categoryId, level, heat }]
  
  // Top priorities (level 3 items only)
  topPriorities: jsonb("top_priorities"),
  // [{ topicId, label, heat }]
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_interests_user_id").on(table.userId),
]);

export const userSemanticProfiles = pgTable("user_semantic_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status").notNull().default("pending"), // pending | ready | degraded
  profileDocument: text("profile_document").notNull(),
  versionVector: jsonb("version_vector").notNull().default('{}'),
  generatorVersion: varchar("generator_version").notNull().default("semantic-profile-v1"),
  embedding: jsonb("embedding"),
  embeddingModel: varchar("embedding_model"),
  embeddingDimension: integer("embedding_dimension"),
  lastError: text("last_error"),
  lastComputedAt: timestamp("last_computed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_user_semantic_profiles_user").on(table.userId),
  index("idx_user_semantic_profiles_status").on(table.status),
]);

// User Social Tag Generations table - Tag generation history and selections
export const userSocialTagGenerations = pgTable("user_social_tag_generations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Generated tags stored as JSONB array
  // [{ descriptor, archetypeNickname, fullTag, reasoning }, ...]
  tags: jsonb("tags").notNull(),
  
  // Metadata
  generationVersion: text("generation_version").default("v1.0"),
  generatedAt: timestamp("generated_at").defaultNow(),
  
  // User selection tracking
  selectedIndex: integer("selected_index"),
  selectedTag: text("selected_tag"),
  selectedAt: timestamp("selected_at"),
  
  // Context used for generation (for debugging/improvement)
  // { archetype, profession: { occupationId, industry }, hobbies: [{ name, heat }] }
  generationContext: jsonb("generation_context"),
}, (table) => [
  index("idx_social_tags_user").on(table.userId),
  index("idx_social_tags_selected").on(table.selectedAt),
  unique("unique_user_latest_tag").on(table.userId),
]);

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
  eventId: varchar("event_id").references(() => events.id), // nullable: required for legacy events, omitted for blind-box events
  blindBoxEventId: varchar("blind_box_event_id"), // blind_box_events.id (no FK constraint, mirrors icebreaker_sessions pattern)
  userId: varchar("user_id").notNull().references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow(),
  status: varchar("status").default("confirmed"), // confirmed, cancelled, attended
  intent: text("intent").array(), // Event-specific intent: networking, friends, discussion, fun, romance, flexible
  attendanceStatus: varchar("attendance_status").default("pending"), // pending | confirmed | late | absent
  estimatedLateMinutes: integer("estimated_late_minutes"), // 10 | 20 | 30
  absentReason: varchar("absent_reason"), // '突发事情' | '身体不适' | '其他'
  attendanceStatusUpdatedAt: timestamp("attendance_status_updated_at"),
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
  seniorityRestrictions: text("seniority_restrictions").array(), // DEPRECATED - seniority field no longer collected from users
  educationLevelRestrictions: text("education_level_restrictions").array(), // 学历限制
  ageRangeMin: integer("age_range_min"), // 最小年龄
  ageRangeMax: integer("age_range_max"), // 最大年龄
  budgetRestrictions: text("budget_restrictions").array(), // 饭局预算限制（硬约束）
  barBudgetRestrictions: text("bar_budget_restrictions").array(), // 酒局预算限制（硬约束）
  
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
  predictiveRerankEnabledOverride: boolean("predictive_rerank_enabled_override"),
  
  // 价格（单位：元，null = 免费/未定价）
  price: integer("price"), // null = 免费报名
  
  // 元数据
  createdBy: varchar("created_by").notNull().references(() => users.id), // Admin用户ID
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  matchedAt: timestamp("matched_at"), // 匹配完成时间
  preferenceLockAt: timestamp("preference_lock_at"), // 偏好编辑锁定时间（24小时前）
}, (table) => [
  // Composite index for Discover shell query: status + deadline filter, dateTime sort, id pagination
  index("idx_event_pools_status_deadline_datetime").on(
    table.status, table.registrationDeadline, table.dateTime, table.id
  ),
]);

// Event Pool Registrations table - 用户报名记录 + 个性化偏好（软约束）
export const eventPoolRegistrations = pgTable("event_pool_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 关联
  poolId: varchar("pool_id").notNull().references(() => eventPools.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // 用户临时偏好（软约束 - 仅用于本次活动）
  budgetRange: text("budget_range").array(), // 饭局预算范围，多选：["150以下", "150-200", "200-300", "300-500"]
  preferredLanguages: text("preferred_languages").array(), // 首选语言：["普通话", "粤语", "英语"]
  eventIntent: text("event_intent").array(), // 本次活动社交目的：["交朋友", "扩展人脉", "放松心情", "行业交流", "flexible"]
  cuisinePreferences: text("cuisine_preferences").array(), // 饮食偏好：["中餐", "川菜", "粤菜", "日料", "西餐"]
  dietaryRestrictions: text("dietary_restrictions").array(), // 忌口：["素食", "不吃辣", "清真"]
  tasteIntensity: text("taste_intensity").array(), // 口味强度：["爱吃辣", "不辣/清淡为主"]
  decorStylePreferences: text("decor_style_preferences").array(), // 场地风格偏好：["轻奢现代风", "绿植花园风", "复古工业风", "温馨日式风"]
  
  // 酒局特有偏好
  barThemes: text("bar_themes").array(), // 酒吧主题偏好：["精酿", "清吧", "私密调酒·Homebar"]
  alcoholComfort: text("alcohol_comfort").array(), // 饮酒舒适度：["可以喝酒", "微醺就好", "无酒精饮品"]
  barBudgetRange: text("bar_budget_range").array(), // 酒局预算范围（每杯）：["80以下", "80-150"]
  
  // Match Compass per-event preferences
  preferenceStrictness: integer("preference_strictness").default(50),
  preferredDistricts: text("preferred_districts").array(),
  genderCompositionPreference: varchar("gender_composition_preference", { length: 20 }),
  acceptPairs: boolean("accept_pairs"),
  kolComfortLevel: varchar("kol_comfort_level", { length: 20 }),
  
  // 匹配结果
  matchStatus: varchar("match_status").default("pending"), // pending | matched | unmatched
  assignedGroupId: varchar("assigned_group_id"), // 分配到的组ID（如果匹配成功）
  matchScore: integer("match_score"), // 匹配分数
  
  // 元数据
  registeredAt: timestamp("registered_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // NOTE: DB-level uniqueness for (pool_id, user_id). If this constraint is being
  // added to an existing database where the table might already contain data, you
  // MUST check for and resolve duplicates before running `npm run db:push`, or the
  // constraint creation will fail. Example check query:
  //
  //   SELECT pool_id, user_id, COUNT(*) AS duplicate_count
  //   FROM event_pool_registrations
  //   GROUP BY pool_id, user_id
  //   HAVING COUNT(*) > 1;
  //
  // Any rows returned by the query above should be deduplicated (delete/merge) in a
  // one-off manual migration before deploying this constraint to production.
  unique("event_pool_registrations_pool_user_unique").on(table.poolId, table.userId),
  // Indexes for Discover shell composite query
  index("idx_event_pool_registrations_pool_id").on(table.poolId),
  index("idx_event_pool_registrations_user_id").on(table.userId),
  index("idx_event_pool_registrations_pool_registered_at").on(table.poolId, table.registeredAt),
]);

// Event Pool Groups table - 匹配成功的小组
export const eventPoolGroups = pgTable("event_pool_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  poolId: varchar("pool_id").notNull().references(() => eventPools.id),
  groupNumber: integer("group_number").notNull(), // 组号（同一活动池内）
  
  // 组信息
  memberCount: integer("member_count").default(0),
  avgChemistryScore: integer("avg_chemistry_score"), // 平均化学反应分数
  diversityScore: integer("diversity_score"), // 多样性分数
  communicationBalance: integer("energy_balance"), // 沟通平衡分数（原energy_balance列，现用于存储语言沟通兼容性分数）
  genderBalanceScore: integer("gender_balance_score"), // 性别平衡分数（0-100）
  overallScore: integer("overall_score"), // 综合分数
  temperatureLevel: varchar("temperature_level"), // 化学反应温度等级: fire | warm | mild | cold
  matchExplanation: text("match_explanation"), // AI生成的匹配解释
  pairExplanationsCache: jsonb("pair_explanations_cache"), // 缓存的配对解释: [{pairKey, explanation, chemistryScore, sharedInterests, connectionPoints, generatedAt}]
  iceBreakersCache: jsonb("ice_breakers_cache"), // 缓存的破冰话题: {topics: string[], generatedAt: string}
  predictiveExperimentArm: varchar("predictive_experiment_arm", { length: 20 }),
  predictiveModelVersion: varchar("predictive_model_version", { length: 50 }),
  predictiveRerankApplied: boolean("predictive_rerank_applied").default(false),
  predictiveRerankAudit: jsonb("predictive_rerank_audit"),
  
  // Event Theme (Mystery Box 盲盒主题)
  theme: varchar("theme", { length: 50 }), // Main theme (12-18 chars): "高能充电站：柯基×狐狸的周末探险"
  subtitle: varchar("subtitle", { length: 80 }), // Subtitle (15-25 chars): "广州老乡的咖啡×人脉派对"
  vibe: varchar("vibe", { length: 30 }), // Vibe: "🔥 超高能 (88分)"
  themeEmoji: varchar("theme_emoji", { length: 10 }), // Single emoji: "⚡"
  themeHighlights: jsonb("theme_highlights").$type<string[]>().notNull().default([]), // Persisted reveal highlights
  themeReasoning: text("theme_reasoning"), // Full reasoning with data provenance
  themeGeneratedAt: timestamp("theme_generated_at"), // Theme generation timestamp
  
  // 活动详情（匹配后生成）
  venueId: varchar("venue_id").references(() => venues.id),
  venueName: varchar("venue_name"),
  venueAddress: text("venue_address"),
  finalDateTime: timestamp("final_date_time"),
  
  // Venue assignment tracking
  venueAssignmentStatus: varchar("venue_assignment_status").default("pending"), // pending | assigned | unassigned | manual_override
  venueAssignmentReason: text("venue_assignment_reason"), // Why unassigned (e.g., "no_budget_overlap", "no_available_slots", "capacity_insufficient")
  
  // 状态
  status: varchar("status").default("confirmed"), // confirmed | completed | cancelled
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_event_pool_groups_pool").on(table.poolId),
  index("idx_event_pool_groups_venue_status").on(table.venueAssignmentStatus),
]);

export const eventGroupOutcomes = pgTable("event_group_outcomes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poolId: varchar("pool_id").notNull().references(() => eventPools.id),
  groupId: varchar("group_id").notNull().references(() => eventPoolGroups.id),
  submittedBy: varchar("submitted_by").notNull().references(() => users.id),
  atmosphereScore: integer("atmosphere_score").notNull(),
  wouldMeetAgain: boolean("would_meet_again").notNull(),
  connectionRadar: jsonb("connection_radar").notNull(),
  icebreakerRatings: jsonb("icebreaker_ratings").notNull(),
  freeTextSignal: text("free_text_signal"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_event_group_outcomes_pool_id").on(table.poolId),
  index("idx_event_group_outcomes_group_id").on(table.groupId),
  index("idx_event_group_outcomes_submitted_by").on(table.submittedBy),
  uniqueIndex("idx_event_group_outcomes_group_submitter").on(table.groupId, table.submittedBy),
]);

// Event Pool AI Copy Cache - 活动池卡片AI文案缓存
export const poolAICopy = pgTable("pool_ai_copy", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  poolId: varchar("pool_id").notNull().references(() => eventPools.id),
  segmentHash: varchar("segment_hash").notNull(), // hash(user_archetype + top_3_interests)
  
  headline: text("headline"),
  subheadline: text("subheadline"),
  displayStatus: varchar("display_status").default("shadow"), // shadow | live | fallback
  
  generatedAt: timestamp("generated_at").defaultNow(),
  provider: varchar("provider"), // e.g. 'deepseek', 'minimax'
  fallbackUsed: boolean("fallback_used").default(false),
  promptVersion: varchar("prompt_version").default("discover-card-v1"),
  expiresAt: timestamp("expires_at"),
}, (table) => [
  index("idx_pool_ai_copy_pool_id").on(table.poolId),
  index("idx_pool_ai_copy_expires_at").on(table.expiresAt),
  uniqueIndex("idx_pool_ai_copy_pool_segment").on(table.poolId, table.segmentHash),
]);

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

  // Predictive rerank experiment controls
  predictiveRerankEnabled: boolean("predictive_rerank_enabled").default(false),
  predictiveRerankExposurePercent: integer("predictive_rerank_exposure_percent").default(50),
  predictiveRerankMaxPositionShift: integer("predictive_rerank_max_position_shift").default(2),
  predictiveRerankConfidenceThreshold: integer("predictive_rerank_confidence_threshold").default(70),
  predictiveRerankAutoDisableEnabled: boolean("predictive_rerank_auto_disable_enabled").default(true),
  predictiveRerankMinShadowExperiments: integer("predictive_rerank_min_shadow_experiments").default(10),
  predictiveRerankAutoDisabledAt: timestamp("predictive_rerank_auto_disabled_at"),
  predictiveRerankAutoDisabledReason: text("predictive_rerank_auto_disabled_reason"),
  
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
  predictiveExperimentArm: varchar("predictive_experiment_arm", { length: 20 }),
  predictiveRerankApplied: boolean("predictive_rerank_applied").default(false),
  predictiveRerankSummary: jsonb("predictive_rerank_summary"),
  
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

// Empirical chemistry calibration stats aggregated from post-event pair outcomes.
export const archetypePairFeedbackStats = pgTable("archetype_pair_feedback_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  archetypeA: varchar("archetype_a", { length: 50 }).notNull(),
  archetypeB: varchar("archetype_b", { length: 50 }).notNull(),
  baseScore: integer("base_score").notNull(),
  sampleCount: integer("sample_count").notNull().default(0),
  avgMeetAgain: numeric("avg_meet_again", { precision: 4, scale: 3 }),
  avgAtmosphere: numeric("avg_atmosphere", { precision: 4, scale: 3 }),
  empiricalScore: numeric("empirical_score", { precision: 5, scale: 2 }),
  appliedDelta: numeric("applied_delta", { precision: 5, scale: 2 }).notNull().default("0"),
  calibratedScore: numeric("calibrated_score", { precision: 5, scale: 2 }).notNull(),
  lastAggregatedAt: timestamp("last_aggregated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_archetype_pair_feedback_stats_pair").on(table.archetypeA, table.archetypeB),
  index("idx_archetype_pair_feedback_stats_samples").on(table.sampleCount),
]);

// Chat messages table (for event group chats)
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id),
  userId: varchar("user_id").notNull().references(() => users.id),
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

// Connections table - WeChat ID exchange after mutual post-event selection
// userAId < userBId alphabetically for dedup
export const connections = pgTable("connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id),
  userAId: varchar("user_a_id").notNull().references(() => users.id),
  userBId: varchar("user_b_id").notNull().references(() => users.id),
  status: varchar("status").notNull().default("pending"), // "pending" | "mutual"
  initiatorId: varchar("initiator_id").notNull().references(() => users.id), // who first selected
  userAWechatId: varchar("user_a_wechat_id"),   // snapshot at reveal time
  userBWechatId: varchar("user_b_wechat_id"),   // snapshot at reveal time
  revealedAt: timestamp("revealed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  // Optional enrichment: per-user lightweight connection feedback.
  // Each user stores their own reasons and next-step preference independently
  // in dedicated A/B columns; neither user sees the other's feedback.
  userAConnectionReasons: text("user_a_connection_reasons").array(), // structured reasons from userA
  userANextStepPreference: varchar("user_a_next_step_preference"),   // how userA wants to continue
  userBConnectionReasons: text("user_b_connection_reasons").array(), // structured reasons from userB
  userBNextStepPreference: varchar("user_b_next_step_preference"),   // how userB wants to continue
}, (table) => [
  unique("connections_event_pair_unique").on(table.eventId, table.userAId, table.userBId),
]);

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
  currentCity: true,
  educationLevel: true,
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
  standardizedOccupationId: true,
  workMode: true,
  hometownRegionCity: true,
  intent: true,
  // ❌ REMOVED DEPRECATED FIELDS:
  // - industry: true (legacy field, replaced by 3-tier classification)
  // - roleTitleShort: true (deprecated, use occupationId)
  // - seniority: true (never collected, removed from matching)
  // - companyName: true (not collected in onboarding)
  // Removed: interestsTop, primaryInterests, topicsHappy, topicsAvoid, topicAvoidances
  // These fields were removed from users table - now managed by user_interests table
  interestsDeep: true,
  interestsTelemetry: true,
  cuisinePreference: true,
  socialStyle: true,
  icebreakerRole: true,
  workVisibility: true,
  wechatContactId: true,
  // Post-onboarding enrichment fields
  bio: true,
  preferredLanguages: true,
  dietaryRestrictions: true,
  tableVibePreference: true,
  hometownAffinityOptin: true,
}).partial().extend({
  industryConfidence: z.union([z.string(), z.number()]).optional(),
});

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

const eventGroupOutcomeConnectionRadarSchema = z
  .record(z.string().min(1), z.number().int().min(0).max(5))
  .refine((value) => Object.keys(value).length > 0, {
    message: "connectionRadar must include at least one rating",
  });

const eventGroupOutcomeIcebreakerRatingsSchema = z
  .record(z.string().min(1), z.enum(["helpful", "neutral", "awkward"]))
  .refine((value) => Object.keys(value).length > 0, {
    message: "icebreakerRatings must include at least one rating",
  });

export const insertEventGroupOutcomeSchema = createInsertSchema(eventGroupOutcomes).omit({
  id: true,
  poolId: true,
  submittedBy: true,
  submittedAt: true,
  updatedAt: true,
}).extend({
  groupId: z.string().min(1),
  atmosphereScore: z.number().int().min(1).max(5),
  wouldMeetAgain: z.boolean(),
  connectionRadar: eventGroupOutcomeConnectionRadarSchema,
  icebreakerRatings: eventGroupOutcomeIcebreakerRatingsSchema,
  freeTextSignal: z.string().trim().max(1000).optional().nullable(),
});

export const icebreakerAiFeedbackRatingSchema = z.enum(['helpful', 'neutral', 'awkward']);

export const submitSocialIcebreakerAiFeedbackSchema = z.object({
  phase: z.string().min(1),
  promptVersion: z.string().min(1),
  aiCorrelationId: z.string().uuid(),
  rating: icebreakerAiFeedbackRatingSchema,
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
  primaryArchetype: varchar("primary_archetype").notNull(), // Highest scoring archetype
  primaryArchetypeScore: integer("primary_archetype_score").notNull(),
  secondaryArchetype: varchar("secondary_archetype"), // Second highest archetype (used in algorithm, hidden from UI)
  secondaryArchetypeScore: integer("secondary_archetype_score"),
  roleSubtype: varchar("role_subtype"), // Subtype based on answer patterns
  
  // Role score breakdown
  roleScores: jsonb("role_scores").notNull(), // {社牛柯基: 18, 小太阳鸡: 15, 树洞考拉: 12, ...}
  
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
  
  // Education - All required for matching algorithm
  educationLevel: z.enum(EDUCATION_LEVEL_OPTIONS, {
    errorMap: () => ({ message: "请选择教育水平" }),
  }),
  
  // Work - New standardized occupation system
  occupationId: z.string().optional(),
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
  hometownRegionCity: z.string().min(1, "请选择家乡"),
  hometownAffinityOptin: z.boolean().optional().default(true), // 同乡亲和力
  currentCity: z.string().min(1, "请选择现居城市"),
  
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

// Archetype ID validation (12 canonical machine IDs)
export const archetypeIdSchema = z.enum([
  'corgi', 'rooster', 'hamster_praise', 'fox', 'dolphin_calm',
  'spider', 'koala', 'octopus', 'owl', 'elephant', 'turtle', 'cat'
]);

// Role result schema
export const insertRoleResultSchema = createInsertSchema(roleResults).omit({
  id: true,
  createdAt: true,
}).extend({
  primaryArchetype: archetypeIdSchema,
  secondaryArchetype: archetypeIdSchema.optional().nullable(),
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
  budgetCategories: text("budget_categories").array(), // Standardized budget ranges: ["150以下","150-200","200-300","300-500"] for restaurants, ["80以下","80-150"] for bars
  decorStyle: text("decor_style").array(), // 装修风格: 轻奢现代风, 绿植花园风, 复古工业风, 温馨日式风
  tasteIntensity: text("taste_intensity").array(), // 口味偏好支持: 爱吃辣, 不辣/清淡为主
  
  // 酒吧特有标签 (仅当 venueType='bar' 时使用)
  barThemes: text("bar_themes").array(), // 酒吧主题: 精酿, 清吧, 私密调酒·Homebar
  alcoholOptions: text("alcohol_options").array(), // 支持的饮酒选项: 可以喝酒, 微醺就好, 无酒精饮品
  barPriceRange: text("bar_price_range"), // 酒吧价格档次（每杯）: "80以下", "80-150"
  vibeDescriptor: text("vibe_descriptor"), // 氛围描述（编辑性文字，非结构化标签）
  
  // Capacity management
  capacity: integer("capacity").default(1), // How many events can run at same time (concurrent events)
  seatingCapacity: integer("seating_capacity").default(1), // Max people the venue can seat per event
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
  
  // 合作伙伴入驻流程
  onboardingStatus: text("onboarding_status").default("active"), // draft, pending_review, active, suspended
  partnerCompanyName: text("partner_company_name"),
  businessLicenseNo: text("business_license_no"),
  partnerEmail: text("partner_email"),
  bankAccountInfo: text("bank_account_info"),
  contractStartDate: date("contract_start_date"),
  contractEndDate: date("contract_end_date"),
  
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
  customPrice: integer("custom_price"), // null = use default pricing (权益用户免费/标准价¥68)
  
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
  paymentType: varchar("payment_type").notNull(), // "subscription", "event", "event_bundle"
  relatedId: varchar("related_id"), // subscription ID or event ID
  
  // Amount
  originalAmount: integer("original_amount").notNull(), // Before discount
  discountAmount: integer("discount_amount").default(0),
  finalAmount: integer("final_amount").notNull(), // After discount
  
  // Coupon
  couponId: varchar("coupon_id"), // null if no coupon used

  // Event payment fulfillment context
  eventRegistrationPayload: jsonb("event_registration_payload"),
  
  // WeChat Pay details
  wechatTransactionId: varchar("wechat_transaction_id"), // WeChat Pay transaction ID
  wechatOrderId: varchar("wechat_order_id"), // Our order ID sent to WeChat
  wechatPrepayId: varchar("wechat_prepay_id"), // WeChat JSAPI/H5 prepay ID
  
  // Status
  status: varchar("status").notNull().default("pending"), // pending, completed, failed, refunded
  paidAt: timestamp("paid_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Refund attempts - Track every refund initiation for audit and status monitoring
export const refundAttempts = pgTable("refund_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentId: varchar("payment_id").notNull().references(() => payments.id),
  status: varchar("status").notNull().default("pending"), // pending, success, failed
  reason: text("reason"),
  wechatRefundId: varchar("wechat_refund_id"), // out_refund_no sent to WeChat Pay
  amount: integer("amount").notNull(),
  initiatedBy: varchar("initiated_by"), // admin account ID
  initiatedAt: timestamp("initiated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  failureReason: text("failure_reason"),
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

export const eventCreditGrants = pgTable("event_credit_grants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  paymentId: varchar("payment_id").notNull().references(() => payments.id),
  planType: varchar("plan_type").notNull(),
  grantedCredits: integer("granted_credits").notNull(),
  remainingCredits: integer("remaining_credits").notNull(),
  expiresAt: timestamp("expires_at"),
  refundedAt: timestamp("refunded_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_event_credit_grants_payment_id").on(table.paymentId),
  index("idx_event_credit_grants_user_expiry").on(table.userId, table.expiresAt),
]);

export const eventCreditRedemptions = pgTable("event_credit_redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  grantId: varchar("grant_id").notNull().references(() => eventCreditGrants.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  poolId: varchar("pool_id").notNull().references(() => eventPools.id),
  registrationId: varchar("registration_id").notNull().references(() => eventPoolRegistrations.id),
  creditsUsed: integer("credits_used").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_event_credit_redemptions_registration_id").on(table.registrationId),
  index("idx_event_credit_redemptions_user_pool").on(table.userId, table.poolId),
]);

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
export type UserInterests = typeof userInterests.$inferSelect;

export type UserSocialTagGeneration = typeof userSocialTagGenerations.$inferSelect;

export type Event = typeof events.$inferSelect;
export type EventAttendance = typeof eventAttendance.$inferSelect;
export type EventPool = typeof eventPools.$inferSelect;
export type EventPoolRegistration = typeof eventPoolRegistrations.$inferSelect;
export type EventPoolGroup = typeof eventPoolGroups.$inferSelect;
export type EventGroupOutcome = typeof eventGroupOutcomes.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type EventFeedback = typeof eventFeedback.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type BlindBoxEvent = typeof blindBoxEvents.$inferSelect;
export type PersonalityQuestion = typeof personalityQuestions.$inferSelect;
export type TestResponse = typeof testResponses.$inferSelect;
export type RoleResult = typeof roleResults.$inferSelect;

export type InsertEventAttendance = z.infer<typeof insertEventAttendanceSchema>;
export type InsertEventPool = z.infer<typeof insertEventPoolSchema>;
export type InsertEventPoolRegistration = z.infer<typeof insertEventPoolRegistrationSchema>;
export type InsertEventPoolGroup = z.infer<typeof insertEventPoolGroupSchema>;
export type InsertEventGroupOutcome = z.infer<typeof insertEventGroupOutcomeSchema>;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
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

export const runPlanTemplates = pgTable("run_plan_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vibe: varchar("vibe").notNull(),
  tier: varchar("tier").notNull(),
  playerCountMin: integer("player_count_min").notNull().default(2),
  playerCountMax: integer("player_count_max").notNull().default(12),
  slots: jsonb("slots").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_run_plan_templates_vibe_tier").on(table.vibe, table.tier),
]);

export type RunPlanTemplateRow = typeof runPlanTemplates.$inferSelect;

export const featureFlags = pgTable("feature_flags", {
  key: varchar("key").primaryKey(),
  value: text("value").notNull().default("false"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by"),
});

export type FeatureFlag = typeof featureFlags.$inferSelect;

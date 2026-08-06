import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  varchar,
  timestamp,
  boolean,
  integer,
  date,
  real,
  numeric,
  uniqueIndex,
  unique,
  serial,
  text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  users,
  events,
  venues,
  blindBoxEvents,
  eventPools,
  eventPoolGroups,
  eventPoolRegistrations,
  personalityQuestions,
  chatMessages,
  invitations,
  invitationUses,
  eventCreditGrants,
  eventCreditRedemptions,
  userSemanticProfiles,
  archetypeIdSchema,
  insertMatchingResultSchema,
} from "./_definitions.js";

export type InsertMatchingResult = z.infer<typeof insertMatchingResultSchema>;

export type MatchingShadowComparison = {
  groupKey: string;
  memberUserIds: string[];
  memberCount: number;
  deterministicScore: number;
  deterministicRank: number;
  predictedScore: number;
  predictedRank: number;
  scoreDelta: number;
  rankDelta: number;
  confidence: number;
  predictedOutcomeRate: number;
  avgChemistryScore: number;
  diversityScore: number;
  communicationBalance: number;
  temperatureLevel: string;
};

export type MatchingShadowSummary = {
  modelVersion: string;
  liveRankingProtected: boolean;
  deterministicGroupCount: number;
  deterministicAverageScore: number;
  averageConfidence: number;
  averageScoreDelta: number;
  rankAgreementRate: number;
  topRankChanged: boolean;
  outcomeValidation: {
    sampleCount: number;
    positiveRate: number;
    avgAtmosphereScore: number | null;
  };
};

export const matchingShadowExperiments = pgTable("matching_shadow_experiments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poolId: varchar("pool_id").notNull().references(() => eventPools.id),
  mode: varchar("mode").notNull().default("batch"),
  modelVersion: varchar("model_version").notNull(),
  deterministicGroupCount: integer("deterministic_group_count").notNull().default(0),
  deterministicAverageScore: integer("deterministic_average_score"),
  outcomeSampleCount: integer("outcome_sample_count").notNull().default(0),
  outcomePositiveRate: numeric("outcome_positive_rate", { precision: 5, scale: 4 }).default("0"),
  averageConfidence: numeric("average_confidence", { precision: 5, scale: 4 }).default("0"),
  rankAgreementRate: numeric("rank_agreement_rate", { precision: 5, scale: 4 }).default("0"),
  averageScoreDelta: integer("average_score_delta").default(0),
  results: jsonb("results").notNull().$type<MatchingShadowComparison[]>(),
  summary: jsonb("summary").notNull().$type<MatchingShadowSummary>(),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_matching_shadow_experiments_pool").on(table.poolId),
  index("idx_matching_shadow_experiments_created_at").on(table.createdAt),
]);

export const insertMatchingShadowExperimentSchema = createInsertSchema(matchingShadowExperiments).omit({
  id: true,
  createdAt: true,
});

export type MatchingShadowExperiment = typeof matchingShadowExperiments.$inferSelect;
export type InsertMatchingShadowExperiment = z.infer<typeof insertMatchingShadowExperimentSchema>;

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
  threadId: varchar("thread_id"), // Legacy: was FK to direct_message_threads (dropped)
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
  threadId: varchar("thread_id"), // Legacy: was FK to direct_message_threads (dropped)
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
  planType: varchar("plan_type").notNull().unique(), // "monthly", "quarterly", "event_single", "pack_3", "pack_6"
  
  // 显示信息
  displayName: varchar("display_name").notNull(), // "悦聚月卡", "悦聚季卡", "单场局票"
  displayNameEn: varchar("display_name_en"), // "YueJu Monthly", "YueJu Quarterly", "Single Pass"
  description: text("description"), // 套餐描述
  
  // 价格（单位：分）
  priceInCents: integer("price_in_cents").notNull(), // ¥98 = 9800
  originalPriceInCents: integer("original_price_in_cents"), // 原价，用于显示划线价
  
  // 有效期（天数，订阅与连局包套餐）
  durationDays: integer("duration_days"), // 30, 90 (monthly/quarterly/packs), null for single events
  
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
export type EventCreditGrant = typeof eventCreditGrants.$inferSelect;
export type InsertEventCreditGrant = typeof eventCreditGrants.$inferInsert;
export type EventCreditRedemption = typeof eventCreditRedemptions.$inferSelect;
export type InsertEventCreditRedemption = typeof eventCreditRedemptions.$inferInsert;

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
}, (table) => [
  index("idx_venue_time_slots_lookup").on(table.venueId, table.dayOfWeek, table.isActive, table.startTime, table.endTime),
  index("idx_venue_time_slots_specific").on(table.venueId, table.specificDate, table.isActive, table.startTime, table.endTime),
]);

// Venue Time Slot Bookings table - 时间段预订记录（用于追踪已占用容量）
export const venueTimeSlotBookings = pgTable("venue_time_slot_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 关联
  venueId: varchar("venue_id").notNull().references(() => venues.id),
  timeSlotId: varchar("time_slot_id").notNull().references(() => venueTimeSlots.id),
  eventPoolId: varchar("event_pool_id").references(() => eventPools.id), // 关联的活动池
  eventGroupId: varchar("event_group_id").references(() => eventPoolGroups.id), // 关联的具体小组
  
  // 预订日期（对于每周固定时间段，需要记录具体预订的是哪一天）
  bookingDate: date("booking_date").notNull(),
  
  // 状态
  status: varchar("status").default("confirmed"), // confirmed | cancelled | completed
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_vtsb_slot_date_status").on(table.timeSlotId, table.bookingDate, table.status),
  index("idx_vtsb_group_status").on(table.eventGroupId, table.status),
  index("idx_vtsb_venue_date").on(table.venueId, table.bookingDate, table.status),
]);

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
// Legacy telemetry table retained for historical reporting only; do not use in new product flows.
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
// Vocabulary aligned with active poolMatchingService.ts pair-score dimensions.
export const matchingWeightsConfig = pgTable("matching_weights_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // 配置标识
  configName: varchar("config_name").notNull().unique(), // 'default', 'experiment_a', 'experiment_b'
  isActive: boolean("is_active").default(false), // 当前是否生效
  
  // 6维权重 — active-flow vocabulary (Thompson Sampling参数)
  chemistryWeight: numeric("chemistry_weight", { precision: 5, scale: 4 }).default("0.28"), // 性格化学反应 28%
  interestWeight: numeric("interest_weight", { precision: 5, scale: 4 }).default("0.28"), // 兴趣重叠度 28%
  socialAffinityWeight: numeric("social_affinity_weight", { precision: 5, scale: 4 }).default("0.20"), // 社交同频度 20%
  backgroundDiversityWeight: numeric("background_diversity_weight", { precision: 5, scale: 4 }).default("0.15"), // 背景多样性 15%
  preferenceWeight: numeric("preference_weight", { precision: 5, scale: 4 }).default("0.05"), // 活动偏好 5%
  languageWeight: numeric("language_weight", { precision: 5, scale: 4 }).default("0.04"), // 语言沟通 4%
  
  // Thompson Sampling 统计 (Beta分布参数) — active-flow vocabulary
  chemistryAlpha: integer("chemistry_alpha").default(1),
  chemistryBeta: integer("chemistry_beta").default(1),
  interestAlpha: integer("interest_alpha").default(1),
  interestBeta: integer("interest_beta").default(1),
  socialAffinityAlpha: integer("social_affinity_alpha").default(1),
  socialAffinityBeta: integer("social_affinity_beta").default(1),
  backgroundDiversityAlpha: integer("background_diversity_alpha").default(1),
  backgroundDiversityBeta: integer("background_diversity_beta").default(1),
  preferenceAlpha: integer("preference_alpha").default(1),
  preferenceBeta: integer("preference_beta").default(1),
  languageAlpha: integer("language_alpha").default(1),
  languageBeta: integer("language_beta").default(1),
  
  // 累计统计
  totalMatches: integer("total_matches").default(0),
  successfulMatches: integer("successful_matches").default(0), // 满意度>=4的匹配
  averageSatisfaction: numeric("average_satisfaction", { precision: 5, scale: 4 }).default("0"),
  
  // 时间戳
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 权重变化历史 - Weight Change History for visualization
// Vocabulary aligned with active poolMatchingService.ts pair-score dimensions.
export const matchingWeightsHistory = pgTable("matching_weights_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  configId: varchar("config_id").notNull().references(() => matchingWeightsConfig.id),
  
  // 快照时间点的权重 — active-flow vocabulary
  chemistryWeight: numeric("chemistry_weight", { precision: 5, scale: 4 }),
  interestWeight: numeric("interest_weight", { precision: 5, scale: 4 }),
  socialAffinityWeight: numeric("social_affinity_weight", { precision: 5, scale: 4 }),
  backgroundDiversityWeight: numeric("background_diversity_weight", { precision: 5, scale: 4 }),
  preferenceWeight: numeric("preference_weight", { precision: 5, scale: 4 }),
  languageWeight: numeric("language_weight", { precision: 5, scale: 4 }),
  
  // 触发变更的原因
  changeReason: varchar("change_reason"), // 'scheduled_update', 'manual_adjustment', 'bandit_exploration'
  
  // 当时的统计
  matchesSinceLastUpdate: integer("matches_since_last_update").default(0),
  satisfactionSinceLastUpdate: numeric("satisfaction_since_last_update", { precision: 5, scale: 4 }),
  shadowMetadata: jsonb("shadow_metadata"),

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

export const insertUserSemanticProfileSchema = createInsertSchema(userSemanticProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

export type UserSemanticProfile = typeof userSemanticProfiles.$inferSelect;
export type InsertUserSemanticProfile = z.infer<typeof insertUserSemanticProfileSchema>;

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
  unique("assessment_answer_session_question_unique").on(table.sessionId, table.questionId),
]);

export const insertAssessmentSessionSchema = createInsertSchema(assessmentSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  primaryArchetype: archetypeIdSchema.optional().nullable(),
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

// ============================================
// Onboarding Analytics
// ============================================

export const onboardingAnalytics = pgTable("onboarding_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  sessionId: varchar("session_id"), // Unique session ID for grouping events
  
  // Event details
  step: varchar("step").notNull(), // onboarding, personality-test, essential-data, etc.
  eventType: varchar("event_type").notNull(), // step_started, step_completed, step_abandoned, validation_failed, error_occurred
  
  // Timing
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  sessionDuration: integer("session_duration"), // Total time in session (ms)
  stepDuration: integer("step_duration"), // Time spent on this step (ms)
  
  // Metadata
  metadata: jsonb("metadata"), // Additional event data (field, reason, error, etc.)
  userAgent: varchar("user_agent"),
  screenSize: varchar("screen_size"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_onboarding_analytics_user_id").on(table.userId),
  index("idx_onboarding_analytics_session_id").on(table.sessionId),
  index("idx_onboarding_analytics_step").on(table.step),
  index("idx_onboarding_analytics_event_type").on(table.eventType),
  index("idx_onboarding_analytics_timestamp").on(table.timestamp),
]);

export const insertOnboardingAnalyticsSchema = createInsertSchema(onboardingAnalytics).omit({
  id: true,
  createdAt: true,
});

export type OnboardingAnalytics = typeof onboardingAnalytics.$inferSelect;
export type InsertOnboardingAnalytics = z.infer<typeof insertOnboardingAnalyticsSchema>;

// ================================
// Wave 2 Participation Experiment Analytics
// ================================

/**
 * Stores individual interaction events emitted by the Wave 2 experiment
 * components (atmosphere framing, social-goal reframing, ignition confirmation,
 * archetype waiting). Used for post-experiment funnel analysis.
 *
 * See: archived/workspaces/user-client/src/lib/participationExperimentAnalytics.ts
 */
export const participationExperimentEvents = pgTable("participation_experiment_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: varchar("session_id"),
  eventType: varchar("event_type", { length: 80 }).notNull(),
  poolId: varchar("pool_id"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pex_user_id").on(table.userId),
  index("idx_pex_event_type").on(table.eventType),
  index("idx_pex_pool_id").on(table.poolId),
  index("idx_pex_timestamp").on(table.timestamp),
]);

export type ParticipationExperimentEvent = typeof participationExperimentEvents.$inferSelect;

// ================================
// Discover Analytics (Oracle Card conversion funnel)
// ================================

export const discoverAnalyticsEvents = pgTable("discover_analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: varchar("session_id"),
  eventType: varchar("event_type", { length: 80 }).notNull(),
  poolId: varchar("pool_id"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_dae_user_id").on(table.userId),
  index("idx_dae_event_type").on(table.eventType),
  index("idx_dae_pool_id").on(table.poolId),
  index("idx_dae_timestamp").on(table.timestamp),
]);

export type DiscoverAnalyticsEvent = typeof discoverAnalyticsEvents.$inferSelect;

// ================================
// Payment Ritual Analytics (A/B test funnel)
// ================================

export const paymentRitualEvents = pgTable("payment_ritual_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: varchar("session_id"),
  eventType: varchar("event_type", { length: 80 }).notNull(),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pre_user_id").on(table.userId),
  index("idx_pre_event_type").on(table.eventType),
  index("idx_pre_timestamp").on(table.timestamp),
]);

export type PaymentRitualEvent = typeof paymentRitualEvents.$inferSelect;

// ================================
// Pre-event Attendance (Blind Box)
// ================================

export const blindBoxPreAttendance = pgTable("blind_box_pre_attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => blindBoxEvents.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  // "pending" | "confirmed" | "late" | "absent"
  status: varchar("status").notNull().default("pending"),
  lateMinutes: integer("late_minutes"), // populated when status = "late"
  absentReason: varchar("absent_reason"), // populated when status = "absent"
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("uq_blind_box_pre_attendance").on(table.eventId, table.userId),
  index("idx_blind_box_pre_attendance_event").on(table.eventId),
]);

export const insertBlindBoxPreAttendanceSchema = createInsertSchema(blindBoxPreAttendance).omit({
  id: true,
  updatedAt: true,
});

export type BlindBoxPreAttendance = typeof blindBoxPreAttendance.$inferSelect;
export type InsertBlindBoxPreAttendance = z.infer<typeof insertBlindBoxPreAttendanceSchema>;

// ================================
// Admin Accounts (RBAC)
// ================================

/**
 * Dedicated admin accounts table – decoupled from the regular `users` table.
 * Roles:
 *   super_admin – full access including admin account management
 *   operator    – general admin operations; cannot manage admin accounts
 *   viewer      – read-only access to dashboards / reports
 *
 * Transitional note: existing admins who authenticated via the `users` table
 * (isAdmin = true, phone-number-based) should be migrated by running the
 * updated `createAdminAccount` CLI which inserts a row here. The legacy
 * `users.isAdmin` flag and `requireAdmin` middleware continue to work until
 * full migration is complete.
 */
export const adminAccounts = pgTable("admin_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 64 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 32 }).notNull().default("operator"),
  // "active" | "disabled"
  status: varchar("status", { length: 16 }).notNull().default("active"),
  displayName: varchar("display_name", { length: 100 }),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_admin_accounts_username").on(table.username),
  index("idx_admin_accounts_role").on(table.role),
]);

export const insertAdminAccountSchema = createInsertSchema(adminAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

export type AdminAccount = typeof adminAccounts.$inferSelect;
export type InsertAdminAccount = z.infer<typeof insertAdminAccountSchema>;

// ============ Admin Audit Logs ============

/**
 * Persistent admin audit log storage.
 *
 * Mirrors the structure of AdminAuditRecord from adminAuditLogger.ts
 * so audit events can be queried programmatically by admin tools and agents.
 */
export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  auditId: varchar("audit_id", { length: 64 }).notNull().unique(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  adminId: varchar("admin_id", { length: 64 }).notNull(),
  adminRole: varchar("admin_role", { length: 32 }),
  action: varchar("action", { length: 64 }).notNull(),
  targetEntityType: varchar("target_entity_type", { length: 64 }).notNull(),
  targetEntityId: varchar("target_entity_id", { length: 64 }),
  before: jsonb("before"),
  after: jsonb("after"),
  context: jsonb("context"),
}, (table) => [
  index("idx_audit_logs_admin_id").on(table.adminId),
  index("idx_audit_logs_action").on(table.action),
  index("idx_audit_logs_timestamp").on(table.timestamp),
  index("idx_audit_logs_target").on(table.targetEntityType, table.targetEntityId),
]);

export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLogs).omit({
  id: true,
});

export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type InsertAdminAuditLog = z.infer<typeof insertAdminAuditLogSchema>;

// ============ Feature Flags ============

/**
 * Runtime feature flags / kill switches.
 *
 * Overrides env vars when present. Falls back to env var value if row missing.
 * Enables ops to toggle features without redeploying.
 */
export const featureFlags = pgTable("feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 64 }).notNull().unique(),
  value: varchar("value", { length: 255 }).notNull().default("false"),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  updatedBy: varchar("updated_by", { length: 64 }),
}, (table) => [
  index("idx_feature_flags_key").on(table.key),
]);

export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({
  id: true,
  updatedAt: true,
});

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;

// ============ Interest Signal Boost ============

/**
 * Per-user per-interest signal table.
 *
 * Stores a lightweight "conversation-fit calibration" signal for a chosen
 * interest: how enthusiastic the user is, their preferred discussion style,
 * and desired conversation depth.  Used as a soft bonus in matching and as
 * richer context for icebreaker / conversation-topic generation.
 *
 * MVP: text-first, no image/audio recognition.  Optional for users; never
 * blocks matching or onboarding.
 */
export const userInterestSignals = pgTable("user_interest_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Normalized interest identifier (topicId from INTEREST_TAXONOMY)
  interestKey: varchar("interest_key").notNull(),
  // Human-readable label shown in UI (e.g. "美食")
  interestLabel: varchar("interest_label").notNull(),

  // Self-reported enthusiasm: 1 (just tagged it) – 5 (obsessed)
  enthusiasmLevel: integer("enthusiasm_level").notNull().default(3),

  // Preferred discussion style for this interest.
  // One of: "casual_vibes" | "character_people" | "plot_worldbuilding" |
  //         "meme_humor" | "deeper_analysis"
  discussionStyle: varchar("discussion_style").notNull().default("casual_vibes"),

  // Desired conversation depth: 1=light, 2=medium, 3=deep
  conversationDepth: integer("conversation_depth").notNull().default(2),

  // Freshness metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_user_interest_signals_user_interest").on(table.userId, table.interestKey),
  index("idx_user_interest_signals_user_id").on(table.userId),
]);

export const insertUserInterestSignalSchema = createInsertSchema(userInterestSignals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserInterestSignal = typeof userInterestSignals.$inferSelect;
export type InsertUserInterestSignal = z.infer<typeof insertUserInterestSignalSchema>;

// ============ City Unlock System ============

/**
 * User-expressed interest in launching JoyJoin in a specific city.
 *
 * One row per user per city. Upsert semantics: repeated expressions of
 * interest for the same city update the `updatedAt` timestamp but do not
 * duplicate the count.
 */
export const userCityInterests = pgTable("user_city_interests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  city: varchar("city", { length: 50 }).notNull(),
  source: varchar("source", { length: 30 }).notNull().default("floating_banner"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex("idx_user_city_interests_unique").on(table.userId, table.city),
  index("idx_user_city_interests_city").on(table.city),
  index("idx_user_city_interests_user").on(table.userId),
]);

export const insertUserCityInterestSchema = createInsertSchema(userCityInterests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserCityInterest = typeof userCityInterests.$inferSelect;
export type InsertUserCityInterest = z.infer<typeof insertUserCityInterestSchema>;

/**
 * Per-city unlock progress and status.
 *
 * `interestedCount` is maintained by a trigger or application-level
 * increment/decrement. `targetThreshold` defaults to 50 (configurable).
 * `status` drives the UI state machine: collecting → researching → launching → live.
 */
export const cityUnlockProgress = pgTable("city_unlock_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  city: varchar("city", { length: 50 }).notNull().unique(),
  interestedCount: integer("interested_count").notNull().default(0),
  targetThreshold: integer("target_threshold").notNull().default(50),
  status: varchar("status", { length: 20 }).notNull().default("collecting"),
  notifiedAt: timestamp("notified_at", { withTimezone: true }),
  launchedAt: timestamp("launched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertCityUnlockProgressSchema = createInsertSchema(cityUnlockProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CityUnlockProgress = typeof cityUnlockProgress.$inferSelect;
export type InsertCityUnlockProgress = z.infer<typeof insertCityUnlockProgressSchema>;

// ============ Social Icebreaker Persistence ============

/**
 * Persisted Social Icebreaker session state.
 *
 * Replaces the previous in-memory Map store.  The full SocialSessionState
 * is stored in `state_json` (JSONB) so schema migrations are not needed
 * for individual phase-data fields.  Key fields are promoted to columns to
 * support efficient index-based lookup and TTL sweeps.
 *
 * `expires_at` is set to sessionStartedAt + 6 hours on creation and is
 * used for explicit TTL enforcement (clients receive a structured expiry
 * error rather than an opaque 404).
 */

// ============ Privacy-Safe IP Geolocation ============

/**
 * Per-event privacy-safe IP geolocation snapshots.
 *
 * Raw IPs are never stored.  A daily rotating salt (`ipSaltDate`) plus SHA-256
 * hashing produces a stable-but-anonymized identifier for unique-user counting
 * within a single day.  The last octet of the IP is zeroed before hashing so
 * the identifier cannot be reversed to an individual address even with the salt.
 *
 * Rows are retained for 90 days and then rolled up into
 * `user_location_aggregates`.  Foreign key to `users` is optional so anonymous
 * onboarding sessions can still contribute to aggregate heatmaps.
 */
export const userLocationSnapshots = pgTable("user_location_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  eventType: varchar("event_type", { length: 32 }).notNull(),
  // privacy-safe identifiers
  hashedIp: varchar("hashed_ip", { length: 64 }).notNull(),
  anonymizedIp: varchar("anonymized_ip", { length: 40 }).notNull(),
  ipSaltDate: date("ip_salt_date").notNull(),
  // parsed location (QQwry for mainland China)
  country: varchar("country", { length: 60 }),
  province: varchar("province", { length: 60 }),
  city: varchar("city", { length: 60 }),
  district: varchar("district", { length: 60 }),
  isp: varchar("isp", { length: 120 }),
  isMainland: boolean("is_mainland").notNull().default(false),
  // metadata
  lookupSource: varchar("lookup_source", { length: 20 }).notNull().default("qqwry"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_user_location_snapshots_user").on(table.userId),
  index("idx_user_location_snapshots_event_type").on(table.eventType),
  index("idx_user_location_snapshots_created_at").on(table.createdAt),
  index("idx_user_location_snapshots_city").on(table.city),
  index("idx_user_location_snapshots_mainland").on(table.isMainland),
]);

export const insertUserLocationSnapshotSchema = createInsertSchema(userLocationSnapshots).omit({
  id: true,
  createdAt: true,
});

export type UserLocationSnapshot = typeof userLocationSnapshots.$inferSelect;
export type InsertUserLocationSnapshot = z.infer<typeof insertUserLocationSnapshotSchema>;

/**
 * Daily rolled-up location aggregates for the admin heatmap.
 *
 * `uniqueHashedIps` counts distinct `hashed_ip` values seen for the day.
 * `anonymousSnapshots` counts rows where `user_id IS NULL`.
 *
 * Aggregates are maintained by a nightly rollup job or incrementally on
 * capture.  The primary key is (date, province, city, event_type) so the same
 * city can report multiple event types independently.
 */
export const userLocationAggregates = pgTable("user_location_aggregates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: date("date").notNull(),
  province: varchar("province", { length: 60 }).notNull(),
  city: varchar("city", { length: 60 }).notNull(),
  eventType: varchar("event_type", { length: 32 }).notNull(),
  uniqueHashedIps: integer("unique_hashed_ips").notNull().default(0),
  totalSnapshots: integer("total_snapshots").notNull().default(0),
  anonymousSnapshots: integer("anonymous_snapshots").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex("idx_user_location_aggregates_unique")
    .on(table.date, table.province, table.city, table.eventType),
  index("idx_user_location_aggregates_date").on(table.date),
  index("idx_user_location_aggregates_city").on(table.city),
]);

export const insertUserLocationAggregateSchema = createInsertSchema(userLocationAggregates).omit({
  id: true,
  updatedAt: true,
});

export type UserLocationAggregate = typeof userLocationAggregates.$inferSelect;
export type InsertUserLocationAggregate = z.infer<typeof insertUserLocationAggregateSchema>;

// ============ Alang NPC Prototype System ============

export const alangMissions = pgTable("alang_missions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug").notNull().unique(),
  title: varchar("title").notNull(),
  description: text("description"),
  contentJson: jsonb("content_json").notNull(),
  targetLocation: jsonb("target_location").$type<{ latitude: number; longitude: number; radiusMeters: number }>(),
  companionEndLocation: jsonb("companion_end_location").$type<{ latitude: number; longitude: number; radiusMeters: number }>(),
  status: varchar("status").notNull().default("draft"),
  isInternalOnly: boolean("is_internal_only").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAlangMissionSchema = createInsertSchema(alangMissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AlangMission = typeof alangMissions.$inferSelect;
export type InsertAlangMission = z.infer<typeof insertAlangMissionSchema>;

export const alangMissionProgress = pgTable("alang_mission_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  missionId: varchar("mission_id").notNull().references(() => alangMissions.id),
  currentNodeId: varchar("current_node_id"),
  nodeHistory: jsonb("node_history").$type<string[]>(),
  choicesMade: jsonb("choices_made").$type<Array<{ nodeId: string; choiceIndex: number; label: string }>>(),
  gpsHistory: jsonb("gps_history").$type<Array<{ latitude: number; longitude: number; ts: number; accuracy?: number }>>(),
  targetLocation: jsonb("target_location").$type<{ latitude: number; longitude: number; radiusMeters: number; coordinateSystem: "gcj02" }>(),
  companionEndLocation: jsonb("companion_end_location").$type<{ latitude: number; longitude: number; radiusMeters: number; coordinateSystem: "gcj02" }>(),
  status: varchar("status").notNull().default("in_progress"),
  stage: varchar("stage").notNull().default("not_started"),
  arrivedAt: timestamp("arrived_at"),
  completedAt: timestamp("completed_at"),
  abandonedAt: timestamp("abandoned_at"),
  isDebugSession: boolean("is_debug_session").default(false),
  debugMarkers: jsonb("debug_markers").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_alang_progress_user").on(table.userId),
  index("idx_alang_progress_mission").on(table.missionId),
  index("idx_alang_progress_status").on(table.status),
  uniqueIndex("uq_alang_progress_user_mission").on(table.userId, table.missionId),
]);

export const insertAlangMissionProgressSchema = createInsertSchema(alangMissionProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AlangMissionProgress = typeof alangMissionProgress.$inferSelect;
export type InsertAlangMissionProgress = z.infer<typeof insertAlangMissionProgressSchema>;

export const alangStoryArchives = pgTable("alang_story_archives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  missionId: varchar("mission_id").notNull().references(() => alangMissions.id),
  progressId: varchar("progress_id").notNull().references(() => alangMissionProgress.id),
  title: varchar("title").notNull(),
  locationName: varchar("location_name"),
  completedAt: timestamp("completed_at").notNull(),
  finalMood: varchar("final_mood"),
  closingLine: text("closing_line"),
  summaryLine: text("summary_line"),
  nodeHistory: jsonb("node_history").notNull().$type<string[]>(),
  choicesMade: jsonb("choices_made").notNull().$type<Array<{ nodeId: string; choiceIndex: number; label: string }>>(),
  companionLines: jsonb("companion_lines").$type<string[]>(),
  isDebugSession: boolean("is_debug_session").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_alang_archive_user").on(table.userId),
  index("idx_alang_archive_mission").on(table.missionId),
  uniqueIndex("uq_alang_archive_progress").on(table.progressId),
]);

export const insertAlangStoryArchiveSchema = createInsertSchema(alangStoryArchives).omit({
  id: true,
  createdAt: true,
});

export type AlangStoryArchive = typeof alangStoryArchives.$inferSelect;
export type InsertAlangStoryArchive = z.infer<typeof insertAlangStoryArchiveSchema>;

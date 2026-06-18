import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  varchar,
  timestamp,
  boolean,
  integer,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from './_definitions.js';

export const socialIcebreakerSessions = pgTable("social_icebreaker_sessions", {
  id: varchar("id").primaryKey(),
  icebreakerSessionId: varchar("icebreaker_session_id").unique().notNull(),
  hostUserId: varchar("host_user_id").notNull(),
  hostDisplayName: varchar("host_display_name").notNull(),
  currentPhase: varchar("current_phase").notNull().default("warmup"),
  phaseStartedAt: timestamp("phase_started_at").notNull(),
  sessionStartedAt: timestamp("session_started_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  stateJson: jsonb("state_json").notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_social_icebreaker_sessions_icebreaker_session_id").on(table.icebreakerSessionId),
  index("idx_social_icebreaker_sessions_expires_at").on(table.expiresAt),
]);

export type SocialIcebreakerSessionRow = typeof socialIcebreakerSessions.$inferSelect;

/**
 * Per-session participant roster with live presence tracking.
 *
 * A row is created (or updated) whenever a user joins/rejoins a Social
 * Icebreaker session.  `last_seen_at` is bumped by the heartbeat endpoint
 * so the server can distinguish active participants from those who have
 * disconnected without explicitly leaving.
 */
export const socialIcebreakerParticipants = pgTable("social_icebreaker_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  socialSessionId: varchar("social_session_id").notNull().references(() => socialIcebreakerSessions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  displayName: varchar("display_name").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_social_icebreaker_participants_session_user").on(table.socialSessionId, table.userId),
  index("idx_social_icebreaker_participants_last_seen").on(table.lastSeenAt),
]);

export type SocialIcebreakerParticipantRow = typeof socialIcebreakerParticipants.$inferSelect;

/**
 * Server-only lie-truth data for the Lie Detective phase.
 *
 * Stores the full statement set (including `isLie`) separately from the
 * public session state so it is never accidentally exposed to clients via
 * the state polling endpoint.  The route handler fetches this table only
 * when it needs to reveal the answer after all votes are in.
 */
export const socialIcebreakerLieTruths = pgTable("social_icebreaker_lie_truths", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  socialSessionId: varchar("social_session_id").notNull().references(() => socialIcebreakerSessions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  statementsJson: jsonb("statements_json").notNull().$type<Array<{ index: number; text: string; isLie: boolean }>>(),
  isAi: boolean("is_ai").default(false),
  sourceTag: text("source_tag"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_social_icebreaker_lie_truths_session_user").on(table.socialSessionId, table.userId),
  index("idx_social_icebreaker_lie_truths_session").on(table.socialSessionId),
]);

/** Per-generation human ratings for Social Icebreaker AI (join via ai_correlation_id to AITrace). */
export const socialIcebreakerAiFeedback = pgTable("social_icebreaker_ai_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  socialSessionId: varchar("social_session_id").notNull().references(() => socialIcebreakerSessions.id, { onDelete: "cascade" }),
  submittedBy: varchar("submitted_by").notNull().references(() => users.id),
  phase: varchar("phase").notNull(),
  promptVersion: varchar("prompt_version").notNull(),
  aiCorrelationId: varchar("ai_correlation_id", { length: 36 }).notNull(),
  rating: varchar("rating", { length: 16 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_social_icebreaker_ai_feedback_dedupe").on(
    table.submittedBy,
    table.socialSessionId,
    table.phase,
    table.aiCorrelationId,
  ),
  index("idx_social_icebreaker_ai_feedback_session").on(table.socialSessionId),
  index("idx_social_icebreaker_ai_feedback_phase_prompt").on(table.phase, table.promptVersion),
  index("idx_social_icebreaker_ai_feedback_created").on(table.createdAt),
]);

/** Per-phase pulse checks: 1-3 rating per user per phase */
export const socialIcebreakerPhasePulseChecks = pgTable("social_icebreaker_phase_pulse_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  socialSessionId: varchar("social_session_id").notNull().references(() => socialIcebreakerSessions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  phase: varchar("phase").notNull(),
  rating: integer("rating").notNull(), // 1-3
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_pulse_check_dedupe").on(table.socialSessionId, table.userId, table.phase),
  index("idx_pulse_check_session").on(table.socialSessionId),
  index("idx_pulse_check_phase").on(table.phase),
  index("idx_pulse_check_created").on(table.createdAt),
]);

export type SocialIcebreakerPhasePulseCheckRow = typeof socialIcebreakerPhasePulseChecks.$inferSelect;

/** Moment Card interaction log: save, share, qr_scan */
export const momentCardInteractions = pgTable("moment_card_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  socialSessionId: varchar("social_session_id").notNull().references(() => socialIcebreakerSessions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: varchar("action").notNull(), // save, share, qr_scan
  deviceInfo: jsonb("device_info"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_moment_card_session").on(table.socialSessionId),
  index("idx_moment_card_action").on(table.action),
  index("idx_moment_card_created").on(table.createdAt),
]);

export type MomentCardInteractionRow = typeof momentCardInteractions.$inferSelect;

/** Pre-generation job queue: async AI content generation before event starts */
export const preGenerationJobs = pgTable("pre_generation_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  socialSessionId: varchar("social_session_id").notNull().references(() => socialIcebreakerSessions.id, { onDelete: "cascade" }),
  phase: varchar("phase").notNull(),
  priority: integer("priority").default(0).notNull(),
  payload: jsonb("payload").notNull().default({}),
  status: varchar("status").notNull().default("pending"), // pending, running, completed, failed
  resultId: varchar("result_id"),
  errorCode: varchar("error_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_pre_gen_job_dedupe").on(table.socialSessionId, table.phase),
  index("idx_pre_gen_job_status").on(table.status),
  index("idx_pre_gen_job_created").on(table.createdAt),
]);

export type PreGenerationJobRow = typeof preGenerationJobs.$inferSelect;

/** Pre-generation results: stored AI-generated content per session + phase */
export const preGenerationResults = pgTable("pre_generation_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  socialSessionId: varchar("social_session_id").notNull().references(() => socialIcebreakerSessions.id, { onDelete: "cascade" }),
  phase: varchar("phase").notNull(),
  contentJson: jsonb("content_json").notNull(),
  aiMeta: jsonb("ai_meta"),
  judgeScores: jsonb("judge_scores"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_pre_gen_result_dedupe").on(table.socialSessionId, table.phase),
  index("idx_pre_gen_result_session").on(table.socialSessionId),
]);

export type PreGenerationResultRow = typeof preGenerationResults.$inferSelect;

/**
 * Per-phase session metrics for Q2 pilot instrumentation.
 * Captures dwell time and engagement signals per phase per session.
 */
export const socialIcebreakerPhaseMetrics = pgTable("social_icebreaker_phase_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  socialSessionId: varchar("social_session_id").notNull().references(() => socialIcebreakerSessions.id, { onDelete: "cascade" }),
  phase: varchar("phase").notNull(),
  dwellTimeMs: integer("dwell_time_ms"), // time spent in phase
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  participantCount: integer("participant_count"),
  actionCount: integer("action_count"), // host+player actions during phase
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_phase_metrics_session_phase").on(table.socialSessionId, table.phase),
  index("idx_phase_metrics_session").on(table.socialSessionId),
  index("idx_phase_metrics_phase").on(table.phase),
]);

export type SocialIcebreakerPhaseMetricRow = typeof socialIcebreakerPhaseMetrics.$inferSelect;

/**
 * Server-only MiniScript secrets for the Mini Script phase.
 *
 * Stores solution, playerKnowledge, redHerrings, deductionChain, and all clues
 * (including unrevealed) separately from the public session state so they are
 * never accidentally exposed to clients via the state polling endpoint.
 */
export const socialIcebreakerMiniscriptSecrets = pgTable(
  'social_icebreaker_miniscript_secrets',
  {
    socialSessionId: varchar('social_session_id', { length: 64 }).primaryKey().references(() => socialIcebreakerSessions.id, { onDelete: "cascade" }),
    secretsJson: text('secrets_json').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_miniscript_secrets_session').on(table.socialSessionId)],
);

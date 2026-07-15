import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod";

import { users } from "./users.js";
import type { AIGCMeta } from "../types/aiMeta.js";

/**
 * The continuous personal story is deliberately sourced from a closed set of
 * server-verified experiences. Raw feedback, GPS, names and arbitrary client
 * text are never part of this contract.
 */
export const personalStorySourceTypeSchema = z.enum(["alang", "blind_box"]);
export type PersonalStorySourceType = z.infer<typeof personalStorySourceTypeSchema>;

export const personalStoryFactKeywordsSchema = z
  .object({
    occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    activityType: z.string().trim().min(1).max(40),
    location: z.string().trim().min(1).max(80).optional(),
    npc: z.string().trim().min(1).max(20).optional(),
    finalMood: z.string().trim().min(1).max(30).optional(),
    choices: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
    partnerAnimals: z.array(z.string().trim().min(1).max(30)).max(12).optional(),
  })
  .strict();

export type PersonalStoryFactKeywords = z.infer<typeof personalStoryFactKeywordsSchema>;

export const personalStoryExperienceSnapshotSchema = z
  .object({
    sourceType: personalStorySourceTypeSchema,
    sourceId: z.string().min(1).max(128),
    occurredAt: z.string().datetime(),
    keywords: personalStoryFactKeywordsSchema,
  })
  .strict();

export type PersonalStoryExperienceSnapshot = z.infer<
  typeof personalStoryExperienceSnapshotSchema
>;

export const personalStoryNovels = pgTable(
  "personal_story_novels",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastSuccessfulUpdateAt: timestamp("last_successful_update_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_personal_story_novels_user").on(table.userId),
  ],
);

export const personalStoryChapters = pgTable(
  "personal_story_chapters",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    novelId: varchar("novel_id")
      .notNull()
      .references(() => personalStoryNovels.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chapterNumber: integer("chapter_number").notNull(),
    sourceType: varchar("source_type").notNull().$type<PersonalStorySourceType>(),
    sourceId: varchar("source_id").notNull(),
    sourceOccurredAt: timestamp("source_occurred_at").notNull(),
    title: varchar("title").notNull(),
    body: text("body").notNull(),
    factKeywords: jsonb("fact_keywords").notNull().$type<PersonalStoryFactKeywords>(),
    keywordHash: varchar("keyword_hash").notNull(),
    provider: varchar("provider"),
    model: varchar("model"),
    promptVersion: varchar("prompt_version").notNull(),
    fallbackUsed: boolean("fallback_used").default(false).notNull(),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_personal_story_chapter_source").on(
      table.novelId,
      table.sourceType,
      table.sourceId,
    ),
    uniqueIndex("uq_personal_story_chapter_number").on(
      table.novelId,
      table.chapterNumber,
    ),
    index("idx_personal_story_chapters_user").on(table.userId),
    index("idx_personal_story_chapters_occurred").on(table.sourceOccurredAt),
  ],
);

export type PersonalStoryUpdateJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "partial_failed"
  | "failed";

export const personalStoryUpdateJobs = pgTable(
  "personal_story_update_jobs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    novelId: varchar("novel_id")
      .notNull()
      .references(() => personalStoryNovels.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status")
      .notNull()
      .default("pending")
      .$type<PersonalStoryUpdateJobStatus>(),
    /**
     * One active job per user. PostgreSQL permits multiple NULL values in a
     * unique index, so terminal jobs clear this value while history remains.
     */
    activeKey: varchar("active_key"),
    sourceSnapshot: jsonb("source_snapshot")
      .notNull()
      .$type<PersonalStoryExperienceSnapshot[]>(),
    nextSourceIndex: integer("next_source_index").default(0).notNull(),
    generatedCount: integer("generated_count").default(0).notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    lockedAt: timestamp("locked_at"),
    leaseExpiresAt: timestamp("lease_expires_at"),
    /**
     * Fencing token replaced on every claim/reclaim. All worker writes must
     * present the current token so an expired worker cannot mutate a job after
     * ownership has moved to another process.
     */
    leaseToken: varchar("lease_token", { length: 36 }),
    errorCode: varchar("error_code"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    uniqueIndex("uq_personal_story_active_job").on(table.userId, table.activeKey),
    index("idx_personal_story_jobs_status_lease").on(table.status, table.leaseExpiresAt),
    index("idx_personal_story_jobs_user_created").on(table.userId, table.createdAt),
  ],
);

export type PersonalStoryNovel = typeof personalStoryNovels.$inferSelect;
export type InsertPersonalStoryNovel = typeof personalStoryNovels.$inferInsert;
export type PersonalStoryChapter = typeof personalStoryChapters.$inferSelect;
export type InsertPersonalStoryChapter = typeof personalStoryChapters.$inferInsert;
export type PersonalStoryUpdateJob = typeof personalStoryUpdateJobs.$inferSelect;
export type InsertPersonalStoryUpdateJob = typeof personalStoryUpdateJobs.$inferInsert;

export interface PersonalStoryChapterView {
  id: string;
  title: string;
  body: string;
  activityType: string;
  occurredAt: string;
  preview?: string | null;
  /** Alternate LLM-provider fallback is still AI-generated content. */
  aigc: AIGCMeta;
}

export type PersonalStoryClientUpdateStatus =
  | "pending"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "disabled";

export interface PersonalStoryUpdateJobView {
  id?: string;
  status: PersonalStoryClientUpdateStatus;
  updatedAt?: string | null;
}

export interface PersonalStoryDocument {
  title: string;
  subtitle?: string | null;
  coverImageUrl?: string | null;
  updatedAt?: string | null;
  chapters: PersonalStoryChapterView[];
}

export interface PersonalStoryResponse {
  story: PersonalStoryDocument | null;
  updateJob: PersonalStoryUpdateJobView | null;
  aiEnabled: boolean;
  canUpdate: boolean;
}

export interface PersonalStoryUpdateResponse {
  accepted: boolean;
  noNewExperiences: boolean;
  story?: PersonalStoryDocument | null;
  updateJob: PersonalStoryUpdateJobView | null;
}

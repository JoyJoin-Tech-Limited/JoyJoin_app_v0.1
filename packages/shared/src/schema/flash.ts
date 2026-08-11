import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { users } from "./_definitions.js";
import type {
  FlashChoiceEffect,
  FlashStoryEndingCode,
  FlashStoryMode,
  FlashUniverseVector,
} from "../alang/parallelUniverse.js";

export type FlashDialogueQuestion = {
  id: string;
  prompt: string;
  options: Array<{ id: string; label: string; tags: string[] }>;
};

export type FlashFeedbackPrompt = {
  id: string;
  prompt: string;
  options: Array<{ id: string; label: string }>;
};

export type FlashAvailabilityWindow = {
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  startTime: string;
  endTime: string;
};

export type FlashTaskSnapshot = {
  templateVersion: number;
  invitationType?: "destination_exploration" | "life_invitation" | "npc_message";
  followUpTargetNpcSlug?: string;
  followUpTargetNpcName?: string;
  messageCopy?: string;
  deliveryCopy?: string;
  code: string;
  category: string;
  title: string;
  brief: string;
  instructions: string;
  dialogueIntro: string;
  feedbackPrompts: FlashFeedbackPrompt[];
  npcName: string;
  npcSlug: string;
  destination: {
    name: string;
    city: "深圳";
    district: string;
    address: string;
    latitude: number;
    longitude: number;
    coordinateSystem: "gcj02";
  } | null;
};

export type FlashStoryContent = {
  opening: string;
  action: string;
  discovery: string;
  question: FlashDialogueQuestion;
  responseByOption: Record<string, string>;
  effectsByOption?: Record<string, FlashChoiceEffect[]>;
  echoByFlag?: Record<string, string>;
  personalizedFallbackByOption?: Record<string, string>;
  closing: string;
};

export type FlashStoryV2Condition = {
  flags?: string[];
  echo?: { gte?: number; lte?: number; lt?: number; gt?: number };
};

export type FlashStoryV2Effect = {
  echo?: number;
  flagsSet?: string[];
  variables?: Record<string, number>;
};

export type FlashStoryV2Segment = {
  speaker?: string;
  text: string;
};

export type FlashStoryV2Choice = {
  id: string;
  text: string;
  kind: "attitude" | "path" | "destiny";
  next: string;
  effect?: FlashStoryV2Effect;
};

export type FlashStoryV2Variant = {
  when: FlashStoryV2Condition | "default";
  segments?: FlashStoryV2Segment[];
  choices?: FlashStoryV2Choice[];
  next?: string | null;
};

export type FlashStoryV2Node = {
  id: string;
  type: "prose" | "choice" | "callback" | "closure" | "ending";
  segments?: FlashStoryV2Segment[];
  choices?: FlashStoryV2Choice[];
  next?: string | null;
  variants?: FlashStoryV2Variant[];
  unlockFragment?: string;
};

export type FlashStoryContentV2 = {
  v: 2;
  start: string;
  nodes: Record<string, FlashStoryV2Node>;
  state?: FlashStoryV2Effect;
};

export type FlashStoryV2State = {
  echo: number;
  flags: string[];
  variables: Record<string, number>;
};

export type FlashStoryRunState = FlashStoryV2State & {
  currentNode: string | null;
  nodePath: string[];
};

export type FlashStoryReleaseManifest = {
  season: { id: string; code: string; title: string; version: number };
  episodes: Array<{
    id: string;
    code: string;
    npcId: string;
    phase: number;
    title: string;
    objectCode: string;
    contentVersion: number;
    content: FlashStoryContent;
    fragment: { id: string; code: string; category: string; title: string; fact: string; assetUrl?: string | null };
  }>;
  endings: Array<{ code: FlashStoryEndingCode; title: string; summary: string }>;
  endingRulesVersion: string;
};

export type FlashStoryMotion = {
  ambient: "none" | "breathe" | "drift";
  blinkAssetUrl?: string;
  blinkIntervalSeconds?: number;
};

export const flashNpcs = pgTable("flash_npcs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug", { length: 40 }).notNull(),
  name: varchar("name", { length: 40 }).notNull(),
  species: varchar("species", { length: 40 }).notNull(),
  personalitySummary: text("personality_summary").notNull(),
  inviteLine: text("invite_line").notNull(),
  voiceGuide: jsonb("voice_guide").notNull().$type<string[]>(),
  dialogueQuestions: jsonb("dialogue_questions").notNull().$type<FlashDialogueQuestion[]>(),
  eligibleWeekdays: integer("eligible_weekdays").array().notNull(),
  oneShiftProbability: integer("one_shift_probability").notNull().default(35),
  twoShiftProbability: integer("two_shift_probability").notNull().default(65),
  minShiftMinutes: integer("min_shift_minutes").notNull().default(180),
  maxShiftMinutes: integer("max_shift_minutes").notNull().default(300),
  minGapMinutes: integer("min_gap_minutes").notNull().default(90),
  themeColor: varchar("theme_color", { length: 16 }).notNull(),
  avatarUrl: text("avatar_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_npcs_slug").on(table.slug),
  index("idx_flash_npcs_active_sort").on(table.isActive, table.sortOrder),
  check("ck_flash_npcs_weekdays", sql`cardinality(${table.eligibleWeekdays}) > 0 and ${table.eligibleWeekdays} <@ array[1,2,3,4,5,6,7]::integer[]`),
  check("ck_flash_npcs_shift_probability", sql`${table.oneShiftProbability} between 0 and 100 and ${table.twoShiftProbability} between 0 and 100 and ${table.oneShiftProbability} + ${table.twoShiftProbability} = 100`),
  check("ck_flash_npcs_shift_duration", sql`${table.minShiftMinutes} between 180 and 300 and ${table.maxShiftMinutes} between ${table.minShiftMinutes} and 300 and ${table.minGapMinutes} >= 90`),
]);

export const flashEncounterLocations = pgTable("flash_encounter_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 120 }).notNull(),
  city: varchar("city", { length: 40 }).notNull().default("深圳"),
  district: varchar("district", { length: 40 }).notNull(),
  address: text("address").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  coordinateSystem: varchar("coordinate_system", { length: 16 }).notNull().default("gcj02"),
  availabilityWindows: jsonb("availability_windows").notNull().$type<FlashAvailabilityWindow[]>(),
  approvalStatus: varchar("approval_status", { length: 24 }).notNull().default("draft"),
  safetyNotes: text("safety_notes"),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  reviewedBy: varchar("reviewed_by", { length: 120 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_flash_encounter_locations_ready").on(table.city, table.district, table.approvalStatus, table.isActive),
  check("ck_flash_encounter_locations_city", sql`${table.city} = '深圳'`),
  check("ck_flash_encounter_locations_coordinate_system", sql`${table.coordinateSystem} = 'gcj02'`),
  check("ck_flash_encounter_locations_bounds", sql`${table.latitude} between 22.35 and 22.95 and ${table.longitude} between 113.7 and 114.75`),
  check("ck_flash_encounter_locations_approval", sql`${table.approvalStatus} in ('draft', 'pending_review', 'approved', 'rejected')`),
  check("ck_flash_encounter_locations_availability", sql`jsonb_typeof(${table.availabilityWindows}) = 'array' and jsonb_array_length(${table.availabilityWindows}) > 0`),
]);

export const flashNpcLocationLinks = pgTable("flash_npc_location_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  npcId: varchar("npc_id").notNull().references(() => flashNpcs.id, { onDelete: "cascade" }),
  locationId: varchar("location_id").notNull().references(() => flashEncounterLocations.id, { onDelete: "cascade" }),
  weight: integer("weight").notNull().default(100),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_npc_location_link").on(table.npcId, table.locationId),
  index("idx_flash_npc_location_active").on(table.npcId, table.isActive),
  index("idx_flash_npc_location_location").on(table.locationId),
  check("ck_flash_npc_location_weight", sql`${table.weight} > 0`),
]);

export const flashSchedulePlans = pgTable("flash_schedule_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceDate: date("service_date").notNull(),
  city: varchar("city", { length: 40 }).notNull().default("深圳"),
  status: varchar("status", { length: 24 }).notNull().default("draft"),
  source: varchar("source", { length: 24 }).notNull().default("generated"),
  generationSeed: varchar("generation_seed", { length: 80 }).notNull(),
  version: integer("version").notNull().default(1),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  autoPublishAfter: timestamp("auto_publish_after", { withTimezone: true }).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdBy: varchar("created_by", { length: 120 }),
  updatedBy: varchar("updated_by", { length: 120 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_schedule_date_city").on(table.serviceDate, table.city),
  index("idx_flash_schedule_status_date").on(table.status, table.serviceDate),
  check("ck_flash_schedule_city", sql`${table.city} = '深圳'`),
  check("ck_flash_schedule_version", sql`${table.version} > 0`),
  check("ck_flash_schedule_status", sql`${table.status} in ('draft', 'published', 'superseded')`),
  check("ck_flash_schedule_source", sql`${table.source} in ('generated', 'fallback', 'manual')`),
]);

export const flashShifts = pgTable("flash_shifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").references(() => flashSchedulePlans.id, { onDelete: "cascade" }),
  npcId: varchar("npc_id").notNull().references(() => flashNpcs.id),
  locationId: varchar("location_id").notNull().references(() => flashEncounterLocations.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  status: varchar("status", { length: 24 }).notNull().default("draft"),
  source: varchar("source", { length: 24 }).notNull().default("generated"),
  availabilityMode: varchar("availability_mode", { length: 24 }).notNull().default("scheduled"),
  manualHoldStartedBy: varchar("manual_hold_started_by", { length: 120 }),
  manualHoldStoppedBy: varchar("manual_hold_stopped_by", { length: 120 }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_flash_shifts_live").on(table.status, table.availabilityMode, table.startsAt, table.endsAt),
  index("idx_flash_shifts_plan").on(table.planId),
  index("idx_flash_shifts_npc_time").on(table.npcId, table.startsAt),
  index("idx_flash_shifts_location_time").on(table.locationId, table.startsAt),
  uniqueIndex("uq_flash_shifts_active_manual_hold_npc")
    .on(table.npcId)
    .where(sql`${table.availabilityMode} = 'manual_hold' and ${table.status} = 'published'`),
  check("ck_flash_shifts_time", sql`(
    (${table.availabilityMode} = 'scheduled'
      and ${table.planId} is not null
      and ${table.endsAt} is not null
      and ${table.endsAt} > ${table.startsAt})
    or
    (${table.availabilityMode} = 'manual_hold'
      and ${table.planId} is null
      and ${table.source} = 'manual'
      and ${table.manualHoldStartedBy} is not null
      and (
        (${table.status} = 'published' and ${table.endsAt} is null)
        or (${table.status} = 'cancelled' and ${table.endsAt} is not null and ${table.endsAt} >= ${table.startsAt})
      ))
  )`),
  check("ck_flash_shifts_version", sql`${table.version} > 0`),
  check("ck_flash_shifts_status", sql`${table.status} in ('draft', 'published', 'cancelled')`),
  check("ck_flash_shifts_source", sql`${table.source} in ('generated', 'fallback', 'manual')`),
  check("ck_flash_shifts_availability_mode", sql`${table.availabilityMode} in ('scheduled', 'manual_hold')`),
]);

export const flashTaskDestinations = pgTable("flash_task_destinations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 120 }).notNull(),
  city: varchar("city", { length: 40 }).notNull().default("深圳"),
  district: varchar("district", { length: 40 }).notNull(),
  address: text("address").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  coordinateSystem: varchar("coordinate_system", { length: 16 }).notNull().default("gcj02"),
  destinationType: varchar("destination_type", { length: 40 }).notNull().default("public_place"),
  tags: text("tags").array().notNull().default(sql`array[]::text[]`),
  approvalStatus: varchar("approval_status", { length: 24 }).notNull().default("draft"),
  safetyNotes: text("safety_notes"),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  reviewedBy: varchar("reviewed_by", { length: 120 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_flash_task_destinations_ready").on(table.city, table.district, table.approvalStatus, table.isActive),
  check("ck_flash_task_destinations_city", sql`${table.city} = '深圳'`),
  check("ck_flash_task_destinations_coordinate_system", sql`${table.coordinateSystem} = 'gcj02'`),
  check("ck_flash_task_destinations_bounds", sql`${table.latitude} between 22.35 and 22.95 and ${table.longitude} between 113.7 and 114.75`),
  check("ck_flash_task_destinations_approval", sql`${table.approvalStatus} in ('draft', 'pending_review', 'approved', 'rejected')`),
]);

export const flashTaskTemplates = pgTable("flash_task_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 20 }).notNull(),
  category: varchar("category", { length: 40 }).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  brief: text("brief").notNull(),
  instructions: text("instructions").notNull(),
  dialogueIntro: text("dialogue_intro").notNull(),
  feedbackPrompts: jsonb("feedback_prompts").notNull().$type<FlashFeedbackPrompt[]>(),
  tags: text("tags").array().notNull(),
  durationDays: integer("duration_days").notNull().default(7),
  baseWeight: integer("base_weight").notNull().default(100),
  safetyLevel: varchar("safety_level", { length: 8 }).notNull().default("L1"),
  safetyNotes: text("safety_notes").notNull(),
  contentVersion: integer("content_version").notNull().default(1),
  reviewStatus: varchar("review_status", { length: 24 }).notNull().default("draft"),
  isHumanReviewed: boolean("is_human_reviewed").notNull().default(false),
  reviewedBy: varchar("reviewed_by", { length: 120 }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_task_templates_code").on(table.code),
  index("idx_flash_task_templates_ready").on(table.reviewStatus, table.isHumanReviewed, table.isActive),
  index("idx_flash_task_templates_category").on(table.category),
  check("ck_flash_task_templates_review_status", sql`${table.reviewStatus} in ('draft', 'pending_review', 'active', 'suspended')`),
  check("ck_flash_task_templates_safety", sql`${table.safetyLevel} in ('L1', 'L2')`),
  check("ck_flash_task_templates_duration", sql`${table.durationDays} = 7`),
  check("ck_flash_task_templates_base_weight", sql`${table.baseWeight} > 0`),
]);

export const flashNpcTaskLinks = pgTable("flash_npc_task_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  npcId: varchar("npc_id").notNull().references(() => flashNpcs.id, { onDelete: "cascade" }),
  taskTemplateId: varchar("task_template_id").notNull().references(() => flashTaskTemplates.id, { onDelete: "cascade" }),
  requestCopy: text("request_copy").notNull(),
  deliveryCopy: text("delivery_copy").notNull(),
  weight: integer("weight").notNull().default(100),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_npc_task_link").on(table.npcId, table.taskTemplateId),
  index("idx_flash_npc_task_active").on(table.npcId, table.isActive),
  index("idx_flash_npc_task_template").on(table.taskTemplateId),
  check("ck_flash_npc_task_weight", sql`${table.weight} > 0`),
]);

export const flashTaskDestinationLinks = pgTable("flash_task_destination_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskTemplateId: varchar("task_template_id").notNull().references(() => flashTaskTemplates.id, { onDelete: "cascade" }),
  destinationId: varchar("destination_id").notNull().references(() => flashTaskDestinations.id, { onDelete: "cascade" }),
  weight: integer("weight").notNull().default(100),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_task_destination_link").on(table.taskTemplateId, table.destinationId),
  index("idx_flash_task_destination_active").on(table.taskTemplateId, table.isActive),
  index("idx_flash_task_destination_destination").on(table.destinationId),
  check("ck_flash_task_destination_weight", sql`${table.weight} > 0`),
]);

export const flashStorySeasons = pgTable("flash_story_seasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 60 }).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  premise: text("premise").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("draft"),
  version: integer("version").notNull().default(1),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedBy: varchar("published_by", { length: 120 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_story_seasons_code").on(table.code),
  index("idx_flash_story_seasons_status").on(table.status, table.publishedAt),
  check("ck_flash_story_seasons_status", sql`${table.status} in ('draft', 'published', 'archived')`),
  check("ck_flash_story_seasons_version", sql`${table.version} > 0`),
]);

export const flashStoryEpisodes = pgTable("flash_story_episodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seasonId: varchar("season_id").notNull().references(() => flashStorySeasons.id, { onDelete: "cascade" }),
  npcId: varchar("npc_id").notNull().references(() => flashNpcs.id),
  code: varchar("code", { length: 80 }).notNull(),
  phase: integer("phase").notNull(),
  sortOrder: integer("sort_order").notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  objectCode: varchar("object_code", { length: 60 }).notNull(),
  content: jsonb("content").notNull().$type<FlashStoryContent>(),
  motion: jsonb("motion").notNull().default(sql`'{"ambient":"breathe"}'::jsonb`).$type<FlashStoryMotion>(),
  reviewStatus: varchar("review_status", { length: 24 }).notNull().default("draft"),
  contentVersion: integer("content_version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_story_episode_code").on(table.seasonId, table.code),
  uniqueIndex("uq_flash_story_episode_phase_npc").on(table.seasonId, table.phase, table.npcId),
  index("idx_flash_story_episode_runtime").on(table.seasonId, table.phase, table.isActive, table.reviewStatus),
  check("ck_flash_story_episode_phase", sql`${table.phase} between 1 and 3`),
  check("ck_flash_story_episode_review", sql`${table.reviewStatus} in ('draft', 'reviewed')`),
  check("ck_flash_story_episode_version", sql`${table.contentVersion} > 0`),
]);

export const flashStoryFragments = pgTable("flash_story_fragments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  episodeId: varchar("episode_id").notNull().references(() => flashStoryEpisodes.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 80 }).notNull(),
  category: varchar("category", { length: 24 }).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  fact: text("fact").notNull(),
  assetUrl: text("asset_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_story_fragment_code").on(table.code),
  index("idx_flash_story_fragment_episode").on(table.episodeId, table.sortOrder),
  check("ck_flash_story_fragment_category", sql`${table.category} in ('object', 'past', 'relationship', 'key')`),
]);

export const flashStoryReleaseSnapshots = pgTable("flash_story_release_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seasonId: varchar("season_id").notNull().references(() => flashStorySeasons.id),
  revision: integer("revision").notNull(),
  manifestHash: varchar("manifest_hash", { length: 64 }).notNull(),
  manifest: jsonb("manifest").notNull().$type<FlashStoryReleaseManifest>(),
  status: varchar("status", { length: 24 }).notNull().default("published"),
  publishedBy: varchar("published_by", { length: 120 }),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_story_release_revision").on(table.seasonId, table.revision),
  index("idx_flash_story_release_hash").on(table.manifestHash),
  index("idx_flash_story_release_current").on(table.status, table.publishedAt),
  uniqueIndex("uq_flash_story_one_current").on(table.status).where(sql`${table.status} = 'published'`),
  check("ck_flash_story_release_revision", sql`${table.revision} > 0`),
  check("ck_flash_story_release_status", sql`${table.status} in ('published', 'superseded')`),
]);

export const flashStoryUniverseRuns = pgTable("flash_story_universe_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  releaseSnapshotId: varchar("release_snapshot_id").notNull().references(() => flashStoryReleaseSnapshots.id),
  mode: varchar("mode", { length: 24 }).notNull().$type<FlashStoryMode>(),
  universeVector: jsonb("universe_vector").notNull().$type<FlashUniverseVector>(),
  flags: text("flags").array().notNull().default(sql`array[]::text[]`),
  echoQueue: jsonb("echo_queue").notNull().default(sql`'[]'::jsonb`).$type<Array<{ flag: string; copy: string; sourceEpisodeCode: string }>>(),
  endingCode: varchar("ending_code", { length: 40 }).$type<FlashStoryEndingCode>(),
  currentNode: varchar("current_node", { length: 80 }),
  nodePath: jsonb("node_path").notNull().default(sql`'[]'::jsonb`).$type<string[]>(),
  v2State: jsonb("v2_state").$type<{ echo: number; variables: Record<string, number> }>(),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  stateVersion: integer("state_version").notNull().default(1),
  consentVersion: varchar("consent_version", { length: 40 }),
  consentedAt: timestamp("consented_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_story_universe_user_release").on(table.userId, table.releaseSnapshotId),
  index("idx_flash_story_universe_resume").on(table.userId, table.status, table.updatedAt),
  check("ck_flash_story_universe_mode", sql`${table.mode} in ('standard', 'personalized')`),
  check("ck_flash_story_universe_status", sql`${table.status} in ('active', 'completed')`),
  check("ck_flash_story_universe_state_version", sql`${table.stateVersion} > 0`),
  check("ck_flash_story_universe_consent", sql`(${table.mode} = 'standard' and ${table.consentVersion} is null and ${table.consentedAt} is null) or (${table.mode} = 'personalized' and ${table.consentVersion} is not null and ${table.consentedAt} is not null)`),
]);

export const flashEncounters = pgTable("flash_encounters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  shiftId: varchar("shift_id").notNull().references(() => flashShifts.id),
  npcId: varchar("npc_id").notNull().references(() => flashNpcs.id),
  storyEpisodeId: varchar("story_episode_id").references(() => flashStoryEpisodes.id),
  status: varchar("status", { length: 24 }).notNull().default("dialogue"),
  answers: jsonb("answers").notNull().default("[]").$type<Array<{ questionId: string; optionId: string; tags: string[] }>>(),
  currentQuestionIndex: integer("current_question_index").notNull().default(0),
  offeredTaskTemplateId: varchar("offered_task_template_id").references(() => flashTaskTemplates.id),
  offeredDestinationId: varchar("offered_destination_id").references(() => flashTaskDestinations.id),
  firstOfferedTaskTemplateId: varchar("first_offered_task_template_id").references(() => flashTaskTemplates.id),
  rerollCount: integer("reroll_count").notNull().default(0),
  contextDistrict: varchar("context_district", { length: 40 }),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_encounter_user_shift").on(table.userId, table.shiftId),
  index("idx_flash_encounters_user_status").on(table.userId, table.status),
  index("idx_flash_encounters_shift").on(table.shiftId),
  index("idx_flash_encounters_npc").on(table.npcId),
  index("idx_flash_encounters_offered_task").on(table.offeredTaskTemplateId),
  index("idx_flash_encounters_offered_destination").on(table.offeredDestinationId),
  index("idx_flash_encounters_first_offered_task").on(table.firstOfferedTaskTemplateId),
  index("idx_flash_encounters_expiry").on(table.expiresAt),
  check("ck_flash_encounters_status", sql`${table.status} in ('dialogue', 'offered', 'accepted', 'declined', 'completed', 'expired')`),
  check("ck_flash_encounters_reroll_count", sql`${table.rerollCount} between 0 and 1`),
]);

export const flashUserStoryProgress = pgTable("flash_user_story_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  seasonId: varchar("season_id").notNull().references(() => flashStorySeasons.id, { onDelete: "cascade" }),
  universeRunId: varchar("universe_run_id").references(() => flashStoryUniverseRuns.id),
  currentPhase: integer("current_phase").notNull().default(1),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_user_story_progress").on(table.userId, table.seasonId),
  index("idx_flash_user_story_progress_status").on(table.userId, table.status),
  check("ck_flash_user_story_phase", sql`${table.currentPhase} between 1 and 3`),
  check("ck_flash_user_story_status", sql`${table.status} in ('active', 'completed')`),
]);

export const flashUserStoryEpisodes = pgTable("flash_user_story_episodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  episodeId: varchar("episode_id").notNull().references(() => flashStoryEpisodes.id, { onDelete: "cascade" }),
  encounterId: varchar("encounter_id").notNull().references(() => flashEncounters.id),
  universeRunId: varchar("universe_run_id").references(() => flashStoryUniverseRuns.id),
  selectedOptionId: varchar("selected_option_id", { length: 80 }).notNull(),
  effectSnapshot: jsonb("effect_snapshot").notNull().default(sql`'[]'::jsonb`).$type<FlashChoiceEffect[]>(),
  echoSnapshot: text("echo_snapshot"),
  responseSnapshot: text("response_snapshot"),
  renderKind: varchar("render_kind", { length: 24 }).notNull().default("template"),
  promptVersion: varchar("prompt_version", { length: 80 }),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_user_story_episode").on(table.userId, table.episodeId),
  uniqueIndex("uq_flash_user_story_encounter").on(table.encounterId),
  index("idx_flash_user_story_episode_user").on(table.userId, table.completedAt),
  index("idx_flash_user_story_episode_run").on(table.universeRunId, table.completedAt),
  check("ck_flash_user_story_render_kind", sql`${table.renderKind} in ('template', 'ai', 'fallback')`),
]);

export const flashStoryChoiceIntents = pgTable("flash_story_choice_intents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  encounterId: varchar("encounter_id").notNull().references(() => flashEncounters.id, { onDelete: "cascade" }),
  episodeId: varchar("episode_id").notNull().references(() => flashStoryEpisodes.id, { onDelete: "cascade" }),
  questionId: varchar("question_id", { length: 80 }).notNull(),
  optionId: varchar("option_id", { length: 80 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("pending"),
  leaseToken: varchar("lease_token", { length: 80 }),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  attemptCount: integer("attempt_count").notNull().default(0),
  responseSnapshot: text("response_snapshot"),
  renderKind: varchar("render_kind", { length: 24 }),
  promptVersion: varchar("prompt_version", { length: 80 }),
  lastErrorCode: varchar("last_error_code", { length: 80 }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_story_choice_intent_encounter").on(table.encounterId),
  uniqueIndex("uq_flash_story_choice_intent_episode").on(table.userId, table.episodeId),
  index("idx_flash_story_choice_intent_recovery").on(table.status, table.leaseExpiresAt),
  check("ck_flash_story_choice_intent_status", sql`${table.status} in ('pending', 'generating', 'completed')`),
  check("ck_flash_story_choice_intent_render_kind", sql`${table.renderKind} is null or ${table.renderKind} in ('template', 'ai', 'fallback')`),
]);

export const flashUserStoryFragments = pgTable("flash_user_story_fragments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fragmentId: varchar("fragment_id").notNull().references(() => flashStoryFragments.id, { onDelete: "cascade" }),
  episodeId: varchar("episode_id").notNull().references(() => flashStoryEpisodes.id, { onDelete: "cascade" }),
  fragmentSnapshot: jsonb("fragment_snapshot").$type<FlashStoryReleaseManifest["episodes"][number]["fragment"]>(),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_user_story_fragment").on(table.userId, table.fragmentId),
  index("idx_flash_user_story_fragments_user").on(table.userId, table.unlockedAt),
]);

// Shared, coordinate-free probing budget for hidden encounter locations.
// Keeping this in PostgreSQL makes the six-attempt window authoritative across
// process restarts and horizontally scaled API instances.
export const flashLocateBudgets = pgTable("flash_locate_budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  shiftId: varchar("shift_id").notNull().references(() => flashShifts.id, { onDelete: "cascade" }),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  attemptCount: integer("attempt_count").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_locate_budget_user_shift").on(table.userId, table.shiftId),
  index("idx_flash_locate_budget_shift").on(table.shiftId),
  index("idx_flash_locate_budget_cleanup").on(table.updatedAt),
  check("ck_flash_locate_budget_count", sql`${table.attemptCount} >= 1`),
]);

export const flashTaskAssignments = pgTable("flash_task_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  npcId: varchar("npc_id").notNull().references(() => flashNpcs.id),
  encounterId: varchar("encounter_id").notNull().references(() => flashEncounters.id),
  deliveryEncounterId: varchar("delivery_encounter_id").references(() => flashEncounters.id),
  taskTemplateId: varchar("task_template_id").notNull().references(() => flashTaskTemplates.id),
  destinationId: varchar("destination_id").references(() => flashTaskDestinations.id),
  status: varchar("status", { length: 32 }).notNull().default("accepted"),
  contentSnapshot: jsonb("content_snapshot").notNull().$type<FlashTaskSnapshot>(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  arrivedAt: timestamp("arrived_at", { withTimezone: true }),
  feedbackAnswers: jsonb("feedback_answers").$type<Array<{ promptId: string; optionId: string }>>(),
  privateReply: text("private_reply"),
  privateReplyDeleteAfter: timestamp("private_reply_delete_after", { withTimezone: true }),
  feedbackSubmittedAt: timestamp("feedback_submitted_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  abandonedAt: timestamp("abandoned_at", { withTimezone: true }),
  withdrawalReason: text("withdrawal_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_assignment_encounter").on(table.encounterId),
  uniqueIndex("uq_flash_assignment_active_npc")
    .on(table.userId, table.npcId)
    .where(sql`${table.status} in ('accepted', 'arrived', 'ready_to_deliver')`),
  index("idx_flash_assignments_user_status").on(table.userId, table.status),
  index("idx_flash_assignments_npc").on(table.npcId),
  index("idx_flash_assignments_task_template").on(table.taskTemplateId),
  index("idx_flash_assignments_destination").on(table.destinationId),
  index("idx_flash_assignments_delivery_encounter").on(table.deliveryEncounterId),
  index("idx_flash_assignments_expiry").on(table.expiresAt),
  index("idx_flash_assignments_private_reply_cleanup").on(table.privateReplyDeleteAfter),
  check("ck_flash_assignments_status", sql`${table.status} in ('accepted', 'arrived', 'ready_to_deliver', 'delivered', 'expired', 'abandoned', 'withdrawn')`),
  check("ck_flash_assignments_private_reply_length", sql`${table.privateReply} is null or char_length(${table.privateReply}) <= 100`),
  check("ck_flash_assignments_private_reply_retention", sql`(${table.privateReply} is null and ${table.privateReplyDeleteAfter} is null) or (${table.privateReply} is not null and ${table.privateReplyDeleteAfter} is not null)`),
]);

export const flashUserPreferences = pgTable("flash_user_preferences", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  personalizationEnabled: boolean("personalization_enabled").notNull().default(false),
  usePersonality: boolean("use_personality").notNull().default(false),
  useInterests: boolean("use_interests").notNull().default(false),
  useIndustry: boolean("use_industry").notNull().default(false),
  useDistrict: boolean("use_district").notNull().default(false),
  useTaskBehavior: boolean("use_task_behavior").notNull().default(false),
  consentVersion: varchar("consent_version", { length: 40 }),
  consentedAt: timestamp("consented_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const flashUserTaskTags = pgTable("flash_user_task_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  source: varchar("source", { length: 24 }).notNull(),
  tagKey: varchar("tag_key", { length: 80 }).notNull(),
  label: varchar("label", { length: 120 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_user_task_tag").on(table.userId, table.source, table.tagKey),
  index("idx_flash_user_task_tags_active").on(table.userId, table.isActive),
  check("ck_flash_user_task_tags_source", sql`${table.source} in ('personality', 'interests', 'industry', 'district', 'task_behavior')`),
]);

export const flashNpcRelationships = pgTable("flash_npc_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  npcId: varchar("npc_id").notNull().references(() => flashNpcs.id, { onDelete: "cascade" }),
  completedCount: integer("completed_count").notNull().default(0),
  encounterCount: integer("encounter_count").notNull().default(0),
  lastMetAt: timestamp("last_met_at", { withTimezone: true }),
  lastDeliveredAt: timestamp("last_delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_flash_npc_relationship").on(table.userId, table.npcId),
  index("idx_flash_npc_relationships_npc").on(table.npcId),
  check("ck_flash_npc_relationships_counts", sql`${table.completedCount} >= 0 and ${table.encounterCount} >= 0`),
]);

export const insertFlashNpcSchema = createInsertSchema(flashNpcs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFlashEncounterLocationSchema = createInsertSchema(flashEncounterLocations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFlashTaskDestinationSchema = createInsertSchema(flashTaskDestinations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFlashTaskTemplateSchema = createInsertSchema(flashTaskTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFlashSchedulePlanSchema = createInsertSchema(flashSchedulePlans).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFlashShiftSchema = createInsertSchema(flashShifts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFlashStorySeasonSchema = createInsertSchema(flashStorySeasons).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFlashStoryEpisodeSchema = createInsertSchema(flashStoryEpisodes).omit({ id: true, createdAt: true, updatedAt: true });

export type FlashNpc = typeof flashNpcs.$inferSelect;
export type FlashEncounterLocation = typeof flashEncounterLocations.$inferSelect;
export type FlashSchedulePlan = typeof flashSchedulePlans.$inferSelect;
export type FlashShift = typeof flashShifts.$inferSelect;
export type FlashTaskDestination = typeof flashTaskDestinations.$inferSelect;
export type FlashTaskTemplate = typeof flashTaskTemplates.$inferSelect;
export type FlashEncounter = typeof flashEncounters.$inferSelect;
export type FlashLocateBudget = typeof flashLocateBudgets.$inferSelect;
export type FlashTaskAssignment = typeof flashTaskAssignments.$inferSelect;
export type FlashStorySeason = typeof flashStorySeasons.$inferSelect;
export type FlashStoryEpisode = typeof flashStoryEpisodes.$inferSelect;
export type FlashStoryFragment = typeof flashStoryFragments.$inferSelect;
export type FlashUserPreference = typeof flashUserPreferences.$inferSelect;
export type FlashUserTaskTag = typeof flashUserTaskTags.$inferSelect;

export type InsertFlashNpc = z.infer<typeof insertFlashNpcSchema>;
export type InsertFlashEncounterLocation = z.infer<typeof insertFlashEncounterLocationSchema>;
export type InsertFlashTaskDestination = z.infer<typeof insertFlashTaskDestinationSchema>;
export type InsertFlashTaskTemplate = z.infer<typeof insertFlashTaskTemplateSchema>;
export type InsertFlashSchedulePlan = z.infer<typeof insertFlashSchedulePlanSchema>;
export type InsertFlashShift = z.infer<typeof insertFlashShiftSchema>;

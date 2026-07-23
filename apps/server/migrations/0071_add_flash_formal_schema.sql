CREATE TABLE "flash_encounter_locations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"city" varchar(40) DEFAULT '深圳' NOT NULL,
	"district" varchar(40) NOT NULL,
	"address" text NOT NULL,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"coordinate_system" varchar(16) DEFAULT 'gcj02' NOT NULL,
	"availability_windows" jsonb NOT NULL,
	"approval_status" varchar(24) DEFAULT 'draft' NOT NULL,
	"safety_notes" text,
	"last_reviewed_at" timestamp with time zone,
	"reviewed_by" varchar(120),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_flash_encounter_locations_city" CHECK ("flash_encounter_locations"."city" = '深圳'),
	CONSTRAINT "ck_flash_encounter_locations_coordinate_system" CHECK ("flash_encounter_locations"."coordinate_system" = 'gcj02'),
	CONSTRAINT "ck_flash_encounter_locations_bounds" CHECK ("flash_encounter_locations"."latitude" between 22.35 and 22.95 and "flash_encounter_locations"."longitude" between 113.7 and 114.75),
	CONSTRAINT "ck_flash_encounter_locations_approval" CHECK ("flash_encounter_locations"."approval_status" in ('draft', 'approved', 'rejected')),
	CONSTRAINT "ck_flash_encounter_locations_availability" CHECK (jsonb_typeof("flash_encounter_locations"."availability_windows") = 'array' and jsonb_array_length("flash_encounter_locations"."availability_windows") > 0)
);;--> statement-breakpoint
CREATE TABLE "flash_encounters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"shift_id" varchar NOT NULL,
	"npc_id" varchar NOT NULL,
	"status" varchar(24) DEFAULT 'dialogue' NOT NULL,
	"answers" jsonb DEFAULT '[]' NOT NULL,
	"current_question_index" integer DEFAULT 0 NOT NULL,
	"offered_task_template_id" varchar,
	"offered_destination_id" varchar,
	"first_offered_task_template_id" varchar,
	"reroll_count" integer DEFAULT 0 NOT NULL,
	"context_district" varchar(40),
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_flash_encounters_status" CHECK ("flash_encounters"."status" in ('dialogue', 'offered', 'accepted', 'declined', 'completed', 'expired')),
	CONSTRAINT "ck_flash_encounters_reroll_count" CHECK ("flash_encounters"."reroll_count" between 0 and 1)
);;--> statement-breakpoint
CREATE TABLE "flash_locate_budgets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"shift_id" varchar NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_flash_locate_budget_count" CHECK ("flash_locate_budgets"."attempt_count" >= 1)
);;--> statement-breakpoint
CREATE TABLE "flash_npc_location_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"npc_id" varchar NOT NULL,
	"location_id" varchar NOT NULL,
	"weight" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_flash_npc_location_weight" CHECK ("flash_npc_location_links"."weight" > 0)
);;--> statement-breakpoint
CREATE TABLE "flash_npc_relationships" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"npc_id" varchar NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"encounter_count" integer DEFAULT 0 NOT NULL,
	"last_met_at" timestamp with time zone,
	"last_delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_flash_npc_relationships_counts" CHECK ("flash_npc_relationships"."completed_count" >= 0 and "flash_npc_relationships"."encounter_count" >= 0)
);;--> statement-breakpoint
CREATE TABLE "flash_npc_task_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"npc_id" varchar NOT NULL,
	"task_template_id" varchar NOT NULL,
	"request_copy" text NOT NULL,
	"delivery_copy" text NOT NULL,
	"weight" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_flash_npc_task_weight" CHECK ("flash_npc_task_links"."weight" > 0)
);;--> statement-breakpoint
CREATE TABLE "flash_npcs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(40) NOT NULL,
	"name" varchar(40) NOT NULL,
	"species" varchar(40) NOT NULL,
	"personality_summary" text NOT NULL,
	"invite_line" text NOT NULL,
	"voice_guide" jsonb NOT NULL,
	"dialogue_questions" jsonb NOT NULL,
	"eligible_weekdays" integer[] NOT NULL,
	"one_shift_probability" integer DEFAULT 35 NOT NULL,
	"two_shift_probability" integer DEFAULT 65 NOT NULL,
	"min_shift_minutes" integer DEFAULT 90 NOT NULL,
	"max_shift_minutes" integer DEFAULT 150 NOT NULL,
	"min_gap_minutes" integer DEFAULT 90 NOT NULL,
	"theme_color" varchar(16) NOT NULL,
	"avatar_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_flash_npcs_weekdays" CHECK (cardinality("flash_npcs"."eligible_weekdays") > 0 and "flash_npcs"."eligible_weekdays" <@ array[1,2,3,4,5,6,7]::integer[]),
	CONSTRAINT "ck_flash_npcs_shift_probability" CHECK ("flash_npcs"."one_shift_probability" between 0 and 100 and "flash_npcs"."two_shift_probability" between 0 and 100 and "flash_npcs"."one_shift_probability" + "flash_npcs"."two_shift_probability" = 100),
	CONSTRAINT "ck_flash_npcs_shift_duration" CHECK ("flash_npcs"."min_shift_minutes" between 90 and 150 and "flash_npcs"."max_shift_minutes" between "flash_npcs"."min_shift_minutes" and 150 and "flash_npcs"."min_gap_minutes" >= 90)
);;--> statement-breakpoint
CREATE TABLE "flash_schedule_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_date" date NOT NULL,
	"city" varchar(40) DEFAULT '深圳' NOT NULL,
	"status" varchar(24) DEFAULT 'draft' NOT NULL,
	"source" varchar(24) DEFAULT 'generated' NOT NULL,
	"generation_seed" varchar(80) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"auto_publish_after" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" varchar(120),
	"updated_by" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_flash_schedule_city" CHECK ("flash_schedule_plans"."city" = '深圳'),
	CONSTRAINT "ck_flash_schedule_version" CHECK ("flash_schedule_plans"."version" > 0),
	CONSTRAINT "ck_flash_schedule_status" CHECK ("flash_schedule_plans"."status" in ('draft', 'published', 'superseded')),
	CONSTRAINT "ck_flash_schedule_source" CHECK ("flash_schedule_plans"."source" in ('generated', 'fallback', 'manual'))
);;--> statement-breakpoint
CREATE TABLE "flash_shifts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" varchar NOT NULL,
	"npc_id" varchar NOT NULL,
	"location_id" varchar NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" varchar(24) DEFAULT 'draft' NOT NULL,
	"source" varchar(24) DEFAULT 'generated' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_flash_shifts_time" CHECK ("flash_shifts"."ends_at" > "flash_shifts"."starts_at"),
	CONSTRAINT "ck_flash_shifts_version" CHECK ("flash_shifts"."version" > 0),
	CONSTRAINT "ck_flash_shifts_status" CHECK ("flash_shifts"."status" in ('draft', 'published', 'cancelled')),
	CONSTRAINT "ck_flash_shifts_source" CHECK ("flash_shifts"."source" in ('generated', 'fallback', 'manual'))
);;--> statement-breakpoint
CREATE TABLE "flash_task_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"npc_id" varchar NOT NULL,
	"encounter_id" varchar NOT NULL,
	"delivery_encounter_id" varchar,
	"task_template_id" varchar NOT NULL,
	"destination_id" varchar NOT NULL,
	"status" varchar(32) DEFAULT 'accepted' NOT NULL,
	"content_snapshot" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"arrived_at" timestamp with time zone,
	"feedback_answers" jsonb,
	"private_reply" text,
	"private_reply_delete_after" timestamp with time zone,
	"feedback_submitted_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"abandoned_at" timestamp with time zone,
	"withdrawal_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_flash_assignments_status" CHECK ("flash_task_assignments"."status" in ('accepted', 'arrived', 'ready_to_deliver', 'delivered', 'expired', 'abandoned', 'withdrawn')),
	CONSTRAINT "ck_flash_assignments_private_reply_length" CHECK ("flash_task_assignments"."private_reply" is null or char_length("flash_task_assignments"."private_reply") <= 100),
	CONSTRAINT "ck_flash_assignments_private_reply_retention" CHECK (("flash_task_assignments"."private_reply" is null and "flash_task_assignments"."private_reply_delete_after" is null) or ("flash_task_assignments"."private_reply" is not null and "flash_task_assignments"."private_reply_delete_after" is not null))
);;--> statement-breakpoint
CREATE TABLE "flash_task_destination_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_template_id" varchar NOT NULL,
	"destination_id" varchar NOT NULL,
	"weight" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_flash_task_destination_weight" CHECK ("flash_task_destination_links"."weight" > 0)
);;--> statement-breakpoint
CREATE TABLE "flash_task_destinations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"city" varchar(40) DEFAULT '深圳' NOT NULL,
	"district" varchar(40) NOT NULL,
	"address" text NOT NULL,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"coordinate_system" varchar(16) DEFAULT 'gcj02' NOT NULL,
	"destination_type" varchar(40) DEFAULT 'public_place' NOT NULL,
	"tags" text[] DEFAULT array[]::text[] NOT NULL,
	"approval_status" varchar(24) DEFAULT 'draft' NOT NULL,
	"safety_notes" text,
	"last_reviewed_at" timestamp with time zone,
	"reviewed_by" varchar(120),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_flash_task_destinations_city" CHECK ("flash_task_destinations"."city" = '深圳'),
	CONSTRAINT "ck_flash_task_destinations_coordinate_system" CHECK ("flash_task_destinations"."coordinate_system" = 'gcj02'),
	CONSTRAINT "ck_flash_task_destinations_bounds" CHECK ("flash_task_destinations"."latitude" between 22.35 and 22.95 and "flash_task_destinations"."longitude" between 113.7 and 114.75),
	CONSTRAINT "ck_flash_task_destinations_approval" CHECK ("flash_task_destinations"."approval_status" in ('draft', 'approved', 'rejected'))
);;--> statement-breakpoint
CREATE TABLE "flash_task_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"category" varchar(40) NOT NULL,
	"title" varchar(120) NOT NULL,
	"brief" text NOT NULL,
	"instructions" text NOT NULL,
	"dialogue_intro" text NOT NULL,
	"feedback_prompts" jsonb NOT NULL,
	"tags" text[] NOT NULL,
	"duration_days" integer DEFAULT 7 NOT NULL,
	"base_weight" integer DEFAULT 100 NOT NULL,
	"safety_level" varchar(8) DEFAULT 'L1' NOT NULL,
	"safety_notes" text NOT NULL,
	"content_version" integer DEFAULT 1 NOT NULL,
	"review_status" varchar(24) DEFAULT 'draft' NOT NULL,
	"is_human_reviewed" boolean DEFAULT false NOT NULL,
	"reviewed_by" varchar(120),
	"reviewed_at" timestamp with time zone,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_flash_task_templates_review_status" CHECK ("flash_task_templates"."review_status" in ('draft', 'pending_review', 'active', 'suspended')),
	CONSTRAINT "ck_flash_task_templates_safety" CHECK ("flash_task_templates"."safety_level" in ('L1', 'L2')),
	CONSTRAINT "ck_flash_task_templates_duration" CHECK ("flash_task_templates"."duration_days" = 7),
	CONSTRAINT "ck_flash_task_templates_base_weight" CHECK ("flash_task_templates"."base_weight" > 0)
);;--> statement-breakpoint
CREATE TABLE "flash_user_preferences" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"personalization_enabled" boolean DEFAULT false NOT NULL,
	"use_personality" boolean DEFAULT false NOT NULL,
	"use_interests" boolean DEFAULT false NOT NULL,
	"use_industry" boolean DEFAULT false NOT NULL,
	"use_district" boolean DEFAULT false NOT NULL,
	"use_task_behavior" boolean DEFAULT false NOT NULL,
	"consent_version" varchar(40),
	"consented_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);;--> statement-breakpoint
CREATE TABLE "flash_user_task_tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"source" varchar(24) NOT NULL,
	"tag_key" varchar(80) NOT NULL,
	"label" varchar(120) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_flash_user_task_tags_source" CHECK ("flash_user_task_tags"."source" in ('personality', 'interests', 'industry', 'district', 'task_behavior'))
);;--> statement-breakpoint
ALTER TABLE "flash_encounters" ADD CONSTRAINT "flash_encounters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_encounters" ADD CONSTRAINT "flash_encounters_shift_id_flash_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."flash_shifts"("id") ON DELETE no action ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_encounters" ADD CONSTRAINT "flash_encounters_npc_id_flash_npcs_id_fk" FOREIGN KEY ("npc_id") REFERENCES "public"."flash_npcs"("id") ON DELETE no action ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_encounters" ADD CONSTRAINT "flash_encounters_offered_task_template_id_flash_task_templates_id_fk" FOREIGN KEY ("offered_task_template_id") REFERENCES "public"."flash_task_templates"("id") ON DELETE no action ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_encounters" ADD CONSTRAINT "flash_encounters_offered_destination_id_flash_task_destinations_id_fk" FOREIGN KEY ("offered_destination_id") REFERENCES "public"."flash_task_destinations"("id") ON DELETE no action ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_encounters" ADD CONSTRAINT "flash_encounters_first_offered_task_template_id_flash_task_templates_id_fk" FOREIGN KEY ("first_offered_task_template_id") REFERENCES "public"."flash_task_templates"("id") ON DELETE no action ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_locate_budgets" ADD CONSTRAINT "flash_locate_budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_locate_budgets" ADD CONSTRAINT "flash_locate_budgets_shift_id_flash_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."flash_shifts"("id") ON DELETE cascade ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_npc_location_links" ADD CONSTRAINT "flash_npc_location_links_npc_id_flash_npcs_id_fk" FOREIGN KEY ("npc_id") REFERENCES "public"."flash_npcs"("id") ON DELETE cascade ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_npc_location_links" ADD CONSTRAINT "flash_npc_location_links_location_id_flash_encounter_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."flash_encounter_locations"("id") ON DELETE cascade ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_npc_relationships" ADD CONSTRAINT "flash_npc_relationships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_npc_relationships" ADD CONSTRAINT "flash_npc_relationships_npc_id_flash_npcs_id_fk" FOREIGN KEY ("npc_id") REFERENCES "public"."flash_npcs"("id") ON DELETE cascade ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_npc_task_links" ADD CONSTRAINT "flash_npc_task_links_npc_id_flash_npcs_id_fk" FOREIGN KEY ("npc_id") REFERENCES "public"."flash_npcs"("id") ON DELETE cascade ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_npc_task_links" ADD CONSTRAINT "flash_npc_task_links_task_template_id_flash_task_templates_id_fk" FOREIGN KEY ("task_template_id") REFERENCES "public"."flash_task_templates"("id") ON DELETE cascade ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_shifts" ADD CONSTRAINT "flash_shifts_plan_id_flash_schedule_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."flash_schedule_plans"("id") ON DELETE cascade ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_shifts" ADD CONSTRAINT "flash_shifts_npc_id_flash_npcs_id_fk" FOREIGN KEY ("npc_id") REFERENCES "public"."flash_npcs"("id") ON DELETE no action ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_shifts" ADD CONSTRAINT "flash_shifts_location_id_flash_encounter_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."flash_encounter_locations"("id") ON DELETE no action ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_task_assignments" ADD CONSTRAINT "flash_task_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_task_assignments" ADD CONSTRAINT "flash_task_assignments_npc_id_flash_npcs_id_fk" FOREIGN KEY ("npc_id") REFERENCES "public"."flash_npcs"("id") ON DELETE no action ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_task_assignments" ADD CONSTRAINT "flash_task_assignments_encounter_id_flash_encounters_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."flash_encounters"("id") ON DELETE no action ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_task_assignments" ADD CONSTRAINT "flash_task_assignments_delivery_encounter_id_flash_encounters_id_fk" FOREIGN KEY ("delivery_encounter_id") REFERENCES "public"."flash_encounters"("id") ON DELETE no action ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_task_assignments" ADD CONSTRAINT "flash_task_assignments_task_template_id_flash_task_templates_id_fk" FOREIGN KEY ("task_template_id") REFERENCES "public"."flash_task_templates"("id") ON DELETE no action ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_task_assignments" ADD CONSTRAINT "flash_task_assignments_destination_id_flash_task_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."flash_task_destinations"("id") ON DELETE no action ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_task_destination_links" ADD CONSTRAINT "flash_task_destination_links_task_template_id_flash_task_templates_id_fk" FOREIGN KEY ("task_template_id") REFERENCES "public"."flash_task_templates"("id") ON DELETE cascade ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_task_destination_links" ADD CONSTRAINT "flash_task_destination_links_destination_id_flash_task_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."flash_task_destinations"("id") ON DELETE cascade ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_user_preferences" ADD CONSTRAINT "flash_user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;;--> statement-breakpoint
ALTER TABLE "flash_user_task_tags" ADD CONSTRAINT "flash_user_task_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;;--> statement-breakpoint
CREATE INDEX "idx_flash_encounter_locations_ready" ON "flash_encounter_locations" USING btree ("city","district","approval_status","is_active");;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_flash_encounter_user_shift" ON "flash_encounters" USING btree ("user_id","shift_id");;--> statement-breakpoint
CREATE INDEX "idx_flash_encounters_user_status" ON "flash_encounters" USING btree ("user_id","status");;--> statement-breakpoint
CREATE INDEX "idx_flash_encounters_shift" ON "flash_encounters" USING btree ("shift_id");;--> statement-breakpoint
CREATE INDEX "idx_flash_encounters_npc" ON "flash_encounters" USING btree ("npc_id");;--> statement-breakpoint
CREATE INDEX "idx_flash_encounters_offered_task" ON "flash_encounters" USING btree ("offered_task_template_id");;--> statement-breakpoint
CREATE INDEX "idx_flash_encounters_offered_destination" ON "flash_encounters" USING btree ("offered_destination_id");;--> statement-breakpoint
CREATE INDEX "idx_flash_encounters_first_offered_task" ON "flash_encounters" USING btree ("first_offered_task_template_id");;--> statement-breakpoint
CREATE INDEX "idx_flash_encounters_expiry" ON "flash_encounters" USING btree ("expires_at");;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_flash_locate_budget_user_shift" ON "flash_locate_budgets" USING btree ("user_id","shift_id");;--> statement-breakpoint
CREATE INDEX "idx_flash_locate_budget_shift" ON "flash_locate_budgets" USING btree ("shift_id");;--> statement-breakpoint
CREATE INDEX "idx_flash_locate_budget_cleanup" ON "flash_locate_budgets" USING btree ("updated_at");;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_flash_npc_location_link" ON "flash_npc_location_links" USING btree ("npc_id","location_id");;--> statement-breakpoint
CREATE INDEX "idx_flash_npc_location_active" ON "flash_npc_location_links" USING btree ("npc_id","is_active");;--> statement-breakpoint
CREATE INDEX "idx_flash_npc_location_location" ON "flash_npc_location_links" USING btree ("location_id");;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_flash_npc_relationship" ON "flash_npc_relationships" USING btree ("user_id","npc_id");;--> statement-breakpoint
CREATE INDEX "idx_flash_npc_relationships_npc" ON "flash_npc_relationships" USING btree ("npc_id");;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_flash_npc_task_link" ON "flash_npc_task_links" USING btree ("npc_id","task_template_id");;--> statement-breakpoint
CREATE INDEX "idx_flash_npc_task_active" ON "flash_npc_task_links" USING btree ("npc_id","is_active");;--> statement-breakpoint
CREATE INDEX "idx_flash_npc_task_template" ON "flash_npc_task_links" USING btree ("task_template_id");;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_flash_npcs_slug" ON "flash_npcs" USING btree ("slug");;--> statement-breakpoint
CREATE INDEX "idx_flash_npcs_active_sort" ON "flash_npcs" USING btree ("is_active","sort_order");;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_flash_schedule_date_city" ON "flash_schedule_plans" USING btree ("service_date","city");;--> statement-breakpoint
CREATE INDEX "idx_flash_schedule_status_date" ON "flash_schedule_plans" USING btree ("status","service_date");;--> statement-breakpoint
CREATE INDEX "idx_flash_shifts_live" ON "flash_shifts" USING btree ("status","starts_at","ends_at");;--> statement-breakpoint
CREATE INDEX "idx_flash_shifts_plan" ON "flash_shifts" USING btree ("plan_id");;--> statement-breakpoint
CREATE INDEX "idx_flash_shifts_npc_time" ON "flash_shifts" USING btree ("npc_id","starts_at");;--> statement-breakpoint
CREATE INDEX "idx_flash_shifts_location_time" ON "flash_shifts" USING btree ("location_id","starts_at");;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_flash_assignment_encounter" ON "flash_task_assignments" USING btree ("encounter_id");;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_flash_assignment_active_npc" ON "flash_task_assignments" USING btree ("user_id","npc_id") WHERE "flash_task_assignments"."status" in ('accepted', 'arrived', 'ready_to_deliver');;--> statement-breakpoint
CREATE INDEX "idx_flash_assignments_user_status" ON "flash_task_assignments" USING btree ("user_id","status");;--> statement-breakpoint
CREATE INDEX "idx_flash_assignments_npc" ON "flash_task_assignments" USING btree ("npc_id");;--> statement-breakpoint
CREATE INDEX "idx_flash_assignments_task_template" ON "flash_task_assignments" USING btree ("task_template_id");;--> statement-breakpoint
CREATE INDEX "idx_flash_assignments_destination" ON "flash_task_assignments" USING btree ("destination_id");;--> statement-breakpoint
CREATE INDEX "idx_flash_assignments_delivery_encounter" ON "flash_task_assignments" USING btree ("delivery_encounter_id");;--> statement-breakpoint
CREATE INDEX "idx_flash_assignments_expiry" ON "flash_task_assignments" USING btree ("expires_at");;--> statement-breakpoint
CREATE INDEX "idx_flash_assignments_private_reply_cleanup" ON "flash_task_assignments" USING btree ("private_reply_delete_after");;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_flash_task_destination_link" ON "flash_task_destination_links" USING btree ("task_template_id","destination_id");;--> statement-breakpoint
CREATE INDEX "idx_flash_task_destination_active" ON "flash_task_destination_links" USING btree ("task_template_id","is_active");;--> statement-breakpoint
CREATE INDEX "idx_flash_task_destination_destination" ON "flash_task_destination_links" USING btree ("destination_id");;--> statement-breakpoint
CREATE INDEX "idx_flash_task_destinations_ready" ON "flash_task_destinations" USING btree ("city","district","approval_status","is_active");;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_flash_task_templates_code" ON "flash_task_templates" USING btree ("code");;--> statement-breakpoint
CREATE INDEX "idx_flash_task_templates_ready" ON "flash_task_templates" USING btree ("review_status","is_human_reviewed","is_active");;--> statement-breakpoint
CREATE INDEX "idx_flash_task_templates_category" ON "flash_task_templates" USING btree ("category");;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_flash_user_task_tag" ON "flash_user_task_tags" USING btree ("user_id","source","tag_key");;--> statement-breakpoint
CREATE INDEX "idx_flash_user_task_tags_active" ON "flash_user_task_tags" USING btree ("user_id","is_active");

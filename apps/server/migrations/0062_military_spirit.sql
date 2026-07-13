BEGIN;
--> statement-breakpoint
CREATE TABLE "alang_missions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"content_json" jsonb NOT NULL,
	"target_location" jsonb,
	"companion_end_location" jsonb,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"is_internal_only" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "alang_missions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "alang_mission_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"mission_id" varchar NOT NULL,
	"current_node_id" varchar,
	"node_history" jsonb,
	"choices_made" jsonb,
	"gps_history" jsonb,
	"status" varchar DEFAULT 'in_progress' NOT NULL,
	"stage" varchar DEFAULT 'not_started' NOT NULL,
	"arrived_at" timestamp,
	"completed_at" timestamp,
	"abandoned_at" timestamp,
	"is_debug_session" boolean DEFAULT false,
	"debug_markers" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "alang_story_archives" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"mission_id" varchar NOT NULL,
	"progress_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"location_name" varchar,
	"completed_at" timestamp NOT NULL,
	"final_mood" varchar,
	"closing_line" text,
	"summary_line" text,
	"node_history" jsonb NOT NULL,
	"choices_made" jsonb NOT NULL,
	"companion_lines" jsonb,
	"is_debug_session" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "alang_missions" ADD CONSTRAINT "alang_missions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alang_mission_progress" ADD CONSTRAINT "alang_mission_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alang_mission_progress" ADD CONSTRAINT "alang_mission_progress_mission_id_alang_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."alang_missions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alang_story_archives" ADD CONSTRAINT "alang_story_archives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alang_story_archives" ADD CONSTRAINT "alang_story_archives_mission_id_alang_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."alang_missions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alang_story_archives" ADD CONSTRAINT "alang_story_archives_progress_id_alang_mission_progress_id_fk" FOREIGN KEY ("progress_id") REFERENCES "public"."alang_mission_progress"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_alang_progress_user" ON "alang_mission_progress" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_alang_progress_mission" ON "alang_mission_progress" USING btree ("mission_id");
--> statement-breakpoint
CREATE INDEX "idx_alang_progress_status" ON "alang_mission_progress" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_alang_progress_user_mission" ON "alang_mission_progress" USING btree ("user_id", "mission_id");
--> statement-breakpoint
CREATE INDEX "idx_alang_archive_user" ON "alang_story_archives" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_alang_archive_mission" ON "alang_story_archives" USING btree ("mission_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_alang_archive_progress" ON "alang_story_archives" USING btree ("progress_id");
--> statement-breakpoint
COMMIT;

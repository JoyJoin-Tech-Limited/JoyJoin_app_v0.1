CREATE TABLE "city_unlock_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city" varchar(50) NOT NULL,
	"interested_count" integer DEFAULT 0 NOT NULL,
	"target_threshold" integer DEFAULT 50 NOT NULL,
	"status" varchar(20) DEFAULT 'collecting' NOT NULL,
	"notified_at" timestamp with time zone,
	"launched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "city_unlock_progress_city_unique" UNIQUE("city")
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(64) NOT NULL,
	"value" varchar(255) DEFAULT 'false' NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" varchar(64),
	CONSTRAINT "feature_flags_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "user_city_interests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"city" varchar(50) NOT NULL,
	"source" varchar(30) DEFAULT 'floating_banner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "discover_analytics_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"session_id" varchar,
	"event_type" varchar(80) NOT NULL,
	"pool_id" varchar,
	"metadata" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_icebreaker_phase_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_session_id" varchar NOT NULL,
	"phase" varchar NOT NULL,
	"dwell_time_ms" integer,
	"started_at" timestamp,
	"ended_at" timestamp,
	"participant_count" integer,
	"action_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_pool_groups" ADD COLUMN "venue_assignment_status" varchar DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "event_pool_groups" ADD COLUMN "venue_assignment_reason" text;--> statement-breakpoint
ALTER TABLE "event_pool_registrations" ADD COLUMN "preference_strictness" integer DEFAULT 50;--> statement-breakpoint
ALTER TABLE "event_pool_registrations" ADD COLUMN "preferred_districts" text[];--> statement-breakpoint
ALTER TABLE "event_pool_registrations" ADD COLUMN "gender_composition_preference" varchar(20);--> statement-breakpoint
ALTER TABLE "event_pool_registrations" ADD COLUMN "accept_pairs" boolean;--> statement-breakpoint
ALTER TABLE "event_pool_registrations" ADD COLUMN "kol_comfort_level" varchar(20);--> statement-breakpoint
ALTER TABLE "event_pools" ADD COLUMN "price" integer;--> statement-breakpoint
ALTER TABLE "event_pools" ADD COLUMN "preference_lock_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "standardized_occupation_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_preference_strictness" integer DEFAULT 50;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_preferred_districts" text[];--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_gender_composition" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_accept_pairs" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_kol_comfort" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_restart_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "seating_capacity" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "user_city_interests" ADD CONSTRAINT "user_city_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discover_analytics_events" ADD CONSTRAINT "discover_analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_icebreaker_phase_metrics" ADD CONSTRAINT "social_icebreaker_phase_metrics_social_session_id_social_icebreaker_sessions_id_fk" FOREIGN KEY ("social_session_id") REFERENCES "public"."social_icebreaker_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_feature_flags_key" ON "feature_flags" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_city_interests_unique" ON "user_city_interests" USING btree ("user_id","city");--> statement-breakpoint
CREATE INDEX "idx_user_city_interests_city" ON "user_city_interests" USING btree ("city");--> statement-breakpoint
CREATE INDEX "idx_user_city_interests_user" ON "user_city_interests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_dae_user_id" ON "discover_analytics_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_dae_event_type" ON "discover_analytics_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_dae_pool_id" ON "discover_analytics_events" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "idx_dae_timestamp" ON "discover_analytics_events" USING btree ("timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_phase_metrics_session_phase" ON "social_icebreaker_phase_metrics" USING btree ("social_session_id","phase");--> statement-breakpoint
CREATE INDEX "idx_phase_metrics_session" ON "social_icebreaker_phase_metrics" USING btree ("social_session_id");--> statement-breakpoint
CREATE INDEX "idx_phase_metrics_phase" ON "social_icebreaker_phase_metrics" USING btree ("phase");--> statement-breakpoint
CREATE INDEX "idx_event_pool_registrations_pool_id" ON "event_pool_registrations" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "idx_event_pool_registrations_user_id" ON "event_pool_registrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_event_pool_registrations_pool_registered_at" ON "event_pool_registrations" USING btree ("pool_id","registered_at");--> statement-breakpoint
CREATE INDEX "idx_event_pools_status_deadline_datetime" ON "event_pools" USING btree ("status","registration_deadline","date_time","id");
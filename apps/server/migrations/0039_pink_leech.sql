-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: 0039_pink_leech — SNAPSHOT RECONCILIATION
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose: Align drizzle-kit migration snapshot with the current schema.
--          The snapshot drifted (66 tables in old baseline vs 85+ in schema).
-- ⚠️  DO NOT RUN THIS MIGRATION against production or staging databases.
--    The DDL statements below (CREATE TABLE / DROP TABLE) reflect the
--    diff between the STALE snapshot and the ACTUAL schema, but the
--    production database already has all tables in their correct state.
--    Running this would cause "relation already exists" or "relation
--    does not exist" errors.
-- 
-- Production DDL is applied manually via psql per AGENTS.md §3.
-- This file exists solely so drizzle-kit generate can diff against
-- a correct baseline snapshot (0039_snapshot.json, 86 tables).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "admin_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(64) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" varchar(32) DEFAULT 'operator' NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"display_name" varchar(100),
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_accounts_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_id" varchar(64) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"admin_id" varchar(64) NOT NULL,
	"admin_role" varchar(32),
	"action" varchar(64) NOT NULL,
	"target_entity_type" varchar(64) NOT NULL,
	"target_entity_id" varchar(64),
	"before" jsonb,
	"after" jsonb,
	"context" jsonb,
	CONSTRAINT "admin_audit_logs_audit_id_unique" UNIQUE("audit_id")
);
--> statement-breakpoint
CREATE TABLE "onboarding_analytics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"session_id" varchar,
	"step" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"session_duration" integer,
	"step_duration" integer,
	"metadata" jsonb,
	"user_agent" varchar,
	"screen_size" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"user_a_id" varchar NOT NULL,
	"user_b_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"initiator_id" varchar NOT NULL,
	"user_a_wechat_id" varchar,
	"user_b_wechat_id" varchar,
	"revealed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"user_a_connection_reasons" text[],
	"user_a_next_step_preference" varchar,
	"user_b_connection_reasons" text[],
	"user_b_next_step_preference" varchar,
	CONSTRAINT "connections_event_pair_unique" UNIQUE("event_id","user_a_id","user_b_id")
);
--> statement-breakpoint
CREATE TABLE "event_group_outcomes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" varchar NOT NULL,
	"group_id" varchar NOT NULL,
	"submitted_by" varchar NOT NULL,
	"atmosphere_score" integer NOT NULL,
	"would_meet_again" boolean NOT NULL,
	"connection_radar" jsonb NOT NULL,
	"icebreaker_ratings" jsonb NOT NULL,
	"free_text_signal" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pool_ai_copy" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" varchar NOT NULL,
	"segment_hash" varchar NOT NULL,
	"headline" text,
	"subheadline" text,
	"display_status" varchar DEFAULT 'shadow',
	"generated_at" timestamp DEFAULT now(),
	"provider" varchar,
	"fallback_used" boolean DEFAULT false,
	"prompt_version" varchar DEFAULT 'discover-card-v1',
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "archetype_pair_feedback_stats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"archetype_a" varchar(50) NOT NULL,
	"archetype_b" varchar(50) NOT NULL,
	"base_score" integer NOT NULL,
	"sample_count" integer DEFAULT 0 NOT NULL,
	"avg_meet_again" numeric(4, 3),
	"avg_atmosphere" numeric(4, 3),
	"empirical_score" numeric(5, 2),
	"applied_delta" numeric(5, 2) DEFAULT '0' NOT NULL,
	"calibrated_score" numeric(5, 2) NOT NULL,
	"last_aggregated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matching_shadow_experiments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" varchar NOT NULL,
	"mode" varchar DEFAULT 'batch' NOT NULL,
	"model_version" varchar NOT NULL,
	"deterministic_group_count" integer DEFAULT 0 NOT NULL,
	"deterministic_average_score" integer,
	"outcome_sample_count" integer DEFAULT 0 NOT NULL,
	"outcome_positive_rate" numeric(5, 4) DEFAULT '0',
	"average_confidence" numeric(5, 4) DEFAULT '0',
	"rank_agreement_rate" numeric(5, 4) DEFAULT '0',
	"average_score_delta" integer DEFAULT 0,
	"results" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blind_box_pre_attendance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"late_minutes" integer,
	"absent_reason" varchar,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "uq_blind_box_pre_attendance" UNIQUE("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "industry_ai_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255),
	"raw_input" text NOT NULL,
	"ai_category" varchar(50),
	"ai_segment" varchar(100),
	"ai_niche" varchar(150),
	"ai_confidence" numeric(3, 2),
	"ai_reasoning" text,
	"user_accepted" boolean,
	"user_corrected_category" varchar(50),
	"user_corrected_segment" varchar(100),
	"user_corrected_niche" varchar(150),
	"processing_time_ms" integer,
	"model_version" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "industry_seed_candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"raw_input" text NOT NULL,
	"frequency" integer DEFAULT 1,
	"ai_category" varchar(50),
	"ai_segment" varchar(100),
	"ai_niche" varchar(150),
	"avg_confidence" numeric(3, 2),
	"status" varchar(20) DEFAULT 'pending',
	"reviewed_by" varchar(255),
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "industry_seed_candidates_raw_input_unique" UNIQUE("raw_input")
);
--> statement-breakpoint
CREATE TABLE "participation_experiment_events" (
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
CREATE TABLE "pre_generation_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_session_id" varchar NOT NULL,
	"phase" varchar NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"result_id" varchar,
	"error_code" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pre_generation_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_session_id" varchar NOT NULL,
	"phase" varchar NOT NULL,
	"content_json" jsonb NOT NULL,
	"ai_meta" jsonb,
	"judge_scores" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pre_signup_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"temporary_session_id" varchar NOT NULL,
	"metadata" jsonb,
	"answers" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pre_signup_data_temporary_session_id_unique" UNIQUE("temporary_session_id")
);
--> statement-breakpoint
CREATE TABLE "user_interest_signals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"interest_key" varchar NOT NULL,
	"interest_label" varchar NOT NULL,
	"enthusiasm_level" integer DEFAULT 3 NOT NULL,
	"discussion_style" varchar DEFAULT 'casual_vibes' NOT NULL,
	"conversation_depth" integer DEFAULT 2 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_credit_grants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"payment_id" varchar NOT NULL,
	"plan_type" varchar NOT NULL,
	"granted_credits" integer NOT NULL,
	"remaining_credits" integer NOT NULL,
	"expires_at" timestamp,
	"refunded_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_credit_redemptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grant_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"pool_id" varchar NOT NULL,
	"registration_id" varchar NOT NULL,
	"credits_used" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "refund_attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"reason" text,
	"wechat_refund_id" varchar,
	"amount" integer NOT NULL,
	"initiated_by" varchar,
	"initiated_at" timestamp DEFAULT now(),
	"resolved_at" timestamp,
	"failure_reason" text
);
--> statement-breakpoint
CREATE TABLE "moment_card_interactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"device_info" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_icebreaker_ai_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_session_id" varchar NOT NULL,
	"submitted_by" varchar NOT NULL,
	"phase" varchar NOT NULL,
	"prompt_version" varchar NOT NULL,
	"ai_correlation_id" varchar(36) NOT NULL,
	"rating" varchar(16) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_icebreaker_lie_truths" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"statements_json" jsonb NOT NULL,
	"is_ai" boolean DEFAULT false,
	"source_tag" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_icebreaker_participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_icebreaker_phase_pulse_checks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"social_session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"phase" varchar NOT NULL,
	"rating" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_icebreaker_sessions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"icebreaker_session_id" varchar NOT NULL,
	"host_user_id" varchar NOT NULL,
	"host_display_name" varchar NOT NULL,
	"current_phase" varchar DEFAULT 'warmup' NOT NULL,
	"phase_started_at" timestamp NOT NULL,
	"session_started_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"state_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "social_icebreaker_sessions_icebreaker_session_id_unique" UNIQUE("icebreaker_session_id")
);
--> statement-breakpoint
CREATE TABLE "user_interests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"total_heat" integer DEFAULT 0 NOT NULL,
	"total_selections" integer DEFAULT 0 NOT NULL,
	"category_heat" jsonb DEFAULT '{}' NOT NULL,
	"selections" jsonb DEFAULT '[]' NOT NULL,
	"top_priorities" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_semantic_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"profile_document" text NOT NULL,
	"version_vector" jsonb DEFAULT '{}' NOT NULL,
	"generator_version" varchar DEFAULT 'semantic-profile-v1' NOT NULL,
	"embedding" jsonb,
	"embedding_model" varchar,
	"embedding_dimension" integer,
	"last_error" text,
	"last_computed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_social_tag_generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"tags" jsonb NOT NULL,
	"generation_version" text DEFAULT 'v1.0',
	"generated_at" timestamp DEFAULT now(),
	"selected_index" integer,
	"selected_tag" text,
	"selected_at" timestamp,
	"generation_context" jsonb,
	CONSTRAINT "unique_user_latest_tag" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "direct_message_threads" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "direct_messages" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "icebreaker_activity_logs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "icebreaker_checkins" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "icebreaker_ready_votes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "icebreaker_sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "king_game_players" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "king_game_sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "direct_message_threads" CASCADE;--> statement-breakpoint
DROP TABLE "direct_messages" CASCADE;--> statement-breakpoint
DROP TABLE "icebreaker_activity_logs" CASCADE;--> statement-breakpoint
DROP TABLE "icebreaker_checkins" CASCADE;--> statement-breakpoint
DROP TABLE "icebreaker_ready_votes" CASCADE;--> statement-breakpoint
DROP TABLE "icebreaker_sessions" CASCADE;--> statement-breakpoint
DROP TABLE "king_game_players" CASCADE;--> statement-breakpoint
DROP TABLE "king_game_sessions" CASCADE;--> statement-breakpoint
ALTER TABLE "chat_logs" DROP CONSTRAINT "chat_logs_thread_id_direct_message_threads_id_fk";
--> statement-breakpoint
ALTER TABLE "chat_reports" DROP CONSTRAINT "chat_reports_thread_id_direct_message_threads_id_fk";
--> statement-breakpoint
ALTER TABLE "event_attendance" ALTER COLUMN "event_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD COLUMN "skip_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD COLUMN "skipped_question_ids" jsonb DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD COLUMN "answered_question_ids" jsonb DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD COLUMN "current_matches" jsonb DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD COLUMN "question_history" jsonb DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD COLUMN "algorithm_version" varchar(20);--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD COLUMN "match_details_json" jsonb;--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD COLUMN "primary_archetype" varchar(50);--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD COLUMN "is_decisive" boolean;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "blind_box_event_id" varchar;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "attendance_status" varchar DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "estimated_late_minutes" integer;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "absent_reason" varchar;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD COLUMN "attendance_status_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "event_pool_groups" ADD COLUMN "pair_explanations_cache" jsonb;--> statement-breakpoint
ALTER TABLE "event_pool_groups" ADD COLUMN "ice_breakers_cache" jsonb;--> statement-breakpoint
ALTER TABLE "event_pool_groups" ADD COLUMN "predictive_experiment_arm" varchar(20);--> statement-breakpoint
ALTER TABLE "event_pool_groups" ADD COLUMN "predictive_model_version" varchar(50);--> statement-breakpoint
ALTER TABLE "event_pool_groups" ADD COLUMN "predictive_rerank_applied" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "event_pool_groups" ADD COLUMN "predictive_rerank_audit" jsonb;--> statement-breakpoint
ALTER TABLE "event_pool_groups" ADD COLUMN "theme" varchar(50);--> statement-breakpoint
ALTER TABLE "event_pool_groups" ADD COLUMN "subtitle" varchar(80);--> statement-breakpoint
ALTER TABLE "event_pool_groups" ADD COLUMN "vibe" varchar(30);--> statement-breakpoint
ALTER TABLE "event_pool_groups" ADD COLUMN "theme_emoji" varchar(10);--> statement-breakpoint
ALTER TABLE "event_pool_groups" ADD COLUMN "theme_highlights" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "event_pool_groups" ADD COLUMN "theme_reasoning" text;--> statement-breakpoint
ALTER TABLE "event_pool_groups" ADD COLUMN "theme_generated_at" timestamp;--> statement-breakpoint
ALTER TABLE "event_pool_groups" ADD COLUMN "venue_id" varchar;--> statement-breakpoint
ALTER TABLE "event_pool_registrations" ADD COLUMN "event_intent" text[];--> statement-breakpoint
ALTER TABLE "event_pools" ADD COLUMN "budget_restrictions" text[];--> statement-breakpoint
ALTER TABLE "event_pools" ADD COLUMN "bar_budget_restrictions" text[];--> statement-breakpoint
ALTER TABLE "event_pools" ADD COLUMN "predictive_rerank_enabled_override" boolean;--> statement-breakpoint
ALTER TABLE "matching_thresholds" ADD COLUMN "predictive_rerank_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "matching_thresholds" ADD COLUMN "predictive_rerank_exposure_percent" integer DEFAULT 50;--> statement-breakpoint
ALTER TABLE "matching_thresholds" ADD COLUMN "predictive_rerank_max_position_shift" integer DEFAULT 2;--> statement-breakpoint
ALTER TABLE "matching_thresholds" ADD COLUMN "predictive_rerank_confidence_threshold" integer DEFAULT 70;--> statement-breakpoint
ALTER TABLE "matching_thresholds" ADD COLUMN "predictive_rerank_auto_disable_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "matching_thresholds" ADD COLUMN "predictive_rerank_min_shadow_experiments" integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE "matching_thresholds" ADD COLUMN "predictive_rerank_auto_disabled_at" timestamp;--> statement-breakpoint
ALTER TABLE "matching_thresholds" ADD COLUMN "predictive_rerank_auto_disabled_reason" text;--> statement-breakpoint
ALTER TABLE "matching_weights_config" ADD COLUMN "chemistry_weight" numeric(5, 4) DEFAULT '0.28';--> statement-breakpoint
ALTER TABLE "matching_weights_config" ADD COLUMN "interest_weight" numeric(5, 4) DEFAULT '0.28';--> statement-breakpoint
ALTER TABLE "matching_weights_config" ADD COLUMN "social_affinity_weight" numeric(5, 4) DEFAULT '0.20';--> statement-breakpoint
ALTER TABLE "matching_weights_config" ADD COLUMN "background_diversity_weight" numeric(5, 4) DEFAULT '0.15';--> statement-breakpoint
ALTER TABLE "matching_weights_config" ADD COLUMN "preference_weight" numeric(5, 4) DEFAULT '0.05';--> statement-breakpoint
ALTER TABLE "matching_weights_config" ADD COLUMN "language_weight" numeric(5, 4) DEFAULT '0.04';--> statement-breakpoint
ALTER TABLE "matching_weights_config" ADD COLUMN "chemistry_alpha" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "matching_weights_config" ADD COLUMN "chemistry_beta" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "matching_weights_config" ADD COLUMN "interest_alpha" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "matching_weights_config" ADD COLUMN "interest_beta" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "matching_weights_config" ADD COLUMN "social_affinity_alpha" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "matching_weights_config" ADD COLUMN "social_affinity_beta" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "matching_weights_config" ADD COLUMN "background_diversity_alpha" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "matching_weights_config" ADD COLUMN "background_diversity_beta" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "matching_weights_config" ADD COLUMN "preference_alpha" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "matching_weights_config" ADD COLUMN "preference_beta" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "matching_weights_config" ADD COLUMN "language_alpha" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "matching_weights_config" ADD COLUMN "language_beta" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "matching_weights_history" ADD COLUMN "chemistry_weight" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "matching_weights_history" ADD COLUMN "interest_weight" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "matching_weights_history" ADD COLUMN "social_affinity_weight" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "matching_weights_history" ADD COLUMN "background_diversity_weight" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "matching_weights_history" ADD COLUMN "preference_weight" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "matching_weights_history" ADD COLUMN "language_weight" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "matching_weights_history" ADD COLUMN "shadow_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "event_registration_payload" jsonb;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "wechat_prepay_id" varchar;--> statement-breakpoint
ALTER TABLE "pool_matching_logs" ADD COLUMN "predictive_experiment_arm" varchar(20);--> statement-breakpoint
ALTER TABLE "pool_matching_logs" ADD COLUMN "predictive_rerank_applied" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "pool_matching_logs" ADD COLUMN "predictive_rerank_summary" jsonb;--> statement-breakpoint
ALTER TABLE "role_results" ADD COLUMN "primary_archetype" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "role_results" ADD COLUMN "primary_archetype_score" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "role_results" ADD COLUMN "secondary_archetype" varchar;--> statement-breakpoint
ALTER TABLE "role_results" ADD COLUMN "secondary_archetype_score" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wechat_open_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wechat_session_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wechat_nickname" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wechat_avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "has_seen_profile_review" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "has_completed_interests_carousel" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_checkpoint" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_checkpoint_timestamp" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "interests_telemetry" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_languages" text[];--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dietary_restrictions" text[];--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "table_vibe_preference" varchar(30);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "primary_archetype" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "secondary_archetype" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "industry_category" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "industry_category_label" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "industry_segment_new" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "industry_segment_label" varchar(150);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "industry_niche" varchar(150);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "industry_niche_label" varchar(200);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "industry_raw_input" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "industry_normalized" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "industry_source" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "industry_confidence" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "industry_classified_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "industry_last_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "social_tag" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "social_tag_selected_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wechat_contact_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wechat_contact_id_set_at" timestamp;--> statement-breakpoint
ALTER TABLE "venue_time_slot_bookings" ADD COLUMN "venue_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "budget_categories" text[];--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "taste_intensity" text[];--> statement-breakpoint
ALTER TABLE "onboarding_analytics" ADD CONSTRAINT "onboarding_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_a_id_users_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_b_id_users_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_initiator_id_users_id_fk" FOREIGN KEY ("initiator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_group_outcomes" ADD CONSTRAINT "event_group_outcomes_pool_id_event_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."event_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_group_outcomes" ADD CONSTRAINT "event_group_outcomes_group_id_event_pool_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."event_pool_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_group_outcomes" ADD CONSTRAINT "event_group_outcomes_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_ai_copy" ADD CONSTRAINT "pool_ai_copy_pool_id_event_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."event_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_shadow_experiments" ADD CONSTRAINT "matching_shadow_experiments_pool_id_event_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."event_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blind_box_pre_attendance" ADD CONSTRAINT "blind_box_pre_attendance_event_id_blind_box_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."blind_box_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blind_box_pre_attendance" ADD CONSTRAINT "blind_box_pre_attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participation_experiment_events" ADD CONSTRAINT "participation_experiment_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_generation_jobs" ADD CONSTRAINT "pre_generation_jobs_social_session_id_social_icebreaker_sessions_id_fk" FOREIGN KEY ("social_session_id") REFERENCES "public"."social_icebreaker_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_generation_results" ADD CONSTRAINT "pre_generation_results_social_session_id_social_icebreaker_sessions_id_fk" FOREIGN KEY ("social_session_id") REFERENCES "public"."social_icebreaker_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interest_signals" ADD CONSTRAINT "user_interest_signals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_credit_grants" ADD CONSTRAINT "event_credit_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_credit_grants" ADD CONSTRAINT "event_credit_grants_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_credit_redemptions" ADD CONSTRAINT "event_credit_redemptions_grant_id_event_credit_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."event_credit_grants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_credit_redemptions" ADD CONSTRAINT "event_credit_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_credit_redemptions" ADD CONSTRAINT "event_credit_redemptions_pool_id_event_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."event_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_credit_redemptions" ADD CONSTRAINT "event_credit_redemptions_registration_id_event_pool_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_pool_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_attempts" ADD CONSTRAINT "refund_attempts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moment_card_interactions" ADD CONSTRAINT "moment_card_interactions_social_session_id_social_icebreaker_sessions_id_fk" FOREIGN KEY ("social_session_id") REFERENCES "public"."social_icebreaker_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moment_card_interactions" ADD CONSTRAINT "moment_card_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_icebreaker_ai_feedback" ADD CONSTRAINT "social_icebreaker_ai_feedback_social_session_id_social_icebreaker_sessions_id_fk" FOREIGN KEY ("social_session_id") REFERENCES "public"."social_icebreaker_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_icebreaker_ai_feedback" ADD CONSTRAINT "social_icebreaker_ai_feedback_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_icebreaker_lie_truths" ADD CONSTRAINT "social_icebreaker_lie_truths_social_session_id_social_icebreaker_sessions_id_fk" FOREIGN KEY ("social_session_id") REFERENCES "public"."social_icebreaker_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_icebreaker_participants" ADD CONSTRAINT "social_icebreaker_participants_social_session_id_social_icebreaker_sessions_id_fk" FOREIGN KEY ("social_session_id") REFERENCES "public"."social_icebreaker_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_icebreaker_phase_pulse_checks" ADD CONSTRAINT "social_icebreaker_phase_pulse_checks_social_session_id_social_icebreaker_sessions_id_fk" FOREIGN KEY ("social_session_id") REFERENCES "public"."social_icebreaker_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_icebreaker_phase_pulse_checks" ADD CONSTRAINT "social_icebreaker_phase_pulse_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_semantic_profiles" ADD CONSTRAINT "user_semantic_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_social_tag_generations" ADD CONSTRAINT "user_social_tag_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_accounts_username" ON "admin_accounts" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_admin_accounts_role" ON "admin_accounts" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_admin_id" ON "admin_audit_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "admin_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_timestamp" ON "admin_audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_target" ON "admin_audit_logs" USING btree ("target_entity_type","target_entity_id");--> statement-breakpoint
CREATE INDEX "idx_onboarding_analytics_user_id" ON "onboarding_analytics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_onboarding_analytics_session_id" ON "onboarding_analytics" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_onboarding_analytics_step" ON "onboarding_analytics" USING btree ("step");--> statement-breakpoint
CREATE INDEX "idx_onboarding_analytics_event_type" ON "onboarding_analytics" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_onboarding_analytics_timestamp" ON "onboarding_analytics" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_event_group_outcomes_pool_id" ON "event_group_outcomes" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "idx_event_group_outcomes_group_id" ON "event_group_outcomes" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_event_group_outcomes_submitted_by" ON "event_group_outcomes" USING btree ("submitted_by");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_event_group_outcomes_group_submitter" ON "event_group_outcomes" USING btree ("group_id","submitted_by");--> statement-breakpoint
CREATE INDEX "idx_pool_ai_copy_pool_id" ON "pool_ai_copy" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "idx_pool_ai_copy_expires_at" ON "pool_ai_copy" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pool_ai_copy_pool_segment" ON "pool_ai_copy" USING btree ("pool_id","segment_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_archetype_pair_feedback_stats_pair" ON "archetype_pair_feedback_stats" USING btree ("archetype_a","archetype_b");--> statement-breakpoint
CREATE INDEX "idx_archetype_pair_feedback_stats_samples" ON "archetype_pair_feedback_stats" USING btree ("sample_count");--> statement-breakpoint
CREATE INDEX "idx_matching_shadow_experiments_pool" ON "matching_shadow_experiments" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "idx_matching_shadow_experiments_created_at" ON "matching_shadow_experiments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_blind_box_pre_attendance_event" ON "blind_box_pre_attendance" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_ai_logs_user_id" ON "industry_ai_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_logs_created_at" ON "industry_ai_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_seed_candidates_status" ON "industry_seed_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_seed_candidates_frequency" ON "industry_seed_candidates" USING btree ("frequency");--> statement-breakpoint
CREATE INDEX "idx_pex_user_id" ON "participation_experiment_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pex_event_type" ON "participation_experiment_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_pex_pool_id" ON "participation_experiment_events" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "idx_pex_timestamp" ON "participation_experiment_events" USING btree ("timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pre_gen_job_dedupe" ON "pre_generation_jobs" USING btree ("social_session_id","phase");--> statement-breakpoint
CREATE INDEX "idx_pre_gen_job_status" ON "pre_generation_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pre_gen_job_created" ON "pre_generation_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pre_gen_result_dedupe" ON "pre_generation_results" USING btree ("social_session_id","phase");--> statement-breakpoint
CREATE INDEX "idx_pre_gen_result_session" ON "pre_generation_results" USING btree ("social_session_id");--> statement-breakpoint
CREATE INDEX "idx_pre_signup_temp_session" ON "pre_signup_data" USING btree ("temporary_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_interest_signals_user_interest" ON "user_interest_signals" USING btree ("user_id","interest_key");--> statement-breakpoint
CREATE INDEX "idx_user_interest_signals_user_id" ON "user_interest_signals" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_event_credit_grants_payment_id" ON "event_credit_grants" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_event_credit_grants_user_expiry" ON "event_credit_grants" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_event_credit_redemptions_registration_id" ON "event_credit_redemptions" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX "idx_event_credit_redemptions_user_pool" ON "event_credit_redemptions" USING btree ("user_id","pool_id");--> statement-breakpoint
CREATE INDEX "idx_moment_card_session" ON "moment_card_interactions" USING btree ("social_session_id");--> statement-breakpoint
CREATE INDEX "idx_moment_card_action" ON "moment_card_interactions" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_moment_card_created" ON "moment_card_interactions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_social_icebreaker_ai_feedback_dedupe" ON "social_icebreaker_ai_feedback" USING btree ("submitted_by","social_session_id","phase","ai_correlation_id");--> statement-breakpoint
CREATE INDEX "idx_social_icebreaker_ai_feedback_session" ON "social_icebreaker_ai_feedback" USING btree ("social_session_id");--> statement-breakpoint
CREATE INDEX "idx_social_icebreaker_ai_feedback_phase_prompt" ON "social_icebreaker_ai_feedback" USING btree ("phase","prompt_version");--> statement-breakpoint
CREATE INDEX "idx_social_icebreaker_ai_feedback_created" ON "social_icebreaker_ai_feedback" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_social_icebreaker_lie_truths_session_user" ON "social_icebreaker_lie_truths" USING btree ("social_session_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_social_icebreaker_lie_truths_session" ON "social_icebreaker_lie_truths" USING btree ("social_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_social_icebreaker_participants_session_user" ON "social_icebreaker_participants" USING btree ("social_session_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_social_icebreaker_participants_last_seen" ON "social_icebreaker_participants" USING btree ("last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_check_dedupe" ON "social_icebreaker_phase_pulse_checks" USING btree ("social_session_id","user_id","phase");--> statement-breakpoint
CREATE INDEX "idx_pulse_check_session" ON "social_icebreaker_phase_pulse_checks" USING btree ("social_session_id");--> statement-breakpoint
CREATE INDEX "idx_pulse_check_phase" ON "social_icebreaker_phase_pulse_checks" USING btree ("phase");--> statement-breakpoint
CREATE INDEX "idx_pulse_check_created" ON "social_icebreaker_phase_pulse_checks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_social_icebreaker_sessions_icebreaker_session_id" ON "social_icebreaker_sessions" USING btree ("icebreaker_session_id");--> statement-breakpoint
CREATE INDEX "idx_social_icebreaker_sessions_expires_at" ON "social_icebreaker_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_user_interests_user_id" ON "user_interests" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_semantic_profiles_user" ON "user_semantic_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_semantic_profiles_status" ON "user_semantic_profiles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_social_tags_user" ON "user_social_tag_generations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_social_tags_selected" ON "user_social_tag_generations" USING btree ("selected_at");--> statement-breakpoint
ALTER TABLE "event_pool_groups" ADD CONSTRAINT "event_pool_groups_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_time_slot_bookings" ADD CONSTRAINT "venue_time_slot_bookings_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_pool_registrations" DROP COLUMN "social_goals";--> statement-breakpoint
ALTER TABLE "matching_weights_config" DROP COLUMN "personality_weight";--> statement-breakpoint
ALTER TABLE "matching_weights_config" DROP COLUMN "interests_weight";--> statement-breakpoint
ALTER TABLE "matching_weights_config" DROP COLUMN "intent_weight";--> statement-breakpoint
ALTER TABLE "matching_weights_config" DROP COLUMN "background_weight";--> statement-breakpoint
ALTER TABLE "matching_weights_config" DROP COLUMN "culture_weight";--> statement-breakpoint
ALTER TABLE "matching_weights_config" DROP COLUMN "conversation_signature_weight";--> statement-breakpoint
ALTER TABLE "matching_weights_config" DROP COLUMN "personality_alpha";--> statement-breakpoint
ALTER TABLE "matching_weights_config" DROP COLUMN "personality_beta";--> statement-breakpoint
ALTER TABLE "matching_weights_config" DROP COLUMN "interests_alpha";--> statement-breakpoint
ALTER TABLE "matching_weights_config" DROP COLUMN "interests_beta";--> statement-breakpoint
ALTER TABLE "matching_weights_config" DROP COLUMN "intent_alpha";--> statement-breakpoint
ALTER TABLE "matching_weights_config" DROP COLUMN "intent_beta";--> statement-breakpoint
ALTER TABLE "matching_weights_config" DROP COLUMN "background_alpha";--> statement-breakpoint
ALTER TABLE "matching_weights_config" DROP COLUMN "background_beta";--> statement-breakpoint
ALTER TABLE "matching_weights_config" DROP COLUMN "culture_alpha";--> statement-breakpoint
ALTER TABLE "matching_weights_config" DROP COLUMN "culture_beta";--> statement-breakpoint
ALTER TABLE "matching_weights_config" DROP COLUMN "conversation_signature_alpha";--> statement-breakpoint
ALTER TABLE "matching_weights_config" DROP COLUMN "conversation_signature_beta";--> statement-breakpoint
ALTER TABLE "matching_weights_history" DROP COLUMN "personality_weight";--> statement-breakpoint
ALTER TABLE "matching_weights_history" DROP COLUMN "interests_weight";--> statement-breakpoint
ALTER TABLE "matching_weights_history" DROP COLUMN "intent_weight";--> statement-breakpoint
ALTER TABLE "matching_weights_history" DROP COLUMN "background_weight";--> statement-breakpoint
ALTER TABLE "matching_weights_history" DROP COLUMN "culture_weight";--> statement-breakpoint
ALTER TABLE "matching_weights_history" DROP COLUMN "conversation_signature_weight";--> statement-breakpoint
ALTER TABLE "role_results" DROP COLUMN "primary_role";--> statement-breakpoint
ALTER TABLE "role_results" DROP COLUMN "primary_role_score";--> statement-breakpoint
ALTER TABLE "role_results" DROP COLUMN "secondary_role";--> statement-breakpoint
ALTER TABLE "role_results" DROP COLUMN "secondary_role_score";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "age";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "children";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "has_pets";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "pet_types";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "has_siblings";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "has_kids";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "study_locale";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "overseas_regions";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "field_of_study";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "industry";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "role_title_short";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "seniority";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "company_name";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "hometown_country";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "languages_comfort";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "interests_top";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "primary_interests";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "topics_happy";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "topics_avoid";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "topic_avoidances";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "activity_time_preference";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "social_frequency";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "primary_role";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "secondary_role";--> statement-breakpoint
ALTER TABLE "venues" DROP COLUMN "district_id";--> statement-breakpoint
ALTER TABLE "event_pool_registrations" ADD CONSTRAINT "event_pool_registrations_pool_user_unique" UNIQUE("pool_id","user_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_wechat_open_id_unique" UNIQUE("wechat_open_id");
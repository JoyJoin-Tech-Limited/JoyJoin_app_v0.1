CREATE TABLE "assessment_answers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"question_id" varchar NOT NULL,
	"question_level" integer NOT NULL,
	"selected_option" varchar NOT NULL,
	"trait_scores" jsonb NOT NULL,
	"answered_at" timestamp DEFAULT now(),
	CONSTRAINT "assessment_answer_session_question_unique" UNIQUE("session_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "assessment_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"phase" varchar DEFAULT 'pre_signup' NOT NULL,
	"current_question_index" integer DEFAULT 0,
	"trait_scores" jsonb,
	"trait_confidences" jsonb,
	"top_archetypes" jsonb,
	"pre_signup_data" jsonb,
	"final_result" jsonb,
	"validity_score" numeric(3, 2),
	"total_questions" integer DEFAULT 0,
	"is_extended" boolean DEFAULT false,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blind_box_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"city" varchar NOT NULL,
	"district" varchar NOT NULL,
	"date_time" timestamp NOT NULL,
	"budget_tier" varchar NOT NULL,
	"selected_languages" text[],
	"selected_taste_intensity" text[],
	"selected_cuisines" text[],
	"accept_nearby" boolean DEFAULT false,
	"status" varchar DEFAULT 'pending_match' NOT NULL,
	"progress" integer DEFAULT 0,
	"current_participants" integer DEFAULT 1,
	"eta_minutes" integer,
	"restaurant_name" varchar,
	"restaurant_address" varchar,
	"restaurant_lat" varchar,
	"restaurant_lng" varchar,
	"cuisine_tags" text[],
	"total_participants" integer,
	"male_count" integer,
	"female_count" integer,
	"is_girls_night" boolean DEFAULT false,
	"matched_attendees" jsonb,
	"match_explanation" text,
	"invited_count" integer DEFAULT 0,
	"invited_joined" integer DEFAULT 0,
	"pool_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar NOT NULL,
	"event_id" varchar,
	"thread_id" varchar,
	"user_id" varchar,
	"severity" varchar DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar NOT NULL,
	"event_id" varchar,
	"thread_id" varchar,
	"reported_by" varchar NOT NULL,
	"reported_user_id" varchar NOT NULL,
	"report_type" varchar NOT NULL,
	"description" text,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar,
	"review_notes" text,
	"action_taken" varchar,
	"created_at" timestamp DEFAULT now(),
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "contents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"content" text NOT NULL,
	"category" varchar,
	"status" varchar DEFAULT 'draft',
	"priority" integer DEFAULT 0,
	"published_at" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coupon_usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"payment_id" varchar NOT NULL,
	"discount_applied" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"min_purchase" integer,
	"usage_limit" integer,
	"used_count" integer DEFAULT 0,
	"valid_from" timestamp DEFAULT now(),
	"valid_until" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "dialogue_embeddings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_session_id" varchar,
	"source_user_id" varchar,
	"dialogue_content" text NOT NULL,
	"dialogue_summary" text,
	"embedding" jsonb,
	"embedding_model" varchar DEFAULT 'deepseek',
	"embedding_dimension" integer DEFAULT 1536,
	"category" varchar,
	"sentiment" varchar,
	"quality_score" numeric(5, 4),
	"is_successful" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dialogue_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar,
	"user_id" varchar,
	"feedback_type" varchar NOT NULL,
	"overall_rating" integer,
	"helpfulness_rating" integer,
	"personality_rating" integer,
	"feedback_text" text,
	"completion_time" integer,
	"message_count" integer,
	"abandonment_point" varchar,
	"retry_count" integer DEFAULT 0,
	"triggers_used" text[],
	"most_effective_trigger" varchar,
	"dialogue_quality_score" numeric(5, 4),
	"user_engagement_score" numeric(5, 4),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "direct_message_threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user1_id" varchar NOT NULL,
	"user2_id" varchar NOT NULL,
	"event_id" varchar NOT NULL,
	"unlocked_at" timestamp DEFAULT now(),
	"last_message_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "direct_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_attendance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"joined_at" timestamp DEFAULT now(),
	"status" varchar DEFAULT 'confirmed',
	"intent" text[]
);
--> statement-breakpoint
CREATE TABLE "event_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"rating" integer,
	"vibe_match" integer,
	"energy_match" integer,
	"would_attend_again" boolean,
	"feedback" text,
	"connections" text[],
	"atmosphere_score" integer,
	"atmosphere_note" text,
	"attendee_traits" jsonb,
	"connection_radar" jsonb,
	"has_new_connections" boolean,
	"connection_status" varchar,
	"improvement_areas" text[],
	"improvement_other" text,
	"venue_style_rating" varchar,
	"completed_at" timestamp,
	"rewards_claimed" boolean DEFAULT false,
	"reward_points" integer DEFAULT 50,
	"has_deep_feedback" boolean DEFAULT false,
	"match_point_validation" jsonb,
	"additional_match_points" text,
	"conversation_balance" integer,
	"conversation_comfort" integer,
	"conversation_notes" text,
	"future_preferences" text[],
	"future_preferences_other" text,
	"deep_feedback_completed_at" timestamp,
	"triggers_activated" text[],
	"most_impactful_trigger" varchar,
	"trigger_effectiveness_score" numeric(5, 4),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_pool_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" varchar NOT NULL,
	"group_number" integer NOT NULL,
	"member_count" integer DEFAULT 0,
	"avg_chemistry_score" integer,
	"diversity_score" integer,
	"energy_balance" integer,
	"gender_balance_score" integer,
	"overall_score" integer,
	"temperature_level" varchar,
	"match_explanation" text,
	"venue_name" varchar,
	"venue_address" text,
	"final_date_time" timestamp,
	"status" varchar DEFAULT 'confirmed',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_pool_registrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"budget_range" text[],
	"preferred_languages" text[],
	"social_goals" text[],
	"cuisine_preferences" text[],
	"dietary_restrictions" text[],
	"taste_intensity" text[],
	"decor_style_preferences" text[],
	"bar_themes" text[],
	"alcohol_comfort" text[],
	"bar_budget_range" text[],
	"match_status" varchar DEFAULT 'pending',
	"assigned_group_id" varchar,
	"match_score" integer,
	"registered_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_pools" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"event_type" varchar NOT NULL,
	"city" varchar NOT NULL,
	"district" varchar,
	"date_time" timestamp NOT NULL,
	"registration_deadline" timestamp NOT NULL,
	"gender_restriction" varchar,
	"industry_restrictions" text[],
	"seniority_restrictions" text[],
	"education_level_restrictions" text[],
	"age_range_min" integer,
	"age_range_max" integer,
	"gender_balance_mode" varchar DEFAULT 'soft',
	"gender_balance_bonus_points" integer DEFAULT 15,
	"min_female_count" integer DEFAULT 0,
	"min_male_count" integer DEFAULT 0,
	"min_group_size" integer DEFAULT 4,
	"max_group_size" integer DEFAULT 6,
	"target_groups" integer DEFAULT 1,
	"status" varchar DEFAULT 'active',
	"total_registrations" integer DEFAULT 0,
	"successful_matches" integer DEFAULT 0,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"matched_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "event_satisfaction_summary" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"feedback_count" integer DEFAULT 0,
	"avg_atmosphere_score" numeric(3, 2),
	"avg_connection_quality" numeric(3, 2),
	"total_connections_made" integer DEFAULT 0,
	"connection_rate" numeric(5, 4),
	"venue_like_count" integer DEFAULT 0,
	"venue_neutral_count" integer DEFAULT 0,
	"venue_dislike_count" integer DEFAULT 0,
	"avg_match_score" integer,
	"temperature_level" varchar,
	"attendees_with_prior_events" integer DEFAULT 0,
	"repeat_attendee_rate" numeric(5, 4),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"day_of_week" integer NOT NULL,
	"time_of_day" varchar NOT NULL,
	"theme" varchar,
	"gender_restriction" varchar,
	"min_age" integer,
	"max_age" integer,
	"min_participants" integer DEFAULT 5,
	"max_participants" integer DEFAULT 10,
	"custom_price" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"date_time" timestamp NOT NULL,
	"location" varchar NOT NULL,
	"area" varchar,
	"price" integer,
	"max_attendees" integer DEFAULT 10,
	"current_attendees" integer DEFAULT 0,
	"icon_name" varchar,
	"host_id" varchar,
	"status" varchar DEFAULT 'upcoming',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "golden_dialogues" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar NOT NULL,
	"trigger_context" varchar,
	"dialogue_content" text NOT NULL,
	"refined_version" text,
	"success_rate" numeric(5, 4) DEFAULT '0',
	"usage_count" integer DEFAULT 0,
	"positive_reactions" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"is_manually_tagged" boolean DEFAULT false,
	"tagged_by_admin_id" varchar,
	"source_session_id" varchar,
	"source_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gossip_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cluster_hash" varchar(255) NOT NULL,
	"trigger_type" varchar(100) NOT NULL,
	"variants" text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"avg_rating" numeric(3, 2)
);
--> statement-breakpoint
CREATE TABLE "icebreaker_activity_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar,
	"activity_type" varchar NOT NULL,
	"details" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "icebreaker_checkins" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"number_plate" integer,
	"checked_in_at" timestamp DEFAULT now(),
	"is_online" boolean DEFAULT true,
	"last_seen_at" timestamp DEFAULT now(),
	"user_archetype" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "icebreaker_ready_votes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"phase" varchar NOT NULL,
	"voted_at" timestamp DEFAULT now(),
	"is_auto_vote" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "icebreaker_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar,
	"group_id" varchar,
	"blind_box_event_id" varchar,
	"current_phase" varchar DEFAULT 'waiting',
	"phase_started_at" timestamp,
	"expected_attendees" integer DEFAULT 0,
	"checked_in_count" integer DEFAULT 0,
	"ai_welcome_message" text,
	"ai_closing_message" text,
	"recommended_topics" jsonb,
	"auto_advance_timeout" integer DEFAULT 60,
	"min_ready_ratio" integer DEFAULT 50,
	"atmosphere_type" varchar,
	"host_user_id" varchar,
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "icebreaker_sessions_blind_box_event_id_unique" UNIQUE("blind_box_event_id")
);
--> statement-breakpoint
CREATE TABLE "invitation_uses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" varchar NOT NULL,
	"invitee_id" varchar NOT NULL,
	"invitee_event_id" varchar,
	"pool_registration_id" varchar,
	"matched_together" boolean DEFAULT false,
	"reward_issued" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"matched_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar NOT NULL,
	"inviter_id" varchar NOT NULL,
	"event_id" varchar NOT NULL,
	"invitation_type" varchar DEFAULT 'pre_match',
	"total_clicks" integer DEFAULT 0,
	"total_registrations" integer DEFAULT 0,
	"total_acceptances" integer DEFAULT 0,
	"successful_matches" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	CONSTRAINT "invitations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "king_game_players" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"is_ready" boolean DEFAULT false,
	"has_drawn_card" boolean DEFAULT false,
	"card_number" integer,
	"is_king" boolean DEFAULT false,
	"display_name" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "king_game_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"icebreaker_session_id" varchar NOT NULL,
	"player_count" integer NOT NULL,
	"round_number" integer DEFAULT 1,
	"card_assignments" jsonb,
	"mystery_number" integer,
	"dealer_id" varchar,
	"phase" varchar DEFAULT 'waiting',
	"king_user_id" varchar,
	"current_command" text,
	"target_number" integer,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kpi_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_date" date NOT NULL,
	"period_type" varchar DEFAULT 'daily',
	"total_users" integer DEFAULT 0,
	"new_users_today" integer DEFAULT 0,
	"active_users_today" integer DEFAULT 0,
	"active_users_week" integer DEFAULT 0,
	"active_users_month" integer DEFAULT 0,
	"registration_starts" integer DEFAULT 0,
	"registration_completions" integer DEFAULT 0,
	"registration_conversion_rate" numeric(5, 4),
	"total_events" integer DEFAULT 0,
	"new_events_today" integer DEFAULT 0,
	"events_matched_today" integer DEFAULT 0,
	"events_completed_today" integer DEFAULT 0,
	"feedback_count" integer DEFAULT 0,
	"avg_atmosphere_score" numeric(3, 2),
	"avg_connection_quality" numeric(3, 2),
	"csat_score" numeric(5, 2),
	"nps_score" integer,
	"repeat_attendance_rate" numeric(5, 4),
	"day7_retention_rate" numeric(5, 4),
	"day30_retention_rate" numeric(5, 4),
	"churned_users_count" integer DEFAULT 0,
	"avg_events_per_user" numeric(5, 2),
	"avg_match_score" numeric(5, 2),
	"connection_rate" numeric(5, 4),
	"xiaoyue_chat_count" integer DEFAULT 0,
	"avg_xiaoyue_rating" numeric(3, 2),
	"insights_collected_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "match_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user1_id" varchar NOT NULL,
	"user2_id" varchar NOT NULL,
	"event_id" varchar NOT NULL,
	"matched_at" timestamp DEFAULT now(),
	"connection_quality" integer,
	"would_meet_again" boolean,
	"connection_point_types" text[]
);
--> statement-breakpoint
CREATE TABLE "matching_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_name" varchar DEFAULT 'default' NOT NULL,
	"personality_weight" integer DEFAULT 30 NOT NULL,
	"interests_weight" integer DEFAULT 25 NOT NULL,
	"intent_weight" integer DEFAULT 20 NOT NULL,
	"background_weight" integer DEFAULT 15 NOT NULL,
	"culture_weight" integer DEFAULT 10 NOT NULL,
	"min_group_size" integer DEFAULT 5,
	"max_group_size" integer DEFAULT 10,
	"preferred_group_size" integer DEFAULT 7,
	"max_same_archetype_ratio" integer DEFAULT 40,
	"min_chemistry_score" integer DEFAULT 60,
	"is_active" boolean DEFAULT false,
	"notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "matching_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar,
	"config_id" varchar,
	"user_ids" text[],
	"user_count" integer NOT NULL,
	"groups" jsonb NOT NULL,
	"group_count" integer NOT NULL,
	"avg_chemistry_score" integer,
	"avg_diversity_score" integer,
	"overall_match_quality" integer,
	"execution_time_ms" integer,
	"is_test_run" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "matching_thresholds" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"high_compatibility_threshold" integer DEFAULT 85,
	"medium_compatibility_threshold" integer DEFAULT 70,
	"low_compatibility_threshold" integer DEFAULT 55,
	"time_decay_enabled" boolean DEFAULT true,
	"time_decay_rate" integer DEFAULT 5,
	"min_threshold_after_decay" integer DEFAULT 50,
	"min_group_size_for_match" integer DEFAULT 4,
	"optimal_group_size" integer DEFAULT 6,
	"scan_interval_minutes" integer DEFAULT 60,
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "matching_weights_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_name" varchar NOT NULL,
	"is_active" boolean DEFAULT false,
	"personality_weight" numeric(5, 4) DEFAULT '0.23',
	"interests_weight" numeric(5, 4) DEFAULT '0.24',
	"intent_weight" numeric(5, 4) DEFAULT '0.13',
	"background_weight" numeric(5, 4) DEFAULT '0.15',
	"culture_weight" numeric(5, 4) DEFAULT '0.10',
	"conversation_signature_weight" numeric(5, 4) DEFAULT '0.15',
	"personality_alpha" integer DEFAULT 1,
	"personality_beta" integer DEFAULT 1,
	"interests_alpha" integer DEFAULT 1,
	"interests_beta" integer DEFAULT 1,
	"intent_alpha" integer DEFAULT 1,
	"intent_beta" integer DEFAULT 1,
	"background_alpha" integer DEFAULT 1,
	"background_beta" integer DEFAULT 1,
	"culture_alpha" integer DEFAULT 1,
	"culture_beta" integer DEFAULT 1,
	"conversation_signature_alpha" integer DEFAULT 1,
	"conversation_signature_beta" integer DEFAULT 1,
	"total_matches" integer DEFAULT 0,
	"successful_matches" integer DEFAULT 0,
	"average_satisfaction" numeric(5, 4) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "matching_weights_config_config_name_unique" UNIQUE("config_name")
);
--> statement-breakpoint
CREATE TABLE "matching_weights_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" varchar NOT NULL,
	"personality_weight" numeric(5, 4),
	"interests_weight" numeric(5, 4),
	"intent_weight" numeric(5, 4),
	"background_weight" numeric(5, 4),
	"culture_weight" numeric(5, 4),
	"conversation_signature_weight" numeric(5, 4),
	"change_reason" varchar,
	"matches_since_last_update" integer DEFAULT 0,
	"satisfaction_since_last_update" numeric(5, 4),
	"recorded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "moderation_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"target_user_id" varchar,
	"related_report_id" varchar,
	"reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"category" varchar NOT NULL,
	"type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text,
	"related_resource_id" varchar,
	"is_read" boolean DEFAULT false,
	"sent_by" varchar,
	"is_broadcast" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"payment_type" varchar NOT NULL,
	"related_id" varchar,
	"original_amount" integer NOT NULL,
	"discount_amount" integer DEFAULT 0,
	"final_amount" integer NOT NULL,
	"coupon_id" varchar,
	"wechat_transaction_id" varchar,
	"wechat_order_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "personality_questions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_number" integer NOT NULL,
	"category" varchar NOT NULL,
	"question_text" text NOT NULL,
	"question_type" varchar NOT NULL,
	"options" jsonb NOT NULL,
	"test_version" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pool_matching_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pool_id" varchar NOT NULL,
	"scan_type" varchar NOT NULL,
	"pending_users_count" integer DEFAULT 0,
	"current_threshold" integer,
	"time_until_event" integer,
	"groups_formed" integer DEFAULT 0,
	"users_matched" integer DEFAULT 0,
	"avg_group_score" integer,
	"decision" varchar NOT NULL,
	"reason" text,
	"triggered_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pricing_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pricing_id" varchar NOT NULL,
	"old_price_in_cents" integer,
	"new_price_in_cents" integer NOT NULL,
	"change_reason" text,
	"changed_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pricing_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_type" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"display_name_en" varchar,
	"description" text,
	"price_in_cents" integer NOT NULL,
	"original_price_in_cents" integer,
	"duration_days" integer,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false,
	"effective_from" timestamp DEFAULT now(),
	"effective_until" timestamp,
	"created_by" varchar,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pricing_settings_plan_type_unique" UNIQUE("plan_type")
);
--> statement-breakpoint
CREATE TABLE "promotion_banners" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_url" varchar NOT NULL,
	"title" varchar,
	"subtitle" varchar,
	"link_url" varchar,
	"link_type" varchar DEFAULT 'internal',
	"placement" varchar DEFAULT 'discover',
	"city" varchar,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"effective_from" timestamp DEFAULT now(),
	"effective_until" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referral_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"code" varchar NOT NULL,
	"total_clicks" integer DEFAULT 0,
	"total_conversions" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "referral_codes_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "referral_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "referral_conversions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_code_id" varchar NOT NULL,
	"invited_user_id" varchar NOT NULL,
	"inviter_reward_issued" boolean DEFAULT false,
	"invitee_reward_issued" boolean DEFAULT false,
	"converted_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "registration_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"session_mode" varchar NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"l1_completed_at" timestamp,
	"l2_enriched_at" timestamp,
	"completed_at" timestamp,
	"abandoned_at" timestamp,
	"last_touch_at" timestamp DEFAULT now(),
	"l3_confidence" numeric(5, 4),
	"l3_confidence_source" varchar,
	"message_count" integer DEFAULT 0,
	"l2_fields_filled_count" integer DEFAULT 0,
	"fatigue_reminder_triggered" boolean DEFAULT false,
	"device_channel" varchar,
	"user_agent" text,
	"metadata" jsonb,
	"completion_quality" numeric(5, 4),
	"completion_quality_factors" jsonb,
	"triggers_used_in_session" text[],
	"most_effective_trigger_in_session" varchar,
	"ai_response_quality" numeric(5, 4),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" varchar NOT NULL,
	"reported_user_id" varchar,
	"category" varchar NOT NULL,
	"description" text NOT NULL,
	"related_event_id" varchar,
	"status" varchar DEFAULT 'pending',
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"resolution" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reunion_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_event_id" varchar NOT NULL,
	"initiator_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"min_participants" integer DEFAULT 4,
	"max_participants" integer DEFAULT 6,
	"current_accepted" integer DEFAULT 1,
	"expires_at" timestamp NOT NULL,
	"result_event_id" varchar,
	"event_description" text,
	"created_at" timestamp DEFAULT now(),
	"fulfilled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "reunion_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reunion_request_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"notification_sent" boolean DEFAULT false,
	"notification_sent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "role_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"primary_role" varchar NOT NULL,
	"primary_role_score" integer NOT NULL,
	"secondary_role" varchar,
	"secondary_role_score" integer,
	"role_subtype" varchar,
	"role_scores" jsonb NOT NULL,
	"affinity_score" integer NOT NULL,
	"openness_score" integer NOT NULL,
	"conscientiousness_score" integer NOT NULL,
	"emotional_stability_score" integer NOT NULL,
	"extraversion_score" integer NOT NULL,
	"positivity_score" integer NOT NULL,
	"strengths" text,
	"challenges" text,
	"ideal_friend_types" text[],
	"test_version" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"plan_type" varchar NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"amount" integer NOT NULL,
	"payment_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"is_active" boolean DEFAULT true,
	"auto_renew" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "test_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"question_id" varchar NOT NULL,
	"selected_option" varchar,
	"most_like_option" varchar,
	"second_like_option" varchar,
	"test_version" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trigger_performance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger_id" varchar NOT NULL,
	"trigger_name" varchar NOT NULL,
	"trigger_category" varchar,
	"current_threshold" numeric(5, 4) DEFAULT '0.5',
	"default_threshold" numeric(5, 4) DEFAULT '0.5',
	"alpha" integer DEFAULT 1,
	"beta" integer DEFAULT 1,
	"total_triggers" integer DEFAULT 0,
	"successful_triggers" integer DEFAULT 0,
	"abandoned_after_trigger" integer DEFAULT 0,
	"effectiveness_score" numeric(5, 4) DEFAULT '0.5',
	"last_triggered_at" timestamp,
	"last_updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_coupons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"coupon_id" varchar NOT NULL,
	"source" varchar NOT NULL,
	"source_id" varchar,
	"is_used" boolean DEFAULT false,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_engagement_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"total_events_attended" integer DEFAULT 0,
	"total_events_hosted" integer DEFAULT 0,
	"total_feedback_given" integer DEFAULT 0,
	"total_connections_made" integer DEFAULT 0,
	"first_event_date" date,
	"last_event_date" date,
	"last_active_date" date,
	"days_since_last_activity" integer,
	"avg_satisfaction_score" numeric(3, 2),
	"avg_connection_quality" numeric(3, 2),
	"would_recommend_count" integer DEFAULT 0,
	"is_churned" boolean DEFAULT false,
	"churn_risk_score" numeric(3, 2),
	"churned_at" date,
	"reactivated_at" date,
	"registration_cohort" varchar,
	"registration_method" varchar,
	"total_spend" integer DEFAULT 0,
	"event_credits_used" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"display_name" varchar,
	"has_completed_profile_setup" boolean DEFAULT false,
	"has_completed_voice_quiz" boolean DEFAULT false,
	"birthdate" date,
	"age" integer,
	"age_visibility" varchar DEFAULT 'show_age_range',
	"gender" varchar,
	"pronouns" varchar,
	"relationship_status" varchar,
	"children" varchar,
	"has_pets" boolean,
	"pet_types" text[],
	"has_siblings" boolean,
	"has_kids" boolean,
	"life_stage" varchar,
	"age_match_preference" varchar,
	"education_level" varchar,
	"study_locale" varchar,
	"overseas_regions" text[],
	"field_of_study" varchar,
	"education_visibility" varchar DEFAULT 'hide_all',
	"occupation_id" varchar,
	"work_mode" varchar,
	"industry" varchar,
	"role_title_short" varchar,
	"seniority" varchar,
	"company_name" varchar,
	"work_visibility" varchar DEFAULT 'show_industry_only',
	"hometown_country" varchar,
	"hometown_region_city" varchar,
	"hometown_affinity_optin" boolean DEFAULT true,
	"current_city" varchar,
	"languages_comfort" text[],
	"place_of_origin" varchar,
	"long_term_base" varchar,
	"wechat_id" varchar,
	"phone_number" varchar,
	"password" varchar,
	"accessibility_needs" text,
	"safety_note_host" text,
	"intent" text[],
	"has_completed_registration" boolean DEFAULT false,
	"has_completed_interests_topics" boolean DEFAULT false,
	"has_completed_personality_test" boolean DEFAULT false,
	"interests_top" text[],
	"interest_favorite" text,
	"primary_interests" text[],
	"interests_ranked_top3" text[],
	"topics_happy" text[],
	"topics_avoid" text[],
	"topic_avoidances" text[],
	"interests_deep" text[],
	"social_style" varchar,
	"icebreaker_role" varchar,
	"venue_style_preference" varchar,
	"cuisine_preference" text[],
	"favorite_restaurant" varchar,
	"favorite_restaurant_reason" text,
	"activity_time_preference" varchar,
	"social_frequency" varchar,
	"vibe_vector" jsonb,
	"archetype" varchar,
	"debate_comfort" integer,
	"needs_personality_retake" boolean DEFAULT false,
	"personality_traits" jsonb,
	"personality_challenges" text[],
	"ideal_match" text,
	"energy_level" integer,
	"primary_role" varchar,
	"secondary_role" varchar,
	"role_subtype" varchar,
	"events_attended" integer DEFAULT 0,
	"matches_made" integer DEFAULT 0,
	"experience_points" integer DEFAULT 0,
	"joy_coins" integer DEFAULT 0,
	"current_level" integer DEFAULT 1,
	"activity_streak" integer DEFAULT 0,
	"last_activity_date" date,
	"streak_freeze_available" boolean DEFAULT true,
	"event_credits" integer DEFAULT 0,
	"event_credits_expiry" timestamp,
	"is_admin" boolean DEFAULT false,
	"is_banned" boolean DEFAULT false,
	"violation_count" integer DEFAULT 0,
	"daily_token_used" integer DEFAULT 0,
	"last_token_reset_date" date,
	"ai_frozen_until" timestamp,
	"last_violation_reason" varchar,
	"viewed_event_animations" text[],
	"registration_method" varchar,
	"registration_completed_at" timestamp,
	"conversation_mode" varchar,
	"primary_linguistic_style" varchar,
	"conversation_energy" integer,
	"negation_reliability" numeric,
	"inferred_traits" jsonb,
	"inference_confidence" numeric,
	"industry_segment" varchar,
	"structured_occupation" varchar,
	"insight_ledger" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "venue_bookings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" varchar NOT NULL,
	"event_id" varchar NOT NULL,
	"booking_date" timestamp NOT NULL,
	"booking_time" varchar NOT NULL,
	"participant_count" integer NOT NULL,
	"estimated_revenue" integer,
	"actual_revenue" integer,
	"commission_amount" integer,
	"status" varchar DEFAULT 'confirmed',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "venue_deals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" varchar NOT NULL,
	"title" text NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" integer,
	"description" text,
	"redemption_method" text DEFAULT 'show_page',
	"redemption_code" text,
	"min_spend" integer,
	"max_discount" integer,
	"per_person_limit" boolean DEFAULT false,
	"valid_from" date,
	"valid_until" date,
	"terms" text,
	"excluded_dates" text[],
	"is_active" boolean DEFAULT true,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "venue_time_slot_bookings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"time_slot_id" varchar NOT NULL,
	"event_pool_id" varchar,
	"event_group_id" varchar,
	"booking_date" date NOT NULL,
	"status" varchar DEFAULT 'confirmed',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "venue_time_slots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" varchar NOT NULL,
	"day_of_week" integer,
	"specific_date" date,
	"start_time" varchar NOT NULL,
	"end_time" varchar NOT NULL,
	"max_concurrent_events" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"venue_type" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"area" text NOT NULL,
	"district_id" text,
	"contact_person" text,
	"contact_phone" text,
	"commission_rate" integer DEFAULT 20,
	"tags" text[],
	"cuisines" text[],
	"price_range" text,
	"decor_style" text[],
	"bar_themes" text[],
	"alcohol_options" text[],
	"bar_price_range" text,
	"vibe_descriptor" text,
	"capacity" integer DEFAULT 1,
	"operating_hours" text,
	"price_note" text,
	"cover_image_url" text,
	"gallery_images" text[],
	"partner_status" text DEFAULT 'active',
	"partner_since" date,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "xp_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"transaction_type" varchar NOT NULL,
	"xp_amount" integer DEFAULT 0,
	"coins_amount" integer DEFAULT 0,
	"xp_balance" integer DEFAULT 0,
	"coins_balance" integer DEFAULT 0,
	"related_event_id" varchar,
	"related_feedback_id" varchar,
	"description" text,
	"description_cn" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_session_id_assessment_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD CONSTRAINT "assessment_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blind_box_events" ADD CONSTRAINT "blind_box_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_logs" ADD CONSTRAINT "chat_logs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_logs" ADD CONSTRAINT "chat_logs_thread_id_direct_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."direct_message_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_logs" ADD CONSTRAINT "chat_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_thread_id_direct_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."direct_message_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialogue_embeddings" ADD CONSTRAINT "dialogue_embeddings_source_session_id_registration_sessions_id_fk" FOREIGN KEY ("source_session_id") REFERENCES "public"."registration_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialogue_embeddings" ADD CONSTRAINT "dialogue_embeddings_source_user_id_users_id_fk" FOREIGN KEY ("source_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialogue_feedback" ADD CONSTRAINT "dialogue_feedback_session_id_registration_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."registration_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialogue_feedback" ADD CONSTRAINT "dialogue_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message_threads" ADD CONSTRAINT "direct_message_threads_user1_id_users_id_fk" FOREIGN KEY ("user1_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message_threads" ADD CONSTRAINT "direct_message_threads_user2_id_users_id_fk" FOREIGN KEY ("user2_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message_threads" ADD CONSTRAINT "direct_message_threads_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_thread_id_direct_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."direct_message_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_attendance" ADD CONSTRAINT "event_attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_pool_groups" ADD CONSTRAINT "event_pool_groups_pool_id_event_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."event_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_pool_registrations" ADD CONSTRAINT "event_pool_registrations_pool_id_event_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."event_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_pool_registrations" ADD CONSTRAINT "event_pool_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_pools" ADD CONSTRAINT "event_pools_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "golden_dialogues" ADD CONSTRAINT "golden_dialogues_tagged_by_admin_id_users_id_fk" FOREIGN KEY ("tagged_by_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "golden_dialogues" ADD CONSTRAINT "golden_dialogues_source_session_id_registration_sessions_id_fk" FOREIGN KEY ("source_session_id") REFERENCES "public"."registration_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "golden_dialogues" ADD CONSTRAINT "golden_dialogues_source_user_id_users_id_fk" FOREIGN KEY ("source_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_activity_logs" ADD CONSTRAINT "icebreaker_activity_logs_session_id_icebreaker_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."icebreaker_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_activity_logs" ADD CONSTRAINT "icebreaker_activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_checkins" ADD CONSTRAINT "icebreaker_checkins_session_id_icebreaker_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."icebreaker_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_checkins" ADD CONSTRAINT "icebreaker_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_ready_votes" ADD CONSTRAINT "icebreaker_ready_votes_session_id_icebreaker_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."icebreaker_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_ready_votes" ADD CONSTRAINT "icebreaker_ready_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_sessions" ADD CONSTRAINT "icebreaker_sessions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icebreaker_sessions" ADD CONSTRAINT "icebreaker_sessions_group_id_event_pool_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."event_pool_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_uses" ADD CONSTRAINT "invitation_uses_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_uses" ADD CONSTRAINT "invitation_uses_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_uses" ADD CONSTRAINT "invitation_uses_invitee_event_id_blind_box_events_id_fk" FOREIGN KEY ("invitee_event_id") REFERENCES "public"."blind_box_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_uses" ADD CONSTRAINT "invitation_uses_pool_registration_id_event_pool_registrations_id_fk" FOREIGN KEY ("pool_registration_id") REFERENCES "public"."event_pool_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_event_id_blind_box_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."blind_box_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "king_game_players" ADD CONSTRAINT "king_game_players_session_id_king_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."king_game_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "king_game_players" ADD CONSTRAINT "king_game_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "king_game_sessions" ADD CONSTRAINT "king_game_sessions_icebreaker_session_id_icebreaker_sessions_id_fk" FOREIGN KEY ("icebreaker_session_id") REFERENCES "public"."icebreaker_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "king_game_sessions" ADD CONSTRAINT "king_game_sessions_dealer_id_users_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "king_game_sessions" ADD CONSTRAINT "king_game_sessions_king_user_id_users_id_fk" FOREIGN KEY ("king_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_history" ADD CONSTRAINT "match_history_user1_id_users_id_fk" FOREIGN KEY ("user1_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_history" ADD CONSTRAINT "match_history_user2_id_users_id_fk" FOREIGN KEY ("user2_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_history" ADD CONSTRAINT "match_history_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_results" ADD CONSTRAINT "matching_results_config_id_matching_config_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."matching_config"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_thresholds" ADD CONSTRAINT "matching_thresholds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_weights_history" ADD CONSTRAINT "matching_weights_history_config_id_matching_weights_config_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."matching_weights_config"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_logs" ADD CONSTRAINT "moderation_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_logs" ADD CONSTRAINT "moderation_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_logs" ADD CONSTRAINT "moderation_logs_related_report_id_reports_id_fk" FOREIGN KEY ("related_report_id") REFERENCES "public"."reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_matching_logs" ADD CONSTRAINT "pool_matching_logs_pool_id_event_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."event_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_history" ADD CONSTRAINT "pricing_history_pricing_id_pricing_settings_id_fk" FOREIGN KEY ("pricing_id") REFERENCES "public"."pricing_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_history" ADD CONSTRAINT "pricing_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_settings" ADD CONSTRAINT "pricing_settings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_settings" ADD CONSTRAINT "pricing_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_banners" ADD CONSTRAINT "promotion_banners_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_conversions" ADD CONSTRAINT "referral_conversions_referral_code_id_referral_codes_id_fk" FOREIGN KEY ("referral_code_id") REFERENCES "public"."referral_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_conversions" ADD CONSTRAINT "referral_conversions_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_sessions" ADD CONSTRAINT "registration_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_related_event_id_events_id_fk" FOREIGN KEY ("related_event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reunion_requests" ADD CONSTRAINT "reunion_requests_original_event_id_blind_box_events_id_fk" FOREIGN KEY ("original_event_id") REFERENCES "public"."blind_box_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reunion_requests" ADD CONSTRAINT "reunion_requests_initiator_id_users_id_fk" FOREIGN KEY ("initiator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reunion_requests" ADD CONSTRAINT "reunion_requests_result_event_id_blind_box_events_id_fk" FOREIGN KEY ("result_event_id") REFERENCES "public"."blind_box_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reunion_responses" ADD CONSTRAINT "reunion_responses_reunion_request_id_reunion_requests_id_fk" FOREIGN KEY ("reunion_request_id") REFERENCES "public"."reunion_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reunion_responses" ADD CONSTRAINT "reunion_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_results" ADD CONSTRAINT "role_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_responses" ADD CONSTRAINT "test_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_responses" ADD CONSTRAINT "test_responses_question_id_personality_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."personality_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_coupons" ADD CONSTRAINT "user_coupons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_coupons" ADD CONSTRAINT "user_coupons_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_engagement_metrics" ADD CONSTRAINT "user_engagement_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_bookings" ADD CONSTRAINT "venue_bookings_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_bookings" ADD CONSTRAINT "venue_bookings_event_id_blind_box_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."blind_box_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_deals" ADD CONSTRAINT "venue_deals_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_time_slot_bookings" ADD CONSTRAINT "venue_time_slot_bookings_time_slot_id_venue_time_slots_id_fk" FOREIGN KEY ("time_slot_id") REFERENCES "public"."venue_time_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_time_slot_bookings" ADD CONSTRAINT "venue_time_slot_bookings_event_pool_id_event_pools_id_fk" FOREIGN KEY ("event_pool_id") REFERENCES "public"."event_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_time_slot_bookings" ADD CONSTRAINT "venue_time_slot_bookings_event_group_id_event_pool_groups_id_fk" FOREIGN KEY ("event_group_id") REFERENCES "public"."event_pool_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_time_slots" ADD CONSTRAINT "venue_time_slots_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_assessment_answer_session" ON "assessment_answers" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_assessment_answer_question" ON "assessment_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "idx_assessment_session_user" ON "assessment_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_assessment_session_phase" ON "assessment_sessions" USING btree ("phase");--> statement-breakpoint
CREATE INDEX "chat_logs_event_id_idx" ON "chat_logs" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "chat_logs_user_id_idx" ON "chat_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_logs_severity_idx" ON "chat_logs" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "chat_logs_created_at_idx" ON "chat_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_dialogue_embeddings_session" ON "dialogue_embeddings" USING btree ("source_session_id");--> statement-breakpoint
CREATE INDEX "idx_dialogue_embeddings_successful" ON "dialogue_embeddings" USING btree ("is_successful");--> statement-breakpoint
CREATE INDEX "idx_dialogue_feedback_session" ON "dialogue_feedback" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_dialogue_feedback_type" ON "dialogue_feedback" USING btree ("feedback_type");--> statement-breakpoint
CREATE INDEX "idx_dialogue_feedback_rating" ON "dialogue_feedback" USING btree ("overall_rating");--> statement-breakpoint
CREATE INDEX "idx_event_satisfaction_event" ON "event_satisfaction_summary" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_event_satisfaction_type" ON "event_satisfaction_summary" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_golden_dialogues_category" ON "golden_dialogues" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_golden_dialogues_success_rate" ON "golden_dialogues" USING btree ("success_rate");--> statement-breakpoint
CREATE INDEX "idx_gossip_cache_cluster" ON "gossip_cache" USING btree ("cluster_hash");--> statement-breakpoint
CREATE INDEX "idx_gossip_cache_trigger" ON "gossip_cache" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "idx_gossip_cache_cluster_trigger" ON "gossip_cache" USING btree ("cluster_hash","trigger_type");--> statement-breakpoint
CREATE INDEX "idx_kpi_snapshot_date" ON "kpi_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_kpi_period_type" ON "kpi_snapshots" USING btree ("period_type");--> statement-breakpoint
CREATE INDEX "idx_weights_history_config" ON "matching_weights_history" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "idx_weights_history_recorded_at" ON "matching_weights_history" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "idx_reg_sessions_user_id" ON "registration_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_reg_sessions_started_at" ON "registration_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_reg_sessions_completed_at" ON "registration_sessions" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_trigger_performance_id" ON "trigger_performance" USING btree ("trigger_id");--> statement-breakpoint
CREATE INDEX "idx_trigger_performance_effectiveness" ON "trigger_performance" USING btree ("effectiveness_score");--> statement-breakpoint
CREATE INDEX "idx_user_engagement_user" ON "user_engagement_metrics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_engagement_churned" ON "user_engagement_metrics" USING btree ("is_churned");--> statement-breakpoint
CREATE INDEX "idx_user_engagement_last_active" ON "user_engagement_metrics" USING btree ("last_active_date");
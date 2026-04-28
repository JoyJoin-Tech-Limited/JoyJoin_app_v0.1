-- Migration: Reconcile legacy tables and columns
-- Date: 2026-04-23
-- Description: Drops orphaned tables and legacy columns that were removed from schema
-- but never actually dropped from the database.

-- Drop FK constraints referencing direct_message_threads
ALTER TABLE "chat_logs" DROP CONSTRAINT IF EXISTS "chat_logs_thread_id_direct_message_threads_id_fk";
ALTER TABLE "chat_reports" DROP CONSTRAINT IF EXISTS "chat_reports_thread_id_direct_message_threads_id_fk";
ALTER TABLE "direct_messages" DROP CONSTRAINT IF EXISTS "direct_messages_thread_id_direct_message_threads_id_fk";

-- Drop orphaned direct-message tables
DROP TABLE IF EXISTS "direct_messages";
DROP TABLE IF EXISTS "direct_message_threads";

-- Drop legacy columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS age;
ALTER TABLE users DROP COLUMN IF EXISTS children;
ALTER TABLE users DROP COLUMN IF EXISTS has_kids;
ALTER TABLE users DROP COLUMN IF EXISTS has_pets;
ALTER TABLE users DROP COLUMN IF EXISTS pet_types;
ALTER TABLE users DROP COLUMN IF EXISTS has_siblings;
ALTER TABLE users DROP COLUMN IF EXISTS study_locale;
ALTER TABLE users DROP COLUMN IF EXISTS overseas_regions;
ALTER TABLE users DROP COLUMN IF EXISTS field_of_study;
ALTER TABLE users DROP COLUMN IF EXISTS hometown_country;
ALTER TABLE users DROP COLUMN IF EXISTS languages_comfort;
ALTER TABLE users DROP COLUMN IF EXISTS activity_time_preference;
ALTER TABLE users DROP COLUMN IF EXISTS social_frequency;
ALTER TABLE users DROP COLUMN IF EXISTS industry;
ALTER TABLE users DROP COLUMN IF EXISTS role_title_short;
ALTER TABLE users DROP COLUMN IF EXISTS seniority;
ALTER TABLE users DROP COLUMN IF EXISTS company_name;
ALTER TABLE users DROP COLUMN IF EXISTS interests_top;
ALTER TABLE users DROP COLUMN IF EXISTS primary_interests;
ALTER TABLE users DROP COLUMN IF EXISTS topic_avoidances;
ALTER TABLE users DROP COLUMN IF EXISTS topics_happy;
ALTER TABLE users DROP COLUMN IF EXISTS topics_avoid;

-- Drop duplicate social_goals column (renamed to event_intent)
ALTER TABLE event_pool_registrations DROP COLUMN IF EXISTS social_goals;

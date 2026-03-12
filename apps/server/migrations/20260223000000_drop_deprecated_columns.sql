-- Migration: Drop deprecated columns from users table
-- Date: 2026-02-23
-- Removes fields that are no longer collected in onboarding and have low/no matching value.

ALTER TABLE users
  DROP COLUMN IF EXISTS study_locale,
  DROP COLUMN IF EXISTS overseas_regions,
  DROP COLUMN IF EXISTS field_of_study,
  DROP COLUMN IF EXISTS hometown_country,
  DROP COLUMN IF EXISTS languages_comfort,
  DROP COLUMN IF EXISTS activity_time_preference,
  DROP COLUMN IF EXISTS social_frequency;

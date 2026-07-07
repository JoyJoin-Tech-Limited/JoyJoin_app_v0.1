-- Add is_test_session column to social_icebreaker_sessions for matching test mode isolation.
-- The Drizzle schema has this column but it was missing from the staging/production database,
-- causing the server to crash on startup (validateDbSchema fail-fast).
ALTER TABLE social_icebreaker_sessions ADD COLUMN IF NOT EXISTS is_test_session BOOLEAN DEFAULT false;

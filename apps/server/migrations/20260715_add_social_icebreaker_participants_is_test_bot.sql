-- Add is_test_bot marker to social_icebreaker_participants.
-- The column was added to the Drizzle schema (snapshot 0064) but the migration
-- SQL was never generated, so db:push-only environments (local) worked while
-- migration-only environments (staging, production) crashed on every
-- POST /api/social-icebreaker/start with:
--   column "is_test_bot" of relation "social_icebreaker_participants" does not exist
-- Idempotent: safe to re-apply on databases that already have the column.

ALTER TABLE social_icebreaker_participants
  ADD COLUMN IF NOT EXISTS is_test_bot boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_social_icebreaker_participants_is_test_bot
  ON social_icebreaker_participants(is_test_bot);

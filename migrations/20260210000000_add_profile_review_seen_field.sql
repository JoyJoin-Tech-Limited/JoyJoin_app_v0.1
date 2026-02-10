-- Add profile review seen field to users table
-- Fix for Issue 2: Server-persist profile_review_seen flag

BEGIN;

-- Add profile review seen flag
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_seen_profile_review BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN users.has_seen_profile_review IS 'Indicates user has viewed the profile review page (server-persisted, replaces localStorage profile_review_seen)';

COMMIT;

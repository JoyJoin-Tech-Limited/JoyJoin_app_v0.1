-- Add onboarding checkpoint fields to users table
-- This migration adds server-side persistence for onboarding progress
-- to replace localStorage-based state management

-- Add onboarding checkpoint field (tracks last completed step)
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_checkpoint VARCHAR;

-- Add checkpoint timestamp field
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_checkpoint_timestamp TIMESTAMP;

-- Add comment for documentation
COMMENT ON COLUMN users.onboarding_checkpoint IS 'Last completed onboarding step (onboarding, personality-test, essential-data, guide) - replaces localStorage';
COMMENT ON COLUMN users.onboarding_checkpoint_timestamp IS 'Timestamp when checkpoint was saved';

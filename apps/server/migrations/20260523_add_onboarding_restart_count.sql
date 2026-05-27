-- Add onboarding_restart_count to users table
-- Safe additive migration with default 0

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'onboarding_restart_count'
  ) THEN
    ALTER TABLE users ADD COLUMN onboarding_restart_count INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Migration: Add primary_archetype column to users table
-- Date: 2026-01-20
-- Description: Ensures primary_archetype column exists for personality system
-- IDEMPOTENT: Safe to run multiple times

-- Add primary_archetype column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'primary_archetype'
  ) THEN
    ALTER TABLE users ADD COLUMN primary_archetype VARCHAR(50);
    
    -- Add comment to document the column
    COMMENT ON COLUMN users.primary_archetype IS '12 archetypes from personality assessment (animal-based social vibe system)';
  END IF;
END $$;

-- Add secondary_archetype column if it doesn't exist (for completeness)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'secondary_archetype'
  ) THEN
    ALTER TABLE users ADD COLUMN secondary_archetype VARCHAR(50);
    
    -- Add comment to document the column
    COMMENT ON COLUMN users.secondary_archetype IS 'Second highest archetype (used in algorithm, hidden from UI)';
  END IF;
END $$;

-- Note: Both columns are nullable to allow existing users to have NULL values
-- They will be automatically populated when users complete their personality assessment

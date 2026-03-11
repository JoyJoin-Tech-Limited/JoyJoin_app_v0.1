-- Migration: Rename primaryRole/secondaryRole to primaryArchetype/secondaryArchetype
-- This consolidates the dual archetype system to use a single source of truth
-- from the V4 adaptive assessment (assessment_sessions.primaryArchetype)
-- IDEMPOTENT: Safe to run multiple times

-- Step 1: Rename columns in users table (only if old column exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'primary_role'
  ) THEN
    ALTER TABLE users RENAME COLUMN primary_role TO primary_archetype;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'secondary_role'
  ) THEN
    ALTER TABLE users RENAME COLUMN secondary_role TO secondary_archetype;
  END IF;
END $$;

-- Step 2: Rename columns in role_results table (only if old columns exist)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'role_results' AND column_name = 'primary_role'
  ) THEN
    ALTER TABLE role_results RENAME COLUMN primary_role TO primary_archetype;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'role_results' AND column_name = 'primary_role_score'
  ) THEN
    ALTER TABLE role_results RENAME COLUMN primary_role_score TO primary_archetype_score;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'role_results' AND column_name = 'secondary_role'
  ) THEN
    ALTER TABLE role_results RENAME COLUMN secondary_role TO secondary_archetype;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'role_results' AND column_name = 'secondary_role_score'
  ) THEN
    ALTER TABLE role_results RENAME COLUMN secondary_role_score TO secondary_archetype_score;
  END IF;
END $$;

-- Step 3: Add comment to document the change (only if columns exist)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'primary_archetype'
  ) THEN
    COMMENT ON COLUMN users.primary_archetype IS '12 archetypes from V4 adaptive assessment (single source of truth)';
    COMMENT ON COLUMN users.secondary_archetype IS 'Second highest archetype from V4 assessment (used in algorithm, hidden from UI)';
  END IF;
END $$;

-- Step 4: Optional - Backfill users.primary_archetype from assessment_sessions if null
-- This ensures users who completed V4 assessment have their archetype data in users table
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'primary_archetype'
  ) THEN
    UPDATE users u
    SET primary_archetype = a.primary_archetype
    FROM assessment_sessions a
    WHERE u.id = a.user_id 
      AND a.primary_archetype IS NOT NULL
      AND u.primary_archetype IS NULL
      AND a.completed_at IS NOT NULL;
  END IF;
END $$;

-- Note: This migration is backward compatible - the column names change but data is preserved
-- The application code has been updated to use the new field names
-- This migration is IDEMPOTENT and can be safely run multiple times

-- Migration: Add industry_normalized field for AI text normalization
-- Date: 2026-01-14
-- Description: Add normalized input field to support AI text cleaning

BEGIN;

-- Add new column for normalized input
ALTER TABLE users ADD COLUMN IF NOT EXISTS industry_normalized TEXT;

-- Update industry_source constraint to include 'fallback'
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_industry_source_check;
  
  -- Add new constraint with fallback option
  ALTER TABLE users ADD CONSTRAINT users_industry_source_check 
    CHECK (industry_source IN ('seed', 'ontology', 'ai', 'manual', 'fallback'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create index for normalized field (optional, for future search)
CREATE INDEX IF NOT EXISTS idx_users_industry_normalized 
  ON users (industry_normalized) WHERE industry_normalized IS NOT NULL;

-- Migrate existing data: copy raw_input to normalized if normalized is null
UPDATE users 
SET industry_normalized = industry_raw_input
WHERE industry_raw_input IS NOT NULL 
  AND industry_normalized IS NULL;

COMMIT;

-- Rollback instructions (commented out, uncomment if needed):
-- BEGIN;
-- ALTER TABLE users DROP COLUMN IF EXISTS industry_normalized;
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_industry_source_check;
-- ALTER TABLE users ADD CONSTRAINT users_industry_source_check 
--   CHECK (industry_source IN ('seed', 'ontology', 'ai', 'manual'));
-- DROP INDEX IF EXISTS idx_users_industry_normalized;
-- COMMIT;

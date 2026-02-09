-- Team Name Generator & Deprecated Field Removal
-- Part 1: Add team name fields to event_pool_groups
-- Part 2: Remove deprecated work fields from users table

BEGIN;

-- ============================================================================
-- PART 1: Add Team Name Fields to event_pool_groups
-- ============================================================================

-- Add team name, tagline, emoji, and reasoning to groups table
ALTER TABLE event_pool_groups ADD COLUMN IF NOT EXISTS team_name VARCHAR(50);
ALTER TABLE event_pool_groups ADD COLUMN IF NOT EXISTS team_tagline VARCHAR(100);
ALTER TABLE event_pool_groups ADD COLUMN IF NOT EXISTS team_emoji TEXT;
ALTER TABLE event_pool_groups ADD COLUMN IF NOT EXISTS team_name_reasoning TEXT;

-- Add comments for documentation
COMMENT ON COLUMN event_pool_groups.team_name IS 'AI-generated creative team name (8-12 characters)';
COMMENT ON COLUMN event_pool_groups.team_tagline IS 'Team tagline using Mirror + Insight formula (20-30 characters)';
COMMENT ON COLUMN event_pool_groups.team_emoji IS 'Representative emoji for the team';
COMMENT ON COLUMN event_pool_groups.team_name_reasoning IS 'Full provenance explanation with file/line citations';

-- ============================================================================
-- PART 2: Remove Deprecated Profile Fields
-- ============================================================================

-- Remove deprecated work fields that are NOT collected in onboarding
-- These fields were never properly populated and are not part of the 3-tier industry classification

-- 1. seniority: DEPRECATED - was used in matching but never collected in onboarding
ALTER TABLE users DROP COLUMN IF EXISTS seniority;

-- 2. company_name: DEPRECATED - not collected in onboarding, removed from profile edit
ALTER TABLE users DROP COLUMN IF EXISTS company_name;

-- 3. role_title_short: DEPRECATED - replaced by occupationId (standardized occupation system)
ALTER TABLE users DROP COLUMN IF EXISTS role_title_short;

-- 4. industry (legacy field): DEPRECATED - replaced by 3-tier classification
--    The 3-tier system uses: industry_category, industry_category_label, industry_niche, industry_niche_label
--    This legacy field was auto-populated but is no longer part of the data model
ALTER TABLE users DROP COLUMN IF EXISTS industry;

-- ============================================================================
-- KEPT FIELDS (Part of 3-tier industry classification collected in onboarding)
-- ============================================================================
-- ✅ industry_category (Layer 1: e.g., "tech")
-- ✅ industry_category_label (Layer 1 display: e.g., "科技互联网")
-- ✅ industry_niche (Layer 3: e.g., "medical_ai")
-- ✅ industry_niche_label (Layer 3 display: e.g., "医疗AI")
-- ✅ occupation_id (Standardized occupation from occupations.ts)
-- ✅ work_mode (founder, self_employed, employed, student)

COMMIT;

-- Add carousel and guide completion fields to users table
-- Phase 1: Server-side persistence for onboarding flags

BEGIN;

-- Add interest carousel completion flag
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_completed_interests_carousel BOOLEAN DEFAULT false;

-- Add guide seen flag
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_seen_guide BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN users.has_completed_interests_carousel IS 'Indicates user completed new carousel-based interest selection (replaces has_completed_interests_topics)';
COMMENT ON COLUMN users.has_seen_guide IS 'Indicates user has viewed the 3-step onboarding guide (server-persisted, replaces localStorage)';

-- Backfill: Users who completed old interests topics should also have carousel flag
UPDATE users 
SET has_completed_interests_carousel = true 
WHERE has_completed_interests_topics = true 
  AND has_completed_interests_carousel = false;

COMMIT;

-- Migration: Data Model Unification
-- Date: 2026-01-20
-- Description: Remove legacy interest fields and rename socialGoals to eventIntent

-- 1. Remove legacy interest fields from users table
-- These fields are now managed by the user_interests table
ALTER TABLE users DROP COLUMN IF EXISTS interests_top;
ALTER TABLE users DROP COLUMN IF EXISTS primary_interests;
ALTER TABLE users DROP COLUMN IF EXISTS topic_avoidances;
ALTER TABLE users DROP COLUMN IF EXISTS topics_happy;
ALTER TABLE users DROP COLUMN IF EXISTS topics_avoid;

-- 2. Rename socialGoals to eventIntent in eventPoolRegistrations table
ALTER TABLE event_pool_registrations 
RENAME COLUMN social_goals TO event_intent;

-- Note: The user_interests table already exists and contains the new interest data structure

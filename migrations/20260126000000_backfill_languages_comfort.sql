-- Migration: Backfill users.languages_comfort from event registrations
-- Date: 2026-01-26
-- Description: Populate languages_comfort in user profiles from their most recent 
-- event pool registration's preferred_languages field. This ensures existing users
-- have language preferences populated before we rely solely on the profile field.

-- Backfill users.languages_comfort from last event registration where it's empty or null
UPDATE users 
SET languages_comfort = (
  SELECT preferred_languages 
  FROM event_pool_registrations 
  WHERE user_id = users.id 
    AND preferred_languages IS NOT NULL 
    AND array_length(preferred_languages, 1) > 0
  ORDER BY registered_at DESC 
  LIMIT 1
)
WHERE languages_comfort IS NULL OR array_length(languages_comfort, 1) IS NULL OR array_length(languages_comfort, 1) = 0;

-- Log the update results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count 
  FROM users 
  WHERE languages_comfort IS NOT NULL 
    AND array_length(languages_comfort, 1) > 0;
  
  RAISE NOTICE 'Backfill complete. % users now have languages_comfort populated.', updated_count;
END $$;

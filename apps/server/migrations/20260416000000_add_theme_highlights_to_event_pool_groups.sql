-- Add persisted theme highlights to event_pool_groups
-- Aligns database shape with shared schema for matching reveal highlights

BEGIN;

-- Add the column if it is missing, then converge existing rows to the shared-schema contract
ALTER TABLE event_pool_groups
ADD COLUMN IF NOT EXISTS theme_highlights JSONB;

UPDATE event_pool_groups
SET theme_highlights = '[]'::jsonb
WHERE theme_highlights IS NULL;

ALTER TABLE event_pool_groups
ALTER COLUMN theme_highlights SET DEFAULT '[]'::jsonb,
ALTER COLUMN theme_highlights SET NOT NULL;

COMMENT ON COLUMN event_pool_groups.theme_highlights IS 'Persisted reveal highlights as a JSON array of strings for mystery box group themes';

COMMIT;
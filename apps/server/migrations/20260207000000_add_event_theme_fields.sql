-- Migration: Add Event Theme Fields to event_pool_groups
-- Date: 2026-02-07
-- Purpose: Add mystery box (盲盒主题) theme fields for experience design

-- Add theme fields to event_pool_groups table
ALTER TABLE event_pool_groups 
ADD COLUMN IF NOT EXISTS theme VARCHAR(50),
ADD COLUMN IF NOT EXISTS subtitle VARCHAR(80),
ADD COLUMN IF NOT EXISTS vibe VARCHAR(30),
ADD COLUMN IF NOT EXISTS theme_emoji VARCHAR(10),
ADD COLUMN IF NOT EXISTS theme_reasoning TEXT,
ADD COLUMN IF NOT EXISTS theme_generated_at TIMESTAMP;

-- Add index for querying groups with themes
CREATE INDEX IF NOT EXISTS idx_event_pool_groups_theme_generated 
ON event_pool_groups(theme_generated_at) 
WHERE theme IS NOT NULL;

-- Add comment
COMMENT ON COLUMN event_pool_groups.theme IS 'Main theme (12-18 chars): "高能充电站：柯基×狐狸的周末探险"';
COMMENT ON COLUMN event_pool_groups.subtitle IS 'Subtitle (15-25 chars): "广州老乡的咖啡×人脉派对"';
COMMENT ON COLUMN event_pool_groups.vibe IS 'Vibe indicator: "🔥 超高能 (88分)"';
COMMENT ON COLUMN event_pool_groups.theme_emoji IS 'Single emoji: "⚡"';
COMMENT ON COLUMN event_pool_groups.theme_reasoning IS 'Full reasoning with data provenance';
COMMENT ON COLUMN event_pool_groups.theme_generated_at IS 'Theme generation timestamp';

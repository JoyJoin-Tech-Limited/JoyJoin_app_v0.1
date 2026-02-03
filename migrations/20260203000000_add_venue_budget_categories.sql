-- Migration: Add budget categories column to venues table
-- Date: 2026-02-03
-- Description: Add budgetCategories field for standardized budget matching
--              and venueId to eventPoolGroups for venue assignment tracking

-- Add budget categories column to venues
ALTER TABLE venues 
ADD COLUMN IF NOT EXISTS budget_categories TEXT[] DEFAULT '{}';

-- Migrate existing priceRange data to budgetCategories
-- For restaurants, convert priceRange to array format
UPDATE venues 
SET budget_categories = ARRAY[price_range]
WHERE price_range IS NOT NULL 
  AND price_range != '' 
  AND venue_type IN ('restaurant', 'cafe')
  AND (budget_categories IS NULL OR budget_categories = '{}');

-- For bars, use barPriceRange if available, otherwise priceRange
UPDATE venues 
SET budget_categories = ARRAY[bar_price_range]
WHERE bar_price_range IS NOT NULL 
  AND bar_price_range != '' 
  AND venue_type IN ('bar', 'homebar')
  AND (budget_categories IS NULL OR budget_categories = '{}');

-- Fallback: if bar has no barPriceRange, use priceRange
UPDATE venues 
SET budget_categories = ARRAY[price_range]
WHERE price_range IS NOT NULL 
  AND price_range != '' 
  AND venue_type IN ('bar', 'homebar')
  AND (budget_categories IS NULL OR budget_categories = '{}');

-- Add index for array overlap queries (performance optimization)
CREATE INDEX IF NOT EXISTS idx_venues_budget_categories 
ON venues USING GIN(budget_categories);

-- Add comment for documentation
COMMENT ON COLUMN venues.budget_categories IS 'Standardized budget ranges: ["150以下","150-200","200-300","300-500"] for restaurants, ["80以下","80-150"] for bars';

-- Add venueId to event_pool_groups for tracking venue assignments
ALTER TABLE event_pool_groups 
ADD COLUMN IF NOT EXISTS venue_id VARCHAR;

-- Add comment for documentation
COMMENT ON COLUMN event_pool_groups.venue_id IS 'Reference to assigned venue from automatic venue assignment';

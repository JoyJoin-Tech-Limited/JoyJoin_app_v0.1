-- Add brand_name column to venues table for the actual restaurant/bar brand name
-- e.g. "Bruma", "Batch & Co", "海底捞火锅".
-- The existing `name` column continues to serve as the internal/admin identifier.

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS brand_name text;

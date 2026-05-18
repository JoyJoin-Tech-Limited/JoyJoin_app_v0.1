-- Add seating_capacity column to venues table
ALTER TABLE venues ADD COLUMN IF NOT EXISTS seating_capacity INTEGER DEFAULT 1;

-- Backfill: copy capacity values as a starting point for existing venues
UPDATE venues SET seating_capacity = capacity WHERE seating_capacity IS NULL;

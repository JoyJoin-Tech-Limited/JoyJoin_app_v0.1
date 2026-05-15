-- Add price column to event_pools for Oracle Card price display
ALTER TABLE event_pools ADD COLUMN IF NOT EXISTS price integer;

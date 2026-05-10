-- Migration: Add venue location and admin fields
-- Date: 2026-05-07
-- Description: Add latitude/longitude from AMap picker + district_id, cluster_id, notes for admin portal

ALTER TABLE venues
ADD COLUMN IF NOT EXISTS latitude real,
ADD COLUMN IF NOT EXISTS longitude real,
ADD COLUMN IF NOT EXISTS district_id text,
ADD COLUMN IF NOT EXISTS cluster_id text,
ADD COLUMN IF NOT EXISTS notes text;

-- Add indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_venues_latitude ON venues(latitude);
CREATE INDEX IF NOT EXISTS idx_venues_longitude ON venues(longitude);
CREATE INDEX IF NOT EXISTS idx_venues_district_id ON venues(district_id);
CREATE INDEX IF NOT EXISTS idx_venues_cluster_id ON venues(cluster_id);

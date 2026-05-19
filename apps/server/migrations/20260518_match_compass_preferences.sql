-- Match Compass v1.0 preference system schema additions
-- Created: 2026-05-18
-- Idempotent: all ADD COLUMN IF NOT EXISTS

-- users table: Preference DNA defaults
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS default_preference_strictness integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS default_preferred_districts text[],
  ADD COLUMN IF NOT EXISTS default_gender_composition varchar(20),
  ADD COLUMN IF NOT EXISTS default_accept_pairs boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_kol_comfort varchar(20);

-- event_pools table: preference lock timestamp
ALTER TABLE event_pools
  ADD COLUMN IF NOT EXISTS preference_lock_at timestamp;

-- event_pool_registrations table: per-event preferences
ALTER TABLE event_pool_registrations
  ADD COLUMN IF NOT EXISTS preference_strictness integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS preferred_districts text[],
  ADD COLUMN IF NOT EXISTS gender_composition_preference varchar(20),
  ADD COLUMN IF NOT EXISTS accept_pairs boolean,
  ADD COLUMN IF NOT EXISTS kol_comfort_level varchar(20);

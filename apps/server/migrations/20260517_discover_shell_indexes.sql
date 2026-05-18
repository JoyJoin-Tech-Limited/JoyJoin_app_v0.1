-- Discover Predictive Shell performance indexes
-- Applied: 2026-05-17

CREATE INDEX IF NOT EXISTS idx_event_pools_status_deadline_datetime
  ON event_pools (status, registration_deadline, date_time, id);

CREATE INDEX IF NOT EXISTS idx_event_pool_registrations_pool_id
  ON event_pool_registrations (pool_id);

CREATE INDEX IF NOT EXISTS idx_event_pool_registrations_user_id
  ON event_pool_registrations (user_id);

CREATE INDEX IF NOT EXISTS idx_event_pool_registrations_pool_registered_at
  ON event_pool_registrations (pool_id, registered_at);

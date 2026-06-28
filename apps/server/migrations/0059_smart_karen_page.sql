-- Index for joined-events query left-joining event_pool_groups via assigned_group_id.
-- Speeds up the registration → group lookup used by /api/events/joined and shell.events.

CREATE INDEX IF NOT EXISTS idx_event_pool_registrations_assigned_group_id
  ON event_pool_registrations (assigned_group_id);

-- Add matching-test mode markers.
-- is_test_bot identifies synthetic bot users created for matching-test flows.
-- is_test_pool identifies the dedicated pool used for matching-test registration.
-- Both default to false and are ignored by production code paths.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_test_bot boolean DEFAULT false;

ALTER TABLE event_pools
  ADD COLUMN IF NOT EXISTS is_test_pool boolean DEFAULT false;

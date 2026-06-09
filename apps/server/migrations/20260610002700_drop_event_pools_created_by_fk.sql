-- Drop FK constraint on event_pools.created_by to support modern admin_accounts IDs
-- Modern admin accounts exist in admin_accounts table, not users table.
-- created_by now stores either a users.id (legacy) or admin_accounts.id (modern).
ALTER TABLE "event_pools" DROP CONSTRAINT IF EXISTS "event_pools_created_by_users_id_fk";

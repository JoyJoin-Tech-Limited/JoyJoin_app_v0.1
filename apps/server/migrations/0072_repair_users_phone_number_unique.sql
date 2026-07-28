-- Repair staging schema drift: ensure users.phone_number has a unique index.
--
-- Background:
--   The baseline migration defines "users_phone_number_unique" as a UNIQUE
--   constraint on users(phone_number). Staging drift caused the constraint
--   to be missing, which makes ON CONFLICT (phone_number) upserts fail with
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--   specification" (e.g. matching-test bot seeding).
--
-- This script is idempotent: it only creates the index if no duplicate
-- phone_number values exist and the index is not already present. If
-- duplicates exist, it raises an exception so the operator can clean them
-- before retrying.

DO $$
DECLARE
  duplicate_count int;
BEGIN
  SELECT count(*) INTO duplicate_count
  FROM (
    SELECT phone_number
    FROM users
    WHERE phone_number IS NOT NULL
    GROUP BY phone_number
    HAVING count(*) > 1
  ) d;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Cannot create unique index on users.phone_number: % duplicate phone_number values exist. Clean them first.', duplicate_count;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS users_phone_number_unique ON users (phone_number);
END $$;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'users' AND indexname = 'users_phone_number_unique';

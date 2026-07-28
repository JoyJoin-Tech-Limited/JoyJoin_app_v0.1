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
  idx_unique boolean;
  idx_valid boolean;
  idx_ready boolean;
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

  SELECT i.indisunique, i.indisvalid, i.indisready
  INTO idx_unique, idx_valid, idx_ready
  FROM pg_class c
  JOIN pg_index i ON i.indexrelid = c.oid
  WHERE c.relname = 'users_phone_number_unique'
    AND c.relnamespace = 'public'::regnamespace;

  IF FOUND AND (NOT idx_unique OR NOT idx_valid OR NOT idx_ready) THEN
    RAISE NOTICE 'Dropping stale users_phone_number_unique (unique=%, valid=%, ready=%)', idx_unique, idx_valid, idx_ready;
    DROP INDEX public.users_phone_number_unique;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS users_phone_number_unique ON public.users (phone_number);
END $$;

SELECT c.relname AS indexname, i.indisunique, i.indisvalid, i.indisready, pg_get_indexdef(i.indexrelid) AS indexdef
FROM pg_class c
JOIN pg_index i ON i.indexrelid = c.oid
WHERE c.relname = 'users_phone_number_unique'
  AND c.relnamespace = 'public'::regnamespace;

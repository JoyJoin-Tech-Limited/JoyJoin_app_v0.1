-- Per-run internal Alang coordinates. Existing progress rows intentionally stay
-- NULL so stale staging sessions enter the explicit reconfiguration state
-- instead of silently inheriting the demo mission coordinates.
BEGIN;

ALTER TABLE "alang_mission_progress"
  ADD COLUMN IF NOT EXISTS "target_location" jsonb;

ALTER TABLE "alang_mission_progress"
  ADD COLUMN IF NOT EXISTS "companion_end_location" jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'alang_mission_progress'
      AND column_name IN ('target_location', 'companion_end_location')
    GROUP BY table_schema, table_name
    HAVING count(*) = 2
  ) THEN
    RAISE EXCEPTION 'Alang progress point columns were not created';
  END IF;
END $$;

COMMIT;

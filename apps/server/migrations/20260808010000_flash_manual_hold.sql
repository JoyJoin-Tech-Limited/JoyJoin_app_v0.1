-- Staging-only manual NPC availability holds for Street Blind Box QA.
--
-- Rollout order: migrate first, deploy compatible application code second, then
-- start a hold through the audited admin endpoint. Old application code ignores
-- plan-less rows, so the expand/deploy compatibility window is safe.
--
-- Rollback: explicitly stop every active manual hold, roll back application code,
-- and leave these additive columns/indexes in place. Re-tightening NOT NULL is a
-- separate contract step and must only happen after manual rows are removed.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.flash_shifts') IS NULL THEN
    RAISE EXCEPTION 'flash_shifts must exist before applying manual hold migration';
  END IF;
END $$;

ALTER TABLE flash_shifts
  ALTER COLUMN plan_id DROP NOT NULL,
  ALTER COLUMN ends_at DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS availability_mode varchar(24) NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS manual_hold_started_by varchar(120),
  ADD COLUMN IF NOT EXISTS manual_hold_stopped_by varchar(120);

ALTER TABLE flash_shifts DROP CONSTRAINT IF EXISTS ck_flash_shifts_time;
ALTER TABLE flash_shifts DROP CONSTRAINT IF EXISTS ck_flash_shifts_availability_mode;

ALTER TABLE flash_shifts
  ADD CONSTRAINT ck_flash_shifts_time CHECK (
    (availability_mode = 'scheduled'
      AND plan_id IS NOT NULL
      AND ends_at IS NOT NULL
      AND ends_at > starts_at)
    OR
    (availability_mode = 'manual_hold'
      AND plan_id IS NULL
      AND source = 'manual'
      AND manual_hold_started_by IS NOT NULL
      AND (
        (status = 'published' AND ends_at IS NULL)
        OR (status = 'cancelled' AND ends_at IS NOT NULL AND ends_at >= starts_at)
      ))
  ),
  ADD CONSTRAINT ck_flash_shifts_availability_mode
    CHECK (availability_mode IN ('scheduled', 'manual_hold'));

DROP INDEX IF EXISTS idx_flash_shifts_live;
CREATE INDEX IF NOT EXISTS idx_flash_shifts_live
  ON flash_shifts(status, availability_mode, starts_at, ends_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_flash_shifts_active_manual_hold_npc
  ON flash_shifts(npc_id)
  WHERE availability_mode = 'manual_hold' AND status = 'published';

DO $$
DECLARE
  invalid_rows bigint;
BEGIN
  SELECT count(*) INTO invalid_rows
  FROM flash_shifts
  WHERE availability_mode = 'scheduled'
    AND (plan_id IS NULL OR ends_at IS NULL OR ends_at <= starts_at);

  IF invalid_rows <> 0 THEN
    RAISE EXCEPTION 'manual hold migration postcondition failed: % invalid scheduled rows', invalid_rows;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'flash_shifts'
      AND indexname = 'uq_flash_shifts_active_manual_hold_npc'
  ) THEN
    RAISE EXCEPTION 'manual hold migration postcondition failed: unique active-hold index missing';
  END IF;
END $$;

COMMIT;

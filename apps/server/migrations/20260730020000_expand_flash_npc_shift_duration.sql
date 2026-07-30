DO $$
BEGIN
  IF to_regclass('public.flash_npcs') IS NULL THEN
    RAISE NOTICE 'flash_npcs does not exist; skipping shift-duration migration';
    RETURN;
  END IF;

  ALTER TABLE flash_npcs
    DROP CONSTRAINT IF EXISTS ck_flash_npcs_shift_duration;

  ALTER TABLE flash_npcs
    ALTER COLUMN min_shift_minutes SET DEFAULT 180,
    ALTER COLUMN max_shift_minutes SET DEFAULT 300;

  UPDATE flash_npcs
  SET
    min_shift_minutes = 180,
    max_shift_minutes = 300,
    updated_at = NOW()
  WHERE min_shift_minutes <> 180
     OR max_shift_minutes <> 300;

  ALTER TABLE flash_npcs
    ADD CONSTRAINT ck_flash_npcs_shift_duration
    CHECK (
      min_shift_minutes BETWEEN 180 AND 300
      AND max_shift_minutes BETWEEN min_shift_minutes AND 300
      AND min_gap_minutes >= 90
    );

  IF EXISTS (
    SELECT 1
    FROM flash_npcs
    WHERE min_shift_minutes <> 180
       OR max_shift_minutes <> 300
  ) THEN
    RAISE EXCEPTION 'flash_npcs shift-duration backfill did not converge to 180-300 minutes';
  END IF;
END $$;

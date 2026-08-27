-- C4 Guidance Queue (2026-08-27): server-persisted guidance-tip seen-state.
-- Shape: { [tipId]: isoDate }. NULL = empty map (handled in code, no backfill).
-- Additive + nullable + idempotent; rollback = leave the column (harmless).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "seen_guidance" jsonb;

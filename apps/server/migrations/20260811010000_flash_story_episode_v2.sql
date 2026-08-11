-- Story episode v2: multi-node state-driven branching.
-- Adds traversal columns to flash_story_universe_runs (idempotent, additive only).
BEGIN;

ALTER TABLE flash_story_universe_runs
  ADD COLUMN IF NOT EXISTS current_node varchar(80),
  ADD COLUMN IF NOT EXISTS node_path jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS v2_state jsonb;

COMMIT;

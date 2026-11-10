-- G0 (2026-11-10): reveal-gated mutual connection selection (24h 互选闭环).
--
-- Plan: docs/strategy/2026-11-10-icebreaker-commercial-execution-plan.md §3.2
--
--   1. connections.reveal_at — the table-wide reveal instant a
--      `mutual_pending` pair is waiting for. NULL for every legacy row
--      (flag `mutualSelectionV2Enabled` OFF flips straight to `mutual`).
--   2. connection_selection_windows — optional per-event ops override of the
--      derived window (opens = start + 3h, reveal = next 21:00 Asia/Shanghai
--      at-or-after start + 24h, closes = reveal). A missing row means "use the
--      derived default"; the server never lazily writes one.
--
-- Additive only: no column is dropped, renamed or tightened, and every new
-- column/table is nullable-or-opt-in, so the previous release keeps working
-- unchanged during the compatibility window. Safe to re-run.
--
-- Apply with:
--   psql "$DATABASE_URL" -f apps/server/migrations/0101_connection_selection_windows.sql
-- (staging first, then production — the deploy script never runs DDL.)

ALTER TABLE "connections"
  ADD COLUMN IF NOT EXISTS "reveal_at" timestamp with time zone;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "connection_selection_windows" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" varchar NOT NULL,
  "opens_at" timestamp with time zone NOT NULL,
  "closes_at" timestamp with time zone NOT NULL,
  "reveal_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint

-- PostgreSQL has no `ADD CONSTRAINT IF NOT EXISTS`, so both constraints are
-- guarded by a pg_constraint probe to keep this script idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'connection_selection_windows_event_id_unique'
      AND conrelid = 'connection_selection_windows'::regclass
  ) THEN
    ALTER TABLE "connection_selection_windows"
      ADD CONSTRAINT "connection_selection_windows_event_id_unique" UNIQUE ("event_id");
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'connection_selection_windows_event_id_events_id_fk'
      AND conrelid = 'connection_selection_windows'::regclass
  ) THEN
    ALTER TABLE "connection_selection_windows"
      ADD CONSTRAINT "connection_selection_windows_event_id_events_id_fk"
      FOREIGN KEY ("event_id") REFERENCES "events"("id");
  END IF;
END $$;--> statement-breakpoint

-- Reveal sweep predicate: `status = 'mutual_pending' AND reveal_at <= now()`.
-- The partial index only covers waiting pairs, so it stays small even as the
-- table grows with every revealed/legacy row.
CREATE INDEX IF NOT EXISTS "connections_mutual_pending_reveal_at_idx"
  ON "connections" ("reveal_at")
  WHERE "status" = 'mutual_pending';

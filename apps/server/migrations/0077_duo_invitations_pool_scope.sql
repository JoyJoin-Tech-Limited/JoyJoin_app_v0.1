-- 双人成行 (duo registration) — pool-scoped invitations (2026-08-07)
-- Additive, idempotent, safe to re-run. Local dev may instead use db:push.
--
-- 1. Duo invitations are scoped to an event pool (event_pools.id), not to a
--    legacy blind-box event, so invitations.event_id must become nullable.
-- 2. New nullable invitations.pool_id column (FK to event_pools).
-- 3. Index on pool_id backs duo-invite idempotency lookups and duo-status.

ALTER TABLE "invitations" ALTER COLUMN "event_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "pool_id" varchar;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invitations_pool_id_event_pools_id_fk'
  ) THEN
    ALTER TABLE "invitations" ADD CONSTRAINT "invitations_pool_id_event_pools_id_fk"
      FOREIGN KEY ("pool_id") REFERENCES "public"."event_pools"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invitations_pool_id" ON "invitations" USING btree ("pool_id");

-- Sprint S2: content_filter_logs moderation review overlay (additive nullable/default ONLY, no backfill).
-- Existing rows read review_status='pending' / miss_flag=false via column defaults.
-- Every statement is idempotent (IF NOT EXISTS / DO-block) per database-migration-safety skill.

ALTER TABLE "content_filter_logs" ADD COLUMN IF NOT EXISTS "review_status" varchar(16) NOT NULL DEFAULT 'pending';
ALTER TABLE "content_filter_logs" ADD COLUMN IF NOT EXISTS "reviewed_by" varchar REFERENCES "users"("id");
ALTER TABLE "content_filter_logs" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;
ALTER TABLE "content_filter_logs" ADD COLUMN IF NOT EXISTS "miss_flag" boolean NOT NULL DEFAULT false;
ALTER TABLE "content_filter_logs" ADD COLUMN IF NOT EXISTS "review_note" text;

-- PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS; guard via pg_constraint lookup.
-- Mirrors the Drizzle .check() declared in packages/shared/src/schema/_definitions.ts
-- (content_filter_logs_review_status_check) so db:push / db:verify see no drift.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_filter_logs_review_status_check'
  ) THEN
    ALTER TABLE "content_filter_logs"
      ADD CONSTRAINT "content_filter_logs_review_status_check"
      CHECK ("review_status" IN ('pending','reviewed','dismissed','actioned'));
  END IF;
END $$;

-- Ops-queue query index (GET /api/admin/content-filter/logs filter by review_status).
CREATE INDEX IF NOT EXISTS "idx_content_filter_logs_review_status"
  ON "content_filter_logs" ("review_status");

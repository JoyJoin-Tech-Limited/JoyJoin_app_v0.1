-- Operator-review gate for matching group formation (Phase 3)
-- Adds additive columns for default-off operator review of formed groups.

ALTER TABLE "event_pools" ADD COLUMN IF NOT EXISTS "operator_review_status" varchar DEFAULT 'none';
ALTER TABLE "event_pools" ADD COLUMN IF NOT EXISTS "operator_review_reason" text;
ALTER TABLE "event_pools" ADD COLUMN IF NOT EXISTS "operator_reviewed_by" varchar;
ALTER TABLE "event_pools" ADD COLUMN IF NOT EXISTS "operator_reviewed_at" timestamp;

ALTER TABLE "event_pool_groups" ADD COLUMN IF NOT EXISTS "operator_review_status" varchar DEFAULT 'none';
ALTER TABLE "event_pool_groups" ADD COLUMN IF NOT EXISTS "operator_review_reason" text;
ALTER TABLE "event_pool_groups" ADD COLUMN IF NOT EXISTS "operator_reviewed_by" varchar;
ALTER TABLE "event_pool_groups" ADD COLUMN IF NOT EXISTS "operator_reviewed_at" timestamp;

CREATE INDEX IF NOT EXISTS "idx_event_pools_operator_review_status" ON "event_pools" ("operator_review_status");
CREATE INDEX IF NOT EXISTS "idx_event_pool_groups_operator_review_status" ON "event_pool_groups" ("operator_review_status");

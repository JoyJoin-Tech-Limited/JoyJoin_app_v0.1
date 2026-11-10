-- G0 P0 hardening (2026-11-10, sprint-contract.g0-p0-hardening):
-- cross-replica dedupe for the `mutual_match` reveal notification.
--
-- Why: `lib/connectionRevealNotifications.ts` guarded duplicates with a
-- non-locking `WHERE NOT EXISTS (user, type, related_resource_id)`. Two server
-- replicas sweeping the same reveal window can both pass that read and both
-- insert, so a revealed pair could produce two 「互选揭晓」 notifications per
-- side. The INSERT now also carries `ON CONFLICT DO NOTHING`, which needs a
-- real unique index to have something to conflict with.
--
-- Scope is deliberately narrow — ONLY `type = 'mutual_match'` with a non-NULL
-- `related_resource_id`:
--   * broadcast/admin notifications legitimately repeat (same user, NULL or
--     shared resource id) and must not be constrained;
--   * other notification types (refunds, seat-vacated notices) keep their own
--     dedupe keys.
--
-- Existing rows: rows created before this migration may contain duplicates
-- (that is exactly the bug). Step 1 keeps the EARLIEST row per key and deletes
-- only the exact duplicates of that one key. No table is dropped and no
-- non-duplicate row is touched. The DELETE is idempotent: re-running after the
-- index exists finds nothing (and the index creation is `IF NOT EXISTS`).
--
-- Apply with:
--   psql "$DATABASE_URL" -f apps/server/migrations/0102_notification_mutual_match_dedupe.sql
-- (staging first, then production — the deploy script never runs DDL.)
--
-- Rollback:
--   DROP INDEX IF EXISTS "notifications_mutual_match_user_resource_uidx";
--   -- Optional, only if you also revert the `ON CONFLICT DO NOTHING` insert:
--   -- deleted duplicates are NOT recoverable. They were re-sends of the same
--   -- 「互选揭晓」 event, so nothing user-meaningful is lost.
--
-- Expected impact: a handful of rows on any environment where a reveal tick
-- overlapped another tick. Staging holds 0 `social_icebreaker_sessions` and near
-- 0 revealed connections, so the DELETE should report 0 rows there.

-- Step 1 — remove pre-existing duplicates of the revealed-connection key.
-- ROW_NUMBER() (not a bare GROUP BY) because the "keeper" must be deterministic:
-- the earliest notification is the one the user actually acted on.
WITH ranked_mutual_match AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "user_id", "related_resource_id"
      ORDER BY "created_at" ASC NULLS LAST, "id" ASC
    ) AS "rank"
  FROM "notifications"
  WHERE "type" = 'mutual_match'
    AND "related_resource_id" IS NOT NULL
)
DELETE FROM "notifications" AS n
USING ranked_mutual_match AS r
WHERE n."id" = r."id"
  AND r."rank" > 1;--> statement-breakpoint

-- Step 2 — the partial unique index the ON CONFLICT clause targets.
-- Partial (not a plain UNIQUE) so every other notification type keeps its
-- current duplicate-tolerant behaviour.
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_mutual_match_user_resource_uidx"
  ON "notifications" ("user_id", "related_resource_id")
  WHERE "type" = 'mutual_match'
    AND "related_resource_id" IS NOT NULL;

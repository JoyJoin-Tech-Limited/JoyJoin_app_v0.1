import { sql } from "drizzle-orm";
import { db } from "../db";
import type { GuidanceTipId } from "@shared/api";
import { logger } from "../lib/logger";

/**
 * Guidance queue persistence (C4 onboarding guidance, 2026-08-27).
 *
 * `users.seen_guidance` is a jsonb map `{ [tipId]: isoDate }`. NULL = empty
 * map. Writes are first-write-wins: the earliest sighting timestamp of a tip
 * always survives.
 */

export interface MarkGuidanceSeenResult {
  /** ISO timestamp persisted for this tip (the earliest write). */
  seenAt: string;
  /** true when the tip was already recorded (idempotent no-op repost). */
  alreadySeen: boolean;
}

/**
 * Record a guidance tip as seen for a user — a SINGLE atomic Postgres
 * statement, never a JS read-modify-write (a read-then-merge in application
 * code is a lost-update race where the LATER timestamp wins).
 *
 * Mechanism: the guarded UPDATE takes the row lock; a concurrent second
 * UPDATE waits on the lock, then re-evaluates its WHERE against the committed
 * row — `NOT (seen_guidance ? tipId)` is now false, so it matches 0 rows and
 * becomes a no-op. Overlapping/repeated posts therefore converge on the
 * earliest `now()`. The UNION ALL fallback SELECT rides the same statement so
 * a no-op still returns the preserved (earliest) timestamp.
 */
export async function markGuidanceTipSeen(
  userId: string,
  tipId: GuidanceTipId,
): Promise<MarkGuidanceSeenResult> {
  const result = await db.execute(sql`
    WITH updated AS (
      UPDATE users
      SET seen_guidance = jsonb_set(
            COALESCE(seen_guidance, '{}'::jsonb),
            ARRAY[${tipId}],
            to_jsonb(now()),
            true
          )
      WHERE id = ${userId}
        AND (seen_guidance IS NULL OR NOT (seen_guidance ? ${tipId}))
      RETURNING seen_guidance ->> ${tipId} AS seen_at
    )
    SELECT seen_at, true AS inserted FROM updated
    UNION ALL
    SELECT seen_guidance ->> ${tipId} AS seen_at, false AS inserted
    FROM users
    WHERE id = ${userId}
      AND NOT EXISTS (SELECT 1 FROM updated)
    LIMIT 1
  `);

  const row = (result.rows?.[0] ?? null) as
    | { seen_at: string | null; inserted: boolean }
    | null;

  if (!row || !row.seen_at) {
    // Only reachable when the user row does not exist (authenticated session
    // for a deleted user). Fail loudly — the route maps this to a 404 rather
    // than silently pretending the write happened.
    logger.warn("[GuidanceRepo] mark-seen matched no user row", { userId, tipId });
    throw new GuidanceUserNotFoundError(userId);
  }

  return { seenAt: row.seen_at, alreadySeen: !row.inserted };
}

export class GuidanceUserNotFoundError extends Error {
  constructor(public readonly userId: string) {
    super(`User not found for guidance mark-seen: ${userId}`);
    this.name = "GuidanceUserNotFoundError";
  }
}

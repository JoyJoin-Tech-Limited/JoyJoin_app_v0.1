/**
 * Reveal notification fan-out (G0, 2026-11-10 — 24h 互选闭环).
 *
 * When `finalizeConnectionReveals()` flips a due `mutual_pending` row to
 * `mutual`, BOTH sides need to know the pair is now visible — otherwise the
 * reveal is silent and only discoverable by opening Connections.
 *
 * Delivery scope (deliberate): in-app notification ONLY. No push, no WeChat
 * subscribe message — that is a separate delivery decision with its own template
 * and quota; this module must stay inside the existing `notifications` table.
 *
 * Copy rules (plan §3.3 `attribution` boundary):
 *   - never the peer's name / id / archetype;
 *   - never a count ("3 位同桌选了你" would leak the selection graph);
 *   - the deep link is the Connections tab (`type: 'mutual_match'`), which
 *     `apps/mini-program/src/lib/navigation/notificationNavigation.ts` already
 *     maps to `switchTab(Connections)`. No client change required.
 *
 * Idempotency: the INSERT is `… SELECT … WHERE NOT EXISTS (same user + type +
 * related_resource_id)` for both recipients in ONE statement, keyed by the
 * connection id. A connection reveals exactly once, so (user, connection) is
 * also the reveal-day key — duplicate or overlapping scheduler ticks insert
 * nothing. No unique index is added here (that would need a migration and could
 * conflict with pre-existing duplicate legacy rows); the follow-up if multi-
 * replica double-sends ever matter is `UNIQUE (user_id, type,
 * related_resource_id)` on `notifications`.
 *
 * Fail-open: one broken connection (or a missing `notifications` row target)
 * must never abort the sweep — it is logged and the next tick retries the rest.
 */

import { sql } from "drizzle-orm";
import { db } from "../db";
import { logger } from "./logger";
import type { RevealedConnectionSummary } from "../repositories/connectionSelectionRepo";

export const CONNECTION_REVEAL_NOTIFICATION = {
  category: "chat",
  type: "mutual_match",
  title: "互选揭晓",
  message: "有同桌和你互相选择，去看看吧",
} as const;

/** Upper bound per tick — reveals arrive in table-sized batches. */
export const REVEAL_NOTIFICATION_BATCH_LIMIT = 200;

export interface RevealNotificationExecutor {
  execute: (statement: unknown) => Promise<{ rows?: unknown[] } | undefined>;
}

export interface RevealNotificationResult {
  /** Connections that produced at least one new notification. */
  notifiedConnections: number;
  /** Notification rows actually inserted (≤ 2 per connection). */
  notifiedUsers: number;
  /** Connections skipped because both rows already existed (dedupe hit). */
  skippedDuplicates: number;
  /** Connections whose insert failed (logged; next tick retries). */
  failed: number;
}

/**
 * Insert one notification per side for every revealed connection.
 *
 * Exported for tests and for an ops re-run; `connections` comes straight from
 * `finalizeConnectionReveals()` so only freshly-flipped rows are passed in.
 */
export async function notifyRevealedConnections(
  connections: readonly RevealedConnectionSummary[],
  options: {
    executor?: RevealNotificationExecutor;
    limit?: number;
  } = {},
): Promise<RevealNotificationResult> {
  const executor: RevealNotificationExecutor = options.executor ?? db;
  const limit = Math.max(
    0,
    Math.min(options.limit ?? REVEAL_NOTIFICATION_BATCH_LIMIT, REVEAL_NOTIFICATION_BATCH_LIMIT),
  );

  const result: RevealNotificationResult = {
    notifiedConnections: 0,
    notifiedUsers: 0,
    skippedDuplicates: 0,
    failed: 0,
  };

  for (const connection of connections.slice(0, limit)) {
    const { userAId, userBId, id: connectionId } = connection;
    if (!connectionId || !userAId || !userBId || userAId === userBId) {
      // A malformed/degenerate row must not produce a self-notification.
      logger.warn("[Connections] Skipping reveal notification for unusable row", {
        connectionId,
        hasUserA: Boolean(userAId),
        hasUserB: Boolean(userBId),
      });
      continue;
    }

    try {
      const inserted = await executor.execute(sql`
        INSERT INTO notifications (user_id, category, type, title, message, related_resource_id, is_read)
        SELECT recipient.user_id, ${CONNECTION_REVEAL_NOTIFICATION.category}, ${CONNECTION_REVEAL_NOTIFICATION.type}, ${CONNECTION_REVEAL_NOTIFICATION.title}, ${CONNECTION_REVEAL_NOTIFICATION.message}, ${connectionId}, false
        FROM (VALUES (${userAId}), (${userBId})) AS recipient(user_id)
        WHERE NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.user_id = recipient.user_id
            AND n.type = ${CONNECTION_REVEAL_NOTIFICATION.type}
            AND n.related_resource_id = ${connectionId}
        )
        RETURNING id
      `);

      const insertedRows = Array.isArray(inserted?.rows) ? inserted.rows.length : 0;
      if (insertedRows > 0) {
        result.notifiedConnections += 1;
        result.notifiedUsers += insertedRows;
      } else {
        result.skippedDuplicates += 1;
      }
    } catch (error) {
      result.failed += 1;
      logger.warn("[Connections] Reveal notification insert failed; retrying on the next reveal", {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (result.notifiedUsers > 0 || result.failed > 0) {
    // Counts only — never a user id, never a pair.
    logger.info("[Connections] Reveal notifications dispatched", {
      connections: result.notifiedConnections,
      users: result.notifiedUsers,
      skipped_duplicates: result.skippedDuplicates,
      failed: result.failed,
    });
  }

  return result;
}

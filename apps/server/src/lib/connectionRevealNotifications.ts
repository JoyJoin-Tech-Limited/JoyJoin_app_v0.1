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
 * Idempotency (P0 hardening, 2026-11-10): two layers, both inside the INSERT.
 *
 *   1. `WHERE NOT EXISTS (same user + type + related_resource_id)` — cheap, and
 *      keeps a duplicate scheduler tick from even attempting the row.
 *   2. `ON CONFLICT DO NOTHING` — the authoritative cross-process guard. Two
 *      replicas sweeping the same reveal window can both pass layer 1 (it is a
 *      non-locking read) and both attempt the insert; the partial unique index
 *      `notifications_mutual_match_user_resource_uidx`
 *      (migration `0102_notification_mutual_match_dedupe.sql`) makes exactly
 *      one of them win and the other a silent no-op.
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
        ON CONFLICT DO NOTHING
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

/**
 * Expired reveal notification (2026-11-11, tier 2 P2-5).
 *
 * `expireIneligibleRevealSelections()` drops a due `mutual_pending` pair when a
 * side is no longer seated (refunded / cancelled / no-show). Before this, the
 * initiator waited for a reveal that could never happen — silent failure, the
 * worst kind of dead end. One neutral line closes the loop.
 *
 * Copy rules: never the peer's name, never the reason, never blame. The user is
 * told only that this pairing did not land and that the next one can.
 */
export const CONNECTION_EXPIRED_NOTIFICATION = {
  category: "chat",
  type: "mutual_match_expired",
  title: "这次没对上",
  message: "你等的那位这次先没能坐过来，下次还有机会",
} as const;

export interface ExpiredRevealNotificationResult {
  notified: number;
  skippedDuplicates: number;
  failed: number;
}

/**
 * Insert one notification for the initiator of each expired pair.
 *
 * Idempotent by the same `WHERE NOT EXISTS (user + type + related_resource_id)`
 * guard the reveal fan-out uses, so a retried tick cannot double-send.
 */
export async function notifyExpiredRevealSelections(
  pairs: ReadonlyArray<{ id: string; initiatorId: string | null }>,
  options: {
    executor?: RevealNotificationExecutor;
    limit?: number;
  } = {},
): Promise<ExpiredRevealNotificationResult> {
  const executor: RevealNotificationExecutor = options.executor ?? db;
  const limit = Math.max(
    0,
    Math.min(options.limit ?? REVEAL_NOTIFICATION_BATCH_LIMIT, REVEAL_NOTIFICATION_BATCH_LIMIT),
  );

  const result: ExpiredRevealNotificationResult = { notified: 0, skippedDuplicates: 0, failed: 0 };

  for (const pair of pairs.slice(0, limit)) {
    if (!pair.id || !pair.initiatorId) continue;
    try {
      const inserted = await executor.execute(sql`
        INSERT INTO notifications (user_id, category, type, title, message, related_resource_id, is_read)
        SELECT ${pair.initiatorId}, ${CONNECTION_EXPIRED_NOTIFICATION.category}, ${CONNECTION_EXPIRED_NOTIFICATION.type}, ${CONNECTION_EXPIRED_NOTIFICATION.title}, ${CONNECTION_EXPIRED_NOTIFICATION.message}, ${pair.id}, false
        WHERE NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.user_id = ${pair.initiatorId}
            AND n.type = ${CONNECTION_EXPIRED_NOTIFICATION.type}
            AND n.related_resource_id = ${pair.id}
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `);

      if (Array.isArray(inserted?.rows) && inserted.rows.length > 0) {
        result.notified += 1;
      } else {
        result.skippedDuplicates += 1;
      }
    } catch (error) {
      result.failed += 1;
      logger.warn("[Connections] Expired-selection notification failed", {
        connectionId: pair.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (result.notified > 0 || result.failed > 0) {
    // Counts only — never a user id, never a pair.
    logger.info("[Connections] Expired-selection notifications dispatched", {
      notified: result.notified,
      skipped_duplicates: result.skippedDuplicates,
      failed: result.failed,
    });
  }

  return result;
}

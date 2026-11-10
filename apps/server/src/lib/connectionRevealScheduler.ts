/**
 * Connection reveal scheduler (G0, 2026-11-10 — 24h 互选闭环).
 *
 * Flips due `mutual_pending` connection rows to `mutual` at each table's
 * reveal instant (`lib/connectionSelectionWindow.ts` — next 21:00 Asia/Shanghai
 * at-or-after event start + 24h). Until this runs, both sides' WeChat IDs are
 * unreadable and no surface lists the pair, so a stalled sweep delays the
 * reveal but never leaks it.
 *
 * One tick does three bounded things, in order:
 *   1. reveal sweep      — `finalizeConnectionReveals()` (idempotent UPDATE);
 *   2. reveal fan-out     — one in-app `mutual_match` notification per side
 *                          (`lib/connectionRevealNotifications.ts`), deduped by
 *                          (user, connection) so a duplicate tick cannot
 *                          double-send;
 *   3. retention cleanup  — hard-delete non-mutual rows whose reveal window
 *                          closed > 30 days ago
 *                          (`purgeClosedConnectionSelections`, bounded batch).
 * Steps 2 and 3 are individually fail-open: a notification or cleanup failure
 * is logged and retried next tick, and never rolls back the reveal itself.
 *
 * Kill switch: `mutualSelectionV2Enabled`. Flag OFF ⇒ every tick returns
 * immediately, so the scheduler is inert on a legacy deployment (the flag
 * default is false). It is safe to leave registered unconditionally.
 *
 * Fail-open: a transient error is logged and retried on the next tick.
 *
 * NOT IN SCOPE (stated gap, follow-up): push / WeChat subscribe messaging for
 * the reveal. The in-app notification is the only fan-out here by design.
 */

import { getFeatureFlag } from "./featureFlags";
import { logger } from "./logger";
import {
  finalizeConnectionReveals,
  purgeClosedConnectionSelections,
} from "../repositories/connectionSelectionRepo";
import { notifyRevealedConnections } from "./connectionRevealNotifications";

/** One minute: the reveal instant is minute-granular, so this bounds the delay. */
export const CONNECTION_REVEAL_INTERVAL_MS = 60_000;

let singleton: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

export interface ConnectionRevealTickResult {
  /** False when `mutualSelectionV2Enabled` is off — nothing was scanned. */
  enabled: boolean;
  revealed: number;
  /** In-app notifications inserted for the pairs revealed this tick. */
  notifiedUsers: number;
  /** Non-mutual selection rows purged past their 30-day retention. */
  cleaned: number;
  /** True when a previous tick was still running (no-op). */
  skipped: boolean;
}

/**
 * One sweep tick. Exported for tests and for a manual ops trigger.
 */
export async function runConnectionRevealTick(
  now: Date = new Date(),
): Promise<ConnectionRevealTickResult> {
  if (inFlight) {
    return { enabled: true, revealed: 0, notifiedUsers: 0, cleaned: 0, skipped: true };
  }

  // Claim the slot BEFORE the first await: the flag lookup is itself async, so
  // a later tick would otherwise pass the guard and sweep concurrently (the
  // 60s interval cannot provide that guarantee on its own).
  inFlight = true;
  let enabled = false;
  try {
    enabled = await getFeatureFlag("mutualSelectionV2Enabled");
    if (!enabled) {
      return { enabled: false, revealed: 0, notifiedUsers: 0, cleaned: 0, skipped: false };
    }

    const result = await finalizeConnectionReveals({ now });
    if (result.revealed > 0) {
      // Counts only — never a user id, never a pair.
      logger.info("[Connections] reveal sweep flipped mutual_pending rows", {
        revealed: result.revealed,
        reveal_at_through: now.toISOString(),
      });
    }

    // Reveal fan-out. Isolated: a notification failure must not lose the reveal
    // (the next tick re-queries `mutual_pending`, so it could never retry this).
    let notifiedUsers = 0;
    if (result.connections.length > 0) {
      try {
        const notificationResult = await notifyRevealedConnections(result.connections);
        notifiedUsers = notificationResult.notifiedUsers;
      } catch (notificationError) {
        logger.warn("[Connections] Reveal notification fan-out failed", {
          error:
            notificationError instanceof Error
              ? notificationError.message
              : String(notificationError),
        });
      }
    }

    // Retention cleanup. Also isolated: privacy hygiene must never break the
    // reveal path, and a bounded batch simply resumes next tick.
    let cleaned = 0;
    try {
      const cleanupResult = await purgeClosedConnectionSelections({ now });
      cleaned = cleanupResult.deleted;
    } catch (cleanupError) {
      logger.warn("[Connections] Selection retention cleanup failed", {
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    }

    return { enabled: true, revealed: result.revealed, notifiedUsers, cleaned, skipped: false };
  } catch (error) {
    logger.warn("[Connections] reveal sweep failed; retrying next tick", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { enabled, revealed: 0, notifiedUsers: 0, cleaned: 0, skipped: false };
  } finally {
    inFlight = false;
  }
}

/**
 * Register the 1-minute sweep. Idempotent — a second call is a no-op, and the
 * interval is unref'd so it never holds the process open (tests, scripts).
 */
export function startConnectionRevealScheduler(): void {
  if (singleton) return;
  singleton = setInterval(() => {
    void runConnectionRevealTick();
  }, CONNECTION_REVEAL_INTERVAL_MS);
  singleton.unref?.();
  logger.info("[Connections] reveal scheduler started", {
    interval_ms: CONNECTION_REVEAL_INTERVAL_MS,
  });
}

/** Test/ops teardown. */
export function stopConnectionRevealScheduler(): void {
  if (!singleton) return;
  clearInterval(singleton);
  singleton = null;
}

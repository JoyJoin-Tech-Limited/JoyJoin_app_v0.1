/**
 * Arrival-coachmark one-time backfill (B1 — sprint-contract.c4-guidance-queue,
 * 2026-08-27).
 *
 * On the first guidance-queue init with `guidanceQueueEnabled` ON, reconcile
 * the legacy storage-keyed discover-arrival coachmark state into the
 * server-persisted `users.seen_guidance` map:
 *
 *  - `_seen` present  → POST `{ tipId: 'discover_arrival' }`, then remove all
 *    three legacy keys ONLY after server acknowledgement. A failed POST is
 *    retried on the next session init (the server merge is an idempotent
 *    first-write-wins no-op, so re-posting can never duplicate state).
 *  - `_pending` present (and not seen) → the queue inherits the tip as
 *    pending; the `_pending` key is removed ONLY after the inherited tip's
 *    dismiss persists server-side (`consumeInheritedArrivalPending`, called
 *    from the queue's dismiss-commit success path). Crash-before-removal is
 *    safe: the re-post is an idempotent no-op.
 *
 * `_seen_date` note (E1): the legacy day-scoped header-tagline yield is NOT
 * lost when the key is removed — the flag-on path reproduces it from the
 * server `seenGuidance['discover_arrival']` timestamp (same-local-day check)
 * plus the in-session shown state in pages/discover. The backfill timestamp
 * therefore preserves the yield on migration day itself, which is the only
 * day it can still matter.
 *
 * Runs at most once per user per JS runtime (module-level guard; the
 * successful-seen acknowledgement is the completion signal per contract).
 */

import Taro from '@tarojs/taro'
import { markGuidanceSeen } from './guidanceApi'
import { logInfo, logWarn } from '../utils/logger'

const arrivalSeenKey = (userId: string) => `joyjoin_discover_arrival_seen:${userId}`
const arrivalPendingKey = (userId: string) => `joyjoin_discover_arrival_pending:${userId}`
const arrivalSeenDateKey = (userId: string) => `joyjoin_discover_arrival_seen_date:${userId}`

/** Users whose backfill completed (or had nothing to backfill) this runtime. */
const migratedUserIds = new Set<string>()
/** Users whose legacy `_pending` signal the queue has inherited. */
const inheritedPendingUserIds = new Set<string>()

/**
 * Synchronous pending check used by the queue's trigger evaluation. Reads
 * the inherited set first, then falls back to the raw storage key so a fresh
 * onboarding completion is honoured even before the migration effect runs.
 */
export function isArrivalTipPending(userId: string | undefined): boolean {
  if (!userId) return false
  if (inheritedPendingUserIds.has(userId)) return true
  try {
    return Boolean(Taro.getStorageSync(arrivalPendingKey(userId)))
  } catch {
    return false
  }
}

export async function runArrivalMigration(userId: string): Promise<void> {
  if (!userId || migratedUserIds.has(userId)) return

  let seen = false
  let pending = false
  try {
    seen = Boolean(Taro.getStorageSync(arrivalSeenKey(userId)))
    pending = Boolean(Taro.getStorageSync(arrivalPendingKey(userId)))
  } catch {
    // Storage unreadable — leave everything in place and retry next session.
    return
  }

  if (pending) inheritedPendingUserIds.add(userId)

  if (!seen) {
    // Nothing to backfill; the pending signal (if any) is inherited above and
    // its key is removed only after the inherited tip's dismiss persists.
    migratedUserIds.add(userId)
    return
  }

  try {
    await markGuidanceSeen('discover_arrival')
  } catch (error) {
    logWarn('[GuidanceMigration] arrival seen backfill failed; will retry next session', {
      error: error instanceof Error ? error.message : String(error),
    })
    // NOT marked migrated → retried on the next queue init. Safe: the server
    // merge is idempotent first-write-wins.
    return
  }

  // Server acknowledged — only now remove the legacy authority keys.
  try {
    Taro.removeStorageSync(arrivalSeenKey(userId))
    Taro.removeStorageSync(arrivalPendingKey(userId))
    Taro.removeStorageSync(arrivalSeenDateKey(userId))
  } catch {
    // Non-fatal: stale keys are inert under the flag-on path.
  }
  // Seen already recorded server-side — any inherited pending is moot.
  inheritedPendingUserIds.delete(userId)
  migratedUserIds.add(userId)
  logInfo('[GuidanceMigration] arrival seen-state backfilled', { userId })
}

/**
 * Remove the inherited `_pending` key after the inherited tip's dismiss has
 * persisted server-side. Idempotent by design (storage remove + set delete).
 */
export function consumeInheritedArrivalPending(userId: string | undefined): void {
  if (!userId) return
  inheritedPendingUserIds.delete(userId)
  try {
    Taro.removeStorageSync(arrivalPendingKey(userId))
  } catch {
    // Non-fatal: a leftover key only re-posts an idempotent no-op.
  }
}

/** Test-only reset. Never call from product code. */
export function __resetArrivalMigrationForTests(): void {
  migratedUserIds.clear()
  inheritedPendingUserIds.clear()
}

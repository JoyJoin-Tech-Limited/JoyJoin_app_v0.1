import Taro from '@tarojs/taro'
import { logError } from './logger'

/**
 * Local cache of "this viewer has already opened this table's box".
 *
 * The authority is now the server: `event_pool_registrations.revealed_at` is
 * stamped by `POST /api/pool-groups/:groupId/reveal` and travels to the client
 * on `JoinedEventSummary.revealedAt` / `PoolGroupDetailsResponse.viewer`. This
 * module only mirrors that fact on the device so a card can render the settled
 * state on the first frame, before the list payload arrives, and so an offline
 * re-render does not flip a table back to sealed (2026-11-11).
 *
 * Precedence rule: the server value wins whenever it is present; the cache is
 * consulted only while the server answer is unknown. Never treat `false` here
 * as proof the table is unopened — a fresh install has no cache at all.
 */
export function getTableRevealStorageKey(groupId: string): string {
  return `jj_revealed_${groupId}`
}

export function getTableRevealedAtStorageKey(groupId: string): string {
  return `jj_revealed_at_${groupId}`
}

/**
 * Mirror a server-confirmed reveal into the local cache.
 *
 * Used when the list payload or the reveal endpoint reports a timestamp this
 * device had not recorded yet (e.g. the box was opened on another phone). The
 * timestamp is preserved rather than replaced with "now" so the receipt window
 * measures the real reveal, not the sync.
 */
export function syncTableRevealedAt(groupId?: string | null, revealedAtIso?: string | null): void {
  if (!groupId || !revealedAtIso) return
  const revealedAt = Date.parse(revealedAtIso)
  if (!Number.isFinite(revealedAt)) return
  try {
    Taro.setStorageSync(getTableRevealStorageKey(groupId), true)
    Taro.setStorageSync(getTableRevealedAtStorageKey(groupId), revealedAt)
  } catch (error) {
    logError('[TableReveal] Failed to cache server reveal', {
      groupId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/** True when this device has already completed the reveal for this group. */
export function hasOpenedTable(groupId?: string | null): boolean {
  if (!groupId) return false
  try {
    return Taro.getStorageSync(getTableRevealStorageKey(groupId)) === true
  } catch {
    return false
  }
}

/**
 * Timestamp of the last completed reveal, or 0 when unknown.
 *
 * Used only for the "receipt" animation: the card that mounts right after the
 * ceremony may play the seal→faces hand-off once. A bounded window keeps the
 * animation from replaying on every later tab visit.
 */
export function getTableOpenedAt(groupId?: string | null): number {
  if (!groupId) return 0
  try {
    const value = Taro.getStorageSync(getTableRevealedAtStorageKey(groupId))
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

export function hasOpenedTableRecently(groupId: string | null | undefined, windowMs: number): boolean {
  const openedAt = getTableOpenedAt(groupId)
  if (!openedAt) return false
  const elapsed = Date.now() - openedAt
  return elapsed >= 0 && elapsed <= windowMs
}

export function markTableOpened(groupId: string): void {
  if (!groupId) return
  try {
    Taro.setStorageSync(getTableRevealStorageKey(groupId), true)
    Taro.setStorageSync(getTableRevealedAtStorageKey(groupId), Date.now())
  } catch (error) {
    logError('[TableReveal] Failed to persist reveal flag', {
      groupId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

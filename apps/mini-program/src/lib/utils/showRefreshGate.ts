/**
 * Staleness gate for per-show data refreshes on tab pages.
 *
 * WeChat tab pages re-fire useDidShow on every tab switch, and several pages
 * used to invalidate their queries unconditionally on each show. That caused
 * a refetch + re-render burst per switch (visible flicker, wasted network).
 * This helper lets pages refresh at most once per interval per key, while
 * module-level state survives page remounts inside the JS context.
 */

const lastRefreshAtByKey = new Map<string, number>()

export const SHOW_REFRESH_MIN_INTERVAL_MS = 30_000

/**
 * Returns true (and records the refresh) when `key` has not been refreshed
 * within `minIntervalMs`. Returns false when the last refresh is still fresh.
 */
export function shouldRefreshOnShow(key: string, minIntervalMs: number = SHOW_REFRESH_MIN_INTERVAL_MS): boolean {
  const now = Date.now()
  const last = lastRefreshAtByKey.get(key) ?? 0
  if (now - last < minIntervalMs) return false
  lastRefreshAtByKey.set(key, now)
  return true
}

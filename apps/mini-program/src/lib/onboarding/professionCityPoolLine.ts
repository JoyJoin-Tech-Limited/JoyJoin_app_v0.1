/**
 * professionCityPoolLine — truthful 同城排桌线 for the reveal card's bridge
 * block (commercialization audit #1, 2026-10-14).
 *
 * Replaces the vague social-proof line with a data-backed one:
 * 「本周{city}有 N 场局在排桌」. Fail-closed honesty (Discover "never render a
 * fabricated 0" precedent): the caller renders this line ONLY when the pools
 * feed is already cached AND N ≥ 1 AND the city is known; otherwise it falls
 * back to the generic bridge line. Read-only — the overlay mirrors the shared
 * pools query cache (`enabled: false`) and never fires a network request.
 *
 * Window semantics mirror the server's `eventDateTime.ts` +8h approach in the
 * simplest client-side form: compare epoch ms (pool `dateTime` is ISO with an
 * offset, so `new Date(...).getTime()` is timezone-safe) against now..now+7d.
 */

import type { EventPoolSummary } from '@shared/api'

export const CITY_POOL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Count pools in `city` whose dateTime falls in [now, now + 7d]. Past pools
 * are excluded — they are not 在排桌. Missing/unparseable dates are skipped.
 */
export function countCityPoolsWithinWeek(
  pools: readonly Pick<EventPoolSummary, 'city' | 'dateTime'>[],
  city: string,
  now: Date = new Date(),
): number {
  const trimmedCity = city.trim()
  if (!trimmedCity) return 0
  const startMs = now.getTime()
  const endMs = startMs + CITY_POOL_WINDOW_MS
  let count = 0
  for (const pool of pools) {
    if (pool.city !== trimmedCity) continue
    if (!pool.dateTime) continue
    const dateMs = new Date(pool.dateTime).getTime()
    if (Number.isNaN(dateMs)) continue
    if (dateMs < startMs || dateMs > endMs) continue
    count += 1
  }
  return count
}

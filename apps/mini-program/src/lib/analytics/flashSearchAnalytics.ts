import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'

/**
 * Street blind box search funnel head (PR0, 2026-08-26).
 *
 * Fired once per search attempt the moment foreground tracking actually
 * starts. Metadata carries the shift `appearanceId` only — never
 * coordinates, user text, or device identifiers (flash privacy posture).
 * Fail-open: a failed send must never block the search flow.
 */
export function trackFlashSearchStarted(appearanceId: string): void {
  if (!appearanceId) return
  void apiRequest<{ success?: boolean }>({
    path: '/api/analytics/discover',
    method: 'POST',
    data: {
      eventType: 'flash_search_started',
      metadata: { appearanceId },
      timestamp: Date.now(),
    },
    handleUnauthorized: false,
  }).catch((error) => {
    const message = error instanceof Error ? error.message : 'unknown error'
    logWarn('[FlashSearchAnalytics] search_started event failed; search continues', {
      message,
    })
  })
}

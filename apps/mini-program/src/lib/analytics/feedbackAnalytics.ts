import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'

/**
 * Event-feedback balanced layer funnel (2026-08-15 merge).
 * The invite interstitial is gone — deep fields are inline on the merged
 * experience screen, so the funnel is now: deep engaged (first deep field
 * touched, fired once) → deep submitted (payload carried ≥1 deep field,
 * mirroring the server's content-based hasDeepFeedback rule). Events land in
 * discover_analytics_events via /api/analytics/discover (allowlist-extended).
 * Fire-and-forget; never blocks the feedback submission.
 */
export type FeedbackAnalyticsEventType =
  | 'feedback_deep_engaged'
  | 'feedback_deep_submitted'

export function trackFeedbackEvent(
  eventType: FeedbackAnalyticsEventType,
  metadata?: Record<string, unknown>,
): void {
  void apiRequest<{ success?: boolean }>({
    path: '/api/analytics/discover',
    method: 'POST',
    data: {
      eventType,
      metadata: {
        ...metadata,
        appSurface: 'mini-program',
        runtime: 'taro',
      },
      timestamp: Date.now(),
    },
    handleUnauthorized: false,
  }).catch((error) => {
    const message = error instanceof Error ? error.message : 'unknown error'
    logWarn('[FeedbackAnalytics] Failed to send feedback event', { eventType, message })
  })
}

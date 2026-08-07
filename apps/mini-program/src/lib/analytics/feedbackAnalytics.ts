import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'

/**
 * Event-feedback balanced layer funnel (2026-08-07).
 * The 5-dimension upgrade is the feedback flow's core conversion:
 * invite seen → deep engaged → deep submitted. Events land in
 * discover_analytics_events via /api/analytics/discover (allowlist-extended).
 * Fire-and-forget; never blocks the feedback submission.
 */
export type FeedbackAnalyticsEventType =
  | 'feedback_invite_seen'
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

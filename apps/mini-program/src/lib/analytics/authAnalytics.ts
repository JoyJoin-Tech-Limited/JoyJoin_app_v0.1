import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'

export type AuthAnalyticsEventType =
  | 'auth_revalidation_started'
  | 'auth_revalidation_succeeded'
  | 'auth_revalidation_failed'
  | 'gate_timeout'
  | 'gate_retry'
  | 'gate_dismiss'

export interface AuthAnalyticsEvent {
  eventType: AuthAnalyticsEventType
  metadata?: Record<string, unknown>
  timestamp: number
}

class AuthAnalytics {
  track(
    eventType: AuthAnalyticsEventType,
    metadata?: Record<string, unknown>,
  ): void {
    const event: AuthAnalyticsEvent = {
      eventType,
      metadata,
      timestamp: Date.now(),
    }

    void apiRequest<{ success?: boolean }>({
      path: '/api/analytics/auth',
      method: 'POST',
      data: event,
      handleUnauthorized: false,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : 'unknown error'
      logWarn('[AuthAnalytics] Failed to send auth event', {
        eventType,
        message,
      })
    })
  }
}

/** Shared singleton instance — one POST-tracker for auth/gate events. */
export const authAnalytics = new AuthAnalytics()

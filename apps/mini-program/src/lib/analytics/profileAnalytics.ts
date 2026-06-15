import { z } from 'zod'
import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'

const ProfileAnalyticsEventSchema = z.object({
  eventType: z.enum([
    'profile_stat_tap',
    'profile_archetype_cta_tap',
    'profile_menu_tap',
    'profile_logout_tap',
    'profile_shell_retry',
  ]),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.number(),
})

export type ProfileAnalyticsEventType = z.infer<typeof ProfileAnalyticsEventSchema>['eventType']

export interface ProfileAnalyticsEvent {
  eventType: ProfileAnalyticsEventType
  metadata?: Record<string, unknown>
  timestamp: number
}

class ProfileAnalytics {
  track(eventType: ProfileAnalyticsEventType, metadata?: Record<string, unknown>): void {
    const payload: ProfileAnalyticsEvent = {
      eventType,
      metadata,
      timestamp: Date.now(),
    }

    const parsed = ProfileAnalyticsEventSchema.safeParse(payload)
    if (!parsed.success) {
      logWarn('[ProfileAnalytics] Invalid event payload; dropping', {
        eventType,
        metadata,
        issues: parsed.error.issues,
      })
      return
    }

    void apiRequest<{ success?: boolean }>({
      path: '/api/analytics/profile',
      method: 'POST',
      data: parsed.data,
      handleUnauthorized: false,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : 'unknown error'
      logWarn('[ProfileAnalytics] Failed to send profile event', {
        eventType,
        message,
      })
    })
  }
}

export const profileAnalytics = new ProfileAnalytics()

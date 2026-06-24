import { z } from 'zod'
import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'

const ProfileAnalyticsEventSchema = z.object({
  eventType: z.enum([
    'profile_stat_tap',
    'profile_archetype_cta_tap',
    'profile_menu_tap',
    'profile_logout_tap',
    'profile_logout_cancel',
    'profile_shell_retry',
    'profile_share_app_message',
    'profile_share_timeline',
    'profile_milestone_impression',
    'profile_milestone_tap',
    'profile_pull_refresh',
    'profile_share_card_generated',
    'profile_share_card_error',
    'profile_view',
    'profile_edit_tap',
    'profile_edit_save',
    'profile_completion',
    'profile_avatar_load_error',
    'connection_card_view',
    'connection_empty_state_cta_tap',
    'connection_empty_state_impression',
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

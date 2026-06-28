import { z } from 'zod'
import type { JoinedEventSummary } from '@shared/api'
import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'

const EventsAnalyticsEventSchema = z.object({
  eventType: z.enum([
    'events_view',
    'events_tab_switch',
    'events_card_tap',
    'events_empty_state_cta_tap',
    'events_pull_refresh',
  ]),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.number(),
})

export type EventsAnalyticsEventType = z.infer<typeof EventsAnalyticsEventSchema>['eventType']

export interface EventsAnalyticsEvent {
  eventType: EventsAnalyticsEventType
  metadata?: Record<string, unknown>
  timestamp: number
}

class EventsAnalytics {
  track(eventType: EventsAnalyticsEventType, metadata?: Record<string, unknown>): void {
    const payload: EventsAnalyticsEvent = {
      eventType,
      metadata,
      timestamp: Date.now(),
    }

    const parsed = EventsAnalyticsEventSchema.safeParse(payload)
    if (!parsed.success) {
      logWarn('[EventsAnalytics] Invalid event payload; dropping', {
        eventType,
        metadata,
        issues: parsed.error.issues,
      })
      return
    }

    void apiRequest<{ success?: boolean }>({
      path: '/api/analytics/events',
      method: 'POST',
      data: parsed.data,
      handleUnauthorized: false,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : 'unknown error'
      logWarn('[EventsAnalytics] Failed to send events analytics event', {
        eventType,
        message,
      })
    })
  }

  /** Convenience helper for card taps — always includes card version, tab, and event type. */
  trackCardTap(event: JoinedEventSummary, tab: 'upcoming' | 'completed'): void {
    this.track('events_card_tap', {
      eventId: event.id,
      tab,
      status: event.status,
      eventType: event.eventType,
      cardVersion: 'footprint_oracle_v1',
    })
  }
}

export const eventsAnalytics = new EventsAnalytics()

import {
  GATHERING_ROOM_ANALYTICS_EVENT_TYPES,
  type GatheringRoomAnalyticsEventType,
} from '@shared/api'
import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'

export type GatheringRoomEventType = GatheringRoomAnalyticsEventType

export { GATHERING_ROOM_ANALYTICS_EVENT_TYPES }

export interface GatheringRoomAnalyticsEvent {
  eventType: GatheringRoomEventType
  metadata?: Record<string, unknown>
  timestamp: number
}

class GatheringRoomAnalytics {
  track(
    eventType: GatheringRoomEventType,
    metadata?: Record<string, unknown>,
  ): void {
    const event: GatheringRoomAnalyticsEvent = {
      eventType,
      metadata: {
        ...metadata,
        appSurface: 'mini-program',
        runtime: 'taro',
      },
      timestamp: Date.now(),
    }

    void apiRequest<{ success?: boolean }>({
      path: '/api/analytics/gathering-room',
      method: 'POST',
      data: event,
      handleUnauthorized: false,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : 'unknown error'
      logWarn('[GatheringRoomAnalytics] Failed to send event', {
        eventType,
        message,
      })
    })
  }
}

export const gatheringRoomAnalytics = new GatheringRoomAnalytics()

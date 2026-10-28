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
  poolId?: string
  metadata?: Record<string, unknown>
  timestamp: number
}

class GatheringRoomAnalytics {
  track(
    eventType: GatheringRoomEventType,
    metadata?: Record<string, unknown>,
  ): void {
    const { poolId, ...eventMetadata } = metadata ?? {}
    const event: GatheringRoomAnalyticsEvent = {
      eventType,
      // The server persists only the top-level poolId. Keep groupId in metadata;
      // never leave the real pool identity buried where it becomes NULL in SQL.
      ...(typeof poolId === 'string' && poolId.length > 0 ? { poolId } : {}),
      metadata: {
        ...eventMetadata,
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

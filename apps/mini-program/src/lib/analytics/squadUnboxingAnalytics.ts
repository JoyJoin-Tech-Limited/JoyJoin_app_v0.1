import Taro from '@tarojs/taro'
import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'

export type SquadUnboxingEventType =
  | 'squad_unboxing_reveal'
  | 'squad_unboxing_reveal_drag'
  | 'squad_unboxing_reveal_tap'

export interface SquadUnboxingAnalyticsEvent {
  eventType: SquadUnboxingEventType
  metadata?: Record<string, unknown>
  timestamp: number
}

class SquadUnboxingAnalytics {
  track(
    eventType: SquadUnboxingEventType,
    metadata?: Record<string, unknown>,
  ): void {
    const event: SquadUnboxingAnalyticsEvent = {
      eventType,
      metadata: {
        ...metadata,
        appSurface: 'mini-program',
        runtime: 'taro',
      },
      timestamp: Date.now(),
    }

    void apiRequest<{ success?: boolean }>({
      path: '/api/analytics/squad-unboxing',
      method: 'POST',
      data: event,
      handleUnauthorized: false,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : 'unknown error'
      logWarn('[SquadUnboxingAnalytics] Failed to send event', {
        eventType,
        message,
      })
    })
  }
}

export const squadUnboxingAnalytics = new SquadUnboxingAnalytics()

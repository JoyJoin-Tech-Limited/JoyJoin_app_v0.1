import { z } from 'zod'
import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'
import {
  FLASH_STORY_ANALYTICS_EVENTS,
  FLASH_STORY_UNIT_IDS,
  type FlashStoryAnalyticsEvent,
  type FlashStoryUnitId,
} from '@shared/alang/flashStorySeason'

const FlashStoryAnalyticsEventSchema = z.object({
  unitId: z.enum(FLASH_STORY_UNIT_IDS),
  eventType: z.enum(FLASH_STORY_ANALYTICS_EVENTS),
  timestamp: z.number(),
}).strict()

export type FlashStoryAnalyticsEventType = FlashStoryAnalyticsEvent

class FlashStoryAnalytics {
  track(unitId: FlashStoryUnitId, eventType: FlashStoryAnalyticsEventType): void {
    const parsed = FlashStoryAnalyticsEventSchema.safeParse({ unitId, eventType, timestamp: Date.now() })
    if (!parsed.success) return

    void apiRequest<{ success?: boolean }>({
      path: '/api/analytics/flash-story',
      method: 'POST',
      data: parsed.data,
      handleUnauthorized: false,
    }).catch((error) => {
      logWarn('[FlashStoryAnalytics] Anonymous event failed; continuing story', {
        eventType,
        unitId,
        message: error instanceof Error ? error.message : 'unknown error',
      })
    })
  }
}

export const flashStoryAnalytics = new FlashStoryAnalytics()

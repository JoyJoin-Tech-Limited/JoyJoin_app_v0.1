import { z } from 'zod'
import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'
import {
  FLASH_STORY_ANALYTICS_EVENTS,
  FLASH_STORY_UNIT_IDS,
  type FlashStoryAnalyticsEvent,
  type FlashStoryUnitId,
} from '@shared/alang/flashStorySeason'

/**
 * 动作漏斗 metadata 只允许枚举 id（模板 / 结果），不含 GPS、文本或设备标识
 * （AC-08 / SEC-02 / OBS-02）。metadata 校验失败时仅丢弃 metadata，事件本体
 * 仍然发送（fail-open），绝不让埋点阻断叙事流程。
 */
const FlashStoryAnalyticsMetadataSchema = z.object({
  template: z.enum(['spacing', 'pairing', 'path', 'overlay', 'privacy']).optional(),
  resultId: z.string().trim().min(1).max(80).optional(),
}).strict()

export type FlashStoryAnalyticsMetadata = z.infer<typeof FlashStoryAnalyticsMetadataSchema>

const FlashStoryAnalyticsEventSchema = z.object({
  unitId: z.enum(FLASH_STORY_UNIT_IDS),
  eventType: z.enum(FLASH_STORY_ANALYTICS_EVENTS),
  timestamp: z.number(),
  metadata: FlashStoryAnalyticsMetadataSchema.optional(),
}).strict()

export type FlashStoryAnalyticsEventType = FlashStoryAnalyticsEvent

class FlashStoryAnalytics {
  track(
    unitId: FlashStoryUnitId,
    eventType: FlashStoryAnalyticsEventType,
    metadata?: FlashStoryAnalyticsMetadata,
  ): void {
    const parsedMetadata = metadata ? FlashStoryAnalyticsMetadataSchema.safeParse(metadata) : null
    const parsed = FlashStoryAnalyticsEventSchema.safeParse({
      unitId,
      eventType,
      timestamp: Date.now(),
      ...(parsedMetadata?.success ? { metadata: parsedMetadata.data } : {}),
    })
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

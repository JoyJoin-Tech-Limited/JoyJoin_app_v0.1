import Taro from '@tarojs/taro'
import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'

export type DiscoverAnalyticsEventType =
  | 'pool_card_tap'
  | 'pool_card_impression'
  | 'registration_start'
  | 'registration_complete'
  | 'registration_abandoned'
  | 'promo_banner_impression'
  | 'promo_banner_cta_tap'
  | 'promo_banner_image_error'
  | 'promo_banner_image_retry'
  | 'welcome_coupon_banner_impression'
  | 'welcome_coupon_banner_tap'
  | 'filter_open'
  | 'filter_select'
  | 'filter_close'
  | 'geo_detected'
  | 'geo_failed'
  | 'geo_auto_filter'
  | 'filter_auto_relax'

export interface DiscoverAnalyticsEvent {
  eventType: DiscoverAnalyticsEventType
  poolId?: string
  metadata?: Record<string, unknown>
  timestamp: number
}

const DISCOVER_ANALYTICS_SESSION_START_KEY = 'joyjoin_discover_session_start'

function readStoredSessionStartTime(): number | null {
  try {
    const storedValue = Taro.getStorageSync(DISCOVER_ANALYTICS_SESSION_START_KEY)
    const parsedValue = typeof storedValue === 'number' ? storedValue : Number(storedValue)
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null
  } catch {
    return null
  }
}

function writeStoredSessionStartTime(value: number): void {
  try {
    Taro.setStorageSync(DISCOVER_ANALYTICS_SESSION_START_KEY, String(value))
  } catch {
    // Non-blocking by design.
  }
}

function initializeSessionStartTime(): number {
  const storedValue = readStoredSessionStartTime()
  if (storedValue) {
    return storedValue
  }
  const now = Date.now()
  writeStoredSessionStartTime(now)
  return now
}

class DiscoverAnalytics {
  private sessionStartTime = initializeSessionStartTime()
  private impressionBuffer: Array<{ poolId?: string; metadata?: Record<string, unknown> }> = []
  private impressionFlushTimer: ReturnType<typeof setTimeout> | null = null

  resetSession(): void {
    this.sessionStartTime = Date.now()
    writeStoredSessionStartTime(this.sessionStartTime)
  }

  track(
    eventType: DiscoverAnalyticsEventType,
    poolId?: string,
    metadata?: Record<string, unknown>,
  ): void {
    const event: DiscoverAnalyticsEvent = {
      eventType,
      poolId,
      metadata: {
        ...metadata,
        sessionDuration: Math.max(0, Date.now() - this.sessionStartTime),
        appSurface: 'mini-program',
        runtime: 'taro',
      },
      timestamp: Date.now(),
    }

    void apiRequest<{ success?: boolean }>({
      path: '/api/analytics/discover',
      method: 'POST',
      data: event,
      handleUnauthorized: false,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : 'unknown error'
      logWarn('[DiscoverAnalytics] Failed to send discover event', {
        eventType,
        poolId,
        message,
      })
    })
  }

  /**
   * Buffer impression events and flush them with a debounce.
   * Prevents request spam when VirtualList renders many cards at once.
   */
  trackImpression(poolId?: string, metadata?: Record<string, unknown>): void {
    this.impressionBuffer.push({ poolId, metadata })

    if (this.impressionFlushTimer) {
      clearTimeout(this.impressionFlushTimer)
    }

    this.impressionFlushTimer = setTimeout(() => {
      this.flushImpressions()
    }, 1500)

    // Flush immediately if buffer grows large
    if (this.impressionBuffer.length >= 10) {
      this.flushImpressions()
    }
  }

  private flushImpressions(): void {
    if (this.impressionFlushTimer) {
      clearTimeout(this.impressionFlushTimer)
      this.impressionFlushTimer = null
    }

    const buffer = this.impressionBuffer
    this.impressionBuffer = []

    for (const item of buffer) {
      this.track('pool_card_impression', item.poolId, item.metadata)
    }
  }
}

export const discoverAnalytics = new DiscoverAnalytics()

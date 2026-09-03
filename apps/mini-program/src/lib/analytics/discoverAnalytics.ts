import Taro from '@tarojs/taro'
import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'

export type DiscoverAnalyticsEventType =
  | 'pool_card_tap'
  | 'pool_card_impression'
  | 'registration_start'
  | 'registration_confirm_shown'
  | 'registration_confirm_confirmed'
  | 'registration_complete'
  | 'registration_abandoned'
  | 'registration_intent_toggled'
  | 'registration_step_reaction_shown'
  | 'registration_inclusions_viewed'
  | 'registration_submit_error'
  | 'registration_terminal_state_view'
  | 'registration_terminal_cta_tap'
  | 'registration_terminal_notify_tap'
  | 'promo_banner_impression'
  | 'promo_banner_cta_tap'
  | 'promo_banner_image_error'
  | 'promo_banner_image_retry'
  | 'welcome_coupon_banner_impression'
  | 'welcome_coupon_banner_tap'
  | 'welcome_coupon_auto_applied'
  | 'pay_start'
  | 'pay_success'
  | 'pay_cancel'
  | 'pay_cancel_retention_shown'
  | 'pay_cancel_retention_tap'
  | 'pay_cancel_retention_dismiss'
  | 'pay_fail'
  | 'pay_timeout'
  | 'plan_switch'
  | 'plan_selector_impression'
  | 'upsell_expand'
  | 'upsell_collapse'
  | 'coupon_detail_expand'
  | 'coupon_detail_collapse'
  | 'event_ticket_payment_view'
  | 'event_ticket_payment_abandon'
  | 'event_ticket_payment_success_view'
  | 'event_ticket_payment_success_cta_tap'
  | 'refund_policy_viewed'
  | 'ticket_terms_row_impression'
  | 'ticket_inclusion_sheet_open'
  | 'ticket_inclusion_sheet_close'
  | 'ticket_tail_image_impression'
  | 'ticket_tail_image_load_error'
  | 'filter_open'
  | 'filter_select'
  | 'filter_close'
  | 'geo_detected'
  | 'geo_failed'
  | 'geo_auto_filter'
  | 'filter_auto_relax'
  | 'presence_strip_impression'
  | 'corner_badge_impression'
  | 'corner_badge_live_update'
  | 'city_picker_open'
  | 'city_picker_close'
  | 'city_picker_select'
  | 'city_picker_search'
  | 'city_picker_confirm'
  | 'city_picker_success'
  | 'city_picker_offline_blocked'
  | 'city_picker_error'
  | 'persona_snapshot_impression'
  | 'persona_snapshot_expand_sheet'
  | 'persona_snapshot_dimension_tap'
  | 'persona_snapshot_user_archetype_impression'
  | 'persona_snapshot_new_registrant_banner_shown'
  | 'persona_snapshot_state_band'
  | 'persona_snapshot_load_error'
  | 'pool_teaser_impression'
  | 'duo_card_impression'
  | 'duo_segment_select'
  | 'duo_info_sheet_open'
  | 'duo_info_sheet_close'
  | 'duo_share_trigger'
  | 'duo_status_update'
  | 'duo_banner_impression'
  | 'duo_success_view'
  // D7 onboarding-guidance funnel (2026-08-27, ships WITH W1 — whitelist
  // unconditional server-side so the 2-week baseline clock starts at deploy).
  // guidance_shown metadata: { tipId }; guidance_dismissed metadata:
  // { tipId, reason: 'button'|'tap_through'|'auto', persistError?: true }.
  | 'guidance_shown'
  | 'guidance_dismissed'
  // Personality-test intro funnel (2026-09-02): measures the icon-strip
  // change vs the pre-strip baseline. Both fire from the personality-test
  // page intro phase; metadata: { entryMode: 'fresh'|'resume' }.
  | 'onboarding_intro_viewed'
  | 'personality_test_started'

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

// ─── Internal: generic debounced batch tracker ─────────────────

class BatchTracker {
  private buffer: Array<{ poolId?: string; metadata?: Record<string, unknown> }> = []
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly eventType: DiscoverAnalyticsEventType,
    private readonly flushDelayMs: number,
    private readonly maxBufferSize: number,
    private readonly sender: (
      eventType: DiscoverAnalyticsEventType,
      poolId?: string,
      metadata?: Record<string, unknown>,
    ) => void,
  ) {}

  track(poolId?: string, metadata?: Record<string, unknown>): void {
    this.buffer.push({ poolId, metadata })

    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    this.timer = setTimeout(() => {
      this.flush()
    }, this.flushDelayMs)

    if (this.buffer.length >= this.maxBufferSize) {
      this.flush()
    }
  }

  private flush(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    const buffer = this.buffer
    this.buffer = []

    for (const item of buffer) {
      this.sender(this.eventType, item.poolId, item.metadata)
    }
  }
}

class DiscoverAnalytics {
  private sessionStartTime = initializeSessionStartTime()
  private impressionTracker = new BatchTracker('pool_card_impression', 1500, 10, (eventType, poolId, metadata) => {
    this.track(eventType, poolId, metadata)
  })
  private presenceStripTracker = new BatchTracker('presence_strip_impression', 1500, 10, (eventType, poolId, metadata) => {
    this.track(eventType, poolId, metadata)
  })

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
   * Buffer pool-card impression events and flush them with a debounce.
   * Prevents request spam when VirtualList renders many cards at once.
   */
  trackImpression(poolId?: string, metadata?: Record<string, unknown>): void {
    this.impressionTracker.track(poolId, metadata)
  }

  /**
   * Buffer presence-strip impression events and flush them with a debounce.
   * Prevents request spam when VirtualList renders many cards at once.
   */
  trackPresenceStripImpression(poolId?: string, metadata?: Record<string, unknown>): void {
    this.presenceStripTracker.track(poolId, metadata)
  }
}

export const discoverAnalytics = new DiscoverAnalytics()

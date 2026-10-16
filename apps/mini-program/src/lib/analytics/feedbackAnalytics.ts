import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'

/**
 * Event-feedback balanced layer funnel (2026-08-15 merge).
 * The invite interstitial is gone — deep fields are inline on the merged
 * experience screen, so the funnel is now: deep engaged (first deep field
 * touched, fired once) → deep submitted (payload carried ≥1 deep field,
 * mirroring the server's content-based hasDeepFeedback rule). Events land in
 * discover_analytics_events via /api/analytics/discover (allowlist-extended).
 * Fire-and-forget; never blocks the feedback submission.
 */
export type FeedbackAnalyticsEventType =
  | 'feedback_deep_engaged'
  | 'feedback_deep_submitted'
  // Feedback-activation funnel (2026-10-16, PM plan §7): entry visibility on
  // event-detail / footprint pill, locked-state teaching taps, and feedback page
  // opens with source attribution (event_detail / events_tab / recap_push /
  // notification). Same minimal-metadata fail-open discipline as the deep
  // funnel; enum-only types registered in the discover-channel allowlist.
  | 'feedback_entry_shown'
  | 'feedback_locked_tap'
  | 'feedback_reminder_tap'
  | 'feedback_page_open'
  // Wrap-up identity & funnel telemetry (2026-10-16 polish batch): step-level
  // views, per-tag selection, 印象补充 focus, archetype fallback/collision.
  // Enum-only metadata (eventId + step/tag/reason/count) — zero PII.
  | 'feedback_step_view'
  | 'feedback_attendee_tag_selected'
  | 'feedback_attendee_note_focus'
  | 'feedback_archetype_fallback'
  | 'feedback_archetype_collision'
  // WeChat contact-ID collection funnel (2026-10-16, spec
  // docs/design/wechat-id-collection-spec-20261016.md §6): conditional 微信号
  // step + revealed remedy card. Metadata carries reason/surface enums only —
  // never the WeChat ID itself.
  | 'feedback_wechat_step_shown'
  | 'feedback_wechat_saved'
  | 'feedback_wechat_skipped'
  | 'feedback_wechat_invalid'
  | 'feedback_wechat_remedy_saved'
  | 'feedback_wechat_remedy_failed'
  // 2026-10-16 uplift Batch B (item 10): first focus of the 微信号 input,
  // once per visit — the collection-funnel engagement anchor. No metadata
  // beyond eventId.
  | 'feedback_wechat_input_focus'
  // 2026-10-16 uplift item 19: 互选纪念卡 saved to the photo album from the
  // revealed screen. Metadata carries eventId + matchCount only — zero PII,
  // zero contact info (the card structurally excludes it).
  | 'feedback_keepsake_save'

export function trackFeedbackEvent(
  eventType: FeedbackAnalyticsEventType,
  metadata?: Record<string, unknown>,
): void {
  void apiRequest<{ success?: boolean }>({
    path: '/api/analytics/discover',
    method: 'POST',
    data: {
      eventType,
      metadata: {
        ...metadata,
        appSurface: 'mini-program',
        runtime: 'taro',
      },
      timestamp: Date.now(),
    },
    handleUnauthorized: false,
  }).catch((error) => {
    const message = error instanceof Error ? error.message : 'unknown error'
    logWarn('[FeedbackAnalytics] Failed to send feedback event', { eventType, message })
  })
}

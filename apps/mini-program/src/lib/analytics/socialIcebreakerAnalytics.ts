/* eslint-disable @typescript-eslint/no-unused-vars */

type EventType =
  | 'phase_picker_returned'
  | 'custom_session_abandoned'
  | 'select_phase_failed'
  | 'end_party_tapped'
  | 'custom_session_completed'
  | 'end_party_failed'
  | 'custom_mode_selected'
  | 'icebreaker_session_tier_changed'
  | 'icebreaker_test_mode_disclosure_rendered'
  | 'icebreaker_test_mode_disclosure_shown'
  | string

function track(
  eventType: EventType,
  socialSessionId?: string,
  icebreakerSessionId?: string,
  phase?: string,
  metadata?: Record<string, unknown>,
): void {
  // v0.1 stub: analytics are persisted server-side via /api/analytics/social-icebreaker.
  // Local no-op keeps the call site type-safe and avoids console noise in production.
}

export const socialIcebreakerAnalytics = { track }

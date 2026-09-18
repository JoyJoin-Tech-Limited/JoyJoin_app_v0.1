import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'

type EventType =
  | 'phase_picker_returned'
  | 'custom_session_abandoned'
  | 'select_phase_failed'
  | 'end_party_tapped'
  | 'custom_session_completed'
  | 'end_party_failed'
  | 'custom_mode_selected'
  | 'icebreaker_session_tier_changed'
  // Tier selector events (also social-icebreaker scoped)
  | 'combo_selected'
  | 'preset_selected'
  | 'advanced_mode_opened'
  | 'icebreaker_test_mode_disclosure_rendered'
  | 'icebreaker_test_mode_disclosure_shown'
  | 'icebreaker_test_mode_disclosure_dismissed'
  | 'icebreaker_test_mode_advance_retry'
  | 'icebreaker_test_mode_bot_advance'
  // PR1 壳层 (locked contract Q11) — warmup-prefixed names kept verbatim;
  // the ⋯ menu / tier sheet / AIGC footer are shell-owned surfaces.
  | 'warmup_entry_view'
  | 'warmup_ready_tap'
  | 'warmup_host_menu_open'
  | 'warmup_tier_sheet_open'
  | 'warmup_deep_prompt_expand'
  | 'warmup_aigc_feedback_tap'
  | 'warmup_celebration_shown'
  // PR1 flow revamp — early-end funnel + stall nudge + recap attribution.
  | 'early_end_shown'
  | 'early_end_confirm'
  | 'early_end_cancel'
  | 'stall_nudge_shown'
  | 'stall_nudge_advance'
  | 'stall_nudge_dismiss'
  | 'recap_view'
  // Gameplay interactions (audit C11)
  | 'phase_view'
  | 'lie_vote_cast'
  | 'auction_bid_placed'
  // Wave 2 Auction V2 (locked contract AC-14) — server whitelist lands with
  // the parallel backend workstream; emission here is fire-and-forget and a
  // whitelist miss is silently dropped server-side, never a client crash.
  | 'auction_outbid_notified'
  | 'auction_all_in_fired'
  | 'auction_finale_viewed'
  | 'auction_award_revealed'
  // Wave 4 Session Glow (locked contract AC-15, verifier M1) — recap 「今晚的
  // 高光」 block events. Fire-and-forget; the server whitelist lands with the
  // parallel backend workstream and a whitelist miss is silently dropped.
  | 'glow_recap_revealed'
  | 'glow_medal_awarded'
  | 'glow_detail_expanded'
  | 'dice_option_chosen'
  | 'micro_challenge_completed'
  | 'recap_connections_tap'
  | 'recap_leave_tap'
  | 'icebreaker_band_image_error'
  // Campfire Vault Card PR1 — brave card + permission whisper views.
  | 'topic_card_brave_view'
  | 'permission_line_view'

/**
 * Fire-and-forget POST to /api/analytics/social-icebreaker. The server gates
 * eventType against a whitelist (ALLOWED_SOCIAL_ICEBREAKER_EVENT_TYPES in
 * apps/server/src/routes/domains/analytics.ts) — unknown types are silently
 * dropped with `{ success: false }` and never persisted, so every new client
 * event must be whitelisted server-side first. Session identifiers ride
 * inside metadata because the endpoint only persists eventType + metadata +
 * timestamp. Failures are silent for the UI — a logWarn is the only trace
 * (mirrors authAnalytics).
 */
function track(
  eventType: EventType,
  socialSessionId?: string,
  icebreakerSessionId?: string,
  phase?: string,
  metadata?: Record<string, unknown>,
): void {
  void apiRequest<{ success?: boolean }>({
    path: '/api/analytics/social-icebreaker',
    method: 'POST',
    data: {
      eventType,
      metadata: {
        ...metadata,
        ...(socialSessionId ? { socialSessionId } : {}),
        ...(icebreakerSessionId ? { icebreakerSessionId } : {}),
        ...(phase ? { phase } : {}),
      },
    },
    handleUnauthorized: false,
  }).catch((error) => {
    logWarn('[SocialIcebreakerAnalytics] Failed to send event', {
      eventType,
      message: error instanceof Error ? error.message : 'unknown error',
    })
  })
}

export const socialIcebreakerAnalytics = { track }

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
  | 'dice_option_chosen'
  | 'micro_challenge_completed'
  | 'recap_connections_tap'

/**
 * Fire-and-forget POST to /api/analytics/social-icebreaker (server accepts any
 * eventType and always 200s). Session identifiers ride inside metadata because
 * the endpoint only persists eventType + metadata + timestamp. Failures are
 * silent for the UI — a logWarn is the only trace (mirrors authAnalytics).
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

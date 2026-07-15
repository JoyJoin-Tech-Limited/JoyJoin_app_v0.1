import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'

export type SquadUnboxingEventType =
  | 'squad_unboxing_reveal'
  | 'squad_unboxing_reveal_drag'
  | 'squad_unboxing_reveal_tap'
  | 'squad_unboxing_box_tap'
  | 'squad_unboxing_card_focus'
  | 'squad_unboxing_card_flip'
  | 'squad_unboxing_reveal_all_tap'
  | 'squad_unboxing_all_revealed'
  | 'squad_unboxing_card_detail_dismiss'
  | 'squad_unboxing_confirm_attendance_tap'
  | 'squad_unboxing_confirm_attendance_success'
  | 'squad_unboxing_confirm_attendance_error'
  | 'squad_unboxing_share_poster_tap'
  | 'squad_unboxing_bubble_reveal_complete'
  | 'squad_unboxing_box_open_milestone'
  | 'squad_unboxing_ready_hero_fallback'
  | 'squad_unboxing_scroll_depth'
  | 'squad_unboxing_connection_story_expand'
  | 'squad_unboxing_connection_story_collapse'
  | 'squad_unboxing_tonights_table_view'
  | 'squad_unboxing_analysis_retry_tap'
  | 'squad_unboxing_deck_collapse'
  | 'squad_unboxing_deck_reopen'
  | 'match_reveal_prelude_started'
  | 'match_reveal_prelude_completed'
  | 'match_reveal_prelude_skipped'
  | 'match_reveal_prelude_cta_tapped'

// NOTE: `squad_unboxing_card_detail_dismiss` was reinstated upstream
// (a6ea57284, 2026-07-14) as the `resolveCardFocusInteraction` dismiss action
// — tapping the focused card a second time unfocuses and returns the bubble
// to the resting voice. See docs/systems/squad-unboxing-analytics-funnels.md.
//
// NOTE: `squad_unboxing_deck_collapse` and `squad_unboxing_deck_reopen`
// (pocket-the-deck, contract sprint-contract.squad-unboxing-pocket-deck-20260715.md)
// are accepted by the server whitelist at
// apps/server/src/routes/domains/analytics.ts (locked by
// apps/server/src/__tests__/squadUnboxingAnalyticsRoutes.test.ts) as of
// 2026-07-15. Events emitted before the whitelist follow-up landed were
// dropped server-side (fail-open) and are not backfilled.

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

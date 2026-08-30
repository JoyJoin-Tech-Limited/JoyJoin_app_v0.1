import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'

/**
 * MiniScript V2 P2 gameplay events (sprint contract AC-11).
 *
 * Sent through the existing /api/analytics/discover whitelist (the
 * flash_search_started precedent): enum-only event types registered
 * server-side, metadata sanitized/capped, fail-open so a failed send never
 * blocks gameplay.
 *
 * Spoiler hygiene (SEC-03): metadata NEVER carries reaction text, motive
 * correctness, suspect choices, or the correct-answer index. Counts and act
 * numbers only.
 */
export type MiniScriptGameplayEventType =
  | 'miniscript_evidence_presented'
  | 'miniscript_vote_round1_submitted'
  | 'miniscript_vote_round2_submitted'
  | 'miniscript_clue_drawer_opened'

export function trackMiniScriptGameplay(
  eventType: MiniScriptGameplayEventType,
  metadata?: Record<string, number>,
): void {
  void apiRequest<{ success?: boolean }>({
    path: '/api/analytics/discover',
    method: 'POST',
    data: {
      eventType,
      metadata: metadata ?? {},
      timestamp: Date.now(),
    },
    handleUnauthorized: false,
  }).catch((error) => {
    const message = error instanceof Error ? error.message : 'unknown error'
    logWarn('[MiniScriptAnalytics] event failed; gameplay continues', {
      eventType,
      message,
    })
  })
}

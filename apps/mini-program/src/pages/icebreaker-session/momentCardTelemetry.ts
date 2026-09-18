import { apiRequest } from '../../lib/api/api'
import { logWarn } from '../../lib/utils/logger'
import { buildSocialPath } from './icebreakerSessionModel'

/**
 * Wave 5 T-1 (release-train §2-f G3-a): the moment-card 'generate' numerator.
 *
 * The only LIVE moment-card surface is the recap 「生成高光」 CTA
 * (MomentCardCTA in phases/RecapPhaseView.tsx) — the canvas overlay
 * (overlays/MomentCardView.tsx) has no JSX consumer and the server-rendered
 * PNG route is flag-gated OFF, so a successful `GET /moment-card` panel open
 * is the honest "user generated the moment card" signal.
 *
 * Semantics: fire-and-forget POST to the dedicated moment-card-event route
 * (writes `moment_card_interactions`; the §2-f numerator counts distinct
 * sessions with action='generate'). Deduped ONCE per session per app
 * lifetime via a module-level Set — the session page stays alive in the
 * WeChat nav stack, so remounts and repeat taps never re-emit. Fail-open per
 * analytics canon: a dropped event is a logWarn, never a user-facing error.
 */
const emittedGenerateSessions = new Set<string>()

export function emitMomentCardGenerateOnce(socialSessionId: string): void {
  if (!socialSessionId || emittedGenerateSessions.has(socialSessionId)) return
  emittedGenerateSessions.add(socialSessionId)
  void apiRequest({
    path: buildSocialPath(socialSessionId, '/moment-card-event'),
    method: 'POST',
    data: { action: 'generate' },
  }).catch(() => {
    logWarn('[MomentCard] generate telemetry dropped')
  })
}

/** Test-only: clear the per-app-lifetime dedupe set. */
export function __resetMomentCardGenerateTelemetryForTests(): void {
  emittedGenerateSessions.clear()
}

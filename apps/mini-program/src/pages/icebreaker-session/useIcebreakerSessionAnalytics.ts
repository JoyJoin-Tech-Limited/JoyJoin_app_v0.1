import { useEffect, useRef } from 'react'
import { socialIcebreakerAnalytics } from '../../lib/analytics/socialIcebreakerAnalytics'
import type { IcebreakerSession } from './icebreakerSessionModel'
import type { SessionPhase } from './phaseViews'

/**
 * Session-level analytics effects extracted from index.tsx (maintainability:
 * the page was approaching the 1800-line gate). Covers: phase_view dedupe,
 * stall nudge impression, recap_view attribution, phase-picker return, and
 * custom-mode abandonment on unmount.
 */

export interface UseIcebreakerSessionAnalyticsInput {
  session: IcebreakerSession | null
  phase: SessionPhase
  socialSessionId: string | null
  playerCount: number
  isHost: boolean
}

export function useIcebreakerSessionAnalytics({
  session,
  phase,
  socialSessionId,
  playerCount,
  isHost,
}: UseIcebreakerSessionAnalyticsInput) {
  const phaseViewTrackedRef = useRef<string | null>(null)
  const stallNudgeShownForRef = useRef<number | null>(null)
  const recapTrackedRef = useRef(false)
  const customSessionCompletedRef = useRef(false)
  const customSessionMetaRef = useRef({
    socialSessionId: '',
    icebreakerSessionId: '',
    eventTier: undefined as string | undefined,
    phase: '' as string,
    playerCount: 0,
    completedPhases: [] as string[],
  })

  if (session?.eventTier === 'custom' && (phase === 'recap' || phase === 'ended')) {
    customSessionCompletedRef.current = true
  }

  // Phase impression analytics: one phase_view per phase entry.
  useEffect(() => {
    if (!session || phase === 'waiting' || phaseViewTrackedRef.current === phase) {
      return
    }
    phaseViewTrackedRef.current = phase
    socialIcebreakerAnalytics.track(
      'phase_view',
      socialSessionId ?? undefined,
      session.icebreakerSessionId,
      phase,
      { playerCount },
    )
  }, [phase, session, socialSessionId, playerCount])

  // Custom-mode picker return tracking.
  const prevPhaseRef = useRef<SessionPhase>('waiting')
  useEffect(() => {
    const prev = prevPhaseRef.current
    if (prev !== phase && phase === 'phase_selection' && prev !== 'waiting' && prev !== 'ended') {
      socialIcebreakerAnalytics.track(
        'phase_picker_returned',
        socialSessionId ?? undefined,
        session?.icebreakerSessionId,
        prev,
        {
          playerCount,
          completedCount: session?.completedPhases?.length ?? 0,
        },
      )
    }
    prevPhaseRef.current = phase
  }, [phase, socialSessionId, session, playerCount])

  // Stall nudge impression (host only; once per nudge).
  useEffect(() => {
    const nudgeAt = session?.stallNudgeAt
    if (!nudgeAt || !isHost || stallNudgeShownForRef.current === nudgeAt) {
      return
    }
    stallNudgeShownForRef.current = nudgeAt
    socialIcebreakerAnalytics.track(
      'stall_nudge_shown',
      socialSessionId ?? undefined,
      session?.icebreakerSessionId,
      session?.currentPhase,
      { playerCount },
    )
  }, [session?.stallNudgeAt, isHost, socialSessionId, session?.icebreakerSessionId, session?.currentPhase, playerCount])

  // recap_view with source attribution (natural vs early-end).
  useEffect(() => {
    if ((phase !== 'recap' && phase !== 'ended') || !session || recapTrackedRef.current) {
      return
    }
    recapTrackedRef.current = true
    socialIcebreakerAnalytics.track(
      'recap_view',
      socialSessionId ?? undefined,
      session.icebreakerSessionId,
      phase,
      {
        source: session.lastAdvanceTrigger === 'early_end_jump' ? 'early_end' : 'natural',
        phasesCompleted: (session.completedPhases ?? []).filter((p) => p !== 'phase_selection').length,
        playerCount,
      },
    )
  }, [phase, session, socialSessionId, playerCount])

  // Keep latest session metadata in refs for unmount-time abandonment tracking.
  useEffect(() => {
    customSessionMetaRef.current = {
      socialSessionId: socialSessionId ?? '',
      icebreakerSessionId: session?.icebreakerSessionId ?? '',
      eventTier: session?.eventTier,
      phase,
      playerCount,
      completedPhases: session?.completedPhases ?? [],
    }
  }, [session, socialSessionId, phase, playerCount])

  // Track custom-mode abandonment when the page unmounts without reaching recap/ended.
  useEffect(() => {
    return () => {
      const meta = customSessionMetaRef.current
      if (meta.eventTier === 'custom' && !customSessionCompletedRef.current && meta.socialSessionId) {
        socialIcebreakerAnalytics.track(
          'custom_session_abandoned',
          meta.socialSessionId,
          meta.icebreakerSessionId,
          meta.phase,
          {
            playerCount: meta.playerCount,
            completedPhases: meta.completedPhases,
          },
        )
      }
    }
  }, [])
}

import { useEffect, useRef } from 'react'
import { socialIcebreakerAnalytics } from '../../lib/analytics/socialIcebreakerAnalytics'
import type { IcebreakerSession } from './icebreakerSessionModel'
import type { SessionPhase } from './phaseViews'
import { shouldNudgeHostForSuggestion } from './sessionShellLogic'
import { countMySessionActions } from './viewModels/sessionHealthModel'
import { clearPhaseDurationSource, syncPhaseDurationSource } from './viewModels/phaseDurationModel'

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
  /** Wave 2 P1 (contract AC-06): needed for myActionCount derivation. */
  currentUserId?: string
}

export function useIcebreakerSessionAnalytics({
  session,
  phase,
  socialSessionId,
  playerCount,
  isHost,
  currentUserId,
}: UseIcebreakerSessionAnalyticsInput) {
  const phaseViewTrackedRef = useRef<string | null>(null)
  const stallNudgeShownForRef = useRef<string | null>(null)
  const recapTrackedRef = useRef(false)
  const customSessionCompletedRef = useRef(false)

  // P2 #4 环节时长预期 (2026-10-20): publish the session's duration source
  // (compiled runPlan + tier) for WaitingPhase's 「今晚的环节」 chain and the
  // PhaseIntroOverlay's 「约 N 分钟」 line. Written in the render body so the
  // module snapshot is fresh before any child re-renders (idempotent; the
  // customSessionCompletedRef write below is the established precedent), and
  // cleared on unmount so a stacked page never reads a foreign session.
  syncPhaseDurationSource(session)
  useEffect(() => () => clearPhaseDurationSource(), [])
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

  // AC-20 (plan #37) ready-rate funnel: one snapshot when the session LEAVES
  // warmup — the numerator/denominator pair (readyCount / playerCount) rides
  // a single event so the 30-day baseline is computable without joins.
  // Dedicated prev ref (the picker-return effect above owns prevPhaseRef).
  const warmupRateTrackedRef = useRef(false)
  const warmupPrevPhaseRef = useRef<SessionPhase>('waiting')
  useEffect(() => {
    const prev = warmupPrevPhaseRef.current
    warmupPrevPhaseRef.current = phase
    if (warmupRateTrackedRef.current || !session) return
    if (prev === 'warmup' && phase !== 'warmup' && phase !== 'waiting') {
      warmupRateTrackedRef.current = true
      const readyCount = session.warmupReadyUserIds?.length ?? 0
      socialIcebreakerAnalytics.track(
        'warmup_ready_rate',
        socialSessionId ?? undefined,
        session.icebreakerSessionId,
        'warmup',
        {
          readyCount,
          playerCount,
          everyoneReady: playerCount > 0 && readyCount >= playerCount,
        },
      )
    }
  }, [phase, session, socialSessionId, playerCount])

  // Stall nudge impression (S7 静默救援): fires once per suggestion arrival,
  // host-only. The retired server field `stallNudgeAt` never gets set in the
  // current server (machinery removed 2026-07-29) — the suggestion's
  // generatedAt is the one-shot identity that keeps the funnel alive.
  useEffect(() => {
    const suggestionGeneratedAt = session?.xiaoyueAdaptiveSuggestion?.generatedAt
    if (
      !shouldNudgeHostForSuggestion({
        isHost,
        lastNudgedGeneratedAt: stallNudgeShownForRef.current,
        suggestionGeneratedAt,
      })
    ) {
      return
    }
    stallNudgeShownForRef.current = suggestionGeneratedAt ?? null
    socialIcebreakerAnalytics.track(
      'stall_nudge_shown',
      socialSessionId ?? undefined,
      session?.icebreakerSessionId,
      session?.currentPhase,
      { playerCount },
    )
  }, [session?.xiaoyueAdaptiveSuggestion?.generatedAt, isHost, socialSessionId, session?.icebreakerSessionId, session?.currentPhase, playerCount])

  // recap_view with source attribution (natural vs early-end).
  useEffect(() => {
    if ((phase !== 'recap' && phase !== 'ended') || !session || recapTrackedRef.current) {
      return
    }
    recapTrackedRef.current = true
    const source = session.lastAdvanceTrigger === 'early_end_jump' ? 'early_end' : 'natural'
    const phasesCompleted = (session.completedPhases ?? []).filter((p) => p !== 'phase_selection').length
    socialIcebreakerAnalytics.track(
      'recap_view',
      socialSessionId ?? undefined,
      session.icebreakerSessionId,
      phase,
      {
        source,
        phasesCompleted,
        playerCount,
      },
    )
    // AC-20 (plan #37) phase-completion-rate: same terminal moment, single
    // event carrying the completed/enabled pair for the baseline funnel.
    socialIcebreakerAnalytics.track(
      'phase_completion_rate',
      socialSessionId ?? undefined,
      session.icebreakerSessionId,
      phase,
      {
        completedCount: phasesCompleted,
        enabledCount: (session.enabledPhases ?? []).filter((p) => p !== 'phase_selection').length,
        earlyEnd: source === 'early_end',
        playerCount,
      },
    )
    // Wave 2 P1 (sprint icebreaker-polish-p1, contract AC-06 补6): session
    // health snapshot — once per user at recap first display. myActionCount
    // is derived locally from the final session state (zero new requests).
    socialIcebreakerAnalytics.track(
      'session_health_snapshot',
      socialSessionId ?? undefined,
      session.icebreakerSessionId,
      phase,
      {
        phaseCount: phasesCompleted,
        myActionCount: countMySessionActions(session, currentUserId ?? ''),
        playerCount,
      },
    )
  }, [phase, session, socialSessionId, playerCount, currentUserId])

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

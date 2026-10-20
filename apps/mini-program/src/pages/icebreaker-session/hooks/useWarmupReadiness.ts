import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SocialTopic } from '@shared/socialIcebreaker'
import { socialIcebreakerAnalytics } from '../../../lib/analytics/socialIcebreakerAnalytics'
import type { SessionParticipant } from '../phaseUtils'
import { buildCTAState, getWarmupCardState } from '../viewModels/warmupViewModels'
import type { CTAState, TopicsRecoveryState, WarmupCardState } from '../viewModels/warmupViewModels'

export interface UseWarmupReadinessInput {
  topics: SocialTopic[]
  currentIndex: number
  readyUserIds: string[]
  participants: SessionParticipant[]
  currentUserId: string
  isHost: boolean
  isGeneratingTopics: boolean
  topicsError: boolean
  topicsRecovery: TopicsRecoveryState | null
  /** Mirrors `pendingAction === 'warmup-ready'` — drives the rollback branch. */
  isUpdatingReady: boolean
  socialSessionId?: string
  icebreakerSessionId?: string
  onToggleReady: () => void
}

export interface WarmupReadiness {
  cardState: WarmupCardState
  /** S1 — self ready tapped; the ember ignites before the server echo. */
  selfReadyOptimistic: boolean
  effectiveIsReady: boolean
  effectiveEveryoneReady: boolean
  /** Count mirrors the optimistic self ember so the tally responds instantly. */
  optimisticReadyCount: number
  ctaState: CTAState
  handleToggleReady: () => void
}

/**
 * Warmup readiness cluster (sprint icebreaker-uiux-wave1, AC-01).
 *
 * Lifted out of WarmupPhaseView so the page can render the CTA dock as a
 * flex SIBLING of the ScrollView (pool-reg__footer precedent — never
 * position:fixed inside the transform-keeping phase shell) while the view
 * keeps consuming the same single source of truth for the ember rim and the
 * ready capsule. The logic below is verbatim from the old in-view cluster:
 * optimistic self-ready morph + settle rollback, TTC analytics on the ready
 * tap, and the shared card-state machine.
 */
export function useWarmupReadiness({
  topics,
  currentIndex,
  readyUserIds,
  participants,
  currentUserId,
  isHost,
  isGeneratingTopics,
  topicsError,
  topicsRecovery,
  isUpdatingReady,
  socialSessionId,
  icebreakerSessionId,
  onToggleReady,
}: UseWarmupReadinessInput): WarmupReadiness {
  const isReady = readyUserIds.includes(currentUserId)
  const everyoneReady = participants.length > 0 && readyUserIds.length >= participants.length
  const isLastTopic = currentIndex >= Math.max(topics.length - 1, 0)

  const cardState = useMemo<WarmupCardState>(
    () =>
      getWarmupCardState({
        topics,
        currentIndex,
        isHost,
        isGeneratingTopics,
        topicsError,
        topicsRecovery,
      }),
    [topics, currentIndex, isHost, isGeneratingTopics, topicsError, topicsRecovery],
  )

  // ── TTC timing for the ready tap ───────────────────────────────
  const componentMountAtRef = useRef(Date.now())
  const firstTopicRenderedAtRef = useRef<number | null>(null)
  useEffect(() => {
    if (cardState === 'topic_card' && firstTopicRenderedAtRef.current === null) {
      firstTopicRenderedAtRef.current = Date.now()
    }
  }, [cardState])

  // Campfire Vault Card PR2 (S1) — the optimistic self ember hands off to
  // server truth: cleared when the echo confirms, rolled back (quiet S4 fade
  // inside the rim) when the update settles without confirmation.
  const [selfReadyOptimistic, setSelfReadyOptimistic] = useState(false)
  useEffect(() => {
    if (!selfReadyOptimistic) return
    // Clear when the server confirms (isReady), and also when no ready
    // request is actually in flight — covers the skipped-tap path where
    // pendingAction never changed and the optimistic flag would otherwise
    // stick forever (deps wouldn't re-fire without selfReadyOptimistic).
    if (isReady || !isUpdatingReady) {
      setSelfReadyOptimistic(false)
    }
  }, [isReady, isUpdatingReady, selfReadyOptimistic])

  // P0-4 (2026-07-26): optimistic ready morph — the CTA flips to the calm
  // "已准备" state at tap time instead of showing a spinner while the
  // request is in flight. Rollback is the effect above + the warm toast
  // from the page handler.
  const effectiveIsReady = isReady || selfReadyOptimistic
  const effectiveEveryoneReady =
    everyoneReady ||
    (selfReadyOptimistic && !isReady && readyUserIds.length + 1 >= participants.length)
  const ctaState = useMemo(
    () => buildCTAState(effectiveIsReady, isHost, effectiveEveryoneReady, isLastTopic),
    [effectiveIsReady, isHost, effectiveEveryoneReady, isLastTopic],
  )

  // S1 companion — the count mirrors the optimistic self ember so the ready
  // tally responds to the tap immediately instead of waiting for the server
  // echo (previously the button spun for seconds with a frozen count).
  const optimisticReadyCount =
    selfReadyOptimistic && !readyUserIds.includes(currentUserId)
      ? readyUserIds.length + 1
      : readyUserIds.length

  const handleToggleReady = useCallback(() => {
    const ttcMs = Date.now() - (firstTopicRenderedAtRef.current ?? componentMountAtRef.current)
    socialIcebreakerAnalytics.track(
      'warmup_ready_tap',
      socialSessionId,
      icebreakerSessionId,
      'warmup',
      {
        ttcMs,
        isHost,
        fromReady: isReady,
        playerCount: participants.length,
        readyCount: readyUserIds.length,
      },
    )
    // S1 — self ember ignites optimistically on tap (no server wait); the
    // confirm haptic for this tap is action-owned (performSocialAction, Wave 3).
    setSelfReadyOptimistic(!isReady)
    onToggleReady()
  }, [
    onToggleReady,
    isReady,
    isHost,
    participants.length,
    readyUserIds.length,
    socialSessionId,
    icebreakerSessionId,
  ])

  return {
    cardState,
    selfReadyOptimistic,
    effectiveIsReady,
    effectiveEveryoneReady,
    optimisticReadyCount,
    ctaState,
    handleToggleReady,
  }
}

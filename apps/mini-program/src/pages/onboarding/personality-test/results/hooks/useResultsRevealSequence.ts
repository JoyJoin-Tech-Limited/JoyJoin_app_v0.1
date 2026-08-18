import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { archetypeRegistry } from '@shared/personality/archetypeRegistry'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { useUnload } from '../../../../../hooks/useUnload'
import type { useOnboardingAnalytics } from '../../../../../hooks/onboarding/useOnboardingAnalytics'
import { apiRequest } from '../../../../../lib/api/api'
import {
  clearAnonymousAssessmentStorage,
  hasAnonymousAssessmentResult,
  isAnonymousAssessmentSessionCompleted,
  readAnonymousAssessmentSession,
  saveAnonymousAssessmentSession,
  type AnonymousAssessmentSessionSnapshot,
  type AnonymousAssessmentTopMatch,
} from '../../../../../lib/auth/anonymousOnboarding'
import { getDegradationTier, type DegradationTier } from '../../../../../lib/utils/frameBudget'
import { haptics } from '../../../../../lib/utils/haptics'
import { logError, logInfo, logWarn } from '../../../../../lib/utils/logger'
import { preloadImagesWithDiagnostics } from '../../../../../lib/utils/imagePreload'
import { MINI_PROGRAM_ROUTES } from '../../../../../lib/onboarding/onboardingRoutes'
import {
  getArchetypeSpritesheetLocalPath,
  ASSET_BASE_WEBP_LOCAL,
} from '../../visuals'
import { getRevealStripPreloadUrl } from '../ArchetypeRevealStrip'
import {
  ARCHETYPE_SEQUENCE,
  buildEchoWhispers,
  buildResolvedResultState,
  ECHO_WHISPER_ROTATE_STEPS,
  getAnimationProfile,
  getTopMatches,
  resolveResultErrorMessage,
  shouldNearMiss,
  waitFor,
  type AnimationProfile,
  type AnimationProfileName,
  type FlowStage,
  type ResolvedResultState,
  type RevealPhase,
  type SlotPhase,
} from '../resultHelpers'

interface UseResultsRevealSequenceParams {
  hasCompletedReplay: boolean
  initialSnapshot: AnonymousAssessmentSessionSnapshot | null
  initialResolvedResult: ResolvedResultState | null
  authUserResult: ResolvedResultState | null
  personalitySlotAnimationEnabled: boolean
  personalitySlotProfileName: AnimationProfileName
  spriteReady: { isReady: boolean; loaded: boolean; hasError: boolean }
  analytics: ReturnType<typeof useOnboardingAnalytics>
  isAuthenticated: boolean
  /** `auth.user?.archetype ?? auth.user?.primaryArchetype` — the display fallback for archetype-holders. */
  authUserArchetype: string | null
  /**
   * Indirection for the share-poster reset: useResultShareActions is created in
   * the page from this hook's outputs, so the poster clear handler cannot be a
   * direct dependency (circular). The page assigns `clearSharePosterRef.current`
   * during render, before any flow can run.
   */
  clearSharePosterRef: MutableRefObject<() => void>
}

/**
 * Slot → reveal → bridge → result orchestration for the personality-test
 * results page (extracted from index.tsx, 2026-08-18 split — mirrors the
 * icebreaker-session useSocialActions pattern). Owns every piece of flow
 * state plus the timers; the page keeps data derivation and stage dispatch.
 */
export function useResultsRevealSequence({
  hasCompletedReplay,
  initialSnapshot,
  initialResolvedResult,
  authUserResult,
  personalitySlotAnimationEnabled,
  personalitySlotProfileName,
  spriteReady,
  analytics,
  isAuthenticated,
  authUserArchetype,
  clearSharePosterRef,
}: UseResultsRevealSequenceParams) {
  const [sessionSnapshot, setSessionSnapshot] = useState<AnonymousAssessmentSessionSnapshot | null>(initialSnapshot)
  const [resultState, setResultState] = useState<ResolvedResultState | null>(initialResolvedResult)
  const [flowStage, setFlowStage] = useState<FlowStage>(hasCompletedReplay ? 'result' : 'loading')
  const [slotPhase, setSlotPhase] = useState<SlotPhase>('anticipation')
  /** Celebration tier mirrored from degradationTierRef as state so SlotStage can gate effects. */
  const [celebrationTier, setCelebrationTier] = useState<DegradationTier>('full')
  const [revealPhase, setRevealPhase] = useState<RevealPhase>('silhouette')
  const [slotDisplay, setSlotDisplay] = useState({
    reelIndex: 0,
    progress: hasCompletedReplay ? 100 : 0,
  })
  const [phaseText, setPhaseText] = useState(hasCompletedReplay ? '' : '准备揭晓...')
  const [isFetchingResult, setIsFetchingResult] = useState(false)
  const [isSlowNetwork, setIsSlowNetwork] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [completionMode, setCompletionMode] = useState<'replay' | 'animated' | null>(hasCompletedReplay ? 'replay' : null)
  const [showSkipAnimation, setShowSkipAnimation] = useState(false)

  const mountedRef = useRef(false)
  const runIdRef = useRef(0)
  const resultStateRef = useRef<ResolvedResultState | null>(initialResolvedResult)
  const didTrackCompletionRef = useRef(false)
  const degradationTierRef = useRef<DegradationTier>('full')
  const isAnimatingRef = useRef(false)
  const resultPreloadInitiatedRef = useRef(false)

  const profileRef = useRef<AnimationProfile>(getAnimationProfile(personalitySlotProfileName))

  // Cleanup on page unload to prevent timer leaks and stale state updates
  useUnload(() => {
    mountedRef.current = false
  })

  // Auth hydrates after mount — keep the profile ref in sync so a late
  // `features` payload still selects the server-specified timing variant.
  useEffect(() => {
    profileRef.current = getAnimationProfile(personalitySlotProfileName)
  }, [personalitySlotProfileName])

  // new update to track completion
  useEffect(() => {
    if (!resultState && authUserResult) {
      resultStateRef.current = authUserResult
      setResultState(authUserResult)
      setFlowStage('result')
      setCompletionMode('replay')
    }
  }, [resultState, authUserResult])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      runIdRef.current += 1
      isAnimatingRef.current = false
      // Note: in-flight fetches use apiRequest's internal timeout; Taro.request
      // does not support AbortSignal, so we do not maintain an abort controller.
    }
  }, [])

  /**
   * WeChat keeps pages in the navigation stack alive (hidden, not unmounted).
   * If the user swipes back and returns, or the page is reused, transient
   * guards like isAnimatingRef may survive. Reset them on every show.
   */
  useDidShow(() => {
    isAnimatingRef.current = false
  })

  /**
   * Preload result-stage images on mount (covers direct entry / page refresh
   * where the test-phase preload didn't run).
   */
  useEffect(() => {
    if (resultPreloadInitiatedRef.current) return
    resultPreloadInitiatedRef.current = true
    const urls = [getArchetypeSpritesheetLocalPath()]
    const primary = resultStateRef.current?.result.primaryArchetype
    if (primary) {
      urls.push(`${ASSET_BASE_WEBP_LOCAL}/archetype-${primary}.webp`)
    }
    void preloadImagesWithDiagnostics(urls, 'personality-results-mount')
  }, [])

  useEffect(() => {
    resultStateRef.current = resultState
  }, [resultState])

  const topMatches = useMemo(() => {
    if (Array.isArray(resultState?.topMatches) && resultState.topMatches.length > 0) {
      return resultState.topMatches
    }
    return getTopMatches(sessionSnapshot?.result, sessionSnapshot?.topArchetypes)
  }, [resultState, sessionSnapshot])

  const isDecisive = resultState?.result.isDecisive ?? sessionSnapshot?.result?.isDecisive

  // Use resultStateRef as a synchronous fallback so the slot target and the
  // result page never diverge during the animation flow. React state updates
  // are batched; the ref is updated immediately in runResultFlow.
  const displayArchetype = resultState?.result.primaryArchetype
    ?? resultStateRef.current?.result.primaryArchetype
    ?? sessionSnapshot?.result?.primaryArchetype
    ?? authUserArchetype
    ?? topMatches[0]?.archetype
    ?? null

  const displayArchetypeName = displayArchetype
    ? archetypeRegistry[displayArchetype]?.name ?? displayArchetype
    : '神秘原型'

  useEffect(() => {
    if (flowStage !== 'result' || !completionMode || didTrackCompletionRef.current) {
      return
    }
    didTrackCompletionRef.current = true
    analytics.stepCompleted({
      completionMode,
      isAuthenticated,
      primaryArchetype: displayArchetypeName,
    })
    // Operational visibility: how often do users land on 典型 vs 非典型 results?
    if (typeof isDecisive === 'boolean') {
      analytics.interaction('typicality_badge_impression', {
        primaryArchetype: displayArchetypeName,
        isDecisive,
        typicality: isDecisive ? 'typical' : 'atypical',
      })
    }
  }, [analytics, isAuthenticated, completionMode, displayArchetypeName, flowStage, isDecisive])

  const fetchResult = useCallback(async (runId: number, forceRefresh = false): Promise<ResolvedResultState | null> => {
    const latestSnapshot = readAnonymousAssessmentSession()

    if (!forceRefresh) {
      const cachedResult = buildResolvedResultState(latestSnapshot) ?? resultStateRef.current
      if (cachedResult) {
        if (mountedRef.current && runId === runIdRef.current) {
          resultStateRef.current = cachedResult
          setResultState(cachedResult)
          setSessionSnapshot(latestSnapshot)
        }
        return cachedResult
      }
    }

    if (!latestSnapshot?.sessionId) {
      return null
    }

    setIsFetchingResult(true)

    try {
      const response = await apiRequest<{
        sessionId: string
        completedAt?: string
        result: NonNullable<typeof latestSnapshot.result>
        topArchetypes?: AnonymousAssessmentTopMatch[]
      }>({
        path: `/api/assessment/v4/${encodeURIComponent(latestSnapshot.sessionId)}/result`,
        timeout: 8000,
      })

      if (!mountedRef.current || runId !== runIdRef.current) {
        return null
      }

      const resolved: ResolvedResultState = {
        sessionId: response.sessionId,
        completedAt: response.completedAt,
        result: response.result,
        topMatches: getTopMatches(response.result, response.topArchetypes),
      }

      const currentSnapshot = readAnonymousAssessmentSession()
      const nextSnapshot: AnonymousAssessmentSessionSnapshot = {
        sessionId: response.sessionId,
        phase: currentSnapshot?.phase ?? 'completed',
        timestamp: Date.now(),
        completedAt: response.completedAt ?? currentSnapshot?.completedAt,
        result: response.result,
        topArchetypes: resolved.topMatches,
        resultSequenceCompletedAt: currentSnapshot?.resultSequenceCompletedAt,
      }

      saveAnonymousAssessmentSession(nextSnapshot)
      resultStateRef.current = resolved
      setSessionSnapshot(nextSnapshot)
      setResultState(resolved)

      logInfo('[PersonalityResults] Result synchronized', {
        sessionId: response.sessionId,
        primaryArchetype: response.result.primaryArchetype ?? null,
        forceRefresh,
      })

      return resolved
    } catch (error) {
      // Detect offline/network errors for graceful degradation.
      let offline = false
      try {
        const { networkType } = await Taro.getNetworkType()
        offline = networkType === 'none'
      } catch {
        offline = false
      }
      const isNetworkError =
        offline ||
        (error instanceof Error &&
          /network|offline|timeout|abort|failed to fetch/i.test(error.message))

      const message = resolveResultErrorMessage(error)
      if (mountedRef.current && runId === runIdRef.current) {
        setIsOffline(offline)
        setErrorMessage(message)
        analytics.errorOccurred('result_fetch_failed', message)
        analytics.interaction('result_fetch_failed_context', {
          isNetworkError,
          isOffline: offline,
          retryCount: retryCountRef.current,
        })
      }
      logError('[PersonalityResults] Failed to fetch result', {
        message,
        isNetworkError,
        isOffline: offline,
      })
      return null
    } finally {
      if (mountedRef.current && runId === runIdRef.current) {
        setIsFetchingResult(false)
      }
    }
  }, [analytics])

  const runResultFlow = useCallback(async (options?: { forceRefresh?: boolean }) => {
    isAnimatingRef.current = true

    try {
      const nextRunId = runIdRef.current + 1
      runIdRef.current = nextRunId
      didTrackCompletionRef.current = false
      retryCountRef.current = 0
      setCompletionMode(null)

      const flowStartedAt = Date.now()
      const latestSnapshot = readAnonymousAssessmentSession()

      setSessionSnapshot(latestSnapshot)
      setIsSlowNetwork(false)
      setIsOffline(false)
      setErrorMessage('')
      setPhaseText('准备揭晓...')
      setSlotDisplay({ reelIndex: 0, progress: 0 })
      setRevealPhase('silhouette')
      setSlotPhase('anticipation')
      clearSharePosterRef.current()

      if (!latestSnapshot?.sessionId) {
        logWarn('[PersonalityResults] Missing anonymous session id')
        analytics.validationFailed('session', 'missing-session-id')
        setFlowStage('empty')
        return
      }

      if (!isAnonymousAssessmentSessionCompleted(latestSnapshot) && !hasAnonymousAssessmentResult(latestSnapshot)) {
        logWarn('[PersonalityResults] Assessment session is not completed yet', {
          sessionId: latestSnapshot.sessionId,
        })
        analytics.validationFailed('session', 'assessment-not-complete')
        setFlowStage('empty')
        return
      }

      const hasReplayFastPath = Boolean(
        latestSnapshot.resultSequenceCompletedAt
        && hasAnonymousAssessmentResult(latestSnapshot)
        && !options?.forceRefresh,
      )

      if (hasReplayFastPath) {
        const cachedResult = buildResolvedResultState(latestSnapshot)
        if (cachedResult) {
          resultStateRef.current = cachedResult
          setResultState(cachedResult)
        }
        setFlowStage('result')
        setSlotDisplay(prev => ({ ...prev, progress: 100 }))
        setPhaseText('')
        setCompletionMode('replay')
        return
      }

      // Kill-switch only: the slot animation is the default experience.
      // It is skipped only when the server-side feature flag explicitly disables it.
      const shouldSkipAnimation = !personalitySlotAnimationEnabled
      if (shouldSkipAnimation) {
        logInfo('[PersonalityResults] Slot animation disabled by feature flag', {
          personalitySlotAnimationEnabled,
        })
        const fetchPromise = fetchResult(nextRunId, Boolean(options?.forceRefresh))
        const resolved = await fetchPromise
        if (resolved && mountedRef.current && nextRunId === runIdRef.current) {
          resultStateRef.current = resolved
          setResultState(resolved)
          setFlowStage('result')
          setSlotDisplay(prev => ({ ...prev, progress: 100 }))
          setPhaseText('')
          setCompletionMode('animated')
          analytics.stepCompleted({
            completionMode: 'animated',
            isAuthenticated,
            primaryArchetype: displayArchetypeName,
            skipReason: 'featureFlagDisabled',
          })
        } else if (mountedRef.current && nextRunId === runIdRef.current) {
          // Fetch failed — fall back to any cached/local result before surfacing
          // an error screen. This prevents transient network timeouts from
          // stranding users when a local result is already available.
          const cached = resultStateRef.current ?? buildResolvedResultState(readAnonymousAssessmentSession())
          if (cached) {
            resultStateRef.current = cached
            setResultState(cached)
            setFlowStage('result')
            setSlotDisplay(prev => ({ ...prev, progress: 100 }))
            setPhaseText('')
            setCompletionMode('animated')
            analytics.errorOccurred('result_fetch_failed_cached_fallback', 'used cached result after fetch failure')
          } else {
            setFlowStage('error')
            setErrorMessage((prev) => prev || getErrorMessage('sync-failed'))
          }
        }
        return
      }

      resultStateRef.current = options?.forceRefresh ? null : resultStateRef.current
      if (options?.forceRefresh) {
        setResultState(null)
      }

      const profile = profileRef.current
      const fetchPromise = fetchResult(nextRunId, Boolean(options?.forceRefresh))
      let didFetchResolve = false
      let fetchedResult: ResolvedResultState | null = null

      void fetchPromise
        .then((value) => {
          didFetchResolve = true
          fetchedResult = value
        })
        .catch(() => {
          didFetchResolve = true
          fetchedResult = null
        })

      setFlowStage('slot')
      // P1-3: differentiated from the completing-phase title to avoid
      // same-line-twice fatigue. The `好——` opener signals continuation
      // rather than repetition.
      setPhaseText('好——让我把命格翻到最后一页。')

      // Skip control is available immediately (accessibility + impatient
      // users) — no artificial delay before it appears.
      setShowSkipAnimation(true)

      await waitFor(profile.slotAnticipationMs)
      if (!mountedRef.current || nextRunId !== runIdRef.current) {
        return
      }

      setSlotPhase('spinning')
      // Analysis-framed fallback caption for users without local answers
      // (authenticated flow); anonymous users get echo whispers at step 0.
      setPhaseText('正在比对你的选择…')
      analytics.interaction('slot_animation_start', { sessionId: latestSnapshot.sessionId })

      // Slice 3 (2026-07-19): answer-echo whispers — rotate the user's own answer
      // texts during the spin so the wait reads as "proof of analysis", not chance.
      // Local answers exist for the anonymous flow (persona A's path); authenticated
      // users keep the default caption. Rotates inside the spin loop — no new timers.
      const echoWhispers = buildEchoWhispers()
      let lastWhisperIndex = -1

      // Measure frame budget during first half of spin for tiered degradation
      const frameBudgetPromise = getDegradationTier()

      const spinSteps = Math.max(1, Math.floor(profile.slotSpinMs / profile.slotSpinIntervalMs))
      const budgetCheckStep = Math.floor(spinSteps * 0.5)

      for (let step = 0; step < spinSteps; step += 1) {
        setSlotDisplay(prev => ({
          reelIndex: (prev.reelIndex + 1) % 12,
          progress: 10 + ((step + 1) / spinSteps) * 50,
        }))

        // Rotate echo whispers (~every 840ms); identical strings are skipped.
        if (echoWhispers.length > 0) {
          const whisperIndex = Math.floor(step / ECHO_WHISPER_ROTATE_STEPS) % echoWhispers.length
          if (whisperIndex !== lastWhisperIndex) {
            lastWhisperIndex = whisperIndex
            setPhaseText(`你说过「${echoWhispers[whisperIndex]}」`)
          }
        }

        // Check frame budget mid-spin
        if (step === budgetCheckStep) {
          const tier = await frameBudgetPromise
          degradationTierRef.current = tier
          setCelebrationTier(tier)
          logInfo('[PersonalityResults] Degradation tier', { tier })
          analytics.interaction('result_degradation_tier', { tier })
        }

        await waitFor(profile.slotSpinIntervalMs)
        if (!mountedRef.current || nextRunId !== runIdRef.current) {
          return
        }
      }

      let resolvedResult = resultStateRef.current ?? (didFetchResolve ? fetchedResult : null)

      let holdCycle = 0
      const HOLDING_MESSAGES = [
        '正在同步最终画像…',
        '悦仔在整理你的回答…',
        '马上就能揭晓了…',
      ]

      while (!resolvedResult && !didFetchResolve) {
        const elapsed = Date.now() - flowStartedAt
        const shouldShowSlowNetwork = elapsed >= profile.slowNetworkMs

        setIsSlowNetwork(shouldShowSlowNetwork)
        setSlotPhase('holding')
        // Cycle through 2-3 messages during holding (~every 4 ticks ≈ 720ms)
        const messageIndex = Math.floor(holdCycle / 4) % HOLDING_MESSAGES.length
        setPhaseText(
          shouldShowSlowNetwork
            ? `${HOLDING_MESSAGES[messageIndex]}（网络有点慢，动画继续等结果到位）`
            : HOLDING_MESSAGES[messageIndex],
        )
        // Animate progress from 60 → 68 incrementally during holding
        setSlotDisplay(prev => ({
          reelIndex: (prev.reelIndex + 1) % 12,
          progress: 60 + Math.min((holdCycle / 12) * 8, 8),
        }))

        holdCycle += 1
        await waitFor(profile.slotHoldIntervalMs)
        if (!mountedRef.current || nextRunId !== runIdRef.current) {
          return
        }

        if (Date.now() - flowStartedAt >= profile.flowSafetyTimeoutMs) {
          runIdRef.current += 1
          setIsFetchingResult(false)
          setFlowStage('error')
          setErrorMessage('网络有点慢，结果还没完全同步，重试一次吧')
          analytics.errorOccurred('result_flow_timeout', 'personality result flow timed out')
          return
        }

        resolvedResult = resultStateRef.current ?? (didFetchResolve ? fetchedResult : null)
      }

      resolvedResult = resolvedResult ?? resultStateRef.current ?? fetchedResult

      if (!mountedRef.current || nextRunId !== runIdRef.current) {
        return
      }

      if (!resolvedResult) {
        setFlowStage('error')
        setErrorMessage((previousMessage) => previousMessage || getErrorMessage('sync-failed'))
        return
      }

      // CRITICAL: Sync resultState BEFORE slot animation so displayArchetype
      // matches the slot target. Without this, the slot can land on one
      // archetype while the final result page shows a different one.
      if (resolvedResult !== resultStateRef.current) {
        resultStateRef.current = resolvedResult
        setResultState(resolvedResult)
      }

      // Unified fallback chain: both slot and result display use identical resolution.
      // With server-side validation this should always resolve to resolvedResult.result.primaryArchetype.
      const targetName = resolvedResult.result.primaryArchetype
        ?? sessionSnapshot?.result?.primaryArchetype
        ?? topMatches[0]?.archetype
        ?? 'corgi'

      // Split-brain detection: compare slot target against the synchronous ref
      // (displayArchetype from the render closure may be stale because React state
      // updates are batched). The ref was just synced above.
      const syncDisplayArchetype = resultStateRef.current?.result.primaryArchetype
        ?? sessionSnapshot?.result?.primaryArchetype
        ?? topMatches[0]?.archetype
        ?? null
      if (syncDisplayArchetype && syncDisplayArchetype !== targetName) {
        logError('[PersonalityResults] SPLIT_BRAIN_DETECTED', {
          slotTarget: targetName,
          displayArchetype: syncDisplayArchetype,
          displaySource: resultStateRef.current?.result?.primaryArchetype
            ? 'resultStateRef'
            : sessionSnapshot?.result?.primaryArchetype
              ? 'sessionSnapshot'
              : 'topMatches',
          snapshotResultNull: sessionSnapshot?.result === null,
          sessionId: latestSnapshot.sessionId,
        })
      }

      const targetIndex = ARCHETYPE_SEQUENCE.indexOf(targetName)
      const safeTargetIndex = targetIndex >= 0 ? targetIndex : 0

      // Phase 2b (2026-08-01): lazily prefetch ONLY the landed archetype's
      // reveal strip as soon as the target is known (≈1.5s of slowing budget
      // covers the CDN fetch on 4G). No-op when the archetype has no strip yet.
      const stripPreloadUrl = getRevealStripPreloadUrl(ARCHETYPE_SEQUENCE[safeTargetIndex] ?? '')
      if (stripPreloadUrl) {
        void preloadImagesWithDiagnostics([stripPreloadUrl], 'personality-reveal-strip')
      }

      const approachPositions = profile.slotSlowStepDelays.map((_, index) => (
        safeTargetIndex - profile.slotSlowStepDelays.length + index + 12
      ) % 12)

      setSlotPhase('slowing')
      setPhaseText('就快锁定了...')

      for (let index = 0; index < approachPositions.length; index += 1) {
        setSlotDisplay({
          reelIndex: approachPositions[index] ?? safeTargetIndex,
          progress: 60 + ((index + 1) / approachPositions.length) * 28,
        })
        // Haptic tick on each slowing step
        haptics('slotTick')
        await waitFor(profile.slotSlowStepDelays[index] ?? 180)

        if (!mountedRef.current || nextRunId !== runIdRef.current) {
          return
        }
      }

      const shouldDoNearMiss = shouldNearMiss(latestSnapshot.sessionId, profile.slotNearMissProbability)
      if (shouldDoNearMiss) {
        // F1 blend reframe (2026-07-19 satisfaction audit): the overshoot card is the
        // user's secondary archetype when known — "you're almost X, but really Y with
        // a shadow of X" — instead of a random neighbour. Converts a casino mechanic
        // into 被理解感; the blend indicator on the result card echoes the same archetype.
        const secondaryId = resolvedResult.result.secondaryArchetype
          ?? sessionSnapshot?.result?.secondaryArchetype
        const secondaryIndex = secondaryId ? ARCHETYPE_SEQUENCE.indexOf(secondaryId) : -1
        const useBlendMiss = profile.slotNearMissMode === 'blend'
          && secondaryIndex >= 0
          && secondaryIndex !== safeTargetIndex
        setSlotPhase('nearMiss')
        setPhaseText(useBlendMiss ? '还有一丝别的气息…' : '等等...')
        setSlotDisplay({
          reelIndex: useBlendMiss ? secondaryIndex : (safeTargetIndex + 1) % 12,
          progress: 92,
        })
        analytics.interaction('slot_near_miss', {
          mode: useBlendMiss ? 'blend' : 'random',
          secondaryArchetype: useBlendMiss ? secondaryId : undefined,
        })
        await waitFor(profile.slotNearMissMs)

        if (!mountedRef.current || nextRunId !== runIdRef.current) {
          return
        }
      }

      setSlotPhase('landed')
      setPhaseText('锁定成功')
      setSlotDisplay({
        reelIndex: safeTargetIndex,
        progress: 100,
      })
      setShowSkipAnimation(false)

      // Phase 3 (2026-08-01): rare-variant observability — track 闪光 easter-egg hits.
      // Computed from the freshly-resolved result (not the render-closure memo,
      // which may be stale inside this async flow).
      const rareVariantHit = resolvedResult.result.isDecisive === true
        && (resolvedResult.result.archetypeConfidence ?? 0) >= 0.85
      if (rareVariantHit) {
        analytics.interaction('slot_rare_variant', {
          archetype: targetName,
          archetypeConfidence: resolvedResult.result.archetypeConfidence,
        })
      }

      haptics('slotLand')

      await waitFor(profile.slotRevealPauseMs)
      if (!mountedRef.current || nextRunId !== runIdRef.current) {
        return
      }

      // Tiered degradation: skip effects if frame budget is constrained
      const tier = degradationTierRef.current

      if (tier === 'minimal' || tier === 'emergency') {
        // Skip all reveal effects; jump straight to result
        setFlowStage('result')
        setPhaseText('')
        setCompletionMode('animated')
        analytics.stepCompleted({
          completionMode: 'animated',
          isAuthenticated,
          primaryArchetype: displayArchetypeName,
          degradationTier: tier,
        })
        return
      }

      setFlowStage('reveal')
      setRevealPhase('silhouette')
      setPhaseText('先看轮廓...')

      await waitFor(profile.revealSilhouetteMs)
      if (!mountedRef.current || nextRunId !== runIdRef.current) {
        return
      }

      setRevealPhase('fill')
      setPhaseText('颜色回来了...')

      await waitFor(profile.revealFillMs)
      if (!mountedRef.current || nextRunId !== runIdRef.current) {
        return
      }

      // Reduced tier: skip glow/sparkle, go straight to result
      if (tier !== 'reduced') {
        setRevealPhase('sparkle')
        setPhaseText('灵感点亮...')
        haptics('cardReveal')

        await waitFor(profile.revealGlowMs)
        if (!mountedRef.current || nextRunId !== runIdRef.current) {
          return
        }
      }

      // Bridge: skip if fetch already resolved (no dead air)
      if (!didFetchResolve) {
        setFlowStage('bridge')
        setPhaseText('我在把这份结果装进一张更好分享的 JoyJoin 卡面。')

        await waitFor(profile.bridgeMs)
        if (!mountedRef.current || nextRunId !== runIdRef.current) {
          return
        }
      }

      const currentSnapshot = readAnonymousAssessmentSession()
      const completedSnapshot: AnonymousAssessmentSessionSnapshot = {
        sessionId: resolvedResult.sessionId,
        phase: 'completed',
        timestamp: Date.now(),
        completedAt: resolvedResult.completedAt ?? currentSnapshot?.completedAt,
        result: resolvedResult.result,
        topArchetypes: resolvedResult.topMatches,
        resultSequenceCompletedAt: new Date().toISOString(),
      }

      saveAnonymousAssessmentSession(completedSnapshot)
      resultStateRef.current = resolvedResult
      setSessionSnapshot(completedSnapshot)
      setResultState(resolvedResult)
      setFlowStage('result')
      setPhaseText('')
      setCompletionMode('animated')
    } catch (flowError) {
      const message = flowError instanceof Error ? flowError.message : '结果展示流程出错'
      logError('[PersonalityResults] runResultFlow unhandled error', { message })
      if (mountedRef.current) {
        setErrorMessage(message)
        setFlowStage('error')
        analytics.errorOccurred('result_flow_unhandled', message)
      }
    } finally {
      isAnimatingRef.current = false
    }
  }, [analytics, isAuthenticated, displayArchetypeName, fetchResult, personalitySlotAnimationEnabled, sessionSnapshot?.result, topMatches, clearSharePosterRef])

  /**
   * Start the result animation after critical assets are confirmed ready.
   *
   * Primary trigger: spriteReady.isReady (fires once the spritesheet decodes
   * or the 500ms probe timeout elapses).
   *
   * Fallback trigger: a 1-second hard timeout guarantees the flow starts even
   * if the Image() probe silently fails in the WeChat webview, or if the
   * page was reused from the stack with a stale isAnimatingRef guard.
   *
   * A flowInitiatedRef prevents double-start when both triggers fire.
   */
  const flowInitiatedRef = useRef(false)

  useEffect(() => {
    if (hasCompletedReplay) return
    if (flowInitiatedRef.current) return

    const startFlow = () => {
      if (flowInitiatedRef.current) return
      flowInitiatedRef.current = true
      void runResultFlow().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : '结果动画启动失败'
        logError('[PersonalityResults] runResultFlow rejected', { message })
        setErrorMessage(message)
        setFlowStage('error')
        analytics.errorOccurred('result_flow_rejected', message)
      })
    }

    if (spriteReady.isReady) {
      startFlow()
      return
    }

    const fallbackTimer = setTimeout(() => {
      if (mountedRef.current) {
        logWarn('[PersonalityResults] Sprite readiness fallback triggered — starting flow anyway', {
          spriteReady: spriteReady.isReady,
          loaded: spriteReady.loaded,
          hasError: spriteReady.hasError,
        })
        startFlow()
      }
    }, 1200)

    return () => clearTimeout(fallbackTimer)
  }, [hasCompletedReplay, spriteReady.isReady, spriteReady.loaded, spriteReady.hasError, runResultFlow, analytics])

  /**
   * Last-resort stuck detection: if the page remains on 'loading' for longer
   * than 15s, something fundamental is broken (runResultFlow never started,
   * or an async operation inside it hung without hitting its own timeout).
   * Force an error state so the user sees a retry button instead of a
   * perpetual spinner.
   */
  useEffect(() => {
    if (flowStage !== 'loading') return
    if (hasCompletedReplay) return

    const stuckTimer = setTimeout(() => {
      if (mountedRef.current && flowStage === 'loading') {
        logError('[PersonalityResults] Stuck on loading stage — forcing error state', {
          spriteReady: spriteReady.isReady,
          isAnimating: isAnimatingRef.current,
          flowInitiated: flowInitiatedRef.current,
        })
        setErrorMessage('页面加载超时，请重试')
        setFlowStage('error')
        analytics.errorOccurred('results_loading_stuck', 'loading stage timeout')
      }
    }, 15000)

    return () => clearTimeout(stuckTimer)
  }, [flowStage, hasCompletedReplay, spriteReady.isReady, analytics])

  const handleRetry = useCallback(async () => {
    // If we appear to be offline, verify first so the user gets an accurate message.
    try {
      const { networkType } = await Taro.getNetworkType()
      setIsOffline(networkType === 'none')
    } catch {
      setIsOffline(false)
    }

    retryCountRef.current += 1
    flowInitiatedRef.current = false

    // Exponential backoff for network errors (max 4s) to avoid hammering
    // a struggling connection while still feeling responsive.
    if (isOffline) {
      const delayMs = Math.min(4000, 1000 * Math.pow(2, retryCountRef.current - 1))
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null
        void runResultFlow({ forceRefresh: true })
      }, delayMs)
      return
    }

    void runResultFlow({ forceRefresh: true })
  }, [runResultFlow, isOffline])

  // Clear any pending retry timer on unmount to avoid state updates after unmount.
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [])

  const handleRestart = useCallback(() => {
    runIdRef.current += 1
    flowInitiatedRef.current = false

    analytics.stepAbandoned('restart')
    clearAnonymousAssessmentStorage()
    clearSharePosterRef.current()
    Taro.reLaunch({
      url: `${MINI_PROGRAM_ROUTES.personalityTest}?mode=restart`,
    }).catch(() => {
      // If reLaunch fails, at least storage is already cleared.
      // User can manually navigate back.
      void Taro.showToast({ title: '请手动返回重新测试', icon: 'none', duration: 2000 })
    })
  }, [analytics, clearSharePosterRef])

  const handleSkipAnimation = useCallback(() => {
    runIdRef.current += 1
    setShowSkipAnimation(false)
    haptics('light')
    const cached = resultStateRef.current
    if (cached) {
      setResultState(cached)
      setFlowStage('result')
      setSlotDisplay(prev => ({ ...prev, progress: 100 }))
      setPhaseText('')
      setCompletionMode('replay')
      analytics.interaction('skip_animation', { primaryArchetype: displayArchetypeName })
    }
  }, [analytics, displayArchetypeName])

  const skipBridge = useCallback(() => {
    haptics('light')
    setFlowStage('result')
  }, [])

  return {
    flowStage,
    sessionSnapshot,
    resultState,
    resultStateRef,
    topMatches,
    isDecisive,
    displayArchetype,
    displayArchetypeName,
    slotPhase,
    revealPhase,
    reelIndex: slotDisplay.reelIndex,
    progress: slotDisplay.progress,
    phaseText,
    celebrationTier,
    isFetchingResult,
    isSlowNetwork,
    isOffline,
    errorMessage,
    showSkipAnimation,
    handleRetry,
    handleRestart,
    handleSkipAnimation,
    skipBridge,
  }
}

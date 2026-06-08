import { Canvas, Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { archetypeRegistry } from '@shared/personality/archetypeRegistry'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { getArchetypeSkills } from '@shared/personality/archetypeSkills'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { useAuth } from '../../../../hooks/useAuth'
import { useSpriteReadiness } from '../../../../hooks/useSpriteReadiness'
import { useOnboardingAnalytics } from '../../../../hooks/onboarding/useOnboardingAnalytics'
import { apiRequest, authenticateMiniProgramUserWithTest, getUserState, type ApiError } from '../../../../lib/api/api'
import {
  clearAnonymousAssessmentStorage,
  hasAnonymousAssessmentResult,
  isAnonymousAssessmentSessionCompleted,
  readAnonymousAssessmentSession,
  readAnonymousAssessmentAnswers,
  saveAnonymousAssessmentSession,
  type AnonymousAssessmentSessionSnapshot,
  type AnonymousAssessmentTopMatch,
} from '../../../../lib/auth/anonymousOnboarding'
import { seedMiniProgramAuthSession } from '../../../../lib/api/authSession'
import { getDegradationTier, type DegradationTier } from '../../../../lib/utils/frameBudget'
import { haptics } from '../../../../lib/utils/haptics'
import { getMascotDisplayName } from '../../../../lib/mascot/mascotDisplay'
import { logError, logInfo, logWarn } from '../../../../lib/utils/logger'
import { useMiniRevealMotion } from '../../../../hooks/useMiniRevealMotion'
import { useUnload } from '../../../../hooks/useUnload'
import { useDeviceTier } from '../../../../hooks/useDeviceTier'
import { preloadImagesWithDiagnostics } from '../../../../lib/utils/imagePreload'
import { MINI_PROGRAM_ROUTES } from '../../../../lib/onboarding/onboardingRoutes'
import { navigateToMiniProgramNextStep } from '../../../../lib/onboarding/onboardingNavigation'
import { TOAST_FATAL_MS } from '../../../../lib/utils/uiConstants'
import {
  getArchetypeVisual,
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
  getArchetypeSpritesheetLocalPath,
  ASSET_BASE_WEBP_LOCAL,
} from '../visuals'
import { getArchetypeCardVariants } from '../archetypeVariants'
import {
  generatePersonalitySharePoster,
  PERSONALITY_SHARE_POSTER_CANVAS_ID,
  type PersonalitySharePosterInput,
} from './sharePoster'
import {
  generatePersonalitySquarePoster,
  PERSONALITY_SQUARE_CANVAS_ID,
  type PersonalitySquarePosterInput,
} from '../../../../lib/utils/momentsPosterFactory'
import {
  ARCHETYPE_SEQUENCE,
  buildResolvedResultState,
  buildShareLine,
  buildShareTitle,
  getAnimationProfile,
  buildTypicalityLabel,
  getTraitEntries,
  getTopMatches,
  resolveResultErrorMessage,
  shouldNearMiss,
  waitFor,
  type AnimationProfile,
  type FlowStage,
  type ResolvedResultState,
  type RevealPhase,
  type SlotPhase,
} from './resultHelpers'
import LoadingStage from './LoadingStage'
import EmptyStage from './EmptyStage'
import ErrorStage from './ErrorStage'
import SlotStage from './SlotStage'
import RevealStage from './RevealStage'
import BridgeStage from './BridgeStage'
import FinalStage from './FinalStage'
import './index.scss'

interface XiaoyueAnalysisResult {
  headline: string
  analysis: string
  socialRole: string
  bestScene: string
  microAction: string
  shareLine: string
  stateLabel: string
  whyThisFits: string
  blendLine: string
  expressionTags: string[]
  shareVariants: {
    selfIntro: string
    friendCallout: string
    socialInvite: string
  }
  cached: boolean
}

export default function PersonalityTestResultsPage() {
  const { shouldReduceMotion } = useMiniRevealMotion()
  const auth = useAuth()
  const deviceTier = useDeviceTier()

  const personalityShareEnabled = auth.user?.features?.personalityShareEnabled ?? true
  const personalitySlotAnimationEnabled = auth.user?.features?.personalitySlotAnimationEnabled ?? true

  // Cleanup on page unload to prevent timer leaks and stale state updates
  useUnload(() => {
    timeoutHandlesRef.current.forEach((handle) => clearTimeout(handle))
    timeoutHandlesRef.current = []
    mountedRef.current = false
  })
  const initialSnapshot = useMemo(() => readAnonymousAssessmentSession(), [])
  const initialResolvedResult = useMemo(() => buildResolvedResultState(initialSnapshot), [initialSnapshot])
  const hasCompletedReplay = Boolean(initialSnapshot?.resultSequenceCompletedAt && initialResolvedResult)

  const [sessionSnapshot, setSessionSnapshot] = useState<AnonymousAssessmentSessionSnapshot | null>(initialSnapshot)
  const [resultState, setResultState] = useState<ResolvedResultState | null>(initialResolvedResult)
  const [flowStage, setFlowStage] = useState<FlowStage>(hasCompletedReplay ? 'result' : 'loading')
  const [slotPhase, setSlotPhase] = useState<SlotPhase>('anticipation')

  /** Accessibility: respect system reduced-motion preference. */
  const prefersReducedMotion = useMemo(() => {
    try {
      const info = Taro.getSystemInfoSync()
      return (info as any).reduceMotion === true
    } catch {
      return false
    }
  }, [])

  // Track spritesheet decode readiness before starting slot animation.
  // Falls back after 500ms so we never block indefinitely.
  const spriteReady = useSpriteReadiness(
    hasCompletedReplay ? '' : getArchetypeSpritesheetLocalPath(),
  )
  const [revealPhase, setRevealPhase] = useState<RevealPhase>('silhouette')
  const [slotDisplay, setSlotDisplay] = useState({
    reelIndex: 0,
    progress: hasCompletedReplay ? 100 : 0,
  })
  const { reelIndex, progress } = slotDisplay
  const [phaseText, setPhaseText] = useState(hasCompletedReplay ? '' : '准备揭晓...')
  const [isFetchingResult, setIsFetchingResult] = useState(false)
  const [isSlowNetwork, setIsSlowNetwork] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sharePosterPath, setSharePosterPath] = useState('')
  const [squarePosterPath, setSquarePosterPath] = useState('')
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false)
  const [posterError, setPosterError] = useState(false)
  const [generationPhase, setGenerationPhase] = useState('')
  const [completionMode, setCompletionMode] = useState<'replay' | 'animated' | null>(hasCompletedReplay ? 'replay' : null)
  const [cardNickname] = useState('')
  const [selectedVariantIndex] = useState(0)
  const [showSkipAnimation, setShowSkipAnimation] = useState(false)

  // Invalidate stale poster when user changes card personalization
  useEffect(() => {
    if (sharePosterPath) {
      setSharePosterPath('')
    }
    if (squarePosterPath) {
      setSquarePosterPath('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariantIndex, cardNickname])

  const mountedRef = useRef(false)
  const runIdRef = useRef(0)
  const resultStateRef = useRef<ResolvedResultState | null>(initialResolvedResult)
  const didTrackCompletionRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const timeoutHandlesRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const degradationTierRef = useRef<DegradationTier>('full')
  const isAnimatingRef = useRef(false)
  const analysisRequestedRef = useRef(false)
  const resultPreloadInitiatedRef = useRef(false)

  const profileRef = useRef<AnimationProfile>(getAnimationProfile())

  const analytics = useOnboardingAnalytics('personality-test-results', {
    enabled: !auth.isLoading,
    startMetadata: {
      hasSessionId: Boolean(initialSnapshot?.sessionId),
      hasStoredResult: Boolean(initialResolvedResult),
      hasCompletedReplay,
      isAuthenticated: auth.isAuthenticated,
    },
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      runIdRef.current += 1
      isAnimatingRef.current = false
      // Bulk-clear all pending timeouts
      timeoutHandlesRef.current.forEach((handle) => clearTimeout(handle))
      timeoutHandlesRef.current = []
      // Abort any in-flight fetch
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
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

  const fetchXiaoyueAnalysis = useCallback(async () => {
    const result = resultStateRef.current?.result ?? sessionSnapshot?.result
    if (!result?.primaryArchetype) return

    const traitScores = result.traitScores ?? {}
    const topMatches = resultStateRef.current?.topMatches ?? sessionSnapshot?.topArchetypes ?? []

    setIsLoadingAnalysis(true)
    try {
      const response = await apiRequest<XiaoyueAnalysisResult>({
        path: '/api/xiaoyue/analysis',
        method: 'POST',
        data: {
          archetype: result.primaryArchetype,
          secondaryArchetype: result.secondaryArchetype ?? null,
          topArchetypes: topMatches,
          traitScores: {
            affinity: traitScores.A ?? traitScores.affinity ?? 0.5,
            openness: traitScores.O ?? traitScores.openness ?? 0.5,
            conscientiousness: traitScores.C ?? traitScores.conscientiousness ?? 0.5,
            emotionalStability: traitScores.E ?? traitScores.emotionalStability ?? 0.5,
            extraversion: traitScores.X ?? traitScores.extraversion ?? 0.5,
            positivity: traitScores.P ?? traitScores.positivity ?? 0.5,
          },
          confidence: result.archetypeConfidence ?? 1,
        },
      })

      if (mountedRef.current) {
        setXiaoyueAnalysis(response)
        logInfo('[PersonalityResults] Xiaoyue analysis loaded', {
          headline: response.headline,
          cached: response.cached,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logWarn('[PersonalityResults] Xiaoyue analysis failed', { message })
      // Silently fail — UI gracefully falls back to static copy
    } finally {
      if (mountedRef.current) {
        setIsLoadingAnalysis(false)
      }
    }
  }, [sessionSnapshot])

  useEffect(() => {
    if (flowStage !== 'result') return
    if (analysisRequestedRef.current) return
    analysisRequestedRef.current = true

    // P0-3: 80ms render buffer (was 400ms). The test page fires a
    // fire-and-forget prefetch at completion so this call mostly
    // hits the server cache. 80ms is the minimum to let the result
    // page settle before the analysis fetch starts.
    const timer = setTimeout(() => {
      void fetchXiaoyueAnalysis()
    }, 80)
    return () => clearTimeout(timer)
  }, [flowStage, fetchXiaoyueAnalysis])

  useEffect(() => {
    resultStateRef.current = resultState
  }, [resultState])

  const topMatches = useMemo(() => {
    if (Array.isArray(resultState?.topMatches) && resultState.topMatches.length > 0) {
      return resultState.topMatches
    }
    return getTopMatches(sessionSnapshot?.result, sessionSnapshot?.topArchetypes)
  }, [resultState, sessionSnapshot])

  // Use resultStateRef as a synchronous fallback so the slot target and the
  // result page never diverge during the animation flow. React state updates
  // are batched; the ref is updated immediately in runResultFlow.
  const displayArchetype = resultState?.result.primaryArchetype
    ?? resultStateRef.current?.result.primaryArchetype
    ?? sessionSnapshot?.result?.primaryArchetype
    ?? topMatches[0]?.archetype
    ?? null

  const isDecisive = resultState?.result.isDecisive ?? sessionSnapshot?.result?.isDecisive
  const secondaryArchetypeId = resultState?.result.secondaryArchetype ?? sessionSnapshot?.result?.secondaryArchetype
  const secondaryDisplayName = secondaryArchetypeId
    ? (ARCHETYPE_BY_ID[secondaryArchetypeId]?.nameCn ?? '')
    : undefined

  const displayArchetypeName = displayArchetype
    ? archetypeRegistry[displayArchetype]?.name ?? displayArchetype
    : '神秘原型'
  const visual = useMemo(() => getArchetypeVisual(displayArchetype), [displayArchetype])
  const summary = useMemo(() => visual.summary, [visual.summary])
  const traitEntries = useMemo(() => getTraitEntries(resultState?.result ?? sessionSnapshot?.result), [resultState, sessionSnapshot])
  const skillSet = useMemo(() => (displayArchetype ? getArchetypeSkills(displayArchetype) : undefined), [displayArchetype])

  // Phase 2: card variants, energy, rank badges
  const variants = useMemo(() => (displayArchetype ? getArchetypeCardVariants(displayArchetype) : []), [displayArchetype])
  const energyLevel = useMemo(() => {
    if (!displayArchetype) return undefined
    return archetypeRegistry[displayArchetype]?.profile.energyLevel
  }, [displayArchetype])
  const archetypeRank = useMemo(() => {
    if (!displayArchetype) return undefined
    const names = Object.keys(archetypeRegistry)
    return names.indexOf(displayArchetype) + 1
  }, [displayArchetype])
  const serialNumber = useMemo(() => {
    const sessionId = sessionSnapshot?.sessionId ?? 'unknown'
    // Deterministic pseudo-serial from sessionId hash
    let hash = 0
    for (let i = 0; i < sessionId.length; i++) {
      hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0
    }
    const num = Math.abs(hash) % 90000 + 10000
    return `#${num}`
  }, [sessionSnapshot?.sessionId])

  const typicalityLabel = useMemo(
    () => buildTypicalityLabel(isDecisive, displayArchetypeName, visual.accentText),
    [isDecisive, displayArchetypeName, visual.accentText],
  )

  const secondaryVisual = useMemo(
    () => (secondaryArchetypeId ? getArchetypeVisual(secondaryArchetypeId) : undefined),
    [secondaryArchetypeId],
  )
  const shareLine = useMemo(
    () => buildShareLine(displayArchetypeName, visual.tagline || visual.description, summary),
    [displayArchetypeName, summary, visual.description, visual.tagline],
  )
  const shareTitle = useMemo(
    () => buildShareTitle(displayArchetypeName, visual.tagline || visual.description),
    [displayArchetypeName, visual.description, visual.tagline],
  )
  const displayAsset = useMemo(
    () =>
      // Primary: local bundled WebP — always available, immune to CDN
      // whitelist / network issues that plague getImageInfo in subpackages.
      (displayArchetype ? `${ASSET_BASE_WEBP_LOCAL}/archetype-${displayArchetype}.webp` : '') ||
      // Fallback: CDN WebP (for environments where local assets were stripped)
      visual.asset ||
      // Fallback 2: Xiaoyue mascot (never blank)
      getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.resultsCelebrate),
    [displayArchetype, visual.asset],
  )
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [xiaoyueAnalysis, setXiaoyueAnalysis] = useState<XiaoyueAnalysisResult | null>(null)
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false)
  const queryClient = useQueryClient()

  const continueButtonLabel = isLoggingIn
    ? '登录中…'
    : auth.isLoading
      ? '检查登录状态中…'
      : auth.isAuthenticated
        ? '开启匹配'
        : '微信登录，查看谁和你最搭'

  // WeChat share requires a network URL or temp file path. Local bundled
  // paths don't work for share preview images. Fall back to CDN URL.
  const shareImageUrl = sharePosterPath || visual.asset || displayAsset

  useShareAppMessage(() => ({
    title: shareTitle,
    path: MINI_PROGRAM_ROUTES.personalityTest,
    imageUrl: shareImageUrl,
  }))

  useShareTimeline(() => ({
    title: shareTitle,
    query: 'source=personality-result',
    imageUrl: shareImageUrl,
  }))

  useEffect(() => {
    if (flowStage !== 'result' || !completionMode || didTrackCompletionRef.current) {
      return
    }
    didTrackCompletionRef.current = true
    analytics.stepCompleted({
      completionMode,
      isAuthenticated: auth.isAuthenticated,
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
  }, [analytics, auth.isAuthenticated, completionMode, displayArchetypeName, flowStage, isDecisive])

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

    // Create new AbortController for this fetch
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    // 8s request-level timeout
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    timeoutHandlesRef.current.push(timeoutId)

    try {
      const response = await apiRequest<{
        sessionId: string
        completedAt?: string
        result: NonNullable<typeof latestSnapshot.result>
        topArchetypes?: AnonymousAssessmentTopMatch[]
      }>({
        path: `/api/assessment/v4/${encodeURIComponent(latestSnapshot.sessionId)}/result`,
        // @ts-expect-error - apiRequest may not expose signal yet; handled gracefully
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const timeoutIdx = timeoutHandlesRef.current.indexOf(timeoutId)
      if (timeoutIdx >= 0) timeoutHandlesRef.current.splice(timeoutIdx, 1)

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
      clearTimeout(timeoutId)
      const timeoutIdx = timeoutHandlesRef.current.indexOf(timeoutId)
      if (timeoutIdx >= 0) timeoutHandlesRef.current.splice(timeoutIdx, 1)

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
      clearTimeout(timeoutId)
      const timeoutIdx = timeoutHandlesRef.current.indexOf(timeoutId)
      if (timeoutIdx >= 0) timeoutHandlesRef.current.splice(timeoutIdx, 1)
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
      setSharePosterPath('')

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

      // Accessibility + Performance: skip slot animation for reduced-motion,
      // degradation-tier devices, or when the feature flag is off.
      // Includes shouldReduceMotion which covers low-benchmark devices
      // that Taro.getSystemInfoSync().reduceMotion doesn't catch.
      if (shouldReduceMotion || prefersReducedMotion || deviceTier.isDegradation || !personalitySlotAnimationEnabled) {
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
            isAuthenticated: auth.isAuthenticated,
            primaryArchetype: displayArchetypeName,
            degradationTier: deviceTier.isDegradation ? 'degradation' : 'reduced-motion',
          })
        } else if (mountedRef.current && nextRunId === runIdRef.current) {
          // Fetch failed — show error instead of stuck loading
          setFlowStage('error')
          setErrorMessage((prev) => prev || getErrorMessage('sync-failed'))
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

      // Show skip button for all users after 1.5s (accessibility + impatient users)
      const skipTimeout = setTimeout(() => {
        if (mountedRef.current) {
          setShowSkipAnimation(true)
        }
      }, 1500)
      timeoutHandlesRef.current.push(skipTimeout)

      await waitFor(profile.slotAnticipationMs)
      if (!mountedRef.current || nextRunId !== runIdRef.current) {
        return
      }

      setSlotPhase('spinning')
      setPhaseText('命运转动中...')

      // Measure frame budget during first half of spin for tiered degradation
      const frameBudgetPromise = getDegradationTier()

      const spinSteps = Math.max(1, Math.floor(profile.slotSpinMs / profile.slotSpinIntervalMs))
      const budgetCheckStep = Math.floor(spinSteps * 0.5)

      for (let step = 0; step < spinSteps; step += 1) {
        setSlotDisplay(prev => ({
          reelIndex: (prev.reelIndex + 1) % 12,
          progress: 10 + ((step + 1) / spinSteps) * 50,
        }))

        // Check frame budget mid-spin
        if (step === budgetCheckStep) {
          const tier = await frameBudgetPromise
          degradationTierRef.current = tier
          logInfo('[PersonalityResults] Degradation tier', { tier })
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
      // updates are batched). The ref was just synced at line 724-726.
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
        setSlotPhase('nearMiss')
        setPhaseText('等等...')
        setSlotDisplay({
          reelIndex: (safeTargetIndex + 1) % 12,
          progress: 92,
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
          isAuthenticated: auth.isAuthenticated,
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
  }, [analytics, auth.isAuthenticated, displayArchetypeName, fetchResult])

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
    setSharePosterPath('')
    Taro.reLaunch({ url: MINI_PROGRAM_ROUTES.personalityTest }).catch(() => {
      // If reLaunch fails, at least storage is already cleared.
      // User can manually navigate back.
      void Taro.showToast({ title: '请手动返回重新测试', icon: 'none', duration: 2000 })
    })
  }, [analytics])

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

  const handleContinue = useCallback(async () => {
    if (auth.isLoading || isLoggingIn) {
      return
    }

    logInfo('[PersonalityResults] Continue requested', {
      isAuthenticated: auth.isAuthenticated,
      nextStep: auth.nextStep,
    })

    if (auth.isAuthenticated) {
      await navigateToMiniProgramNextStep(auth.nextStep, { mode: 'root' })
      return
    }

    // Inline login: import anonymous answers + WeChat login, skip the auth-gate page.
    const answers = readAnonymousAssessmentAnswers()
    const sessionSnapshot = readAnonymousAssessmentSession()

    // Show explicit confirmation before silent WeChat login so users know auth is happening.
    const { confirm } = await Taro.showModal({
      title: '微信登录',
      content: '使用微信账号登录以保存你的氛围原型测试结果，并开启匹配。',
      confirmText: '确认登录',
      cancelText: '取消',
    })
    if (!confirm) {
      analytics.interaction('login_prompt_dismissed', { primaryArchetype: displayArchetypeName })
      return
    }

    setIsLoggingIn(true)
    try {
      logInfo('[PersonalityResults] Importing anonymous assessment before login', {
        answerCount: answers.length,
        hasSessionId: !!sessionSnapshot?.sessionId,
      })

      await authenticateMiniProgramUserWithTest({
        testAnswers: answers,
        anonymousSessionId: sessionSnapshot?.sessionId ?? null,
      })

      const userState = await getUserState()
      seedMiniProgramAuthSession(userState, queryClient)
      clearAnonymousAssessmentStorage()

      logInfo('[PersonalityResults] Login successful', { nextStep: userState.nextStep })
      analytics.stepCompleted({
        action: 'login-handoff-success',
        answerCount: answers.length,
        nextStep: userState.nextStep ?? 'essential-data',
      })
      void Taro.showToast({ title: '登录成功，正在为你准备匹配…', icon: 'success', duration: 2000 })
      await navigateToMiniProgramNextStep(userState.nextStep, { mode: 'root' })
    } catch (error) {
      const typedError = error as ApiError | undefined
      const message =
        typedError?.statusCode === 401
          ? '微信授权已失效，请重新尝试'
          : typedError?.statusCode === 500
            ? '服务器有点忙，稍后再试'
            : error instanceof Error && error.message
              ? error.message
              : '登录没成功，检查下网络再试试'
      analytics.errorOccurred('login_handoff_failed', message)
      logError('[PersonalityResults] Login failed', { message })
      Taro.showToast({ title: message, icon: 'none', duration: TOAST_FATAL_MS })
    } finally {
      setIsLoggingIn(false)
    }
  }, [auth.isAuthenticated, auth.isLoading, auth.nextStep, isLoggingIn, analytics, queryClient])

  /**
   * Present a frictionless action sheet for sharing the generated poster.
   * Options: save to album, share to friends, or preview.
   */
  const presentShareOptions = useCallback(async (posterPath: string, momentsPath?: string) => {
    const taroWithShareImageMenu = Taro as typeof Taro & {
      showShareImageMenu?: (options: { path: string }) => Promise<unknown>
    }
    const hasNativeShareMenu = typeof taroWithShareImageMenu.showShareImageMenu === 'function'
    const hasMoments = Boolean(momentsPath)

    const itemList = [
      '保存到相册',
      ...(hasNativeShareMenu ? ['分享给朋友'] : []),
      ...(hasMoments ? ['保存朋友圈卡片'] : []),
      '预览海报',
    ]

    let tapIndex: number
    try {
      const res = await Taro.showActionSheet({ itemList })
      tapIndex = res.tapIndex
    } catch {
      analytics.interaction('share_action_dismissed', { primaryArchetype: displayArchetypeName })
      return
    }

    // Map tapIndex back to action, accounting for dynamic itemList
    const saveIdx = 0
    const shareIdx = hasNativeShareMenu ? 1 : -1
    const momentsIdx = hasMoments ? (hasNativeShareMenu ? 2 : 1) : -1
    const previewIdx = itemList.length - 1

    const saveToAlbum = async (filePath: string, label: string) => {
      try {
        const settingRes = await Taro.getSetting()
        const authKey = 'scope.writePhotosAlbum' as const
        const hasAuth = settingRes.authSetting[authKey] as boolean | undefined

        if (hasAuth === false) {
          analytics.interaction('share_save_permission_denied', { primaryArchetype: displayArchetypeName })
          const { confirm } = await Taro.showModal({
            title: '需要相册权限',
            content: '保存卡片到相册需要您授权访问相册。',
            confirmText: '去设置',
            cancelText: '取消',
          })
          if (confirm) {
            await Taro.openSetting()
          }
          return
        }

        await Taro.saveImageToPhotosAlbum({ filePath })
        haptics('success')
        analytics.interaction('share_save_success', { option: label, primaryArchetype: displayArchetypeName })
        void Taro.showToast({ title: `${label}已保存`, icon: 'success', duration: 2000 })
      } catch (saveErr) {
        const error = String(saveErr)
        logError('[PersonalityResults] Save to album failed', { error, option: label, primaryArchetype: displayArchetypeName })
        analytics.interaction('share_save_failed', { error, option: label, primaryArchetype: displayArchetypeName })
        void Taro.showToast({
          title: `${getMascotDisplayName(auth.user)}没能把卡片存进相册，可能需要你授权一下~`,
          icon: 'none',
          duration: 2500,
        })
      }
    }

    if (tapIndex === saveIdx) {
      haptics('medium')
      await saveToAlbum(posterPath, '氛围卡')
    } else if (tapIndex === shareIdx) {
      haptics('light')
      analytics.interaction('share_action_selected', { option: 'share', primaryArchetype: displayArchetypeName })
      await taroWithShareImageMenu.showShareImageMenu!({ path: posterPath })
    } else if (tapIndex === momentsIdx) {
      haptics('medium')
      analytics.interaction('share_action_selected', { option: 'moments', primaryArchetype: displayArchetypeName })
      await saveToAlbum(momentsPath!, '朋友圈卡片')
    } else if (tapIndex === previewIdx) {
      haptics('light')
      analytics.interaction('share_action_selected', { option: 'preview', primaryArchetype: displayArchetypeName })
      const urls = momentsPath ? [posterPath, momentsPath] : [posterPath]
      await Taro.previewImage({ current: posterPath, urls })
    }
  }, [analytics, displayArchetypeName, auth.user])

  const handleGeneratePoster = useCallback(async () => {
    if (isGeneratingPoster || !displayArchetype) {
      return
    }

    // Offline pre-check — poster generation requires CDN images
    try {
      const { networkType } = await Taro.getNetworkType()
      if (networkType === 'none') {
        void Taro.showToast({ title: '网络好像断了，请检查连接后再试', icon: 'none', duration: 2500 })
        return
      }
    } catch {
      // getNetworkType may fail on some devices — proceed anyway
    }

    setIsGeneratingPoster(true)
    setPosterError(false)
    setGenerationPhase('准备素材中…')

    try {
      const selectedVariant = variants[selectedVariantIndex]
      const accentColor = selectedVariant?.accentColor ?? (visual.accent || '#8B5CF6')
      const accentSoft = selectedVariant?.accentSoft ?? visual.accentSoft

      // Canvas drawImage prefers a network URL or temp file path. Order
      // matters: prefer the bundled subpackage WebP (always on-device),
      // then the CDN WebP, then the CDN PNG. The subpackage path
      // (/pages/onboarding/assets/...) is bundled in dist and survives
      // dev environments where the CDN isn't configured; the canvas can
      // read it via getImageInfo on current WeChat base library versions.
      // `displayAsset` is the subpackage local WebP; `visual.asset` is
      // the CDN/main-package path.
      const posterInput: PersonalitySharePosterInput = {
        archetype: displayArchetypeName,
        nickname: cardNickname || visual.nickname || displayArchetypeName,
        tagline: visual.tagline || visual.description || summary,
        summary,
        shareLine,
        accentColor,
        accentSoft,
        archetypeAsset: displayAsset || visual.asset,
        archetypeAssetPng: visual.assetPng,
        confidenceLabel: typicalityLabel ? `${typicalityLabel.prefix}${typicalityLabel.name}` : undefined,
        rarityLabel:
          typeof visual.rarityPercentage === 'number'
            ? `稀有度 ${Math.round(visual.rarityPercentage)}%`
            : undefined,
        skillAttribute: skillSet?.attribute ?? '气场',
        activeSkillTitle: skillSet?.activeSkill.name ?? '瞬间点亮全场',
        activeSkillEffect: skillSet?.activeSkill.shortEffect ?? '把陌生局迅速带到更舒服的节奏。',
        passiveSkillTitle: skillSet?.passiveSkill.name ?? '气场持续发光',
        passiveSkillEffect: skillSet?.passiveSkill.shortEffect ?? '不用刻意用力，也会让人想靠近你。',
        topMatches: topMatches.map((match) => ({
          archetype: match.archetype,
          score: Number(match.score) || 0,
        })),
        traitEntries: traitEntries.map(({ label, value }) => ({ label, value })),
        subtitle: visual.nickname || displayArchetypeName,
        energyLevel,
        archetypeRank,
        serialNumber,
      }

      setGenerationPhase('正在渲染全息卡面…')
      const nextPosterPath = await generatePersonalitySharePoster(posterInput)
      setSharePosterPath(nextPosterPath)

      // Generate square Moments poster (best-effort; degrades on low-end devices)
      let nextSquarePath: string | undefined
      if (!deviceTier.isDegradation) {
        try {
        const squareInput: PersonalitySquarePosterInput = {
          archetype: displayArchetypeName,
          subtitle: visual.nickname || displayArchetypeName,
          tagline: visual.tagline || visual.description || summary,
          shareLine,
          rarityPercentage: typeof visual.rarityPercentage === 'number' ? visual.rarityPercentage : 0,
          archetypeAsset: displayAsset || visual.asset,
          archetypeAssetPng: visual.assetPng,
          traitEntries: traitEntries.slice(0, 3).map(({ label, value }) => ({ label, value })),
          energyLevel,
          skillSet: skillSet
            ? { activeSkill: { name: skillSet.activeSkill.name }, passiveSkill: { name: skillSet.passiveSkill.name } }
            : undefined,
          archetypeRank,
          serialNumber,
        }
        setGenerationPhase('正在生成朋友圈卡片…')
        nextSquarePath = await generatePersonalitySquarePoster(squareInput)
        setSquarePosterPath(nextSquarePath)
      } catch (squareErr) {
        logWarn('[PersonalityResults] Square poster generation failed, degrading to portrait-only', {
          error: squareErr instanceof Error ? squareErr.message : String(squareErr),
        })
      }
      }

      haptics('success')
      logInfo('[PersonalityResults] Poster generated', {
        primaryArchetype: displayArchetypeName,
        variant: selectedVariant?.name,
        hasMoments: Boolean(nextSquarePath),
      })
      void Taro.showToast({ title: '氛围卡已生成', icon: 'success', duration: 1500 })

      // Present frictionless sharing options
      await presentShareOptions(nextPosterPath, nextSquarePath)
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '海报没生成成功，稍后再试'
      haptics('warning')
      analytics.errorOccurred('poster_generation_failed', message)
      logError('[PersonalityResults] Failed to generate poster', {
        message,
        primaryArchetype: displayArchetypeName,
      })
      void Taro.showToast({ title: '卡片生成遇到小状况，再试试~', icon: 'none', duration: 2500 })
      setPosterError(true)
    } finally {
      setIsGeneratingPoster(false)
      setGenerationPhase('')
    }
  }, [
    analytics,
    archetypeRank,
    cardNickname,
    displayArchetype,
    displayArchetypeName,
    displayAsset,
    energyLevel,
    isGeneratingPoster,
    presentShareOptions,
    selectedVariantIndex,
    serialNumber,
    shareLine,
    skillSet,
    summary,
    topMatches,
    variants,
    visual,
  ])

  const content = useMemo(() => {
    switch (flowStage) {
      case 'empty':
        return <EmptyStage onRestart={handleRestart} />
      case 'error':
        return (
          <ErrorStage
            errorMessage={errorMessage}
            isFetchingResult={isFetchingResult}
            isOffline={isOffline}
            onRetry={handleRetry}
            onRestart={handleRestart}
          />
        )
      case 'slot':
        return (
          <SlotStage
            reelIndex={reelIndex}
            slotPhase={slotPhase}
            isSlowNetwork={isSlowNetwork}
            progress={progress}
            phaseText={phaseText}
            shouldReduceMotion={shouldReduceMotion}
          />
        )
      case 'reveal':
        return (
          <RevealStage
            displayArchetypeName={displayArchetypeName}
            displayAsset={displayAsset}
            visual={visual}
            revealPhase={revealPhase}
            phaseText={phaseText}
          />
        )
      case 'bridge':
        return (
          <BridgeStage
            displayArchetypeName={displayArchetypeName}
            accentText={visual.accentText}
            typicalityText={typicalityLabel ? `${typicalityLabel.prefix}${typicalityLabel.name}` : undefined}
            phaseText={phaseText}
            onSkip={() => {
              haptics('light')
              setFlowStage('result')
            }}
          />
        )
      case 'result':
        return (
          <FinalStage
            displayArchetypeName={displayArchetypeName}
            displayArchetypeId={displayArchetype ?? ''}
            displayAsset={displayAsset}
            visual={visual}
            summary={summary}
            shareLine={shareLine}
            traitEntries={traitEntries}
            topMatches={topMatches}
            skillSet={skillSet}
            typicalityLabel={typicalityLabel}
            secondaryAccent={secondaryVisual?.accentText}
            isGeneratingPoster={isGeneratingPoster}
            sharePosterPath={sharePosterPath}
            generationPhase={generationPhase}
            energyLevel={energyLevel}
            archetypeRank={archetypeRank}
            serialNumber={serialNumber}
            variants={variants}
            selectedVariantIndex={selectedVariantIndex}
            onGeneratePoster={handleGeneratePoster}
            continueButtonLabel={continueButtonLabel}
            onContinue={handleContinue}
            onRestart={handleRestart}
            authIsLoading={auth.isLoading}
            isLoggingIn={isLoggingIn}
            isDecisive={isDecisive}
            secondaryDisplayName={secondaryDisplayName}
            xiaoyueAnalysis={xiaoyueAnalysis}
            isLoadingAnalysis={isLoadingAnalysis}
            personalityShareEnabled={personalityShareEnabled}
            posterError={posterError}
          />
        )
      case 'loading':
      default:
        return <LoadingStage phaseText={phaseText} />
    }
  }, [
    flowStage,
    phaseText,
    errorMessage,
    isFetchingResult,
    handleRetry,
    handleRestart,
    reelIndex,
    slotPhase,
    isSlowNetwork,
    progress,
    displayArchetypeName,
    displayAsset,
    visual,
    revealPhase,
    typicalityLabel,
    secondaryVisual,
    summary,
    shareLine,
    traitEntries,
    topMatches,
    skillSet,
    isGeneratingPoster,
    sharePosterPath,
    generationPhase,
    energyLevel,
    archetypeRank,
    serialNumber,
    variants,
    selectedVariantIndex,
    cardNickname,
    handleGeneratePoster,
    continueButtonLabel,
    handleContinue,
    auth.isLoading,
    xiaoyueAnalysis,
    isLoadingAnalysis,
  ])

  return (
    <View className={`personality-results personality-results--${flowStage}${prefersReducedMotion ? ' personality-results--reduce-motion' : ''}`}>
      {content}
      {showSkipAnimation && (
        <View
          className='personality-results__skip-button'
          onClick={handleSkipAnimation}
          hoverClass='personality-results__skip-button--pressed'
          role='button'
          aria-label='跳过动画'
        >
          <Text className='personality-results__skip-text'>跳过动画</Text>
        </View>
      )}
      <Canvas canvasId={PERSONALITY_SHARE_POSTER_CANVAS_ID} className='personality-results__poster-canvas' aria-hidden='true' />
      {!deviceTier.isDegradation && (
        <Canvas
          canvasId={PERSONALITY_SQUARE_CANVAS_ID}
          className='personality-results__poster-canvas personality-results__poster-canvas--square'
          aria-hidden='true'
        />
      )}

      {/* ── Hidden image preload layer ──
           Redundant cache priming: getImageInfo primes the native image cache;
           these <Image> nodes prime the webview's HTTP cache. Both together
           ensure the spritesheet and result image are decoded before display. */}
      <View style={{ position: 'absolute', left: '-9999rpx', top: '-9999rpx', width: '2rpx', height: '2rpx' }} aria-hidden='true'>
        <Image
          src='/pages/onboarding/assets/archetypes/archetype-spritesheet.webp'
          mode='aspectFit'
          lazyLoad={false}
          style={{ width: '2rpx', height: '2rpx' }}
          aria-hidden='true'
        />
        {displayAsset && (
          <Image
            src={displayAsset}
            mode='aspectFit'
            lazyLoad={false}
            style={{ width: '2rpx', height: '2rpx' }}
            aria-hidden='true'
          />
        )}
      </View>
    </View>
  )
}

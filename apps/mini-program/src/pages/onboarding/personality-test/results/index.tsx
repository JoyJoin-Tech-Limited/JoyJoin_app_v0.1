import { Canvas, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { archetypeRegistry } from '@shared/personality/archetypeRegistry'
import { getArchetypeSkills } from '@shared/personality/archetypeSkills'
import { useAuth } from '../../../../hooks/useAuth'
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
import { MINI_PROGRAM_ROUTES } from '../../../../lib/onboarding/onboardingRoutes'
import { navigateToMiniProgramNextStep } from '../../../../lib/onboarding/onboardingNavigation'
import { TOAST_FATAL_MS } from '../../../../lib/utils/uiConstants'
import {
  getArchetypeVisual,
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
} from '../visuals'
import { getArchetypeCardVariants } from '../archetypeVariants'
import {
  ARCHETYPE_ENGLISH_NAMES,
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
  getConfidenceLabel,
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
  const auth = useAuth()
  const initialSnapshot = useMemo(() => readAnonymousAssessmentSession(), [])
  const initialResolvedResult = useMemo(() => buildResolvedResultState(initialSnapshot), [initialSnapshot])
  const hasCompletedReplay = Boolean(initialSnapshot?.resultSequenceCompletedAt && initialResolvedResult)

  const [sessionSnapshot, setSessionSnapshot] = useState<AnonymousAssessmentSessionSnapshot | null>(initialSnapshot)
  const [resultState, setResultState] = useState<ResolvedResultState | null>(initialResolvedResult)
  const [flowStage, setFlowStage] = useState<FlowStage>(hasCompletedReplay ? 'result' : 'loading')
  const [slotPhase, setSlotPhase] = useState<SlotPhase>('anticipation')
  const [revealPhase, setRevealPhase] = useState<RevealPhase>('silhouette')
  const [slotDisplay, setSlotDisplay] = useState({
    reelIndex: 0,
    progress: hasCompletedReplay ? 100 : 0,
  })
  const { reelIndex, progress } = slotDisplay
  const [phaseText, setPhaseText] = useState(hasCompletedReplay ? '' : '准备揭晓...')
  const [isFetchingResult, setIsFetchingResult] = useState(false)
  const [isSlowNetwork, setIsSlowNetwork] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [sharePosterPath, setSharePosterPath] = useState('')
  const [squarePosterPath, setSquarePosterPath] = useState('')
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false)
  const [isGeneratingSquarePoster, setIsGeneratingSquarePoster] = useState(false)
  const [generationPhase, setGenerationPhase] = useState('')
  const [completionMode, setCompletionMode] = useState<'replay' | 'animated' | null>(hasCompletedReplay ? 'replay' : null)
  const [cardNickname, setCardNickname] = useState('')
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0)
  const [showSkipAnimation, setShowSkipAnimation] = useState(false)

  // Invalidate stale poster when user changes card personalization
  useEffect(() => {
    if (sharePosterPath) {
      setSharePosterPath('')
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

    // Small delay so the result page is fully rendered before the API call starts
    const timer = setTimeout(() => {
      void fetchXiaoyueAnalysis()
    }, 400)
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

  const displayArchetype = resultState?.result.primaryArchetype
    ?? sessionSnapshot?.result?.primaryArchetype
    ?? topMatches[0]?.archetype
    ?? null
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

  const confidenceLabel = useMemo(
    () => getConfidenceLabel(resultState?.result ?? sessionSnapshot?.result, topMatches),
    [resultState, sessionSnapshot, topMatches],
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
    () => visual.asset || getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.resultsCelebrate),
    [visual.asset],
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

  useShareAppMessage(() => ({
    title: shareTitle,
    path: MINI_PROGRAM_ROUTES.personalityTest,
    imageUrl: sharePosterPath || displayAsset,
  }))

  useShareTimeline(() => ({
    title: shareTitle,
    query: 'source=personality-result',
    imageUrl: sharePosterPath || displayAsset,
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
  }, [analytics, auth.isAuthenticated, completionMode, displayArchetypeName, flowStage])

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
      const message = resolveResultErrorMessage(error)
      if (mountedRef.current && runId === runIdRef.current) {
        setErrorMessage(message)
        analytics.errorOccurred('result_fetch_failed', message)
      }
      logError('[PersonalityResults] Failed to fetch result', { message })
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
    if (isAnimatingRef.current) return
    isAnimatingRef.current = true

    try {
      const nextRunId = runIdRef.current + 1
      runIdRef.current = nextRunId
      didTrackCompletionRef.current = false
      setCompletionMode(null)

      const flowStartedAt = Date.now()
      const latestSnapshot = readAnonymousAssessmentSession()

      setSessionSnapshot(latestSnapshot)
      setIsSlowNetwork(false)
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
      setPhaseText('即将揭晓...')

      // Show skip button for returning users after 1s
      const skipTimeout = setTimeout(() => {
        if (hasCompletedReplay && mountedRef.current) {
          setShowSkipAnimation(true)
        }
      }, 1000)
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
          setErrorMessage('网络有点慢，结果还没完全同步，请重试一次。')
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
        setErrorMessage((previousMessage) => previousMessage || '结果同步失败，请重试一次。')
        return
      }

      const targetName = resolvedResult.result.primaryArchetype ?? 'corgi'
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
    } finally {
      isAnimatingRef.current = false
    }
  }, [analytics, auth.isAuthenticated, displayArchetypeName, fetchResult])

  useEffect(() => {
    void runResultFlow()
  }, [runResultFlow])

  const handleRetry = useCallback(() => {
    void runResultFlow({ forceRefresh: true })
  }, [runResultFlow])

  const handleRestart = useCallback(() => {
    runIdRef.current += 1
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
      await navigateToMiniProgramNextStep(userState.nextStep, { mode: 'root' })
    } catch (error) {
      const typedError = error as ApiError | undefined
      const message =
        typedError?.statusCode === 401
          ? '微信授权已失效，请重新尝试'
          : typedError?.statusCode === 500
            ? '服务器暂时忙，请稍后再试'
            : error instanceof Error && error.message
              ? error.message
              : '登录失败，请检查网络连接后重试'
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
  const presentShareOptions = useCallback(async (posterPath: string) => {
    const taroWithShareImageMenu = Taro as typeof Taro & {
      showShareImageMenu?: (options: { path: string }) => Promise<unknown>
    }
    const hasNativeShareMenu = typeof taroWithShareImageMenu.showShareImageMenu === 'function'

    let tapIndex: number
    try {
      const res = await Taro.showActionSheet({
        itemList: hasNativeShareMenu
          ? ['保存到相册', '分享给朋友', '预览海报']
          : ['保存到相册', '预览海报'],
      })
      tapIndex = res.tapIndex
    } catch {
      // User cancelled or action sheet failed
      analytics.interaction('share_action_dismissed', { primaryArchetype: displayArchetypeName })
      return
    }

    if (tapIndex === 0) {
      // Save to album
      haptics('medium')
      analytics.interaction('share_action_selected', { option: 'save', primaryArchetype: displayArchetypeName })
      try {
        const settingRes = await Taro.getSetting()
        const authKey = 'scope.writePhotosAlbum' as const
        const hasAuth = settingRes.authSetting[authKey] as boolean | undefined

        if (hasAuth === false) {
          // Previously denied — guide user to settings
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

        await Taro.saveImageToPhotosAlbum({ filePath: posterPath })
        haptics('success')
        analytics.interaction('share_save_success', { primaryArchetype: displayArchetypeName })
        void Taro.showToast({ title: '已保存到相册', icon: 'success', duration: 2000 })
      } catch (saveErr) {
        const error = String(saveErr)
        logError('[PersonalityResults] Save to album failed', {
          error,
          primaryArchetype: displayArchetypeName,
        })
        analytics.interaction('share_save_failed', { error, primaryArchetype: displayArchetypeName })
        void Taro.showToast({
          title: `${getMascotDisplayName(auth.user)}没能把卡片存进相册，可能需要你授权一下~`,
          icon: 'none',
          duration: 2500,
        })
      }
    } else if (hasNativeShareMenu && tapIndex === 1) {
      // Share to friends
      haptics('light')
      analytics.interaction('share_action_selected', { option: 'share', primaryArchetype: displayArchetypeName })
      await taroWithShareImageMenu.showShareImageMenu!({ path: posterPath })
    } else {
      // Preview
      haptics('light')
      analytics.interaction('share_action_selected', { option: 'preview', primaryArchetype: displayArchetypeName })
      await Taro.previewImage({
        current: posterPath,
        urls: [posterPath],
      })
    }
  }, [analytics, displayArchetypeName])

  const handleInviteFriend = useCallback(async () => {
    if (sharePosterPath) {
      // Poster exists — share it directly via native image menu
      haptics('light')
      const taroWithShareImageMenu = Taro as typeof Taro & {
        showShareImageMenu?: (options: { path: string }) => Promise<unknown>
      }
      if (typeof taroWithShareImageMenu.showShareImageMenu === 'function') {
        await taroWithShareImageMenu.showShareImageMenu({ path: sharePosterPath })
        analytics.interaction('share_invite_with_poster', { primaryArchetype: displayArchetypeName })
      } else {
        await Taro.previewImage({ current: sharePosterPath, urls: [sharePosterPath] })
      }
      return
    }

    // No poster yet — trigger native page share (uses useShareAppMessage)
    // WeChat requires openType='share' to trigger this programmatically,
    // so we guide the user to use the top-right menu instead.
    void Taro.showToast({
      title: '先点「生成并分享卡片」生成海报，再分享给朋友~',
      icon: 'none',
      duration: 2500,
    })
  }, [analytics, displayArchetypeName, sharePosterPath])

  const handleGeneratePoster = useCallback(async () => {
    if (isGeneratingPoster || !displayArchetype) {
      return
    }

    setIsGeneratingPoster(true)
    setGenerationPhase('准备素材中…')

    try {
      const selectedVariant = variants[selectedVariantIndex]
      const accentColor = selectedVariant?.accentColor ?? (visual.accent || '#8B5CF6')
      const accentSoft = selectedVariant?.accentSoft ?? visual.accentSoft

      const posterInput: PersonalitySharePosterInput = {
        archetype: displayArchetypeName,
        nickname: cardNickname || visual.nickname || displayArchetypeName,
        tagline: visual.tagline || visual.description || summary,
        summary,
        shareLine,
        accentColor,
        accentSoft,
        archetypeAsset: displayAsset,
        archetypeAssetPng: visual.assetPng,
        confidenceLabel,
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
        englishName: ARCHETYPE_ENGLISH_NAMES[displayArchetype ?? ''] ?? displayArchetypeName,
        energyLevel,
        archetypeRank,
        serialNumber,
      }

      setGenerationPhase('正在渲染全息卡面…')
      const nextPosterPath = await generatePersonalitySharePoster(posterInput)
      setGenerationPhase('正在导出高清图片…')
      setSharePosterPath(nextPosterPath)

      haptics('success')
      logInfo('[PersonalityResults] Poster generated', {
        primaryArchetype: displayArchetypeName,
        variant: selectedVariant?.name,
      })

      // Present frictionless sharing options
      await presentShareOptions(nextPosterPath)
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '海报生成失败，请稍后重试。'
      haptics('warning')
      analytics.errorOccurred('poster_generation_failed', message)
      logError('[PersonalityResults] Failed to generate poster', {
        message,
        primaryArchetype: displayArchetypeName,
      })
      void Taro.showToast({ title: '卡片生成遇到小状况，请重试一下~', icon: 'none', duration: 2500 })
    } finally {
      setIsGeneratingPoster(false)
      setGenerationPhase('')
    }
  }, [
    analytics,
    archetypeRank,
    cardNickname,
    confidenceLabel,
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

  const handleGenerateSquarePoster = useCallback(async () => {
    if (isGeneratingSquarePoster || !displayArchetype) return
    setIsGeneratingSquarePoster(true)
    try {
      const input: PersonalitySquarePosterInput = {
        archetype: displayArchetypeName,
        englishName: ARCHETYPE_ENGLISH_NAMES[displayArchetype ?? ''] ?? displayArchetypeName,
        tagline: visual.tagline || visual.description || summary,
        shareLine,
        rarityPercentage: typeof visual.rarityPercentage === 'number' ? visual.rarityPercentage : 50,
        archetypeAsset: displayAsset,
        archetypeAssetPng: visual.assetPng,
        traitEntries: traitEntries
          .slice()
          .sort((a, b) => b.value - a.value)
          .slice(0, 3)
          .map(({ label, value }) => ({ label, value })),
        energyLevel,
        skillSet: skillSet
          ? {
              activeSkill: { name: skillSet.activeSkill.name },
              passiveSkill: { name: skillSet.passiveSkill.name },
            }
          : undefined,
        archetypeRank,
        serialNumber,
      }
      const path = await generatePersonalitySquarePoster(input)
      setSquarePosterPath(path)
      const taroWithShareImageMenu = Taro as typeof Taro & {
        showShareImageMenu?: (options: { path: string }) => Promise<unknown>
      }
      if (typeof taroWithShareImageMenu.showShareImageMenu === 'function') {
        await taroWithShareImageMenu.showShareImageMenu({ path })
      } else {
        await Taro.previewImage({ current: path, urls: [path] })
      }
      analytics.interaction('share_square_poster', { primaryArchetype: displayArchetypeName })
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'square poster generation failed'
      logError('[PersonalityResults] square poster generation failed', { message, primaryArchetype: displayArchetypeName })
      void Taro.showToast({ title: '海报生成失败，请重试', icon: 'none', duration: 2500 })
    } finally {
      setIsGeneratingSquarePoster(false)
    }
  }, [analytics, archetypeRank, displayArchetype, displayArchetypeName, displayAsset, energyLevel, isGeneratingSquarePoster, serialNumber, shareLine, skillSet, summary, traitEntries, visual])

  const content = useMemo(() => {
    switch (flowStage) {
      case 'empty':
        return <EmptyStage onRestart={handleRestart} />
      case 'error':
        return (
          <ErrorStage
            errorMessage={errorMessage}
            isFetchingResult={isFetchingResult}
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
            confidenceLabel={confidenceLabel}
            phaseText={phaseText}
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
            confidenceLabel={confidenceLabel}
            isGeneratingPoster={isGeneratingPoster}
            sharePosterPath={sharePosterPath}
            generationPhase={generationPhase}
            energyLevel={energyLevel}
            archetypeRank={archetypeRank}
            serialNumber={serialNumber}
            variants={variants}
            selectedVariantIndex={selectedVariantIndex}
            nickname={cardNickname}
            onGeneratePoster={handleGeneratePoster}
            onGenerateSquarePoster={handleGenerateSquarePoster}
            onInviteFriend={handleInviteFriend}
            onNicknameChange={setCardNickname}
            onVariantSelect={setSelectedVariantIndex}
            continueButtonLabel={continueButtonLabel}
            onContinue={handleContinue}
            onRestart={handleRestart}
            authIsLoading={auth.isLoading}
            isLoggingIn={isLoggingIn}
            xiaoyueAnalysis={xiaoyueAnalysis}
            isLoadingAnalysis={isLoadingAnalysis}
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
    confidenceLabel,
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
    handleGenerateSquarePoster,
    handleInviteFriend,
    continueButtonLabel,
    handleContinue,
    auth.isLoading,
    xiaoyueAnalysis,
    isLoadingAnalysis,
  ])

  return (
    <View className={`personality-results personality-results--${flowStage}`}>
      {content}
      {showSkipAnimation && (
        <View className='personality-results__skip-button' onClick={handleSkipAnimation}>
          <Text className='personality-results__skip-text'>跳过动画</Text>
        </View>
      )}
      <Canvas canvasId={PERSONALITY_SHARE_POSTER_CANVAS_ID} className='personality-results__poster-canvas' />
      <Canvas
        canvasId={PERSONALITY_SQUARE_CANVAS_ID}
        className='personality-results__poster-canvas'
        style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '750px', height: '750px' }}
      />
    </View>
  )
}

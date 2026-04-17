import { Canvas, Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getArchetypeSkills } from '@shared/personality/archetypeSkills'
import Button from '../../../../components/Button'
import Card from '../../../../components/Card'
import { useAuth } from '../../../../hooks/useAuth'
import { useOnboardingAnalytics } from '../../../../hooks/useOnboardingAnalytics'
import { apiRequest } from '../../../../lib/api'
import {
  clearAnonymousAssessmentStorage,
  hasAnonymousAssessmentResult,
  isAnonymousAssessmentSessionCompleted,
  readAnonymousAssessmentSession,
  saveAnonymousAssessmentSession,
  type AnonymousAssessmentResult,
  type AnonymousAssessmentSessionSnapshot,
  type AnonymousAssessmentTopMatch,
} from '../../../../lib/anonymousOnboarding'
import { logError, logInfo, logWarn } from '../../../../lib/logger'
import { MINI_PROGRAM_ROUTES } from '../../../../lib/onboardingRoutes'
import { navigateToMiniProgramNextStep } from '../../../../lib/onboardingNavigation'
import {
  getArchetypeVisual,
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
} from '../visuals'
import {
  generatePersonalitySharePoster,
  PERSONALITY_SHARE_POSTER_CANVAS_ID,
  type PersonalitySharePosterInput,
} from './sharePoster'
import './index.scss'

type FlowStage = 'loading' | 'slot' | 'reveal' | 'bridge' | 'result' | 'error' | 'empty'
type SlotPhase = 'anticipation' | 'spinning' | 'holding' | 'slowing' | 'nearMiss' | 'landed'
type RevealPhase = 'silhouette' | 'fill' | 'sparkle'
type CompletionMode = 'replay' | 'animated'

interface AssessmentResultEnvelope {
  sessionId: string
  completedAt?: string
  result: AnonymousAssessmentResult
  topArchetypes?: AnonymousAssessmentTopMatch[]
}

interface ResolvedResultState {
  sessionId: string
  completedAt?: string
  result: AnonymousAssessmentResult
  topMatches: AnonymousAssessmentTopMatch[]
}

const ARCHETYPE_SEQUENCE = [
  '开心柯基',
  '太阳鸡',
  '夸夸豚',
  '机智狐',
  '淡定海豚',
  '织网蛛',
  '暖心熊',
  '灵感章鱼',
  '沉思猫头鹰',
  '定心大象',
  '稳如龟',
  '隐身猫',
]

const TRAIT_LABELS: Array<{ key: string; label: string }> = [
  { key: 'A', label: '亲和力' },
  { key: 'O', label: '开放性' },
  { key: 'C', label: '责任心' },
  { key: 'E', label: '稳定感' },
  { key: 'X', label: '外向度' },
  { key: 'P', label: '快乐值' },
]

const SLOT_ANTICIPATION_MS = 900
const SLOT_SPIN_MS = 2800
const SLOT_NEAR_MISS_MS = 360
const SLOT_REVEAL_PAUSE_MS = 280
const SLOT_SPIN_INTERVAL_MS = 120
const SLOT_HOLD_INTERVAL_MS = 180
const SLOT_SLOW_STEP_DELAYS = [80, 130, 180, 230, 280, 330, 380, 430, 480, 530]
const RESULT_SLOW_NETWORK_MS = 3200
const FLOW_SAFETY_TIMEOUT_MS = 16000
const REVEAL_SILHOUETTE_MS = 520
const REVEAL_FILL_MS = 760
const REVEAL_SPARKLE_MS = 820
const RESULT_BRIDGE_MS = 1100
const DEFAULT_ACCENT = '#8B5CF6'
const GENERIC_API_ERROR_PREFIX = 'Request failed with status'

function getInitialIndex(seed: string | undefined): number {
  if (!seed) {
    return 0
  }

  return Array.from(seed).reduce((accumulator, char) => accumulator + char.charCodeAt(0), 0) % ARCHETYPE_SEQUENCE.length
}

function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function trimSentence(text: string | undefined): string {
  return (text ?? '').replace(/[。！!？?]+$/g, '').trim()
}

function buildShareLine(archetype: string, tagline: string, summary: string): string {
  const detail = trimSentence(tagline) || trimSentence(summary)
  if (!detail) {
    return `我是${archetype}型，来 JoyJoin 看看我会点亮哪张卡。`
  }

  return `我是${archetype}型，${detail}。`
}

function buildShareTitle(archetype: string, tagline: string): string {
  const detail = trimSentence(tagline)
  if (!detail) {
    return `我在 JoyJoin 解锁了 ${archetype}`
  }

  return `${archetype}已解锁：${detail}`
}

function resolveResultErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message && !error.message.startsWith(GENERIC_API_ERROR_PREFIX)) {
    return error.message
  }

  return '结果同步失败，请稍后重试。'
}

function getTraitEntries(
  result: AnonymousAssessmentResult | null | undefined,
): Array<{ key: string; label: string; value: number }> {
  const traitScores = result?.traitScores ?? {}

  return TRAIT_LABELS.map(({ key, label }) => {
    const rawValue = Number(traitScores[key] ?? 50)
    return {
      key,
      label,
      value: Math.max(0, Math.min(Math.round(rawValue), 100)),
    }
  })
}

function getTopMatches(
  result: AnonymousAssessmentResult | null | undefined,
  storedMatches: AnonymousAssessmentTopMatch[] | null | undefined,
): AnonymousAssessmentTopMatch[] {
  if (Array.isArray(storedMatches) && storedMatches.length > 0) {
    return storedMatches
  }

  return Array.isArray(result?.topMatches) ? result.topMatches : []
}

function getVisibleReelItems(currentIndex: number): string[] {
  const length = ARCHETYPE_SEQUENCE.length
  const previousIndex = (currentIndex - 1 + length) % length
  const nextIndex = (currentIndex + 1) % length
  return [
    ARCHETYPE_SEQUENCE[previousIndex] ?? ARCHETYPE_SEQUENCE[0],
    ARCHETYPE_SEQUENCE[currentIndex] ?? ARCHETYPE_SEQUENCE[0],
    ARCHETYPE_SEQUENCE[nextIndex] ?? ARCHETYPE_SEQUENCE[0],
  ]
}

function getConfidenceLabel(
  result: AnonymousAssessmentResult | null | undefined,
  topMatches: AnonymousAssessmentTopMatch[],
): string | undefined {
  const topScore = Number(topMatches[0]?.score)
  if (Number.isFinite(topScore) && topScore > 0) {
    return `匹配 ${Math.round(topScore)}%`
  }

  const rawConfidence = Number(result?.archetypeConfidence)
  if (!Number.isFinite(rawConfidence) || rawConfidence <= 0) {
    return undefined
  }

  const normalized = rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence
  return `匹配 ${Math.round(normalized)}%`
}

function buildResolvedResultState(snapshot: AnonymousAssessmentSessionSnapshot | null): ResolvedResultState | null {
  if (!snapshot?.sessionId || !hasAnonymousAssessmentResult(snapshot) || !snapshot.result) {
    return null
  }

  return {
    sessionId: snapshot.sessionId,
    completedAt: snapshot.completedAt,
    result: snapshot.result,
    topMatches: getTopMatches(snapshot.result, snapshot.topArchetypes),
  }
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
  const [progress, setProgress] = useState(hasCompletedReplay ? 100 : 0)
  const [phaseText, setPhaseText] = useState(hasCompletedReplay ? '' : '准备揭晓...')
  const [isFetchingResult, setIsFetchingResult] = useState(false)
  const [isSlowNetwork, setIsSlowNetwork] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [reelIndex, setReelIndex] = useState(() => getInitialIndex(initialSnapshot?.result?.primaryArchetype ?? initialSnapshot?.sessionId))
  const [sharePosterPath, setSharePosterPath] = useState('')
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false)
  const [completionMode, setCompletionMode] = useState<CompletionMode | null>(hasCompletedReplay ? 'replay' : null)

  const mountedRef = useRef(false)
  const runIdRef = useRef(0)
  const resultStateRef = useRef<ResolvedResultState | null>(initialResolvedResult)
  const didTrackCompletionRef = useRef(false)

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
    }
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

  const displayArchetype = resultState?.result.primaryArchetype
    ?? sessionSnapshot?.result?.primaryArchetype
    ?? topMatches[0]?.archetype
    ?? null
  const displayArchetypeName = displayArchetype ?? '神秘原型'
  const visual = useMemo(() => getArchetypeVisual(displayArchetype), [displayArchetype])
  const summary = trimSentence(visual.summary) || '你的社交氛围已经有了清晰的轮廓。'
  const traitEntries = useMemo(() => getTraitEntries(resultState?.result ?? sessionSnapshot?.result), [resultState, sessionSnapshot])
  const skillSet = useMemo(() => (displayArchetype ? getArchetypeSkills(displayArchetype) : undefined), [displayArchetype])
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
  const displayAsset =
    visual.asset || getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.resultsCelebrate)
  const slotFocusVisual = useMemo(() => getArchetypeVisual(ARCHETYPE_SEQUENCE[reelIndex] ?? displayArchetype), [displayArchetype, reelIndex])
  const continueButtonLabel = auth.isLoading
    ? '检查登录状态中…'
    : auth.isAuthenticated
      ? '继续下一步'
      : '微信登录，继续下一步'

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

    try {
      const response = await apiRequest<AssessmentResultEnvelope>({
        path: `/api/assessment/v4/${encodeURIComponent(latestSnapshot.sessionId)}/result`,
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
      const message = resolveResultErrorMessage(error)

      if (mountedRef.current && runId === runIdRef.current) {
        setErrorMessage(message)
        analytics.errorOccurred('result_fetch_failed', message)
      }

      logError('[PersonalityResults] Failed to fetch result', { message })
      return null
    } finally {
      if (mountedRef.current && runId === runIdRef.current) {
        setIsFetchingResult(false)
      }
    }
  }, [analytics])

  const runResultFlow = useCallback(async (options?: { forceRefresh?: boolean }) => {
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
    setProgress(0)
    setRevealPhase('silhouette')
    setSlotPhase('anticipation')
    setSharePosterPath('')
    setReelIndex(getInitialIndex(latestSnapshot?.result?.primaryArchetype ?? latestSnapshot?.sessionId))

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
      setProgress(100)
      setPhaseText('')
      setCompletionMode('replay')
      return
    }

    resultStateRef.current = options?.forceRefresh ? null : resultStateRef.current
    if (options?.forceRefresh) {
      setResultState(null)
    }

    const fetchPromise = fetchResult(nextRunId, Boolean(options?.forceRefresh))
    let didFetchResolve = false
    let fetchedResult: ResolvedResultState | null = null

    void fetchPromise.then((value) => {
      didFetchResolve = true
      fetchedResult = value
    })

    setFlowStage('slot')
    setPhaseText('即将揭晓...')

    await waitFor(SLOT_ANTICIPATION_MS)
    if (!mountedRef.current || nextRunId !== runIdRef.current) {
      return
    }

    setSlotPhase('spinning')
    setPhaseText('命运转动中...')

    const spinSteps = Math.max(1, Math.floor(SLOT_SPIN_MS / SLOT_SPIN_INTERVAL_MS))
    for (let step = 0; step < spinSteps; step += 1) {
      setReelIndex((previous) => (previous + 1) % ARCHETYPE_SEQUENCE.length)
      setProgress(10 + ((step + 1) / spinSteps) * 50)

      await waitFor(SLOT_SPIN_INTERVAL_MS)
      if (!mountedRef.current || nextRunId !== runIdRef.current) {
        return
      }
    }

    let resolvedResult = resultStateRef.current ?? (didFetchResolve ? fetchedResult : null)

    while (!resolvedResult && !didFetchResolve) {
      const elapsed = Date.now() - flowStartedAt
      const shouldShowSlowNetwork = elapsed >= RESULT_SLOW_NETWORK_MS

      setIsSlowNetwork(shouldShowSlowNetwork)
      setSlotPhase('holding')
      setPhaseText(shouldShowSlowNetwork ? '网络有点慢，动画继续等结果到位...' : '正在同步最终画像...')
      setProgress(68)
      setReelIndex((previous) => (previous + 1) % ARCHETYPE_SEQUENCE.length)

      await waitFor(SLOT_HOLD_INTERVAL_MS)
      if (!mountedRef.current || nextRunId !== runIdRef.current) {
        return
      }

      if (Date.now() - flowStartedAt >= FLOW_SAFETY_TIMEOUT_MS) {
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

    const targetName = resolvedResult.result.primaryArchetype ?? ARCHETYPE_SEQUENCE[0]
    const targetIndex = ARCHETYPE_SEQUENCE.indexOf(targetName)
    const safeTargetIndex = targetIndex >= 0 ? targetIndex : 0
    const approachPositions = SLOT_SLOW_STEP_DELAYS.map((_, index) => (
      safeTargetIndex - SLOT_SLOW_STEP_DELAYS.length + index + ARCHETYPE_SEQUENCE.length
    ) % ARCHETYPE_SEQUENCE.length)

    setSlotPhase('slowing')
    setPhaseText('就快锁定了...')

    for (let index = 0; index < approachPositions.length; index += 1) {
      setReelIndex(approachPositions[index] ?? safeTargetIndex)
      setProgress(60 + ((index + 1) / approachPositions.length) * 28)
      await waitFor(SLOT_SLOW_STEP_DELAYS[index] ?? 180)

      if (!mountedRef.current || nextRunId !== runIdRef.current) {
        return
      }
    }

    const shouldNearMiss = !latestSnapshot.resultSequenceCompletedAt && Math.random() < 0.7
    if (shouldNearMiss) {
      setSlotPhase('nearMiss')
      setPhaseText('等等...')
      setReelIndex((safeTargetIndex + 1) % ARCHETYPE_SEQUENCE.length)
      setProgress(92)
      await waitFor(SLOT_NEAR_MISS_MS)

      if (!mountedRef.current || nextRunId !== runIdRef.current) {
        return
      }
    }

    setSlotPhase('landed')
    setPhaseText('锁定成功')
    setProgress(100)
    setReelIndex(safeTargetIndex)

    if (typeof Taro.vibrateShort === 'function') {
      void Taro.vibrateShort().catch(() => undefined)
    }

    await waitFor(SLOT_REVEAL_PAUSE_MS)
    if (!mountedRef.current || nextRunId !== runIdRef.current) {
      return
    }

    setFlowStage('reveal')
    setRevealPhase('silhouette')
    setPhaseText('先看轮廓...')

    await waitFor(REVEAL_SILHOUETTE_MS)
    if (!mountedRef.current || nextRunId !== runIdRef.current) {
      return
    }

    setRevealPhase('fill')
    setPhaseText('颜色回来了...')

    await waitFor(REVEAL_FILL_MS)
    if (!mountedRef.current || nextRunId !== runIdRef.current) {
      return
    }

    setRevealPhase('sparkle')
    setPhaseText('灵感点亮...')

    await waitFor(REVEAL_SPARKLE_MS)
    if (!mountedRef.current || nextRunId !== runIdRef.current) {
      return
    }

    setFlowStage('bridge')
    setPhaseText('我在把这份结果装进一张更好分享的 JoyJoin 卡面。')

    await waitFor(RESULT_BRIDGE_MS)
    if (!mountedRef.current || nextRunId !== runIdRef.current) {
      return
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
  }, [analytics, fetchResult])

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
    void Taro.reLaunch({ url: MINI_PROGRAM_ROUTES.personalityTest })
  }, [analytics])

  const handleContinue = useCallback(async () => {
    if (auth.isLoading) {
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

    await Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.personalityTestAuthGate })
  }, [auth.isAuthenticated, auth.isLoading, auth.nextStep])

  const handleGeneratePoster = useCallback(async () => {
    if (isGeneratingPoster || !displayArchetype) {
      return
    }

    setIsGeneratingPoster(true)

    try {
      const posterInput: PersonalitySharePosterInput = {
        archetype: displayArchetypeName,
        nickname: visual.nickname || displayArchetypeName,
        tagline: visual.tagline || visual.description || summary,
        summary,
        shareLine,
        accentColor: visual.accent || DEFAULT_ACCENT,
        accentSoft: visual.accentSoft,
        accentStrong: visual.accentStrong,
        archetypeAsset: displayAsset,
        xiaoyueAsset: getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.resultsCelebrate),
        confidenceLabel,
        rarityLabel:
          typeof visual.rarityPercentage === 'number'
            ? `稀有度 ${Math.round(visual.rarityPercentage)}%`
            : undefined,
        skillAttribute: skillSet?.attribute ?? '✨ 气场',
        activeSkillTitle: skillSet?.activeSkill.name ?? '瞬间点亮全场',
        activeSkillEffect: skillSet?.activeSkill.shortEffect ?? '把陌生局迅速带到更舒服的节奏。',
        passiveSkillTitle: skillSet?.passiveSkill.name ?? '气场持续发光',
        passiveSkillEffect: skillSet?.passiveSkill.shortEffect ?? '不用刻意用力，也会让人想靠近你。',
        traitEntries,
        topMatches: topMatches.map((match) => ({
          archetype: match.archetype,
          score: Number(match.score) || 0,
        })),
      }

      const nextPosterPath = await generatePersonalitySharePoster(posterInput)
      setSharePosterPath(nextPosterPath)

      logInfo('[PersonalityResults] Poster generated', {
        primaryArchetype: displayArchetypeName,
      })

      const taroWithShareImageMenu = Taro as typeof Taro & {
        showShareImageMenu?: (options: { path: string }) => Promise<unknown>
      }

      if (typeof taroWithShareImageMenu.showShareImageMenu === 'function') {
        await taroWithShareImageMenu.showShareImageMenu({ path: nextPosterPath })
      } else {
        await Taro.previewImage({
          current: nextPosterPath,
          urls: [nextPosterPath],
        })

        Taro.showToast({
          title: '海报已生成，可长按保存',
          icon: 'none',
          duration: 2200,
        })
      }
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : '海报生成失败，请稍后重试。'
      analytics.errorOccurred('poster_generation_failed', message)
      logError('[PersonalityResults] Failed to generate poster', { message })
      Taro.showToast({
        title: message,
        icon: 'none',
        duration: 2600,
      })
    } finally {
      setIsGeneratingPoster(false)
    }
  }, [
    analytics,
    confidenceLabel,
    displayArchetype,
    displayArchetypeName,
    displayAsset,
    isGeneratingPoster,
    shareLine,
    skillSet,
    summary,
    topMatches,
    traitEntries,
    visual,
  ])

  const renderLoadingState = () => (
    <View className='personality-results__centered-state'>
      <Image
        className='personality-results__network-xiaoyue'
        mode='aspectFit'
        src={getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.completing)}
      />
      <Text className='personality-results__state-title'>正在同步你的匿名结果</Text>
      <Text className='personality-results__state-copy'>
        {phaseText || '先把测试结果从当前设备和服务端对齐，再进入正式揭晓。'}
      </Text>
    </View>
  )

  const renderEmptyState = () => (
    <View className='personality-results__centered-state'>
      <Image
        className='personality-results__network-xiaoyue'
        mode='aspectFit'
        src={getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.resultsSlotFallback)}
      />
      <Text className='personality-results__state-title'>这份结果还没准备好</Text>
      <Text className='personality-results__state-copy'>
        当前设备里没有找到完整的匿名测试结果。重新完成一次测试，系统会重新生成并保存这次揭晓流程。
      </Text>
      <View className='personality-results__stack-actions'>
        <Button onClick={handleRestart}>返回重新测试</Button>
      </View>
    </View>
  )

  const renderErrorState = () => (
    <View className='personality-results__centered-state'>
      <Image
        className='personality-results__network-xiaoyue'
        mode='aspectFit'
        src={getXiaoyueExpressionAsset('actionFailure')}
      />
      <Text className='personality-results__state-title'>揭晓过程被打断了</Text>
      <Text className='personality-results__state-copy'>
        {errorMessage || '结果同步出了点问题，重新试一次通常就能恢复。'}
      </Text>
      <View className='personality-results__stack-actions'>
        <Button onClick={handleRetry} disabled={isFetchingResult} loading={isFetchingResult}>
          {isFetchingResult ? '正在重新同步…' : '重试揭晓'}
        </Button>
        <Button variant='secondary' onClick={handleRestart}>重新测试一次</Button>
      </View>
    </View>
  )

  const renderSlotStage = () => {
    const visibleItems = getVisibleReelItems(reelIndex)
    const progressWidth = `${Math.min(100, Math.max(progress, 4))}%`

    return (
      <View className='personality-results__immersive-shell'>
        <Text className='personality-results__immersive-eyebrow'>JoyJoin 原型揭晓</Text>
        <Text className='personality-results__immersive-title'>你的社交卡面正在靠近</Text>
        <Text className='personality-results__immersive-copy'>
          先让命运转几圈，再锁定真正属于你的那一张牌。
        </Text>

        <View className='personality-results__slot-frame'>
          <View className='personality-results__slot-rail' />
          <View className='personality-results__slot-highlight' />

          <View className='personality-results__slot-track'>
            {visibleItems.map((archetype, index) => {
              const itemVisual = getArchetypeVisual(archetype)
              const isActive = index === 1

              return (
                <View
                  key={`${archetype}-${index}`}
                  className={`personality-results__slot-card${isActive ? ' personality-results__slot-card--active' : ''}`}
                  style={{
                    background: isActive ? itemVisual.accentSurface : 'rgba(255, 255, 255, 0.78)',
                    borderColor: isActive ? itemVisual.accentBorder : 'rgba(139, 92, 246, 0.12)',
                    boxShadow: isActive ? `0 18rpx 48rpx ${itemVisual.accentGlow}` : 'none',
                  }}
                >
                  <Image
                    className='personality-results__slot-image'
                    mode='aspectFit'
                    src={
                      itemVisual.asset ||
                      getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.resultsSlotFallback)
                    }
                  />
                  <Text className='personality-results__slot-name'>{archetype}</Text>
                </View>
              )
            })}
          </View>
        </View>

        <View className='personality-results__progress-track'>
          <View
            className='personality-results__progress-fill'
            style={{
              width: progressWidth,
              background: slotFocusVisual.accent || DEFAULT_ACCENT,
            }}
          />
        </View>
        <Text className='personality-results__progress-copy'>{phaseText || '正在准备最终揭晓...'}</Text>

        {(slotPhase === 'holding' || isSlowNetwork) ? (
          <Card className='personality-results__network-card'>
            <Image
              className='personality-results__network-xiaoyue'
              mode='aspectFit'
              src={getXiaoyueExpressionAsset('loadingReveal')}
            />
            <View className='personality-results__network-copy'>
              <Text className='personality-results__network-title'>小悦还在等最后一条同步</Text>
              <Text className='personality-results__network-text'>
                网络有点慢也没关系，动画会继续转到结果真正到位为止。
              </Text>
            </View>
          </Card>
        ) : null}
      </View>
    )
  }

  const renderRevealStage = () => (
    <View className='personality-results__immersive-shell personality-results__immersive-shell--reveal'>
      <Text className='personality-results__immersive-eyebrow'>JoyJoin 原型揭晓</Text>
      <Text className='personality-results__immersive-title'>你的卡面正在显形</Text>
      <Text className='personality-results__immersive-copy'>
        {phaseText || '最后一点火花亮起之后，就会进入完整的结果页。'}
      </Text>

      <View className='personality-results__reveal-orb'>
        <View className='personality-results__reveal-glow' style={{ background: visual.accent || DEFAULT_ACCENT }} />
        <Image
          className={`personality-results__reveal-image personality-results__reveal-image--${revealPhase}`}
          mode='aspectFit'
          src={displayAsset}
        />
        <View className={`personality-results__reveal-scrim personality-results__reveal-scrim--${revealPhase}`} />
        <View className={`personality-results__sparkle-field personality-results__sparkle-field--${revealPhase}`}>
          {Array.from({ length: 7 }).map((_, index) => (
            <Text key={String(index)} className={`personality-results__sparkle personality-results__sparkle--${index + 1}`}>✦</Text>
          ))}
        </View>
      </View>

      <Text className='personality-results__reveal-label'>{displayArchetypeName}</Text>
      <Text className='personality-results__reveal-copy'>
        {revealPhase === 'silhouette'
          ? '先看轮廓，留一点悬念。'
          : revealPhase === 'fill'
            ? '颜色和气场正在回到正确的位置。'
            : '最后这一圈火花之后，就是你的完整结果页。'}
      </Text>
    </View>
  )

  const renderBridgeStage = () => (
    <View className='personality-results__immersive-shell personality-results__immersive-shell--bridge'>
      <Text className='personality-results__immersive-eyebrow'>结果已锁定</Text>
      <Text className='personality-results__immersive-title'>你的 {displayArchetypeName} 已经准备好了</Text>
      <Text className='personality-results__immersive-copy'>
        先把这份气场翻成一张更好分享的 JoyJoin 卡面，再把完整结果交到你手上。
      </Text>

      <Card className='personality-results__bridge-card'>
        <View className='personality-results__bridge-figure'>
          <View className='personality-results__bridge-halo' />
          <Image
            className='personality-results__bridge-mascot'
            mode='aspectFit'
            src={getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.resultsCoach)}
          />
        </View>

        <View className='personality-results__bridge-copy'>
          <Text className='personality-results__bridge-title'>小悦正在替你装裱这张卡</Text>
          <Text className='personality-results__bridge-text'>
            {phaseText || `我已经把 ${displayArchetypeName} 的气场关键词、分享语和后续提示收进同一张卡里，马上展开给你。`}
          </Text>

          <View className='personality-results__bridge-badges'>
            <Text className='personality-results__bridge-badge personality-results__bridge-badge--accent'>
              {displayArchetypeName}
            </Text>
            <Text className='personality-results__bridge-badge'>{confidenceLabel || '结果已锁定'}</Text>
          </View>
        </View>
      </Card>
    </View>
  )

  const renderFinalStage = () => (
    <ScrollView className='personality-results__scroll' scrollY enhanced showScrollbar={false}>
      <View
        className='personality-results__hero-card'
        style={{
          background: visual.accentSurface,
          borderColor: visual.accentBorder,
          boxShadow: `0 22rpx 72rpx ${visual.accentGlow}`,
        }}
      >
        <View className='personality-results__hero-copy'>
          <Text className='personality-results__hero-eyebrow'>匿名结果已解锁</Text>
          <Text className='personality-results__hero-title'>你的 JoyJoin 原型是</Text>
          <Text className='personality-results__hero-name'>{displayArchetypeName}</Text>
          <Text className='personality-results__hero-summary'>{summary}</Text>

          <View className='personality-results__hero-badges'>
            {confidenceLabel ? (
              <Text className='personality-results__hero-badge'>{confidenceLabel}</Text>
            ) : null}
            {typeof visual.rarityPercentage === 'number' ? (
              <Text className='personality-results__hero-badge'>稀有度 {Math.round(visual.rarityPercentage)}%</Text>
            ) : null}
            {visual.nickname ? (
              <Text className='personality-results__hero-badge'>{visual.nickname}</Text>
            ) : null}
          </View>
        </View>

        <View className='personality-results__hero-art-shell'>
          <View className='personality-results__hero-art-bg' style={{ background: visual.accentSoft }} />
          <Image className='personality-results__hero-art' mode='aspectFit' src={displayAsset} />
        </View>
      </View>

      <Card className='personality-results__section-card'>
        <Text className='personality-results__section-label'>JoyJoin 卡面分享</Text>
        <View
          className='personality-results__pokemon-card'
          style={{
            background: `linear-gradient(160deg, ${visual.accentSoft} 0%, #fff8ee 50%, rgba(255, 255, 255, 0.98) 100%)`,
            boxShadow: `0 24rpx 72rpx ${visual.accentGlow}`,
          }}
        >
          <View className='personality-results__pokemon-card-top'>
            <Text className='personality-results__pokemon-chip personality-results__pokemon-chip--dark'>JOYJOIN CARD</Text>
            <Text className='personality-results__pokemon-chip'>{confidenceLabel || 'JoyJoin 结果卡'}</Text>
          </View>

          <View className='personality-results__pokemon-card-hero'>
            <View className='personality-results__pokemon-art-shell'>
              <Image className='personality-results__pokemon-art' mode='aspectFit' src={displayAsset} />
            </View>
            <View className='personality-results__pokemon-copy'>
              <Text className='personality-results__pokemon-name'>{displayArchetypeName}</Text>
              <Text className='personality-results__pokemon-tagline'>{visual.tagline || visual.description}</Text>
              <Text className='personality-results__pokemon-share-line'>{shareLine}</Text>
            </View>
          </View>

          {topMatches.length > 0 ? (
            <View className='personality-results__pokemon-match-row'>
              {topMatches.slice(0, 3).map((match) => (
                <Text key={match.archetype} className='personality-results__pokemon-match-chip'>
                  {match.archetype} {Math.round(match.score)}%
                </Text>
              ))}
            </View>
          ) : null}

          <View className='personality-results__pokemon-skill-grid'>
            <View className='personality-results__pokemon-skill personality-results__pokemon-skill--warm'>
              <Text className='personality-results__pokemon-skill-label'>主动技</Text>
              <Text className='personality-results__pokemon-skill-name'>
                {skillSet?.activeSkill.name ?? '瞬间点亮全场'}
              </Text>
              <Text className='personality-results__pokemon-skill-copy'>
                {skillSet?.activeSkill.shortEffect ?? '把陌生局迅速带到更舒服的节奏。'}
              </Text>
            </View>
            <View className='personality-results__pokemon-skill personality-results__pokemon-skill--cool'>
              <Text className='personality-results__pokemon-skill-label'>被动技</Text>
              <Text className='personality-results__pokemon-skill-name'>
                {skillSet?.passiveSkill.name ?? '气场持续发光'}
              </Text>
              <Text className='personality-results__pokemon-skill-copy'>
                {skillSet?.passiveSkill.shortEffect ?? '不用刻意用力，也会让人想靠近你。'}
              </Text>
            </View>
          </View>

          <View className='personality-results__pokemon-actions'>
            <Button onClick={() => void handleGeneratePoster()} disabled={isGeneratingPoster} loading={isGeneratingPoster}>
              {isGeneratingPoster ? '正在生成海报…' : '生成并分享卡片'}
            </Button>
            <Button variant='secondary' openType='share'>邀请朋友也测一下</Button>
          </View>
        </View>
      </Card>

      <Card className='personality-results__section-card'>
        <View className='personality-results__coach-card'>
          <Image
            className='personality-results__coach-image'
            mode='aspectFit'
            src={getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.resultsCoach)}
          />
          <View className='personality-results__coach-copy'>
            <Text className='personality-results__section-label'>小悦的结论</Text>
            <Text className='personality-results__coach-title'>这张卡为什么像你</Text>
            <Text className='personality-results__coach-text'>{summary}</Text>
            <Text className='personality-results__coach-text'>
              {visual.hiddenStrength || '你的社交存在感不是靠用力营业，而是靠稳定地把气氛带到对的位置。'}
            </Text>
          </View>
        </View>
      </Card>

      <Card className='personality-results__section-card'>
        <Text className='personality-results__section-label'>你的社交雷达</Text>
        <View className='personality-results__trait-list'>
          {traitEntries.map((trait) => (
            <View key={trait.key} className='personality-results__trait-row'>
              <View className='personality-results__trait-header'>
                <Text className='personality-results__trait-label'>{trait.label}</Text>
                <Text className='personality-results__trait-value'>{trait.value}</Text>
              </View>
              <View className='personality-results__trait-track'>
                <View className='personality-results__trait-fill' style={{ width: `${trait.value}%`, background: visual.accent || DEFAULT_ACCENT }} />
              </View>
            </View>
          ))}
        </View>
      </Card>

      <View className='personality-results__stack-actions personality-results__stack-actions--spacious'>
        <Button onClick={() => void handleContinue()} disabled={auth.isLoading}>
          {continueButtonLabel}
        </Button>
        <Button variant='secondary' onClick={handleRestart}>重新测试一次</Button>
      </View>
    </ScrollView>
  )

  let content = renderLoadingState()

  switch (flowStage) {
    case 'empty':
      content = renderEmptyState()
      break
    case 'error':
      content = renderErrorState()
      break
    case 'slot':
      content = renderSlotStage()
      break
    case 'reveal':
      content = renderRevealStage()
      break
    case 'bridge':
      content = renderBridgeStage()
      break
    case 'result':
      content = renderFinalStage()
      break
    case 'loading':
    default:
      content = renderLoadingState()
      break
  }

  return (
    <View className={`personality-results personality-results--${flowStage}`}>
      {content}
      <Canvas canvasId={PERSONALITY_SHARE_POSTER_CANVAS_ID} className='personality-results__poster-canvas' />
    </View>
  )
}


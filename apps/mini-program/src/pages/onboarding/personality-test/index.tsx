import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
  skipQuestion,
  MAX_SKIP_COUNT,
} from '@shared/personality/adaptiveEngine'
import { questionsV4 } from '@shared/personality/questionsV4'
import Button from '../../../components/ui/Button'
import SegmentedProgress from '../../../components/ui/SegmentedProgress'
import OnboardingLoadingShell from '../../../components/loading/OnboardingLoadingShell'
import XiaoyueSpriteAnimator, {
  type XiaoyueSpriteState,
} from '../../../components/mascot/XiaoyueSpriteAnimator'
import { useAuth, useInvalidateAuth } from '../../../hooks/useAuth'
import { apiRequest, getUserState } from '../../../lib/api/api'
import { useOnboardingAnalytics } from '../../../hooks/onboarding/useOnboardingAnalytics'
import { useOnboardingCheckpoint } from '../../../hooks/onboarding/useOnboardingCheckpoint'
import {
  clearAnonymousAssessmentStorage,
  hasAnonymousAssessmentResult,
  isAnonymousAssessmentSessionCompleted,
  readAnonymousAssessmentSession,
  readAnonymousAssessmentAnswers,
  saveAnonymousAssessmentSession,
  upsertAnonymousAssessmentAnswer,
  type AnonymousAssessmentResult,
  type AnonymousAssessmentSessionSnapshot,
  type AnonymousAssessmentTopMatch,
} from '../../../lib/auth/anonymousOnboarding'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import {
  navigateToMiniProgramNextStep,
  runMiniProgramRouteTransition,
} from '../../../lib/onboarding/onboardingNavigation'
import { logInfo, logWarn, logError } from '../../../lib/utils/logger'
import { haptics } from '../../../lib/utils/haptics'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import type { XiaoyueExpressionId } from '../../../lib/mascot/xiaoyueExpressions'
import { ResponsiveSpacer } from '../../../components/ui/ResponsiveSpacer'
import TypewriterText from '../../../components/ui/TypewriterText'
import MascotQuestionHeader from './MascotQuestionHeader'
import PersonalityTestAnswerArea, { getNearestSliderOption } from './PersonalityTestAnswerArea'
import { isMilestoneQuestion, resolveOptionPreviewSpriteState } from './personalityTestLogic'
import QuestionTransition from './QuestionTransition'
import { useBackReview } from './useBackReview'
import {
  getArchetypeVisual,
  getIntroStaticAsset,
  getIntroStaticFallbackAsset,
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
  PERSONALITY_TEST_QUESTION_EXPRESSION,
  ASSET_BASE_WEBP_LOCAL,
} from './visuals'
import { preloadImagesWithDiagnostics } from '../../../lib/utils/imagePreload'
import { preloadRouteAssets } from '../../../lib/utils/routePreloadAssets'
import './index.scss'
import { HalfwayMilestone } from './HalfwayMilestone'
import type { Phase } from './types'

type AssessmentQuestionType = 'choice' | 'slider' | 'emoji_tap'

interface AssessmentOption {
  value: string
  text: string
  traitScores?: Record<string, number>
  iconAssetKey?: string
  commentary?: string
}

interface AssessmentSliderConfig {
  leftLabel: string
  rightLabel: string
  leftEmoji?: string
  rightEmoji?: string
}

interface AssessmentQuestion {
  id: string
  scenarioText: string
  questionText: string
  options: AssessmentOption[]
  questionType?: AssessmentQuestionType
  sliderConfig?: AssessmentSliderConfig
}

export type { AssessmentQuestion, AssessmentOption, AssessmentSliderConfig, AssessmentQuestionType }

interface AssessmentProgress {
  answered: number
  estimatedRemaining: number
  minQuestions: number
  softMaxQuestions: number
  hardMaxQuestions: number
}

interface AssessmentMatch {
  archetype: string
  score: number
  confidence: number
}

interface AssessmentStartResponse {
  sessionId: string
  phase: string
  nextQuestion: AssessmentQuestion | null
  progress: AssessmentProgress
  currentMatches: AssessmentMatch[]
  isComplete: boolean
}

interface AssessmentAnswerResponse {
  isComplete: boolean
  nextQuestion?: AssessmentQuestion | null
  progress?: AssessmentProgress
  currentMatches?: AssessmentMatch[]
  commentary?: string
  /** Server-computed final result (present when isComplete === true). */
  result?: AnonymousAssessmentResult
}

// Minimum time Xiaoyue's post-answer commentary stays visible before the
// next question appears. Prevents the feedback from flashing by too fast.
const COMMENTARY_MIN_DISPLAY_MS = 1400

/**
 * Map the testing-phase state to a Xiaoyue sprite state. Read by the
 * mascot avatar in the testing zone; the result is rendered via
 * `<XiaoyueSpriteAnimator state={spriteState} ... />`.
 */
function resolveMascotState(args: {
  isLoading: boolean
  isSubmitting: boolean
  questionType: AssessmentQuestionType
  isMilestone: boolean
  isPostAnswerCommentary: boolean
  isCelebration: boolean
}): XiaoyueSpriteState {
  if (args.isCelebration) return 'celebrate'
  if (args.isPostAnswerCommentary) return 'nod'
  if (args.isLoading || args.isSubmitting) return 'listening'
  if (args.isMilestone) return 'surprised'
  if (args.questionType === 'emoji_tap') return 'curious'
  return 'idle'
}

/**
 * Fire-and-forget prefetch of the Xiaoyue AI analysis. Triggered when
 * the test completes — the slot animation's 3-5s duration gives the
 * LLM enough time to populate the cache so the result page lands
 * on a populated analysis instead of a 400ms skeleton.
 *
 * The server endpoint at /api/xiaoyue/prefetch short-circuits with
 * `{ prefetched: false, reason: 'Not ready yet' }` when `confidence < 0.7`.
 * It is safe to call speculatively; failure is logged and swallowed.
 */
function triggerXiaoyueAnalysisPrefetch(
  result: import('../../../lib/auth/anonymousOnboarding').AnonymousAssessmentResult,
  topMatches: AnonymousAssessmentTopMatch[],
): void {
  const archetype = result.primaryArchetype
  if (!archetype) return

  const traitScores = result.traitScores ?? {}
  const confidence =
    result.archetypeConfidence ??
    topMatches[0]?.confidence ??
    0

  void apiRequest<{ prefetched: boolean; reason?: string }>({
    path: '/api/xiaoyue/prefetch',
    method: 'POST',
    data: {
      archetype,
      secondaryArchetype: result.secondaryArchetype ?? null,
      topArchetypes: topMatches,
      traitScores: {
        affinity: traitScores.A ?? traitScores.affinity ?? 0.5,
        openness: traitScores.O ?? traitScores.openness ?? 0.5,
        conscientiousness: traitScores.C ?? traitScores.conscientness ?? 0.5,
        emotionalStability: traitScores.E ?? traitScores.emotionalStability ?? 0.5,
        extraversion: traitScores.X ?? traitScores.extraversion ?? 0.5,
        positivity: traitScores.P ?? traitScores.positivity ?? 0.5,
      },
      confidence,
    },
  })
    .then((res) => {
      logInfo('[PersonalityTest] Xiaoyue prefetch', {
        archetype,
        prefetched: res.prefetched,
        reason: res.reason,
      })
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      logError('[PersonalityTest] Xiaoyue prefetch failed', { message })
    })
}

const INTRO_ARCHETYPE_TEASERS: { archetype: string; vibeLine: string }[] = [
  { archetype: 'corgi', vibeLine: '一进场，就把气氛带热。' },
  { archetype: 'fox', vibeLine: '普通话题，也能聊出火花。' },
  { archetype: 'koala', vibeLine: '会让人慢慢放松下来。' },
]

const INTRO_TRUST_POINTS = [
  {
    prefix: '1.',
    title: '约 3-5 分钟完成',
    description: '轻量做完，不会把你困在一串冗长题目里。',
  },
  {
    prefix: '2.',
    title: '题目会跟着你变',
    description: '越答越准，帮你找到最像自己的氛围命格。',
  },
  {
    prefix: '3.',
    title: '未登录也能先完成',
    description: '结果会先保存在这台设备里，准备好时再继续登录。',
  },
] as const

const PRELOAD_EXPRESSIONS: XiaoyueExpressionId[] = [
  PERSONALITY_TEST_QUESTION_EXPRESSION.choice,
  PERSONALITY_TEST_QUESTION_EXPRESSION.slider,
  PERSONALITY_TEST_QUESTION_EXPRESSION.emoji_tap,
  PERSONALITY_TEST_QUESTION_EXPRESSION.loading,
]

function getQuestionType(question: AssessmentQuestion | null): AssessmentQuestionType {
  if (!question?.questionType) {
    return 'choice'
  }
  return question.questionType
}

function getSliderValueFromPreviousAnswer(previousAnswer: string | null, options: AssessmentOption[]): number {
  if (!previousAnswer) return 50
  const match = previousAnswer.match(/(\d+)/)
  const numericValue = match ? Number(match[1]) : 50
  const option = getNearestSliderOption(options, numericValue)
  return option ? numericValue : 50
}

export default function PersonalityTestPage() {
  const auth = useAuth()
  const invalidateAuth = useInvalidateAuth()
  const { saveCheckpoint } = useOnboardingCheckpoint()

  const [phase, setPhase] = useState<Phase>('intro')
  const [sessionId, setSessionId] = useState('')
  const [question, setQuestion] = useState<AssessmentQuestion | null>(null)
  const [progress, setProgress] = useState<AssessmentProgress | null>(null)
  const [currentMatches, setCurrentMatches] = useState<AssessmentMatch[]>([])
  const [sliderValue, setSliderValue] = useState(50)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPageExiting, setIsPageExiting] = useState(false)
  const [error, setError] = useState('')
  const [spriteState, setSpriteState] = useState<XiaoyueSpriteState>('idle')
  const [mascotAutoPlay, setMascotAutoPlay] = useState(false)
  const sliderInteractionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [postAnswerCommentary, setPostAnswerCommentary] = useState<string | null>(null)
  const commentaryReceivedAtRef = useRef<number>(0)
  const [milestonePulse, setMilestonePulse] = useState(false)

  const [skipsRemaining, setSkipsRemaining] = useState(MAX_SKIP_COUNT)
  const [isSkipping, setIsSkipping] = useState(false)
  const [introImgError, setIntroImgError] = useState(false)
  const [introImgLoaded, setIntroImgLoaded] = useState(false)
  const [introReducedMotion, setIntroReducedMotion] = useState(false)
  useResetOnShow(setIsPageExiting, setIsSubmitting, setIsSkipping)

  // Preload intro assets when the page mounts — redundant with app-launch and
  // landing-page preloads, but critical for direct entry (share links, deeplinks).
  useEffect(() => {
    preloadRouteAssets('pages/onboarding/personality-test/index')
  }, [])

  // Detect reduced-motion preference once for the intro mascot
  useEffect(() => {
    try {
      const info = Taro.getSystemInfoSync()
      setIntroReducedMotion((info as any).reduceMotion === true)
    } catch {
      setIntroReducedMotion(false)
    }
  }, [])

  // Safety timeout: reset isPageExiting if it stays true for >5s.
  // Guards against WeChat silently rejecting a navigation (the navigation API
  // resolves without error but the page transition never happens) which would
  // otherwise leave isPageExiting permanently true and block auth-gate effects.
  const isPageExitingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (isPageExiting) {
      isPageExitingTimerRef.current = setTimeout(() => {
        setIsPageExiting(false)
        logWarn('[PersonalityTest] isPageExiting safety reset (timeout)')
      }, 5000)
    }
    return () => {
      if (isPageExitingTimerRef.current) {
        clearTimeout(isPageExitingTimerRef.current)
        isPageExitingTimerRef.current = null
      }
    }
  }, [isPageExiting])

  // Echo exit animation state: when isSubmitting drops, the echo fades out
  // over 220ms before unmounting so the handoff to the next question feels
  // composed rather than abrupt.
  const [isEchoExiting, setIsEchoExiting] = useState(false)
  const echoExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const echoTrackedRef = useRef(false)

  // Guard against stale async closures hijacking navigation after session change
  const activeSessionRef = useRef<string>('')
  // Remember the last attempted option so we can retry on network failure
  const lastAttemptedOptionRef = useRef<AssessmentOption | null>(null)
  // Track previous question + answer for one-step back
  const previousQuestionRef = useRef<AssessmentQuestion | null>(null)
  const previousAnswerRef = useRef<string | null>(null)
  // Anonymous engine state for client-side back + re-answer
  const anonymousEngineStateRef = useRef<ReturnType<typeof initializeEngineState> | null>(null)
  // Pending question update: hold next-question data until echo exit completes
  // so the user never sees new question text + old answer echo simultaneously.
  const pendingQuestionUpdateRef = useRef<{
    question: AssessmentQuestion | null
    progress: AssessmentProgress | null
    matches: AssessmentMatch[]
  } | null>(null)
  // Option-hover preview (P1-2): 200ms touch debounce, cancel on move or early release.
  // Stores the option whose 200ms timer is pending so we can cancel cleanly.
  const hoverPreviewRef = useRef<{
    option: AssessmentOption
    timer: ReturnType<typeof setTimeout>
  } | null>(null)
  // Captures the sprite state that was active before the hover preview so we
  // can restore it on early release (e.g. tap-then-cancel before 200ms).
  const prePreviewSpriteRef = useRef<XiaoyueSpriteState | null>(null)

  const backReview = useBackReview()

  const isAuthenticated = auth.isAuthenticated

  // Feature flag: echo loading state (kill switch). Authenticated users get
  // the server-driven flag; anonymous users default to enabled.
  const echoEnabled = isAuthenticated
    ? (auth.user?.features?.personalityTestEchoEnabled ?? true)
    : true

  const hasStoredIncompleteSession = useMemo(() => {
    if (isAuthenticated) {
      return false
    }
    const snapshot = readAnonymousAssessmentSession()
    return Boolean(snapshot?.sessionId && !isAnonymousAssessmentSessionCompleted(snapshot))
  }, [isAuthenticated])

  const analytics = useOnboardingAnalytics('personality-test', {
    enabled:
      !auth.isLoading && (!auth.isAuthenticated || auth.nextStep === 'personality-test'),
    startMetadata: {
      isAuthenticated,
      entryMode: hasStoredIncompleteSession ? 'resume' : 'fresh',
    },
  })

  const questionType = getQuestionType(question)
  const questionStub = useMemo(
    () => ({ scenarioText: question?.scenarioText, questionText: question?.questionText ?? '' }),
    [question?.scenarioText, question?.questionText],
  )
  const estimatedTotal = progress
    ? progress.answered + Math.max(progress.estimatedRemaining, 1)
    : 1
  const progressPercent = progress
    ? Math.round((progress.answered / Math.max(estimatedTotal, 1)) * 100)
    : 0

  const introTeasers = useMemo(
    () =>
      INTRO_ARCHETYPE_TEASERS.map((item) => ({
        ...item,
        visual: getArchetypeVisual(item.archetype),
      })),
    [],
  )

  const introCoachLine = hasStoredIncompleteSession
    ? '进度还在，继续答几分钟就能完成。'
    : '没有标准答案，凭直觉选就好。我会帮你整理出最真实的氛围命格。'
  const introFooterKicker = hasStoredIncompleteSession
    ? '再几分钟就能完成，继续吧。'
    : '先找到你的氛围命格，后面的遇见才会更对味。'
  const introFooterLine = hasStoredIncompleteSession
    ? '进度已经留好，从停下的地方继续就行'
    : '没有标准答案，选最像你的感觉就好'
  const introPrimaryLabel = isSubmitting
    ? '准备中…'
    : error
      ? '重试'
      : hasStoredIncompleteSession
        ? '继续测试'
        : '开始测试'

  const { isDegradation } = useDeviceTier()

  const getPageClassName = (...extraClasses: string[]) =>
    ['personality-test', ...extraClasses, isPageExiting ? 'personality-test--exiting' : '', isDegradation ? 'personality-test--low-end' : '']
      .filter(Boolean)
      .join(' ')

  const completeAnonymousAssessment = useCallback(async (
    targetSessionId: string,
    nextTopArchetypes?: AnonymousAssessmentTopMatch[] | null,
    finalResult?: AnonymousAssessmentResult | null,
  ) => {
    const primaryArchetype = finalResult?.primaryArchetype ?? nextTopArchetypes?.[0]?.archetype
    saveAnonymousAssessmentSession({
      sessionId: targetSessionId,
      phase: 'completed',
      timestamp: Date.now(),
      completedAt: new Date().toISOString(),
      result: finalResult ?? null,
      topArchetypes: nextTopArchetypes ?? currentMatches,
      resultSequenceCompletedAt: undefined,
    })

    // Warm the result-page image cache while the route transition plays.
    // This removes the cold-start decode on the result hero and pokemon cards.
    if (primaryArchetype) {
      void preloadImagesWithDiagnostics(
        [`${ASSET_BASE_WEBP_LOCAL}/archetype-${primaryArchetype}.webp`],
        'personality-test-completion',
      )
    }

    await runMiniProgramRouteTransition({
      beforeNavigate: () => setIsPageExiting(true),
    })
    await Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.personalityTestResults })
  }, [currentMatches])

  /** Hard guard: refuse to transition if the server returned an incomplete or invalid finalResult. */
  function isValidFinalResult(result: AnonymousAssessmentResult | undefined): boolean {
    if (!result) return false
    const primary = result.primaryArchetype
    if (!primary || typeof primary !== 'string') return false
    return !!ARCHETYPE_BY_ID[primary]
  }

  useEffect(() => {
    if (auth.isLoading || isSubmitting || isPageExiting) {
      return
    }

    // If user already has an archetype, they should never be on the test page
    if (auth.user?.primaryArchetype) {
      Taro.switchTab({ url: MINI_PROGRAM_ROUTES.discover }).catch((err: unknown) => {
        logError('[PersonalityTest] switchTab failed', { err: err instanceof Error ? err.message : String(err) })
      })
      return
    }

    if (auth.isAuthenticated && auth.nextStep && auth.nextStep !== 'personality-test' && auth.nextStep !== 'onboarding') {
      void navigateToMiniProgramNextStep(auth.nextStep, {
        mode: 'replace',
        transition: { beforeNavigate: () => setIsPageExiting(true) },
      })
      return
    }

    if (!auth.isAuthenticated && phase === 'intro') {
      const snapshot = readAnonymousAssessmentSession()
      if (isAnonymousAssessmentSessionCompleted(snapshot) || hasAnonymousAssessmentResult(snapshot)) {
        Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.personalityTestResults }).catch(() => {
          setPhase('intro')
        })
      }
    }
  }, [auth.isAuthenticated, auth.isLoading, auth.nextStep, isPageExiting, isSubmitting, phase])

  const handleStart = useCallback(async () => {
    haptics('medium')
    setError('')
    setIsSubmitting(true)
    try {
      const snapshot = !isAuthenticated ? readAnonymousAssessmentSession() : null
      const shouldResumeAnonymous = Boolean(snapshot?.sessionId && !isAnonymousAssessmentSessionCompleted(snapshot))

      if (!isAuthenticated && !shouldResumeAnonymous) {
        clearAnonymousAssessmentStorage()
      }

      logInfo('[PersonalityTest] Starting assessment session', {
        isAuthenticated,
        shouldResumeAnonymous,
      })

      const result = await apiRequest<AssessmentStartResponse>({
        path: '/api/assessment/v4/start',
        method: 'POST',
        data: shouldResumeAnonymous ? { sessionId: snapshot?.sessionId } : {},
      })

      activeSessionRef.current = result.sessionId
      setSessionId(result.sessionId)
      setQuestion(result.nextQuestion)
      setProgress(result.progress)
      setCurrentMatches(result.currentMatches ?? [])
      setSliderValue(50)

      if (!isAuthenticated) {
        const nextSnapshot: AnonymousAssessmentSessionSnapshot = {
          sessionId: result.sessionId,
          phase: result.phase,
          timestamp: Date.now(),
          completedAt: snapshot?.completedAt,
          result: snapshot?.result,
          topArchetypes: snapshot?.topArchetypes,
        }
        saveAnonymousAssessmentSession(nextSnapshot)

        // Initialize anonymous engine state from stored answers for back + skip support
        const storedAnswers = readAnonymousAssessmentAnswers()
        let engineState = initializeEngineState()
        for (const ans of storedAnswers) {
          const q = questionsV4.find((quest) => quest.id === ans.questionId)
          if (q) {
            engineState = processAnswer(engineState, q, ans.selectedOption)
          }
        }
        anonymousEngineStateRef.current = engineState
        setSkipsRemaining(MAX_SKIP_COUNT - engineState.skipCount)
      }

      if (result.isComplete || !result.nextQuestion) {
        setPhase('completing')
        const completedAnswerCount = result.progress?.answered ?? 0

        if (isAuthenticated) {
          clearAnonymousAssessmentStorage()
          await saveCheckpoint('personality-test')
          await invalidateAuth()
          const userState = await getUserState()
          analytics.stepCompleted({
            isAuthenticated: true,
            answerCount: completedAnswerCount,
            nextStep: userState.nextStep ?? 'essential-data',
          })
          await navigateToMiniProgramNextStep(userState.nextStep, {
            mode: 'replace',
            transition: { beforeNavigate: () => setIsPageExiting(true) },
          })
          // If we reach this line, the navigation was silently rejected (WeChat
          // runtime quirk). Reset isPageExiting so the user can interact again.
          setIsPageExiting(false)
          return
        }

        analytics.stepCompleted({
          isAuthenticated: false,
          answerCount: completedAnswerCount,
          destination: MINI_PROGRAM_ROUTES.personalityTestResults,
        })
        await completeAnonymousAssessment(result.sessionId, result.currentMatches ?? currentMatches)
        anonymousEngineStateRef.current = null
        // If we reach this line, the navigation was silently rejected (WeChat
        // runtime quirk). Reset isPageExiting so the user can interact again.
        setIsPageExiting(false)
        return
      }

      setPhase('testing')
    } catch (err) {
      setIsPageExiting(false)
      const message = err instanceof Error ? err.message : '启动测试没成功，再试试'
      setError(message)
      analytics.errorOccurred('start_failed', message)
      logError('[PersonalityTest] Failed to start', { message })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    analytics,
    completeAnonymousAssessment,
    currentMatches,
    invalidateAuth,
    isAuthenticated,
    saveCheckpoint,
  ])

  const handleAnswer = useCallback(async (option: AssessmentOption) => {
    if (!sessionId || !question || isSubmitting) return

    // Clear previous commentary so the speech bubble doesn't show stale feedback
    setPostAnswerCommentary(null)

    // Stale-session guard: remember which session this answer belongs to
    const thisSessionId = sessionId
    activeSessionRef.current = thisSessionId

    // Choose reaction based on milestone proximity
    const isMilestone = progress && isMilestoneQuestion(progress.answered)
    const reactionState: XiaoyueSpriteState = isMilestone ? 'celebrate' : 'nod'

    if (isMilestone) {
      setMilestonePulse(true)
    }

    setSpriteState(reactionState)

    lastAttemptedOptionRef.current = option

    // Show pre-attached per-option commentary immediately so Xiaoyue's feedback
    // is always tailored to the exact option the user chose — no more generic
    // rotating "收到～" messages that pretend to know the user.
    const immediateCommentary = option.commentary ?? null
    const commentaryStartTime = Date.now()
    setPostAnswerCommentary(immediateCommentary)
    if (immediateCommentary) {
      commentaryReceivedAtRef.current = commentaryStartTime
    }

    setIsSubmitting(true)
    setError('')
    try {
      // Fire the answer API call in parallel with the commentary display timer
      const apiPromise = apiRequest<AssessmentAnswerResponse>({
        path: `/api/assessment/v4/${encodeURIComponent(thisSessionId)}/answer`,
        method: 'POST',
        data: {
          questionId: question.id,
          selectedOption: option.value,
        },
      })

      // Ensure commentary is visible for at least COMMENTARY_MIN_DISPLAY_MS so
      // the user has time to read Xiaoyue's feedback before the next question
      // appears. The API call runs concurrently with this delay.
      if (immediateCommentary) {
        const minDisplayRemaining = Math.max(
          0,
          COMMENTARY_MIN_DISPLAY_MS - (Date.now() - commentaryStartTime),
        )
        if (minDisplayRemaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, minDisplayRemaining))
        }
      }

      const result = await apiPromise

      // Abandon stale async work if session has changed
      if (activeSessionRef.current !== thisSessionId) return

      // Fallback: use server commentary if the option didn't have pre-attached
      // commentary (shouldn't happen, but ensures robustness)
      if (!immediateCommentary && result.commentary) {
        setPostAnswerCommentary(result.commentary)
        commentaryReceivedAtRef.current = Date.now()
      }

      if (!isAuthenticated) {
        upsertAnonymousAssessmentAnswer({
          questionId: question.id,
          selectedOption: option.value,
          traitScores: option.traitScores,
          answeredAt: new Date().toISOString(),
        })
      }

      if (result.isComplete || !result.nextQuestion) {
        setPhase('completing')
        const completedAnswerCount = result.progress?.answered ?? ((progress?.answered ?? 0) + 1)
        logInfo('[PersonalityTest] Assessment complete', {
          isAuthenticated,
          sessionId: thisSessionId,
        })

        // P0-3: prefetch the Xiaoyue AI analysis so the result page lands
        // on a populated analysis instead of a 400ms skeleton.
        if (result.result && result.result.primaryArchetype) {
          triggerXiaoyueAnalysisPrefetch(
            result.result,
            result.currentMatches ?? currentMatches,
          )
        }

        if (isAuthenticated) {
          clearAnonymousAssessmentStorage()
          await saveCheckpoint('personality-test')
          await invalidateAuth()
          const userState = await getUserState()
          analytics.stepCompleted({
            isAuthenticated: true,
            answerCount: completedAnswerCount,
            nextStep: userState.nextStep ?? 'essential-data',
          })
          await navigateToMiniProgramNextStep(userState.nextStep, {
            mode: 'replace',
            transition: { beforeNavigate: () => setIsPageExiting(true) },
          })
          return
        }

        analytics.stepCompleted({
          isAuthenticated: false,
          answerCount: completedAnswerCount,
          destination: MINI_PROGRAM_ROUTES.personalityTestResults,
        })
        if (!isValidFinalResult(result.result)) {
          setIsPageExiting(false)
          setError('结果同步出了点小问题，请重试一次')
          analytics.errorOccurred('invalid_final_result', 'primaryArchetype missing or invalid')
          logError('[PersonalityTest] Invalid finalResult from server', {
            sessionId: thisSessionId,
            result: result.result,
          })
          return
        }
        await completeAnonymousAssessment(thisSessionId, result.currentMatches ?? currentMatches, result.result)
        anonymousEngineStateRef.current = null
        return
      }

      // Save previous question + answer for one-step back
      previousQuestionRef.current = question
      previousAnswerRef.current = option.value

      // Abandon if session changed during the async work
      if (activeSessionRef.current !== thisSessionId) return

      // Clear the attempted-option ref on successful submit so retry and echo
      // don't leak stale state across questions.
      lastAttemptedOptionRef.current = null

      // Stash the next-question data in a ref instead of applying it immediately.
      // The echo exit animation (220ms) will apply this atomically so the user
      // never sees new question text overlaid with the fading old answer echo.
      pendingQuestionUpdateRef.current = {
        question: result.nextQuestion ?? null,
        progress: result.progress ?? null,
        matches: result.currentMatches ?? [],
      }
    } catch (err) {
      setIsPageExiting(false)
      const message = err instanceof Error ? err.message : getErrorMessage('submit-failed')
      setError(message)
      analytics.errorOccurred('answer_failed', message)
      logError('[PersonalityTest] Failed to submit answer', { message })
      setSpriteState('idle')
    } finally {
      setIsSubmitting(false)
    }
  }, [
    analytics,
    completeAnonymousAssessment,
    currentMatches,
    invalidateAuth,
    isAuthenticated,
    isSubmitting,
    progress,
    question,
    saveCheckpoint,
    sessionId,
  ])

  const handleSliderSubmit = useCallback(() => {
    if (!question) return
    const sliderOption = getNearestSliderOption(question.options, sliderValue)
    if (sliderOption) {
      void handleAnswer(sliderOption)
      return
    }
    analytics.validationFailed('slider', 'no-option-mapped')
  }, [question, sliderValue, handleAnswer, analytics])

  const handleSliderChange = useCallback((value: number) => {
    setSliderValue(value)
    setMascotAutoPlay(true)
    if (sliderInteractionTimerRef.current) {
      clearTimeout(sliderInteractionTimerRef.current)
    }
    sliderInteractionTimerRef.current = setTimeout(() => {
      setMascotAutoPlay(false)
    }, 400)
  }, [])

  const handleBackReviewSliderChange = useCallback((value: number) => {
    setSliderValue(value)
    if (!backReview.isBackReviewMode || !backReview.backReviewQuestion) return
    const option = getNearestSliderOption(backReview.backReviewQuestion.options, value)
    if (option) {
      backReview.selectOption(option.value)
    }
  }, [backReview])

  const handleBackReviewSliderSubmit = useCallback(() => {
    if (!backReview.isBackReviewMode || !backReview.backReviewQuestion) return
    const option = getNearestSliderOption(backReview.backReviewQuestion.options, sliderValue)
    if (option) {
      backReview.selectOption(option.value)
    }
  }, [backReview, sliderValue])

  const handleRetry = useCallback(() => {
    const option = lastAttemptedOptionRef.current
    if (option) {
      setError('')
      void handleAnswer(option)
    }
  }, [handleAnswer])

  // When submitting ends while sprite is in 'thinking', return to idle and
  // deactivate the interaction-driven mascot animation.
  useEffect(() => {
    if (!isSubmitting) {
      setSpriteState((prev) => (prev === 'thinking' ? 'idle' : prev))
      setMascotAutoPlay(false)
    }
  }, [isSubmitting])

  // Echo lifecycle: fade-out before unmount so the transition to the next
  // question doesn't feel like a hard cut.
  const shouldShowEcho = isSubmitting && !backReview.isBackReviewMode
  useEffect(() => {
    if (shouldShowEcho) {
      // Entering: cancel any pending exit and ensure we're not in exiting state
      if (echoExitTimerRef.current) {
        clearTimeout(echoExitTimerRef.current)
        echoExitTimerRef.current = null
      }
      setIsEchoExiting(false)
    } else if (!shouldShowEcho && !isEchoExiting) {
      // Just stopped submitting — start exit animation, then unmount
      setIsEchoExiting(true)
      echoExitTimerRef.current = setTimeout(() => {
        setIsEchoExiting(false)
        echoExitTimerRef.current = null
        // Apply the pending question update atomically after echo exits
        const pending = pendingQuestionUpdateRef.current
        if (pending) {
          setPostAnswerCommentary(null)
          setQuestion(pending.question)
          setProgress(pending.progress)
          setCurrentMatches(pending.matches)
          setSliderValue(50)
          pendingQuestionUpdateRef.current = null
        }
      }, 220)
    }
  }, [shouldShowEcho, isEchoExiting])

  // Cleanup echo exit timer on unmount
  useEffect(() => {
    return () => {
      if (echoExitTimerRef.current) {
        clearTimeout(echoExitTimerRef.current)
      }
    }
  }, [])

  // Analytics: track echo impression once per submission
  useEffect(() => {
    if (shouldShowEcho && !echoTrackedRef.current) {
      echoTrackedRef.current = true
      analytics.interaction('personality_test_echo_shown', {
        optionText: lastAttemptedOptionRef.current?.text ?? 'unknown',
        hasCommentary: !!postAnswerCommentary,
      })
    } else if (!shouldShowEcho) {
      echoTrackedRef.current = false
    }
  }, [shouldShowEcho, analytics, postAnswerCommentary])

  // Cleanup any pending slider interaction timer when the page unmounts or
  // the user navigates away, preventing stale setState calls.
  useEffect(() => {
    return () => {
      if (sliderInteractionTimerRef.current) {
        clearTimeout(sliderInteractionTimerRef.current)
        sliderInteractionTimerRef.current = null
      }
    }
  }, [])

  // P1-2: option-hover preview with 200ms debounce.
  // On touch-start, capture the current sprite state, then schedule a state swap
  // to a per-option preview state 200ms later. On touch-end before 200ms, restore
  // the captured state. On commit (handleAnswer runs to completion), the sprite is
  // set to `nod` by the answer flow and the preview is auto-cleared.
  const cancelHoverPreview = useCallback(() => {
    if (hoverPreviewRef.current?.timer) {
      clearTimeout(hoverPreviewRef.current.timer)
    }
    hoverPreviewRef.current = null
    if (prePreviewSpriteRef.current) {
      setSpriteState(prePreviewSpriteRef.current)
      prePreviewSpriteRef.current = null
    }
  }, [])

  const handleOptionTouchStart = useCallback(
    (option: AssessmentOption) => {
      if (isSubmitting) return
      if (backReview.isBackReviewMode) return
      setMascotAutoPlay(true)
      // Cancel any prior pending preview so the latest touch wins
      if (hoverPreviewRef.current?.timer) {
        clearTimeout(hoverPreviewRef.current.timer)
      }
      if (!prePreviewSpriteRef.current) {
        prePreviewSpriteRef.current = spriteState
      }
      hoverPreviewRef.current = {
        option,
        timer: setTimeout(() => {
          if (hoverPreviewRef.current?.option === option) {
            setSpriteState(resolveOptionPreviewSpriteState(option))
          }
        }, 200),
      }
    },
    [isSubmitting, backReview.isBackReviewMode, spriteState],
  )

  const handleOptionTouchEnd = useCallback(() => {
    setMascotAutoPlay(false)
    cancelHoverPreview()
  }, [cancelHoverPreview])

  // Move-cancel: if the user scrolls or drags before the 200ms debounce fires,
  // drop the preview so we don't trap the sprite in a stale state.
  const handleOptionTouchMove = useCallback(
    (e: any) => {
      const touch = e?.touches?.[0]
      if (!touch) return
      // We don't have the original touch-start position in this scope; using a
      // conservative "any move cancels" rule. Acceptable because the preview is
      // an Easter-egg delight, not a critical affordance.
      if (hoverPreviewRef.current) {
        cancelHoverPreview()
      }
    },
    [cancelHoverPreview],
  )

  const handleBack = useCallback(() => {
    if (!previousQuestionRef.current || !previousAnswerRef.current) return
    haptics('light')
    analytics.interaction('personality_test_back_used', {
      questionIndex: progress?.answered ?? 0,
      sessionId: sessionId || 'anonymous',
    })
    lastAttemptedOptionRef.current = null
    backReview.enterBackReview(previousQuestionRef.current, previousAnswerRef.current)
  }, [analytics, backReview, progress, sessionId])

  const handleBackReviewSelect = useCallback((option: AssessmentOption) => {
    backReview.selectOption(option.value)
  }, [backReview])

  const handleConfirmBackReview = useCallback(async () => {
    const payload = backReview.getConfirmPayload()
    if (!payload.changed || !payload.question || !payload.selectedOption) {
      backReview.cancelBackReview()
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      if (isAuthenticated) {
        const result = await apiRequest<AssessmentAnswerResponse>({
          path: `/api/assessment/v4/${encodeURIComponent(sessionId)}/answer`,
          method: 'PUT',
          data: {
            questionId: payload.question.id,
            selectedOption: payload.selectedOption,
          },
        })

        // If engine re-branched to a different next question, discard stale current
        if (result.nextQuestion && result.nextQuestion.id !== question?.id) {
          setQuestion(result.nextQuestion)
        }
        setProgress(result.progress ?? null)
        setCurrentMatches(result.currentMatches ?? [])
        setSliderValue(50)
        setPostAnswerCommentary(null)

        backReview.exitBackReview()
        return
      }

      // Anonymous flow: mutate localStorage and rebuild engine state client-side
      const answers = readAnonymousAssessmentAnswers()
      const nextAnswers = answers.filter((a) => a.questionId !== payload.question!.id)
      nextAnswers.push({
        questionId: payload.question!.id,
        selectedOption: payload.selectedOption,
        traitScores: payload.question!.options.find((o) => o.value === payload.selectedOption)?.traitScores,
        answeredAt: new Date().toISOString(),
      })

      // Rebuild engine state
      let engineState = initializeEngineState()
      for (const ans of nextAnswers) {
        const q = questionsV4.find((quest) => quest.id === ans.questionId)
        if (q) {
          engineState = processAnswer(engineState, q, ans.selectedOption)
        }
      }
      anonymousEngineStateRef.current = engineState

      const nextQuestion = selectNextQuestion(engineState)
      if (!nextQuestion) {
        clearAnonymousAssessmentStorage()
        anonymousEngineStateRef.current = null
        setPhase('completing')
        analytics.stepCompleted({
          isAuthenticated: false,
          answerCount: engineState.answeredQuestionIds.size,
          destination: MINI_PROGRAM_ROUTES.personalityTestResults,
        })
        await completeAnonymousAssessment(sessionId || 'anonymous-client', engineState.currentMatches.slice(0, 3))
        return
      }

      // If re-branched to a different question, use the new one
      const mappedNextQuestion: AssessmentQuestion = {
        id: nextQuestion.id,
        scenarioText: nextQuestion.scenarioText,
        questionText: nextQuestion.questionText,
        options: nextQuestion.options.map((o) => ({
          value: o.value,
          text: o.text,
          traitScores: o.traitScores as Record<string, number>,
          iconAssetKey: o.iconAssetKey,
        })),
        questionType: nextQuestion.questionType ?? 'choice',
        sliderConfig: nextQuestion.sliderConfig
          ? {
              leftLabel: nextQuestion.sliderConfig.leftLabel,
              rightLabel: nextQuestion.sliderConfig.rightLabel,
              leftEmoji: nextQuestion.sliderConfig.leftEmoji,
              rightEmoji: nextQuestion.sliderConfig.rightEmoji,
            }
          : undefined,
      }

      // Save updated answers
      saveAnonymousAssessmentSession({
        sessionId: sessionId || readAnonymousAssessmentSession()?.sessionId || 'anonymous-client',
        phase: 'pre_signup',
        timestamp: Date.now(),
      })
      // Upsert via localStorage
      for (const ans of nextAnswers) {
        upsertAnonymousAssessmentAnswer(ans)
      }

      setQuestion(mappedNextQuestion)
      setProgress({
        answered: engineState.answeredQuestionIds.size,
        estimatedRemaining: Math.max(0, engineState.config.minQuestions - engineState.answeredQuestionIds.size),
        minQuestions: engineState.config.minQuestions,
        softMaxQuestions: engineState.config.softMaxQuestions,
        hardMaxQuestions: engineState.config.hardMaxQuestions,
      })
      setCurrentMatches(engineState.currentMatches.slice(0, 3).map((m) => ({
        archetype: m.archetype,
        score: m.score,
        confidence: m.confidence,
      })))
      setSliderValue(50)
      setPostAnswerCommentary(null)
      previousQuestionRef.current = null
      previousAnswerRef.current = null
      backReview.exitBackReview()
    } catch (err) {
      const message = err instanceof Error ? err.message : getErrorMessage('submit-failed')
      setError(message)
      analytics.errorOccurred('back_review_confirm_failed', message)
      logError('[PersonalityTest] Failed to confirm back review', { message })
      // Stay in back-review mode for retry (REL-02)
    } finally {
      setIsSubmitting(false)
    }
  }, [analytics, backReview, completeAnonymousAssessment, isAuthenticated, question, sessionId])

  const handleCancelBackReview = useCallback(() => {
    backReview.cancelBackReview()
    setError('')
  }, [backReview])

  const handleSkip = useCallback(async () => {
    if (!sessionId || !question || isSkipping || skipsRemaining <= 0) return
    haptics('light')
    analytics.interaction('personality_test_change_question_used', {
      questionIndex: progress?.answered ?? 0,
      sessionId: sessionId || 'anonymous',
    })

    setIsSkipping(true)
    setError('')
    try {
      if (isAuthenticated) {
        const result = await apiRequest<{
          success: boolean
          newQuestion?: AssessmentQuestion | null
          skipCount: number
          canSkip: boolean
          remainingSkips: number
        }>({
          path: `/api/assessment/v4/${encodeURIComponent(sessionId)}/skip`,
          method: 'POST',
          data: { questionId: question.id },
        })
        setSkipsRemaining(result.remainingSkips)
        if (result.newQuestion) {
          setQuestion(result.newQuestion)
        }
        return
      }

      // Anonymous skip (client-side)
      let engineState = anonymousEngineStateRef.current || initializeEngineState()
      const skipResult = skipQuestion(engineState, question.id)
      if (!skipResult) {
        Taro.showToast({ title: '已达换题上限', icon: 'none' })
        return
      }
      anonymousEngineStateRef.current = skipResult.newState
      setSkipsRemaining(MAX_SKIP_COUNT - skipResult.newState.skipCount)

      if (skipResult.newQuestion) {
        const mapped: AssessmentQuestion = {
          id: skipResult.newQuestion.id,
          scenarioText: skipResult.newQuestion.scenarioText,
          questionText: skipResult.newQuestion.questionText,
          options: skipResult.newQuestion.options.map((o) => ({
            value: o.value,
            text: o.text,
            traitScores: o.traitScores as Record<string, number>,
            iconAssetKey: o.iconAssetKey,
          })),
          questionType: skipResult.newQuestion.questionType ?? 'choice',
          sliderConfig: skipResult.newQuestion.sliderConfig
            ? {
                leftLabel: skipResult.newQuestion.sliderConfig.leftLabel,
                rightLabel: skipResult.newQuestion.sliderConfig.rightLabel,
                leftEmoji: skipResult.newQuestion.sliderConfig.leftEmoji,
                rightEmoji: skipResult.newQuestion.sliderConfig.rightEmoji,
              }
            : undefined,
        }
        setQuestion(mapped)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '换题失败，请重试'
      setError(message)
      analytics.errorOccurred('skip_failed', message)
    } finally {
      setIsSkipping(false)
    }
  }, [analytics, isAuthenticated, isSkipping, progress, question, sessionId, skipsRemaining])

  const showLoadingShell = auth.isLoading && (auth.isAuthenticated || hasStoredIncompleteSession)
  if (showLoadingShell) {
    return (
      <OnboardingLoadingShell
        stepLabel='氛围测试'
        title={`${DEFAULT_MASCOT_DISPLAY_NAME}在准备你的命格测试`}
        subtitle='先对齐好你的进度，马上带你进入测试。'
        hint='上次答到一半？我会帮你接上。'
        xiaoyueExpression={PERSONALITY_TEST_XIAOYUE_EXPRESSION.introHero}
      />
    )
  }

  // Intro phase
  if (phase === 'intro') {
    return (
      <View className={getPageClassName('personality-test--intro')}>
        <View className='personality-test__intro-shell'>
          <View className='personality-test__stage personality-test__stage--1'>
            <Text className='personality-test__eyebrow'>
              <Text className='personality-test__eyebrow-en'>JoyJoin</Text>
              <Text> · 氛围原型</Text>
            </Text>
            <Text className='personality-test__intro-title'>3 分钟，读懂你的</Text>
            <Text className='personality-test__intro-title personality-test__intro-title--accent'>聚会气场</Text>
            <Text className='personality-test__intro-subtitle'>
              找到你的氛围命格，让后面的遇见都更对味。
            </Text>
          </View>

          <ResponsiveSpacer heightRpx={16} collapseBelow={700} />

          <View className='personality-test__intro-hero personality-test__stage personality-test__stage--2'>
            <View className='personality-test__intro-hero-visual'>
              <View className='personality-test__intro-hero-halo' />
              <View className='personality-test__intro-mascot'>
                {!introImgLoaded && (
                  <View className='personality-test__intro-mascot-placeholder' />
                )}
                <Image
                  src={introReducedMotion || introImgError ? getIntroStaticFallbackAsset() : getIntroStaticAsset()}
                  mode='aspectFit'
                  className={`personality-test__intro-mascot-img${introImgLoaded ? ' personality-test__intro-mascot-img--loaded' : ''}`}
                  aria-hidden='true'
                  lazyLoad={false}
                  onLoad={() => setIntroImgLoaded(true)}
                  onError={() => setIntroImgError(true)}
                />
              </View>
            </View>

            <View className='personality-test__intro-bubble'>
              <Text className='personality-test__intro-bubble-title'>这一步会带给你什么</Text>
              <Text className='personality-test__intro-bubble-text'>{introCoachLine}</Text>
            </View>

          </View>

          <ResponsiveSpacer heightRpx={16} collapseBelow={720} />

          <View className='personality-test__intro-trust personality-test__stage personality-test__stage--3'>
            <Text className='personality-test__intro-trust-title'>开始前，三件事</Text>
            <View className='personality-test__intro-trust-list'>
              {INTRO_TRUST_POINTS.map((item) => (
                <View key={item.title} className='personality-test__intro-trust-item'>
                  <View className='personality-test__intro-trust-icon'>
                    <Text>{item.prefix}</Text>
                  </View>
                  <View className='personality-test__intro-trust-copy'>
                    <Text className='personality-test__intro-trust-item-title'>{item.title}</Text>
                    <Text className='personality-test__intro-trust-item-description'>{item.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <ResponsiveSpacer heightRpx={16} collapseBelow={780} />

          <View className='personality-test__intro-tease personality-test__stage personality-test__stage--4'>
            <Text className='personality-test__intro-tease-title'>完成后，你会看到自己的氛围命格</Text>
            <Text className='personality-test__intro-tease-subtitle'>
              不是贴标签，而是帮你找到最对味的人。
            </Text>

            <ScrollView
              className='personality-test__intro-tease-scroll'
              scrollX
              enhanced
              showScrollbar={false}
            >
              <View className='personality-test__intro-tease-list'>
                {introTeasers.map((item, teaserIndex) => (
                  <View
                    key={item.archetype}
                    className='personality-test__intro-tease-card'
                  >
                    <View className='personality-test__intro-tease-avatar-wrap'>
                      <Image
                        className='personality-test__intro-tease-avatar'
                        src={item.visual.asset}
                        mode='aspectFit'
                      />
                    </View>
                    <Text className='personality-test__intro-tease-name'>
                      {ARCHETYPE_BY_ID[item.archetype]?.nameCn ?? item.archetype}
                    </Text>
                    <Text className='personality-test__intro-tease-vibe'>{item.vibeLine}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        <View className='personality-test__intro-footer'>
          <Text className='personality-test__intro-footer-kicker'>
            {introFooterKicker}
          </Text>
          {error ? <Text className='personality-test__error personality-test__error--footer'>{error}</Text> : null}
          <Button
            variant='brand'
            className='personality-test__start-btn'
            onClick={handleStart}
            disabled={isSubmitting}
            loading={isSubmitting}
            hoverClass='personality-test__start-btn--hover'
          >
            {introPrimaryLabel}
          </Button>
          <Text className='personality-test__intro-footer-note'>{introFooterLine}</Text>
        </View>
      </View>
    )
  }

  // Completing phase
  if (phase === 'completing') {
    if (error) {
      return (
        <View className='personality-test personality-test--intro'>
          <View className='personality-test__intro-shell'>
            <View className='personality-test__stage personality-test__stage--1'>
              <View className='personality-test__intro-hero'>
                <Image
                  className='personality-test__intro-mascot'
                  src={getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.errorState)}
                  mode='aspectFit'
                  style={{ width: '160rpx', height: '160rpx', marginBottom: '24rpx' }}
                />
                <Text className='personality-test__intro-title'>同步遇到小状况</Text>
                <Text className='personality-test__intro-subtitle'>
                  {typeof error === 'string' && error.includes('服务器')
                    ? '服务器开小差了，稍后再试'
                    : error || '悦仔马上帮你重试~'}
                </Text>
              </View>
            </View>
            <View className='personality-test__intro-footer'>
              <Button
                variant='brand'
                className='personality-test__start-btn'
                onClick={() => { haptics('medium'); setPhase('intro') }}
              >
                重新试试
              </Button>
            </View>
          </View>
        </View>
      )
    }
    return (
      <OnboardingLoadingShell
        stepLabel='氛围命格'
        title={`${DEFAULT_MASCOT_DISPLAY_NAME}在整理你的命格卡`}
        subtitle='把你的回答整理成专属命格卡，马上揭晓。'
        hint='我会把轮廓、关键词和后面的分享卡一起整理好。'
        xiaoyueExpression={PERSONALITY_TEST_XIAOYUE_EXPRESSION.completing}
        celebrate
        sparkleCount={6}
      />
    )
  }

  // Xiaoyue speech bubble text. Commentary is set immediately from pre-attached
  // per-option data so the user sees tailored feedback without a network round-trip.
  const speechText = backReview.isBackReviewMode
    ? '这是你之前选的答案，可以修改后再确认。'
    : postAnswerCommentary
      ? postAnswerCommentary
      : progress && progress.answered === 4
        ? '已经一半了！你的命格轮廓越来越清晰，继续凭直觉选。'
        : progress && progress.answered === 8
          ? '太棒了！进入精准阶段，接下来的题目会更聚焦，帮你锁定最像自己的氛围命格。'
          : question?.questionText ?? ''

  const isLoadingSpeech = isSubmitting && !postAnswerCommentary

  // Forces a remount (and typing restart) whenever the speech source changes,
  // even if two consecutive questions happen to have identical text.
  const speechKey = backReview.isBackReviewMode
    ? `backreview-${backReview.backReviewQuestion?.id ?? 'none'}`
    : postAnswerCommentary
      ? `commentary-${progress?.answered ?? 0}`
      : `question-${question?.id ?? 'none'}-${progress?.answered ?? 0}`

  return (
    <>
      {/* Asset preloading for mascot expressions */}
      <View className='personality-test__preload-layer' aria-hidden='true'>
        {PRELOAD_EXPRESSIONS.map((expr) => (
          <Image
            key={expr}
            className='personality-test__preload-image'
            src={getXiaoyueExpressionAsset(expr)}
            mode='aspectFit'
            lazyLoad={false}
            aria-hidden='true'
          />
        ))}
      </View>

      {/* ─── Glassmium Question + Mascot Layout ─── */}
      <View className={getPageClassName('personality-test--mascot-layout')}>
        {/* Zone A: Segmented progress bar */}
        <View className='personality-test__progress-bar-shell'>
          <SegmentedProgress
            progress={progressPercent}
            totalSegments={10}
            variant='duolingo'
          />
        </View>
        <View className='personality-test__progress-meta-row'>
          <View className='personality-test__progress-label'>
            <Text className='personality-test__progress-text'>
              已答 {progress?.answered ?? 0} 题 · 还剩约 {progress?.estimatedRemaining ?? 0} 题
            </Text>
          </View>
          {progress && progress.answered >= 1 && (
            <View
              className='personality-test__back-btn personality-test__back-btn--enter'
              hoverClass='personality-test__back-btn--active'
              hoverStartTime={0}
              hoverStayTime={100}
              onClick={() => {
                if (isSubmitting || isSkipping || backReview.isBackReviewMode) return
                handleBack()
              }}
              style={{ opacity: isSubmitting || isSkipping || backReview.isBackReviewMode ? 0.4 : 1 }}
            >
              <Text className='personality-test__back-btn-icon'>←</Text>
              <Text className='personality-test__back-btn-text'>返回</Text>
            </View>
          )}
        </View>

        {/* D3 — Quiz halfway cheer badge (Batch D) — appears at >=50% progress */}
        <HalfwayMilestone
          progressPercent={progressPercent}
          phase={phase}
          answered={progress?.answered ?? 0}
          estimatedTotal={estimatedTotal}
          onMilestoneReached={({ answered, estimatedTotal }) => {
            haptics('medium')
            logInfo('[PersonalityTest] halfway milestone reached', {
              answered,
              estimatedTotal,
            })
            analytics.interaction('personality_test_halfway_milestone_reached', {
              answered,
              estimatedTotal,
            })
          }}
        />

        {/* Zone B: Full-width glassmium question banner */}
        <View className='personality-test__question-zone'>
          {(backReview.isBackReviewMode ? backReview.backReviewQuestion : question) ? (
            <QuestionTransition questionId={(backReview.isBackReviewMode ? backReview.backReviewQuestion! : question!).id}>
              <MascotQuestionHeader
                question={backReview.isBackReviewMode
                  ? {
                      scenarioText: backReview.backReviewQuestion?.scenarioText,
                      questionText: backReview.backReviewQuestion?.questionText ?? '',
                    }
                  : questionStub}
                isLoading={isSubmitting}
              />
            </QuestionTransition>
          ) : null}
        </View>

        {/* Zone C: Mascot + speech bubble row */}
        <View className='personality-test__mascot-zone'>
          {(backReview.isBackReviewMode ? backReview.backReviewQuestion : question) ? (
            (() => {
              const isMilestoneNow = progress ? isMilestoneQuestion(progress.answered) : false
              const resolvedMascotState = resolveMascotState({
                isLoading: isSubmitting,
                isSubmitting,
                questionType: getQuestionType(
                  backReview.isBackReviewMode ? backReview.backReviewQuestion : question,
                ),
                isMilestone: isMilestoneNow && !!postAnswerCommentary,
                isPostAnswerCommentary: !!postAnswerCommentary,
                isCelebration: false,
              })
              return (
            <View className='personality-test__mascot-row'>
              <View className='personality-test__mascot-avatar'>
                <XiaoyueSpriteAnimator
                  state={resolvedMascotState}
                  size='152rpx'
                  isLoading={isSubmitting}
                  showGlow={false}
                  autoPlay={mascotAutoPlay || resolvedMascotState !== 'idle'}
                  transitionMs={0}
                  className='personality-test__mascot-animator'
                />
              </View>
              <View
                className={`personality-test__speech-bubble${!backReview.isBackReviewMode && progress && (progress.answered === 4 || progress.answered === 8) ? ' personality-test__speech-bubble--milestone' : ''}`}
              >
                {isLoadingSpeech ? (
                  <Text className='personality-test__speech-bubble-text'>{speechText}</Text>
                ) : (
                  <TypewriterText
                    key={speechKey}
                    className='personality-test__speech-bubble-text'
                    text={speechText}
                    speed={40}
                    delay={120}
                    showCursor
                    numberOfLines={3}
                  />
                )}
              </View>
            </View>
              )
            })()
          ) : null}
        </View>

        {/* Zone D: Answers */}
        <View className='personality-test__answer-zone'>
          {(backReview.isBackReviewMode ? backReview.backReviewQuestion : question) ? (
            <QuestionTransition questionId={(backReview.isBackReviewMode ? backReview.backReviewQuestion! : question!).id}>
              <PersonalityTestAnswerArea
                questionType={backReview.isBackReviewMode
                  ? getQuestionType(backReview.backReviewQuestion)
                  : questionType}
                options={(backReview.isBackReviewMode ? backReview.backReviewQuestion! : question!).options}
                sliderConfig={(backReview.isBackReviewMode ? backReview.backReviewQuestion! : question!).sliderConfig}
                sliderValue={backReview.isBackReviewMode
                  ? getSliderValueFromPreviousAnswer(
                      backReview.backReviewPreviousAnswer,
                      backReview.backReviewQuestion!.options,
                    )
                  : sliderValue}
                isSubmitting={isSubmitting}
                onAnswer={backReview.isBackReviewMode ? handleBackReviewSelect : handleAnswer}
                onSliderChange={backReview.isBackReviewMode ? handleBackReviewSliderChange : handleSliderChange}
                onSliderSubmit={backReview.isBackReviewMode ? handleBackReviewSliderSubmit : handleSliderSubmit}
                committedValue={backReview.isBackReviewMode ? backReview.backReviewPreviousAnswer : null}
                hideSliderSubmit={backReview.isBackReviewMode}
                onOptionTouchStart={backReview.isBackReviewMode ? undefined : handleOptionTouchStart}
                onOptionTouchEnd={backReview.isBackReviewMode ? undefined : handleOptionTouchEnd}
                onOptionTouchMove={backReview.isBackReviewMode ? undefined : handleOptionTouchMove}
              />
            </QuestionTransition>
          ) : null}

          {/* Echo overlay — renders on top of answer area during submission */}
          {(shouldShowEcho || isEchoExiting) && echoEnabled && (
            <View
              className={`personality-test__answer-echo-overlay${isEchoExiting ? ' personality-test__answer-echo-overlay--exiting' : ''}`}
              aria-live='polite'
              role='status'
              aria-label={`已选择：${lastAttemptedOptionRef.current?.text ?? ''}，正在提交`}
            >
              <View className='personality-test__answer-echo-card'>
                <Text className='personality-test__answer-echo-text' numberOfLines={2}>
                  {lastAttemptedOptionRef.current?.text ?? '处理中…'}
                </Text>
              </View>
              <View className='personality-test__answer-echo-whisper'>
                <View className='personality-test__answer-echo-whisper-line' />
              </View>
              <View className='personality-test__answer-echo-brand-row'>
                <Image
                  className='personality-test__answer-echo-mascot-icon'
                  src={getXiaoyueExpressionAsset(PERSONALITY_TEST_QUESTION_EXPRESSION.loading)}
                  mode='aspectFit'
                  aria-hidden='true'
                />
                <Text className='personality-test__answer-echo-caption'>
                  悦仔收到了，正在分析…
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Back-review actions */}
        {backReview.isBackReviewMode && (
          <View className='personality-test__back-review-actions'>
            <Button
              variant='secondary'
              className='personality-test__back-review-btn personality-test__back-review-btn--cancel'
              onClick={handleCancelBackReview}
              disabled={isSubmitting}
              hoverClass='personality-test__back-review-btn--hover'
            >
              取消
            </Button>
            <Button
              variant='brand'
              className='personality-test__back-review-btn personality-test__back-review-btn--confirm'
              onClick={handleConfirmBackReview}
              disabled={isSubmitting}
              loading={isSubmitting}
              hoverClass='personality-test__back-review-btn--hover'
            >
              {isSubmitting ? '提交中…' : '确认修改'}
            </Button>
          </View>
        )}

        {/* Skip button (normal mode only) */}
        {!backReview.isBackReviewMode && (
          <View className='personality-test__skip-row'>
            {skipsRemaining > 0 ? (
              <View
                className='personality-test__skip-btn personality-test__skip-btn--enter'
                hoverClass='personality-test__skip-btn--active'
                hoverStartTime={0}
                hoverStayTime={100}
                onClick={() => {
                  if (isSubmitting || isSkipping) return
                  handleSkip()
                }}
                style={{ opacity: isSubmitting || isSkipping ? 0.4 : 1 }}
              >
                {isSkipping ? (
                  <View className='personality-test__skip-btn-dots'>
                    <View className='personality-test__skip-btn-dot personality-test__skip-btn-dot--1' />
                    <View className='personality-test__skip-btn-dot personality-test__skip-btn-dot--2' />
                    <View className='personality-test__skip-btn-dot personality-test__skip-btn-dot--3' />
                  </View>
                ) : (
                  <>
                    <Text className='personality-test__skip-btn-icon'>↻</Text>
                    <Text className='personality-test__skip-btn-text'>换一题</Text>
                    <Text className='personality-test__skip-btn-count'>还剩 {skipsRemaining} 次</Text>
                  </>
                )}
              </View>
            ) : (
              <View className='personality-test__skip-hint personality-test__skip-hint--enter'>
                <Text className='personality-test__skip-hint-text'>这些题目都是为你挑选的，试试看～</Text>
                <Text className='personality-test__skip-hint-subtext'>直觉很准，一题都没跳。</Text>
              </View>
            )}
          </View>
        )}

        {error ? (
          <View className='personality-test__error-row'>
            <Text className='personality-test__error'>{error}</Text>
            {lastAttemptedOptionRef.current && !backReview.isBackReviewMode ? (
              <Button
                variant='secondary'
                className='personality-test__retry-btn'
                onClick={handleRetry}
                disabled={isSubmitting}
              >
                重试
              </Button>
            ) : null}
          </View>
        ) : null}
      </View>
    </>
  )
}

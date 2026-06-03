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
import { logInfo, logError } from '../../../lib/utils/logger'
import { haptics } from '../../../lib/utils/haptics'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { cdnAsset } from '../../../lib/utils/cdnAssets'
import type { XiaoyueExpressionId } from '../../../lib/mascot/xiaoyueExpressions'
import type { XiaoyueSpriteState } from '../../../components/mascot/XiaoyueSpriteAnimator'
import { ResponsiveSpacer } from '../../../components/ui/ResponsiveSpacer'
import TypewriterText from '../../../components/ui/TypewriterText'
import MascotQuestionHeader from './MascotQuestionHeader'
import PersonalityTestAnswerArea, { getNearestSliderOption } from './PersonalityTestAnswerArea'
import { isMilestoneQuestion } from './personalityTestLogic'
import QuestionTransition from './QuestionTransition'
import { useBackReview } from './useBackReview'
import {
  getArchetypeVisual,
  getIntroStaticAsset,
  getIntroStaticFallbackAsset,
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
  PERSONALITY_TEST_QUESTION_EXPRESSION,
} from './visuals'
import './index.scss'

type Phase = 'intro' | 'testing' | 'completing'

type AssessmentQuestionType = 'choice' | 'slider' | 'emoji_tap'

interface AssessmentOption {
  value: string
  text: string
  traitScores?: Record<string, number>
  iconAssetKey?: string
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

const INTRO_ARCHETYPE_TEASERS: { archetype: string; vibeLine: string }[] = [
  { archetype: 'corgi', vibeLine: '一进场，就把气氛带热。' },
  { archetype: 'fox', vibeLine: '普通话题，也能聊出火花。' },
  { archetype: 'koala', vibeLine: '会让人慢慢放松下来。' },
]

const INTRO_META_PILLS = ['约 3-5 分钟', '题目跟着你变', '可先完成再登录'] as const

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
  const [postAnswerCommentary, setPostAnswerCommentary] = useState<string | null>(null)
  const [milestonePulse, setMilestonePulse] = useState(false)
  const [introImgSrc, setIntroImgSrc] = useState(getIntroStaticAsset())
  const [skipsRemaining, setSkipsRemaining] = useState(MAX_SKIP_COUNT)
  const [isSkipping, setIsSkipping] = useState(false)

  useResetOnShow(setIsPageExiting, setIsSubmitting, setIsSkipping)

  // Guard against stale async closures hijacking navigation after session change
  const activeSessionRef = useRef<string>('')
  // Remember the last attempted option so we can retry on network failure
  const lastAttemptedOptionRef = useRef<AssessmentOption | null>(null)
  // Track previous question + answer for one-step back
  const previousQuestionRef = useRef<AssessmentQuestion | null>(null)
  const previousAnswerRef = useRef<string | null>(null)
  // Anonymous engine state for client-side back + re-answer
  const anonymousEngineStateRef = useRef<ReturnType<typeof initializeEngineState> | null>(null)

  const backReview = useBackReview()

  const isAuthenticated = auth.isAuthenticated
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

  const getPageClassName = (...extraClasses: string[]) =>
    ['personality-test', ...extraClasses, isPageExiting ? 'personality-test--exiting' : '']
      .filter(Boolean)
      .join(' ')

  const completeAnonymousAssessment = useCallback(async (
    targetSessionId: string,
    nextTopArchetypes?: AnonymousAssessmentTopMatch[] | null,
    finalResult?: AnonymousAssessmentResult | null,
  ) => {
    saveAnonymousAssessmentSession({
      sessionId: targetSessionId,
      phase: 'completed',
      timestamp: Date.now(),
      completedAt: new Date().toISOString(),
      result: finalResult ?? null,
      topArchetypes: nextTopArchetypes ?? currentMatches,
      resultSequenceCompletedAt: undefined,
    })

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

    if (auth.isAuthenticated && auth.nextStep && auth.nextStep !== 'personality-test') {
      void navigateToMiniProgramNextStep(auth.nextStep, {
        mode: 'replace',
        transition: { beforeNavigate: () => setIsPageExiting(true) },
      })
      return
    }

    if (!auth.isAuthenticated && phase === 'intro') {
      const snapshot = readAnonymousAssessmentSession()
      if (isAnonymousAssessmentSessionCompleted(snapshot) || hasAnonymousAssessmentResult(snapshot)) {
        Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.personalityTestResults })
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
          return
        }

        analytics.stepCompleted({
          isAuthenticated: false,
          answerCount: completedAnswerCount,
          destination: MINI_PROGRAM_ROUTES.personalityTestResults,
        })
        anonymousEngineStateRef.current = null
        await completeAnonymousAssessment(result.sessionId, result.currentMatches ?? currentMatches)
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

    // Post-answer commentary will be set from server response below

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

    setIsSubmitting(true)
    setError('')
    try {
      const result = await apiRequest<AssessmentAnswerResponse>({
        path: `/api/assessment/v4/${encodeURIComponent(thisSessionId)}/answer`,
        method: 'POST',
        data: {
          questionId: question.id,
          selectedOption: option.value,
        },
      })

      // Abandon stale async work if session has changed
      if (activeSessionRef.current !== thisSessionId) return

      // Set server-delivered Xiaoyue commentary for the speech bubble
      setPostAnswerCommentary(result.commentary ?? null)

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
        anonymousEngineStateRef.current = null
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
        return
      }

      // Save previous question + answer for one-step back
      previousQuestionRef.current = question
      previousAnswerRef.current = option.value

      // Clear commentary before showing the next question so the speech bubble
      // transitions from feedback back to the new question text
      setPostAnswerCommentary(null)
      setQuestion(result.nextQuestion)
      setProgress(result.progress ?? null)
      setCurrentMatches(result.currentMatches ?? [])
      setSliderValue(50)
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

  // When submitting ends while sprite is in 'thinking', return to idle
  useEffect(() => {
    if (!isSubmitting) {
      setSpriteState((prev) => (prev === 'thinking' ? 'idle' : prev))
    }
  }, [isSubmitting])

  const handleBack = useCallback(() => {
    if (!previousQuestionRef.current || !previousAnswerRef.current) return
    haptics('light')
    analytics.interaction('personality_test_back_used', {
      questionIndex: progress?.answered ?? 0,
      sessionId: sessionId || 'anonymous',
    })
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
              <Image
                className='personality-test__mascot-static personality-test__mascot-static--intro'
                src={introImgSrc}
                mode='aspectFit'
                lazyLoad={false}
                onError={() => {
                  // Fallback already loaded locally; this shouldn't trigger
                  console.warn('[PersonalityTest] Intro mascot failed to load')
                }}
              />
              <Image
                className='personality-test__mascot-static personality-test__mascot-static--intro personality-test__mascot-static--reduced-motion'
                src={getIntroStaticFallbackAsset()}
                mode='aspectFit'
                lazyLoad={false}
              />
            </View>

            <View className='personality-test__intro-bubble'>
              <Text className='personality-test__intro-bubble-title'>这一步会带给你什么</Text>
              <Text className='personality-test__intro-bubble-text'>{introCoachLine}</Text>
            </View>

            <View className='personality-test__intro-meta-row'>
              {INTRO_META_PILLS.map((item) => (
                <View key={item} className='personality-test__intro-meta-pill'>
                  <Text className='personality-test__intro-meta-pill-text'>{item}</Text>
                </View>
              ))}
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
    return (
      <OnboardingLoadingShell
        stepLabel='氛围命格'
        title={`${DEFAULT_MASCOT_DISPLAY_NAME}在整理你的命格卡`}
        subtitle='把你的回答整理成专属命格卡，马上揭晓。'
        hint='我会把轮廓、关键词和后面的分享卡一起整理好。'
        xiaoyueExpression={PERSONALITY_TEST_XIAOYUE_EXPRESSION.completing}
      />
    )
  }

  const speechText = backReview.isBackReviewMode
    ? '这是你之前选的答案，可以修改后再确认。'
    : isSubmitting && spriteState === 'thinking'
      ? '悦仔正在分析你的选择…'
      : postAnswerCommentary
        ? postAnswerCommentary
        : isSubmitting
          ? '收到～'
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
              className='personality-test__back-btn'
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
            <View className='personality-test__mascot-row'>
              <View className='personality-test__mascot-avatar'>
                <Image
                  className='personality-test__mascot-static personality-test__mascot-static--testing'
                  src={cdnAsset('/assets/mascot/xiaoyue-welcome.webp')}
                  mode='aspectFit'
                />
                <Image
                  className='personality-test__mascot-static personality-test__mascot-static--testing personality-test__mascot-static--reduced-motion'
                  src={cdnAsset('/assets/mascot/xiaoyue-welcome.webp')}
                  mode='aspectFit'
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
                  />
                )}
              </View>
            </View>
          ) : null}
        </View>

        {/* Zone D: Answers */}
        <View className='personality-test__answer-zone'>
          {isSubmitting ? (
            <View className='personality-test__skeleton'>
              <View className='personality-test__skeleton-scenario' />
              <View className='personality-test__skeleton-question' />
              <View className='personality-test__skeleton-options'>
                <View className='personality-test__skeleton-option' />
                <View className='personality-test__skeleton-option' />
                <View className='personality-test__skeleton-option' />
              </View>
            </View>
          ) : (backReview.isBackReviewMode ? backReview.backReviewQuestion : question) ? (
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
                onSliderChange={backReview.isBackReviewMode ? handleBackReviewSliderChange : setSliderValue}
                onSliderSubmit={backReview.isBackReviewMode ? handleBackReviewSliderSubmit : handleSliderSubmit}
                committedValue={backReview.isBackReviewMode ? backReview.backReviewPreviousAnswer : null}
                hideSliderSubmit={backReview.isBackReviewMode}
              />
            </QuestionTransition>
          ) : null}
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
        {!backReview.isBackReviewMode && skipsRemaining > 0 && (
          <View className='personality-test__skip-row'>
            <View
              className='personality-test__skip-btn'
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
          </View>
        )}

        {error ? (
          <View className='personality-test__error-row'>
            <Text className='personality-test__error'>{error}</Text>
            {lastAttemptedOptionRef.current ? (
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

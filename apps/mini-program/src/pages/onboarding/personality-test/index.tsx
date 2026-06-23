import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
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
import OnboardingLoadingShell from '../../../components/loading/OnboardingLoadingShell'
import type { XiaoyueSpriteState } from '../../../components/mascot/XiaoyueSpriteAnimator'
import { useAuth } from '../../../hooks/useAuth'
import { apiRequest } from '../../../lib/api/api'
import { useOnboardingAnalytics } from '../../../hooks/onboarding/useOnboardingAnalytics'
import { useOnboardingCheckpoint } from '../../../hooks/onboarding/useOnboardingCheckpoint'
import {
  clearAnonymousAssessmentStorage,
  hasAnonymousAssessmentResult,
  isAnonymousAssessmentSessionCompleted,
  readAnonymousAssessmentSession,
  readAnonymousAssessmentAnswers,
  readAnonymousAssessmentSkipped,
  saveAnonymousAssessmentSession,
  saveAnonymousAssessmentSkipped,
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
import { isMilestoneQuestion, resolveOptionPreviewSpriteState } from './personalityTestLogic'
import { triggerXiaoyueAnalysisPrefetch } from './triggerXiaoyueAnalysisPrefetch'
import { useBackReview } from './useBackReview'
import PersonalityTestIntro from './PersonalityTestIntro'
import PersonalityTestQuestion from './PersonalityTestQuestion'
import { getNearestSliderOption } from './PersonalityTestAnswerArea'
import PersonalityTestPreloadLayer from './PersonalityTestPreloadLayer'
import PersonalityTestCompletingError from './PersonalityTestCompletingError'
import {
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
  ASSET_BASE_WEBP_LOCAL,
} from './visuals'
import { preloadImagesWithDiagnostics } from '../../../lib/utils/imagePreload'
import { preloadRouteAssets } from '../../../lib/utils/routePreloadAssets'
import './index.scss'
import type {
  Phase,
  AssessmentQuestion,
  AssessmentOption,
  AssessmentProgress,
  AssessmentMatch,
} from './types'

export type { AssessmentQuestion, AssessmentOption, AssessmentProgress, AssessmentMatch } from './types'

function buildAnonymousEngineState(
  answers: ReturnType<typeof readAnonymousAssessmentAnswers>,
  skippedQuestionIds: string[] = [],
  skipCount?: number,
) {
  let engineState = initializeEngineState()
  for (const ans of answers) {
    const q = questionsV4.find((quest) => quest.id === ans.questionId)
    if (q) {
      engineState = processAnswer(engineState, q, ans.selectedOption)
    }
  }
  for (const skippedId of skippedQuestionIds) {
    engineState.skippedQuestionIds.add(skippedId)
  }
  engineState.skipCount = skipCount ?? skippedQuestionIds.length
  return engineState
}

interface AssessmentStartResponse {
  sessionId: string
  phase: string
  nextQuestion: AssessmentQuestion | null
  progress: AssessmentProgress
  currentMatches: AssessmentMatch[]
  isComplete: boolean
  /** Server-computed final result (present when isComplete === true). */
  result?: AnonymousAssessmentResult
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

export default function PersonalityTestPage() {
  const auth = useAuth()
  const router = useRouter()
  const isProfileSocialTypeEntry = router.params.source === 'profile'
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
  const echoExitFiredRef = useRef(false)
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
  // Holds the server-completed result until the celebrate animation finishes.
  // Navigation is gated by OnboardingLoadingShell's onCelebrateReady so the
  // user sees the full completion beat before the slot/result page appears.
  const pendingCompletionRef = useRef<{
    sessionId: string
    topArchetypes?: AnonymousAssessmentTopMatch[] | null
    finalResult?: AnonymousAssessmentResult | null
  } | null>(null)
  const completionNavigationRef = useRef(false)
  const backReview = useBackReview()

  const isAuthenticated = auth.isAuthenticated

  // Mirror auth state in a ref so the celebrate-ready closure always reads the
  // latest value even if AutoLoginBridge flips it mid-animation.
  const isAuthenticatedRef = useRef(isAuthenticated)
  isAuthenticatedRef.current = isAuthenticated

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

  const estimatedTotal = progress
    ? progress.answered + Math.max(progress.estimatedRemaining, 1)
    : 1
  const progressPercent = progress
    ? Math.round((progress.answered / Math.max(estimatedTotal, 1)) * 100)
    : 0

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

  const handleCelebrateReady = useCallback(async () => {
    if (completionNavigationRef.current) return
    const pending = pendingCompletionRef.current
    if (!pending) return
    completionNavigationRef.current = true
    pendingCompletionRef.current = null

    try {
      // Do not invalidate auth before redirecting. That refresh can activate
      // the page-level auth redirect while the result redirect is in flight.
      if (isAuthenticatedRef.current) {
        await saveCheckpoint('personality-test')
      }

      await completeAnonymousAssessment(pending.sessionId, pending.topArchetypes, pending.finalResult)
      anonymousEngineStateRef.current = null
    } catch (err) {
      completionNavigationRef.current = false
      pendingCompletionRef.current = pending
      setIsPageExiting(false)
      setError('结果页打开失败，请点一下重试')
      logError('[PersonalityTest] Celebrate handoff failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }, [completeAnonymousAssessment, saveCheckpoint])

  /** Hard guard: refuse to transition if the server returned an incomplete or invalid finalResult. */
  function isValidFinalResult(result: AnonymousAssessmentResult | undefined): boolean {
    if (!result) return false
    const primary = result.primaryArchetype
    if (!primary || typeof primary !== 'string') return false
    return !!ARCHETYPE_BY_ID[primary]
  }

  useEffect(() => {
    if (auth.isLoading || isSubmitting || isPageExiting || phase === 'completing') {
      return
    }

    // If user already has an archetype, they should never be on the test page
    // if (auth.user?.primaryArchetype) {
    //   Taro.switchTab({ url: MINI_PROGRAM_ROUTES.discover }).catch((err: unknown) => {
    //     logError('[PersonalityTest] switchTab failed', { err: err instanceof Error ? err.message : String(err) })
    //   })
    //   return
    // }
    const existingArchetype = auth.user?.primaryArchetype ?? auth.user?.archetype ?? null

    if (existingArchetype) {
      Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.personalityTestResults }).catch((err: unknown) => {
        logError('[PersonalityTest] redirectTo results failed', {
          err: err instanceof Error ? err.message : String(err),
        })
      })
      return
    }

    // if (auth.isAuthenticated && auth.nextStep && auth.nextStep !== 'personality-test' && auth.nextStep !== 'onboarding') {
    if (
      auth.isAuthenticated &&
      !isProfileSocialTypeEntry &&
      auth.nextStep &&
      auth.nextStep !== 'personality-test' &&
      auth.nextStep !== 'onboarding'
    ) {  
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
  }, [auth.isAuthenticated, auth.isLoading, auth.nextStep, isPageExiting, isSubmitting, isProfileSocialTypeEntry,phase])

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

        // Initialize anonymous engine state from stored answers + skipped questions
        const storedAnswers = readAnonymousAssessmentAnswers()
        const skippedState = readAnonymousAssessmentSkipped()
        const engineState = buildAnonymousEngineState(
          storedAnswers,
          skippedState.skippedQuestionIds,
          skippedState.skipCount,
        )
        anonymousEngineStateRef.current = engineState
        setSkipsRemaining(MAX_SKIP_COUNT - engineState.skipCount)
      }

      if (result.isComplete || !result.nextQuestion) {
        const completedAnswerCount = result.progress?.answered ?? 0

        if (!isValidFinalResult(result.result)) {
          setIsPageExiting(false)
          setError('结果同步出了点小问题，请重试一次')
          analytics.errorOccurred('invalid_final_result', 'primaryArchetype missing or invalid')
          logError('[PersonalityTest] Invalid finalResult from server on start', {
            sessionId: result.sessionId,
            result: result.result,
          })
          return
        }

        // P0-3: prefetch the Xiaoyue AI analysis so the result page lands
        // on a populated analysis instead of a 400ms skeleton.
        if (result.result && result.result.primaryArchetype) {
          triggerXiaoyueAnalysisPrefetch(result.result, result.currentMatches ?? currentMatches)
        }

        analytics.stepCompleted({
          isAuthenticated,
          answerCount: completedAnswerCount,
          destination: MINI_PROGRAM_ROUTES.personalityTestResults,
        })

        // Stash the completed result and show the celebration shell. Navigation
        // to the slot/result page is gated by onCelebrateReady so the user sees
        // the full completion beat, and *all* users (guests + authenticated)
        // go through the result page rather than skipping straight to nextStep.
        pendingCompletionRef.current = {
          sessionId: result.sessionId,
          topArchetypes: result.currentMatches ?? currentMatches,
          finalResult: result.result,
        }
        setPhase('completing')
        return
      }

      setPhase('testing')
    } catch (err) {
      setIsPageExiting(false)
      const rawMessage = err instanceof Error ? err.message : String(err)
      const message = getErrorMessage('load-failed')
      setError(message)
      analytics.errorOccurred('start_failed', rawMessage)
      logError('[PersonalityTest] Failed to start', { rawMessage, userMessage: message })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    analytics,
    currentMatches,
    isAuthenticated,
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

        analytics.stepCompleted({
          isAuthenticated,
          answerCount: completedAnswerCount,
          destination: MINI_PROGRAM_ROUTES.personalityTestResults,
        })

        // Stash the completed result and show the celebration shell. Navigation
        // to the slot/result page is gated by onCelebrateReady so the user sees
        // the full completion beat, and *all* users (guests + authenticated)
        // go through the result page rather than skipping straight to nextStep.
        pendingCompletionRef.current = {
          sessionId: thisSessionId,
          topArchetypes: result.currentMatches ?? currentMatches,
          finalResult: result.result,
        }
        setPhase('completing')
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
      const rawMessage = err instanceof Error ? err.message : String(err)
      const message = getErrorMessage('submit-failed')
      setError(message)
      analytics.errorOccurred('answer_failed', rawMessage)
      logError('[PersonalityTest] Failed to submit answer', { rawMessage, userMessage: message })
      setSpriteState('idle')
    } finally {
      setIsSubmitting(false)
    }
  }, [
    analytics,
    currentMatches,
    isAuthenticated,
    isSubmitting,
    progress,
    question,
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
      echoExitFiredRef.current = false
      setIsEchoExiting(false)
    } else if (!shouldShowEcho && !isEchoExiting && !echoExitFiredRef.current) {
      // Just stopped submitting — start exit animation, then apply the pending
      // question update. echoExitFiredRef prevents re-entering this block after
      // the timer fires (when isEchoExiting resets to false), which would create
      // an infinite 220ms echo-show/echo-hide loop.
      echoExitFiredRef.current = true
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

      // Rebuild engine state, restoring any questions the user previously skipped
      const skippedState = readAnonymousAssessmentSkipped()
      const engineState = buildAnonymousEngineState(
        nextAnswers,
        skippedState.skippedQuestionIds,
        skippedState.skipCount,
      )
      anonymousEngineStateRef.current = engineState

      const nextQuestion = selectNextQuestion(engineState)
      if (!nextQuestion) {
        analytics.stepCompleted({
          isAuthenticated: false,
          answerCount: engineState.answeredQuestionIds.size,
          destination: MINI_PROGRAM_ROUTES.personalityTestResults,
        })

        // Stash the client-side completion and show the celebration shell.
        // Navigation is gated by onCelebrateReady so the slot/result page does
        // not cut the celebration short.
        pendingCompletionRef.current = {
          sessionId: sessionId || 'anonymous-client',
          topArchetypes: engineState.currentMatches.slice(0, 3),
          finalResult: null,
        }
        setPhase('completing')
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
      const rawMessage = err instanceof Error ? err.message : String(err)
      const message = getErrorMessage('submit-failed')
      setError(message)
      analytics.errorOccurred('back_review_confirm_failed', rawMessage)
      logError('[PersonalityTest] Failed to confirm back review', { rawMessage, userMessage: message })
      // Stay in back-review mode for retry (REL-02)
    } finally {
      setIsSubmitting(false)
    }
  }, [analytics, backReview, isAuthenticated, question, sessionId])

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

      if (!isAuthenticated) {
        // Keep local anonymous engine/storage in sync for back-review and reloads.
        // The server is the source of truth for the next question; we mirror the
        // skip locally so back/forward navigation doesn't resurrect skipped IDs.
        const engineState = anonymousEngineStateRef.current || initializeEngineState()
        const skipResult = skipQuestion(engineState, question.id)
        if (skipResult) {
          anonymousEngineStateRef.current = skipResult.newState
          const skippedState = readAnonymousAssessmentSkipped()
          const nextSkippedIds = Array.from(
            new Set([...skippedState.skippedQuestionIds, question.id]),
          )
          saveAnonymousAssessmentSkipped(nextSkippedIds, skipResult.newState.skipCount)
        }
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
      <PersonalityTestIntro
        isPageExiting={isPageExiting}
        isDegradation={isDegradation}
        isSubmitting={isSubmitting}
        error={error}
        hasStoredIncompleteSession={hasStoredIncompleteSession}
        introImgError={introImgError}
        introImgLoaded={introImgLoaded}
        introReducedMotion={introReducedMotion}
        onStart={handleStart}
        onIntroImgLoad={() => setIntroImgLoaded(true)}
        onIntroImgError={() => setIntroImgError(true)}
      />
    )
  }

  // Completing phase
  if (phase === 'completing') {
    if (error) {
      return (
        <PersonalityTestCompletingError
          error={error}
          onRetry={() => {
            haptics('medium')
            setError('')
            void handleCelebrateReady()
          }}
        />
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
        onCelebrateReady={handleCelebrateReady}
      />
    )
  }


  // Testing phase
  if (phase === 'testing') {
    return (
      <>
        <PersonalityTestPreloadLayer />
        <PersonalityTestQuestion
          isPageExiting={isPageExiting}
          isDegradation={isDegradation}
          phase={phase}
          question={question}
          progress={progress}
          estimatedTotal={estimatedTotal}
          progressPercent={progressPercent}
          currentMatches={currentMatches}
          sliderValue={sliderValue}
          isSubmitting={isSubmitting}
          isSkipping={isSkipping}
          skipsRemaining={skipsRemaining}
          error={error}
          spriteState={spriteState}
          mascotAutoPlay={mascotAutoPlay}
          postAnswerCommentary={postAnswerCommentary}
          shouldShowEcho={shouldShowEcho}
          isEchoExiting={isEchoExiting}
          echoEnabled={echoEnabled}
          lastAttemptedOptionRef={lastAttemptedOptionRef}
          backReview={backReview}
          onAnswer={handleAnswer}
          onSliderChange={handleSliderChange}
          onSliderSubmit={handleSliderSubmit}
          onBack={handleBack}
          onSkip={handleSkip}
          onRetry={handleRetry}
          onBackReviewSelect={handleBackReviewSelect}
          onBackReviewSliderChange={handleBackReviewSliderChange}
          onBackReviewSliderSubmit={handleBackReviewSliderSubmit}
          onCancelBackReview={handleCancelBackReview}
          onConfirmBackReview={handleConfirmBackReview}
          onMilestoneReached={({ answered, estimatedTotal: total }) => {
            haptics('medium')
            logInfo('[PersonalityTest] halfway milestone reached', {
              answered,
              estimatedTotal: total,
            })
            analytics.interaction('personality_test_halfway_milestone_reached', {
              answered,
              estimatedTotal: total,
            })
          }}
        />
      </>
    )
  }

  return null
}

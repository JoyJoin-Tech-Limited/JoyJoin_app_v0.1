import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { getErrorForSurface, ONBOARDING_ERROR_STAGE_COPY } from '@shared/copy/errorBaselines'
import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
  skipQuestion,
  MAX_SKIP_COUNT,
} from '@shared/personality/adaptiveEngine'
import { questionsV4 } from '@shared/personality/questionsV4'
import OnboardingLoadingShell from '../../../components/loading/OnboardingLoadingShell'
import { useAuth } from '../../../hooks/useAuth'
import { apiRequest } from '../../../lib/api/api'
import { useOnboardingAnalytics } from '../../../hooks/onboarding/useOnboardingAnalytics'
import { useStepAbandonGuard } from '../../../hooks/onboarding/useStepAbandonGuard'
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
import { discoverAnalytics } from '../../../lib/analytics/discoverAnalytics'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import { triggerXiaoyueAnalysisPrefetch } from './triggerXiaoyueAnalysisPrefetch'
import PersonalityTestIntro from './PersonalityTestIntro'
import PersonalityTestQuestion from './PersonalityTestQuestion'
import { getNearestSliderOption } from './PersonalityTestAnswerArea'
import PersonalityTestPreloadLayer from './PersonalityTestPreloadLayer'
import PersonalityTestCompletingError from './PersonalityTestCompletingError'
import {
  getArchetypeSpritesheetLocalPath,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
} from './visuals'
import { useSpeculativeStart } from './useSpeculativeStart'
import { computeAutoAdvanceDelayMs } from './autoAdvance'
import { resolveIdleWhisper } from './idleWhispers'
import { preloadRouteAssets } from '../../../lib/utils/routePreloadAssets'
import './index.scss'
import type {
  Phase,
  AssessmentQuestion,
  AssessmentOption,
  AssessmentProgress,
  AssessmentMatch,
  AssessmentStartResponse,
} from './types'
import { getSystemReducedMotionCompat } from '../../../lib/utils/systemInfo'

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
const COMMENTARY_MIN_DISPLAY_MS = 900

// Completing celebration hold (2026-09-02): the completing shell is now
// self-sufficient — the results page no longer continues the beat via a
// `?celebrate=1` bridge (removed; a 200ms keyed crossfade covers the
// LoadingStage → slot handoff instead), so the shell holds long enough to
// read as a complete celebration on its own.
const COMPLETING_CELEBRATE_MIN_MS = 1100

// Minimum answered questions before a mid-test Xiaoyue prefetch fires. The
// server re-derives the profile from the session, so this only controls how
// early the speculative LLM generation starts.
const MID_TEST_PREFETCH_MIN_ANSWERS = 8
// Mid-test prefetch throttle: refire only when the top archetype changed or
// this much time has elapsed since the last attempt.
const MID_TEST_PREFETCH_THROTTLE_MS = 30_000

export default function PersonalityTestPage() {
  const auth = useAuth()
  const router = useRouter()
  const isProfileSocialTypeEntry = router.params.source === 'profile'
  // allow restart mode for the authenticated user result state
  const isRestartEntry = router.params.mode === 'restart'
  const { saveCheckpoint } = useOnboardingCheckpoint()

  const [phase, setPhase] = useState<Phase>('intro')
  const [sessionId, setSessionId] = useState('')
  const [question, setQuestion] = useState<AssessmentQuestion | null>(null)
  const [progress, setProgress] = useState<AssessmentProgress | null>(null)
  const [currentMatches, setCurrentMatches] = useState<AssessmentMatch[]>([])
  const [sliderValue, setSliderValue] = useState(50)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPageExiting, setIsPageExiting] = useState(false)
  // Exit modifier passed to child surfaces: personality-test--exiting
  const [error, setError] = useState('')
  const [postAnswerCommentary, setPostAnswerCommentary] = useState<string | null>(null)
  const commentaryReceivedAtRef = useRef<number>(0)
  // Per-question analytics (PR-2): questionShownAtRef measures answer dwell;
  // lastTrackedQuestionRef dedupes the per-mount stepEnter ('q<N>' sub-step).
  const questionShownAtRef = useRef<number>(0)
  const lastTrackedQuestionRef = useRef<string | null>(null)
  // True once the user drags the slider on the current question — gates 下一题
  // so an untouched slider can't silently submit the default 50.
  const [hasSliderInteracted, setHasSliderInteracted] = useState(false)

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
    // The hidden <Image> in PersonalityTestPreloadLayer warms the webview
    // cache for the slot spritesheet. No getImageInfo call needed — it cannot
    // resolve bundled subpackage paths in the WeChat runtime and produces
    // "image not found" errors in vConsole (2026-09-03).
  }, [])

  // Detect reduced-motion preference once for the intro mascot
  useEffect(() => {
    try {
      setIntroReducedMotion(getSystemReducedMotionCompat())
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

  // PR-4 single-tap submit + guarded auto-advance: while the commentary
  // guard window runs, the next question sits in pendingQuestionUpdateRef and
  // isAdvancePending keeps 下一题 live for immediate manual advance.
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commentaryTypingDoneAtRef = useRef<number>(0)
  const advanceAsapRef = useRef(false)
  const [isAdvancePending, setIsAdvancePending] = useState(false)
  const [typingDoneTick, setTypingDoneTick] = useState(0)

  // Guard against stale async closures hijacking navigation after session change
  const activeSessionRef = useRef<string>('')
  // Remember the last attempted option so we can retry on network failure
  const lastAttemptedOptionRef = useRef<AssessmentOption | null>(null)
  // Track question history for multi-step back review
  const questionHistoryRef = useRef<Array<{question: AssessmentQuestion; answer: string}>>([])
  // Anonymous engine state for client-side back + re-answer
  const anonymousEngineStateRef = useRef<ReturnType<typeof initializeEngineState> | null>(null)
  // Mid-test Xiaoyue prefetch throttle state
  const lastMidTestPrefetchAtRef = useRef(0)
  const lastMidTestPrefetchArchetypeRef = useRef<string | null>(null)
  // Pending question update: hold next-question data until echo exit completes
  // so the user never sees new question text + old answer echo simultaneously.
  const pendingQuestionUpdateRef = useRef<{
    question: AssessmentQuestion | null
    progress: AssessmentProgress | null
    matches: AssessmentMatch[]
  } | null>(null)
  // Holds the server-completed result until the celebrate animation finishes.
  // Navigation is gated by OnboardingLoadingShell's onCelebrateReady so the
  // user sees the full completion beat before the slot/result page appears.
  const pendingCompletionRef = useRef<{
    sessionId: string
    topArchetypes?: AnonymousAssessmentTopMatch[] | null
    finalResult?: AnonymousAssessmentResult | null
  } | null>(null)
  const completionNavigationRef = useRef(false)
  const [currentSelection, setCurrentSelection] = useState<AssessmentOption | null>(null)
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1)
  const liveQuestionSnapshotRef = useRef<{
    question: AssessmentQuestion | null
    progress: AssessmentProgress | null
    matches: AssessmentMatch[]
  } | null>(null)

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

  // Speculative /start prefire (PR-3): the intro phase is a forced-dwell
  // surface, so the session-establishing round trip starts before the 开始测试
  // tap. Skipped when a resumable anonymous session exists (resume returns
  // instantly) or a session is already in flight/established.
  const { speculativeStartRef, fireSpeculativeStart } = useSpeculativeStart()
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const canUseSpeculativeResult = useCallback(
    () => phaseRef.current === 'intro' && activeSessionRef.current === '',
    [],
  )
  useEffect(() => {
    if (phase !== 'intro' || auth.isLoading || hasStoredIncompleteSession || sessionId) return
    fireSpeculativeStart(canUseSpeculativeResult)
  }, [phase, auth.isLoading, hasStoredIncompleteSession, sessionId, fireSpeculativeStart, canUseSpeculativeResult])

  const analytics = useOnboardingAnalytics('personality-test', {
    enabled:
      !auth.isLoading && (!auth.isAuthenticated || auth.nextStep === 'personality-test'),
    startMetadata: {
      isAuthenticated,
      entryMode: hasStoredIncompleteSession ? 'resume' : 'fresh',
    },
  })

  // Intro funnel head (2026-09-02): onboarding_intro_viewed fires once per
  // intro entry so the 12-icon-strip change is measurable against the
  // pre-strip baseline; personality_test_started fires on the CTA tap
  // (handleStart). Fail-open fire-and-forget via discoverAnalytics.
  const introViewTrackedRef = useRef(false)
  useEffect(() => {
    if (phase !== 'intro' || auth.isLoading || introViewTrackedRef.current) return
    introViewTrackedRef.current = true
    discoverAnalytics.track('onboarding_intro_viewed', undefined, {
      entryMode: hasStoredIncompleteSession ? 'resume' : 'fresh',
    })
  }, [phase, auth.isLoading, hasStoredIncompleteSession])

  // R1-3 funnel: mid-test exit (swipe-back / forward nav / app background /
  // unload) fires step_abandoned once per visit; completion marks the guard
  // so the results-page navigation never false-positives.
  const { markCompleted: markTestCompleted } = useStepAbandonGuard(() => {
    if (auth.isLoading) return
    if (auth.isAuthenticated && auth.nextStep !== 'personality-test') return
    if (phase !== 'intro' && phase !== 'testing') return
    analytics.stepAbandoned('exit', {
      phase,
      answeredCount: progress?.answered ?? 0,
    })
  })

  // PR-2: per-question funnel events. Each live question mount fires a
  // sub-step stepEnter ('q<N>', stepIndex = answered count) so the funnel can
  // resolve per-question drop-off + dwell. History back-review mounts are
  // excluded (currentHistoryIndex >= 0) — they are not fresh progress.
  useEffect(() => {
    if (phase !== 'testing' || !question || currentHistoryIndex >= 0) return
    questionShownAtRef.current = Date.now()
    if (lastTrackedQuestionRef.current === question.id) return
    lastTrackedQuestionRef.current = question.id
    analytics.stepEnter({
      stepId: `q${progress?.answered ?? 0}`,
      stepIndex: progress?.answered ?? 0,
      questionType: question.questionType,
    })
  }, [analytics, currentHistoryIndex, phase, progress?.answered, question])

  const estimatedTotal = progress
    ? progress.answered + Math.max(progress.estimatedRemaining, 1)
    : 1
  const progressPercent = progress
    ? Math.round((progress.answered / Math.max(estimatedTotal, 1)) * 100)
    : 0

  // WS-1 idle whisper (2026-09-02): per-question mascot line shown on
  // question entry, replaced by the per-option commentary after an answer.
  // Pure derivation — never written into postAnswerCommentary, so the
  // commentary bookkeeping (commentaryReceivedAtRef /
  // commentaryTypingDoneAtRef) and the echo-overlay guard stay untouched.
  // Suppressed entirely in back-review.
  const idleWhisperText = useMemo(() => {
    if (!question || currentHistoryIndex >= 0) return null
    return resolveIdleWhisper(question)
  }, [question, currentHistoryIndex])

  const lastWhisperShownRef = useRef<string | null>(null)
  useEffect(() => {
    if (!idleWhisperText || !question) return
    if (lastWhisperShownRef.current === question.id) return
    lastWhisperShownRef.current = question.id
    analytics.interaction('idle_whisper_shown', {
      questionId: question.id,
      questionIndex: progress?.answered ?? 0,
    })
  }, [analytics, idleWhisperText, question, progress?.answered])

  const handleIdleWhisperTap = useCallback(() => {
    if (!question) return
    haptics('light')
    analytics.interaction('idle_whisper_tap', {
      questionId: question.id,
      questionIndex: progress?.answered ?? 0,
    })
  }, [analytics, question, progress?.answered])

  const { isDegradation } = useDeviceTier()

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

    // Result-page image warm-up is owned by the results page mount preload
    // (results/index.tsx), which also covers direct entry — no duplicate here.

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
      setError(ONBOARDING_ERROR_STAGE_COPY.completingError.handoffFailedBody)
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
    const existingArchetype = auth.user?.primaryArchetype ?? auth.user?.archetype ?? null

    if (existingArchetype && ! isRestartEntry) {
      Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.personalityTestResults }).catch((err: unknown) => {
        logError('[PersonalityTest] redirectTo results failed', {
          err: err instanceof Error ? err.message : String(err),
        })
      })
      return
    }

    if (
      auth.isAuthenticated &&
      !isProfileSocialTypeEntry &&
      !isRestartEntry &&
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
  }, [auth.isAuthenticated, auth.isLoading, auth.nextStep, auth.user?.archetype, auth.user?.primaryArchetype, isPageExiting, isSubmitting, isProfileSocialTypeEntry, isRestartEntry,phase])

  const handleStart = useCallback(async () => {
    haptics('medium')
    discoverAnalytics.track('personality_test_started', undefined, {
      entryMode: hasStoredIncompleteSession ? 'resume' : 'fresh',
    })
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

      // PR-3 speculative prefire: adopt the session established during the
      // intro dwell when ready; if it is still in flight, await its promise
      // (the button spinner already covers the wait); if it failed or never
      // fired, fall back to today's POST. Any prefired sessionId rides in the
      // fallback body so the server reuses that session via its
      // resume-by-sessionId path instead of double-creating a guest session.
      // The adopted payload flows through the exact same state setup and
      // isValidFinalResult guard below as a fresh /start response.
      const speculative = speculativeStartRef.current
      let result: AssessmentStartResponse | null = null
      if (!shouldResumeAnonymous && speculative.status === 'ready' && speculative.payload) {
        result = speculative.payload
      } else if (!shouldResumeAnonymous && speculative.status === 'pending' && speculative.promise) {
        result = await speculative.promise.catch(() => null)
      }
      const prefiredSessionId = speculative.sessionId ?? speculative.payload?.sessionId
      speculativeStartRef.current = { status: 'idle' }
      if (!result) {
        result = await apiRequest<AssessmentStartResponse>({
          path: '/api/assessment/v4/start',
          method: 'POST',
          data: shouldResumeAnonymous
            ? { sessionId: snapshot?.sessionId }
            : prefiredSessionId
              ? { sessionId: prefiredSessionId }
              : {},
        })
      }

      activeSessionRef.current = result.sessionId
      setSessionId(result.sessionId)
      setQuestion(result.nextQuestion)
      setProgress(result.progress)
      setCurrentMatches(result.currentMatches ?? [])
      setSliderValue(50)
      setHasSliderInteracted(false)

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
          setError(ONBOARDING_ERROR_STAGE_COPY.completingError.syncFailedBody)
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
        markTestCompleted()
        setPhase('completing')
        return
      }

      // Defensive: a fresh (re)start must not inherit a held next-question
      // payload from a previous run of this page instance.
      pendingQuestionUpdateRef.current = null
      setIsAdvancePending(false)
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current)
        autoAdvanceTimerRef.current = null
      }
      advanceAsapRef.current = false
      setPhase('testing')
    } catch (err) {
      setIsPageExiting(false)
      const rawMessage = err instanceof Error ? err.message : String(err)
      const message = getErrorForSurface('load-failed', 'inline-error')
      setError(message)
      analytics.errorOccurred('start_failed', rawMessage)
      logError('[PersonalityTest] Failed to start', { rawMessage, userMessage: message })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    analytics,
    currentMatches,
    hasStoredIncompleteSession,
    isAuthenticated,
    markTestCompleted,
  ])

  const cancelAutoAdvance = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current)
      autoAdvanceTimerRef.current = null
    }
    advanceAsapRef.current = false
  }, [])

  // Applies the held next-question payload (PR-4). `reason` feeds the
  // commentary read-through guardrail metrics: dwell below the estimated
  // read time means the advance cut the commentary short.
  const applyPendingQuestionUpdate = useCallback((reason: 'auto' | 'manual') => {
    const pending = pendingQuestionUpdateRef.current
    if (!pending) return
    cancelAutoAdvance()
    if (postAnswerCommentary && commentaryReceivedAtRef.current > 0) {
      const estimatedReadMs = 120 + postAnswerCommentary.length * 40
      const commentaryDwellMs = Math.max(0, Date.now() - commentaryReceivedAtRef.current)
      analytics.interaction(
        commentaryDwellMs >= estimatedReadMs ? 'commentary_read_complete' : 'commentary_cut_short',
        {
          questionIndex: progress?.answered ?? 0,
          dwellMs: commentaryDwellMs,
          estimatedReadMs,
        },
      )
      if (reason === 'auto') {
        analytics.interaction('auto_advance_fired', {
          questionIndex: progress?.answered ?? 0,
        })
      }
    }
    setPostAnswerCommentary(null)
    setQuestion(pending.question)
    setProgress(pending.progress)
    setCurrentMatches(pending.matches)
    setCurrentSelection(null)
    setSliderValue(50)
    setHasSliderInteracted(false)
    pendingQuestionUpdateRef.current = null
    setIsAdvancePending(false)
  }, [analytics, cancelAutoAdvance, postAnswerCommentary, progress])

  const submitAnswer = useCallback(async (option: AssessmentOption) => {
    if (!sessionId || !question || isSubmitting) return

    // PR-2: answer-submit telemetry — per-question dwell. Commentary
    // read-through (commentary_read_complete / commentary_cut_short) is
    // measured at advance time (applyPendingQuestionUpdate), not submit
    // time: with PR-4 tap-submit the tap IS the submit, so dwell at submit
    // would always read ~0.
    const questionIndex = progress?.answered ?? 0
    analytics.interaction('question_answered', {
      questionIndex,
      questionId: question.id,
      dwellMs: Math.max(0, Date.now() - questionShownAtRef.current),
    })

    const thisSessionId = sessionId
    activeSessionRef.current = thisSessionId

    setIsSubmitting(true)
    setError('')
    try {
      const commentaryStartTime = commentaryReceivedAtRef.current || Date.now()

      const apiPromise = apiRequest<AssessmentAnswerResponse>({
        path: `/api/assessment/v4/${encodeURIComponent(thisSessionId)}/answer`,
        method: currentHistoryIndex >= 0 ? 'PUT' : 'POST',
        data: {
          questionId: question.id,
          selectedOption: option.value,
        },
        // PR-3: 8s ceiling (results-fetch precedent) so weak networks surface
        // the manual retry row in ~half the default 15s. Timeout rejections
        // are transport errors and flow into the same catch/retry path below.
        timeout: 8000,
      })

      // Ensure commentary is visible for at least COMMENTARY_MIN_DISPLAY_MS.
      // The window is measured from when the instant per-option commentary
      // appeared (option tap), so a user who already read it advances with no
      // added wait — only the *remaining* time is enforced. Runs in parallel
      // with the request so it never adds latency on slow networks. A user
      // who tapped 下一题 / the bubble mid-flight (advanceAsap) skips the
      // remaining floor — explicit user control beats the auto guard.
      if (postAnswerCommentary && !advanceAsapRef.current) {
        const minDisplayRemaining = Math.max(
          0,
          COMMENTARY_MIN_DISPLAY_MS - (Date.now() - commentaryStartTime),
        )
        if (minDisplayRemaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, minDisplayRemaining))
        }
      }

      const result = await apiPromise

      if (activeSessionRef.current !== thisSessionId) return

      if (!isAuthenticated) {
        upsertAnonymousAssessmentAnswer({
          questionId: question.id,
          selectedOption: option.value,
          traitScores: option.traitScores,
          answeredAt: new Date().toISOString(),
        })
      }

      if (!result.commentary && postAnswerCommentary) {
        // Keep the per-option commentary that was set by handleAnswer
      } else if (result.commentary) {
        setPostAnswerCommentary(result.commentary)
        commentaryReceivedAtRef.current = Date.now()
        // Commentary arrived late (with the response): it gets the full
        // minimum display window from now so the feedback doesn't flash by.
        if (!postAnswerCommentary && !advanceAsapRef.current) {
          await new Promise((resolve) => setTimeout(resolve, COMMENTARY_MIN_DISPLAY_MS))
        }
      }

      if (result.isComplete || !result.nextQuestion) {
        const completedAnswerCount = result.progress?.answered ?? ((progress?.answered ?? 0) + 1)
        logInfo('[PersonalityTest] Assessment complete', {
          isAuthenticated,
          sessionId: thisSessionId,
        })

        if (result.result && result.result.primaryArchetype) {
          triggerXiaoyueAnalysisPrefetch(
            result.result,
            result.currentMatches ?? currentMatches,
          )
        }

        if (!isValidFinalResult(result.result)) {
          setIsPageExiting(false)
          setError(ONBOARDING_ERROR_STAGE_COPY.completingError.syncFailedBody)
          analytics.errorOccurred('invalid_final_result', 'primaryArchetype missing or invalid')
          logError('[PersonalityTest] Invalid finalResult from server', {
            sessionId: thisSessionId,
            result: result.result,
          })
          return
        }

        // Final question: there is no next-question advance, so commentary
        // read-through is measured here against the completing transition.
        const finalCommentary = result.commentary ?? postAnswerCommentary
        if (finalCommentary && commentaryReceivedAtRef.current > 0) {
          const estimatedReadMs = 120 + finalCommentary.length * 40
          const commentaryDwellMs = Math.max(0, Date.now() - commentaryReceivedAtRef.current)
          analytics.interaction(
            commentaryDwellMs >= estimatedReadMs ? 'commentary_read_complete' : 'commentary_cut_short',
            {
              questionIndex,
              dwellMs: commentaryDwellMs,
              estimatedReadMs,
            },
          )
        }

        analytics.stepCompleted({
          isAuthenticated,
          answerCount: completedAnswerCount,
          destination: MINI_PROGRAM_ROUTES.personalityTestResults,
        })

        pendingCompletionRef.current = {
          sessionId: thisSessionId,
          topArchetypes: result.currentMatches ?? currentMatches,
          finalResult: result.result,
        }
        markTestCompleted()
        setPhase('completing')
        return
      }

      // Push to question history
      if (currentHistoryIndex >= 0) {
        const safe = questionHistoryRef.current.slice(0, currentHistoryIndex)
        questionHistoryRef.current = [
          ...safe,
          { question, answer: option.value },
        ]
      } else {
        questionHistoryRef.current = [
          ...questionHistoryRef.current,
          { question, answer: option.value },
        ]
      }
      setCurrentHistoryIndex(-1)

      if (activeSessionRef.current !== thisSessionId) return
      lastAttemptedOptionRef.current = null

      pendingQuestionUpdateRef.current = {
        question: result.nextQuestion ?? null,
        progress: result.progress ?? null,
        matches: result.currentMatches ?? [],
      }
      setIsAdvancePending(true)

      // User already asked to advance while the response was in flight.
      if (advanceAsapRef.current) {
        applyPendingQuestionUpdate('manual')
        return
      }

      // Mid-test speculative prefetch: start the Xiaoyue LLM generation early
      // so the result page lands on a cached analysis. The server re-derives
      // the profile from the session, so no client-side score accumulation is
      // needed and authenticated + anonymous flows behave identically.
      const answeredCount = result.progress?.answered ?? 0
      const topMatch = result.currentMatches?.[0]
      if (
        answeredCount >= MID_TEST_PREFETCH_MIN_ANSWERS &&
        (topMatch?.confidence ?? 0) >= 0.7 &&
        (topMatch?.archetype !== lastMidTestPrefetchArchetypeRef.current ||
          Date.now() - lastMidTestPrefetchAtRef.current >= MID_TEST_PREFETCH_THROTTLE_MS)
      ) {
        lastMidTestPrefetchAtRef.current = Date.now()
        lastMidTestPrefetchArchetypeRef.current = topMatch?.archetype ?? null
        void apiRequest<{ prefetched: boolean; reason?: string }>({
          path: '/api/xiaoyue/prefetch',
          method: 'POST',
          data: { sessionId: thisSessionId },
        })
          .then((res) => {
            logInfo('[PersonalityTest] Mid-test Xiaoyue prefetch', {
              answeredCount,
              archetype: topMatch?.archetype,
              prefetched: res.prefetched,
              reason: res.reason,
            })
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err)
            logWarn('[PersonalityTest] Mid-test Xiaoyue prefetch failed', { message })
          })
      }
    } catch (err) {
      setIsPageExiting(false)
      const rawMessage = err instanceof Error ? err.message : String(err)
      const message = getErrorForSurface('submit-failed', 'inline-error')
      setError(message)
      analytics.errorOccurred('answer_failed', rawMessage)
      logError('[PersonalityTest] Failed to submit answer', { rawMessage, userMessage: message })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    analytics,
    applyPendingQuestionUpdate,
    currentHistoryIndex,
    currentMatches,
    isAuthenticated,
    isSubmitting,
    markTestCompleted,
    postAnswerCommentary,
    progress,
    question,
    sessionId,
  ])

  const handleAnswer = useCallback((option: AssessmentOption) => {
    if (!sessionId || !question || isSubmitting) return
    // PR-4: the answer is locked in once the tap-submit lands — re-tapping
    // another option during the commentary guard would double-submit.
    if (pendingQuestionUpdateRef.current) return

    setPostAnswerCommentary(null)

    lastAttemptedOptionRef.current = option
    setCurrentSelection(option)

    const immediateCommentary = option.commentary ?? null
    const commentaryStartTime = Date.now()
    setPostAnswerCommentary(immediateCommentary)
    if (immediateCommentary) {
      commentaryReceivedAtRef.current = commentaryStartTime
    }
    commentaryTypingDoneAtRef.current = 0

    // PR-4 单题单点: tapping an option on the live choice question submits
    // immediately; history review and slider questions stay fully manual.
    if (currentHistoryIndex < 0 && question.questionType !== 'slider') {
      void submitAnswer(option)
    }
  }, [sessionId, question, isSubmitting, currentHistoryIndex, submitAnswer])

  const handleSliderSubmit = useCallback(() => {
    if (!question) return
    const sliderOption = getNearestSliderOption(question.options, sliderValue)
    if (sliderOption) {
      handleAnswer(sliderOption)
      return
    }
    analytics.validationFailed('slider', 'no-option-mapped')
  }, [question, sliderValue, handleAnswer, analytics])

  const handleSliderChange = useCallback((value: number) => {
    setHasSliderInteracted(true)
    setSliderValue(value)
    // In back-review, currentSelection still holds the previously submitted
    // option; handleNext prefers it over the slider value, which would
    // silently re-submit the old answer. A drag means "change the answer".
    setCurrentSelection(null)
  }, [])

  // Echo lifecycle: fade-out before unmount so the transition to the next
  // question doesn't feel like a hard cut.
  const shouldShowEcho = isSubmitting
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
        // PR-4: when commentary is on screen for a live question, the guarded
        // auto-advance owns the pending update — the (invisible) echo exit
        // must not consume it before the guard window ends.
        if (postAnswerCommentary && currentHistoryIndex < 0) return
        applyPendingQuestionUpdate('manual')
      }, 220)
    }
  }, [shouldShowEcho, isEchoExiting, applyPendingQuestionUpdate, postAnswerCommentary, currentHistoryIndex])

  // PR-4 guarded auto-advance: fires once the submission has landed AND the
  // commentary typewriter has finished, at
  // max(commentaryShownAt + COMMENTARY_MIN_DISPLAY_MS, typingDoneAt + 400ms).
  // Never interrupts typing; 下一题 / bubble tap can always advance sooner.
  useEffect(() => {
    if (isSubmitting || !isAdvancePending || !postAnswerCommentary) return
    if (currentHistoryIndex >= 0) return
    const commentaryShownAt = commentaryReceivedAtRef.current
    const typingDoneAt = commentaryTypingDoneAtRef.current
    if (!commentaryShownAt || !typingDoneAt) return
    const wait = computeAutoAdvanceDelayMs({
      commentaryShownAt,
      typingDoneAt,
      minDisplayMs: COMMENTARY_MIN_DISPLAY_MS,
      now: Date.now(),
    })
    autoAdvanceTimerRef.current = setTimeout(() => {
      autoAdvanceTimerRef.current = null
      applyPendingQuestionUpdate('auto')
    }, wait)
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current)
        autoAdvanceTimerRef.current = null
      }
    }
  }, [
    isSubmitting,
    isAdvancePending,
    postAnswerCommentary,
    currentHistoryIndex,
    typingDoneTick,
    applyPendingQuestionUpdate,
  ])

  const handleCommentaryTypingComplete = useCallback(() => {
    commentaryTypingDoneAtRef.current = Date.now()
    setTypingDoneTick((tick) => tick + 1)
  }, [])

  // Tapping the speech bubble is the user's "I've read it" signal: advance
  // immediately when the next question is already held, or mark advance-ASAP
  // so a slow in-flight submit skips the remaining commentary floor.
  const handleCommentaryBubbleTap = useCallback(() => {
    if (currentHistoryIndex >= 0) return
    if (pendingQuestionUpdateRef.current) {
      applyPendingQuestionUpdate('manual')
      return
    }
    if (isSubmitting) {
      advanceAsapRef.current = true
    }
  }, [applyPendingQuestionUpdate, currentHistoryIndex, isSubmitting])

  // Cleanup echo exit + auto-advance timers on unmount
  useEffect(() => {
    return () => {
      if (echoExitTimerRef.current) {
        clearTimeout(echoExitTimerRef.current)
      }
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current)
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

  const handleNext = useCallback(async () => {
    if (!sessionId || !question) return

    if (currentHistoryIndex < 0) {
      // PR-4: a held next question (tap-submit already landed) advances
      // immediately — explicit user control beats the auto-advance timer.
      if (pendingQuestionUpdateRef.current) {
        applyPendingQuestionUpdate('manual')
        return
      }
      // Tap-submit still in flight: skip the remaining commentary floor
      // once the response lands.
      if (isSubmitting) {
        advanceAsapRef.current = true
        return
      }
    } else if (isSubmitting) {
      return
    }

    // Determine if we need API call or just history navigation
    // currentHistoryIndex >= 0 means we're viewing a previous answer
    if (currentHistoryIndex >= 0) {
      const currentHistoryEntry = questionHistoryRef.current[currentHistoryIndex]
      const isAnswerUnchanged = currentSelection?.value === currentHistoryEntry?.answer

      if (isAnswerUnchanged && currentHistoryIndex + 1 < questionHistoryRef.current.length) {
        const nextIndex = currentHistoryIndex + 1
        const nextEntry = questionHistoryRef.current[nextIndex]
        setCurrentHistoryIndex(nextIndex)
        setQuestion(nextEntry.question)
        const prevOption = nextEntry.question.options.find(o => o.value === nextEntry.answer) ?? null
        setCurrentSelection(prevOption)
        setSliderValue(50)
        setHasSliderInteracted(false)
        setPostAnswerCommentary(null)
        return
      }

      if (isAnswerUnchanged && currentHistoryIndex + 1 >= questionHistoryRef.current.length) {
        const snapshot = liveQuestionSnapshotRef.current
        if (snapshot) {
          setQuestion(snapshot.question)
          setProgress(snapshot.progress)
          setCurrentMatches(snapshot.matches)
          liveQuestionSnapshotRef.current = null
        }
        setCurrentHistoryIndex(-1)
        setCurrentSelection(null)
        setSliderValue(50)
        setHasSliderInteracted(false)
        setPostAnswerCommentary(null)
        return
      }
    }

    // Need to submit via API (new answer or history modification)
    // For slider questions, resolve sliderValue to the nearest option
    const option = currentSelection ?? (
      question.questionType === 'slider'
        ? (getNearestSliderOption(question.options, sliderValue) ?? null)
        : null
    )
    if (!option) return

    await submitAnswer(option)
  }, [
    applyPendingQuestionUpdate,
    currentHistoryIndex,
    currentSelection,
    isSubmitting,
    question,
    sessionId,
    sliderValue,
    submitAnswer,
  ])

  const handlePrevious = useCallback(() => {
    if (questionHistoryRef.current.length === 0) return
    haptics('light')

    // PR-4: if the tap-submit answer already landed and the next question is
    // held for the commentary guard, land it first so 上一题 reviews the
    // answer the user just gave (now the last history entry). The snapshot
    // must come from the pending payload — local question state is stale
    // inside this closure until the apply re-renders.
    if (pendingQuestionUpdateRef.current) {
      const pending = pendingQuestionUpdateRef.current
      liveQuestionSnapshotRef.current = {
        question: pending.question,
        progress: pending.progress,
        matches: pending.matches,
      }
      applyPendingQuestionUpdate('manual')
    }

    if (currentHistoryIndex === -1 && !liveQuestionSnapshotRef.current) {
      liveQuestionSnapshotRef.current = {
        question,
        progress: progress ?? null,
        matches: currentMatches,
      }
    }

    const targetIndex = currentHistoryIndex < 0
      ? questionHistoryRef.current.length - 1
      : currentHistoryIndex - 1

    if (targetIndex < 0) return

    const entry = questionHistoryRef.current[targetIndex]
    setCurrentHistoryIndex(targetIndex)
    setQuestion(entry.question)
    const prevOption = entry.question.options.find(o => o.value === entry.answer) ?? null
    setCurrentSelection(prevOption)
    setSliderValue(50)
    setHasSliderInteracted(false)
    setPostAnswerCommentary(null)
  }, [applyPendingQuestionUpdate, currentHistoryIndex, question, progress, currentMatches])

  const handleRetry = useCallback(() => {
    setError('')
    void handleNext()
  }, [handleNext])

  const handleSkip = useCallback(async () => {
    if (!sessionId || !question || isSkipping || skipsRemaining <= 0) return
    // PR-4: the answer already landed and the next question is mid-guard —
    // 换一题 here would skip a question the user has never seen.
    if (pendingQuestionUpdateRef.current) return
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
        // PR-3: same 8s ceiling as the answer POST — keeps the skip spinner
        // from hanging the full 15s default on weak networks.
        timeout: 8000,
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
      const message = err instanceof Error && err.message ? err.message : getErrorForSurface('switch-failed', 'inline-error')
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
        celebrateMinDisplay={COMPLETING_CELEBRATE_MIN_MS}
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
          sliderTouched={hasSliderInteracted}
          isSubmitting={isSubmitting}
          isSkipping={isSkipping}
          skipsRemaining={skipsRemaining}
          isAdvancePending={isAdvancePending}
          error={error}
          postAnswerCommentary={postAnswerCommentary}
          idleWhisperText={idleWhisperText}
          shouldShowEcho={shouldShowEcho}
          isEchoExiting={isEchoExiting}
          echoEnabled={echoEnabled}
          currentSelection={currentSelection}
          canGoNext={currentSelection !== null || isAdvancePending || (question?.questionType === 'slider' && hasSliderInteracted)}
          canGoPrevious={currentHistoryIndex === -1 ? questionHistoryRef.current.length > 0 : currentHistoryIndex > 0}
          lastAttemptedOptionRef={lastAttemptedOptionRef}
          onAnswer={handleAnswer}
          onSliderChange={handleSliderChange}
          onSliderSubmit={handleSliderSubmit}
          onCommentaryComplete={handleCommentaryTypingComplete}
          onCommentaryBubbleTap={handleCommentaryBubbleTap}
          onIdleWhisperTap={handleIdleWhisperTap}
          onSliderAdvanceBlocked={() => {
            // P1 polish validation: user tried to advance a slider question
            // without touching the slider (gate blocked the tap).
            analytics.interaction('slider_advance_blocked', {
              questionId: question?.id,
              questionIndex: progress?.answered ?? 0,
            })
          }}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onSkip={handleSkip}
          onRetry={handleRetry}
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

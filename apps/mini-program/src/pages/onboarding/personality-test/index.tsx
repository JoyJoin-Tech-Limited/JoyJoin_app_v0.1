import { View, Text, ScrollView, Image } from '@tarojs/components'
import { cdnAsset } from '../../../lib/utils/cdnAssets'
import Button from '../../../components/ui/Button'
import OnboardingLoadingShell from '../../../components/loading/OnboardingLoadingShell'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth, useInvalidateAuth } from '../../../hooks/useAuth'
import { apiRequest, getUserState } from '../../../lib/api/api'
import { useOnboardingAnalytics } from '../../../hooks/onboarding/useOnboardingAnalytics'
import { useOnboardingCheckpoint } from '../../../hooks/onboarding/useOnboardingCheckpoint'
import {
  clearAnonymousAssessmentStorage,
  hasAnonymousAssessmentResult,
  isAnonymousAssessmentSessionCompleted,
  readAnonymousAssessmentSession,
  saveAnonymousAssessmentSession,
  upsertAnonymousAssessmentAnswer,
  type AnonymousAssessmentSessionSnapshot,
  type AnonymousAssessmentTopMatch,
} from '../../../lib/auth/anonymousOnboarding'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import {
  navigateToMiniProgramNextStep,
  runMiniProgramRouteTransition,
} from '../../../lib/onboarding/onboardingNavigation'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { logInfo, logError } from '../../../lib/utils/logger'
import {
  getArchetypeVisual,
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
  PERSONALITY_TEST_QUESTION_EXPRESSION,
} from './visuals'
import type { XiaoyueExpressionId } from '../../../lib/mascot/xiaoyueExpressions'
import { haptics } from '../../../lib/utils/haptics'
import MascotQuestionHeader from './MascotQuestionHeader'
import PersonalityTestAnswerArea, { getNearestSliderOption, type AnswerOption } from './PersonalityTestAnswerArea'

import QuestionTransition from './QuestionTransition'
import XiaoyueSpriteAnimator, { type XiaoyueSpriteState } from '../../../components/mascot/XiaoyueSpriteAnimator'
import './index.scss'

type Phase = 'intro' | 'testing' | 'completing'

type AssessmentQuestionType = 'choice' | 'slider' | 'emoji_tap'

interface AssessmentOption {
  value: string
  text: string
  traitScores?: Record<string, number>
}

interface AssessmentSliderConfig {
  leftLabel: string
  rightLabel: string
  leftEmoji: string
  rightEmoji: string
}

interface AssessmentQuestion {
  id: string
  scenarioText: string
  questionText: string
  options: AssessmentOption[]
  questionType?: AssessmentQuestionType
  sliderConfig?: AssessmentSliderConfig
}

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
}

const INTRO_ARCHETYPE_TEASERS: { archetype: string; vibeLine: string }[] = [
  { archetype: 'corgi', vibeLine: '一进场，就把气氛带热。' },
  { archetype: 'fox', vibeLine: '普通话题，也能聊出火花。' },
  { archetype: 'koala', vibeLine: '会让人慢慢放松下来。' },
]

const INTRO_META_PILLS = ['约 3-5 分钟', '题目跟着你变', '可先完成再登录'] as const

const INTRO_TRUST_POINTS = [
  {
    icon: '⏱️',
    title: '约 3-5 分钟完成',
    description: '轻量做完，不会把你困在一串冗长题目里。',
  },
  {
    icon: '🎯',
    title: '题目会跟着你变',
    description: '越答越准，帮你找到最像自己的氛围命格。',
  },
  {
    icon: '💾',
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

/** Resolve the sprite animation state for the current question context. */
function resolveSpriteState(
  questionType: AssessmentQuestionType,
  isSubmitting: boolean,
): XiaoyueSpriteState {
  if (isSubmitting) {
    return 'thinking'
  }
  switch (questionType) {
    case 'slider':
      return 'listening'
    case 'emoji_tap':
      return 'curious'
    case 'choice':
    default:
      return 'curious'
  }
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
  const [previewSpriteState, setPreviewSpriteState] = useState<XiaoyueSpriteState | null>(null)
  const [postAnswerCommentary, setPostAnswerCommentary] = useState<string | null>(null)
  const [milestonePulse, setMilestonePulse] = useState(false)
  const [spriteLocked, setSpriteLocked] = useState(false)
  const [introSpriteState, setIntroSpriteState] = useState<XiaoyueSpriteState>('intro')
  // Guard against stale async closures hijacking navigation after session change
  const activeSessionRef = useRef<string>('')
  // Defensive timeout for sprite unlock if WeChat drops animationend
  const spriteUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleIntroSpriteComplete = useCallback(() => setIntroSpriteState('idle'), [])

  const isAuthenticated = auth.isAuthenticated
  const hasStoredIncompleteSession = useMemo(() => {
    if (isAuthenticated) {
      return false
    }
    const snapshot = readAnonymousAssessmentSession()
    return Boolean(snapshot?.sessionId && !isAnonymousAssessmentSessionCompleted(snapshot))
  }, [isAuthenticated, phase])

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
  const baseSpriteState = resolveSpriteState(questionType, isSubmitting)

  // Sync base sprite state when question changes (unless locked for one-shot)
  // Preview state (hover) overrides base state when not locked
  useEffect(() => {
    if (!spriteLocked) {
      setSpriteState(previewSpriteState ?? baseSpriteState)
    }
  }, [baseSpriteState, spriteLocked, previewSpriteState])

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
  ) => {
    saveAnonymousAssessmentSession({
      sessionId: targetSessionId,
      phase: 'completed',
      timestamp: Date.now(),
      completedAt: new Date().toISOString(),
      result: null,
      topArchetypes: nextTopArchetypes ?? currentMatches,
      resultSequenceCompletedAt: undefined,
    })

    await runMiniProgramRouteTransition({
      beforeNavigate: () => setIsPageExiting(true),
    })
    await Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.personalityTestResults })
  }, [currentMatches])

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
        await completeAnonymousAssessment(result.sessionId, result.currentMatches ?? currentMatches)
        return
      }

      setPhase('testing')
    } catch (err) {
      setIsPageExiting(false)
      const message = err instanceof Error ? err.message : '启动测试失败，请重试'
      setError(message)
      analytics.errorOccurred('start_failed', message)
      logError('[PersonalityTest] Failed to start', { message })
    } finally {
      setIsSubmitting(false)
    }
  }, [
    analytics,
    completeAnonymousAssessment,
    invalidateAuth,
    isAuthenticated,
    saveCheckpoint,
  ])

  /** Map an option to a preview sprite state based on its text content. */
  const resolveOptionPreviewSpriteState = useCallback((option: AnswerOption): XiaoyueSpriteState => {
    const states: XiaoyueSpriteState[] = ['listening', 'curious', 'thinking', 'surprised']
    const hash = Math.abs(option.text.charCodeAt(0)) % states.length
    return states[hash]!
  }, [])

  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleOptionTouchStart = useCallback((option: AnswerOption) => {
    if (spriteLocked || isSubmitting) return
    if (previewDebounceRef.current) {
      clearTimeout(previewDebounceRef.current)
    }
    previewDebounceRef.current = setTimeout(() => {
      if (!spriteLocked && !isSubmitting) {
        setPreviewSpriteState(resolveOptionPreviewSpriteState(option))
      }
    }, 80)
  }, [spriteLocked, isSubmitting, resolveOptionPreviewSpriteState])

  const handleOptionTouchEnd = useCallback(() => {
    if (previewDebounceRef.current) {
      clearTimeout(previewDebounceRef.current)
      previewDebounceRef.current = null
    }
    setPreviewSpriteState(null)
  }, [])

  const handleAnswer = useCallback(async (option: AssessmentOption) => {
    if (!sessionId || !question || isSubmitting) return

    // Clear any pending preview debounce and reset preview state immediately
    if (previewDebounceRef.current) {
      clearTimeout(previewDebounceRef.current)
      previewDebounceRef.current = null
    }
    setPreviewSpriteState(null)

    // Post-answer commentary will be set from server response below

    // Stale-session guard: remember which session this answer belongs to
    const thisSessionId = sessionId
    activeSessionRef.current = thisSessionId

    // Choose reaction based on milestone proximity
    const isMilestone = progress && (progress.answered === 3 || progress.answered === 7)
    const reactionState: XiaoyueSpriteState = isMilestone ? 'celebrate' : 'nod'

    if (isMilestone) {
      setMilestonePulse(true)
    }

    setSpriteLocked(true)
    setSpriteState(reactionState)

    // Defensive unlock: if WeChat never fires animationend, unlock after max duration
    if (spriteUnlockTimeoutRef.current) {
      clearTimeout(spriteUnlockTimeoutRef.current)
    }
    spriteUnlockTimeoutRef.current = setTimeout(() => {
      setSpriteLocked(false)
      setPostAnswerCommentary(null)
      setMilestonePulse(false)
    }, 1500)

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
        await completeAnonymousAssessment(thisSessionId, result.currentMatches ?? currentMatches)
        return
      }

      setQuestion(result.nextQuestion)
      setProgress(result.progress ?? null)
      setCurrentMatches(result.currentMatches ?? [])
      setSliderValue(50)
    } catch (err) {
      setIsPageExiting(false)
      const message = err instanceof Error ? err.message : '提交答案失败，请重试'
      setError(message)
      analytics.errorOccurred('answer_failed', message)
      logError('[PersonalityTest] Failed to submit answer', { message })
      setSpriteLocked(false)
    } finally {
      setIsSubmitting(false)
    }
  }, [
    analytics,
    completeAnonymousAssessment,
    invalidateAuth,
    isAuthenticated,
    isSubmitting,
    progress?.answered,
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

  /** Release sprite lock after one-shot animation completes */
  const handleSpriteAnimationComplete = useCallback(() => {
    if (spriteUnlockTimeoutRef.current) {
      clearTimeout(spriteUnlockTimeoutRef.current)
      spriteUnlockTimeoutRef.current = null
    }
    setSpriteLocked(false)
  }, [])

  const preloadExpressions: XiaoyueExpressionId[] = [
    PERSONALITY_TEST_QUESTION_EXPRESSION.choice,
    PERSONALITY_TEST_QUESTION_EXPRESSION.slider,
    PERSONALITY_TEST_QUESTION_EXPRESSION.emoji_tap,
    PERSONALITY_TEST_QUESTION_EXPRESSION.loading,
  ]

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
        <ScrollView className='personality-test__intro-scroll' scrollY showScrollbar={false}>
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

            <View className='personality-test__intro-hero personality-test__stage personality-test__stage--2'>
              <View className='personality-test__intro-hero-visual'>
                <View className='personality-test__intro-hero-halo' />
                <XiaoyueSpriteAnimator
                  state={introSpriteState}
                  size='320rpx'
                  className='personality-test__mascot personality-test__mascot--animated'
                  onComplete={handleIntroSpriteComplete}
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

            <View className='personality-test__intro-trust personality-test__stage personality-test__stage--3'>
              <Text className='personality-test__intro-trust-title'>开始前，三件事</Text>
              <View className='personality-test__intro-trust-list'>
                {INTRO_TRUST_POINTS.map((item) => (
                  <View key={item.title} className='personality-test__intro-trust-item'>
                    <View className='personality-test__intro-trust-icon'>
                      <Text>{item.icon}</Text>
                    </View>
                    <View className='personality-test__intro-trust-copy'>
                      <Text className='personality-test__intro-trust-item-title'>{item.title}</Text>
                      <Text className='personality-test__intro-trust-item-description'>{item.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

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
                      style={{
                        animationDelay: `${80 + teaserIndex * 100}ms`,
                      }}
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
        </ScrollView>

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

  return (
    <>
      {/* Asset preloading for mascot expressions */}
      <View className='personality-test__preload-layer'>
        {PRELOAD_EXPRESSIONS.map((expr) => (
          <Image
            key={expr}
            className='personality-test__preload-image'
            src={getXiaoyueExpressionAsset(expr)}
            mode='aspectFit'
            lazyLoad={false}
          />
        ))}
      </View>

      {/* ─── Glassmium Question + Mascot Layout ─── */}
      <View className={getPageClassName('personality-test--mascot-layout')}>
        {/* Zone A: Thin progress bar */}
        <View className='personality-test__progress-track'>
          <View
            className={`personality-test__progress-fill${milestonePulse ? ' personality-test__progress-fill--milestone-pulse' : ''}`}
            style={{ transform: `scaleX(${Math.min(progressPercent / 100, 1)})` }}
          />
        </View>
        <View className='personality-test__progress-label'>
          <Text className='personality-test__progress-text'>
            已答 {progress?.answered ?? 0} 题 · 还剩约 {progress?.estimatedRemaining ?? 0} 题
          </Text>
        </View>

        {/* Zone B: Full-width glassmium question banner */}
        <View className='personality-test__question-zone'>
          {question ? (
            <QuestionTransition questionId={question.id}>
              <MascotQuestionHeader
                question={questionStub}
                isLoading={isSubmitting}
              />
            </QuestionTransition>
          ) : null}
        </View>

        {/* Zone C: Mascot + speech bubble row */}
        <View className='personality-test__mascot-zone'>
          {question ? (
            <View className='personality-test__mascot-row'>
              <View className='personality-test__mascot-avatar'>
                <XiaoyueSpriteAnimator
                  state={spriteState}
                  size='152rpx'
                  onComplete={handleSpriteAnimationComplete}
                />
              </View>
              <View
                className={`personality-test__speech-bubble${progress && (progress.answered === 4 || progress.answered === 8) ? ' personality-test__speech-bubble--milestone' : ''}`}
              >
                <Text
                  className='personality-test__speech-bubble-text'
                  key={`speech-${progress?.answered ?? 0}-${question.id}-${postAnswerCommentary ?? 'default'}`}
                >
                  {postAnswerCommentary
                    ? postAnswerCommentary
                    : progress && progress.answered === 4
                      ? '已经一半了！你的命格轮廓越来越清晰，继续凭直觉选。'
                      : progress && progress.answered === 8
                        ? '太棒了！进入精准阶段，接下来的题目会更聚焦，帮你锁定最像自己的氛围命格。'
                        : questionType === 'slider'
                          ? '滑到最符合你感觉的位置～'
                          : questionType === 'emoji_tap'
                            ? '选最戳你的那个～'
                            : '凭直觉选就好，没有标准答案～'}
                </Text>
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
          ) : question ? (
            <QuestionTransition questionId={question.id}>
              <PersonalityTestAnswerArea
                questionType={questionType}
                options={question.options}
                sliderConfig={question.sliderConfig}
                sliderValue={sliderValue}
                isSubmitting={isSubmitting}
                onAnswer={handleAnswer}
                onSliderChange={setSliderValue}
                onSliderSubmit={handleSliderSubmit}
                onOptionTouchStart={handleOptionTouchStart}
                onOptionTouchEnd={handleOptionTouchEnd}
              />
            </QuestionTransition>
          ) : null}
        </View>

        {error ? <Text className='personality-test__error'>{error}</Text> : null}
      </View>
    </>
  )
}

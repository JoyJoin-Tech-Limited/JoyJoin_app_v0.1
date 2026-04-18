import { View, Text, ScrollView, Slider, Image } from '@tarojs/components'
import Button from '../../../components/Button'
import OnboardingLoadingShell from '../../../components/OnboardingLoadingShell'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth, useInvalidateAuth } from '../../../hooks/useAuth'
import { apiRequest, getUserState } from '../../../lib/api'
import { useOnboardingAnalytics } from '../../../hooks/useOnboardingAnalytics'
import { useOnboardingCheckpoint } from '../../../hooks/useOnboardingCheckpoint'
import {
  clearAnonymousAssessmentStorage,
  hasAnonymousAssessmentResult,
  isAnonymousAssessmentSessionCompleted,
  readAnonymousAssessmentSession,
  saveAnonymousAssessmentSession,
  upsertAnonymousAssessmentAnswer,
  type AnonymousAssessmentSessionSnapshot,
  type AnonymousAssessmentTopMatch,
} from '../../../lib/anonymousOnboarding'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboardingRoutes'
import {
  navigateToMiniProgramNextStep,
  runMiniProgramRouteTransition,
} from '../../../lib/onboardingNavigation'
import { logInfo, logError } from '../../../lib/logger'
import {
  getArchetypeVisual,
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
} from './visuals'
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

const INTRO_ARCHETYPE_TEASERS = [
  {
    archetype: '开心柯基',
    vibeLine: '一进场，就把气氛带热。',
  },
  {
    archetype: '机智狐',
    vibeLine: '普通话题，也能聊出火花。',
  },
  {
    archetype: '暖心熊',
    vibeLine: '会让人慢慢放松下来。',
  },
] as const

const INTRO_META_PILLS = ['约 3-5 分钟', '自适应题目', '可先完成再登录'] as const

const INTRO_TRUST_POINTS = [
  {
    title: '约 3-5 分钟完成',
    description: '轻量做完，不会把你困在一串冗长题目里。',
  },
  {
    title: '题目会跟着你变化',
    description: '系统会根据你的回答逐渐收敛出更像你的氛围原型。',
  },
  {
    title: '未登录也能先完成',
    description: '结果会先保存在这台设备里，准备好时再继续登录。',
  },
] as const

function getQuestionType(question: AssessmentQuestion | null): AssessmentQuestionType {
  if (!question?.questionType) {
    return 'choice'
  }

  return question.questionType
}

function getNearestSliderOption(question: AssessmentQuestion, sliderValue: number): AssessmentOption | null {
  if (question.options.length === 0) {
    return null
  }

  return question.options.reduce<AssessmentOption | null>((closest, option) => {
    const match = option.value.match(/(-?\d+)/)
    const optionValue = match ? Number(match[1]) : 50

    if (!closest) {
      return option
    }

    const closestMatch = closest.value.match(/(-?\d+)/)
    const closestValue = closestMatch ? Number(closestMatch[1]) : 50

    return Math.abs(optionValue - sliderValue) < Math.abs(closestValue - sliderValue)
      ? option
      : closest
  }, null)
}

function splitEmojiLabel(text: string): { emoji: string; label: string } {
  const match = text.match(/^(\S+)\s+(.+)$/)
  if (!match) {
    return { emoji: '✨', label: text }
  }

  return {
    emoji: match[1],
    label: match[2],
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
    ? '上次的进度我还替你留着。继续往下答几分钟，这份氛围画像就能顺着刚才的位置接上。'
    : '这不是标准化测评，更像一次轻量的社交画像。按直觉选择就好，我会帮你把你的聚会气场整理清楚。'
  const introFooterKicker = hasStoredIncompleteSession
    ? '把剩下的几分钟补完，这份画像就能继续带着你往后走。'
    : '先完成这一步，后面的匹配与资料预览，才会真正更懂你。'
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
        const completedAnswerCount = result.progress?.answered ?? progress?.answered ?? 0

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
    progress?.answered,
    saveCheckpoint,
  ])

  const handleAnswer = useCallback(async (option: AssessmentOption) => {
    if (!sessionId || !question || isSubmitting) return

    setIsSubmitting(true)
    setError('')
    try {
      const result = await apiRequest<AssessmentAnswerResponse>({
        path: `/api/assessment/v4/${encodeURIComponent(sessionId)}/answer`,
        method: 'POST',
        data: {
          questionId: question.id,
          selectedOption: option.value,
        },
      })

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
          sessionId,
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
        await completeAnonymousAssessment(sessionId, result.currentMatches ?? currentMatches)
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

  if (auth.isLoading) {
    return (
      <OnboardingLoadingShell
        stepLabel='Onboarding 1 / 4'
        title='小悦在准备你的氛围测试入口'
        subtitle='先把登录进度和本机记录对齐好，接着就带你进入这张聚会气场卡。'
        hint='如果你上次答到一半，我会把那份进度顺着接回来。'
        xiaoyueExpression={PERSONALITY_TEST_XIAOYUE_EXPRESSION.introHero}
      />
    )
  }

  // Intro phase
  if (phase === 'intro') {
    return (
      <View className={getPageClassName('personality-test--intro')}>
        <ScrollView className='personality-test__intro-scroll' scrollY enhanced showScrollbar={false}>
          <View className='personality-test__intro-shell'>
            <View className='personality-test__stage personality-test__stage--1'>
              <Text className='personality-test__eyebrow'>
                <Text className='personality-test__eyebrow-en'>JoyJoin</Text>
                <Text> · 氛围原型</Text>
              </Text>
              <Text className='personality-test__intro-title'>3 分钟，读懂你的</Text>
              <Text className='personality-test__intro-title personality-test__intro-title--accent'>聚会气场</Text>
              <Text className='personality-test__intro-subtitle'>
                这一步会生成你的氛围原型画像，让后面的匹配和资料预览，都更像你。
              </Text>
            </View>

            <View className='personality-test__intro-hero personality-test__stage personality-test__stage--2'>
              <View className='personality-test__intro-hero-visual'>
                <View className='personality-test__intro-hero-halo' />
                <Image
                  className='personality-test__mascot'
                  src={getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.introHero)}
                  mode='aspectFit'
                />
              </View>

              <View className='personality-test__intro-bubble'>
                <Text className='personality-test__intro-bubble-title'>这一步会带来什么</Text>
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
              <Text className='personality-test__intro-trust-title'>做之前，你只需要知道这三件事</Text>
              <View className='personality-test__intro-trust-list'>
                {INTRO_TRUST_POINTS.map((item, index) => (
                  <View key={item.title} className='personality-test__intro-trust-item'>
                    <View className='personality-test__intro-trust-index'>
                      <Text className='personality-test__intro-trust-index-text'>{`0${index + 1}`}</Text>
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
              <Text className='personality-test__intro-tease-title'>最后，你会看到这样的原型画像</Text>
              <Text className='personality-test__intro-tease-subtitle'>
                它不是给你贴标签，而是帮 JoyJoin 更快理解你在小局里的感觉。
              </Text>

              <ScrollView
                className='personality-test__intro-tease-scroll'
                scrollX
                enhanced
                showScrollbar={false}
              >
                <View className='personality-test__intro-tease-list'>
                  {introTeasers.map((item) => (
                    <View key={item.archetype} className='personality-test__intro-tease-card'>
                      <View
                        className='personality-test__intro-tease-avatar-shell'
                        style={{
                          background: item.visual.accentSurface,
                          borderColor: item.visual.accentBorder,
                        }}
                      >
                        <Image
                          className='personality-test__intro-tease-avatar'
                          src={item.visual.asset}
                          mode='aspectFit'
                        />
                      </View>
                      <Text className='personality-test__intro-tease-name'>{item.archetype}</Text>
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
        stepLabel='JoyJoin 氛围原型'
        title='小悦在收束你的结果卡'
        subtitle='把刚才的回答翻成更像你的 JoyJoin 气场卡，马上就会正式揭晓。'
        hint='我会把轮廓、关键词和后面的分享卡一起整理好。'
        xiaoyueExpression={PERSONALITY_TEST_XIAOYUE_EXPRESSION.completing}
      />
    )
  }

  return (
    <ScrollView className={getPageClassName()} scrollY enhanced showScrollbar={false}>
      <View className='personality-test__progress-bar'>
        <View className='personality-test__progress-fill' style={{ width: `${progressPercent}%` }} />
      </View>
      <View className='personality-test__progress-label'>
        <Text className='personality-test__progress-text'>
          已答 {progress?.answered ?? 0} 题 · 还剩约 {progress?.estimatedRemaining ?? 0} 题
        </Text>
      </View>

      {question ? (
        <View className='personality-test__question'>
          <View className='personality-test__question-card'>
            <Text className='personality-test__scenario'>{question.scenarioText}</Text>
            <Text className='personality-test__question-text'>{question.questionText}</Text>

            {currentMatches.length > 0 ? (
              <View className='personality-test__matches'>
                {currentMatches.slice(0, 2).map((match) => (
                  <Text key={match.archetype} className='personality-test__match-chip'>
                    {match.archetype}
                  </Text>
                ))}
              </View>
            ) : null}

            {questionType === 'slider' && question.sliderConfig ? (
              <View className='personality-test__slider-shell'>
                <View className='personality-test__slider-labels'>
                  <View className='personality-test__slider-pill'>
                    <Text className='personality-test__slider-pill-emoji'>{question.sliderConfig.leftEmoji}</Text>
                    <Text className='personality-test__slider-pill-text'>{question.sliderConfig.leftLabel}</Text>
                  </View>
                  <View className='personality-test__slider-pill personality-test__slider-pill--right'>
                    <Text className='personality-test__slider-pill-emoji'>{question.sliderConfig.rightEmoji}</Text>
                    <Text className='personality-test__slider-pill-text'>{question.sliderConfig.rightLabel}</Text>
                  </View>
                </View>

                <Text className='personality-test__slider-value'>{sliderValue}</Text>
                <Slider
                  className='personality-test__slider'
                  min={0}
                  max={100}
                  step={1}
                  value={sliderValue}
                  activeColor='#8B5CF6'
                  backgroundColor='#EDE9FE'
                  blockColor='#8B5CF6'
                  blockSize={22}
                  showValue={false}
                  onChanging={(event) => setSliderValue(Number(event.detail.value))}
                  onChange={(event) => setSliderValue(Number(event.detail.value))}
                  disabled={isSubmitting}
                />

                <Button
                  variant='brand'
                  className='personality-test__slider-submit'
                  onClick={() => {
                    const sliderOption = getNearestSliderOption(question, sliderValue)
                    if (sliderOption) {
                      void handleAnswer(sliderOption)
                      return
                    }

                    analytics.validationFailed('slider', 'no-option-mapped')
                  }}
                  disabled={isSubmitting}
                  loading={isSubmitting}
                >
                  {isSubmitting ? '提交中…' : '确认这个感觉'}
                </Button>
              </View>
            ) : null}

            {questionType === 'emoji_tap' ? (
              <View className='personality-test__emoji-grid'>
                {question.options.map((option) => {
                  const parts = splitEmojiLabel(option.text)
                  return (
                    <Button
                      key={option.value}
                      className='personality-test__emoji-option'
                      onClick={() => void handleAnswer(option)}
                      disabled={isSubmitting}
                      hoverClass='personality-test__emoji-option--active'
                    >
                      <Text className='personality-test__emoji-option-emoji'>{parts.emoji}</Text>
                      <Text className='personality-test__emoji-option-text'>{parts.label}</Text>
                    </Button>
                  )
                })}
              </View>
            ) : null}

            {questionType === 'choice' ? (
              <View className='personality-test__options'>
                {question.options.map((option) => (
                  <Button
                    key={option.value}
                    className='personality-test__option'
                    onClick={() => void handleAnswer(option)}
                    disabled={isSubmitting}
                    hoverClass='personality-test__option--active'
                  >
                    <Text className='personality-test__option-text'>{option.text}</Text>
                  </Button>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {error ? <Text className='personality-test__error'>{error}</Text> : null}
    </ScrollView>
  )
}

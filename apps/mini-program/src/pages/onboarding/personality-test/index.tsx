import { View, Text, ScrollView, Slider } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Button from '../../../components/Button'
import Card from '../../../components/Card'
import { useAuth, useInvalidateAuth } from '../../../hooks/useAuth'
import { apiRequest, getUserState } from '../../../lib/api'
import { useOnboardingAnalytics } from '../../../hooks/useOnboardingAnalytics'
import { useOnboardingCheckpoint } from '../../../hooks/useOnboardingCheckpoint'
import {
  clearAnonymousAssessmentStorage,
  hasAnonymousAssessmentResult,
  readAnonymousAssessmentSession,
  saveAnonymousAssessmentSession,
  upsertAnonymousAssessmentAnswer,
  type AnonymousAssessmentResult,
  type AnonymousAssessmentSessionSnapshot,
  type AnonymousAssessmentTopMatch,
} from '../../../lib/anonymousOnboarding'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboardingRoutes'
import { navigateToMiniProgramNextStep } from '../../../lib/onboardingNavigation'
import { logInfo, logError } from '../../../lib/logger'
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

interface AssessmentResultEnvelope {
  sessionId: string
  completedAt?: string
  result: AnonymousAssessmentResult
  topArchetypes?: AnonymousAssessmentTopMatch[]
}

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

const INTRO_HIGHLIGHTS = [
  { emoji: '⏱', label: '约 3-5 分钟' },
  { emoji: '✨', label: '按第一直觉作答' },
  { emoji: '🔒', label: '可先测后登录' },
]

const INTRO_STEPS = [
  '先用几道生活化场景题，抓住你最自然的社交反应。',
  '主线清楚后，再补几题把你的氛围感校准得更准。',
  '结果会先保存在这台设备里，准备好时再继续登录。',
]

function getProgressStage(progress: AssessmentProgress | null) {
  if (!progress) {
    return {
      badge: '准备中',
      title: '马上开始第一道题',
      description: '先用几道轻松场景题，抓住你最自然的反应。',
    }
  }

  if (progress.answered < progress.minQuestions) {
    return {
      badge: '第一阶段',
      title: '先抓住你的第一感觉',
      description: '按第一直觉作答就好，不需要反复推敲。',
    }
  }

  if (progress.estimatedRemaining <= 2) {
    return {
      badge: '快揭晓了',
      title: '差一点就能看见你的原型',
      description: '主线已经很清楚，再答几题就能完成。',
    }
  }

  return {
    badge: '第二阶段',
    title: '正在细化你的氛围感',
    description: '我们已经抓到大方向，接下来补几笔关键细节。',
  }
}

function getQuestionHelper(questionType: AssessmentQuestionType) {
  switch (questionType) {
    case 'slider':
      return {
        title: '把感觉停在最像你的位置',
        description: '拖到你最自然的倾向，再点确认就好。',
      }
    case 'emoji_tap':
      return {
        title: '选最像你本能反应的表情',
        description: '看到哪个反应最像你，就直接点哪个。',
      }
    default:
      return {
        title: '按第一直觉轻点一下',
        description: '轻点最像你的选项，下一题会自动出现。',
      }
  }
}

function getSliderLeanCopy(question: AssessmentQuestion, sliderValue: number): string {
  if (!question.sliderConfig) {
    return '拖到最像你的位置，再点确认。'
  }

  if (sliderValue <= 35) {
    return `现在更偏向「${question.sliderConfig.leftLabel}」`
  }

  if (sliderValue >= 65) {
    return `现在更偏向「${question.sliderConfig.rightLabel}」`
  }

  return `现在介于「${question.sliderConfig.leftLabel}」和「${question.sliderConfig.rightLabel}」之间`
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
  const [error, setError] = useState('')

  const isAuthenticated = auth.isAuthenticated
  const hasStoredIncompleteSession = useMemo(() => {
    if (isAuthenticated) {
      return false
    }

    const snapshot = readAnonymousAssessmentSession()
    return Boolean(snapshot?.sessionId && !hasAnonymousAssessmentResult(snapshot))
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
  const questionNumber = (progress?.answered ?? 0) + 1
  const progressStage = getProgressStage(progress)
  const questionHelper = getQuestionHelper(questionType)
  const isNearReveal = Boolean(progress && progress.estimatedRemaining <= 2)
  const sliderLeanCopy = question && questionType === 'slider'
    ? getSliderLeanCopy(question, sliderValue)
    : ''
  const introNoteTitle = isAuthenticated
    ? '完成后会自动接上当前进度'
    : hasStoredIncompleteSession
      ? '上次的测试进度还在'
      : '先测完，再决定要不要登录'
  const introNoteText = isAuthenticated
    ? '测试完成后，系统会按你的真实进度带你去该去的下一步。'
    : hasStoredIncompleteSession
      ? '我们已经替你保留到刚才那一题，点继续就能从那里往下答。'
      : '这份结果会先保存在当前设备里，准备好时再继续登录就好。'
  const introFootnote = isAuthenticated
    ? '这一步只是在当前流程里完成测试，不会改动系统决定的下一步。'
    : '当前只会把结果保存在这台设备里，不会提前要求你登录。'
  const bottomTitle = isSubmitting ? '正在记录你的选择…' : questionHelper.title
  const bottomText = isSubmitting
    ? '马上就会为你切到下一题。'
    : questionType === 'slider'
      ? sliderLeanCopy || questionHelper.description
      : questionHelper.description

  const completeAnonymousAssessment = useCallback(async (targetSessionId: string) => {
    const resultResponse = await apiRequest<AssessmentResultEnvelope>({
      path: `/api/assessment/v4/${encodeURIComponent(targetSessionId)}/result`,
    })

    saveAnonymousAssessmentSession({
      sessionId: targetSessionId,
      phase: 'completed',
      timestamp: Date.now(),
      completedAt: resultResponse.completedAt,
      result: resultResponse.result,
      topArchetypes: resultResponse.topArchetypes ?? currentMatches,
    })

    Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.personalityTestResults })
  }, [currentMatches])

  useEffect(() => {
    if (auth.isLoading) {
      return
    }

    if (auth.isAuthenticated && auth.nextStep && auth.nextStep !== 'personality-test') {
      void navigateToMiniProgramNextStep(auth.nextStep, { mode: 'replace' })
      return
    }

    if (!auth.isAuthenticated && phase === 'intro') {
      const snapshot = readAnonymousAssessmentSession()
      if (hasAnonymousAssessmentResult(snapshot)) {
        Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.personalityTestResults })
      }
    }
  }, [auth.isAuthenticated, auth.isLoading, auth.nextStep, phase])

  const handleStart = useCallback(async () => {
    setError('')
    setIsSubmitting(true)
    try {
      const snapshot = !isAuthenticated ? readAnonymousAssessmentSession() : null
      const shouldResumeAnonymous = Boolean(snapshot?.sessionId && !hasAnonymousAssessmentResult(snapshot))

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
          await navigateToMiniProgramNextStep(userState.nextStep, { mode: 'replace' })
          return
        }

        analytics.stepCompleted({
          isAuthenticated: false,
          answerCount: completedAnswerCount,
          destination: MINI_PROGRAM_ROUTES.personalityTestResults,
        })
        await completeAnonymousAssessment(result.sessionId)
        return
      }

      setPhase('testing')
    } catch (err) {
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
          await navigateToMiniProgramNextStep(userState.nextStep, { mode: 'replace' })
          return
        }

        analytics.stepCompleted({
          isAuthenticated: false,
          answerCount: completedAnswerCount,
          destination: MINI_PROGRAM_ROUTES.personalityTestResults,
        })
        await completeAnonymousAssessment(sessionId)
        return
      }

      setQuestion(result.nextQuestion)
      setProgress(result.progress ?? null)
      setCurrentMatches(result.currentMatches ?? [])
      setSliderValue(50)
    } catch (err) {
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
      <View className='personality-test'>
        <View className='personality-test__loading'>
          <Text className='personality-test__loading-text'>加载中…</Text>
        </View>
      </View>
    )
  }

  // Intro phase
  if (phase === 'intro') {
    return (
      <View className='personality-test'>
        <ScrollView className='personality-test__intro-scroll' scrollY enhanced showScrollbar={false}>
          <View className='personality-test__intro-shell'>
            <Card className='personality-test__hero-card'>
              <Text className='personality-test__eyebrow'>JoyJoin 氛围测试</Text>
              <Text className='personality-test__title'>找出你在人群里的舒服打开方式</Text>
              <Text className='personality-test__subtitle'>
                这不是一份硬邦邦的标准题，更像一次轻松的社交预演。按第一直觉作答，系统会慢慢看见你最像哪种氛围原型。
              </Text>

              <View className='personality-test__highlight-row'>
                {INTRO_HIGHLIGHTS.map((item) => (
                  <View key={item.label} className='personality-test__highlight-chip'>
                    <Text className='personality-test__highlight-emoji'>{item.emoji}</Text>
                    <Text className='personality-test__highlight-text'>{item.label}</Text>
                  </View>
                ))}
              </View>
            </Card>

            <Card className='personality-test__intro-card'>
              <Text className='personality-test__section-title'>你会经历什么</Text>
              <View className='personality-test__step-list'>
                {INTRO_STEPS.map((step, index) => (
                  <View key={step} className='personality-test__step-item'>
                    <Text className='personality-test__step-index'>{index + 1}</Text>
                    <Text className='personality-test__step-copy'>{step}</Text>
                  </View>
                ))}
              </View>
            </Card>

            <Card className='personality-test__intro-note'>
              <Text className='personality-test__intro-note-title'>{introNoteTitle}</Text>
              <Text className='personality-test__intro-note-text'>{introNoteText}</Text>
            </Card>

            {error ? <Text className='personality-test__error'>{error}</Text> : null}

            <View className='personality-test__start-panel'>
              <Button
                className='personality-test__start-btn'
                onClick={handleStart}
                disabled={isSubmitting}
                loading={isSubmitting}
              >
                {isSubmitting ? '准备中…' : hasStoredIncompleteSession ? '继续测试' : '开始测试'}
              </Button>
              <Text className='personality-test__start-footnote'>{introFootnote}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    )
  }

  // Completing phase
  if (phase === 'completing') {
    return (
      <View className='personality-test'>
        <View className='personality-test__status-shell'>
          <Card className='personality-test__status-card'>
            <Text className='personality-test__eyebrow'>结果生成中</Text>
            <Text className='personality-test__title'>正在整理你的氛围线索</Text>
            <Text className='personality-test__subtitle'>
              马上就好，我们正在把你的答案变成一张更立体的社交画像。
            </Text>
          </Card>
        </View>
      </View>
    )
  }

  return (
    <View className='personality-test'>
      <ScrollView className='personality-test__testing-scroll' scrollY enhanced showScrollbar={false}>
        <View className='personality-test__testing-shell'>
          <Card className='personality-test__progress-card'>
            <View className='personality-test__progress-top'>
              <View className='personality-test__progress-copy'>
                <Text className='personality-test__progress-badge'>{progressStage.badge}</Text>
                <Text className='personality-test__progress-title'>{progressStage.title}</Text>
                <Text className='personality-test__progress-caption'>{progressStage.description}</Text>
              </View>

              <View className='personality-test__progress-counter'>
                <Text className='personality-test__progress-counter-number'>{questionNumber}</Text>
                <Text className='personality-test__progress-counter-label'>当前题号</Text>
              </View>
            </View>

            <View className='personality-test__progress-bar'>
              <View className='personality-test__progress-fill' style={{ width: `${progressPercent}%` }} />
            </View>

            <View className='personality-test__progress-meta'>
              <Text className='personality-test__progress-meta-text'>已答 {progress?.answered ?? 0} 题</Text>
              <Text className='personality-test__progress-meta-text'>还剩约 {progress?.estimatedRemaining ?? 0} 题</Text>
            </View>

            {isNearReveal ? (
              <View className='personality-test__progress-pill'>
                <Text className='personality-test__progress-pill-text'>差一点就揭晓啦，接下来几题会更聚焦。</Text>
              </View>
            ) : null}
          </Card>

          {question ? (
            <Card className='personality-test__question-card'>
              <View className='personality-test__question-top'>
                <View className='personality-test__question-heading'>
                  <Text className='personality-test__scenario-label'>场景想象</Text>
                  <Text className='personality-test__scenario'>{question.scenarioText}</Text>
                </View>
                <Text className='personality-test__question-chip'>第 {questionNumber} 题</Text>
              </View>

              <Text className='personality-test__question-text'>{question.questionText}</Text>

              <View className='personality-test__helper-box'>
                <Text className='personality-test__helper-icon'>✨</Text>
                <View className='personality-test__helper-copy'>
                  <Text className='personality-test__helper-title'>{questionHelper.title}</Text>
                  <Text className='personality-test__helper-text'>{questionHelper.description}</Text>
                </View>
              </View>

              {currentMatches.length > 0 ? (
                <View className='personality-test__matches-block'>
                  <Text className='personality-test__matches-label'>目前更像这些氛围</Text>
                  <View className='personality-test__matches'>
                    {currentMatches.slice(0, 2).map((match) => (
                      <Text key={match.archetype} className='personality-test__match-chip'>
                        {match.archetype}
                      </Text>
                    ))}
                  </View>
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
                  <Text className='personality-test__slider-summary'>{sliderLeanCopy}</Text>
                </View>
              ) : null}

              {questionType === 'emoji_tap' ? (
                <View className='personality-test__emoji-grid'>
                  {question.options.map((option) => {
                    const parts = splitEmojiLabel(option.text)
                    return (
                      <Button
                        key={option.value}
                        variant='secondary'
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
                      variant='secondary'
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
            </Card>
          ) : null}
        </View>
      </ScrollView>

      <View className='personality-test__bottom-panel'>
        <Card className='personality-test__bottom-card'>
          {error ? <Text className='personality-test__error personality-test__error--bottom'>{error}</Text> : null}
          <Text className='personality-test__bottom-title'>{bottomTitle}</Text>
          <Text className='personality-test__bottom-text'>{bottomText}</Text>

          {questionType === 'slider' && question ? (
            <Button
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
          ) : null}
        </Card>
      </View>
    </View>
  )
}

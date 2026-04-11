import { View, Text, Button, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useAuthGuard, nextStepToRoute } from '../../../hooks/useAuthGuard'
import { useInvalidateAuth } from '../../../hooks/useAuth'
import { apiRequest } from '../../../lib/api'
import { logInfo, logError } from '../../../lib/logger'
import {
  startAssessment,
  submitAssessmentAnswer,
  type AssessmentQuestion,
} from '@shared/api'
import './index.scss'

type Phase = 'intro' | 'testing' | 'completing'

export default function PersonalityTestPage() {
  const { isLoading } = useAuthGuard()
  const invalidateAuth = useInvalidateAuth()

  const [phase, setPhase] = useState<Phase>('intro')
  const [sessionId, setSessionId] = useState('')
  const [question, setQuestion] = useState<AssessmentQuestion | null>(null)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleStart = useCallback(async () => {
    setError('')
    setIsSubmitting(true)
    try {
      logInfo('[PersonalityTest] Starting assessment session')
      const result = await startAssessment(apiRequest)
      setSessionId(result.sessionId)
      setQuestion(result.question)
      setTotalQuestions(result.totalQuestions)
      setCurrentIndex(result.currentQuestionIndex)
      setPhase('testing')
    } catch (err) {
      const message = err instanceof Error ? err.message : '启动测试失败，请重试'
      setError(message)
      logError('[PersonalityTest] Failed to start', { message })
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  const handleAnswer = useCallback(async (optionId: string) => {
    if (!sessionId || !question || isSubmitting) return

    setIsSubmitting(true)
    setError('')
    try {
      const result = await submitAssessmentAnswer(apiRequest, sessionId, {
        questionId: question.id,
        optionId,
      })

      if (result.isComplete || !result.question) {
        setPhase('completing')
        logInfo('[PersonalityTest] Assessment complete')
        // Re-fetch auth user to get the new nextStep from server
        await invalidateAuth()
        // Small delay to show completion state
        setTimeout(async () => {
          try {
            const userState = await apiRequest<{ nextStep?: string }>({ path: '/api/auth/user' })
            const nextStep = userState.nextStep ?? 'essential-data'
            Taro.redirectTo({ url: nextStepToRoute(nextStep as any) })
          } catch {
            Taro.redirectTo({ url: '/pages/onboarding/essential-data/index' })
          }
        }, 1200)
        return
      }

      setQuestion(result.question)
      setTotalQuestions(result.totalQuestions)
      setCurrentIndex(result.currentQuestionIndex)
    } catch (err) {
      const message = err instanceof Error ? err.message : '提交答案失败，请重试'
      setError(message)
      logError('[PersonalityTest] Failed to submit answer', { message })
    } finally {
      setIsSubmitting(false)
    }
  }, [sessionId, question, isSubmitting, invalidateAuth])

  if (isLoading) {
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
        <View className='personality-test__intro'>
          <Text className='personality-test__title'>氛围测试</Text>
          <Text className='personality-test__subtitle'>
            通过一系列有趣的问题，发现你独特的社交氛围原型
          </Text>
          <Text className='personality-test__hint'>大约需要 3-5 分钟</Text>
          {error ? <Text className='personality-test__error'>{error}</Text> : null}
          <Button
            className='personality-test__start-btn'
            onClick={handleStart}
            disabled={isSubmitting}
            loading={isSubmitting}
          >
            {isSubmitting ? '准备中…' : '开始测试'}
          </Button>
        </View>
      </View>
    )
  }

  // Completing phase
  if (phase === 'completing') {
    return (
      <View className='personality-test'>
        <View className='personality-test__completing'>
          <Text className='personality-test__title'>分析中…</Text>
          <Text className='personality-test__subtitle'>正在为你生成氛围原型画像</Text>
        </View>
      </View>
    )
  }

  // Testing phase
  const progress = totalQuestions > 0 ? Math.round(((currentIndex + 1) / totalQuestions) * 100) : 0

  return (
    <ScrollView className='personality-test' scrollY enhanced showScrollbar={false}>
      <View className='personality-test__progress-bar'>
        <View className='personality-test__progress-fill' style={{ width: `${progress}%` }} />
      </View>
      <View className='personality-test__progress-label'>
        <Text className='personality-test__progress-text'>
          {currentIndex + 1} / {totalQuestions}
        </Text>
      </View>

      {question ? (
        <View className='personality-test__question'>
          <Text className='personality-test__question-text'>{question.text}</Text>
          <View className='personality-test__options'>
            {question.options.map((option) => (
              <Button
                key={option.id}
                className='personality-test__option'
                onClick={() => handleAnswer(option.id)}
                disabled={isSubmitting}
                hoverClass='personality-test__option--active'
              >
                <Text className='personality-test__option-text'>{option.text}</Text>
              </Button>
            ))}
          </View>
        </View>
      ) : null}

      {error ? <Text className='personality-test__error'>{error}</Text> : null}
    </ScrollView>
  )
}

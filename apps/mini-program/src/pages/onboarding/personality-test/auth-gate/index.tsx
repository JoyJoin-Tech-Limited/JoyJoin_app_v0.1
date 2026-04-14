import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Button from '../../../../components/Button'
import Card from '../../../../components/Card'
import { useAuth } from '../../../../hooks/useAuth'
import { useWeChatLogin } from '../../../../hooks/useWeChatLogin'
import { useOnboardingAnalytics } from '../../../../hooks/useOnboardingAnalytics'
import {
  authenticateMiniProgramUserWithTest,
  getUserState,
  type ApiError,
} from '../../../../lib/api'
import {
  clearAnonymousAssessmentStorage,
  getAnonymousAssessmentImportGateState,
  readAnonymousAssessmentAnswers,
  readAnonymousAssessmentSession,
} from '../../../../lib/anonymousOnboarding'
import { seedMiniProgramAuthSession } from '../../../../lib/authSession'
import { MINI_PROGRAM_ROUTES } from '../../../../lib/onboardingRoutes'
import { navigateToMiniProgramNextStep } from '../../../../lib/onboardingNavigation'
import { logError, logInfo } from '../../../../lib/logger'
import './index.scss'

function resolveLoginErrorMessage(error: unknown): string {
  const typedError = error as ApiError | undefined

  if (typedError?.statusCode === 401) {
    return '微信授权已失效，请重新尝试'
  }

  if (typedError?.statusCode === 500) {
    return '服务器暂时忙，请稍后再试'
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return '登录失败，请检查网络连接后重试'
}

export default function PersonalityTestAuthGatePage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [isImportingLogin, setIsImportingLogin] = useState(false)
  const {
    handleWeChatLogin,
    isLoggingIn: isGenericLoggingIn,
  } = useWeChatLogin()

  const sessionSnapshot = useMemo(() => readAnonymousAssessmentSession(), [])
  const answers = useMemo(() => readAnonymousAssessmentAnswers(), [])
  const { hasAnonymousSessionId, hasImportableAnswers, canContinue } = getAnonymousAssessmentImportGateState({
    sessionSnapshot,
    answers,
  })
  const primaryArchetype =
    typeof sessionSnapshot?.result?.primaryArchetype === 'string'
      ? sessionSnapshot.result.primaryArchetype
      : '你的氛围原型'
  const isBusy = isImportingLogin || isGenericLoggingIn
  const heroSubtitle = hasAnonymousSessionId
    ? '这一步会把当前设备里的答题结果一起保存下来；如果刚才的进度还留在这台设备里，我们也会顺手帮你接上。登录成功后，系统会自动带你去该去的下一步。'
    : '这一步会把当前设备里的答题结果一起保存下来。登录成功后，系统会自动带你去该去的下一步。'
  const importSummary = hasAnonymousSessionId
    ? '把这台设备里的测试结果和刚才的进度一起接上'
    : '把这台设备里的测试结果一起保存下来'
  const analytics = useOnboardingAnalytics('personality-test-auth-gate', {
    enabled: !auth.isLoading && !auth.isAuthenticated,
    startMetadata: {
      answerCount: answers.length,
      hasAnonymousSessionId,
      hasImportableAnswers,
      primaryArchetype,
      canContinue,
    },
  })

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      void navigateToMiniProgramNextStep(auth.nextStep, { mode: 'root' })
    }
  }, [auth.isAuthenticated, auth.isLoading, auth.nextStep])

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated && !canContinue) {
      analytics.validationFailed('anonymous-results', 'missing-answers')
    }
  }, [analytics, auth.isAuthenticated, auth.isLoading, canContinue])

  const handleRestartTest = useCallback(() => {
    clearAnonymousAssessmentStorage()
    void Taro.reLaunch({ url: MINI_PROGRAM_ROUTES.personalityTest })
  }, [])

  const handleGenericLogin = useCallback(async () => {
    if (isBusy) {
      return
    }

    await handleWeChatLogin()
  }, [handleWeChatLogin, isBusy])

  const handleLogin = async () => {
    if (!canContinue || isBusy) {
      return
    }

    setIsImportingLogin(true)

    try {
      logInfo('[PersonalityAuthGate] Importing anonymous assessment before login', {
        answerCount: answers.length,
        hasAnonymousSessionId,
      })

      await authenticateMiniProgramUserWithTest({
        testAnswers: answers,
        anonymousSessionId: sessionSnapshot?.sessionId ?? null,
      })

      const userState = await getUserState()
      seedMiniProgramAuthSession(userState, queryClient)
      clearAnonymousAssessmentStorage()

      logInfo('[PersonalityAuthGate] Login successful', { nextStep: userState.nextStep })
      analytics.stepCompleted({
        action: 'login-handoff-success',
        answerCount: answers.length,
        nextStep: userState.nextStep ?? 'essential-data',
      })
      await navigateToMiniProgramNextStep(userState.nextStep, { mode: 'root' })
    } catch (error) {
      const message = resolveLoginErrorMessage(error)
      analytics.errorOccurred('login_handoff_failed', message)
      logError('[PersonalityAuthGate] Login failed', { message })
      Taro.showToast({
        title: message,
        icon: 'none',
        duration: 3000,
      })
    } finally {
      setIsImportingLogin(false)
    }
  }

  if (auth.isLoading) {
    return (
      <View className='personality-auth-gate'>
        <View className='personality-auth-gate__loading'>
          <Text className='personality-auth-gate__loading-text'>加载中…</Text>
        </View>
      </View>
    )
  }

  if (!canContinue) {
    return (
      <View className='personality-auth-gate'>
        <View className='personality-auth-gate__empty'>
          <Text className='personality-auth-gate__title'>这份结果现在接不上</Text>
          <Text className='personality-auth-gate__subtitle'>
            当前设备里没有找到这次测试记录。你可以直接微信登录，让系统按已有进度继续；如果想带上刚才的结果，重新完成一次测试会更稳妥。
          </Text>
          <View className='personality-auth-gate__empty-actions'>
            <Button onClick={handleRestartTest} disabled={isBusy}>
              返回重新测试
            </Button>
            <Button variant='secondary' onClick={() => void handleGenericLogin()} disabled={isBusy}>
              {isGenericLoggingIn ? '登录中…' : '直接微信登录并继续'}
            </Button>
          </View>
        </View>
      </View>
    )
  }

  return (
    <ScrollView className='personality-auth-gate' scrollY enhanced showScrollbar={false}>
      <View className='personality-auth-gate__hero'>
        <Text className='personality-auth-gate__eyebrow'>带着这份结果继续</Text>
        <Text className='personality-auth-gate__title'>登录后，把 {primaryArchetype} 一起带走</Text>
        <Text className='personality-auth-gate__subtitle'>{heroSubtitle}</Text>
      </View>

      <Card className='personality-auth-gate__card'>
        <Text className='personality-auth-gate__card-title'>登录后会发生什么</Text>
        <View className='personality-auth-gate__bullet-list'>
          <Text className='personality-auth-gate__bullet'>1. 完成微信登录，确认你的账号</Text>
          <Text className='personality-auth-gate__bullet'>2. {importSummary}</Text>
          <Text className='personality-auth-gate__bullet'>3. 按当前进度继续完善资料或进入下一步</Text>
        </View>
      </Card>

      <Card className='personality-auth-gate__summary-card'>
        <View className='personality-auth-gate__summary-item'>
          <Text className='personality-auth-gate__summary-label'>当前原型</Text>
          <Text className='personality-auth-gate__summary-value'>{primaryArchetype}</Text>
        </View>
        <View className='personality-auth-gate__summary-divider' />
        <View className='personality-auth-gate__summary-item'>
          <Text className='personality-auth-gate__summary-label'>待保存答案</Text>
          <Text className='personality-auth-gate__summary-value'>{answers.length} 条</Text>
        </View>
      </Card>

      <View className='personality-auth-gate__actions'>
        <Button onClick={handleLogin} disabled={isBusy}>
          {isImportingLogin ? '登录中…' : '微信登录，保存结果并继续'}
        </Button>
        <Button
          variant='secondary'
          onClick={() => Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.personalityTestResults })}
          disabled={isBusy}
        >
          返回看看结果
        </Button>
        <Text className='personality-auth-gate__action-note'>
          只会带上当前设备里的测试结果，不会改动系统决定的下一步。
        </Text>
      </View>
    </ScrollView>
  )
}
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Button from '../../../../components/ui/Button'
import Card from '../../../../components/ui/Card'
import OnboardingLoadingShell from '../../../../components/loading/OnboardingLoadingShell'
import { useAuth } from '../../../../hooks/useAuth'
import { useWeChatLogin } from '../../../../hooks/auth/useWeChatLogin'
import { useOnboardingAnalytics } from '../../../../hooks/onboarding/useOnboardingAnalytics'
import { TOAST_FATAL_MS } from '../../../../lib/utils/uiConstants'
import {
  authenticateMiniProgramUserWithTest,
  getUserState,
  type ApiError,
} from '../../../../lib/api/api'
import {
  clearAnonymousAssessmentStorage,
  getAnonymousAssessmentImportGateState,
  readAnonymousAssessmentAnswers,
  readAnonymousAssessmentSession,
} from '../../../../lib/auth/anonymousOnboarding'
import { seedMiniProgramAuthSession } from '../../../../lib/api/authSession'
import { MINI_PROGRAM_ROUTES } from '../../../../lib/onboarding/onboardingRoutes'
import { navigateToMiniProgramNextStep } from '../../../../lib/onboarding/onboardingNavigation'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { logError, logInfo } from '../../../../lib/utils/logger'
import { archetypeRegistry } from '@shared/personality/archetypeRegistry'
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
  const rawArchetype = sessionSnapshot?.result?.primaryArchetype
  const primaryArchetype =
    typeof rawArchetype === 'string'
      ? archetypeRegistry[rawArchetype]?.name ?? rawArchetype
      : '你的氛围原型'
  const isBusy = isImportingLogin || isGenericLoggingIn
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
        duration: TOAST_FATAL_MS,
      })
    } finally {
      setIsImportingLogin(false)
    }
  }

  if (auth.isLoading) {
    return (
      <OnboardingLoadingShell
        stepLabel='保存匿名结果'
        title={`${DEFAULT_MASCOT_DISPLAY_NAME}在确认你的登录状态`}
        subtitle='先检查微信会话和这台设备上的答题记录，确认好后再把结果稳稳接到正式账号里。'
        hint='这一步不会丢掉刚才的测试结果，只是在做继续前的核对。'
        xiaoyueExpression='loadingSystem'
      />
    )
  }

  if (!canContinue) {
    return (
      <View className='personality-auth-gate'>
        <View className='personality-auth-gate__empty'>
          <Text className='personality-auth-gate__title'>这份结果暂时没法继续导入</Text>
          <Text className='personality-auth-gate__subtitle'>
            当前设备里没有找到可导入的匿名答题记录。你可以直接微信登录，让系统按服务端进度继续；如果想带上这次测试结果，重新完成测试会更稳妥。
          </Text>
          <Button onClick={handleRestartTest} disabled={isBusy}>
            返回重新测试
          </Button>
          <Button variant='secondary' onClick={() => void handleGenericLogin()} disabled={isBusy}>
            {isGenericLoggingIn ? '登录中…' : '直接微信登录并继续'}
          </Button>
        </View>
      </View>
    )
  }

  return (
    <ScrollView className='personality-auth-gate' scrollY enhanced showScrollbar={false}>
      <View className='personality-auth-gate__hero'>
        <Text className='personality-auth-gate__eyebrow'>保存匿名结果</Text>
        <Text className='personality-auth-gate__title'>登录后，继续带着 {primaryArchetype} 往前走</Text>
        <Text className='personality-auth-gate__subtitle'>
          这一步会把当前设备上的匿名答题记录带进登录；如果还能找到匿名 session，也会一并关联。登录成功后再由系统决定真正的下一步。
        </Text>
      </View>

      <Card className='personality-auth-gate__card'>
        <Text className='personality-auth-gate__card-title'>登录后会发生什么</Text>
        <View className='personality-auth-gate__bullet-list'>
          <Text className='personality-auth-gate__bullet'>1. 用微信 code 建立正式登录会话</Text>
          <Text className='personality-auth-gate__bullet'>2. 导入当前设备上的匿名测试答案；如果还能找到匿名 session，也会一并关联</Text>
          <Text className='personality-auth-gate__bullet'>3. 读取系统进度，继续前往基础资料或正确的下一步</Text>
        </View>
      </Card>

      <Card className='personality-auth-gate__card personality-auth-gate__card--compact'>
        <Text className='personality-auth-gate__meta'>待导入答案</Text>
        <Text className='personality-auth-gate__meta-value'>{answers.length} 条</Text>
      </Card>

      <View className='personality-auth-gate__actions'>
        <Button onClick={handleLogin} disabled={isBusy}>
          {isImportingLogin ? '登录中…' : '微信登录并继续'}
        </Button>
        <Button
          variant='secondary'
          onClick={() => Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.personalityTestResults })}
          disabled={isBusy}
        >
          返回看看结果
        </Button>
      </View>
    </ScrollView>
  )
}
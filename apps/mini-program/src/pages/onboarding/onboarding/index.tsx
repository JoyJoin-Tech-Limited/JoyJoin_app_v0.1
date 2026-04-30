import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import Taro from '@tarojs/taro'
import { useEffect } from 'react'
import OnboardingLoadingShell from '../../../components/OnboardingLoadingShell'
import { useAuth } from '../../../hooks/useAuth'
import { navigateToMiniProgramNextStep } from '../../../lib/onboardingNavigation'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboardingRoutes'

/**
 * OnboardingEntryPage — server-driven redirect hub.
 *
 * This page only exists to receive `nextStep=onboarding` from the server
 * and immediately redirect to the correct onboarding step.
 */
export default function OnboardingEntryPage() {
  const { isLoading, isAuthenticated, nextStep } = useAuth()

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated) {
      Taro.reLaunch({ url: MINI_PROGRAM_ROUTES.login })
      return
    }

    // Redirect to the actual step the server says the user should be at
    const step = nextStep ?? 'personality-test'
    void navigateToMiniProgramNextStep(step, { mode: 'replace' })
  }, [isLoading, isAuthenticated, nextStep])

  return (
    <OnboardingLoadingShell
      stepLabel='入门引导'
      title='正在接上你的进度'
      subtitle={`${DEFAULT_MASCOT_DISPLAY_NAME}正在读取服务器上的下一步，马上跳转。`}
      hint='若首次进入，可能会加载一小会儿新手任务包。'
      xiaoyueExpression='loadingSystem'
    />
  )
}

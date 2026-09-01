import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import Taro from '@tarojs/taro'
import { useEffect } from 'react'
import OnboardingLoadingShell from '../../../components/loading/OnboardingLoadingShell'
import { useAuth } from '../../../hooks/useAuth'
import { navigateToMiniProgramNextStep } from '../../../lib/onboarding/onboardingNavigation'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'

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
      Taro.reLaunch({ url: `${MINI_PROGRAM_ROUTES.index}?auth=expired` })
      return
    }

    // Redirect to the actual step the server says the user should be at.
    // 'onboarding' means we're already on the entry page — skip to the
    // first proper step (personality-test) to avoid an infinite redirect loop.
    const effectiveStep = nextStep === 'onboarding' ? 'personality-test' : nextStep
    const step = effectiveStep ?? 'personality-test'
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

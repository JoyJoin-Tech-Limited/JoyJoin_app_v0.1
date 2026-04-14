import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { navigateToMiniProgramNextStep } from '../../../lib/onboardingNavigation'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboardingRoutes'
import './index.scss'

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
    <View className='page'>
      <View className='page__placeholder'>
        <Text className='page__title'>正在准备…</Text>
      </View>
    </View>
  )
}

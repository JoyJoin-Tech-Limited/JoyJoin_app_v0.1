import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { nextStepToRoute } from '../../hooks/useAuthGuard'
import './index.scss'

/**
 * OnboardingEntryPage — server-driven redirect hub.
 *
 * This page only exists to receive `nextStep=onboarding` from the server
 * and immediately redirect to the correct onboarding step.
 */
export default function OnboardingEntryPage() {
  const { user, isLoading, isAuthenticated, nextStep } = useAuth()

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated) {
      Taro.reLaunch({ url: '/pages/login/index' })
      return
    }

    // Redirect to the actual step the server says the user should be at
    const step = nextStep ?? 'personality-test'
    const route = nextStepToRoute(step)
    Taro.redirectTo({ url: route })
  }, [isLoading, isAuthenticated, nextStep])

  return (
    <View className='page'>
      <View className='page__placeholder'>
        <Text className='page__title'>正在准备…</Text>
      </View>
    </View>
  )
}

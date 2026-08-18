import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../hooks/useAuth'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { onboardingAnalytics } from '../../../lib/onboarding/onboardingAnalytics'
import {
  navigateToMiniProgramNextStep,
  markWelcomeBackScreenSeen,
} from '../../../lib/onboarding/onboardingNavigation'
import { restartOnboarding } from '../../../lib/api/api'
import { seedMiniProgramAuthSession } from '../../../lib/api/authSession'
import { getXiaoyueExpressionAsset } from '../../../lib/mascot/xiaoyueExpressions'
import { CEREMONY_HEROES } from '../../../lib/ceremonyHeroes'
import { logError, logInfo } from '../../../lib/utils/logger'
import { TOAST_FATAL_MS } from '../../../lib/utils/uiConstants'
import Button from '../../../components/ui/Button'
import BrandLogo from '../../../components/ui/BrandLogo'
import './index.scss'

const STEP_NAME_MAP: Record<string, string> = {
  'onboarding': '基础资料填写',
  'personality-test': '人格测试',
  'essential-data': '基础资料填写',
  'extended-data': '兴趣标签选择',
  'profile-review': '资料预览确认',
}

export default function WelcomeBackPage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const [isRestarting, setIsRestarting] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const [mascotSrc, setMascotSrc] = useState(getXiaoyueExpressionAsset('coachGuide'))

  // Swipe-back safety: reset transient flags when page is re-shown
  useResetOnShow(setIsNavigating, setIsRestarting)

  // Auth guard + analytics tracking
  useEffect(() => {
    if (auth.isLoading) return

    if (!auth.isAuthenticated) {
      void Taro.reLaunch({ url: '/pages/discover/index' })
      return
    }

    // Track screen shown once (only for authenticated users)
    onboardingAnalytics.interaction('welcome-back', 'screen_shown', { nextStep: auth.nextStep })
  }, [auth.isLoading, auth.isAuthenticated, auth.nextStep])

  const stepName = (auth.nextStep && STEP_NAME_MAP[auth.nextStep]) ?? '基础资料填写'
  const restartsRemaining = auth.user?.restartsRemaining ?? 0

  const handleContinue = async () => {
    if (isNavigating || isRestarting) return
    setIsNavigating(true)
    markWelcomeBackScreenSeen()
    onboardingAnalytics.interaction('welcome-back', 'continue_clicked')

    try {
      await navigateToMiniProgramNextStep(auth.nextStep, { mode: 'replace' })
    } catch (error) {
      const message = error instanceof Error ? error.message : '页面跳转失败，请重试'
      Taro.showToast({ title: message, icon: 'none', duration: 3000 })
      setIsNavigating(false)
    }
  }

  const handleRestartClick = () => {
    onboardingAnalytics.interaction('welcome-back', 'restart_clicked')

    void Taro.showModal({
      title: '确定要重新开始吗？',
      content: `你已填写的资料将被清空，这将消耗 1 次重新开始机会（还剩 ${restartsRemaining} 次）`,
      cancelText: '再想想',
      confirmText: '确认清空并重新开始',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (res.confirm) {
          onboardingAnalytics.interaction('welcome-back', 'restart_confirmed')
          await executeRestart()
        } else if (res.cancel) {
          onboardingAnalytics.interaction('welcome-back', 'restart_cancelled')
        }
      },
    })
  }

  const executeRestart = async () => {
    if (isRestarting) return
    setIsRestarting(true)

    try {
      logInfo('[WelcomeBack] Restarting onboarding')
      const updatedUser = await restartOnboarding()
      seedMiniProgramAuthSession(updatedUser, queryClient)
      markWelcomeBackScreenSeen()

      // Invalidate auth and profile-related queries
      queryClient.invalidateQueries({ queryKey: ['mini-program', 'auth-user'] })
      queryClient.invalidateQueries({ queryKey: ['mini-program', 'profile'] })
      queryClient.invalidateQueries({ queryKey: ['mini-program', 'user-interests'] })

      logInfo('[WelcomeBack] Onboarding restarted, navigating to start', {
        nextStep: updatedUser.nextStep,
      })

      await navigateToMiniProgramNextStep(updatedUser.nextStep, { mode: 'root' })
    } catch (error) {
      const message = error instanceof Error ? error.message : '重新开始失败，请检查网络后重试'
      logError('[WelcomeBack] Restart failed', { message })
      Taro.showToast({
        title: message,
        icon: 'none',
        duration: TOAST_FATAL_MS,
      })
      setIsRestarting(false)
    }
  }

  if (auth.isLoading) {
    return (
      <View className='welcome-back'>
        <View className='welcome-back__skeleton'>
          <BrandLogo size='md' />
          <View className='welcome-back__skeleton-line welcome-back__skeleton-line--title' />
          <View className='welcome-back__skeleton-line welcome-back__skeleton-line--subtitle' />
        </View>
      </View>
    )
  }

  return (
    <View className='welcome-back'>
      {/* C1 — Ceremony hero backdrop behind mascot (Batch C welcome-back-hero) */}
      <Image
        className='welcome-back__hero'
        src={CEREMONY_HEROES.welcomeBack}
        mode='aspectFit'
        ariaLabel=''
        lazyLoad
      />
      <View className='welcome-back__content'>
        {/* Mascot */}
        <View className='welcome-back__mascot-wrap'>
          {mascotSrc !== '' ? (
            <Image
              className='welcome-back__mascot'
              src={mascotSrc}
              mode='aspectFit'
              ariaLabel='悦仔'
              onError={() => setMascotSrc('')}
            />
          ) : (
            <View className='welcome-back__mascot-fallback'>
              <BrandLogo size='lg' />
            </View>
          )}
        </View>

        {/* Text content */}
        <View className='welcome-back__text'>
          <Text className='welcome-back__headline'>欢迎回来</Text>
        </View>

        {/* Step card */}
        <View className='welcome-back__step-card'>
          <Text className='welcome-back__step-label'>上次进度</Text>
          <Text className='welcome-back__step-name'>{stepName}</Text>
        </View>
      </View>

      {/* CTAs */}
      <View className='welcome-back__actions'>
        <Button
          variant='brand'
          className='welcome-back__cta welcome-back__cta--primary'
          hoverClass='welcome-back__cta-hover'
          loading={isNavigating}
          disabled={isRestarting}
          onClick={handleContinue}
        >
          继续完成
        </Button>

        <Button
          variant='secondary'
          className='welcome-back__cta welcome-back__cta--secondary'
          loading={isRestarting}
          disabled={isNavigating}
          onClick={handleRestartClick}
        >
          重新开始（还剩 {restartsRemaining} 次）
        </Button>
      </View>
    </View>
  )
}

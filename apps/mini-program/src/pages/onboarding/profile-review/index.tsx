import { View, Text, Button, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useAuthGuard } from '../../../hooks/useAuthGuard'
import { useInvalidateAuth } from '../../../hooks/useAuth'
import { apiRequest, getUserState } from '../../../lib/api'
import { useOnboardingAnalytics } from '../../../hooks/useOnboardingAnalytics'
import { navigateToMiniProgramNextStep } from '../../../lib/onboardingNavigation'
import { logInfo, logError } from '../../../lib/logger'
import { completeProfileReview } from '@shared/api'
import { getArchetypeVisual } from '../personality-test/visuals'
import './index.scss'

export default function ProfileReviewPage() {
  const { user, isLoading } = useAuthGuard()
  const invalidateAuth = useInvalidateAuth()
  const analytics = useOnboardingAnalytics('profile-review', { enabled: !isLoading })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleComplete = useCallback(async () => {
    if (isSubmitting) return

    setIsSubmitting(true)
    setError('')
    try {
      logInfo('[ProfileReview] Completing profile review')
      await completeProfileReview(apiRequest)

      await invalidateAuth()
      const userState = await getUserState()
      analytics.stepCompleted({
        nextStep: userState.nextStep ?? 'discover',
        hasArchetype: Boolean((user as { archetype?: unknown } | undefined)?.archetype),
      })
      logInfo('[ProfileReview] Onboarding complete, routing from refreshed nextStep', {
        nextStep: userState.nextStep,
      })
      await navigateToMiniProgramNextStep(userState.nextStep, { mode: 'replace' })
    } catch (err) {
      const message = err instanceof Error ? err.message : '操作失败，请重试'
      setError(message)
      analytics.errorOccurred('complete_failed', message)
      logError('[ProfileReview] Complete failed', { message })
      Taro.showToast({ title: message, icon: 'none', duration: 3000 })
    } finally {
      setIsSubmitting(false)
    }
  }, [analytics, invalidateAuth, isSubmitting, user])

  if (isLoading) {
    return (
      <View className='profile-review'>
        <View className='profile-review__loading'>
          <Text className='profile-review__loading-text'>加载中…</Text>
        </View>
      </View>
    )
  }

  const displayName = (user?.displayName as string) || (user?.nickname as string) || '悦聚用户'
  const gender = (user?.gender as string) || ''
  const birthYear = user?.birthYear ? `${user.birthYear}年` : ''
  const currentCity = (user?.currentCity as string) || ''
  const archetype = (user as any)?.archetype as string | undefined
  const visual = archetype ? getArchetypeVisual(archetype) : null

  return (
    <ScrollView className='profile-review' scrollY enhanced showScrollbar={false}>
      <View className='profile-review__header'>
        <Text className='profile-review__title'>资料预览</Text>
        <Text className='profile-review__subtitle'>确认你的信息，准备好开始探索</Text>
      </View>

      {/* Archetype card */}
      {archetype ? (
        <View className='profile-review__card profile-review__card--archetype'>
          <Text className='profile-review__card-label'>你的氛围原型</Text>
          {visual?.asset ? <Image className='profile-review__archetype-portrait' src={visual.asset} mode='aspectFit' /> : null}
          <Text className='profile-review__archetype-name'>{archetype}</Text>
        </View>
      ) : null}

      {/* Basic info card */}
      <View className='profile-review__card'>
        <Text className='profile-review__card-title'>基本信息</Text>
        <View className='profile-review__info-row'>
          <Text className='profile-review__info-label'>昵称</Text>
          <Text className='profile-review__info-value'>{displayName}</Text>
        </View>
        {gender ? (
          <View className='profile-review__info-row'>
            <Text className='profile-review__info-label'>性别</Text>
            <Text className='profile-review__info-value'>{gender}</Text>
          </View>
        ) : null}
        {birthYear ? (
          <View className='profile-review__info-row'>
            <Text className='profile-review__info-label'>出生年份</Text>
            <Text className='profile-review__info-value'>{birthYear}</Text>
          </View>
        ) : null}
        {currentCity ? (
          <View className='profile-review__info-row'>
            <Text className='profile-review__info-label'>所在城市</Text>
            <Text className='profile-review__info-value'>{currentCity}</Text>
          </View>
        ) : null}
      </View>

      {error ? <Text className='profile-review__error'>{error}</Text> : null}

      <View className='profile-review__footer'>
        <Button
          className='profile-review__submit'
          onClick={handleComplete}
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          {isSubmitting ? '正在完成…' : '确认并进入悦聚'}
        </Button>
        <Text className='profile-review__hint'>你可以随时在「我的」页面修改资料</Text>
      </View>
    </ScrollView>
  )
}

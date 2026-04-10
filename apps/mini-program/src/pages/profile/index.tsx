import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { getCurrentUser, getUserCoupons } from '@shared/api'
import { getOnboardingStepLabel, nextStepToOnboardingStep } from '@shared/onboarding'
import { apiRequest } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { logInfo } from '../../lib/logger'
import './index.scss'

export default function ProfilePage() {
  const { isAuthenticated, isLoading: authLoading, user: authUser } = useAuth()

  const { data: user } = useQuery({
    queryKey: ['mini-program', 'auth-user-profile'],
    queryFn: () => getCurrentUser(apiRequest),
    enabled: isAuthenticated,
  })

  const { data: coupons = { count: 0, coupons: [] } } = useQuery({
    queryKey: ['mini-program', 'coupons'],
    queryFn: () => getUserCoupons(apiRequest),
    enabled: isAuthenticated,
  })

  const handleLogout = () => {
    // Clear cookies and session by navigating to login
    logInfo('[Profile] User initiated logout')
    Taro.reLaunch({ url: '/pages/login/index' })
  }

  if (authLoading) {
    return (
      <View className='profile-page'>
        <View className='profile-page__loading'>
          <Text className='profile-page__loading-text'>加载中…</Text>
        </View>
      </View>
    )
  }

  if (!isAuthenticated) {
    return (
      <View className='profile-page'>
        <View className='profile-page__empty-state'>
          <Text className='profile-page__empty-emoji'>👤</Text>
          <Text className='profile-page__empty-text'>登录后查看个人资料</Text>
          <View
            className='profile-page__login-btn'
            onClick={() => Taro.navigateTo({ url: '/pages/login/index' })}
          >
            <Text className='profile-page__login-btn-text'>去登录</Text>
          </View>
        </View>
      </View>
    )
  }

  const displayName = (user as any)?.nickname || (user as any)?.displayName || '悦聚用户'
  const archetype = (user as any)?.archetype || (authUser as any)?.archetype
  const nextStep = (user as any)?.nextStep || authUser?.nextStep

  return (
    <ScrollView className='profile-page' scrollY enhanced showScrollbar={false}>
      {/* Hero section */}
      <View className='profile-page__hero'>
        <View className='profile-page__avatar'>
          <Text className='profile-page__avatar-text'>{displayName[0]}</Text>
        </View>
        <Text className='profile-page__name'>{displayName}</Text>
        {archetype ? (
          <Text className='profile-page__archetype'>{archetype}</Text>
        ) : null}
      </View>

      {/* Quick stats */}
      <View className='profile-page__stats'>
        <View className='profile-page__stat'>
          <Text className='profile-page__stat-value'>{coupons.count ?? 0}</Text>
          <Text className='profile-page__stat-label'>优惠券</Text>
        </View>
        <View className='profile-page__stat'>
          <Text className='profile-page__stat-value'>
            {getOnboardingStepLabel(nextStepToOnboardingStep(nextStep))}
          </Text>
          <Text className='profile-page__stat-label'>当前状态</Text>
        </View>
      </View>

      {/* Action cards */}
      <View className='profile-page__section'>
        <View
          className='profile-page__action-row'
          onClick={() => Taro.navigateTo({ url: '/pages/blind-box-payment/index' })}
        >
          <Text className='profile-page__action-icon'>🎁</Text>
          <Text className='profile-page__action-text'>会员权益</Text>
          <Text className='profile-page__action-arrow'>›</Text>
        </View>

        <View
          className='profile-page__action-row'
          onClick={() => Taro.navigateTo({ url: '/pages/journey/index' })}
        >
          <Text className='profile-page__action-icon'>🗺️</Text>
          <Text className='profile-page__action-text'>我的足迹</Text>
          <Text className='profile-page__action-arrow'>›</Text>
        </View>

        <View
          className='profile-page__action-row'
          onClick={() => Taro.navigateTo({ url: '/pages/terms/index' })}
        >
          <Text className='profile-page__action-icon'>📄</Text>
          <Text className='profile-page__action-text'>服务条款</Text>
          <Text className='profile-page__action-arrow'>›</Text>
        </View>
      </View>

      {/* Logout */}
      <View className='profile-page__logout-section'>
        <Button className='profile-page__logout-btn' onClick={handleLogout}>
          退出登录
        </Button>
      </View>

      <View className='profile-page__spacer' />
    </ScrollView>
  )
}

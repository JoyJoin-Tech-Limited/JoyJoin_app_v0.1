import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import { getCurrentUser, getUserCoupons } from '@shared/api'
import { getOnboardingStepLabel, nextStepToOnboardingStep } from '@shared/onboarding'
import { apiRequest } from '../../lib/api'
import {
  clearMiniProgramAuthSession,
  getApiErrorStatusCode,
  isUnauthorizedApiError,
} from '../../lib/authSession'
import { useMiniPageGate } from '../../hooks/useMiniPageGate'
import { useCustomTabBarSync } from '../../hooks/useCustomTabBarSync'
import type { AuthUser } from '../../hooks/useAuth'
import { logError, logInfo } from '../../lib/logger'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboardingRoutes'
import { openMiniProgramPaymentPage } from '../../lib/paymentEntry'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { MINI_PROGRAM_TAB_INDEX } from '../../lib/tabBarConfig'
import './index.scss'

export default function ProfilePage() {
  const { authLoading, authUser, renderGate } = useMiniPageGate()
  const logoutLockRef = useRef(false)

  useCustomTabBarSync({
    selectedIndex: MINI_PROGRAM_TAB_INDEX.profile,
    enabled: !authLoading,
  })

  const { data: user } = useQuery<AuthUser>({
    queryKey: ['mini-program', 'auth-user-profile'],
    queryFn: () => getCurrentUser(apiRequest) as Promise<AuthUser>,
    enabled: !authLoading && !!authUser,
  })

  const { data: coupons = { count: 0, availableCount: 0, coupons: [] } } = useQuery({
    queryKey: ['mini-program', 'coupons'],
    queryFn: () => getUserCoupons(apiRequest),
    enabled: !authLoading && !!authUser,
  })

  const handleOpenPayment = () => {
    void openMiniProgramPaymentPage({
      paymentsEnabled: user?.paymentsEnabled ?? authUser?.paymentsEnabled,
      currentUserId: user?.id ?? authUser?.id,
    })
  }

  const handleLogout = async () => {
    if (logoutLockRef.current) {
      return
    }

    logoutLockRef.current = true
    logInfo('[Profile] User initiated logout')

    try {
      await apiRequest<{ message: string }>({
        path: '/api/auth/logout',
        method: 'POST',
        handleUnauthorized: false,
      })

      clearMiniProgramAuthSession({ mode: 'hard' })
      Taro.reLaunch({ url: MINI_PROGRAM_ROUTES.login })
    } catch (error) {
      if (isUnauthorizedApiError(error)) {
        clearMiniProgramAuthSession({ mode: 'hard' })
        Taro.reLaunch({ url: MINI_PROGRAM_ROUTES.login })
        return
      }

      logError('[Profile] Logout failed', {
        statusCode: getApiErrorStatusCode(error),
        message: error instanceof Error ? error.message : 'Unknown error',
      })

      Taro.showToast({
        title: '退出登录失败，请稍后重试',
        icon: 'none',
        duration: 3000,
      })
    } finally {
      logoutLockRef.current = false
    }
  }

  const displayName = user?.nickname || user?.displayName || authUser?.nickname || authUser?.displayName || '悦聚用户'
  const archetype = user?.archetype || authUser?.archetype
  const nextStep = user?.nextStep || authUser?.nextStep

  return renderGate(
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
        <Card className='profile-page__stat'>
          <Text className='profile-page__stat-value'>{coupons.count ?? 0}</Text>
          <Text className='profile-page__stat-label'>优惠券</Text>
        </Card>
        <Card className='profile-page__stat'>
          <Text className='profile-page__stat-value'>
            {getOnboardingStepLabel(nextStepToOnboardingStep(nextStep))}
          </Text>
          <Text className='profile-page__stat-label'>当前状态</Text>
        </Card>
      </View>

      {/* Action cards */}
      <View className='profile-page__section'>
        <View
          className='profile-page__action-row'
          onClick={() => Taro.navigateTo({ url: '/pages/edit-profile/index' })}
        >
          <Text className='profile-page__action-icon'>✏️</Text>
          <Text className='profile-page__action-text'>编辑资料</Text>
          <Text className='profile-page__action-arrow'>›</Text>
        </View>

        <View
          className='profile-page__action-row'
          onClick={() => Taro.navigateTo({ url: '/pages/rewards/index' })}
        >
          <Text className='profile-page__action-icon'>🏆</Text>
          <Text className='profile-page__action-text'>奖励福利</Text>
          <Text className='profile-page__action-arrow'>›</Text>
        </View>

        <View
          className='profile-page__action-row'
          onClick={() => Taro.navigateTo({ url: '/pages/invite/index' })}
        >
          <Text className='profile-page__action-icon'>🤝</Text>
          <Text className='profile-page__action-text'>邀请好友</Text>
          <Text className='profile-page__action-arrow'>›</Text>
        </View>

        <View
          className='profile-page__action-row'
          onClick={handleOpenPayment}
        >
          <Text className='profile-page__action-icon'>🎁</Text>
          <Text className='profile-page__action-text'>我的权益</Text>
          <Text className='profile-page__action-arrow'>›</Text>
        </View>

        <View
          className='profile-page__action-row'
          onClick={() => Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events })}
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
        <Button variant='secondary' className='profile-page__logout-btn' onClick={handleLogout}>
          退出登录
        </Button>
      </View>

      <View className='profile-page__spacer' />
    </ScrollView>
  )
}

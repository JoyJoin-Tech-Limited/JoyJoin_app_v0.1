import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getUserCoupons, getJoinedEvents } from '@shared/api'
import { getOnboardingStepLabel, nextStepToOnboardingStep } from '@shared/onboarding'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { getArchetypeFamily, ARCHETYPE_FAMILY_GRADIENTS } from '@shared/archetypeColors'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { haptics } from '../../lib/utils/haptics'
import { apiRequest } from '../../lib/api/api'
import {
  clearMiniProgramAuthSession,
  getApiErrorStatusCode,
  isUnauthorizedApiError,
} from '../../lib/api/authSession'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { logError, logInfo } from '../../lib/utils/logger'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { openMiniProgramPaymentPage } from '../../lib/payment/paymentEntry'
import ArchetypeHead from '../../components/mascot/ArchetypeHead'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import { MILESTONE_BADGES } from '../../lib/milestoneBadges'
import './index.scss'

export default function ProfilePage() {
  const { authLoading, authUser, renderGate } = useMiniPageGate()
  const logoutLockRef = useRef(false)

  useCustomTabBarSync({
    enabled: !authLoading,
  })

  const { data: coupons = { count: 0, availableCount: 0, coupons: [] }, isLoading: isLoadingCoupons } = useQuery({
    queryKey: ['mini-program', 'coupons'],
    queryFn: () => getUserCoupons(apiRequest),
    enabled: !authLoading && !!authUser,
  })

  const { data: joinedEvents = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['mini-program', 'joined-events'],
    queryFn: () => getJoinedEvents(apiRequest),
    enabled: !authLoading && !!authUser,
  })

  const joinedEventsCount = joinedEvents.length
  const isLoadingStats = isLoadingCoupons || isLoadingEvents

  const handleOpenPayment = () => {
    haptics('light')
    void openMiniProgramPaymentPage({
      currentUserId: authUser?.id,
    })
  }
  // new update for handle open personality test
  const handleOpenPersonalityTest = () => {
    haptics('light')
    if(archetype) {
      void Taro.navigateTo({ 
        url: `${MINI_PROGRAM_ROUTES.personalityTest}?source=profile`,

      })
      return
    } 
    void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.personalityTest })
  }
  const handleLogout = async () => {
    if (logoutLockRef.current) {
      return
    }

    haptics('medium')
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
        title: getErrorMessage('logout-failed'),
        icon: 'none',
        duration: 3000,
      })
    } finally {
      logoutLockRef.current = false
    }
  }

  const displayName = authUser?.nickname || authUser?.displayName || '悦聚用户'
  // const archetype = authUser?.archetype
  const archetype = authUser?.archetype ?? authUser?.primaryArchetype ?? null
  const nextStep = authUser?.nextStep

  return renderGate(
    <View className='profile-page tab-page-enter'>
      <ScrollView className='profile-page__scroll' scrollY enhanced showScrollbar={false}>
        {/* Hero section */}
        <View className='profile-page__hero'>
          <View className='profile-page__avatar'>
            <ArchetypeHead archetype={archetype} size={120} fallbackText={displayName} />
          </View>
          <Text className='profile-page__name'>{displayName}</Text>
          {/*{archetype ? (
            <Text className='profile-page__archetype'>
              {ARCHETYPE_BY_ID[archetype]?.nameCn || archetype}
            </Text>
          ) : null}
           */}
          <View
            className={archetype ? 'profile-page__archetype': 'profile-page__archetype'}
            onClick={handleOpenPersonalityTest}
          >
            <Text>
              {archetype 
                ? (ARCHETYPE_BY_ID[archetype]?.nameCn || archetype)
                : '测试你的社交原型'}
            </Text>
          </View>
        </View>

        {/* Archetype Celebration Card */}
        {archetype && (
          <View
            className='profile-page__archetype-card profile-page__archetype-card--visible'
            style={{ background: ARCHETYPE_FAMILY_GRADIENTS[getArchetypeFamily(archetype)] }}
          >
            <View className='profile-page__archetype-card-inner'>
              <ArchetypeHead archetype={archetype} size={64} />
              <View className='profile-page__archetype-card-text'>
                <Text className='profile-page__archetype-card-label'>你的社交原型</Text>
                <Text className='profile-page__archetype-card-name'>
                  {ARCHETYPE_BY_ID[archetype]?.nameCn || archetype}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Quick stats */}
        <View className='profile-page__stats'>
          <Card className='profile-page__stat'>
            <Text className='profile-page__stat-value'>
              {isLoadingStats ? '—' : (coupons.count ?? 0)}
            </Text>
            <Text className='profile-page__stat-label'>优惠券</Text>
          </Card>
          <Card className='profile-page__stat'>
            <Text className='profile-page__stat-value'>
              {isLoadingStats ? '—' : getOnboardingStepLabel(nextStepToOnboardingStep(nextStep))}
            </Text>
            <Text className='profile-page__stat-label'>匹配进度</Text>
          </Card>
        </View>

        {/* D1 + D2 — Milestone badges row (Batch D) */}
        {!isLoadingStats && (joinedEventsCount >= 1 || joinedEventsCount >= 3) && (
          <View className='profile-page__milestones'>
            <Text className='profile-page__milestones-title'>我的成就</Text>
            <View className='profile-page__milestones-row'>
              {joinedEventsCount >= 1 && (
                <View
                  className='profile-page__milestone'
                  hoverClass='profile-page__milestone--pressed'
                  onClick={() => { haptics('light'); Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events }) }}
                  aria-label='已参加 1 场活动'
                >
                  <Image
                    className='profile-page__milestone-img'
                    mode='aspectFit'
                    src={MILESTONE_BADGES.firstEvent}
                    lazyLoad
                  />
                  <Text className='profile-page__milestone-label'>初次见面</Text>
                </View>
              )}
              {joinedEventsCount >= 3 && (
                <View
                  className='profile-page__milestone'
                  hoverClass='profile-page__milestone--pressed'
                  onClick={() => { haptics('light'); Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events }) }}
                  aria-label='已参加 3 场活动'
                >
                  <Image
                    className='profile-page__milestone-img'
                    mode='aspectFit'
                    src={MILESTONE_BADGES.streak3}
                    lazyLoad
                  />
                  <Text className='profile-page__milestone-label'>三场连击</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Action cards */}
        <View className='profile-page__section'>
          <View
            className='profile-page__action-row'
            hoverClass='profile-page__action-row--active'
            onClick={() => { haptics('light'); Taro.navigateTo({ url: '/pages/edit-profile/index' }) }}
          >
            <JoyJoinIcon emoji='✏️' size={24} className='profile-page__action-icon' />
            <Text className='profile-page__action-text'>编辑资料</Text>
            <Text className='profile-page__action-arrow'>›</Text>
          </View>

          <View
            className='profile-page__action-row'
            hoverClass='profile-page__action-row--active'
            onClick={() => { haptics('light'); Taro.navigateTo({ url: '/pages/rewards/index' }) }}
          >
            <JoyJoinIcon emoji='🏆' size={24} className='profile-page__action-icon' />
            <Text className='profile-page__action-text'>奖励福利</Text>
            <View className='profile-page__action-badge'>
              <Text className='profile-page__action-count'>{coupons.count ?? 0}</Text>
            </View>
            <Text className='profile-page__action-arrow'>›</Text>
          </View>

          <View
            className='profile-page__action-row'
            hoverClass='profile-page__action-row--active'
            onClick={() => { haptics('light'); Taro.navigateTo({ url: '/pages/invite/index' }) }}
          >
            <JoyJoinIcon emoji='🤝' tier='semantic' size={24} className='profile-page__action-icon' />
            <Text className='profile-page__action-text'>邀请好友</Text>
            <Text className='profile-page__action-arrow'>›</Text>
          </View>

          <View
            className='profile-page__action-row'
            hoverClass='profile-page__action-row--active'
            onClick={handleOpenPayment}
          >
            <JoyJoinIcon emoji='🎁' size={24} className='profile-page__action-icon' />
            <Text className='profile-page__action-text'>我的权益</Text>
            <Text className='profile-page__action-arrow'>›</Text>
          </View>

          <View
            className='profile-page__action-row'
            hoverClass='profile-page__action-row--active'
            onClick={() => { haptics('light'); Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events }) }}
          >
            <JoyJoinIcon emoji='🗺️' size={24} className='profile-page__action-icon' />
            <Text className='profile-page__action-text'>我的足迹</Text>
            {joinedEventsCount > 0 && (
              <View className='profile-page__action-badge'>
                <Text className='profile-page__action-count'>{joinedEventsCount}</Text>
              </View>
            )}
            <Text className='profile-page__action-arrow'>›</Text>
          </View>

          <View
            className='profile-page__action-row'
            hoverClass='profile-page__action-row--active'
            onClick={() => { haptics('light'); Taro.navigateTo({ url: '/pages/terms/index' }) }}
          >
            <JoyJoinIcon emoji='📄' size={24} className='profile-page__action-icon' />
            <Text className='profile-page__action-text'>服务条款</Text>
            <Text className='profile-page__action-arrow'>›</Text>
          </View>
        </View>

        {/* Logout */}
        <View className='profile-page__logout-section'>
          <Button variant='secondary' className='profile-page__logout-btn' hoverClass='profile-page__logout-btn--active' onClick={handleLogout}>
            退出登录
          </Button>
        </View>

        <View className='profile-page__spacer' />
      </ScrollView>
    </View>
  )
}

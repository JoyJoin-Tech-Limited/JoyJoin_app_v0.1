import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { haptics } from '../../lib/utils/haptics'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getProfileShell, type ProfileShellResponse } from '@shared/api'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { getArchetypeFamily, ARCHETYPE_FAMILY_GRADIENTS } from '@shared/archetypeColors'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { apiRequest } from '../../lib/api/api'
import {
  AUTH_QUERY_KEY,
  clearMiniProgramAuthSession,
  getApiErrorStatusCode,
  isUnauthorizedApiError,
} from '../../lib/api/authSession'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import type { AuthUser } from '../../hooks/useAuth'
import { logError, logInfo } from '../../lib/utils/logger'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { openMiniProgramPaymentPage } from '../../lib/payment/paymentEntry'
import { getXiaoyueExpressionAsset, type XiaoyueExpressionId } from '../../lib/mascot/xiaoyueExpressions'
import { localAsset } from '../../lib/utils/cdnAssets'
import { profileAnalytics } from '../../lib/analytics/profileAnalytics'
import ArchetypeHead from '../../components/mascot/ArchetypeHead'
import { useCountUp } from '../../hooks/useCountUp'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import './index.scss'

const UI_ICONS = {
  people: localAsset('/assets/icons/ui/icon-people.webp'),
  footprint: localAsset('/assets/icons/ui/icon-footprint.webp'),
  edit: localAsset('/assets/icons/ui/icon-edit.webp'),
  coupon: localAsset('/assets/icons/ui/icon-coupon.webp'),
  link: localAsset('/assets/icons/ui/icon-link.webp'),
  price: localAsset('/assets/icons/ui/icon-price.webp'),
  status: localAsset('/assets/icons/ui/icon-status.webp'),
}

const FIRST_EVENT_BADGE = localAsset('/assets/badges/first-event-celebrate-20260604-v1.webp')
const STREAK_3_BADGE = localAsset('/assets/badges/streak-3-events-20260604-v1.webp')

const DEFAULT_BRAND_GRADIENT = 'linear-gradient(135deg, #8B5CF6, #EC4899)'

function getProfileCompletion(user?: AuthUser | null): number {
  if (!user) return 0
  const essential = user.profileEssentialComplete ? 40 : 0
  const extended = user.profileExtendedComplete ? 30 : 0
  const archetype = user.archetype ? 30 : 0
  return essential + extended + archetype
}

function getXiaoyueGreeting(
  displayName: string,
  completion: number,
  archetype?: string | null,
): string {
  if (!archetype) {
    return '先测测你是哪种社交原型？'
  }
  if (completion < 100) {
    return `${displayName}，完成资料，让更多人找到你`
  }
  return `${displayName}，今天想探索什么？`
}

interface StatItem {
  key: string
  label: string
  value: string
  numericValue: number
  emptyValue?: string
  icon: string
  action: () => void
  isEmpty: boolean
  progress?: number
}

interface MenuItem {
  key: string
  label: string
  icon: string
  badge?: number
  action: () => void
}

interface MascotReaction {
  expression: XiaoyueExpressionId
  text: string
}

export default function ProfilePage() {
  const { authLoading, authUser, renderGate } = useMiniPageGate()
  const queryClient = useQueryClient()
  const logoutLockRef = useRef(false)
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [entered, setEntered] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [refresherTriggered, setRefresherTriggered] = useState(false)
  const [mascotReaction, setMascotReaction] = useState<MascotReaction | null>(null)

  const { isDegradation } = useDeviceTier()
  const shouldReduceMotion = reducedMotion || isDegradation

  useCustomTabBarSync({
    enabled: !authLoading,
  })

  useEffect(() => {
    try {
      const info = Taro.getSystemInfoSync()
      setReducedMotion((info as any).reduceMotion === true)
    } catch {
      setReducedMotion(false)
    }
  }, [])

  useEffect(() => {
    if (shouldReduceMotion) {
      setEntered(true)
      return
    }
    const timer = setTimeout(() => setEntered(true), 50)
    return () => clearTimeout(timer)
  }, [shouldReduceMotion])

  const {
    data: shell,
    isLoading: isLoadingShell,
    error: shellError,
    isRefetching,
  } = useQuery<ProfileShellResponse>({
    queryKey: ['mini-program', 'profile-shell'],
    queryFn: () => getProfileShell(apiRequest),
    enabled: !authLoading && !!authUser,
    staleTime: 60_000,
  })

  useDidShow(() => {
    void queryClient.invalidateQueries({ queryKey: ['mini-program', 'profile-shell'] })
    void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY })
  })

  const handleRefresh = useCallback(() => {
    setRefresherTriggered(true)
    void queryClient.invalidateQueries({ queryKey: ['mini-program', 'profile-shell'] })
    void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY })
  }, [queryClient])

  useEffect(() => {
    setRefresherTriggered(isRefetching)
  }, [isRefetching])

  const handleOpenPayment = () => {
    haptics('light')
    void openMiniProgramPaymentPage({
      currentUserId: authUser?.id,
    })
  }

  const clearReaction = useCallback(() => {
    if (reactionTimerRef.current) {
      clearTimeout(reactionTimerRef.current)
      reactionTimerRef.current = null
    }
    setMascotReaction(null)
  }, [])

  const triggerReaction = useCallback(
    (statKey: string, value: number) => {
      clearReaction()

      let expression: XiaoyueExpressionId = 'actionSuccess'
      let text = ''

      if (statKey === 'events') {
        text =
          value === 0
            ? '去活动页看看，第一场在等你'
            : `已经参加了 ${value} 场活动，真棒！`
      } else if (statKey === 'connections') {
        text =
          value === 0
            ? '参加活动后，连接会在这里生长'
            : `已有 ${value} 个连接，继续闪闪发光`
      } else if (statKey === 'completion') {
        expression = value < 100 ? 'coachGuide' : 'actionSuccess'
        text =
          value < 100
            ? '资料再完善一点，匹配会更准哦'
            : '资料完整度 100%，社交 passport 就绪'
      }

      if (text) {
        setMascotReaction({ expression, text })
        reactionTimerRef.current = setTimeout(() => {
          setMascotReaction(null)
        }, 1800)
      }
    },
    [clearReaction],
  )

  const handleLogout = async () => {
    if (isLoggingOut || logoutLockRef.current) {
      return
    }

    haptics('medium')
    profileAnalytics.track('profile_logout_tap')
    logoutLockRef.current = true
    setIsLoggingOut(true)
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
      setIsLoggingOut(false)
    }
  }

  useEffect(() => {
    return () => {
      if (reactionTimerRef.current) {
        clearTimeout(reactionTimerRef.current)
      }
    }
  }, [])

  const displayName = authUser?.nickname || authUser?.displayName || '悦聚用户'
  const archetype = authUser?.archetype
  const completion = getProfileCompletion(authUser)
  const eventsJoined = shell?.stats?.eventsJoined ?? 0
  const connectionsCount = shell?.stats?.connectionsCount ?? 0
  const couponsCount = shell?.coupons?.count ?? 0

  const archetypeName = archetype ? ARCHETYPE_BY_ID[archetype]?.nameCn || archetype : null
  const archetypeGradient = archetype
    ? ARCHETYPE_FAMILY_GRADIENTS[getArchetypeFamily(archetype)] || DEFAULT_BRAND_GRADIENT
    : undefined

  const greetingText = mascotReaction?.text ?? getXiaoyueGreeting(displayName, completion, archetype)
  const greetingExpression = mascotReaction?.expression ?? 'homeWelcome'

  const countUpEnabled = !isLoadingShell && entered && !shouldReduceMotion
  const eventsDisplay = useCountUp(eventsJoined, { enabled: countUpEnabled, delay: 200 })
  const connectionsDisplay = useCountUp(connectionsCount, { enabled: countUpEnabled, delay: 320 })
  const completionDisplay = useCountUp(completion, { enabled: countUpEnabled, delay: 440 })

  const stats: StatItem[] = useMemo(
    () => [
      {
        key: 'events',
        label: '已参加活动',
        value: String(eventsDisplay),
        numericValue: eventsJoined,
        emptyValue: '去遇见',
        icon: UI_ICONS.footprint,
        action: () => {
          haptics('light')
          profileAnalytics.track('profile_stat_tap', { stat: 'events', value: eventsJoined })
          triggerReaction('events', eventsJoined)
          void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events })
        },
        isEmpty: eventsJoined === 0,
      },
      {
        key: 'connections',
        label: '我的连接数',
        value: String(connectionsDisplay),
        numericValue: connectionsCount,
        emptyValue: '活动后解锁',
        icon: UI_ICONS.people,
        action: () => {
          haptics('light')
          profileAnalytics.track('profile_stat_tap', {
            stat: 'connections',
            value: connectionsCount,
          })
          triggerReaction('connections', connectionsCount)
          void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.connections })
        },
        isEmpty: connectionsCount === 0,
      },
      {
        key: 'completion',
        label: '资料完成度',
        value: `${completionDisplay}%`,
        numericValue: completion,
        emptyValue: '去完善',
        icon: UI_ICONS.edit,
        action: () => {
          haptics('light')
          profileAnalytics.track('profile_stat_tap', { stat: 'completion', value: completion })
          triggerReaction('completion', completion)
          if (completion === 100) {
            void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.personalityTestResults })
          } else {
            void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.editProfile })
          }
        },
        isEmpty: completion < 100,
        progress: completion,
      },
    ],
    [
      eventsDisplay,
      eventsJoined,
      connectionsDisplay,
      connectionsCount,
      completionDisplay,
      completion,
      triggerReaction,
    ],
  )

  const menuItems: MenuItem[] = useMemo(
    () => [
      {
        key: 'edit-profile',
        label: '编辑资料',
        icon: UI_ICONS.edit,
        action: () => {
          haptics('light')
          profileAnalytics.track('profile_menu_tap', { menu: 'edit-profile' })
          void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.editProfile })
        },
      },
      {
        key: 'rewards',
        label: '奖励福利',
        icon: UI_ICONS.coupon,
        badge: couponsCount > 0 ? couponsCount : undefined,
        action: () => {
          haptics('light')
          profileAnalytics.track('profile_menu_tap', { menu: 'rewards' })
          void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.rewards })
        },
      },
      {
        key: 'invite',
        label: '邀请好友',
        icon: UI_ICONS.link,
        action: () => {
          haptics('light')
          profileAnalytics.track('profile_menu_tap', { menu: 'invite' })
          void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.invite })
        },
      },
      {
        key: 'benefits',
        label: '我的权益',
        icon: UI_ICONS.price,
        action: () => {
          haptics('light')
          profileAnalytics.track('profile_menu_tap', { menu: 'benefits' })
          handleOpenPayment()
        },
      },
      {
        key: 'footprints',
        label: '我的足迹',
        icon: UI_ICONS.footprint,
        action: () => {
          haptics('light')
          profileAnalytics.track('profile_menu_tap', { menu: 'footprints' })
          void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events })
        },
      },
      {
        key: 'terms',
        label: '服务条款',
        icon: UI_ICONS.status,
        action: () => {
          haptics('light')
          profileAnalytics.track('profile_menu_tap', { menu: 'terms' })
          void Taro.navigateTo({ url: '/pages/terms/index' })
        },
      },
    ],
    [couponsCount],
  )

  const showMilestones = eventsJoined >= 1
  const heroEntered = entered || shouldReduceMotion
  const statsEntered = entered || shouldReduceMotion
  const menuEntered = entered || shouldReduceMotion
  const milestonesEntered = entered || shouldReduceMotion

  return renderGate(
    <View
      className={`profile-page tab-page-enter ${isDegradation ? 'profile-page--degradation' : ''}`}
    >
      <ScrollView
        className='profile-page__scroll'
        scrollY
        enhanced
        showScrollbar={false}
        refresherEnabled
        refresherTriggered={refresherTriggered}
        onRefresherRefresh={handleRefresh}
      >
        {/* Hero */}
        {isLoadingShell ? (
          <View className='profile-page__hero-skeleton'>
            <View className='profile-page__avatar-skeleton' />
            <View className='profile-page__name-skeleton' />
            <View className='profile-page__pill-skeleton' />
          </View>
        ) : (
          <View className={`profile-page__hero ${heroEntered ? 'profile-page__hero--entered' : ''}`}>
            <View className='profile-page__avatar-ring'>
              <ArchetypeHead
                archetype={archetype}
                size={120}
                fallbackText={displayName}
                className='profile-page__avatar-head'
              />
            </View>

            <Text className='profile-page__name'>{displayName}</Text>

            {archetype && archetypeName ? (
              <View
                className='profile-page__archetype-pill'
                style={{ background: archetypeGradient }}
                onClick={() => {
                  haptics('light')
                  profileAnalytics.track('profile_archetype_cta_tap', {
                    archetype,
                    hasArchetype: true,
                  })
                  void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.personalityTestResults })
                }}
              >
                <ArchetypeHead archetype={archetype} size={28} />
                <Text className='profile-page__archetype-pill-text'>{archetypeName}</Text>
              </View>
            ) : (
              <View
                className='profile-page__unlock-pill'
                onClick={() => {
                  haptics('light')
                  profileAnalytics.track('profile_archetype_cta_tap', { hasArchetype: false })
                  void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.personalityTest })
                }}
              >
                <Text className='profile-page__unlock-pill-text'>测一测，解锁你的社交原型</Text>
              </View>
            )}

            {/* Xiaoyue greeting */}
            <View className='profile-page__greeting'>
              <Image
                className='profile-page__greeting-mascot'
                src={getXiaoyueExpressionAsset(greetingExpression)}
                mode='aspectFit'
              />
              <View
                key={greetingText}
                className={`profile-page__greeting-bubble ${
                  heroEntered ? 'profile-page__greeting-bubble--entered' : ''
                }`}
              >
                <Text className='profile-page__greeting-text'>{greetingText}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Stats */}
        <View className={`profile-page__stats ${statsEntered ? 'profile-page__stats--entered' : ''}`}>
          {isLoadingShell
            ? Array.from({ length: 3 }).map((_, index) => (
                <View
                  key={`skeleton-stat-${index}`}
                  className='profile-page__stat profile-page__stat--skeleton'
                  style={{ transitionDelay: `${index * 60}ms` }}
                >
                  <View className='profile-page__stat-icon-skeleton' />
                  <View className='profile-page__stat-value-skeleton' />
                  <View className='profile-page__stat-label-skeleton' />
                </View>
              ))
            : stats.map((stat, index) => (
                <View
                  key={stat.key}
                  className='profile-page__stat'
                  style={{ transitionDelay: `${index * 60}ms` }}
                  hoverClass='profile-page__stat--pressed'
                  onClick={stat.action}
                  aria-label={`${stat.label} ${stat.value}`}
                >
                  <Image className='profile-page__stat-icon' src={stat.icon} mode='aspectFit' />
                  <Text className='profile-page__stat-value'>
                    {stat.isEmpty && stat.emptyValue ? stat.emptyValue : stat.value}
                  </Text>
                  <Text className='profile-page__stat-label'>{stat.label}</Text>
                  {stat.progress !== undefined && (
                    <View className='profile-page__stat-progress'>
                      <View
                        className='profile-page__stat-progress-bar'
                        style={{ transform: `scaleX(${stat.progress / 100})` }}
                      />
                    </View>
                  )}
                </View>
              ))}
        </View>

        {/* Milestone badges */}
        {showMilestones && (
          <View
            className={`profile-page__milestones ${
              milestonesEntered ? 'profile-page__milestones--entered' : ''
            }`}
          >
            <Text className='profile-page__milestones-title'>我的成就</Text>
            <View className='profile-page__milestones-row'>
              {eventsJoined >= 1 && (
                <View
                  className='profile-page__milestone'
                  hoverClass='profile-page__milestone--pressed'
                  onClick={() => {
                    haptics('light')
                    void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events })
                  }}
                  aria-label='已参加 1 场活动'
                >
                  <Image
                    className='profile-page__milestone-img'
                    mode='aspectFit'
                    src={FIRST_EVENT_BADGE}
                    lazyLoad
                  />
                  <Text className='profile-page__milestone-label'>初次见面</Text>
                </View>
              )}
              {eventsJoined >= 3 && (
                <View
                  className='profile-page__milestone'
                  hoverClass='profile-page__milestone--pressed'
                  onClick={() => {
                    haptics('light')
                    void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events })
                  }}
                  aria-label='已参加 3 场活动'
                >
                  <Image
                    className='profile-page__milestone-img'
                    mode='aspectFit'
                    src={STREAK_3_BADGE}
                    lazyLoad
                  />
                  <Text className='profile-page__milestone-label'>三场连击</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Menu grid */}
        {isLoadingShell ? (
          <View className='profile-page__menu-skeleton'>
            {Array.from({ length: 6 }).map((_, index) => (
              <View key={`menu-skeleton-${index}`} className='profile-page__menu-item-skeleton' />
            ))}
          </View>
        ) : (
          <View className={`profile-page__menu ${menuEntered ? 'profile-page__menu--entered' : ''}`}>
            {menuItems.map((item, index) => (
              <View
                key={item.key}
                className='profile-page__menu-item'
                style={{ transitionDelay: `${120 + index * 40}ms` }}
                hoverClass='profile-page__menu-item--pressed'
                onClick={item.action}
                aria-label={item.label}
              >
                <View className='profile-page__menu-item-top'>
                  <Image className='profile-page__menu-icon' src={item.icon} mode='aspectFit' />
                  {item.badge !== undefined && item.badge > 0 && (
                    <View className='profile-page__menu-badge'>
                      <Text className='profile-page__menu-badge-text'>{item.badge}</Text>
                    </View>
                  )}
                </View>
                <Text className='profile-page__menu-label'>{item.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Error state */}
        {shellError && !isLoadingShell && (
          <View className='profile-page__error-card'>
            <Image
              className='profile-page__error-mascot'
              src={getXiaoyueExpressionAsset('actionFailure')}
              mode='aspectFit'
            />
            <Text className='profile-page__error-title'>数据加载失败</Text>
            <Text className='profile-page__error-subtitle'>下拉页面或点击重试</Text>
            <View
              className='profile-page__error-retry'
              hoverClass='profile-page__error-retry--pressed'
              onClick={() => {
                haptics('light')
                profileAnalytics.track('profile_shell_retry')
                void queryClient.invalidateQueries({ queryKey: ['mini-program', 'profile-shell'] })
              }}
            >
              <Text className='profile-page__error-retry-text'>重新加载</Text>
            </View>
          </View>
        )}

        {/* Logout */}
        <View className='profile-page__logout'>
          <View
            className={`profile-page__logout-btn ${
              isLoggingOut ? 'profile-page__logout-btn--busy' : ''
            }`}
            hoverClass={isLoggingOut ? '' : 'profile-page__logout-btn--pressed'}
            onClick={handleLogout}
          >
            <Text className='profile-page__logout-text'>
              {isLoggingOut ? '退出中…' : '退出登录'}
            </Text>
          </View>
        </View>

        <View className='profile-page__spacer' />
      </ScrollView>
    </View>,
  )
}

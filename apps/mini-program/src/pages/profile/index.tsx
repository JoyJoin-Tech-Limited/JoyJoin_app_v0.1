import { View, Text, ScrollView, Image, Canvas } from '@tarojs/components'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { haptics } from '../../lib/utils/haptics'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getProfileShell, type ProfileShellResponse } from '@shared/api'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import {
  BRAND_PRIMARY_HEX,
  DEFAULT_ACCENT,
  formatHSLAsRGBA,
  getArchetypeHSL,
} from '@shared/archetypeColors'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import {
  apiRequest,
  fetchEventsShell,
  fetchConnectionsShell,
} from '../../lib/api/api'
import {
  AUTH_QUERY_KEY,
  clearMiniProgramAuthSession,
  getApiErrorStatusCode,
  isUnauthorizedApiError,
} from '../../lib/api/authSession'
import {
  PROFILE_SHELL_QUERY_KEY,
  getPrefetchEngine,
  injectEventsShellIntoCache,
  injectConnectionsShellIntoCache,
} from '../../lib/prefetchEngine'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { consumeTabEntrance } from '../../lib/utils/tabEntranceState'
import { logError, logInfo } from '../../lib/utils/logger'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { openMiniProgramPaymentPage } from '../../lib/payment/paymentEntry'
import { getXiaoyueExpressionAsset, type XiaoyueExpressionId } from '../../lib/mascot/xiaoyueExpressions'
import { profileAnalytics } from '../../lib/analytics/profileAnalytics'
import { PROFILE_SHARE_POSTER_CANVAS_ID } from './profilePosterConstants'
import { useProfileShareCard } from './useProfileShareCard'
import {
  ARCHETYPE_FAMILY_NAME,
  ARCHETYPE_GREETINGS,
  FIRST_EVENT_BADGE,
  getProfileCompletion,
  getXiaoyueGreeting,
  MILESTONES,
} from './profileConstants'
import ArchetypeHead from '../../components/mascot/ArchetypeHead'
import { CountUpText } from '../../components/ui/CountUpText'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import ShareCardShimmer from './ShareCardShimmer'
import './index.scss'

const MENU_EMOJI = {
  edit: '✏️',
  shareCard: '📤',
  coupon: '🎁',
  invite: '🔗',
  benefits: '👑',
  footprints: '👣',
  terms: '📄',
}

const REFERRAL_STATS_QUERY_KEY = ['mini-program', 'referral-stats'] as const

const FIRST_VISIT_TTL_MS = 7 * 24 * 60 * 60 * 1000

interface ReferralStats {
  referralCode: string
  successfulInvites: number
  platformTotal: number
  inviteLink: string
}

interface StatItem {
  key: string
  label: string
  numericValue: number
  caption?: string
  action: () => void
  progress?: number
  emoji: string
}

interface MenuItem {
  key: string
  label: string
  emoji: string
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
  const [tabEntranceClass] = useState(() => (consumeTabEntrance() ? 'tab-page-enter' : ''))
  const [reducedMotion, setReducedMotion] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [refresherTriggered, setRefresherTriggered] = useState(false)
  const [refreshSuccess, setRefreshSuccess] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [mascotReaction, setMascotReaction] = useState<MascotReaction | null>(null)
  const [milestonesAnimated, setMilestonesAnimated] = useState(false)
  const [isFirstVisit, setIsFirstVisit] = useState(false)
  const [greetingIndex, setGreetingIndex] = useState(0)
  const [celebratingMilestone, setCelebratingMilestone] = useState<string | null>(null)
  const refreshSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevEventsJoinedRef = useRef<number | null>(null)
  const prevCompletionRef = useRef<number | null>(null)
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const milestoneImpressionTrackedRef = useRef<Set<string>>(new Set())
  const profileViewTrackedRef = useRef(false)
  const [celebrateCompletion, setCelebrateCompletion] = useState(false)
  const [shareShimmerVisible, setShareShimmerVisible] = useState(false)

  const { isDegradation } = useDeviceTier()
  const redesignEnabled = authUser?.features?.profileRedesignEnabled ?? true
  const personalityShareEnabled = authUser?.features?.personalityShareEnabled ?? true
  const shouldReduceMotion = reducedMotion || isDegradation || !redesignEnabled
  const effectiveEntered = entered || !redesignEnabled

  useCustomTabBarSync({
    enabled: !authLoading,
    tabKey: 'profile',
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
    try {
      const seen = Taro.getStorageSync('joyjoin_profile_first_visit_seen')
      const seenAt = typeof seen === 'number' ? seen : null
      const isFirst = !seenAt || Date.now() - seenAt > FIRST_VISIT_TTL_MS
      if (isFirst) {
        setIsFirstVisit(true)
      }
      Taro.setStorageSync('joyjoin_profile_first_visit_seen', Date.now())
    } catch {
      // storage failures are non-blocking
    }
    // Rotate greetings per session for a small delight moment.
    setGreetingIndex(Math.floor(Math.random() * 3))
  }, [])

  useEffect(() => {
    if (profileViewTrackedRef.current) return
    profileViewTrackedRef.current = true
    const completion = getProfileCompletion(authUser)
    const hasBio = Boolean(authUser?.bio && String(authUser.bio).trim().length > 0)
    profileAnalytics.track('profile_view', {
      // hasArchetype: Boolean(authUser?.archetype),
      hasArchetype: Boolean(authUser?.archetype ?? authUser?.primaryArchetype),
      completion,
    })
    profileAnalytics.track('profile_completion', { hasBio })
  }, [authUser])

  const checkNetwork = useCallback(async () => {
    try {
      const { networkType } = await Taro.getNetworkType()
      setIsOffline(networkType === 'none')
    } catch {
      setIsOffline(false)
    }
  }, [])

  useEffect(() => {
    void checkNetwork()
  }, [checkNetwork])

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
    queryKey: PROFILE_SHELL_QUERY_KEY,
    queryFn: () => getProfileShell(apiRequest),
    enabled: !authLoading && !!authUser,
    staleTime: 60_000,
    retry: (failureCount) => {
      // Pause retries while offline; resume automatically when connectivity returns.
      if (isOffline) return false
      return failureCount < 3
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10_000),
    networkMode: 'offlineFirst',
  })

  const { data: referralStats } = useQuery<ReferralStats>({
    queryKey: REFERRAL_STATS_QUERY_KEY,
    queryFn: () => apiRequest<ReferralStats>({ path: '/api/referrals/stats' }),
    enabled: !authLoading && !!authUser,
    staleTime: 5 * 60_000,
    retry: (failureCount) => {
      if (isOffline) return false
      return failureCount < 3
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10_000),
    networkMode: 'offlineFirst',
  })

  useDidShow(() => {
    void queryClient.invalidateQueries({ queryKey: PROFILE_SHELL_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY })
  })

  const clearRefreshSuccess = useCallback(() => {
    if (refreshSuccessTimerRef.current) {
      clearTimeout(refreshSuccessTimerRef.current)
      refreshSuccessTimerRef.current = null
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    clearRefreshSuccess()
    let offline = false
    try {
      const { networkType } = await Taro.getNetworkType()
      offline = networkType === 'none'
      setIsOffline(offline)
    } catch {
      offline = false
      setIsOffline(false)
    }
    profileAnalytics.track('profile_pull_refresh', { offline })
    if (offline) {
      setRefresherTriggered(false)
      Taro.showToast({ title: '网络不太顺畅，检查一下再试', icon: 'none', duration: 2500 })
      return
    }
    setRefresherTriggered(true)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: PROFILE_SHELL_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }),
    ])
  }, [queryClient, clearRefreshSuccess])

  useEffect(() => {
    setRefresherTriggered(isRefetching)
    if (!isRefetching && refresherTriggered) {
      setRefreshSuccess(true)
      haptics('light')
      clearRefreshSuccess()
      refreshSuccessTimerRef.current = setTimeout(() => {
        setRefreshSuccess(false)
      }, 1500)
    }
  }, [isRefetching, refresherTriggered, clearRefreshSuccess])

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
    (statKey: string, value: number, archetypeNameForTone: string | null) => {
      clearReaction()

      let expression: XiaoyueExpressionId = 'actionSuccess'
      let text = ''
      const nameBit = archetypeNameForTone ? `${archetypeNameForTone}，` : ''

      if (statKey === 'events') {
        text =
          value === 0
            ? `${nameBit}去活动页看看，第一场在等你`
            : `${nameBit}已经参加了 ${value} 场活动，真棒！`
      } else if (statKey === 'connections') {
        text =
          value === 0
            ? `${nameBit}参加活动后，连接会在这里生长`
            : `${nameBit}已有 ${value} 个连接，继续闪闪发光`
      } else if (statKey === 'completion') {
        expression = value < 100 ? 'coachGuide' : 'actionSuccess'
        text =
          value < 100
            ? `${nameBit}资料再完善一点，匹配会更准哦`
            : `${nameBit}资料完整度 100%，社交名片已就绪`
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

    const { confirm } = await Taro.showModal({
      title: '退出登录？',
      content: '退出后需要重新授权才能查看你的 JoyJoin 档案',
      confirmText: '退出',
      cancelText: '取消',
      confirmColor: BRAND_PRIMARY_HEX,
    })
    if (!confirm) {
      profileAnalytics.track('profile_logout_cancel')
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
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current)
      }
      clearRefreshSuccess()
    }
  }, [clearRefreshSuccess])

  const displayName = authUser?.nickname || authUser?.displayName || '悦聚用户'
  // const archetype = authUser?.archetype
  const archetype = authUser?.archetype ?? authUser?.primaryArchetype ?? null
  const completion = getProfileCompletion(authUser)
  const userAge = authUser?.age != null ? Number(authUser.age) : null
  const userCity = authUser?.currentCity
  const userBio = typeof authUser?.bio === 'string' ? authUser.bio.trim() : ''
  const topInterests = authUser?.topInterests ?? authUser?.primaryInterests ?? []
  const profileSubtitleParts: string[] = []
  if (userCity) profileSubtitleParts.push(userCity)
  if (userAge != null && !Number.isNaN(userAge) && userAge > 0) {
    profileSubtitleParts.push(`${userAge}岁`)
  }
  const interestSlice = topInterests.slice(0, 2).filter((i): i is string => typeof i === 'string')
  if (interestSlice.length > 0) {
    profileSubtitleParts.push(interestSlice.join(' / '))
  }
  const profileSubtitle = profileSubtitleParts.join(' · ')
  const cachedShell = queryClient.getQueryData<ProfileShellResponse>(PROFILE_SHELL_QUERY_KEY)
  const profileShell = shell ?? cachedShell
  const hasShellData = Boolean(profileShell)
  const eventsJoined = profileShell?.stats?.eventsJoined ?? 0
  const connectionsCount = profileShell?.stats?.connectionsCount ?? 0
  const couponsCount = profileShell?.coupons?.count ?? 0

  // One-time 100% profile-completion ceremony.
  useEffect(() => {
    if (isLoadingShell || completion < 100 || shouldReduceMotion) return
    let timer: ReturnType<typeof setTimeout> | null = null
    try {
      const seen = Taro.getStorageSync('joyjoin_profile_100_ceremony_seen')
      if (!seen) {
        timer = setTimeout(() => {
          setCelebrateCompletion(true)
          haptics('success')
          try {
            Taro.setStorageSync('joyjoin_profile_100_ceremony_seen', true)
          } catch {
            // storage failures are non-blocking
          }
        }, 1000)
      }
    } catch {
      // storage read failures are non-blocking
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [isLoadingShell, completion, shouldReduceMotion])

  // Auto-refetch when the device comes back online (network resilience).
  useEffect(() => {
    type NetworkStatusListener = (res: { isConnected: boolean }) => void
    let listener: NetworkStatusListener | null = null
    try {
      listener = (res) => {
        if (res.isConnected) {
          setIsOffline(false)
          void queryClient.invalidateQueries({ queryKey: PROFILE_SHELL_QUERY_KEY })
        } else {
          setIsOffline(true)
        }
      }
      Taro.onNetworkStatusChange(listener)
    } catch {
      // Some environments don't support the listener; non-blocking.
    }
    return () => {
      if (listener) {
        try {
          Taro.offNetworkStatusChange(listener)
        } catch {
          // ignore
        }
      }
    }
  }, [queryClient])

  // Prefetch adjacent tab shells once Profile data is stable (speed).
  // Gated by the PrefetchEngine on network type + device tier so low-end
  // or 2G devices are not penalized.
  useEffect(() => {
    if (!hasShellData || isOffline) return

    const engine = getPrefetchEngine(queryClient)
    engine.stage(
      'profile-events',
      async () => {
        const shell = await fetchEventsShell()
        injectEventsShellIntoCache(queryClient, shell)
      },
      1200,
    )
    engine.stage(
      'profile-connections',
      async () => {
        const shell = await fetchConnectionsShell()
        injectConnectionsShellIntoCache(queryClient, shell)
      },
      1800,
    )

    return () => {
      engine.clear('profile-events')
      engine.clear('profile-connections')
    }
  }, [hasShellData, isOffline, queryClient])

  const archetypeName = archetype ? ARCHETYPE_BY_ID[archetype]?.nameCn || archetype : null
  const archetypeFamilyName = archetype ? ARCHETYPE_FAMILY_NAME[archetype] ?? '悦聚家族' : null

  const referralCode = referralStats?.referralCode

  const buildShareTitle = useCallback(() => {
    if (!archetypeName || !archetypeFamilyName) {
      return '来 JoyJoin，遇见同频的人'
    }
    return `我是${archetypeName} · ${archetypeFamilyName} | 来 JoyJoin 看看你的社交原型`
  }, [archetypeName, archetypeFamilyName])

  const buildSharePath = useCallback(() => {
    if (referralCode) {
      return `${MINI_PROGRAM_ROUTES.index}?invitationCode=${encodeURIComponent(referralCode)}`
    }
    return MINI_PROGRAM_ROUTES.index
  }, [referralCode])

  useShareAppMessage(() => {
    const title = buildShareTitle()
    profileAnalytics.track('profile_share_app_message', {
      title,
      hasReferralCode: Boolean(referralCode),
    })
    return {
      title,
      path: buildSharePath(),
    }
  })

  useShareTimeline(() => {
    const title = buildShareTitle()
    profileAnalytics.track('profile_share_timeline', {
      title,
      hasReferralCode: Boolean(referralCode),
    })
    return {
      title,
      query: referralCode
        ? `invitationCode=${encodeURIComponent(referralCode)}`
        : undefined,
    }
  })

  const { handleShareCard, isGeneratingSharePoster } = useProfileShareCard({
    displayName,
    archetype,
    archetypeName,
    archetypeFamilyName,
    userCity,
    userAge,
    topInterests,
    referralCode,
    isDegradation,
  })

  const archetypeAccentStyle = useMemo(() => {
    if (!archetype) return null
    const hsl = getArchetypeHSL(archetype)
    return {
      background: formatHSLAsRGBA(hsl, 1),
    }
  }, [archetype])

  const avatarRingStyle = useMemo(() => {
    const hsl = archetype ? getArchetypeHSL(archetype) : DEFAULT_ACCENT
    return {
      borderColor: formatHSLAsRGBA(hsl, 0.35),
    }
  }, [archetype])

  const baseGreetingText = useMemo(() => {
    if (!archetypeName) {
      return getXiaoyueGreeting(displayName, archetypeName, completion, isFirstVisit, userCity)
    }
    if (isFirstVisit) {
      return getXiaoyueGreeting(displayName, archetypeName, completion, true, userCity)
    }
    if (completion < 100) {
      return getXiaoyueGreeting(displayName, archetypeName, completion, false, userCity)
    }
    const toneGreetings = archetype ? ARCHETYPE_GREETINGS[archetype] : null
    if (toneGreetings && toneGreetings.length > 0) {
      return toneGreetings[greetingIndex % toneGreetings.length]
    }
    const rotated = [
      `${archetypeName}，和悦聚玩家们一起探索吧`,
      `${archetypeName}，今天想遇见谁？`,
      `${archetypeName}，你的同类正在等你`,
    ]
    return rotated[greetingIndex % rotated.length]
  }, [displayName, archetypeName, completion, isFirstVisit, userCity, greetingIndex])

  const greetingText = mascotReaction?.text ?? baseGreetingText
  const greetingExpression = mascotReaction?.expression ?? 'homeWelcome'

  const showSkeleton = isLoadingShell && !hasShellData

  const countUpBaseEnabled = !showSkeleton && entered && !shouldReduceMotion

  const stats: StatItem[] = useMemo(
    () => [
      {
        key: 'events',
        label: '已参加活动',
        numericValue: eventsJoined,
        caption: eventsJoined === 0 ? '去遇见' : undefined,
        emoji: '👥',
        action: () => {
          haptics('light')
          profileAnalytics.track('profile_stat_tap', { stat: 'events', value: eventsJoined })
          triggerReaction('events', eventsJoined, archetypeName)
          void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events })
        },
      },
      {
        key: 'connections',
        label: '我的连接数',
        numericValue: connectionsCount,
        caption: connectionsCount === 0 ? '活动后解锁' : undefined,
        emoji: '🔗',
        action: () => {
          haptics('light')
          profileAnalytics.track('profile_stat_tap', {
            stat: 'connections',
            value: connectionsCount,
          })
          triggerReaction('connections', connectionsCount, archetypeName)
          void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.connections })
        },
      },
      {
        key: 'completion',
        label: '资料完成度',
        numericValue: completion,
        caption: completion < 100 ? '去完善' : undefined,
        emoji: '✏️',
        action: () => {
          haptics('light')
          profileAnalytics.track('profile_stat_tap', { stat: 'completion', value: completion })
          triggerReaction('completion', completion, archetypeName)
          if (completion === 100) {
            void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.personalityTestResults })
          } else {
            void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.editProfile })
          }
        },
        progress: completion,
      },
    ],
    [eventsJoined, connectionsCount, completion, triggerReaction, archetypeName],
  )

  const menuItems: MenuItem[] = useMemo(
    () => [
      {
        key: 'edit-profile',
        label: '编辑资料',
        emoji: MENU_EMOJI.edit,
        action: () => {
          haptics('light')
          profileAnalytics.track('profile_menu_tap', { menu: 'edit-profile' })
          void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.editProfile })
        },
      },
      ...(personalityShareEnabled && archetype
        ? [
            {
              key: 'share-card',
              label: '分享我的社交名片',
              emoji: MENU_EMOJI.shareCard,
              action: handleShareCard,
            },
          ]
        : []),
      {
        key: 'rewards',
        label: '奖励福利',
        emoji: MENU_EMOJI.coupon,
        badge: couponsCount,
        action: () => {
          haptics('light')
          profileAnalytics.track('profile_menu_tap', { menu: 'rewards' })
          void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.rewards })
        },
      },
      {
        key: 'invite',
        label: '邀请好友',
        emoji: MENU_EMOJI.invite,
        action: () => {
          haptics('light')
          profileAnalytics.track('profile_menu_tap', { menu: 'invite' })
          void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.invite })
        },
      },
      {
        key: 'benefits',
        label: '我的权益',
        emoji: MENU_EMOJI.benefits,
        action: () => {
          haptics('light')
          profileAnalytics.track('profile_menu_tap', { menu: 'benefits' })
          handleOpenPayment()
        },
      },
      {
        key: 'footprints',
        label: '我的足迹',
        emoji: MENU_EMOJI.footprints,
        action: () => {
          haptics('light')
          profileAnalytics.track('profile_menu_tap', { menu: 'footprints' })
          void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events })
        },
      },
      {
        key: 'terms',
        label: '服务条款',
        emoji: MENU_EMOJI.terms,
        action: () => {
          haptics('light')
          profileAnalytics.track('profile_menu_tap', { menu: 'terms' })
          void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.terms })
        },
      },
    ],
    [couponsCount, personalityShareEnabled, archetype, handleShareCard],
  )

  const showMilestones = redesignEnabled
  const heroEntered = effectiveEntered || shouldReduceMotion
  const statsEntered = effectiveEntered || shouldReduceMotion
  const menuEntered = effectiveEntered || shouldReduceMotion
  const milestonesEntered = effectiveEntered || shouldReduceMotion

  useEffect(() => {
    if (milestonesEntered && showMilestones && !milestonesAnimated) {
      const timer = setTimeout(() => setMilestonesAnimated(true), 600)
      return () => clearTimeout(timer)
    }
  }, [milestonesEntered, showMilestones, milestonesAnimated])

  // Track milestone impressions once when the section becomes visible.
  useEffect(() => {
    if (!milestonesAnimated) return
    if (eventsJoined === 0) {
      if (!milestoneImpressionTrackedRef.current.has('firstEvent_teaser')) {
        milestoneImpressionTrackedRef.current.add('firstEvent_teaser')
        profileAnalytics.track('profile_milestone_impression', {
          milestone: 'firstEvent',
          unlocked: false,
          teaser: true,
        })
      }
      return
    }
    MILESTONES.forEach((milestone) => {
      if (milestoneImpressionTrackedRef.current.has(milestone.key)) return
      milestoneImpressionTrackedRef.current.add(milestone.key)
      profileAnalytics.track('profile_milestone_impression', {
        milestone: milestone.key,
        unlocked: eventsJoined >= milestone.threshold,
      })
    })
  }, [milestonesAnimated, eventsJoined])

  // Achievement ceremony: celebrate the moment a milestone or 100% completion
  // is crossed during this session (not on every mount).
  useEffect(() => {
    if (isLoadingShell || !hasShellData) return

    const prevEvents = prevEventsJoinedRef.current
    prevEventsJoinedRef.current = eventsJoined
    if (prevEvents !== null) {
      const crossed = MILESTONES.filter(
        (m) => eventsJoined >= m.threshold && prevEvents < m.threshold && celebratingMilestone !== m.key,
      ).pop()
      if (crossed) {
        clearReaction()
        setCelebratingMilestone(crossed.key)
        setMascotReaction({ expression: 'matchSuccess', text: `${crossed.label}徽章解锁啦！` })
        haptics('success')
        if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current)
        celebrationTimerRef.current = setTimeout(() => setCelebratingMilestone(null), 2500)
        if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current)
        reactionTimerRef.current = setTimeout(() => setMascotReaction(null), 2500)
      }
    }

    const prevCompletion = prevCompletionRef.current
    prevCompletionRef.current = completion
    if (prevCompletion !== null && prevCompletion < 100 && completion >= 100) {
      clearReaction()
      setMascotReaction({ expression: 'matchSuccess', text: '资料完整度 100%，你的社交名片已就绪 ✨' })
      haptics('success')
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current)
      reactionTimerRef.current = setTimeout(() => setMascotReaction(null), 2500)
    }
  }, [isLoadingShell, shell, eventsJoined, completion, clearReaction, celebratingMilestone])

  // Share-card shimmer: show a local skeleton preview only if generation takes
  // longer than 200 ms, so fast paths avoid any flash.
  useEffect(() => {
    if (!isGeneratingSharePoster) {
      setShareShimmerVisible(false)
      return
    }
    const timer = setTimeout(() => setShareShimmerVisible(true), 200)
    return () => clearTimeout(timer)
  }, [isGeneratingSharePoster])

  const milestonesClass = showMilestones
    ? milestonesAnimated
      ? 'profile-page__milestones--seen'
      : milestonesEntered
        ? 'profile-page__milestones--entered'
        : ''
    : ''

  return renderGate(
    <View
      className={`profile-page ${tabEntranceClass} ${isDegradation ? 'profile-page--degradation' : ''}`}
    >
      <ScrollView
        className='profile-page__scroll'
        scrollY
        enhanced
        enableFlex
        bounces
        showScrollbar={false}
        refresherEnabled
        refresherTriggered={refresherTriggered}
        onRefresherRefresh={handleRefresh}
      >
        {/* Hero */}
        {showSkeleton ? (
          <View className='profile-page__hero-skeleton'>
            <View className='profile-page__avatar-skeleton' />
            <View className='profile-page__name-skeleton' />
            <View className='profile-page__pill-skeleton' />
          </View>
        ) : (
          <View className={`profile-page__hero ${heroEntered ? 'profile-page__hero--entered' : ''}`}>
            <View className='profile-page__avatar-ring' style={avatarRingStyle}>
              <ArchetypeHead
                archetype={archetype}
                size={128}
                fallbackText={displayName}
                className='profile-page__avatar-head'
              />
            </View>

            <Text className='profile-page__name'>{displayName}</Text>
            {profileSubtitle ? (
              <Text className='profile-page__subtitle'>{profileSubtitle}</Text>
            ) : null}

            {archetype && archetypeName ? (
              <View
                className='profile-page__archetype-pill'
                hoverClass='profile-page__archetype-pill--pressed'
                onClick={() => {
                  haptics('light')
                  profileAnalytics.track('profile_archetype_cta_tap', {
                    archetype,
                    hasArchetype: true,
                  })
                  void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.personalityTestResults })
                }}
              >
                <Text className='profile-page__archetype-pill-text'>
                  {archetypeName} · {archetypeFamilyName}
                </Text>
              </View>
            ) : (
              <View
                className='profile-page__unlock-pill'
                hoverClass='profile-page__unlock-pill--pressed'
                onClick={() => {
                  haptics('light')
                  profileAnalytics.track('profile_archetype_cta_tap', { hasArchetype: false })
                  // void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.personalityTest })
                  void Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.personalityTest}?source=profile` })
                }}
              >
                <Text className='profile-page__unlock-pill-text'>测一测，解锁你的社交原型</Text>
              </View>
            )}

            {/* Bio line or empty-state CTA */}
            {redesignEnabled && (
              <View className='profile-page__bio-wrap'>
                {userBio ? (
                  <Text className='profile-page__bio-text'>“{userBio}”</Text>
                ) : (
                  <View
                    className='profile-page__bio-cta'
                    hoverClass='profile-page__bio-cta--pressed'
                    onClick={() => {
                      haptics('light')
                      profileAnalytics.track('profile_edit_tap', { field: 'bio', source: 'profile_cta' })
                      void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.editProfile })
                    }}
                  >
                    <Text className='profile-page__bio-cta-text'>
                      写一句你的社交签名，让别人一眼记住你
                    </Text>
                    <View className='profile-page__bio-cta-chevron' />
                  </View>
                )}
              </View>
            )}

            {/* Xiaoyue greeting */}
            <View className='profile-page__greeting'>
              <Image
                className={`profile-page__greeting-mascot ${heroEntered ? 'profile-page__greeting-mascot--entered' : ''}`}
                src={getXiaoyueExpressionAsset(greetingExpression)}
                mode='aspectFit'
                aria-label='悦仔'
              />
              <View
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
          {showSkeleton
            ? Array.from({ length: 3 }).map((_, index) => (
                <View
                  key={`skeleton-stat-${index}`}
                  className='profile-page__stat profile-page__stat--skeleton'
                  style={{ transitionDelay: `${index * 60}ms` }}
                >
                  <View className='profile-page__stat-value-skeleton' />
                  <View className='profile-page__stat-label-skeleton' />
                  {index === 2 && <View className='profile-page__stat-progress-skeleton' />}
                </View>
              ))
            : stats.map((stat, index) => (
                <View
                  key={stat.key}
                  className='profile-page__stat'
                  style={{ transitionDelay: `${index * 60}ms` }}
                  hoverClass='profile-page__stat--pressed'
                  onClick={stat.action}
                  aria-label={`${stat.label} ${stat.numericValue}${stat.key === 'completion' ? '%' : ''}`}
                >
                  <JoyJoinIcon
                    emoji={stat.emoji}
                    tier='ui'
                    size={32}
                    className='profile-page__stat-icon'
                  />
                  <CountUpText
                    className='profile-page__stat-value'
                    value={stat.numericValue}
                    suffix={stat.key === 'completion' ? '%' : ''}
                    enabled={countUpBaseEnabled && stat.numericValue > 0}
                    delay={200 + index * 120}
                    prefersReducedMotion={shouldReduceMotion}
                  />
                  <Text className='profile-page__stat-label'>{stat.label}</Text>
                  {stat.caption && <Text className='profile-page__stat-caption'>{stat.caption}</Text>}
                  {stat.progress !== undefined && (
                    <View className='profile-page__stat-progress'>
                      <View
                        className='profile-page__stat-progress-bar'
                        style={{
                          transform: `scaleX(${stat.progress / 100})`,
                          ...(stat.key === 'completion' && archetypeAccentStyle ? archetypeAccentStyle : {}),
                        }}
                      />
                    </View>
                  )}
                  {stat.key === 'completion' && celebrateCompletion && (
                    <View className='profile-page__completion-seal'>
                      <View className='profile-page__completion-seal-check' />
                    </View>
                  )}
                  <View className='profile-page__chevron profile-page__chevron--stat' aria-hidden='true' />
                </View>
              ))}
        </View>

        {/* Milestone badges */}
        {showMilestones && (
          <View className={`profile-page__milestones ${milestonesClass}`}>
            <Text className='profile-page__milestones-title'>我的成就</Text>
            <View className='profile-page__milestones-row'>
              {eventsJoined === 0 ? (
                <View
                  key='first-event-teaser'
                  className='profile-page__milestone profile-page__milestone--locked profile-page__milestone--teaser'
                  hoverClass='profile-page__milestone--pressed'
                  onClick={() => {
                    haptics('light')
                    profileAnalytics.track('profile_milestone_tap', {
                      milestone: 'firstEvent',
                      unlocked: false,
                      teaser: true,
                    })
                    void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events })
                  }}
                  aria-label='去遇见第一场活动，解锁初次见面徽章'
                >
                  <Image
                    className='profile-page__milestone-img'
                    mode='aspectFit'
                    src={FIRST_EVENT_BADGE}
                    aria-label='初次见面徽章'
                  />
                  <Text className='profile-page__milestone-label'>初次见面</Text>
                  <Text className='profile-page__milestone-sublabel'>去遇见第一场活动</Text>
                </View>
              ) : (
                MILESTONES.map((milestone) => {
                  const unlocked = eventsJoined >= milestone.threshold
                  const remaining = milestone.threshold - eventsJoined
                  return (
                    <View
                      key={milestone.key}
                      className={`profile-page__milestone ${
                        unlocked ? '' : 'profile-page__milestone--locked'
                      } ${celebratingMilestone === milestone.key ? 'profile-page__milestone--celebrating' : ''}`}
                      hoverClass={unlocked ? 'profile-page__milestone--pressed' : ''}
                      onClick={() => {
                        profileAnalytics.track('profile_milestone_tap', {
                          milestone: milestone.key,
                          unlocked,
                        })
                        if (!unlocked) return
                        haptics('light')
                        void Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events })
                      }}
                      aria-label={
                        unlocked
                          ? `已参加 ${milestone.threshold} 场活动`
                          : `再参加 ${remaining} 场活动解锁${milestone.label}`
                      }
                    >
                      <Image
                        className='profile-page__milestone-img'
                        mode='aspectFit'
                        src={milestone.badge}
                        aria-label={milestone.ariaLabel}
                      />
                      <Text className='profile-page__milestone-label'>{milestone.label}</Text>
                      {!unlocked && (
                        <Text className='profile-page__milestone-sublabel'>
                          {remaining === 1 ? '再参加 1 场解锁' : `再参加 ${remaining} 场解锁`}
                        </Text>
                      )}
                    </View>
                  )
                })
              )}
            </View>
          </View>
        )}

        {/* Day-0 warm nudge */}
        {redesignEnabled && eventsJoined === 0 && connectionsCount === 0 && (
          <View className='profile-page__empty-nudge'>
            <Image
              className='profile-page__empty-nudge-mascot'
              src={getXiaoyueExpressionAsset('coachGuide')}
              mode='aspectFit'
              aria-label='悦仔'
            />
            <View className='profile-page__empty-nudge-bubble'>
              <Text className='profile-page__empty-nudge-text'>
                这里是你的 JoyJoin 基地，去活动页遇见第一个同频的人吧
              </Text>
            </View>
          </View>
        )}

        {/* Error state — visible above the menu so retry is above the fold */}
        {(shellError || (isOffline && !hasShellData && !isLoadingShell)) && !showSkeleton && (
          <View className='profile-page__error-card' role='alert' aria-live='polite'>
            <Image
              className='profile-page__error-mascot'
              src={getXiaoyueExpressionAsset('actionFailure')}
              mode='aspectFit'
              aria-label='加载失败'
            />
            <Text className='profile-page__error-title'>
              {isOffline ? '网络出去玩了' : '数据没跟上'}
            </Text>
            <Text className='profile-page__error-subtitle'>
              {isOffline ? '检查一下网络，再点我重试' : '下拉刷新或点我重试'}
            </Text>
            <View
              className='profile-page__error-retry'
              hoverClass='profile-page__error-retry--pressed'
              onClick={() => {
                haptics('light')
                profileAnalytics.track('profile_shell_retry')
                void queryClient.invalidateQueries({ queryKey: PROFILE_SHELL_QUERY_KEY })
              }}
            >
              <Text className='profile-page__error-retry-text'>重新加载</Text>
            </View>
          </View>
        )}

        {/* Menu */}
        {showSkeleton ? (
          <View className='profile-page__menu-section'>
            <View className='profile-page__menu-title-skeleton' />
            <View className='profile-page__menu-skeleton'>
              {Array.from({ length: 7 }).map((_, index) => (
                <View key={`menu-skeleton-${index}`} className='profile-page__menu-row-skeleton'>
                  <View className='profile-page__menu-row-icon-skeleton' />
                  <View className='profile-page__menu-row-label-skeleton' />
                  <View className='profile-page__chevron profile-page__chevron--skeleton' />
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View className={`profile-page__menu-section ${menuEntered ? 'profile-page__menu-section--entered' : ''}`}>
            <Text className='profile-page__menu-title'>常用功能</Text>
            <View className='profile-page__menu'>
              {menuItems.map((item, index) => (
                <View key={item.key}>
                  <View
                    className='profile-page__menu-row'
                    style={{ transitionDelay: `${Math.min(index * 50, 300)}ms` }}
                    hoverClass='profile-page__menu-row--pressed'
                    onClick={item.action}
                    aria-label={item.label}
                  >
                    <View className='profile-page__menu-icon-well'>
                      <JoyJoinIcon
                        emoji={item.emoji}
                        tier='ui'
                        size={40}
                        className='profile-page__menu-icon'
                      />
                    </View>
                    <Text className='profile-page__menu-label'>{item.label}</Text>
                    <View className='profile-page__menu-row-right'>
                      {item.badge !== undefined && item.badge > 0 && (
                        <View className='profile-page__menu-badge'>
                          <Text className='profile-page__menu-badge-text'>{item.badge}</Text>
                        </View>
                      )}
                      <View className='profile-page__chevron profile-page__chevron--menu' aria-hidden='true' />
                    </View>
                  </View>
                  {item.key === 'share-card' && isGeneratingSharePoster && shareShimmerVisible && (
                    <ShareCardShimmer />
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Refresh success toast */}
        {refreshSuccess && !shellError && !showSkeleton && (
          <View className='profile-page__refresh-success' role='status' aria-live='polite'>
            <Text className='profile-page__refresh-success-text'>已更新</Text>
          </View>
        )}

        {/* Logout */}
        <View className='profile-page__logout'>
          <View
            className={`profile-page__logout-btn ${
              isLoggingOut ? 'profile-page__logout-btn--busy' : ''
            }`}
            hoverClass={isLoggingOut ? undefined : 'profile-page__logout-btn--pressed'}
            onClick={handleLogout}
          >
            <Text className='profile-page__logout-text'>
              {isLoggingOut ? '退出中…' : '退出登录'}
            </Text>
          </View>
        </View>

        <View className='profile-page__spacer' />
      </ScrollView>

      {/* Off-screen canvas for social-card poster generation */}
      <Canvas
        canvasId={PROFILE_SHARE_POSTER_CANVAS_ID}
        className='profile-page__poster-canvas'
        style={{ width: '1px', height: '1px' }}
      />
    </View>,
  )
}

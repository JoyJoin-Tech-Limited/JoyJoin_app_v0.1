import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelPoolRegistration,
  getMyPoolRegistrations,
  getPoolGroupAnalysis,
  getPoolGroupDetails,
  type EventThemeVibe,
  type PoolGroupDetailsResponse,
  type PoolRegistrationSummary,
} from '@shared/api'
import type { OverallChemistry, PairExplanation } from '@shared/types/groupAnalysis'
import type {
  EventThemeTitleRevealedData,
  PoolMatchedData,
  PoolRegistrationAddedData,
} from '@shared/wsEvents'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useMiniRevealMotion } from '../../hooks/useMiniRevealMotion'
import { useWebSocket } from '../../hooks/useWebSocket'
import { logError, logInfo } from '../../lib/logger'
import LoadingScreen from '../../components/LoadingScreen'
import Card from '../../components/Card'
import Button from '../../components/Button'
import './index.scss'

type LiveRevealStage = 'idle' | 'match' | 'members' | 'theme'

interface SimilarPoolSummary {
  id: string
  title?: string
  eventType?: string
  city?: string
  district?: string | null
  dateTime?: string
  registrationCount?: number
}

interface ThemeSummary {
  title: string
  subtitle?: string | null
  emoji?: string | null
  vibe?: EventThemeVibe | null
  highlights: string[]
}

interface PoolFillStats {
  currentFill: number
  minGroupSize: number
  maxGroupSize: number
  progress: number
}

interface WaitingStateCopy {
  badge: string | null
  headline: string
  subtext: string
  nextStepHint: string
}

interface ViewerPairSpotlight {
  pair: PairExplanation
  otherMemberId: string
  otherMemberName: string
}

const MATCHING_BG_SRC = '/assets/matching/matching-bg.png'
const MATCHING_WAITING_HERO_SRC = '/assets/matching/matching-waiting-hero.png'
const MATCHING_NO_MATCH_HERO_SRC = '/assets/matching/matching-no-match-hero.png'
const VENUE_UNLOCK_HOURS = 24
const DEFAULT_MIN_GROUP_SIZE = 4
const DEFAULT_MAX_GROUP_SIZE = 6
const DEFAULT_REFRESH_INTERVAL_SECONDS = 20

function formatDateTime(dateTime?: string | null): string {
  if (!dateTime) return '时间待定'
  const parsedDate = new Date(dateTime)
  if (Number.isNaN(parsedDate.getTime())) return '时间待定'

  return parsedDate.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusLabel(status?: string): string {
  switch (status) {
    case 'matched':
      return '小队已锁定'
    case 'completed':
      return '活动已完成'
    case 'pending':
    default:
      return '匹配进行中'
  }
}

function getVibeLabel(vibe?: EventThemeVibe | string | null): string {
  switch (vibe) {
    case 'playful':
      return '轻松有趣'
    case 'professional':
      return '专业交流'
    case 'creative':
      return '创意碰撞'
    case 'adventurous':
      return '探索冒险'
    default:
      return vibe ?? ''
  }
}

function getCountdownState(dateTime?: string | null): { isExpired: boolean; label: string } {
  if (!dateTime) {
    return { isExpired: false, label: '时间待定' }
  }

  const targetTime = new Date(dateTime).getTime()
  if (Number.isNaN(targetTime)) {
    return { isExpired: false, label: '时间待定' }
  }

  const diff = targetTime - Date.now()
  if (diff <= 0) {
    return { isExpired: true, label: '活动时间已到，当前这桌未能成局' }
  }

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return { isExpired: false, label: `距离开始还有 ${days} 天` }
  }

  if (hours > 0) {
    return { isExpired: false, label: `距离开始还有 ${hours} 小时 ${minutes} 分钟` }
  }

  return { isExpired: false, label: `距离开始还有 ${Math.max(minutes, 1)} 分钟` }
}

function getHoursUntilEvent(dateTime?: string | null): number | null {
  if (!dateTime) return null

  const targetTime = new Date(dateTime).getTime()
  if (Number.isNaN(targetTime)) return null

  return (targetTime - Date.now()) / (1000 * 60 * 60)
}

function isVenueUnlocked(dateTime?: string | null): boolean {
  const hoursUntilEvent = getHoursUntilEvent(dateTime)
  return hoursUntilEvent !== null && hoursUntilEvent > 0 && hoursUntilEvent < VENUE_UNLOCK_HOURS
}

function buildMatchedDestinationUrl(groupId: string): string {
  return `/pages/pool-group-detail/index?groupId=${encodeURIComponent(groupId)}`
}

function triggerLightHaptic() {
  if (typeof Taro.vibrateShort === 'function') {
    void Taro.vibrateShort({ type: 'light' }).catch(() => undefined)
  }
}

function getTemperatureCopy(level?: string | null): { emoji: string; label: string; body: string } {
  switch (level) {
    case 'fire':
      return {
        emoji: '🔥',
        label: '高能锁定',
        body: '这一桌的化学反应已经拉满，先把桌友和今晚的主题慢慢揭晓给你。',
      }
    case 'warm':
      return {
        emoji: '✨',
        label: '暖场成桌',
        body: '小悦已经把这桌气氛很对的人凑齐了，接下来开始揭晓你的同桌。',
      }
    case 'cold':
      return {
        emoji: '🌱',
        label: '稳稳落桌',
        body: '这桌会是慢热但耐聊的组合，先看看今晚会和谁坐在一起。',
      }
    case 'mild':
    default:
      return {
        emoji: '💬',
        label: '成桌啦',
        body: '小队已经锁定，桌友卡片和今晚的主题会按顺序为你揭晓。',
      }
  }
}

function getWaitingStateCopy(stats?: PoolFillStats | null): WaitingStateCopy {
  const currentFill = stats?.currentFill ?? 0
  const minGroupSize = stats?.minGroupSize ?? DEFAULT_MIN_GROUP_SIZE
  const maxGroupSize = stats?.maxGroupSize ?? DEFAULT_MAX_GROUP_SIZE
  const seatsNeeded = Math.max(minGroupSize - currentFill, 0)

  if (currentFill >= maxGroupSize) {
    return {
      badge: '即将揭晓',
      headline: '这一桌已经齐了',
      subtext: '桌友已聚齐，小悦正在完成最后的成桌确认。',
      nextStepHint: '聚齐 → 成桌 → 揭晓',
    }
  }

  if (currentFill >= minGroupSize) {
    return {
      badge: '开始成桌',
      headline: '已经到成桌门槛了',
      subtext: `已有 ${currentFill} 位候选就位，小悦正在优先给这桌找最对味的一组。`,
      nextStepHint: '系统会先从这桌开始完成配对',
    }
  }

  return {
    badge: null,
    headline: `再来 ${seatsNeeded} 位，这一桌就开了`,
    subtext: '有缘人正在路上，先把这桌的人味慢慢攒起来。',
    nextStepHint: '入座 → 聚齐 → 揭晓',
  }
}

function getChemistryTokens(
  chemistry?: OverallChemistry,
  matchScore?: number | null,
): { emoji: string; label: string; body: string } {
  const roundedScore = typeof matchScore === 'number' ? Math.round(matchScore) : null

  switch (chemistry) {
    case 'fire':
      return {
        emoji: '🔥',
        label: '高能化学反应',
        body: '这一桌的聊天温度已经被点燃，通常会很快进入状态。',
      }
    case 'warm':
      return {
        emoji: '✨',
        label: '暖场很稳',
        body: '这桌的同频感很自然，适合一边吃一边慢慢聊开。',
      }
    case 'cold':
      return {
        emoji: '🌱',
        label: '慢热耐聊',
        body: '这桌是越聊越有意思的类型，破冰后更容易进入正题。',
      }
    case 'mild':
      return {
        emoji: '💬',
        label: '刚刚好',
        body: '这桌的风格平衡又自然，浅聊和深聊都容易接得住。',
      }
    default:
      return {
        emoji: '💫',
        label: roundedScore !== null ? `默契度 ${roundedScore}%` : '今晚有戏',
        body: '小悦已经把这桌锁定，接下来看看你会先和谁聊开。',
      }
  }
}

function MatchingHero({ heroSrc, className = '' }: { heroSrc: string; className?: string }) {
  return (
    <View className={`matching-status__hero${className ? ` ${className}` : ''}`}>
      <Image className='matching-status__hero-bg' src={MATCHING_BG_SRC} mode='aspectFill' lazyLoad />
      <View className='matching-status__hero-glow' />
      <Image className='matching-status__hero-image' src={heroSrc} mode='aspectFit' lazyLoad />
    </View>
  )
}

export default function MatchingStatusPage() {
  const router = useRouter()
  const registrationId = router.params.registrationId ?? ''
  const queryClient = useQueryClient()
  const { user, isLoading: authLoading } = useAuthGuard()
  const { shouldReduceMotion } = useMiniRevealMotion(router.params)

  const [isCancelling, setIsCancelling] = useState(false)
  const [liveStage, setLiveStage] = useState<LiveRevealStage>('idle')
  const [matchedData, setMatchedData] = useState<PoolMatchedData | null>(null)
  const [themeRevealData, setThemeRevealData] = useState<EventThemeTitleRevealedData | null>(null)
  const [liveGroupDetails, setLiveGroupDetails] = useState<PoolGroupDetailsResponse | null>(null)
  const [isLoadingLiveGroupDetails, setIsLoadingLiveGroupDetails] = useState(false)
  const [liveRevealError, setLiveRevealError] = useState<string | null>(null)
  const [refreshCountdown, setRefreshCountdown] = useState(DEFAULT_REFRESH_INTERVAL_SECONDS)
  const [newMemberJoined, setNewMemberJoined] = useState(false)
  const [newMemberArchetype, setNewMemberArchetype] = useState<string | null>(null)

  const liveStageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const newMemberTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    data: registration,
    isLoading,
    error: fetchError,
  } = useQuery<PoolRegistrationSummary | undefined>({
    queryKey: ['mini-program', 'pool-registration', registrationId],
    queryFn: async () => {
      const registrations = await getMyPoolRegistrations(apiRequest)
      return registrations.find((item) => item.id === registrationId)
    },
    enabled: !!registrationId && !authLoading,
    refetchInterval: 30_000,
  })

  const matchStatus = registration?.matchStatus ?? 'pending'

  const {
    data: poolFillStats,
    dataUpdatedAt: poolFillUpdatedAt,
  } = useQuery<PoolFillStats>({
    queryKey: ['mini-program', 'pool-group-fill', registration?.poolId],
    queryFn: () =>
      apiRequest<PoolFillStats>({
        path: `/api/event-pools/${encodeURIComponent(registration?.poolId ?? '')}/group-fill`,
      }),
    enabled: !authLoading && matchStatus === 'pending' && Boolean(registration?.poolId),
    staleTime: 0,
  })

  const resolvedGroupId = matchedData?.groupId ?? registration?.assignedGroupId ?? ''

  const { data: matchedGroupDetails } = useQuery<PoolGroupDetailsResponse>({
    queryKey: ['mini-program', 'pool-group', resolvedGroupId],
    queryFn: () => getPoolGroupDetails(apiRequest, resolvedGroupId),
    enabled:
      !authLoading &&
      Boolean(resolvedGroupId) &&
      (registration?.matchStatus === 'matched' || Boolean(matchedData?.groupId)),
    staleTime: 60_000,
  })

  const { data: groupAnalysis } = useQuery({
    queryKey: ['mini-program', 'pool-group-analysis', resolvedGroupId],
    queryFn: () => getPoolGroupAnalysis(apiRequest, resolvedGroupId),
    enabled:
      !authLoading &&
      Boolean(resolvedGroupId) &&
      (registration?.matchStatus === 'matched' || Boolean(matchedData?.groupId)),
    staleTime: 1000 * 60 * 7,
    retry: 1,
  })

  const effectiveGroupDetails = liveGroupDetails ?? matchedGroupDetails ?? null
  const effectiveEventDateTime =
    effectiveGroupDetails?.group.finalDateTime ??
    registration?.finalDateTime ??
    registration?.poolDateTime ??
    null

  const countdown = getCountdownState(registration?.poolDateTime)
  const isCancelled = registration?.poolStatus === 'cancelled'
  const isNoMatchState = registration?.matchStatus === 'pending' && countdown.isExpired
  const venueUnlocked = isVenueUnlocked(effectiveEventDateTime)
  const waitingCopy = getWaitingStateCopy(poolFillStats)
  const currentFill = poolFillStats?.currentFill ?? 0
  const minGroupSize = poolFillStats?.minGroupSize ?? DEFAULT_MIN_GROUP_SIZE
  const maxGroupSize = poolFillStats?.maxGroupSize ?? DEFAULT_MAX_GROUP_SIZE
  const seatsNeeded = Math.max(minGroupSize - currentFill, 0)
  const fillStatusText =
    currentFill >= maxGroupSize
      ? '这桌已经满员，准备进入最后的揭晓。'
      : currentFill >= minGroupSize
        ? '已经达到成桌门槛，小悦正在优先为这桌完成配对。'
        : `还差 ${seatsNeeded} 位达到成桌门槛。`
  const waitingSeats = useMemo(() => {
    const seatCount = Math.min(Math.max(maxGroupSize, DEFAULT_MIN_GROUP_SIZE), DEFAULT_MAX_GROUP_SIZE)
    const layoutKey = Math.min(Math.max(seatCount, DEFAULT_MIN_GROUP_SIZE), DEFAULT_MAX_GROUP_SIZE)
    const filledSeatCount = Math.min(currentFill, seatCount)

    return Array.from({ length: seatCount }).map((_, index) => {
      const seatNumber = index + 1
      const isFilled = seatNumber <= filledSeatCount
      const isThreshold = seatNumber === minGroupSize
      const isNewest = Boolean(newMemberJoined && isFilled && seatNumber === filledSeatCount)
      const isBonusSeat = seatNumber > minGroupSize

      return {
        seatNumber,
        isFilled,
        isThreshold,
        isNewest,
        isBonusSeat,
        seatMark: isFilled ? (isNewest ? '新' : `${seatNumber}`) : isThreshold ? '开' : '+',
        caption: isNewest
          ? newMemberArchetype ?? '新朋友'
          : isThreshold
            ? '成桌线'
            : seatNumber === seatCount
              ? '满员'
              : null,
        layoutClassName: `matching-status__waiting-seat--layout-${layoutKey}-${seatNumber}`,
      }
    })
  }, [currentFill, maxGroupSize, minGroupSize, newMemberArchetype, newMemberJoined])
  const rootClassName = ['matching-status', shouldReduceMotion ? 'matching-status--reduce-motion' : '']
    .filter(Boolean)
    .join(' ')

  const persistedThemeSummary = useMemo<ThemeSummary | null>(() => {
    if (themeRevealData) {
      return {
        title: themeRevealData.eventThemeTitle,
        subtitle: themeRevealData.themeTagline,
        emoji: themeRevealData.themeEmoji,
        vibe: themeRevealData.themeVibe,
        highlights: themeRevealData.themeHighlights ?? [],
      }
    }

    const title = effectiveGroupDetails?.group.theme ?? registration?.theme ?? null
    const emoji = effectiveGroupDetails?.group.themeEmoji ?? registration?.themeEmoji ?? null
    const highlights = effectiveGroupDetails?.group.highlights ?? registration?.highlights ?? []

    if (!title && !emoji) {
      return null
    }

    return {
      title: title ?? '活动主题',
      subtitle: effectiveGroupDetails?.group.subtitle ?? registration?.subtitle ?? null,
      emoji,
      vibe: effectiveGroupDetails?.group.vibe ?? registration?.vibe ?? null,
      highlights: Array.isArray(highlights)
        ? highlights
            .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            .slice(0, 4)
        : [],
    }
  }, [effectiveGroupDetails, registration, themeRevealData])

  const pairKeyMemberMap = useMemo(() => {
    const map = new Map<string, PoolGroupDetailsResponse['members']>()
    const members = effectiveGroupDetails?.members ?? []

    for (let index = 0; index < members.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < members.length; nextIndex += 1) {
        const pairKey = [members[index].userId, members[nextIndex].userId].sort().join('-')
        map.set(pairKey, [members[index], members[nextIndex]])
      }
    }

    return map
  }, [effectiveGroupDetails?.members])

  const currentUserId = user?.id ?? null

  const viewerPairs = useMemo<PairExplanation[]>(() => {
    if (!groupAnalysis) {
      return []
    }

    if (Array.isArray(groupAnalysis.myPairs) && groupAnalysis.myPairs.length > 0) {
      return groupAnalysis.myPairs
    }

    if (!currentUserId) {
      return []
    }

    return groupAnalysis.pairExplanations.filter((pair) => {
      const members = pairKeyMemberMap.get(pair.pairKey)
      return Boolean(
        members && members.some((member) => member.userId === currentUserId),
      )
    })
  }, [currentUserId, groupAnalysis, pairKeyMemberMap])

  const viewerPairSummaryByMemberId = useMemo(() => {
    const map = new Map<string, PairExplanation>()

    if (!currentUserId) {
      return map
    }

    viewerPairs.forEach((pair) => {
      const members = pairKeyMemberMap.get(pair.pairKey)
      const otherMember = members?.find((member) => member.userId !== currentUserId)
      if (otherMember) {
        map.set(otherMember.userId, pair)
      }
    })

    return map
  }, [currentUserId, pairKeyMemberMap, viewerPairs])

  const viewerSpotlight = useMemo<ViewerPairSpotlight | null>(() => {
    if (!currentUserId) {
      return null
    }

    for (const pair of viewerPairs) {
      const members = pairKeyMemberMap.get(pair.pairKey)
      const otherMember = members?.find((member) => member.userId !== currentUserId)
      if (otherMember) {
        return {
          pair,
          otherMemberId: otherMember.userId,
          otherMemberName: otherMember.displayName ?? '这位桌友',
        }
      }
    }

    return null
  }, [currentUserId, pairKeyMemberMap, viewerPairs])

  const chemistryTokens = getChemistryTokens(
    groupAnalysis?.overallChemistry,
    viewerSpotlight?.pair.chemistryScore ??
      effectiveGroupDetails?.group.matchScore ??
      registration?.matchScore ??
      matchedData?.matchScore ??
      null,
  )

  const leadIceBreaker = groupAnalysis?.iceBreakers?.[0] ?? null

  const handleRefreshWaitingState = useCallback(() => {
    setRefreshCountdown(DEFAULT_REFRESH_INTERVAL_SECONDS)

    if (registration?.poolId) {
      void queryClient.invalidateQueries({
        queryKey: ['mini-program', 'pool-group-fill', registration.poolId],
      })
    }

    void queryClient.invalidateQueries({
      queryKey: ['mini-program', 'pool-registration', registrationId],
    })
  }, [queryClient, registration?.poolId, registrationId])

  const fetchLiveGroupDetails = useCallback(
    async (groupId: string) => {
      setIsLoadingLiveGroupDetails(true)
      setLiveRevealError(null)

      try {
        const details = await queryClient.fetchQuery({
          queryKey: ['mini-program', 'pool-group', groupId],
          queryFn: () => getPoolGroupDetails(apiRequest, groupId),
          staleTime: 60_000,
        })

        setLiveGroupDetails(details)
        return details
      } catch (error) {
        logError('[MatchingStatus] Failed to fetch live group details', {
          groupId,
          message: error instanceof Error ? error.message : 'Unknown error',
        })
        setLiveGroupDetails(null)
        setLiveRevealError('匹配已经完成，但桌友卡片还在路上。你可以稍后继续查看。')
        return null
      } finally {
        setIsLoadingLiveGroupDetails(false)
      }
    },
    [queryClient],
  )

  const navigateToMatchedDestination = useCallback(
    (groupId: string) => {
      const url = `/pages/pool-group-detail/index?groupId=${encodeURIComponent(groupId)}`
      setLiveStage('idle')
      Taro.redirectTo({
        url,
        fail: () => {
          Taro.navigateTo({ url })
        },
      })
    },
    [],
  )

  const finishLiveJourney = useCallback(() => {
    const nextGroupId = themeRevealData?.groupId ?? matchedData?.groupId ?? registration?.assignedGroupId ?? null

    if (nextGroupId) {
      navigateToMatchedDestination(nextGroupId)
      return
    }

    setLiveStage('idle')
  }, [matchedData?.groupId, navigateToMatchedDestination, registration?.assignedGroupId, themeRevealData?.groupId])

  const handleContinueFromMembers = useCallback(() => {
    if (persistedThemeSummary) {
      setLiveStage('theme')
      return
    }

    finishLiveJourney()
  }, [finishLiveJourney, persistedThemeSummary])

  const handleCancel = useCallback(async () => {
    if (!registrationId || isCancelling) return

    try {
      const { confirm } = await Taro.showModal({
        title: '取消报名',
        content: '确定要取消报名吗？取消后可以重新报名。',
        confirmText: '确定取消',
        cancelText: '再想想',
        confirmColor: '#EF4444',
      })
      if (!confirm) return

      setIsCancelling(true)
      logInfo('[MatchingStatus] Cancelling registration', { registrationId })
      await cancelPoolRegistration(apiRequest, registrationId)

      Taro.showToast({ title: '已取消报名', icon: 'success', duration: 2000 })

      setTimeout(() => {
        Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/events/index' }) })
      }, 1500)
    } catch (error) {
      const message = error instanceof Error ? error.message : '取消失败，请重试'
      logError('[MatchingStatus] Cancel failed', { message })
      Taro.showToast({ title: message, icon: 'none', duration: 3000 })
    } finally {
      setIsCancelling(false)
    }
  }, [isCancelling, registrationId])

  const handleOpenMatchedJourney = useCallback(() => {
    if (!resolvedGroupId) return
    const url = buildMatchedDestinationUrl(resolvedGroupId)
    Taro.navigateTo({ url })
  }, [resolvedGroupId])

  const handleBrowsePools = useCallback(() => {
    Taro.switchTab({ url: '/pages/discover/index' })
  }, [])

  const handleRejoinPool = useCallback((poolId: string) => {
    Taro.navigateTo({ url: `/pages/pool-registration/index?id=${poolId}` })
  }, [])

  useEffect(() => {
    return () => {
      if (liveStageTimerRef.current) {
        clearTimeout(liveStageTimerRef.current)
      }

      if (newMemberTimerRef.current) {
        clearTimeout(newMemberTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (matchStatus !== 'pending' || !registration?.poolId) {
      return undefined
    }

    if (refreshCountdown <= 0) {
      handleRefreshWaitingState()
      return undefined
    }

    const timer = setTimeout(() => {
      setRefreshCountdown((current) => Math.max(current - 1, 0))
    }, 1000)

    return () => clearTimeout(timer)
  }, [handleRefreshWaitingState, matchStatus, refreshCountdown, registration?.poolId])

  useEffect(() => {
    if (matchStatus === 'pending') {
      setRefreshCountdown(DEFAULT_REFRESH_INTERVAL_SECONDS)
    }
  }, [matchStatus, poolFillUpdatedAt])

  useEffect(() => {
    if (liveStage !== 'match' || isLoadingLiveGroupDetails) {
      return undefined
    }

    if (liveStageTimerRef.current) {
      clearTimeout(liveStageTimerRef.current)
    }

    liveStageTimerRef.current = setTimeout(() => {
      if (effectiveGroupDetails?.members && effectiveGroupDetails.members.length > 0) {
        setLiveStage('members')
        return
      }

      if (persistedThemeSummary) {
        setLiveStage('theme')
        return
      }

      finishLiveJourney()
    }, shouldReduceMotion ? 140 : 950)

    return () => {
      if (liveStageTimerRef.current) {
        clearTimeout(liveStageTimerRef.current)
      }
    }
  }, [
    effectiveGroupDetails,
    finishLiveJourney,
    isLoadingLiveGroupDetails,
    liveStage,
    persistedThemeSummary,
    shouldReduceMotion,
  ])

  useWebSocket({
    eventTypes: ['POOL_MATCHED', 'POOL_REGISTRATION_ADDED', 'EVENT_THEME_TITLE_REVEALED', 'MATCH_PROGRESS_UPDATE'],
    onMessage: (message) => {
      if (!registration) {
        return
      }

      logInfo('[MatchingStatus] WS message received', {
        registrationId,
        type: message.type,
      })

      if (message.type === 'POOL_MATCHED') {
        const data = message.data as PoolMatchedData
        if (data.poolId !== registration.poolId) {
          return
        }

        setMatchedData(data)
        setLiveGroupDetails(null)
        setLiveRevealError(null)
        setLiveStage('match')
        triggerLightHaptic()

        void queryClient.invalidateQueries({
          queryKey: ['mini-program', 'pool-registration', registrationId],
        })

        if (data.groupId) {
          void fetchLiveGroupDetails(data.groupId)
        }

        return
      }

      if (message.type === 'POOL_REGISTRATION_ADDED') {
        const data = message.data as PoolRegistrationAddedData
        if (registration.matchStatus !== 'pending' || data.poolId !== registration.poolId) {
          return
        }

        setNewMemberJoined(true)
        setNewMemberArchetype(data.archetype ?? null)
        setRefreshCountdown(DEFAULT_REFRESH_INTERVAL_SECONDS)
        triggerLightHaptic()

        if (newMemberTimerRef.current) {
          clearTimeout(newMemberTimerRef.current)
        }

        newMemberTimerRef.current = setTimeout(() => {
          setNewMemberJoined(false)
          setNewMemberArchetype(null)
        }, 2000)

        void queryClient.invalidateQueries({
          queryKey: ['mini-program', 'pool-group-fill', registration.poolId],
        })

        return
      }

      if (message.type === 'EVENT_THEME_TITLE_REVEALED') {
        const data = message.data as EventThemeTitleRevealedData
        if (data.poolId !== registration.poolId) {
          return
        }

        setThemeRevealData(data)
        triggerLightHaptic()

        void queryClient.invalidateQueries({
          queryKey: ['mini-program', 'pool-registration', registrationId],
        })

        return
      }
    },
  })

  const { data: similarPools = [] } = useQuery<SimilarPoolSummary[]>({
    queryKey: ['mini-program', 'similar-pools', registration?.poolCity, registration?.poolEventType],
    queryFn: () =>
      apiRequest<SimilarPoolSummary[]>({
        path: `/api/event-pools?city=${encodeURIComponent(registration?.poolCity ?? '')}&eventType=${encodeURIComponent(registration?.poolEventType ?? '')}`,
      }),
    enabled: isNoMatchState && Boolean(registration?.poolCity) && Boolean(registration?.poolEventType),
    select: (pools) => pools.filter((pool) => pool.id !== registration?.poolId).slice(0, 3),
  })

  if (authLoading || isLoading) {
    return <LoadingScreen message='加载匹配状态…' />
  }

  if (fetchError || !registration) {
    return (
      <View className={rootClassName}>
        <View className='matching-status__error'>
          <Text className='matching-status__error-icon'>😕</Text>
          <Text className='matching-status__error-text'>
            {fetchError ? '加载匹配信息失败' : '未找到报名记录'}
          </Text>
          <Button
            variant='secondary'
            className='matching-status__error-btn'
            onClick={() => Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/events/index' }) })}
          >
            返回
          </Button>
        </View>
      </View>
    )
  }

  if (isCancelled) {
    return (
      <View className={rootClassName}>
        <Card className='matching-status__special-card'>
          <Text className='matching-status__special-icon'>😔</Text>
          <Text className='matching-status__special-title'>这场活动已取消</Text>
          <Text className='matching-status__special-text'>
            很抱歉，这场活动未能按计划进行。你可以回到发现页，重新挑一场更适合你的局。
          </Text>
          <View className='matching-status__actions'>
            <Button className='matching-status__cta-btn' onClick={handleBrowsePools}>
              去看看别的活动
            </Button>
            <Button
              variant='secondary'
              className='matching-status__secondary-btn'
              onClick={() => Taro.switchTab({ url: '/pages/events/index' })}
            >
              返回我的活动
            </Button>
          </View>
        </Card>
      </View>
    )
  }

  if (isNoMatchState) {
    return (
      <ScrollView className={rootClassName} scrollY enhanced showScrollbar={false}>
        <MatchingHero heroSrc={MATCHING_NO_MATCH_HERO_SRC} className='matching-status__hero--no-match' />

        <Card className='matching-status__special-card matching-status__special-card--stacked'>
          <Text className='matching-status__special-title'>这次还没等到合适的一桌</Text>
          <Text className='matching-status__special-text'>
            {countdown.label}。与其勉强凑桌，我们更想把你留给更对味的人。
          </Text>
          <View className='matching-status__actions'>
            <Button className='matching-status__cta-btn' onClick={handleBrowsePools}>
              看看别的活动
            </Button>
            <Button
              variant='secondary'
              className='matching-status__secondary-btn'
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['mini-program', 'pool-registration', registrationId] })}
            >
              刷新状态
            </Button>
          </View>
        </Card>

        {similarPools.length > 0 ? (
          <View className='matching-status__similar-section'>
            <Text className='matching-status__similar-title'>附近还有这些局</Text>
            {similarPools.map((pool) => (
              <Card key={pool.id} className='matching-status__similar-card'>
                <Text className='matching-status__similar-name'>{pool.title ?? '推荐活动'}</Text>
                <Text className='matching-status__similar-meta'>
                  {pool.eventType ?? registration.poolEventType}
                  {pool.city ? ` · ${pool.city}` : ''}
                  {pool.district ? ` ${pool.district}` : ''}
                </Text>
                <Text className='matching-status__similar-meta'>
                  {formatDateTime(pool.dateTime)}
                  {typeof pool.registrationCount === 'number' ? ` · 已有 ${pool.registrationCount} 人入座` : ''}
                </Text>
                <Button
                  variant='secondary'
                  className='matching-status__similar-btn'
                  onClick={() => handleRejoinPool(pool.id)}
                >
                  重新报名这场
                </Button>
              </Card>
            ))}
          </View>
        ) : null}

        <View className='matching-status__spacer' />
      </ScrollView>
    )
  }

  const stageTemperature = getTemperatureCopy(matchedData?.temperatureLevel)

  return (
    <ScrollView className={rootClassName} scrollY enhanced showScrollbar={false}>
      {matchStatus === 'pending' ? (
        <MatchingHero heroSrc={MATCHING_WAITING_HERO_SRC} className='matching-status__hero--waiting' />
      ) : null}

      <View className={`matching-status__header${matchStatus === 'pending' ? ' matching-status__header--with-hero' : ''}`}>
        <Text className='matching-status__status-emoji'>
          {matchStatus === 'matched' ? '🎉' : matchStatus === 'completed' ? '✅' : '⏳'}
        </Text>
        <Text className='matching-status__status-title'>{getStatusLabel(matchStatus)}</Text>
        {matchStatus === 'pending' ? (
          <View className='matching-status__dots'>
            <View className='matching-status__dot matching-status__dot--1' />
            <View className='matching-status__dot matching-status__dot--2' />
            <View className='matching-status__dot matching-status__dot--3' />
          </View>
        ) : null}
        <Text className='matching-status__status-hint'>
          {matchStatus === 'pending'
            ? `${countdown.label}，等待更多人加入…`
            : venueUnlocked
              ? '桌友和活动信息都已逐步解锁，继续查看今晚的安排。'
              : '桌友已经锁定，活动详情会在下一页继续逐步揭晓。'}
        </Text>
      </View>

      {matchStatus === 'pending' ? (
        <>
          {newMemberJoined ? (
            <View className='matching-status__arrival-toast'>
              <Text className='matching-status__arrival-emoji'>✨</Text>
              <Text className='matching-status__arrival-text'>
                {newMemberArchetype ? `${newMemberArchetype} 刚刚入座了` : '刚有新朋友加入这桌'}
              </Text>
            </View>
          ) : null}

          <Card className='matching-status__waiting-card'>
            <View className='matching-status__waiting-top'>
              {waitingCopy.badge ? (
                <Text className='matching-status__waiting-badge'>{waitingCopy.badge}</Text>
              ) : null}
              <Text className='matching-status__waiting-title'>{waitingCopy.headline}</Text>
              <Text className='matching-status__waiting-copy'>{waitingCopy.subtext}</Text>
            </View>

            <View className='matching-status__waiting-progress-top'>
              <Text className='matching-status__waiting-progress-label'>成桌进度</Text>
              <Text className='matching-status__waiting-progress-count'>
                {currentFill}/{maxGroupSize} 人
              </Text>
            </View>

            <View className='matching-status__waiting-scene'>
              <View className='matching-status__waiting-orbit matching-status__waiting-orbit--outer' />
              <View className='matching-status__waiting-orbit matching-status__waiting-orbit--inner' />

              <View className='matching-status__waiting-table'>
                <Text className='matching-status__waiting-table-eyebrow'>正在聚齐</Text>
                <Text className='matching-status__waiting-table-count'>
                  {currentFill}/{maxGroupSize}
                </Text>
                <Text className='matching-status__waiting-table-copy'>
                  {currentFill >= minGroupSize ? '已经够开桌了' : `还差 ${seatsNeeded} 位成桌`}
                </Text>
              </View>

              {waitingSeats.map((seat) => (
                <View
                  key={`seat-${seat.seatNumber}`}
                  className={[
                    'matching-status__waiting-seat',
                    seat.layoutClassName,
                    seat.isFilled ? 'matching-status__waiting-seat--filled' : '',
                    seat.isThreshold ? 'matching-status__waiting-seat--threshold' : '',
                    seat.isBonusSeat ? 'matching-status__waiting-seat--bonus' : '',
                    seat.isNewest ? 'matching-status__waiting-seat--new' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <View className='matching-status__waiting-seat-core'>
                    <Text className='matching-status__waiting-seat-mark'>{seat.seatMark}</Text>
                  </View>
                  {seat.caption ? (
                    <Text className='matching-status__waiting-seat-caption'>{seat.caption}</Text>
                  ) : null}
                </View>
              ))}

              {newMemberJoined ? (
                <View className='matching-status__waiting-seat-burst'>
                  <Text className='matching-status__waiting-seat-burst-emoji'>✨</Text>
                  <Text className='matching-status__waiting-seat-burst-text'>
                    {newMemberArchetype ? `${newMemberArchetype} 刚入座` : '这桌刚多了一位新朋友'}
                  </Text>
                </View>
              ) : null}
            </View>

            <View className='matching-status__waiting-metrics'>
              <View className='matching-status__waiting-metric'>
                <Text className='matching-status__waiting-metric-label'>已入座</Text>
                <Text className='matching-status__waiting-metric-value'>{currentFill} 位</Text>
              </View>
              <View className='matching-status__waiting-metric'>
                <Text className='matching-status__waiting-metric-label'>成桌门槛</Text>
                <Text className='matching-status__waiting-metric-value'>{minGroupSize} 位</Text>
              </View>
              <View className='matching-status__waiting-metric'>
                <Text className='matching-status__waiting-metric-label'>满员上限</Text>
                <Text className='matching-status__waiting-metric-value'>{maxGroupSize} 位</Text>
              </View>
            </View>

            <Text className='matching-status__waiting-progress-status'>{fillStatusText}</Text>

            <View className='matching-status__waiting-refresh'>
              <Text className='matching-status__waiting-refresh-copy'>
                自动刷新中，约 {refreshCountdown}s 后同步最新进度
              </Text>
              <Button
                variant='secondary'
                className='matching-status__waiting-refresh-btn'
                onClick={handleRefreshWaitingState}
              >
                立即刷新
              </Button>
            </View>

            <Text className='matching-status__waiting-hint'>{waitingCopy.nextStepHint}</Text>
          </Card>
        </>
      ) : null}

      <Card className='matching-status__card'>
        <Text className='matching-status__card-title'>{registration.poolTitle ?? '活动信息'}</Text>

        {registration.poolEventType ? (
          <View className='matching-status__info-row'>
            <Text className='matching-status__info-label'>🎯 类型</Text>
            <Text className='matching-status__info-value'>{registration.poolEventType}</Text>
          </View>
        ) : null}

        {(effectiveEventDateTime ?? registration.poolDateTime) ? (
          <View className='matching-status__info-row'>
            <Text className='matching-status__info-label'>📅 时间</Text>
            <Text className='matching-status__info-value'>
              {formatDateTime(effectiveEventDateTime ?? registration.poolDateTime)}
            </Text>
          </View>
        ) : null}

        {(effectiveGroupDetails?.group.venueName || registration.poolCity) ? (
          <View className='matching-status__info-row'>
            <Text className='matching-status__info-label'>📍 地点</Text>
            <Text className='matching-status__info-value'>
              {effectiveGroupDetails?.group.venueName ?? registration.venueName ?? registration.poolCity}
              {(effectiveGroupDetails?.group.venueAddress ?? registration.venueAddress) ? ` · ${effectiveGroupDetails?.group.venueAddress ?? registration.venueAddress}` : registration.poolDistrict ? ` · ${registration.poolDistrict}` : ''}
            </Text>
          </View>
        ) : null}

        {registration.matchScore != null ? (
          <View className='matching-status__info-row'>
            <Text className='matching-status__info-label'>💯 匹配分</Text>
            <Text className='matching-status__info-value matching-status__info-value--score'>
              {registration.matchScore}
            </Text>
          </View>
        ) : null}
      </Card>

      {liveRevealError ? (
        <Card className='matching-status__notice-card'>
          <Text className='matching-status__notice-text'>{liveRevealError}</Text>
        </Card>
      ) : null}

      {matchStatus === 'matched' && effectiveGroupDetails?.members.length ? (
        <Card className='matching-status__squad-card'>
          <View className='matching-status__squad-header'>
            <Text className='matching-status__squad-title'>你的桌友已就位</Text>
            <Text className='matching-status__squad-meta'>
              {effectiveGroupDetails.group.memberCount || effectiveGroupDetails.members.length} 人同桌
            </Text>
          </View>
          <ScrollView className='matching-status__member-scroll' scrollX enhanced showScrollbar={false}>
            <View className='matching-status__member-row'>
              {effectiveGroupDetails.members.map((member) => (
                <View key={member.userId} className='matching-status__member-chip'>
                  <Text className='matching-status__member-initial'>
                    {(member.displayName ?? '神').slice(0, 1)}
                  </Text>
                  <Text className='matching-status__member-name'>
                    {member.displayName ?? '神秘嘉宾'}
                  </Text>
                  {viewerPairSummaryByMemberId.get(member.userId)?.connectionPoints?.[0] ? (
                    <Text className='matching-status__member-signal'>
                      {viewerPairSummaryByMemberId.get(member.userId)?.connectionPoints?.[0]}
                    </Text>
                  ) : member.archetype ? (
                    <Text className='matching-status__member-archetype'>{member.archetype}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </ScrollView>
        </Card>
      ) : null}

      {matchStatus === 'matched' && (viewerSpotlight || groupAnalysis?.overallChemistry || leadIceBreaker) ? (
        <Card className='matching-status__chemistry-card'>
          <View className='matching-status__chemistry-top'>
            <View className='matching-status__chemistry-badge'>
              <Text className='matching-status__chemistry-emoji'>{chemistryTokens.emoji}</Text>
              <Text className='matching-status__chemistry-badge-text'>{chemistryTokens.label}</Text>
            </View>
            {viewerSpotlight ? (
              <Text className='matching-status__chemistry-score'>默契 {viewerSpotlight.pair.chemistryScore}</Text>
            ) : null}
          </View>

          <Text className='matching-status__chemistry-title'>
            {viewerSpotlight
              ? `你和 ${viewerSpotlight.otherMemberName} 最容易先聊开`
              : '这桌的聊天化学反应已经有了'}
          </Text>
          <Text className='matching-status__chemistry-copy'>
            {viewerSpotlight?.pair.explanation ?? chemistryTokens.body}
          </Text>

          {viewerSpotlight?.pair.connectionPoints?.length ? (
            <View className='matching-status__chemistry-pill-row'>
              {viewerSpotlight.pair.connectionPoints.slice(0, 3).map((point) => (
                <View key={point} className='matching-status__chemistry-pill'>
                  <Text className='matching-status__chemistry-pill-text'>{point}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {leadIceBreaker ? (
            <Text className='matching-status__chemistry-prompt'>破冰建议：{leadIceBreaker}</Text>
          ) : null}
        </Card>
      ) : null}

      {persistedThemeSummary ? (
        <Card className='matching-status__theme-card'>
          <View className='matching-status__theme-header'>
            {persistedThemeSummary.emoji ? (
              <Text className='matching-status__theme-emoji'>{persistedThemeSummary.emoji}</Text>
            ) : null}
            <Text className='matching-status__theme-title'>{persistedThemeSummary.title}</Text>
          </View>

          {persistedThemeSummary.subtitle ? (
            <Text className='matching-status__theme-tagline'>{persistedThemeSummary.subtitle}</Text>
          ) : null}

          {persistedThemeSummary.vibe ? (
            <View className='matching-status__theme-vibe'>
              <Text className='matching-status__theme-vibe-label'>氛围：</Text>
              <Text className='matching-status__theme-vibe-value'>
                {getVibeLabel(persistedThemeSummary.vibe)}
              </Text>
            </View>
          ) : null}

          {persistedThemeSummary.highlights.length > 0 ? (
            <View className='matching-status__theme-highlights'>
              {persistedThemeSummary.highlights.map((highlight, index) => (
                <View key={`${highlight}-${index}`} className='matching-status__theme-highlight'>
                  <Text className='matching-status__theme-highlight-dot'>•</Text>
                  <Text className='matching-status__theme-highlight-text'>{highlight}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      <View className='matching-status__actions'>
        {matchStatus === 'matched' && resolvedGroupId ? (
          <Button className='matching-status__cta-btn' onClick={handleOpenMatchedJourney}>
            查看活动详情
          </Button>
        ) : null}

        {matchStatus === 'matched' && !resolvedGroupId ? (
          <Card className='matching-status__loading-card'>
            <Text className='matching-status__loading-title'>正在整理你的小队信息</Text>
            <Text className='matching-status__loading-text'>匹配已经完成，桌友卡片和主题揭晓马上就会到位。</Text>
            <Button
              variant='secondary'
              className='matching-status__secondary-btn'
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['mini-program', 'pool-registration', registrationId] })}
            >
              立即刷新
            </Button>
          </Card>
        ) : null}

        {matchStatus === 'pending' ? (
          <Button
            variant='secondary'
            className='matching-status__secondary-btn'
            onClick={handleRefreshWaitingState}
          >
            刷新匹配进度
          </Button>
        ) : null}

        {matchStatus === 'pending' ? (
          <Button
            variant='secondary'
            className='matching-status__cancel-btn'
            onClick={handleCancel}
            disabled={isCancelling}
            loading={isCancelling}
          >
            {isCancelling ? '取消中…' : '取消报名'}
          </Button>
        ) : null}

        {matchStatus === 'completed' ? (
          <Button
            variant='primary'
            className='matching-status__back-btn'
            onClick={() => Taro.switchTab({ url: '/pages/events/index' })}
          >
            查看更多活动
          </Button>
        ) : null}
      </View>

      <View className='matching-status__spacer' />

      {liveStage !== 'idle' ? (
        <View className='matching-status__overlay'>
          <View className='matching-status__overlay-backdrop' />

          {liveStage === 'match' ? (
            <View className='matching-status__overlay-card'>
              <Text className='matching-status__overlay-eyebrow'>小悦来报喜</Text>
              <Text className='matching-status__overlay-emoji'>{stageTemperature.emoji}</Text>
              <Text className='matching-status__overlay-title'>{stageTemperature.label}</Text>
              <Text className='matching-status__overlay-copy'>
                {stageTemperature.body}
              </Text>
              <Text className='matching-status__overlay-loading'>
                {isLoadingLiveGroupDetails ? '正在同步桌友卡片…' : '准备开始揭晓'}
              </Text>
            </View>
          ) : null}

          {liveStage === 'members' && effectiveGroupDetails ? (
            <View className='matching-status__overlay-card matching-status__overlay-card--members'>
              <Text className='matching-status__overlay-eyebrow'>先看桌友</Text>
              <Text className='matching-status__overlay-title'>这一桌已经为你留好位置</Text>
              <Text className='matching-status__overlay-copy'>
                {viewerSpotlight
                  ? `第 ${matchedData?.groupNumber ?? effectiveGroupDetails.group.groupNumber} 组已锁定。你和 ${viewerSpotlight.otherMemberName} 会先从「${viewerSpotlight.pair.connectionPoints?.[0] ?? '一个共同话题'}」聊开。`
                  : `第 ${matchedData?.groupNumber ?? effectiveGroupDetails.group.groupNumber} 组已锁定，先认识一下今晚会同桌的人。`}
              </Text>

              <View className='matching-status__overlay-member-grid'>
                {effectiveGroupDetails.members.map((member, index) => (
                  <View
                    key={member.userId}
                    className='matching-status__overlay-member-card'
                    style={{ animationDelay: shouldReduceMotion ? '0ms' : `${index * 120}ms` }}
                  >
                    <Text className='matching-status__overlay-member-initial'>
                      {(member.displayName ?? '神').slice(0, 1)}
                    </Text>
                    <Text className='matching-status__overlay-member-name'>
                      {member.displayName ?? '神秘嘉宾'}
                    </Text>
                    {viewerPairSummaryByMemberId.get(member.userId)?.connectionPoints?.[0] ? (
                      <Text className='matching-status__overlay-member-note'>
                        {viewerPairSummaryByMemberId.get(member.userId)?.connectionPoints?.[0]}
                      </Text>
                    ) : viewerPairSummaryByMemberId.get(member.userId) ? (
                      <Text className='matching-status__overlay-member-note'>
                        默契度 {viewerPairSummaryByMemberId.get(member.userId)?.chemistryScore}
                      </Text>
                    ) : member.archetype ? (
                      <Text className='matching-status__overlay-member-note'>{member.archetype}</Text>
                    ) : null}
                  </View>
                ))}
              </View>

              <Button className='matching-status__overlay-button' onClick={handleContinueFromMembers}>
                {persistedThemeSummary ? '看看今晚主题' : '前往完整详情'}
              </Button>
            </View>
          ) : null}

          {liveStage === 'theme' && persistedThemeSummary ? (
            <View className='matching-status__overlay-card matching-status__overlay-card--theme'>
              <Text className='matching-status__overlay-eyebrow'>今晚的桌面主题</Text>
              {persistedThemeSummary.emoji ? (
                <Text className='matching-status__overlay-emoji'>{persistedThemeSummary.emoji}</Text>
              ) : null}
              <Text className='matching-status__overlay-title'>{persistedThemeSummary.title}</Text>
              {persistedThemeSummary.subtitle ? (
                <Text className='matching-status__overlay-copy'>{persistedThemeSummary.subtitle}</Text>
              ) : null}
              {persistedThemeSummary.vibe ? (
                <Text className='matching-status__overlay-tag'>
                  {getVibeLabel(persistedThemeSummary.vibe)}
                </Text>
              ) : null}
              {persistedThemeSummary.highlights.length > 0 ? (
                <View className='matching-status__overlay-highlight-list'>
                  {persistedThemeSummary.highlights.map((highlight, index) => (
                    <Text key={`${highlight}-${index}`} className='matching-status__overlay-highlight-item'>
                      · {highlight}
                    </Text>
                  ))}
                </View>
              ) : null}
              <Text className='matching-status__overlay-next-step'>
                主题已经落定，下一页继续看完整时间、地点和这桌的出席安排。
              </Text>
              <Button className='matching-status__overlay-button' onClick={finishLiveJourney}>
                {resolvedGroupId ? '查看完整活动详情' : '继续前往下一步'}
              </Button>
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  )
}

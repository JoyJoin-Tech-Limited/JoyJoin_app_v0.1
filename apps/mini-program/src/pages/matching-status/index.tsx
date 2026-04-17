import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelPoolRegistration,
  getMyPoolRegistrations,
  getPoolGroupAnalysis,
  getPoolGroupDetails,
  type PoolGroupDetailsResponse,
  type PoolRegistrationSummary,
} from '@shared/api'
import type { PairExplanation } from '@shared/types/groupAnalysis'
import type {
  EventThemeTitleRevealedData,
  PoolMatchedData,
  PoolRegistrationAddedData,
} from '@shared/wsEvents'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useMiniRevealMotion } from '../../hooks/useMiniRevealMotion'
import { useWebSocket } from '../../hooks/useWebSocket'
import { getXiaoyueExpressionAsset } from '../../lib/xiaoyueExpressions'
import { logError, logInfo } from '../../lib/logger'
import LoadingScreen from '../../components/LoadingScreen'
import Card from '../../components/Card'
import Button from '../../components/Button'
import {
  MatchingHero,
  MatchingStatusDetailSections,
  MatchingStatusLiveOverlay,
  MatchingStatusPendingSection,
} from './MatchingStatusSections'
import {
  buildMatchedDestinationUrl,
  buildWaitingSeats,
  DEFAULT_MAX_GROUP_SIZE,
  DEFAULT_MIN_GROUP_SIZE,
  DEFAULT_REFRESH_INTERVAL_SECONDS,
  formatDateTime,
  getChemistryTokens,
  getCountdownState,
  getStatusLabel,
  getTemperatureCopy,
  getWaitingStateCopy,
  isVenueUnlocked,
  MATCHING_NO_MATCH_HERO_SRC,
  MATCHING_WAITING_HERO_SRC,
  type LiveRevealStage,
  type PoolFillStats,
  type ThemeSummary,
  type ViewerPairSpotlight,
} from './matchingStatusViewModels'
import './index.scss'

interface SimilarPoolSummary {
  id: string
  title?: string
  eventType?: string
  city?: string
  district?: string | null
  dateTime?: string
  registrationCount?: number
}

function triggerLightHaptic() {
  if (typeof Taro.vibrateShort === 'function') {
    void Taro.vibrateShort({ type: 'light' }).catch(() => undefined)
  }
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
  const cancelNavigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
  const waitingSeats = useMemo(
    () =>
      buildWaitingSeats({
        currentFill,
        minGroupSize,
        maxGroupSize,
        newMemberArchetype,
        newMemberJoined,
      }),
    [currentFill, maxGroupSize, minGroupSize, newMemberArchetype, newMemberJoined],
  )
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
      const url = buildMatchedDestinationUrl(groupId)
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

      if (cancelNavigationTimerRef.current) {
        clearTimeout(cancelNavigationTimerRef.current)
      }

      cancelNavigationTimerRef.current = setTimeout(() => {
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

      if (cancelNavigationTimerRef.current) {
        clearTimeout(cancelNavigationTimerRef.current)
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
        <MatchingStatusPendingSection
          newMemberJoined={newMemberJoined}
          newMemberArchetype={newMemberArchetype}
          waitingCopy={waitingCopy}
          currentFill={currentFill}
          maxGroupSize={maxGroupSize}
          minGroupSize={minGroupSize}
          seatsNeeded={seatsNeeded}
          waitingSeats={waitingSeats}
          fillStatusText={fillStatusText}
          refreshCountdown={refreshCountdown}
          onRefreshWaitingState={handleRefreshWaitingState}
        />
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

      <MatchingStatusDetailSections
        showMatchedDetails={matchStatus === 'matched'}
        showChemistryCard={Boolean(
          matchStatus === 'matched' && (viewerSpotlight || groupAnalysis?.overallChemistry || leadIceBreaker),
        )}
        effectiveGroupDetails={effectiveGroupDetails}
        viewerPairSummaryByMemberId={viewerPairSummaryByMemberId}
        viewerSpotlight={viewerSpotlight}
        chemistryTokens={chemistryTokens}
        leadIceBreaker={leadIceBreaker}
        persistedThemeSummary={persistedThemeSummary}
      />

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
          <View className='matching-status__cancel-row'>
            <Image
              className='matching-status__cancel-mascot'
              mode='aspectFit'
              src={getXiaoyueExpressionAsset('optOutReassure')}
            />
            <Button
              variant='secondary'
              className='matching-status__cancel-btn'
              onClick={handleCancel}
              disabled={isCancelling}
              loading={isCancelling}
            >
              {isCancelling ? '取消中…' : '取消报名'}
            </Button>
          </View>
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

      <MatchingStatusLiveOverlay
        liveStage={liveStage}
        stageTemperature={stageTemperature}
        isLoadingLiveGroupDetails={isLoadingLiveGroupDetails}
        effectiveGroupDetails={effectiveGroupDetails}
        viewerPairSummaryByMemberId={viewerPairSummaryByMemberId}
        viewerSpotlight={viewerSpotlight}
        matchedGroupNumber={matchedData?.groupNumber}
        shouldReduceMotion={shouldReduceMotion}
        persistedThemeSummary={persistedThemeSummary}
        resolvedGroupId={resolvedGroupId}
        onContinueFromMembers={handleContinueFromMembers}
        onFinishLiveJourney={finishLiveJourney}
      />
    </ScrollView>
  )
}

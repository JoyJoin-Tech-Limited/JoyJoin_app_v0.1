import Taro from '@tarojs/taro'
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
import { logError, logInfo } from '../../lib/logger'
import {
  navigateBackOrEventsTab,
  openPoolGroupDetail,
  replaceWithPoolGroupDetail,
  switchToDiscoverTab,
  switchToEventsTab,
} from '../../lib/matchingNavigation'
import {
  buildWaitingSeats,
  DEFAULT_MAX_GROUP_SIZE,
  DEFAULT_MIN_GROUP_SIZE,
  DEFAULT_REFRESH_INTERVAL_SECONDS,
  getChemistryTokens,
  getCountdownState,
  getTemperatureCopy,
  getWaitingStateCopy,
  isVenueUnlocked,
  resolvePersistedThemeSummary,
  type LiveRevealStage,
  type PoolFillStats,
  type ThemeSummary,
  type ViewerPairSpotlight,
} from './matchingStatusViewModels'

export interface SimilarPoolSummary {
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

export interface UseMatchingStatusControllerArgs {
  registrationId: string
  routerParams: Record<string, string | undefined>
}

export function useMatchingStatusController({
  registrationId,
  routerParams,
}: UseMatchingStatusControllerArgs) {
  const queryClient = useQueryClient()
  const { user, isLoading: authLoading } = useAuthGuard()
  const { shouldReduceMotion } = useMiniRevealMotion(routerParams)

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

  // Theme line precedence: see `resolvePersistedThemeSummary` in matchingStatusViewModels.
  const persistedThemeSummary = useMemo<ThemeSummary | null>(
    () =>
      resolvePersistedThemeSummary({
        themeRevealData,
        group: effectiveGroupDetails?.group,
        registration,
      }),
    [effectiveGroupDetails?.group, registration, themeRevealData],
  )

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

  const navigateToMatchedDestination = useCallback((groupId: string) => {
    setLiveStage('idle')
    replaceWithPoolGroupDetail(groupId)
  }, [])

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
        navigateBackOrEventsTab()
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
    openPoolGroupDetail(resolvedGroupId)
  }, [resolvedGroupId])

  const handleBrowsePools = useCallback(() => {
    switchToDiscoverTab()
  }, [])

  const handleRejoinPool = useCallback((poolId: string) => {
    Taro.navigateTo({ url: `/pages/pool-registration/index?id=${poolId}` })
  }, [])

  const invalidateRegistrationQuery = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['mini-program', 'pool-registration', registrationId] })
  }, [queryClient, registrationId])

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
        void queryClient.invalidateQueries({ queryKey: ['mini-program', 'my-pool-registrations'] })
        if (data.groupId) {
          void queryClient.invalidateQueries({
            queryKey: ['mini-program', 'pool-group', data.groupId],
          })
          // Theme fields on the group can feed match-explanation / group-analysis prompts; refetch so cache metadata and copy stay aligned.
          void queryClient.invalidateQueries({
            queryKey: ['mini-program', 'pool-group-analysis', data.groupId],
          })
        }

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

  const stageTemperature = getTemperatureCopy(matchedData?.temperatureLevel)

  return {
    authLoading,
    isLoading,
    fetchError,
    registration,
    rootClassName,
    shouldReduceMotion,
    matchStatus,
    poolFillStats,
    resolvedGroupId,
    matchedData,
    effectiveGroupDetails,
    effectiveEventDateTime,
    countdown,
    isCancelled,
    isNoMatchState,
    venueUnlocked,
    waitingCopy,
    currentFill,
    minGroupSize,
    maxGroupSize,
    seatsNeeded,
    fillStatusText,
    waitingSeats,
    newMemberJoined,
    newMemberArchetype,
    refreshCountdown,
    persistedThemeSummary,
    viewerPairSummaryByMemberId,
    viewerSpotlight,
    chemistryTokens,
    leadIceBreaker,
    groupAnalysis,
    liveRevealError,
    liveStage,
    isLoadingLiveGroupDetails,
    handleRefreshWaitingState,
    handleOpenMatchedJourney,
    handleBrowsePools,
    handleRejoinPool,
    handleCancel,
    isCancelling,
    handleContinueFromMembers,
    finishLiveJourney,
    similarPools,
    invalidateRegistrationQuery,
    switchToEventsTab,
    navigateBackOrEventsTab,
    stageTemperature,
  }
}

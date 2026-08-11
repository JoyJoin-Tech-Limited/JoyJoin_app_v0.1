import Taro, { useDidHide } from '@tarojs/taro'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type AuthUserResponse,
  cancelPoolRegistration,
  getMatchCompass,
  getMyPoolRegistrations,
  getPoolGroupAnalysis,
  getPoolGroupDetails,
  type MatchCompassResponse,
  type PoolGroupDetailsResponse,
  type PoolRegistrationSummary,
  type SimilarPoolSummary,
  updateMatchCompassPreferences,
  type UpdateMatchCompassPreferencesRequest,
} from '@shared/api'
import type { PairExplanation } from '@shared/types/groupAnalysis'
import type {
  EventThemeTitleRevealedData,
  PoolMatchedData,
  PoolRegistrationAddedData,
} from '@shared/wsEvents'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { getErrorMessage, type ErrorCode } from '@shared/copy/errorBaselines'
import {
  buildWaitingSeats,
  DEFAULT_MAX_GROUP_SIZE,
  DEFAULT_MIN_GROUP_SIZE,
  DEFAULT_REFRESH_INTERVAL_SECONDS,
  getMatchingStatusScreenState,
  getChemistryTokens,
  getCountdownState,
  getTemperatureCopy,
  getWaitingStateCopy,
  isVenueUnlocked,
  resolveMatchingStatusAuthBootstrap,
  resolvePersistedThemeSummary,
  composeUnifiedReveal,
  type LiveRevealStage,
  type PoolFillStats,
  type ThemeSummary,
  type ViewerPairSpotlight,
  type UnifiedRevealTokens,
} from '@shared/features/matching-status'
import { apiRequest } from '../../lib/api/api'
import { interactionLatency } from '../../lib/analytics/interactionLatency'
import { useOptimisticMutation } from '../../hooks/useOptimisticMutation'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useMiniRevealMotion } from '../../hooks/useMiniRevealMotion'
import { usePageVisibility } from '../../hooks/usePageVisibility'
import { useWebSocket } from '../../hooks/useWebSocket'
import { REGISTRATIONS_QUERY_KEY } from '../../lib/prefetchEngine'
import { logError, logInfo, logWarn } from '../../lib/utils/logger'
import {
  navigateBackOrEventsTab,
  replaceWithPoolGroupDetail,
  replaceWithSquadUnboxing,
  switchToDiscoverTab,
  switchToEventsTab,
} from '../../lib/navigation/matchingNavigation'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import {
  AUTH_QUERY_KEY,
} from '../../lib/api/authSession'
import {
  STALE_TIME_BRIEF_MS,
  TOAST_DEFAULT_MS,
  TOAST_FATAL_MS,
  COLOR_DANGER,
} from '../../lib/utils/uiConstants'
import { generateChemistryPayoff } from '../../lib/matching/chemistryPayoff'

const REGISTRATION_REFETCH_INTERVAL_MS = 30_000
const POOL_GROUP_FILL_REFETCH_INTERVAL_MS = 20_000
const GROUP_DETAILS_STALE_TIME_MS = 60_000
const GROUP_DETAILS_REFETCH_INTERVAL_MS = 30_000
const GROUP_ANALYSIS_STALE_TIME_MS = STALE_TIME_BRIEF_MS
const GROUP_ANALYSIS_REFETCH_INTERVAL_MS = 60_000
const CANCEL_NAVIGATION_DELAY_MS = 1500
const NEW_MEMBER_BADGE_DURATION_MS = TOAST_DEFAULT_MS
const LIVE_STAGE_DELAY_MS = 950
const LIVE_STAGE_DELAY_REDUCED_MS = 140
const MAX_SIMILAR_POOLS = 3
const DANGER_COLOR = COLOR_DANGER
const MATCH_COMPASS_REFETCH_INTERVAL_MS = 30_000

function triggerLightHaptic() {
  if (typeof Taro.vibrateShort === 'function') {
    void Taro.vibrateShort({ type: 'light' }).catch(() => undefined)
  }
}

/** Shared lock copy — used verbatim by the client pre-lock guard and the
 *  optimistic-rollback toast when the server rejects a mid-edit save. */
const MATCH_COMPASS_LOCKED_TOAST = '偏好已锁定，距离活动开始不足 24 小时，可在「足迹」查看最新状态'

/** Server rejects the PATCH with `{ code: "preferences_locked" }` when the
 *  preference window closed between render and save. */
function isCompassLockedError(error: unknown): boolean {
  const candidate = error as { code?: unknown; data?: { code?: unknown } } | null
  return candidate?.code === 'preferences_locked' || candidate?.data?.code === 'preferences_locked'
}

/** getErrorMessage resolves unknown codes to this generic fallback string —
 *  used to detect "no mapping exists" without duplicating the ErrorCode union. */
const ERROR_CODE_GENERIC_FALLBACK = '出了点问题，稍后再试'

/** Copy-governed rollback toast for the compass save: non-locked server
 *  errors carrying a known baseline error code (ApiError.data.code, the same
 *  field preferences_locked arrives on) map through getErrorMessage; anything
 *  unknown falls back to the shared submit-failed baseline. */
function resolveCompassRollbackMessage(error: unknown): string {
  const candidate = error as { code?: unknown; data?: { code?: unknown } } | null
  const code = candidate?.code ?? candidate?.data?.code
  if (typeof code === 'string') {
    const mapped = getErrorMessage(code as ErrorCode)
    if (mapped !== ERROR_CODE_GENERIC_FALLBACK) return mapped
  }
  return getErrorMessage('submit-failed')
}

export interface UseMatchingStatusControllerArgs {
  registrationId: string
  routerParams: Record<string, string | undefined>
}

/**
 * Hook that manages the full matching-status screen state machine.
 * @param args - Controller arguments
 * @param args.registrationId - The current pool registration ID
 * @param args.routerParams - URL route parameters
 * @returns Screen state, registration data, group details, and action handlers
 * @description Coordinates registration queries, group fill stats, WebSocket
 *              messages for live match reveals, countdown timers, and navigation.
 * @sideEffects Subscribes to WebSocket events, manages multiple setTimeout refs.
 */
export function useMatchingStatusController({
  registrationId,
  routerParams,
}: UseMatchingStatusControllerArgs) {
  const queryClient = useQueryClient()
  const { user, isLoading: authLoading } = useAuthGuard()
  const matchingLiveRevealEnabled = user?.features?.matchingLiveReveal ?? true
  const matchingPuzzlePreludeEnabled = user?.features?.matchingPuzzlePreludeEnabled ?? false
  const { shouldReduceMotion } = useMiniRevealMotion(routerParams)
  const { isPageVisible } = usePageVisibility()
  const cachedAuthUser = queryClient.getQueryData<AuthUserResponse | null>(AUTH_QUERY_KEY)
  const { effectiveAuthUser, isAuthBootstrapPending } = resolveMatchingStatusAuthBootstrap({
    authUser: user,
    cachedAuthUser,
    authLoading,
  })
  const hasResolvedAuthBootstrap = !isAuthBootstrapPending

  const [isCancelling, setIsCancelling] = useState(false)
  const [liveStage, setLiveStage] = useState<LiveRevealStage>('idle')
  const [hasRevealed, setHasRevealed] = useState(false)
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
  const mountedRef = useRef(true)

  const {
    data: allRegistrations,
    status: registrationQueryStatus,
    error: fetchError,
  } = useQuery<PoolRegistrationSummary[]>({
    queryKey: [...REGISTRATIONS_QUERY_KEY],
    queryFn: () => getMyPoolRegistrations(apiRequest),
    enabled: Boolean(registrationId),
    staleTime: 30_000,
    refetchInterval: isPageVisible ? REGISTRATION_REFETCH_INTERVAL_MS : false,
  })

  const registration = allRegistrations?.find((item) => item.id === registrationId)

  const historicalMatches = useMemo(() => {
    if (!allRegistrations) return []
    return allRegistrations.filter(
      (r) =>
        r.id !== registrationId &&
        r.assignedGroupId != null &&
        (r.matchStatus === 'matched' || r.matchStatus === 'completed'),
    )
  }, [allRegistrations, registrationId])

  const matchStatus = registration?.matchStatus ?? 'pending'

  const matchCompassEnabled = Boolean(effectiveAuthUser?.matchCompassEnabled)

  const {
    data: matchCompass,
    isFetching: isMatchCompassFetching,
  } = useQuery<MatchCompassResponse>({
    queryKey: ['mini-program', 'match-compass', registration?.poolId],
    queryFn: () =>
      getMatchCompass(apiRequest, registration?.poolId ?? ''),
    enabled:
      hasResolvedAuthBootstrap &&
      matchCompassEnabled &&
      matchStatus === 'pending' &&
      Boolean(registration?.poolId),
    refetchInterval: isPageVisible ? MATCH_COMPASS_REFETCH_INTERVAL_MS : false,
    staleTime: 0,
  })

  const {
    data: poolFillStats,
    dataUpdatedAt: poolFillUpdatedAt,
  } = useQuery<PoolFillStats>({
    queryKey: ['mini-program', 'pool-group-fill', registration?.poolId],
    queryFn: () =>
      apiRequest<PoolFillStats>({
        path: `/api/event-pools/${encodeURIComponent(registration?.poolId ?? '')}/group-fill`,
      }),
    enabled: hasResolvedAuthBootstrap && matchStatus === 'pending' && Boolean(registration?.poolId),
    refetchInterval: isPageVisible ? POOL_GROUP_FILL_REFETCH_INTERVAL_MS : false,
    staleTime: 0,
  })

  const fullPoolDismissKey = registration?.poolId
    ? `jj_full_pool_banner_dismissed_${registration.poolId}_${effectiveAuthUser?.id ?? 'anonymous'}`
    : null
  const [isFullPoolBannerDismissed, setIsFullPoolBannerDismissed] = useState(false)

  useEffect(() => {
    if (!fullPoolDismissKey) {
      setIsFullPoolBannerDismissed(false)
      return
    }

    try {
      setIsFullPoolBannerDismissed(Boolean(Taro.getStorageSync<boolean>(fullPoolDismissKey)))
    } catch (error) {
      logWarn('[MatchingStatus] Failed to read full pool banner dismiss state', {
        key: fullPoolDismissKey,
        message: error instanceof Error ? error.message : String(error),
      })
      setIsFullPoolBannerDismissed(false)
    }
  }, [fullPoolDismissKey])

  const isFullPoolBannerVisible =
    matchStatus === 'pending' &&
    Boolean(poolFillStats?.isFull) &&
    !isFullPoolBannerDismissed

  const handleDismissFullPoolBanner = useCallback(() => {
    if (fullPoolDismissKey) {
      try {
        Taro.setStorageSync(fullPoolDismissKey, true)
      } catch (error) {
        logWarn('[MatchingStatus] Failed to persist full pool banner dismiss state', {
          key: fullPoolDismissKey,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    setIsFullPoolBannerDismissed(true)
  }, [fullPoolDismissKey])

  const resolvedGroupId = matchedData?.groupId ?? registration?.assignedGroupId ?? ''

  const { data: matchedGroupDetails } = useQuery<PoolGroupDetailsResponse>({
    queryKey: ['mini-program', 'pool-group', resolvedGroupId],
    queryFn: () => getPoolGroupDetails(apiRequest, resolvedGroupId),
    enabled:
      hasResolvedAuthBootstrap &&
      Boolean(resolvedGroupId) &&
      (registration?.matchStatus === 'matched' || Boolean(matchedData?.groupId)),
    staleTime: GROUP_DETAILS_STALE_TIME_MS,
    refetchInterval: isPageVisible ? GROUP_DETAILS_REFETCH_INTERVAL_MS : false,
  })

  const { data: groupAnalysis } = useQuery({
    queryKey: ['mini-program', 'pool-group-analysis', resolvedGroupId],
    queryFn: () => getPoolGroupAnalysis(apiRequest, resolvedGroupId),
    enabled:
      hasResolvedAuthBootstrap &&
      Boolean(resolvedGroupId) &&
      (registration?.matchStatus === 'matched' || Boolean(matchedData?.groupId)),
    staleTime: GROUP_ANALYSIS_STALE_TIME_MS,
    refetchInterval: isPageVisible ? GROUP_ANALYSIS_REFETCH_INTERVAL_MS : false,
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
  const isRegistrationUnresolved =
    Boolean(registrationId) && (isAuthBootstrapPending || registrationQueryStatus === 'pending')
  const screenState = getMatchingStatusScreenState({
    hasRegistrationId: Boolean(registrationId),
    isRegistrationUnresolved,
    hasFetchError: registrationQueryStatus === 'error' || Boolean(fetchError),
    registration,
    isCancelled,
    isNoMatchState,
  })

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
        ? `已经达到成桌门槛，${DEFAULT_MASCOT_DISPLAY_NAME}正在优先为这桌完成配对。`
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

  const currentUserId = effectiveAuthUser?.id ?? null

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

  const chemistryPayoff = useMemo(() => {
    if (!effectiveGroupDetails?.members?.length) return null
    return generateChemistryPayoff(
      effectiveGroupDetails.members,
      user
        ? {
            topInterests: user.topInterests,
            archetype: (user as unknown as Record<string, unknown>).archetype as string | undefined,
          }
        : undefined,
    )
  }, [effectiveGroupDetails?.members, user])

  const baseChemistryTokens = useMemo(
    () =>
      getChemistryTokens(
        groupAnalysis?.overallChemistry,
        viewerSpotlight?.pair.chemistryScore ??
          effectiveGroupDetails?.group.matchScore ??
          registration?.matchScore ??
          matchedData?.matchScore ??
          null,
      ),
    [
      groupAnalysis?.overallChemistry,
      viewerSpotlight?.pair.chemistryScore,
      effectiveGroupDetails?.group.matchScore,
      registration?.matchScore,
      matchedData?.matchScore,
    ],
  )

  const unifiedReveal = useMemo<UnifiedRevealTokens>(
    () => composeUnifiedReveal({ chemistryPayoff, viewerSpotlight }),
    [chemistryPayoff, viewerSpotlight],
  )

  const chemistryTokens = useMemo(
    () => ({
      ...baseChemistryTokens,
      body: unifiedReveal.body,
    }),
    [baseChemistryTokens, unifiedReveal],
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
      queryKey: [...REGISTRATIONS_QUERY_KEY],
    })
  }, [queryClient, registration?.poolId, registrationId])

  const fetchLiveGroupDetails = useCallback(
    async (groupId: string) => {
      setIsLoadingLiveGroupDetails(true)
      setLiveRevealError(null)

      try {
        if (!mountedRef.current) return null

        const details = await queryClient.fetchQuery({
          queryKey: ['mini-program', 'pool-group', groupId],
          queryFn: () => getPoolGroupDetails(apiRequest, groupId),
          staleTime: 60_000,
        })

        if (!mountedRef.current) return null
        setLiveGroupDetails(details)
        return details
      } catch (error) {
        if (!mountedRef.current) return null
        logError('[MatchingStatus] Failed to fetch live group details', {
          groupId,
          message: error instanceof Error ? error.message : 'Unknown error',
        })
        setLiveGroupDetails(null)
        setLiveRevealError('桌友卡片还在路上，点击刷新或稍后再来')
        return null
      } finally {
        if (mountedRef.current) {
          setIsLoadingLiveGroupDetails(false)
        }
      }
    },
    [queryClient],
  )

  const navigateToMatchedDestination = useCallback((groupId: string) => {
    setLiveStage('idle')
    if (hasRevealed) {
      replaceWithPoolGroupDetail(groupId)
    } else {
      replaceWithSquadUnboxing(groupId)
    }
  }, [hasRevealed])

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
      triggerLightHaptic()
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
        confirmColor: DANGER_COLOR,
      })
      if (!confirm) return

      setIsCancelling(true)
      logInfo('[MatchingStatus] Cancelling registration', { registrationId })
      await cancelPoolRegistration(apiRequest, registrationId)

      Taro.showToast({ title: '已取消报名', icon: 'success', duration: TOAST_DEFAULT_MS })

      if (cancelNavigationTimerRef.current) {
        clearTimeout(cancelNavigationTimerRef.current)
      }

      cancelNavigationTimerRef.current = setTimeout(() => {
        navigateBackOrEventsTab()
      }, CANCEL_NAVIGATION_DELAY_MS)
    } catch (error) {
      const message = error instanceof Error ? error.message : getErrorMessage('cancel-failed')
      logError('[MatchingStatus] Cancel failed', { message })
      Taro.showToast({ title: message, icon: 'none', duration: TOAST_FATAL_MS })
    } finally {
      setIsCancelling(false)
    }
  }, [isCancelling, registrationId])

  const handleOpenMatchedJourney = useCallback(() => {
    const poolId = registration?.poolId
    if (!poolId) {
      Taro.showToast({ title: '活动信息还在同步，请稍后再试', icon: 'none', duration: TOAST_DEFAULT_MS })
      void queryClient.invalidateQueries({ queryKey: [...REGISTRATIONS_QUERY_KEY] })
      return
    }
    logInfo('[MatchingStatus] CTA tapped, opening event detail', { poolId, groupId: resolvedGroupId })
    setLiveStage('idle')
    Taro.navigateTo({
      url: `${MINI_PROGRAM_ROUTES.eventDetail}?id=${encodeURIComponent(poolId)}`,
      fail: () => {
        Taro.showToast({ title: '跳转失败，请重试', icon: 'none', duration: TOAST_DEFAULT_MS })
      },
    })
  }, [queryClient, registration?.poolId, registrationId, resolvedGroupId])

  const handleStartSquadUnboxing = useCallback(() => {
    if (!resolvedGroupId) {
      Taro.showToast({ title: '小队信息还在同步，请稍后再试', icon: 'none', duration: TOAST_DEFAULT_MS })
      void queryClient.invalidateQueries({ queryKey: [...REGISTRATIONS_QUERY_KEY] })
      return
    }

    setLiveStage('idle')
    replaceWithSquadUnboxing(resolvedGroupId)
  }, [queryClient, registrationId, resolvedGroupId])

  const handleBrowsePools = useCallback(() => {
    switchToDiscoverTab()
  }, [])

  const handleRejoinPool = useCallback((poolId: string) => {
    Taro.navigateTo({ url: `/pages/pool-registration/index?id=${poolId}` })
  }, [])

  const invalidateRegistrationQuery = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...REGISTRATIONS_QUERY_KEY] })
  }, [queryClient])

  const handleRetryLiveReveal = useCallback(() => {
    setLiveRevealError(null)
    void queryClient.invalidateQueries({ queryKey: [...REGISTRATIONS_QUERY_KEY] })
    if (matchedData?.groupId) {
      void fetchLiveGroupDetails(matchedData.groupId)
    }
  }, [queryClient, matchedData, fetchLiveGroupDetails])

  const handleDismissLiveReveal = useCallback(() => {
    setLiveRevealError(null)
    setLiveStage('idle')
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
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

  // H5 screenshot story mode: force the members-stage puzzle prelude when
  // `__story=puzzle` is present. Only active in builds that opt in via
  // `TARO_APP_ENABLE_STORY_MODE=true`.
  useEffect(() => {
    const storyMode = process.env.TARO_APP_ENABLE_STORY_MODE === 'true'
    const storyName = routerParams['__story']
    if (!storyMode || storyName !== 'puzzle') return
    if (!hasResolvedAuthBootstrap) return
    if (!resolvedGroupId) return

    setHasRevealed(false)
    setLiveStage('members')
    void fetchLiveGroupDetails(resolvedGroupId)
  }, [fetchLiveGroupDetails, hasResolvedAuthBootstrap, resolvedGroupId, routerParams])

  useEffect(() => {
    if (matchStatus !== 'pending' || !registration?.poolId) {
      return undefined
    }

    // Freeze the countdown while the page is hidden: WeChat keeps tab pages
    // alive-but-hidden, so an unmuted 1s decrement would re-render the hidden
    // page every second. Re-show resets it via handleRefreshWaitingState.
    if (!isPageVisible) {
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
  }, [handleRefreshWaitingState, isPageVisible, matchStatus, refreshCountdown, registration?.poolId])

  useEffect(() => {
    if (matchStatus === 'pending') {
      setRefreshCountdown(DEFAULT_REFRESH_INTERVAL_SECONDS)
    }
  }, [matchStatus, poolFillUpdatedAt])

  useDidHide(() => {
    setLiveStage('idle')
    if (liveStageTimerRef.current) {
      clearTimeout(liveStageTimerRef.current)
      liveStageTimerRef.current = null
    }
  })

  // Clear transient local state when live overlay exits,
  // so the React Query cache becomes the source of truth.
  useEffect(() => {
    if (liveStage !== 'idle') return
    setLiveGroupDetails(null)
    setThemeRevealData(null)
    setLiveRevealError(null)
  }, [liveStage])

  // Check hasRevealed flag when resolvedGroupId changes
  useEffect(() => {
    if (!resolvedGroupId) {
      setHasRevealed(false)
      return
    }

    try {
      const flag = Taro.getStorageSync<boolean>(`jj_revealed_${resolvedGroupId}`)
      setHasRevealed(Boolean(flag))
    } catch (error) {
      logWarn('[MatchingStatus] Failed to read hasRevealed flag', {
        groupId: resolvedGroupId,
        message: error instanceof Error ? error.message : String(error),
      })
      setHasRevealed(false)
    }
  }, [resolvedGroupId])

  // Polling fallback: if registration data shows matchStatus=matched but WS
  // never fired (user was on another page or WS was disconnected), trigger
  // the live overlay when the controller mounts or registration updates.
  useEffect(() => {
    if (liveStage !== 'idle') return
    if (registration?.matchStatus !== 'matched') return
    if (hasRevealed) return

    triggerLightHaptic()
    setLiveStage('match')
    if (resolvedGroupId) {
      void fetchLiveGroupDetails(resolvedGroupId)
    }
  }, [
    liveStage,
    registration?.matchStatus,
    hasRevealed,
    resolvedGroupId,
    fetchLiveGroupDetails,
  ])

  useEffect(() => {
    if (liveStage !== 'match' || isLoadingLiveGroupDetails || liveRevealError) {
      return undefined
    }

    if (liveStageTimerRef.current) {
      clearTimeout(liveStageTimerRef.current)
    }

    if (!hasRevealed && resolvedGroupId) {
      return undefined
    }

    liveStageTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return

      if (effectiveGroupDetails?.members && effectiveGroupDetails.members.length > 0) {
        triggerLightHaptic()
        setLiveStage('members')
        return
      }

      if (persistedThemeSummary) {
        triggerLightHaptic()
        setLiveStage('theme')
        return
      }

      finishLiveJourney()
    }, shouldReduceMotion ? LIVE_STAGE_DELAY_REDUCED_MS : LIVE_STAGE_DELAY_MS)

    return () => {
      if (liveStageTimerRef.current) {
        clearTimeout(liveStageTimerRef.current)
      }
    }
  }, [
    effectiveGroupDetails,
    finishLiveJourney,
    hasRevealed,
    isLoadingLiveGroupDetails,
    liveRevealError,
    liveStage,
    persistedThemeSummary,
    resolvedGroupId,
    shouldReduceMotion,
  ])

  useWebSocket({
    eventTypes: ['POOL_MATCHED', 'POOL_REGISTRATION_ADDED', 'EVENT_THEME_TITLE_REVEALED'],
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

        if (matchedData?.groupId === data.groupId) {
          logInfo('[MatchingStatus] Duplicate POOL_MATCHED ignored', { groupId: data.groupId })
          return
        }

        setMatchedData(data)
        setLiveGroupDetails(null)
        setLiveRevealError(null)
        setLiveStage('match')
        triggerLightHaptic()

        void queryClient.invalidateQueries({
          queryKey: [...REGISTRATIONS_QUERY_KEY],
        })
        void queryClient.invalidateQueries({
          queryKey: ['mini-program', 'notification-counts'],
        })

        if (data.groupId) {
          void fetchLiveGroupDetails(data.groupId)
          void queryClient.invalidateQueries({
            queryKey: ['mini-program', 'pool-group-analysis', data.groupId],
          })
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
          if (!mountedRef.current) return
          setNewMemberJoined(false)
          setNewMemberArchetype(null)
        }, NEW_MEMBER_BADGE_DURATION_MS)

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
          queryKey: [...REGISTRATIONS_QUERY_KEY],
        })
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
    enabled:
      hasResolvedAuthBootstrap &&
      isNoMatchState &&
      Boolean(registration?.poolCity) &&
      Boolean(registration?.poolEventType),
    select: (pools) => pools.filter((pool) => pool.id !== registration?.poolId).slice(0, MAX_SIMILAR_POOLS),
  })

  const stageTemperature = getTemperatureCopy(matchedData?.temperatureLevel)

  // M3: shared optimistic mutation (M2 hook) — instant UI flip on save,
  // server stays source of truth (rollback + eviction + invalidate owned by
  // the hook). Dedupe coalesces slider storms (AC-4), no extra debouncing.
  const compassSaveMutation = useOptimisticMutation<UpdateMatchCompassPreferencesRequest, unknown>({
    mutationFn: (patch) => {
      if (!registration?.id) {
        return Promise.reject(new Error('缺少报名信息'))
      }
      return updateMatchCompassPreferences(apiRequest, registration.id, patch)
    },
    queryKeys: [['mini-program', 'match-compass', registration?.poolId ?? '']],
    // Patch fields are a subset of MatchCompassResponse; spread preserves
    // isLocked / lockAt / temperature / counts untouched by the request.
    optimisticUpdate: (patch, prev) => ({
      ...(prev as MatchCompassResponse | undefined),
      ...patch,
    }),
    // Server truth refresh after settle (success or failure).
    onSettledInvalidate: [['mini-program', 'match-compass', registration?.poolId ?? '']],
    // Lock-transition mapping: server rejects with preferences_locked when the
    // window closed mid-edit; other server errors with a known baseline code
    // get their mapped copy; everything else uses the shared submit-failed copy.
    rollbackMessage: (error) =>
      isCompassLockedError(error) ? MATCH_COMPASS_LOCKED_TOAST : resolveCompassRollbackMessage(error),
  })

  const handleUpdateMatchCompass = useCallback(
    (patch: UpdateMatchCompassPreferencesRequest) => {
      if (!registration?.poolId || !matchCompass || matchCompass.isLocked) {
        Taro.showToast({
          title: MATCH_COMPASS_LOCKED_TOAST,
          icon: 'none',
          duration: TOAST_DEFAULT_MS,
        })
        return
      }

      const t0 = interactionLatency.startInteraction()

      void compassSaveMutation.mutate(patch).catch(() => {
        // Failure UX (rollback + toast) is owned by useOptimisticMutation.
      })
      // M0 feedback mark moves to the optimistic apply — perceived feedback
      // is instant by design (wait-tier S). Haptic fires with the state flip.
      interactionLatency.trackInteraction('compass_save', t0)
      triggerLightHaptic()
    },
    [matchCompass, registration?.poolId, compassSaveMutation],
  )

  return {
    screenState,
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
    historicalMatches,
    persistedThemeSummary,
    viewerPairSummaryByMemberId,
    viewerSpotlight,
    chemistryTokens,
    unifiedReveal,
    leadIceBreaker,
    groupAnalysis,
    hasRevealed,
    liveRevealError,
    liveStage,
    isLoadingLiveGroupDetails,
    handleRefreshWaitingState,
    handleOpenMatchedJourney,
    handleBrowsePools,
    handleRejoinPool,
    handleCancel,
    isCancelling,
    handleStartSquadUnboxing,
    handleContinueFromMembers,
    finishLiveJourney,
    similarPools,
    invalidateRegistrationQuery,
    handleRetryLiveReveal,
    handleDismissLiveReveal,
    switchToEventsTab,
    navigateBackOrEventsTab,
    stageTemperature,
    matchCompassEnabled,
    matchCompass,
    isMatchCompassFetching,
    handleUpdateMatchCompass,
    isFullPoolBannerVisible,
    handleDismissFullPoolBanner,
    matchingLiveRevealEnabled,
    matchingPuzzlePreludeEnabled,
  }
}

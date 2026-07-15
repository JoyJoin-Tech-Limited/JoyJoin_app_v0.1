import Taro from '@tarojs/taro'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  confirmPoolGroupAttendance,
  getPoolGroupAnalysis,
  getPoolGroupDetails,
  type PoolGroupDetailsResponse,
} from '@shared/api'
import type { PairExplanation } from '@shared/types/groupAnalysis'
import { ARCHETYPE_BY_ID, resolveArchetype } from '@shared/personality/archetypeNames'
import { apiRequest } from '../../lib/api/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useMiniRevealMotion } from '../../hooks/useMiniRevealMotion'
import { useResetOnShow } from '../../hooks/useResetOnShow'
import { haptics } from '../../lib/utils/haptics'
import { logError, logInfo } from '../../lib/utils/logger'
import { STALE_TIME_GROUP_ANALYSIS_MS, TOAST_SHORT_MS, TOAST_MEDIUM_MS, COLOR_DANGER } from '../../lib/utils/uiConstants'
import { openPoolGroupDetail, switchToEventsTab } from '../../lib/navigation/matchingNavigation'
import { squadUnboxingAnalytics, type SquadUnboxingEventType } from '../../lib/analytics/squadUnboxingAnalytics'
import {
  buildPairKeyMemberMap,
  computeActionDockState,
  computeBestPartnerUserId,
  getSquadChemistryTokens,
  type ActionDockState,
  type FlowState,
} from './squadUnboxingViewModels'
import { MAX_FAN_CARDS } from './computeFanLayout'
import {
  computeUnflippedCount,
  createSquadFlipSession,
  type FlipSnapshot,
  type SquadFlipSession,
} from './squadFlipState'

function getRevealFlagKey(groupId: string): string {
  return `jj_revealed_${groupId}`
}

function readRevealFlag(groupId: string): boolean {
  try {
    return Taro.getStorageSync(getRevealFlagKey(groupId)) === true
  } catch {
    return false
  }
}

function writeRevealFlag(groupId: string): void {
  try {
    Taro.setStorageSync(getRevealFlagKey(groupId), true)
  } catch (error) {
    logError('[SquadUnboxing] Failed to persist reveal flag', {
      groupId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

export interface UseSquadUnboxingControllerArgs {
  groupId: string
  routerParams: Record<string, string | undefined>
}

export function useSquadUnboxingController({ groupId, routerParams }: UseSquadUnboxingControllerArgs) {
  const { user: currentUser, isLoading: authLoading } = useAuthGuard()
  const { shouldReduceMotion } = useMiniRevealMotion(routerParams)

  const storyMode = process.env.TARO_APP_ENABLE_STORY_MODE === 'true'
  const storyName = routerParams['__story']

  const [flowState, setFlowState] = useState<FlowState>(() => (groupId ? (readRevealFlag(groupId) ? 'revealed' : 'ready') : 'ready'))
  // Tap-to-reveal session interactivity (AC-01/AC-03): derived from the
  // reveal flag AT ARRIVAL only. First visit (flag absent) → interactive
  // face-down game; re-entry (flag present) → all-up, no chip, no shimmer.
  // Writing the flag at box-open must NOT flip this back mid-session.
  const [isInteractiveSession, setIsInteractiveSession] = useState(() => (groupId ? !readRevealFlag(groupId) : false))
  const prevGroupIdRef = useRef<string>(groupId)
  useEffect(() => {
    if (!groupId) return
    if (prevGroupIdRef.current === groupId) return
    prevGroupIdRef.current = groupId
    setFlowState(readRevealFlag(groupId) ? 'revealed' : 'ready')
    setIsInteractiveSession(!readRevealFlag(groupId))
  }, [groupId])

  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false)

  // Tracked so the post-confirm redirect never fires after unmount.
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
  }, [])

  useResetOnShow(setIsSubmitting, setShowSuccessOverlay)

  // H5 screenshot story mode: force specific flow states when `__story` is
  // present. Only active in builds that opt in via `TARO_APP_ENABLE_STORY_MODE=true`.
  useEffect(() => {
    if (!storyMode) return
    // Every squad story state is a first-visit interactive session (the
    // face-down game); re-entry all-up is the non-story default when the
    // reveal flag is present.
    setIsInteractiveSession(true)
    if (storyName === 'ready') {
      setFlowState('ready')
      return
    }
    if (storyName === 'shaking') {
      setFlowState('shaking')
      return
    }
    if (
      storyName === 'focused' ||
      storyName === 'revealed' ||
      storyName === 'revealed-partial' ||
      storyName === 'revealed-allup'
    ) {
      setFlowState('revealed')
      return
    }
  }, [storyMode, storyName])

  const {
    data: poolGroup,
    isLoading,
    error: fetchError,
    refetch,
  } = useQuery<PoolGroupDetailsResponse>({
    queryKey: ['mini-program', 'pool-group', groupId],
    queryFn: () => getPoolGroupDetails(apiRequest, groupId),
    enabled: !!groupId && (!!currentUser || !authLoading),
    // While the venue is unassigned, poll gently so the "场地已确定" toast and
    // the 地点 row can flip without forcing the user to re-enter the page.
    // Stops as soon as a venue lands (or the page backgrounds — React Query
    // pauses interval refetches when the window is unfocused).
    refetchInterval: (query) =>
      query.state.data?.group?.venueAssignmentStatus === 'unassigned' ? 30_000 : false,
  })

  const {
    data: groupAnalysis,
    isLoading: isLoadingAnalysis,
    error: analysisError,
    refetch: refetchAnalysis,
  } = useQuery({
    queryKey: ['mini-program', 'pool-group-analysis', groupId],
    queryFn: () => getPoolGroupAnalysis(apiRequest, groupId),
    enabled: !!groupId && flowState === 'revealed',
    staleTime: STALE_TIME_GROUP_ANALYSIS_MS,
    retry: 1,
  })

  const currentUserId = currentUser?.id
  const members = useMemo(() => poolGroup?.members ?? [], [poolGroup?.members])
  const group = poolGroup?.group
  const pool = poolGroup?.pool

  const confirmAttendanceMutation = useMutation({
    mutationFn: () => confirmPoolGroupAttendance(apiRequest, groupId),
    onSuccess: async (response) => {
      logInfo('[SquadUnboxing] Attendance confirmed', {
        groupId,
        blindBoxEventId: response.blindBoxEventId,
      })

      squadUnboxingAnalytics.track('squad_unboxing_confirm_attendance_success', {
        groupId,
        screen: 'squad-unboxing',
        blindBoxEventId: response.blindBoxEventId,
      })

      haptics('success')
      setShowSuccessOverlay(true)

      await Taro.showToast({
        title: '座位已锁定 · 解锁新羁绊',
        icon: 'none',
        duration: TOAST_SHORT_MS,
      })

      // Allow the success overlay/toast to register before redirecting. The
      // timer is tracked so a backgrounded/unmounted page never fires a stale
      // redirect.
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
      redirectTimerRef.current = setTimeout(() => {
        redirectTimerRef.current = null
        if (response.blindBoxEventId) {
          Taro.redirectTo({ url: `/pages/event-detail/index?id=${response.blindBoxEventId}` })
          return
        }
        openPoolGroupDetail(groupId)
      }, 900)
    },
    onError: (error) => {
      const rawMessage = error instanceof Error ? error.message : '确认出席没成功'
      const errorCode = (error as any)?.code ?? (error as any)?.response?.data?.code ?? 'UNKNOWN'
      const message = errorCode === 'ATTENDANCE_NOT_READY' || rawMessage.includes('not ready for attendance')
        ? '当前活动暂未开放确认出席，请稍后再试'
        : rawMessage
      logError('[SquadUnboxing] Attendance confirmation failed', {
        groupId,
        message,
        errorCode,
      })
      squadUnboxingAnalytics.track('squad_unboxing_confirm_attendance_error', {
        groupId,
        screen: 'squad-unboxing',
        errorCode,
      })
      setIsSubmitting(false)
      Taro.showToast({ title: message, icon: 'none', duration: TOAST_MEDIUM_MS })
    },
  })

  const chemistryTokens = useMemo(
    () => getSquadChemistryTokens(groupAnalysis?.overallChemistry),
    [groupAnalysis?.overallChemistry],
  )

  const sortedPairExplanations = useMemo<PairExplanation[]>(() => {
    if (!groupAnalysis?.pairExplanations) {
      return []
    }

    if (!currentUserId) {
      return groupAnalysis.pairExplanations
    }

    return [...groupAnalysis.pairExplanations].sort((left, right) => {
      const leftHasCurrentUser = left.pairKey.includes(currentUserId)
      const rightHasCurrentUser = right.pairKey.includes(currentUserId)

      if (leftHasCurrentUser && !rightHasCurrentUser) return -1
      if (!leftHasCurrentUser && rightHasCurrentUser) return 1
      return 0
    })
  }, [currentUserId, groupAnalysis?.pairExplanations])

  const pairKeyMemberMap = useMemo(() => buildPairKeyMemberMap(members), [members])

  const viewerPairs = useMemo<PairExplanation[]>(() => {
    if (Array.isArray(groupAnalysis?.myPairs) && groupAnalysis.myPairs.length > 0) {
      return groupAnalysis.myPairs
    }

    if (!currentUserId) {
      return []
    }

    return sortedPairExplanations.filter((pair) => {
      const pairMembers = pairKeyMemberMap.get(pair.pairKey)
      return Boolean(pairMembers && pairMembers.some((member) => member.userId === currentUserId))
    })
  }, [currentUserId, groupAnalysis?.myPairs, pairKeyMemberMap, sortedPairExplanations])

  const viewerPairByMemberId = useMemo(() => {
    const map = new Map<string, PairExplanation>()

    if (!currentUserId) {
      return map
    }

    viewerPairs.forEach((pair) => {
      const pairMembers = pairKeyMemberMap.get(pair.pairKey)
      const otherMember = pairMembers?.find((member) => member.userId !== currentUserId)
      if (otherMember) {
        map.set(otherMember.userId, pair)
      }
    })

    return map
  }, [currentUserId, pairKeyMemberMap, viewerPairs])

  // ── Tap-to-reveal flip session (AC-13: flip state is controller-owned) ────
  // The session is the single source of truth for which cards are face-up;
  // focus state stays page-owned. Re-created per groupId so a new table never
  // inherits the previous table's flips.
  const visibleIds = useMemo(
    () => members.slice(0, MAX_FAN_CARDS).map((member) => member.userId),
    [members],
  )

  const bestPartnerUserId = useMemo(
    () => computeBestPartnerUserId(members, currentUserId, viewerPairByMemberId),
    [members, currentUserId, viewerPairByMemberId],
  )

  const flipSessionRef = useRef<SquadFlipSession | null>(null)
  const flipSessionGroupRef = useRef<string | null>(null)
  // B6: the session has a declared groupId dependency (useMemo); the ref
  // guard inside the factory keeps creation safe if React discards the memo
  // cache or double-invokes it — a stale table's session can never survive.
  useMemo(() => {
    if (flipSessionRef.current === null || flipSessionGroupRef.current !== groupId) {
      flipSessionRef.current?.destroy()
      flipSessionRef.current = createSquadFlipSession({
        now: () => Date.now(),
        setTimer: (cb, ms) => setTimeout(cb, ms),
        clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
        track: (eventType, payload) =>
          squadUnboxingAnalytics.track(eventType as SquadUnboxingEventType, {
            groupId,
            screen: 'squad-unboxing',
            ...payload,
          }),
      })
      flipSessionGroupRef.current = groupId
    }
  }, [groupId])

  const [flipSnapshot, setFlipSnapshot] = useState<FlipSnapshot>(() => flipSessionRef.current!.getSnapshot())
  useEffect(() => {
    const session = flipSessionRef.current!
    setFlipSnapshot(session.getSnapshot())
    return session.subscribe(() => setFlipSnapshot(session.getSnapshot()))
  }, [groupId])
  useEffect(() => () => flipSessionRef.current?.destroy(), [])

  const flipOne = useCallback(
    (id: string, method: 'tap' | 'auto_me') =>
      flipSessionRef.current!.flipOne(id, method, {
        index: members.findIndex((member) => member.userId === id),
        isBestPartner: id === bestPartnerUserId,
      }),
    [members, bestPartnerUserId],
  )

  const flipAll = useCallback(
    () =>
      flipSessionRef.current!.flipAll((id) => ({
        index: members.findIndex((member) => member.userId === id),
        isBestPartner: id === bestPartnerUserId,
      })),
    [members, bestPartnerUserId],
  )

  const isFlipInFlight = useCallback(() => flipSessionRef.current!.isFlipInFlight(), [])

  const notifyDealSettled = useCallback(
    (instant: boolean) => {
      flipSessionRef.current!.notifyDealSettled({
        visibleIds,
        currentUserId,
        bestPartnerUserId,
        interactive: isInteractiveSession,
        instant,
      })
    },
    [visibleIds, currentUserId, bestPartnerUserId, isInteractiveSession],
  )

  // Re-entry sessions are all-up: nothing left to flip, no hint chip.
  const unflippedCount = isInteractiveSession
    ? computeUnflippedCount(visibleIds, flipSnapshot.flippedIds)
    : 0

  // Story-mode seeding: deterministic face-up sets for the screenshot states.
  // Seed (no analytics/timers) so captures are timer-independent.
  useEffect(() => {
    if (!storyMode || members.length === 0) return
    const meId = currentUserId
    if (storyName === 'revealed-partial') {
      const seeds = [meId, ...visibleIds.filter((id) => id !== meId).slice(0, 2)].filter(
        (id): id is string => Boolean(id),
      )
      flipSessionRef.current?.seedFlipped(seeds)
      return
    }
    if (storyName === 'revealed-allup') {
      flipSessionRef.current?.seedFlipped(visibleIds)
      return
    }
    if (storyName === 'focused') {
      const seeds = [meId, ...visibleIds.filter((id) => id !== meId).slice(0, 3)].filter(
        (id): id is string => Boolean(id),
      )
      flipSessionRef.current?.seedFlipped(seeds)
    }
  }, [storyMode, storyName, members.length, visibleIds, currentUserId])

  const groupThemeHighlights = useMemo(
    () =>
      Array.isArray(group?.highlights)
        ? group.highlights.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 4)
        : [],
    [group?.highlights],
  )

  const analysisThemeTags = useMemo(() => {
    if (Array.isArray(groupAnalysis?.groupThemeTags) && groupAnalysis.groupThemeTags.length > 0) {
      return groupAnalysis.groupThemeTags.slice(0, 4)
    }

    return groupThemeHighlights
  }, [groupAnalysis?.groupThemeTags, groupThemeHighlights])

  const actionDockState = useMemo<ActionDockState>(
    () => computeActionDockState(flowState),
    [flowState],
  )

  const archetypeMixCopy = useMemo(() => {
    const archetypes = members
      .map((member) => member.archetype)
      .filter((archetype): archetype is string => Boolean(archetype))
    const uniqueArchetypes = Array.from(new Set(archetypes))
    if (uniqueArchetypes.length === 0) return ''

    const names = uniqueArchetypes
      .slice(0, 3)
      // Values may be IDs or legacy nameCn — resolveArchetype handles both.
      .map((id) => resolveArchetype(id)?.nameCn ?? ARCHETYPE_BY_ID[id]?.nameCn ?? '小伙伴')
    const suffix = uniqueArchetypes.length > 3 ? '等多种能量' : '三种能量'
    const label = uniqueArchetypes.length >= 3 ? suffix : uniqueArchetypes.length === 2 ? '两种能量' : '一种能量'

    if (names.length === 1) return `这一桌凝聚了${names[0]}的${label}`
    const last = names.pop()
    return `这一桌集齐了${names.join('、')}和${last}${label}`
  }, [members])

  const rootClassName = ['squad-unboxing', shouldReduceMotion ? 'squad-unboxing--reduce-motion' : '']
    .filter(Boolean)
    .join(' ')

  const handleOpenBox = useCallback((source: 'box' | 'ribbon' = 'box') => {
    if (flowState !== 'ready') return
    haptics('medium')
    if (source === 'box') {
      squadUnboxingAnalytics.track('squad_unboxing_box_tap', {
        groupId,
        screen: 'squad-unboxing',
      })
    }
    setIsAnalysisExpanded(false)
    setFlowState('shaking')
  }, [flowState, groupId])

  const handleConfirmAttendance = useCallback(() => {
    if (confirmAttendanceMutation.isPending || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    haptics('medium')
    squadUnboxingAnalytics.track('squad_unboxing_confirm_attendance_tap', {
      groupId,
      screen: 'squad-unboxing',
    })
    confirmAttendanceMutation.mutate()
  }, [confirmAttendanceMutation, groupId, isSubmitting])

  const handleSharePosterTap = useCallback(() => {
    squadUnboxingAnalytics.track('squad_unboxing_share_poster_tap', {
      groupId,
      screen: 'squad-unboxing',
    })
    haptics('light')
    Taro.showToast({
      title: '可以先截图保存这桌记忆，也可以从右上角转发给朋友',
      icon: 'none',
      duration: TOAST_MEDIUM_MS,
    })
  }, [groupId])

  const handleOpenGroupDetail = useCallback(() => {
    if (!groupId) {
      Taro.showToast({ title: '小队信息还在同步，请稍后再试', icon: 'none', duration: TOAST_MEDIUM_MS })
      return
    }

    haptics('light')
    openPoolGroupDetail(groupId)
  }, [groupId])

  const handleSkip = useCallback(async () => {
    haptics('light')
    const { confirm } = await Taro.showModal({
      title: '先离开这桌？',
      content: '确认后可以在「我的足迹」随时回看这桌的揭晓内容。',
      confirmText: '先离开',
      cancelText: '再看看',
      confirmColor: COLOR_DANGER,
    })

    if (confirm) {
      switchToEventsTab()
    }
  }, [])

  useEffect(() => {
    if (flowState !== 'shaking') {
      return undefined
    }

    // In story mode, keep the shaking state frozen for screenshots.
    if (storyMode && storyName === 'shaking') {
      return undefined
    }

    const timer = setTimeout(() => {
      haptics('cardReveal')
      haptics('medium')
      setFlowState('revealed')
      squadUnboxingAnalytics.track('squad_unboxing_box_open_milestone', {
        groupId,
        screen: 'squad-unboxing',
      })
    }, shouldReduceMotion ? 220 : 850)

    return () => clearTimeout(timer)
  }, [flowState, groupId, shouldReduceMotion])


  useEffect(() => {
    if (flowState !== 'revealed') {
      return undefined
    }

    writeRevealFlag(groupId)

    const timer = setTimeout(() => {
      squadUnboxingAnalytics.track('squad_unboxing_tonights_table_view', { groupId, screen: 'squad-unboxing' })
    }, shouldReduceMotion ? 120 : 900)

    return () => clearTimeout(timer)
  }, [flowState, groupId, shouldReduceMotion])

  return {
    authLoading,
    isLoading,
    fetchError,
    poolGroup,
    group,
    pool,
    members,
    currentUserId,
    groupAnalysis,
    isLoadingAnalysis,
    analysisError,
    chemistryTokens,
    sortedPairExplanations,
    pairKeyMemberMap,
    viewerPairs,
    viewerPairByMemberId,
    groupThemeHighlights,
    analysisThemeTags,
    flowState,
    isAnalysisExpanded,
    setIsAnalysisExpanded,
    actionDockState,
    rootClassName,
    shouldReduceMotion,
    confirmAttendanceMutation,
    isSubmitting,
    showSuccessOverlay,
    archetypeMixCopy,
    // Tap-to-reveal flip session (controller-owned per AC-13)
    flippedIds: flipSnapshot.flippedIds,
    flipDelayById: flipSnapshot.flipDelayById,
    unflippedCount,
    isInteractiveSession,
    bestPartnerUserId,
    flipOne,
    flipAll,
    isFlipInFlight,
    notifyDealSettled,
    handleOpenBox,
    handleConfirmAttendance,
    handleOpenGroupDetail,
    handleSharePosterTap,
    handleSkip,
    refetch,
    refetchAnalysis,
  }
}

import Taro from '@tarojs/taro'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  confirmPoolGroupAttendance,
  getPoolGroupAnalysis,
  getPoolGroupDetails,
  type PoolGroupDetailsResponse,
  type PoolGroupMemberSummary,
} from '@shared/api'
import type { PairExplanation } from '@shared/types/groupAnalysis'
import { apiRequest } from '../../lib/api/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useMiniRevealMotion } from '../../hooks/useMiniRevealMotion'
import { logError, logInfo } from '../../lib/utils/logger'
import { STALE_TIME_GROUP_ANALYSIS_MS, TOAST_SHORT_MS, TOAST_MEDIUM_MS, COLOR_DANGER } from '../../lib/utils/uiConstants'
import { navigateBackOrEventsTab, openPoolGroupDetail, switchToEventsTab } from '../../lib/navigation/matchingNavigation'
import {
  computeActionDockState,
  getSquadChemistryTokens,
  type ActionDockState,
  type AnalysisStage,
  type FlowState,
  type ViewerSpotlight,
} from './squadUnboxingViewModels'

function triggerLightHaptic() {
  if (typeof Taro.vibrateShort === 'function') {
    void Taro.vibrateShort({ type: 'light' }).catch(() => undefined)
  }
}

export interface UseSquadUnboxingControllerArgs {
  groupId: string
  routerParams: Record<string, string | undefined>
}

export function useSquadUnboxingController({ groupId, routerParams }: UseSquadUnboxingControllerArgs) {
  const { user: currentUser, isLoading: authLoading } = useAuthGuard()
  const { shouldReduceMotion } = useMiniRevealMotion(routerParams)

  const [flowState, setFlowState] = useState<FlowState>('ready')
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>(0)

  const {
    data: poolGroup,
    isLoading,
    error: fetchError,
  } = useQuery<PoolGroupDetailsResponse>({
    queryKey: ['mini-program', 'pool-group', groupId],
    queryFn: () => getPoolGroupDetails(apiRequest, groupId),
    enabled: !!groupId && (!!currentUser || !authLoading),
  })

  const {
    data: groupAnalysis,
    isLoading: isLoadingAnalysis,
  } = useQuery({
    queryKey: ['mini-program', 'pool-group-analysis', groupId],
    queryFn: () => getPoolGroupAnalysis(apiRequest, groupId),
    enabled: !!groupId && flowState === 'revealed',
    staleTime: STALE_TIME_GROUP_ANALYSIS_MS,
    retry: 1,
  })

  const currentUserId = currentUser?.id
  const members = poolGroup?.members ?? []
  const group = poolGroup?.group
  const pool = poolGroup?.pool

  const confirmAttendanceMutation = useMutation({
    mutationFn: () => confirmPoolGroupAttendance(apiRequest, groupId),
    onSuccess: async (response) => {
      logInfo('[SquadUnboxing] Attendance confirmed', {
        groupId,
        blindBoxEventId: response.blindBoxEventId,
      })

      await Taro.showToast({
        title: '已确认出席',
        icon: 'success',
        duration: TOAST_SHORT_MS,
      })

      if (response.blindBoxEventId) {
        Taro.redirectTo({ url: `/pages/event-detail/index?id=${response.blindBoxEventId}` })
        return
      }

      openPoolGroupDetail(groupId)
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '确认出席失败'
      logError('[SquadUnboxing] Attendance confirmation failed', {
        groupId,
        message,
      })
      Taro.showToast({ title: message, icon: 'none', duration: TOAST_MEDIUM_MS })
    },
  })

  const chemistryTokens = useMemo(
    () => getSquadChemistryTokens(groupAnalysis?.overallChemistry, group?.matchScore),
    [group?.matchScore, groupAnalysis?.overallChemistry],
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

  const pairKeyMemberMap = useMemo(() => {
    const map = new Map<string, [PoolGroupMemberSummary, PoolGroupMemberSummary]>()

    for (let index = 0; index < members.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < members.length; nextIndex += 1) {
        const pairKey = [members[index].userId, members[nextIndex].userId].sort().join('-')
        map.set(pairKey, [members[index], members[nextIndex]])
      }
    }

    return map
  }, [members])

  const strongConnectionCount = useMemo(() => {
    const highChemistryPairs = sortedPairExplanations.filter((pair) => pair.chemistryScore >= 70)
    return highChemistryPairs.length > 0 ? highChemistryPairs.length : sortedPairExplanations.length
  }, [sortedPairExplanations])

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

  const viewerSpotlight = useMemo<ViewerSpotlight | null>(() => {
    if (!currentUserId) {
      return null
    }

    for (const pair of viewerPairs) {
      const pairMembers = pairKeyMemberMap.get(pair.pairKey)
      const otherMember = pairMembers?.find((member) => member.userId !== currentUserId)

      if (otherMember) {
        return {
          pair,
          otherMember,
        }
      }
    }

    return null
  }, [currentUserId, pairKeyMemberMap, viewerPairs])

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
    () => computeActionDockState(flowState, analysisStage),
    [analysisStage, flowState],
  )

  const rootClassName = ['squad-unboxing', shouldReduceMotion ? 'squad-unboxing--reduce-motion' : '']
    .filter(Boolean)
    .join(' ')

  const handleOpenBox = useCallback(() => {
    triggerLightHaptic()
    setAnalysisStage(0)
    setFlowState('shaking')
  }, [])

  const handleConfirmAttendance = useCallback(() => {
    if (confirmAttendanceMutation.isPending) {
      return
    }

    confirmAttendanceMutation.mutate()
  }, [confirmAttendanceMutation])

  const handleOpenGroupDetail = useCallback(() => {
    openPoolGroupDetail(groupId)
  }, [groupId])

  const handleSkip = useCallback(async () => {
    if (analysisStage < 4) {
      setAnalysisStage(4)
    }

    const { confirm } = await Taro.showModal({
      title: '先离开这桌？',
      content:
        strongConnectionCount > 0
          ? `系统已经看出这桌至少有 ${strongConnectionCount} 组潜在连接点，真的要先离开吗？`
          : '你稍后仍然可以从活动页回来看这桌的揭晓内容。',
      confirmText: '先离开',
      cancelText: '再看看',
      confirmColor: COLOR_DANGER,
    })

    if (confirm) {
      switchToEventsTab()
    }
  }, [analysisStage, strongConnectionCount])

  useEffect(() => {
    if (flowState !== 'shaking') {
      return undefined
    }

    const timer = setTimeout(() => {
      triggerLightHaptic()
      setFlowState('revealed')
    }, shouldReduceMotion ? 220 : 1450)

    return () => clearTimeout(timer)
  }, [flowState, shouldReduceMotion])

  useEffect(() => {
    if (flowState !== 'revealed') {
      return undefined
    }

    const timer = setTimeout(() => {
      setAnalysisStage((stage) => (stage === 0 ? 1 : stage))
    }, shouldReduceMotion ? 120 : 900)

    return () => clearTimeout(timer)
  }, [flowState, shouldReduceMotion])

  useEffect(() => {
    if (analysisStage < 1 || analysisStage >= 4) {
      return undefined
    }

    const timer = setTimeout(() => {
      setAnalysisStage((stage) => (stage < 4 ? ((stage + 1) as AnalysisStage) : stage))
    }, shouldReduceMotion ? 420 : 1650)

    return () => clearTimeout(timer)
  }, [analysisStage, shouldReduceMotion])

  useEffect(() => {
    if (analysisStage > 0) {
      triggerLightHaptic()
    }
  }, [analysisStage])

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
    chemistryTokens,
    sortedPairExplanations,
    pairKeyMemberMap,
    viewerPairs,
    viewerPairByMemberId,
    viewerSpotlight,
    groupThemeHighlights,
    analysisThemeTags,
    flowState,
    analysisStage,
    actionDockState,
    rootClassName,
    shouldReduceMotion,
    confirmAttendanceMutation,
    handleOpenBox,
    handleConfirmAttendance,
    handleOpenGroupDetail,
    handleSkip,
    navigateBackOrEventsTab,
  }
}

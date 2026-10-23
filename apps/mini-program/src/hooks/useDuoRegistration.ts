import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Taro, { useDidShow } from '@tarojs/taro'
import {
  createDuoInvite,
  getDuoStatus,
  getDuoInviteInfo,
  type DuoStatusResponse,
  type DuoInviteInfoResponse,
} from '../lib/api/duo'
import { apiRequest } from '../lib/api/api'
import {
  buildDuoSharePath,
  readDuoShareTimestamp,
  writeDuoShareTimestamp,
} from '../lib/duo/duoContext'
import { resolveDuoCardState, resolveInitialDuoMode, shouldAutoExpandDuoRow } from '../lib/duo/duoState'
import { resolveDuoWaitingCopy, type DuoWaitingCopyResolved } from '../lib/duo/duoCopy'
import { haptics } from '../lib/utils/haptics'
import { discoverAnalytics } from '../lib/analytics/discoverAnalytics'
import { logWarn } from '../lib/utils/logger'
import { useResetOnShow } from './useResetOnShow'

const DUO_STATUS_STALE_MS = 15_000
const DUO_INVITE_STALE_MS = 5 * 60 * 1000

type ApiRequestFn = typeof apiRequest

export interface UseDuoRegistrationOptions {
  apiRequest: ApiRequestFn
  poolId: string
  /** Pool title (for the default share card when no duo code is active). */
  poolTitle?: string
  eventType: string
  invitationCode: string
  isDuoInvite: boolean
  /**
   * Audit C3 (2026-10-11): true when the user arrived via a duo/referral
   * invite into this pool (`resolvedInvitationCode` present on the page).
   * Auto-expands the duo row once — local display state only, no server write.
   */
  inviteArrival: boolean
  enabled: boolean
  /** Step 0 = brief; used to gate the card-impression event. */
  step: number
  /** STEP_BRIEF constant. */
  stepBrief: number
  authLoading: boolean
  reduceMotion: boolean
  /** Called once when the invitee-side lookup returns 404/410. */
  onInviteInvalid: () => void
  /** Called when invite creation fails; the hook has already rolled back to solo. */
  onInviteCreateError?: (error: unknown) => void
}

export interface UseDuoRegistrationResult {
  duoRegistrationEnabled: boolean
  duoMode: 'solo' | 'duo'
  duoCardState: ReturnType<typeof resolveDuoCardState>
  isCreatingDuoInvite: boolean
  duoStatus?: DuoStatusResponse | null
  isDuoStatusLoading: boolean
  duoStatusError: boolean
  duoInviteInfo?: DuoInviteInfoResponse | null
  showDuoBanner: boolean
  isDuoSheetOpen: boolean
  openDuoSheet: () => void
  closeDuoSheet: () => void
  selectDuoMode: (mode: 'solo' | 'duo') => void
  retryDuoStatus: () => void
  partnerName: string
  /**
   * S3 (PR-2): direction-aware waiting copy for the duo card, resolved from
   * the duo-status viewerRole × pendingSide matrix (lib/duo/duoCopy.ts).
   * Undefined whenever the card is not in the waiting state.
   */
  duoWaitingCopy?: DuoWaitingCopyResolved
  duoPartnerNameForAlreadyJoined?: string
  successDuo?: { bound: boolean; partnerName: string }
}

/**
 * Encapsulates all 双人成行 (duo registration) state, queries, effects, and
 * handlers for pool-registration. Keeps the page component focused on the
 * registration flow itself.
 */
export function useDuoRegistration(options: UseDuoRegistrationOptions): UseDuoRegistrationResult {
  const {
    apiRequest,
    poolId,
    poolTitle,
    eventType,
    invitationCode,
    isDuoInvite,
    inviteArrival,
    enabled,
    step,
    stepBrief,
    authLoading,
    onInviteInvalid,
    onInviteCreateError,
  } = options

  const queryClient = useQueryClient()

  // Local segmented selection; restored to 'duo' when a share timestamp exists,
  // or pre-selected when the user arrived via an invite into this pool (C3).
  const [duoMode, setDuoMode] = useState<'solo' | 'duo'>(() =>
    resolveInitialDuoMode({
      inviteArrival,
      hasShareTimestamp: Boolean(poolId) && readDuoShareTimestamp(poolId) !== null,
    }),
  )
  const [duoCode, setDuoCode] = useState('')
  const [duoShared, setDuoShared] = useState(() => poolId !== '' && readDuoShareTimestamp(poolId) !== null)
  const [isCreatingDuoInvite, setIsCreatingDuoInvite] = useState(false)
  const [duoStatusError, setDuoStatusError] = useState(false)
  const [duoInviteInvalid, setDuoInviteInvalid] = useState(false)
  const [isDuoSheetOpen, setIsDuoSheetOpen] = useState(false)

  const prevDuoServerStateRef = useRef<string | null>(null)
  const hasTrackedDuoCardImpressionRef = useRef(false)
  const hasTrackedDuoBannerImpressionRef = useRef(false)
  const duoInvalidToastShownRef = useRef(false)
  // C3 auto-expand guards: the invite-arrival pre-selection is one-shot and
  // never overrides a tap the user already made while the code was resolving.
  const duoUserInteractedRef = useRef(false)
  const duoAutoExpandAppliedRef = useRef(false)

  // C3: async invite-arrival auto-expand — covers `user.pendingReferralCode`
  // resolving after mount (the URL-param case is already handled by the
  // useState initializer above). No analytics: the whitelist is frozen and a
  // pre-selection is not a user tap (`duo_segment_select` stays tap-only).
  useEffect(() => {
    if (
      !shouldAutoExpandDuoRow({
        inviteArrival,
        currentMode: duoMode,
        hasShared: duoShared,
        hasUserInteracted: duoUserInteractedRef.current,
        alreadyApplied: duoAutoExpandAppliedRef.current,
      })
    ) {
      return
    }
    duoAutoExpandAppliedRef.current = true
    setDuoMode('duo')
  }, [inviteArrival, duoMode, duoShared])

  useResetOnShow(setIsDuoSheetOpen)

  // Duo status (non-blocking by design)
  const {
    data: duoStatus,
    isLoading: isDuoStatusLoading,
    refetch: refetchDuoStatus,
  } = useQuery<DuoStatusResponse | null>({
    queryKey: ['mini-program', 'duo-status', poolId],
    queryFn: async () => {
      try {
        const status = await getDuoStatus(apiRequest, poolId)
        setDuoStatusError(false)
        return status
      } catch (err) {
        setDuoStatusError(true)
        logWarn('[useDuoRegistration] Failed to load duo status', {
          poolId,
          message: err instanceof Error ? err.message : String(err),
        })
        return null
      }
    },
    enabled: enabled && !!poolId && !authLoading,
    staleTime: DUO_STATUS_STALE_MS,
  })

  // Invitee-side duo invite lookup
  const { data: duoInviteInfo } = useQuery<DuoInviteInfoResponse | null>({
    queryKey: ['mini-program', 'duo-invite', invitationCode],
    queryFn: async () => {
      try {
        return await getDuoInviteInfo(apiRequest, invitationCode)
      } catch (err) {
        const statusCode = (err as { statusCode?: number } | undefined)?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          setDuoInviteInvalid(true)
        } else {
          logWarn('[useDuoRegistration] Duo invite lookup failed', {
            poolId,
            message: err instanceof Error ? err.message : String(err),
          })
        }
        return null
      }
    },
    enabled: enabled && isDuoInvite && !!invitationCode && !authLoading,
    staleTime: DUO_INVITE_STALE_MS,
    retry: 0,
  })

  // Sync the segmented selection + fire duo_status_update on server transitions.
  useEffect(() => {
    const nextState = duoStatus?.state
    if (!nextState) return
    // Only `bound` is strong enough to override the local segmented selection.
    if (nextState === 'bound') {
      setDuoMode('duo')
    }
    const prevState = prevDuoServerStateRef.current
    if (prevState !== null && prevState !== nextState) {
      discoverAnalytics.track('duo_status_update', poolId, { from: prevState, to: nextState })
      if (nextState === 'bound' && prevState !== 'bound') {
        haptics('success')
      }
    }
    prevDuoServerStateRef.current = nextState
  }, [duoStatus?.state, poolId])

  // Invalid/expired duo code: notify parent once.
  useEffect(() => {
    if (!duoInviteInvalid || duoInvalidToastShownRef.current) return
    duoInvalidToastShownRef.current = true
    onInviteInvalid()
  }, [duoInviteInvalid, onInviteInvalid])

  // Duo card impression
  useEffect(() => {
    if (step !== stepBrief || authLoading || !enabled) return
    if (hasTrackedDuoCardImpressionRef.current) return
    hasTrackedDuoCardImpressionRef.current = true
    discoverAnalytics.track('duo_card_impression', poolId)
  }, [step, stepBrief, authLoading, poolId, enabled])

  // Duo banner impression
  const showDuoBanner = useMemo(
    () =>
      isDuoInvite &&
      !duoInviteInvalid &&
      !!duoInviteInfo &&
      duoInviteInfo.status === 'active' &&
      duoInviteInfo.poolId === poolId,
    [isDuoInvite, duoInviteInvalid, duoInviteInfo, poolId],
  )

  useEffect(() => {
    if (!showDuoBanner || hasTrackedDuoBannerImpressionRef.current) return
    hasTrackedDuoBannerImpressionRef.current = true
    discoverAnalytics.track('duo_banner_impression', poolId, {
      inviterName: duoInviteInfo?.inviter.displayName,
    })
  }, [showDuoBanner, poolId, duoInviteInfo?.inviter.displayName])

  // Refresh duo status whenever the page re-surfaces (friend may register elsewhere).
  useDidShow(() => {
    if (authLoading || !enabled) return
    void refetchDuoStatus()
  })

  // Share contract
  Taro.useShareAppMessage(() => {
    if (duoCode) {
      writeDuoShareTimestamp(poolId, Date.now())
      setDuoShared(true)
      discoverAnalytics.track('duo_share_trigger', poolId)
      return {
        title: `这场${eventType}，我想和你一起去`,
        path: buildDuoSharePath(poolId, duoCode),
      }
    }
    return {
      title: poolTitle ?? `这场${eventType}，一起来`,
      path: `/pages/pool-registration/index?id=${encodeURIComponent(poolId)}`,
    }
  })

  const selectDuoMode = useCallback(
    async (nextMode: 'solo' | 'duo') => {
      if (nextMode === duoMode) return
      duoUserInteractedRef.current = true
      discoverAnalytics.track('duo_segment_select', poolId, { mode: nextMode })
      if (nextMode === 'solo') {
        setDuoMode('solo')
        return
      }
      setDuoMode('duo')
      if (duoCode || isCreatingDuoInvite) return
      setIsCreatingDuoInvite(true)
      try {
        const created = await createDuoInvite(apiRequest, poolId)
        setDuoCode(created.code)
        void refetchDuoStatus()
      } catch (err) {
        setDuoMode('solo')
        const message = err instanceof Error ? err.message : String(err)
        logWarn('[useDuoRegistration] Duo invite creation failed', { poolId, message })
        onInviteCreateError?.(err)
      } finally {
        setIsCreatingDuoInvite(false)
      }
    },
    [duoMode, duoCode, isCreatingDuoInvite, poolId, apiRequest, refetchDuoStatus],
  )

  const openDuoSheet = useCallback(() => {
    setIsDuoSheetOpen(true)
    discoverAnalytics.track('duo_info_sheet_open', poolId)
  }, [poolId])

  const closeDuoSheet = useCallback(() => {
    setIsDuoSheetOpen(false)
    discoverAnalytics.track('duo_info_sheet_close', poolId)
  }, [poolId])

  const retryDuoStatus = useCallback(() => {
    setDuoStatusError(false)
    void refetchDuoStatus()
  }, [refetchDuoStatus])

  const duoCardState = useMemo(
    () =>
      resolveDuoCardState({
        isLoading: isDuoStatusLoading && !duoStatus && !duoStatusError,
        isError: duoStatusError,
        serverState: duoStatus?.state,
        mode: duoMode,
        hasShared: duoShared,
      }),
    [isDuoStatusLoading, duoStatus, duoStatusError, duoMode, duoShared],
  )

  const partnerName = useMemo(
    () => duoStatus?.friendDisplayName || duoInviteInfo?.inviter.displayName || '朋友',
    [duoStatus?.friendDisplayName, duoInviteInfo?.inviter.displayName],
  )

  // S3 (PR-2) waiting copy: the viewerRole × pendingSide matrix lives in
  // lib/duo/duoCopy.ts. The name source is duoStatus ONLY — never the invite
  // lookup's inviter name, which belongs to a different pair when the viewer
  // also holds their own code. Missing direction fields (old server) fall
  // back to D1 inside the resolver, so 「就等你」 never renders without a
  // positive signal (AC-3).
  const duoWaitingCopy = useMemo<DuoWaitingCopyResolved | undefined>(() => {
    if (duoCardState !== 'waiting') return undefined
    return resolveDuoWaitingCopy({
      viewerRole: duoStatus?.viewerRole,
      pendingSide: duoStatus?.pendingSide,
      friendDisplayName: duoStatus?.friendDisplayName,
    })
  }, [duoCardState, duoStatus?.viewerRole, duoStatus?.pendingSide, duoStatus?.friendDisplayName])

  const successDuo = useMemo(() => {
    if (duoStatus?.state === 'bound') {
      return { bound: true, partnerName }
    }
    if (duoStatus?.state === 'waiting' || (duoShared && duoCode)) {
      return { bound: false, partnerName: duoStatus?.friendDisplayName || '朋友' }
    }
    return undefined
  }, [duoStatus, duoShared, duoCode, partnerName])

  return {
    duoRegistrationEnabled: enabled,
    duoMode,
    duoCardState,
    isCreatingDuoInvite,
    duoStatus,
    isDuoStatusLoading,
    duoStatusError,
    duoInviteInfo,
    showDuoBanner,
    isDuoSheetOpen,
    openDuoSheet,
    closeDuoSheet,
    selectDuoMode,
    retryDuoStatus,
    partnerName,
    duoWaitingCopy,
    duoPartnerNameForAlreadyJoined: duoStatus?.state === 'bound' ? partnerName : undefined,
    successDuo,
  }
}

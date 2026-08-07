import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useRouter, useShareAppMessage } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getEventPool, getMyPoolRegistrations, registerForPool, getPoolPersonaSnapshot, type EventPoolSummary, type PoolRegistrationSummary, type PoolPersonaSnapshotResponse } from '@shared/api'
import type { PreJoinVibeBrief } from '@shared/ai/onboarding'
import { getErrorMessage, type ErrorCode } from '@shared/copy/errorBaselines'
import { ALL_INTENT_VALUES, INTENT_FLEXIBLE_OPTION, toggleIntentValue } from '@shared/constants'

import { useStaggerMount } from '../../hooks/useStaggerMount'
import { useResetOnShow } from '../../hooks/useResetOnShow'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { apiRequest, type ApiError } from '../../lib/api/api'
import { bustRegistrationCaches } from '../../lib/api/registrationCacheBust'
import { discoverAnalytics } from '../../lib/analytics/discoverAnalytics'
import { formatDateTime } from '../../lib/matching/groupDisplay'
import {
  buildPoolRegistrationPaymentReturnContext,
  type MiniProgramPaymentEntitlementCode,
  type MiniProgramPoolRegistrationReturnContext,
} from '../../lib/payment/paymentPendingOrder'
import {
  clearPaymentReturnContextStorage,
  persistPaymentReturnContext,
  readStoredPaymentReturnContext,
} from '../../lib/payment/paymentPendingOrderStorage'

import { haptics } from '../../lib/utils/haptics'
import { logInfo, logError, logWarn } from '../../lib/utils/logger'
import { createDuoInvite, getDuoStatus, getDuoInviteInfo, type DuoStatusResponse, type DuoInviteInfoResponse } from '../../lib/api/duo'
import {
  buildDuoSharePath,
  readDuoShareTimestamp,
  writeDuoShareTimestamp,
} from '../../lib/duo/duoContext'
import { resolveDuoCardState } from '../../lib/duo/duoState'
import { usePreloadIntentIcons } from '../../hooks/usePreloadIntentIcons'
import { useLoadingDeadline } from '../../hooks/useLoadingDeadline'
import { AUTH_QUERY_KEY } from '../../lib/api/authSession'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { TOAST_LONG_MS, TOAST_DEFAULT_MS, TOAST_FATAL_MS } from '../../lib/utils/uiConstants'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { requestPoolMatchSubscribeMessage } from '../../lib/wechat/wechatSubscribeMessage'
import LoadingScreen from '../../components/loading/LoadingScreen'
import BlindBoxFlow from '../../components/flow-animation/BlindBoxFlow'
import type { XiaoyueSpriteState } from '../../components/mascot/XiaoyueSpriteAnimator'
import { shouldShowFlow } from '../../components/flow-animation/FlowStorage'
import { formatEventDateTime } from '../../lib/utils/eventDisplay'

import {
  buildFallbackBrief,
  buildPreJoinVibeBriefPath,
  getBudgetOptions,
  getFlowStepLabels,
  getMascotStepIntro,
  getStepReactionLine,
  INTENT_FLOW_OPTIONS,
  resolvePoolEventType,
  type PoolEventType,
} from './flowConfig'
import {
  buildFormStateFromDraft,
  buildRegistrationPayload,
  findLabels,
  getPoolRegistrationAdvanceBlocker,
  getPoolRegistrationSubmitBlocker,
  hasAnyDetailSelection,
  INITIAL_FORM_STATE,
  resolveRegistrationStep,
  toggleValue,
  type RegistrationFormState,
  type RegistrationStep,
} from './poolRegistrationForm'
import PoolRegistrationDetailsFields from './components/PoolRegistrationDetailsFields'
import ChoiceCard from './components/ChoiceCard'
import PoolRegistrationErrorCard from './components/PoolRegistrationErrorCard'
import PoolRegistrationFooterBar from './components/PoolRegistrationFooterBar'
import PoolRegistrationIntentGrid from './components/PoolRegistrationIntentGrid'
import PoolRegistrationMascotSection from './components/PoolRegistrationMascotSection'
import PoolRegistrationNewRegistrantBanner from './components/PoolRegistrationNewRegistrantBanner'
import PoolRegistrationResumeCard from './components/PoolRegistrationResumeCard'
import PoolRegistrationStepper from './components/PoolRegistrationStepper'
import PoolRegistrationSummaryCard from './components/PoolRegistrationSummaryCard'
import RegistrationConfirmModal from './components/RegistrationConfirmModal'
import { getIntentFeedback } from './components/intentFeedback'
import PoolRegistrationHeroPersonaSection from './components/PoolRegistrationHeroPersonaSection'
import XiaoyueCoachCard from './components/XiaoyueCoachCard'
import XiaoyueLetterCard from './components/XiaoyueLetterCard'
import PoolRegistrationDuoCard from './components/PoolRegistrationDuoCard'
import PoolRegistrationDuoBanner from './components/PoolRegistrationDuoBanner'
import DuoInfoSheet from './components/DuoInfoSheet'
import {
  PoolRegistrationLoading,
  PoolRegistrationEmpty,
  PoolRegistrationAlreadyJoined,
  PoolRegistrationSuccess,
} from './components/PoolRegistrationTerminalStates'
import './index.scss'

const STEP_BRIEF = 0
const STEP_BUDGET = 1
const STEP_INTENT = 2
const STEP_DETAILS = 3

const TIER_COPY = {
  budgetStepHelper: '这是报名时最重要的节奏信号之一，悦仔会优先帮你避开预算预期完全不一样的组合。',
}

function resolveMessage(error: unknown, fallbackCode: ErrorCode): string {
  const apiError = error as ApiError | undefined
  if (apiError?.data && typeof apiError.data === 'object' && !Array.isArray(apiError.data)) {
    const code = (apiError.data as { code?: unknown }).code
    if (typeof code === 'string') {
      return getErrorMessage(code as ErrorCode) ?? getErrorMessage(fallbackCode)
    }
  }
  if (error instanceof Error && error.message) {
    const mapped = getErrorMessage(error.message as ErrorCode)
    if (mapped !== error.message) {
      return mapped
    }
  }
  return getErrorMessage(fallbackCode)
}

function getEntitlementCode(error: unknown): MiniProgramPaymentEntitlementCode | null {
  const data = (error as ApiError | undefined)?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null
  }

  const code = (data as { code?: unknown }).code
  if (code === 'NO_ACTIVE_ENTITLEMENT' || code === 'NO_AVAILABLE_EVENT_PACK_CREDITS') {
    return code
  }

  return null
}

export default function PoolRegistrationPage() {
  const router = useRouter()
  const poolId = router.params.id ?? ''
  const invitationCode = router.params.invitationCode ?? ''
  // duo=1 marks the share-card duo invite context (spec §C.4 routing contract)
  const isDuoInvite = router.params.duo === '1'
  const { user, isLoading: authLoading } = useAuthGuard()

  const resolvedInvitationCode = invitationCode || user?.pendingReferralCode || ''
  const hasTrackedStartRef = useRef(false)
  const registeredRef = useRef(false)
  const queryClient = useQueryClient()
  const appliedReturnContextRef = useRef(0)
  const lifecycleNavigationRef = useRef(false)

  const [step, setStep] = useState<RegistrationStep>(0)
  const [prevStep, setPrevStep] = useState<RegistrationStep>(0)
  const [formState, setFormState] = useState<RegistrationFormState>(INITIAL_FORM_STATE)
  const [isRegistering, setIsRegistering] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [showBlindBoxFlow, setShowBlindBoxFlow] = useState(false)
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [error, setError] = useState('')
  // Scroll-to-error anchor — set when error appears, cleared so it doesn't re-scroll on re-render
  const [scrollErrorId, setScrollErrorId] = useState('')
  const [resumeContext, setResumeContext] = useState<MiniProgramPoolRegistrationReturnContext | null>(null)
  // One-shot mascot reaction (nod + reaction bubble) — driven by the mascot
  // section's state machine; the page only flips this flag. Reset on
  // swipe-back so a hidden page never re-shows a stale reaction.
  const [reacting, setReacting] = useState(false)
  // Confirmation modal gate — reset on swipe-back so a hidden page never
  // re-shows a stale modal over the new top-of-stack page.
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  // Duo info sheet (双人成行玩法说明) — mutually exclusive with the confirm
  // modal (B'-5); both transient overlays reset on swipe-back.
  const [isDuoSheetOpen, setIsDuoSheetOpen] = useState(false)
  useResetOnShow(setReacting, setShowConfirmModal, setIsDuoSheetOpen)

  // ─── 双人成行 (duo registration) state ─────────────────────────────
  // Local segmented selection; restored to 'duo' when a share timestamp or a
  // server waiting/bound state exists. Bound is ALWAYS server-derived.
  const [duoMode, setDuoMode] = useState<'solo' | 'duo'>(() =>
    poolId && readDuoShareTimestamp(poolId) !== null ? 'duo' : 'solo',
  )
  const [duoCode, setDuoCode] = useState('')
  const [duoShared, setDuoShared] = useState(() => poolId !== '' && readDuoShareTimestamp(poolId) !== null)
  const [isCreatingDuoInvite, setIsCreatingDuoInvite] = useState(false)
  const [duoStatusError, setDuoStatusError] = useState(false)
  const [duoInviteInvalid, setDuoInviteInvalid] = useState(false)
  const prevDuoServerStateRef = useRef<string | null>(null)
  const hasTrackedDuoCardImpressionRef = useRef(false)
  const hasTrackedDuoBannerImpressionRef = useRef(false)
  const duoInvalidToastShownRef = useRef(false)
  const staggerMounted = useStaggerMount()

  // Gate transient reactions so they only celebrate the first selection per step visit.
  const budgetReactionShownRef = useRef(false)
  const intentReactionShownRef = useRef(false)
  const detailCelebrateShownRef = useRef(false)
  const prevCanSubmitRef = useRef(false)

  const reduceMotion = useMemo(() => {
    try {
      return !!(Taro.getSystemInfoSync() as any).reduceMotion
    } catch {
      return false
    }
  }, [])

  const {
    data: pool,
    isLoading,
    error: poolError,
    refetch: refetchPool,
  } = useQuery<EventPoolSummary>({
    queryKey: ['mini-program', 'event-pool', poolId],
    queryFn: () => getEventPool(apiRequest, poolId),
    enabled: !!poolId && !authLoading,
  })

  // Check if the user is already registered for this pool
  const {
    data: myRegistrations,
    isLoading: isLoadingMyRegistrations,
    refetch: refetchMyRegistrations,
  } = useQuery<PoolRegistrationSummary[]>({
    queryKey: ['mini-program', 'my-pool-registrations'],
    queryFn: () => getMyPoolRegistrations(apiRequest),
    enabled: !!poolId && !authLoading,
    staleTime: 30_000,
  })

  // Aggregate persona snapshot for the pool (feature-flagged, kill-switch can disable)
  const personaSnapshotEnabled = user?.features?.personaSnapshotEnabled ?? true
  const poolTeaserEnabled = user?.features?.poolTeaserEnabled === true
  const [personaSnapshotError, setPersonaSnapshotError] = useState(false)
  const {
    data: personaSnapshot,
    isLoading: isLoadingPersonaSnapshot,
    refetch: refetchPersonaSnapshot,
  } = useQuery<PoolPersonaSnapshotResponse | null>({
    queryKey: ['mini-program', 'pool-persona-snapshot', poolId],
    queryFn: async () => {
      if (!poolId || !personaSnapshotEnabled) return null
      try {
        setPersonaSnapshotError(false)
        return await getPoolPersonaSnapshot(apiRequest, poolId)
      } catch (err) {
        setPersonaSnapshotError(true)
        logError('[PoolRegistration] Failed to load persona snapshot', {
          poolId,
          message: resolveMessage(err, 'load-failed'),
        })
        discoverAnalytics.track('persona_snapshot_load_error', poolId, {
          message: resolveMessage(err, 'load-failed'),
        })
        return null
      }
    },
    enabled: !!poolId && !authLoading && personaSnapshotEnabled,
    staleTime: 30_000,
  })

  // Duo status (双人成行): non-blocking by design — a failure only downgrades
  // the card to its local error row, never the page (spec §E 不阻断原则).
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
        logWarn('[PoolRegistration] Failed to load duo status', {
          poolId,
          message: err instanceof Error ? err.message : String(err),
        })
        return null
      }
    },
    enabled: !!poolId && !authLoading,
    staleTime: 15_000,
  })

  // Invitee-side duo invite lookup (duo=1 share-card landings). 404/410 marks
  // the code invalid → one-time toast, banner hidden, code dropped from the
  // payload; transport failures stay silent (spec §C.2 坏码不阻断报名).
  const { data: duoInviteInfo } = useQuery<DuoInviteInfoResponse | null>({
    queryKey: ['mini-program', 'duo-invite', invitationCode],
    queryFn: async () => {
      try {
        return await getDuoInviteInfo(apiRequest, invitationCode)
      } catch (err) {
        const statusCode = (err as ApiError | undefined)?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          setDuoInviteInvalid(true)
        } else {
          logWarn('[PoolRegistration] Duo invite lookup failed', {
            poolId,
            message: err instanceof Error ? err.message : String(err),
          })
        }
        return null
      }
    },
    enabled: isDuoInvite && !!invitationCode && !authLoading,
    staleTime: 5 * 60 * 1000,
    retry: 0,
  })

  const showDuoBanner =
    isDuoInvite &&
    !duoInviteInvalid &&
    !!duoInviteInfo &&
    duoInviteInfo.status === 'active' &&
    duoInviteInfo.poolId === poolId

  // Track persona snapshot impression once
  const hasTrackedPersonaImpressionRef = useRef(false)
  useEffect(() => {
    if (!personaSnapshot || hasTrackedPersonaImpressionRef.current) return
    hasTrackedPersonaImpressionRef.current = true
    discoverAnalytics.track('persona_snapshot_impression', poolId, {
      stateBand: personaSnapshot.stateBand,
      totalRegistrants: personaSnapshot.totalRegistrants,
    })
    discoverAnalytics.track('persona_snapshot_state_band', poolId, {
      stateBand: personaSnapshot.stateBand,
      totalRegistrants: personaSnapshot.totalRegistrants,
      dimensionCount: personaSnapshot.dimensions.filter((d) => d.disclosed).length,
    })
  }, [personaSnapshot, poolId])

  // ─── Duo effects ───────────────────────────────────────────────────
  // Sync the segmented selection + fire duo_status_update on server state
  // transitions. Entering `bound` triggers the one-shot success haptic
  // (animation moment ②, ref-guarded) — but only on an observed transition,
  // not when the page first loads already-bound.
  useEffect(() => {
    const nextState = duoStatus?.state
    if (!nextState) return
    if (nextState === 'waiting' || nextState === 'bound') {
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

  // Invalid/expired duo code: one-time toast + drop the code from the
  // registration payload; the flow continues as a normal solo registration.
  useEffect(() => {
    if (!duoInviteInvalid || duoInvalidToastShownRef.current) return
    duoInvalidToastShownRef.current = true
    Taro.showToast({ title: '这张邀请卡过期啦，自己来也很好玩', icon: 'none', duration: TOAST_LONG_MS })
    setFormState((currentState) => ({ ...currentState, invitationCode: undefined }))
  }, [duoInviteInvalid])

  // Duo card impression: once per mount, only while Step 0 is on screen.
  useEffect(() => {
    if (step !== STEP_BRIEF || authLoading || !pool) return
    if (hasTrackedDuoCardImpressionRef.current) return
    hasTrackedDuoCardImpressionRef.current = true
    discoverAnalytics.track('duo_card_impression', poolId)
  }, [step, authLoading, pool, poolId])

  // Duo banner impression: once per mount while the banner is visible.
  useEffect(() => {
    if (!showDuoBanner || hasTrackedDuoBannerImpressionRef.current) return
    hasTrackedDuoBannerImpressionRef.current = true
    discoverAnalytics.track('duo_banner_impression', poolId, {
      inviterName: duoInviteInfo?.inviter.displayName,
    })
  }, [showDuoBanner, poolId, duoInviteInfo?.inviter.displayName])

  // Surface a "new registrant" micro-banner when count grew meaningfully since last view
  const MIN_BANNER_DELTA = 3
  const BANNER_COOLDOWN_MS = 24 * 60 * 60 * 1000
  const [showNewRegistrantBanner, setShowNewRegistrantBanner] = useState(false)
  const [newRegistrantDelta, setNewRegistrantDelta] = useState(0)
  useEffect(() => {
    if (!personaSnapshot || personaSnapshot.totalRegistrants === 0) return
    try {
      const identity = user?.id ?? 'guest'
      const storageKey = `jj_pool_persona_seen_${identity}_${poolId}`
      const raw = Taro.getStorageSync(storageKey)
      const parsed = typeof raw === 'object' && raw !== null ? raw : { count: 0 }
      const lastCount = typeof parsed.count === 'number' ? parsed.count : 0
      const lastBannerAt = typeof parsed.lastBannerAt === 'number' ? parsed.lastBannerAt : 0
      const delta = personaSnapshot.totalRegistrants - lastCount
      const now = Date.now()
      const canShowBanner = delta >= MIN_BANNER_DELTA && now - lastBannerAt > BANNER_COOLDOWN_MS
      if (canShowBanner) {
        setShowNewRegistrantBanner(true)
        setNewRegistrantDelta(delta)
        discoverAnalytics.track('persona_snapshot_new_registrant_banner_shown', poolId, {
          previousCount: lastCount,
          currentCount: personaSnapshot.totalRegistrants,
          delta,
        })
      }
      Taro.setStorageSync(storageKey, {
        count: personaSnapshot.totalRegistrants,
        lastBannerAt: canShowBanner ? now : lastBannerAt,
      })
    } catch {
      // non-blocking
    }
  }, [personaSnapshot, poolId, user?.id])

  const alreadyRegistered = useMemo(() => {
    if (!myRegistrations || !poolId) return false
    return myRegistrations.some((reg) => reg.poolId === poolId)
  }, [myRegistrations, poolId])

  // Keep the custom tab bar visible on this screen and highlight Discover.
  useCustomTabBarSync({ poolRegistrations: myRegistrations })

  const eventType = useMemo<PoolEventType>(
    () => resolvePoolEventType([pool?.eventType, pool?.title].filter(Boolean).join(' ')),
    [pool?.eventType, pool?.title],
  )

  const poolArea = useMemo(() => {
    if (typeof pool?.district === 'string' && pool.district.trim() !== '') {
      return pool.district.trim()
    }

    if (typeof pool?.city === 'string' && pool.city.trim() !== '') {
      return pool.city.trim()
    }

    return ''
  }, [pool?.city, pool?.district])

  const poolDateTimeLabel = useMemo(
    () => formatDateTime(pool?.dateTime),
    [pool?.dateTime],
  )

  const registrationTotal = useMemo(
    () => pool?.registrationCount ?? pool?.currentParticipants ?? 0,
    [pool?.registrationCount, pool?.currentParticipants],
  )

  const fallbackBrief = useMemo(
    () => buildFallbackBrief({ eventType, area: poolArea }),
    [eventType, poolArea],
  )

  // Pre-warm bundled intent icons and the error-state mascot so they render
  // instantly when needed.
  usePreloadIntentIcons(INTENT_FLOW_OPTIONS, !!pool && !authLoading)

  useEffect(() => {
    if (!pool || authLoading) return

    // Preload error-state mascot so it doesn't flash-load on error
    Taro.getImageInfo({ src: getXiaoyueExpressionAsset('actionFailure') }).catch(() => {
      // Silent — best-effort
    })
  }, [pool, authLoading])

  const { data: briefData, isLoading: briefLoading } = useQuery<PreJoinVibeBrief | null>({
    queryKey: ['mini-program', 'pre-join-vibe-brief', poolId, eventType, poolArea],
    enabled: !!poolId && !!pool && !authLoading,
    staleTime: 5 * 60 * 1000,
    retry: 0,
    queryFn: async () => {
      try {
        return await apiRequest<PreJoinVibeBrief>({
          path: buildPreJoinVibeBriefPath({ eventType, area: poolArea }),
        })
      } catch (briefError) {
        logError('[PoolRegistration] Failed to load pre-join brief', {
          poolId,
          eventType,
          area: poolArea,
          message: resolveMessage(briefError, 'load-failed'),
        })

        return null
      }
    },
  })

  // Track pool teaser impression once per page mount — only when the strip is
  // actually shown (flag on, step 0, letter past its skeleton state) and never
  // on useDidShow re-entry.
  const hasTrackedPoolTeaserImpressionRef = useRef(false)
  const hasLoggedPoolTeaserHiddenRef = useRef(false)
  useEffect(() => {
    if (authLoading) return
    // The strip only renders inside the Step 0 letter card — the Empty and
    // AlreadyJoined terminal states short-circuit it, so gate impressions on
    // the letter card actually being on screen.
    if (!pool || poolError || alreadyRegistered) return
    if (!poolTeaserEnabled) {
      if (!hasLoggedPoolTeaserHiddenRef.current) {
        hasLoggedPoolTeaserHiddenRef.current = true
        logInfo('[PoolTeaser] hidden by flag', { poolId })
      }
      return
    }
    if (step !== STEP_BRIEF) return
    if (briefLoading && !briefData) return
    if (hasTrackedPoolTeaserImpressionRef.current) return
    hasTrackedPoolTeaserImpressionRef.current = true
    discoverAnalytics.track('pool_teaser_impression', poolId, { variant: 'in-letter' })
    logInfo('[PoolTeaser] shown', { poolId })
  }, [authLoading, pool, poolError, alreadyRegistered, poolTeaserEnabled, step, briefLoading, briefData, poolId])

  useEffect(() => {
    appliedReturnContextRef.current = 0
    setStep(0)

    // Pre-populate intent from user profile if available (only when no return context)
    const userIntent = user?.intent
    const initialIntent =
      Array.isArray(userIntent) && userIntent.length > 0
        ? userIntent.filter((intent) => ALL_INTENT_VALUES.includes(intent as (typeof ALL_INTENT_VALUES)[number]))
        : []

    setFormState({
      ...INITIAL_FORM_STATE,
      eventIntent: initialIntent,
      invitationCode: resolvedInvitationCode || undefined,
    })
    setRegistered(false)
    registeredRef.current = false
    setError('')
    setIsRegistering(false)
    setResumeContext(null)
  }, [poolId, resolvedInvitationCode, user?.id, user?.intent])

  useEffect(() => {
    registeredRef.current = registered
  }, [registered])

  useEffect(() => {
    if (!poolId || authLoading || hasTrackedStartRef.current) {
      return
    }
    hasTrackedStartRef.current = true
    discoverAnalytics.track('registration_start', poolId)
  }, [poolId, authLoading])

  useEffect(() => {
    return () => {
      if (poolId && !registeredRef.current) {
        discoverAnalytics.track('registration_abandoned', poolId)
      }
    }
  }, [poolId])

  // When error appears: trigger haptics + scroll into view
  useEffect(() => {
    if (!error) {
      setScrollErrorId('')
      return
    }
    haptics('medium')
    // Defer scroll so DOM has painted the error card
    requestAnimationFrame(() => {
      setScrollErrorId('pool-reg-error-anchor')
    })
  }, [error])

  const applyStoredReturnContext = useCallback(() => {
    if (!poolId || !user?.id) {
      return
    }

    const storedReturnContext = readStoredPaymentReturnContext({
      currentUserId: user.id,
    })

    if (storedReturnContext.status === 'clear') {
      clearPaymentReturnContextStorage()
      return
    }

    if (storedReturnContext.status !== 'ready') {
      return
    }

    const nextContext = storedReturnContext.context
    if (nextContext.kind !== 'pool-registration' || nextContext.poolId !== poolId) {
      return
    }

    if (appliedReturnContextRef.current === nextContext.updatedAt) {
      return
    }

    appliedReturnContextRef.current = nextContext.updatedAt
    setFormState({
      ...buildFormStateFromDraft(nextContext.draft),
      invitationCode: resolvedInvitationCode || buildFormStateFromDraft(nextContext.draft).invitationCode,
    })
    setStep(resolveRegistrationStep(nextContext.resumeStep))
    setResumeContext(nextContext)
    setError('')
  }, [poolId, user?.id, resolvedInvitationCode])

  useEffect(() => {
    if (authLoading || !user?.id) {
      return
    }

    applyStoredReturnContext()
  }, [applyStoredReturnContext, authLoading, user?.id])

  useDidShow(() => {
    if (authLoading || !user?.id) {
      return
    }

    applyStoredReturnContext()
    // Duo state is host-agnostic (the friend may register from another
    // device), so re-pull it every time the page re-surfaces (A'-9).
    void refetchDuoStatus()
  })

  // Share contract (spec §A.5): the duo share card carries id + invitationCode
  // + duo=1. WeChat has no share-completion callback, so the share-panel
  // trigger time is persisted per pool to restore the waiting row on
  // re-entry; the bound state always comes from the server.
  useShareAppMessage(() => {
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
      title: pool?.title ?? `这场${eventType}，一起来`,
      path: `/pages/pool-registration/index?id=${encodeURIComponent(poolId)}`,
    }
  })

  const brief = briefData ?? fallbackBrief
  const budgetOptions = useMemo(() => getBudgetOptions(eventType), [eventType])
  const stepLabels = useMemo(() => getFlowStepLabels(eventType), [eventType])
  const selectedBudget =
    eventType === '酒局' ? formState.barBudgetRange?.[0] ?? '' : formState.budgetRange?.[0] ?? ''
  const hasBudgetSelection = selectedBudget !== ''
  const hasIntentSelection = formState.eventIntent.length > 0
  const canSubmit = hasBudgetSelection && hasIntentSelection

  // Mascot section drives: per-step base sprite state + reaction bubble line.
  const mascotBaseState = useMemo<XiaoyueSpriteState>(() => {
    if (step === STEP_BUDGET) return 'coach'
    if (step === STEP_INTENT) return 'curious'
    return 'listening'
  }, [step])
  const mascotReactionLine = useMemo(
    () => getStepReactionLine(step, { selectedBudget, intents: formState.eventIntent }),
    [step, selectedBudget, formState.eventIntent],
  )

  // Reset per-step reaction gates whenever the user navigates into a step.
  // Any in-flight nod reaction is also cancelled so the mascot never shows a
  // stale reaction on a newly entered step.
  useEffect(() => {
    setReacting(false)
    if (step === STEP_BUDGET) {
      budgetReactionShownRef.current = false
    }
    if (step === STEP_INTENT) {
      intentReactionShownRef.current = false
    }
    if (step === STEP_DETAILS) {
      detailCelebrateShownRef.current = false
    }
  }, [step])

  // Brief celebratory Xiaoyue reaction when the user makes their first intent selection
  useEffect(() => {
    if (!hasIntentSelection) {
      setReacting(false)
      return
    }
    if (intentReactionShownRef.current) return
    intentReactionShownRef.current = true
    setReacting(true)
    discoverAnalytics.track('registration_step_reaction_shown', poolId, {
      step: 'intent',
      count: formState.eventIntent.length,
    })
  }, [hasIntentSelection, poolId, formState.eventIntent.length])

  // Reward haptic when the form becomes submittable for the first time.
  useEffect(() => {
    if (canSubmit && !prevCanSubmitRef.current) {
      haptics('success')
    }
    prevCanSubmitRef.current = canSubmit
  }, [canSubmit])
  const advanceDisabled =
    step === STEP_BUDGET
      ? !hasBudgetSelection
      : step === STEP_INTENT
        ? !hasIntentSelection
        : step === STEP_DETAILS
          ? isRegistering || !canSubmit
          : false

  const advanceLabel = useMemo(() => {
    if (step === STEP_BUDGET) {
      return hasBudgetSelection ? '下一步：选择期待' : '先选一个预算区间'
    }
    if (step === STEP_INTENT) {
      return hasIntentSelection ? '下一步：补细节' : '先选一个期待方向'
    }
    if (step === STEP_DETAILS) {
      if (isRegistering) return '报名中…'
      if (resumeContext?.paymentStatus === 'paid') return '继续完成报名'
      return '确认加入这场局'
    }
    return '继续填写'
  }, [step, hasBudgetSelection, hasIntentSelection, isRegistering, resumeContext?.paymentStatus])

  const anyDetailSelected = useMemo(
    () => hasAnyDetailSelection(formState, eventType),
    [formState, eventType],
  )

  // Show the first Step 3 acknowledgement without changing the step-specific static pose.
  useEffect(() => {
    if (step !== STEP_DETAILS) return
    if (!anyDetailSelected) return
    if (detailCelebrateShownRef.current) return
    detailCelebrateShownRef.current = true
    setReacting(true)
    discoverAnalytics.track('registration_step_reaction_shown', poolId, { step: 'details' })
  }, [step, anyDetailSelected, poolId])

  const successHighlights = useMemo(() => {
    const items = [selectedBudget, ...findLabels(formState.eventIntent, INTENT_FLOW_OPTIONS).slice(0, 2)]
    return items.filter(Boolean)
  }, [formState.eventIntent, selectedBudget])

  const handleBudgetSelect = useCallback(
    (value: string) => {
      const isDeselect =
        eventType === '酒局' ? formState.barBudgetRange?.[0] === value : formState.budgetRange?.[0] === value
      setFormState((currentState) =>
        eventType === '酒局'
          ? {
              ...currentState,
              barBudgetRange: currentState.barBudgetRange?.[0] === value ? undefined : [value],
              budgetRange: undefined,
            }
          : {
              ...currentState,
              budgetRange: currentState.budgetRange?.[0] === value ? undefined : [value],
              barBudgetRange: undefined,
            },
      )
      // Deselecting cancels any reaction so the CTA never sits disabled under
      // an active reaction (contract AC-04).
      if (isDeselect) {
        setReacting(false)
        return
      }
      if (!budgetReactionShownRef.current) {
        budgetReactionShownRef.current = true
        setReacting(true)
        discoverAnalytics.track('registration_step_reaction_shown', poolId, {
          step: 'budget',
          value,
        })
      }
    },
    [eventType, formState.barBudgetRange, formState.budgetRange, poolId],
  )

  const handleIntentToggle = useCallback((value: string) => {
    setFormState((currentState) => {
      // No selection cap: every explicit intent is selectable; picking them
      // all auto-collapses to 随缘 (toggleIntentValue contract).
      const nextIntent = toggleIntentValue(currentState.eventIntent, value)
      if (!nextIntent) {
        return currentState
      }

      discoverAnalytics.track('registration_intent_toggled', poolId, {
        value,
        flexible: value === INTENT_FLEXIBLE_OPTION.value,
        action: currentState.eventIntent.includes(value) ? 'deselect' : 'select',
      })
      return {
        ...currentState,
        eventIntent: nextIntent,
      }
    })
  }, [poolId])

  const handleLanguageToggle = useCallback((value: string) => {
    setFormState((currentState) => ({
      ...currentState,
      preferredLanguages: toggleValue(currentState.preferredLanguages, value),
    }))
  }, [])

  const handleDietaryToggle = useCallback((value: string) => {
    setFormState((currentState) => {
      if (value === 'none') {
        return {
          ...currentState,
          dietaryRestrictions: currentState.dietaryRestrictions.includes('none') ? [] : ['none'],
        }
      }

      const nextValues = toggleValue(
        currentState.dietaryRestrictions.filter((item) => item !== 'none'),
        value,
      )

      return {
        ...currentState,
        dietaryRestrictions: nextValues,
      }
    })
  }, [])

  const handleBarThemeToggle = useCallback((value: string) => {
    setFormState((currentState) => ({
      ...currentState,
      barThemes: toggleValue(currentState.barThemes, value),
    }))
  }, [])

  const handleAlcoholComfortSelect = useCallback((value: string) => {
    setFormState((currentState) => ({
      ...currentState,
      alcoholComfort: currentState.alcoholComfort === value ? undefined : value,
    }))
  }, [])

  const handleAdvance = useCallback(() => {
    if (step === STEP_BRIEF) {
      setPrevStep(step)
      setStep(STEP_BUDGET)
      return
    }

    if (step === STEP_DETAILS) {
      return
    }

    const blocker = getPoolRegistrationAdvanceBlocker(step, {
      hasBudgetSelection,
      hasIntentSelection,
    })
    if (blocker) {
      Taro.showToast({ title: blocker, icon: 'none', duration: TOAST_LONG_MS })
      return
    }

    setPrevStep(step)
    setStep((currentStep) => ((currentStep + 1) as RegistrationStep))
  }, [hasBudgetSelection, hasIntentSelection, step])

  const handleEnableMatchNotifications = useCallback(async () => {
    if (isEnablingNotifications || notificationsEnabled) return
    setIsEnablingNotifications(true)
    try {
      await requestPoolMatchSubscribeMessage()
      setNotificationsEnabled(true)
    } finally {
      setIsEnablingNotifications(false)
    }
  }, [isEnablingNotifications, notificationsEnabled])

  const handleBack = useCallback(() => {
    if (step === STEP_BRIEF) {
      Taro.navigateBack()
      return
    }

    setPrevStep(step)
    setStep((currentStep) => (currentStep > STEP_BRIEF ? ((currentStep - 1) as RegistrationStep) : STEP_BRIEF))
  }, [step])

  const handleViewRegisteredActivity = useCallback(() => {
    if (!poolId || lifecycleNavigationRef.current) {
      return
    }
    lifecycleNavigationRef.current = true
    Taro.redirectTo({
      url: `${MINI_PROGRAM_ROUTES.eventDetail}?id=${encodeURIComponent(poolId)}`,
      fail: () => {
        lifecycleNavigationRef.current = false
        Taro.showToast({ title: '暂时无法打开活动，请稍后再试', icon: 'none' })
      },
    })
  }, [poolId])

  /**
   * Submits the pool registration with the current form state.
   * @returns Promise that resolves when registration completes or fails
   * @description Builds the registration payload, submits via registerForPool(),
   *              and handles entitlement errors by routing to payment.
   * @sideEffects Invalidates query cache, shows toast, sets registered/error state.
   */
  const handleRegister = useCallback(async () => {
    if (!poolId || isRegistering) return

    const submitBlocker = getPoolRegistrationSubmitBlocker({
      hasBudgetSelection,
      hasIntentSelection,
    })
    if (submitBlocker) {
      Taro.showToast({ title: submitBlocker, icon: 'none', duration: TOAST_LONG_MS })
      return
    }

    const payload = buildRegistrationPayload(formState, eventType)

    setIsRegistering(true)
    setError('')

    try {
      logInfo('[PoolRegistration] Registering with preferences', {
        poolId,
        eventType,
        step,
        intentCount: payload.eventIntent?.length,
        hasDietary: payload.dietaryRestrictions && payload.dietaryRestrictions.length > 0,
      })
      await registerForPool(apiRequest, poolId, payload)
      await bustRegistrationCaches(queryClient, { poolId })
      // Refresh duo state so the success page reflects a fresh binding.
      void queryClient.invalidateQueries({ queryKey: ['mini-program', 'duo-status', poolId] })
      clearPaymentReturnContextStorage()
      setResumeContext(null)
      setRegistered(true)
      discoverAnalytics.track('registration_complete', poolId)
      if (shouldShowFlow('blind-box-lifecycle', user?.id) && user?.features?.flowLifecycleEnabled !== false) {
        setShowBlindBoxFlow(true)
      } else {
        Taro.showToast({ title: '报名成功！', icon: 'success', duration: TOAST_DEFAULT_MS })
      }
    } catch (err) {
      const entitlementCode = getEntitlementCode(err)

      if (entitlementCode) {
        const nextResumeContext = buildPoolRegistrationPaymentReturnContext({
          userId: user?.id,
          poolId,
          poolTitle: pool?.title,
          poolArea,
          poolEventType: eventType,
          draft: payload,
          resumeStep: step,
          handoffCode: entitlementCode,
        })

        persistPaymentReturnContext(nextResumeContext)
        setResumeContext(nextResumeContext)

        Taro.navigateTo({
          url: `${MINI_PROGRAM_ROUTES.eventTicketPayment}?poolId=${encodeURIComponent(poolId)}`,
        })

        return
      }

      const message = resolveMessage(err, 'submit-failed')
      setError(message)
      discoverAnalytics.track('registration_submit_error', poolId, { message, step })
      logError('[PoolRegistration] Failed', {
        poolId,
        eventType,
        step,
        message,
      })
      Taro.showToast({ title: message, icon: 'none', duration: TOAST_FATAL_MS })
    } finally {
      setIsRegistering(false)
    }
  }, [
    eventType,
    formState,
    hasBudgetSelection,
    hasIntentSelection,
    isRegistering,
    pool?.title,
    poolArea,
    poolId,
    queryClient,
    step,
    user?.id,
  ])
  // Step-3 CTA opens the animated confirmation modal instead of submitting
  // directly; the modal's confirm action then runs handleRegister unchanged.
  const handleConfirmCta = useCallback(() => {
    const submitBlocker = getPoolRegistrationSubmitBlocker({
      hasBudgetSelection,
      hasIntentSelection,
    })
    if (submitBlocker) {
      Taro.showToast({ title: submitBlocker, icon: 'none', duration: TOAST_LONG_MS })
      return
    }
    discoverAnalytics.track('registration_confirm_shown', poolId)
    // Overlay mutual exclusion (B'-5): never show both overlays at once.
    setIsDuoSheetOpen(false)
    setShowConfirmModal(true)
  }, [hasBudgetSelection, hasIntentSelection, poolId])

  const handleConfirmModalConfirm = useCallback(() => {
    discoverAnalytics.track('registration_confirm_confirmed', poolId)
    setShowConfirmModal(false)
    void handleRegister()
  }, [handleRegister, poolId])

  const handleConfirmModalCancel = useCallback(() => {
    setShowConfirmModal(false)
  }, [])

  // ─── Duo handlers ──────────────────────────────────────────────────
  // Select 2人: optimistic expand + idempotent invite creation; failure rolls
  // the segmented back to 1人 with a toast (spec §A.5). Selecting 1人 back
  // pre-share is local-only — the server code is retained but harmless.
  const handleDuoSelectMode = useCallback(
    async (nextMode: 'solo' | 'duo') => {
      if (nextMode === duoMode) return
      discoverAnalytics.track('duo_segment_select', poolId, { mode: nextMode })
      if (nextMode === 'solo') {
        setDuoMode('solo')
        return
      }
      haptics('light')
      setDuoMode('duo')
      if (duoCode || isCreatingDuoInvite) return
      setIsCreatingDuoInvite(true)
      try {
        const created = await createDuoInvite(apiRequest, poolId)
        setDuoCode(created.code)
        void refetchDuoStatus()
      } catch (err) {
        setDuoMode('solo')
        const message = resolveMessage(err, 'submit-failed')
        logWarn('[PoolRegistration] Duo invite creation failed', { poolId, message })
        Taro.showToast({ title: message, icon: 'none', duration: TOAST_LONG_MS })
      } finally {
        setIsCreatingDuoInvite(false)
      }
    },
    [duoMode, duoCode, isCreatingDuoInvite, poolId, refetchDuoStatus],
  )

  const handleOpenDuoSheet = useCallback(() => {
    // Overlay mutual exclusion (B'-5): info sheets are bottom sheets, decision
    // modals are centred dialogs, at most one visible at a time.
    setShowConfirmModal(false)
    setIsDuoSheetOpen(true)
    discoverAnalytics.track('duo_info_sheet_open', poolId)
  }, [poolId])

  const handleCloseDuoSheet = useCallback(() => {
    setIsDuoSheetOpen(false)
    discoverAnalytics.track('duo_info_sheet_close', poolId)
  }, [poolId])

  const handleDuoRetry = useCallback(() => {
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

  // Success-page duo variant (spec §C.3/C'-2): bound → duo title + body;
  // inviter still waiting → extra success pill.
  const successDuo = useMemo(() => {
    if (duoStatus?.state === 'bound') {
      return {
        partnerName: duoStatus.friendDisplayName || duoInviteInfo?.inviter.displayName || '朋友',
        bound: true,
      }
    }
    if (duoStatus?.state === 'waiting' || (duoShared && duoCode)) {
      return {
        partnerName: duoStatus?.friendDisplayName || '朋友',
        bound: false,
      }
    }
    return undefined
  }, [duoStatus?.state, duoStatus?.friendDisplayName, duoInviteInfo?.inviter.displayName, duoShared, duoCode])

  const isPageLoading = authLoading || isLoading || isLoadingMyRegistrations
  const { isStale: isPageLoadingStale } = useLoadingDeadline(isPageLoading, 8000)

  if (isPageLoading) {
    if (isPageLoadingStale) {
      return (
        <PoolRegistrationLoading
          isStale
          onRetry={() => {
            void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY })
            void refetchPool()
            void refetchMyRegistrations()
          }}
          onBack={() => Taro.navigateBack()}
        />
      )
    }

    return <LoadingScreen message='正在加载报名信息…' />
  }

  if (!poolId || poolError || !pool) {
    return (
      <PoolRegistrationEmpty
        errorMessage={poolError ? resolveMessage(poolError, 'load-failed') : undefined}
        onRetry={() => refetchPool()}
        onBack={() => Taro.navigateBack()}
      />
    )
  }

  if (alreadyRegistered && !registered) {
    return (
      <PoolRegistrationAlreadyJoined
        poolId={pool.id}
        poolTitle={pool.title}
        eventType={eventType}
        poolArea={poolArea}
        poolDateTime={pool.dateTime}
        duoPartnerName={
          duoStatus?.state === 'bound'
            ? duoStatus.friendDisplayName || duoInviteInfo?.inviter.displayName
            : undefined
        }
      />
    )
  }

  if (registered && showBlindBoxFlow) {
    return (
      <BlindBoxFlow
        userId={user?.id}
        facts={{
          title: pool.title,
          dateLabel: formatEventDateTime(pool.dateTime),
          district: poolArea,
          typeLabel: eventType,
        }}
        onSkip={() => setShowBlindBoxFlow(false)}
        onViewActivity={handleViewRegisteredActivity}
      />
    )
  }

  if (registered) {
    return (
      <PoolRegistrationSuccess
        poolId={pool.id}
        eventType={eventType}
        highlights={successHighlights}
        pool={pool}
        userArchetype={user?.primaryArchetype ?? null}
        duo={successDuo}
        onEnableNotifications={handleEnableMatchNotifications}
        isEnablingNotifications={isEnablingNotifications}
        notificationsEnabled={notificationsEnabled}
      />
    )
  }

  return (
    <View className='pool-reg'>
      <ScrollView className='pool-reg__scroll' scrollY enhanced showScrollbar={false} scrollIntoView={scrollErrorId}>
      {step === 0 ? (
        <>
          <View className='pool-reg__header'>
            <Text className='pool-reg__eyebrow'>活动池报名</Text>
            <Text className='pool-reg__title pool-reg__title--headline'>{pool?.title ?? '活动报名'}</Text>
          </View>

          {personaSnapshotEnabled && showNewRegistrantBanner && !isLoadingPersonaSnapshot && personaSnapshot ? (
            <PoolRegistrationNewRegistrantBanner
              delta={newRegistrantDelta}
              onClose={() => setShowNewRegistrantBanner(false)}
            />
          ) : null}

          <PoolRegistrationHeroPersonaSection
            eventType={eventType}
            dateTimeLabel={poolDateTimeLabel}
            area={poolArea}
            price={pool?.price}
            registrationTotal={registrationTotal}
            sampleArchetypes={pool?.sampleArchetypes}
            poolId={poolId}
            snapshot={personaSnapshot}
            isLoadingPersonaSnapshot={isLoadingPersonaSnapshot}
            personaSnapshotError={personaSnapshotError}
            onRetryPersonaSnapshot={() => refetchPersonaSnapshot()}
            userArchetype={user?.primaryArchetype ?? null}
            userId={user?.id ?? null}
            visible={staggerMounted}
            personaSnapshotEnabled={personaSnapshotEnabled}
          />
          <XiaoyueLetterCard
            insight={brief.insight}
            matchingPromise={brief.matchingPromise}
            reasons={brief.reasons.slice(0, 3)}
            trustLabel='匹配后再揭晓桌友'
            userArchetype={user?.primaryArchetype ?? undefined}
            visible={staggerMounted}
            reduceMotion={reduceMotion}
            isLoading={briefLoading && !briefData}
            teaser={{ enabled: poolTeaserEnabled }}
          />
          {/* 双人成行 (spec §A/附录 H): collapsed single-row entry after the
              letter card — the letter stays the emotional hero of Step 0. */}
          <PoolRegistrationDuoCard
            state={duoCardState}
            mode={duoMode}
            isCreatingInvite={isCreatingDuoInvite}
            partnerName={duoStatus?.friendDisplayName || duoInviteInfo?.inviter.displayName}
            reduceMotion={reduceMotion}
            onSelectMode={(nextMode) => { void handleDuoSelectMode(nextMode) }}
            onOpenInfo={handleOpenDuoSheet}
            onRetry={handleDuoRetry}
          />
        </>
      ) : null}

      {/* Invitee duo context banner — persistent across steps 0–3 (spec §C.1). */}
      {showDuoBanner ? (
        <PoolRegistrationDuoBanner inviterName={duoInviteInfo?.inviter.displayName ?? '朋友'} />
      ) : null}

      {resumeContext ? (
        <PoolRegistrationResumeCard
          context={resumeContext}
          selectedBudget={selectedBudget}
          intentCount={formState.eventIntent.length}
          eventType={eventType}
        />
      ) : null}

      {step > 0 ? <PoolRegistrationStepper step={step} labels={stepLabels} /> : null}

      {step >= STEP_BUDGET && step <= STEP_DETAILS ? (
        <PoolRegistrationMascotSection
          step={step}
          spriteState={mascotBaseState}
          bubbleContent={reacting ? mascotReactionLine : getMascotStepIntro(step)}
          reacting={reacting}
          visible={staggerMounted}
          reduceMotion={reduceMotion}
          onNodComplete={() => setReacting(false)}
        />
      ) : null}

      {step === 1 ? (
        <View className={`pool-reg__step-content pool-reg__step-content--${step > prevStep ? 'forward' : 'back'}${reduceMotion ? ' pool-reg__step-content--reduce-motion' : ''}`}>
          <XiaoyueCoachCard
            step={1}
            eyebrow='Step 1 · 预算'
            title='先定一个你更舒服的预算区间'
            copy={TIER_COPY.budgetStepHelper}
            userArchetype={user?.primaryArchetype ?? undefined}
            visible={staggerMounted}
            reduceMotion={reduceMotion}
            footer={
              hasBudgetSelection ? (
                <View className='pool-reg__completion-pill'>
                  <View className='pool-reg__completion-check' aria-hidden='true' />
                  <Text className='pool-reg__completion-text'>预算已收到，可以继续了</Text>
                </View>
              ) : (
                <Text className='pool-reg__helper'>至少选择 1 个预算区间后，悦仔才能继续帮你匹配合拍的桌友。</Text>
              )
            }
          >
            <View className='pool-reg__choice-list' role='radiogroup' aria-label='预算选择'>
              {budgetOptions.map((option) => (
                <ChoiceCard
                  key={option.value}
                  option={option}
                  selected={selectedBudget === option.value}
                  onClick={() => handleBudgetSelect(option.value)}
                />
              ))}
            </View>
          </XiaoyueCoachCard>
        </View>
      ) : null}

      {step === 2 ? (
        <View className={`pool-reg__step-content pool-reg__step-content--${step > prevStep ? 'forward' : 'back'}${reduceMotion ? ' pool-reg__step-content--reduce-motion' : ''}`}>
          <XiaoyueCoachCard
            step={2}
            eyebrow='Step 2 · 期待'
            title='这次你更想收获什么'
            copy={getIntentFeedback(formState.eventIntent)}
            userArchetype={user?.primaryArchetype ?? undefined}
            visible={staggerMounted}
            reduceMotion={reduceMotion}
            footer={
              hasIntentSelection ? (
                <View className='pool-reg__completion-pill'>
                  <View className='pool-reg__completion-check' aria-hidden='true' />
                  <Text className='pool-reg__completion-text'>期待已收到，可以继续了</Text>
                </View>
              ) : (
                <Text className='pool-reg__helper'>至少选择 1 个期待方向后，悦仔才能帮你挑出同频的桌友。</Text>
              )
            }
          >
            <PoolRegistrationIntentGrid selected={formState.eventIntent} onToggle={handleIntentToggle} />
          </XiaoyueCoachCard>
        </View>
      ) : null}

      {step === 3 ? (
        <View className={`pool-reg__step-content pool-reg__step-content--${step > prevStep ? 'forward' : 'back'}${reduceMotion ? ' pool-reg__step-content--reduce-motion' : ''}`}>
          <XiaoyueCoachCard
            step={3}
            eyebrow={`Step 3 · ${stepLabels[2]}`}
            title='最后补几项细节，让匹配更顺'
            copy='语言和具体偏好都可以留空。你填得越清楚，悦仔越容易帮你把这一桌的节奏调顺。'
            userArchetype={user?.primaryArchetype ?? undefined}
            visible={staggerMounted}
            reduceMotion={reduceMotion}
            footer={
              anyDetailSelected ? (
                <View className='pool-reg__completion-pill'>
                  <View className='pool-reg__completion-check' aria-hidden='true' />
                  <Text className='pool-reg__completion-text'>细节已补充，可以提交了</Text>
                </View>
              ) : (
                <Text className='pool-reg__helper'>这些都可以留空，填了会让匹配更精准。</Text>
              )
            }
          >
            <PoolRegistrationSummaryCard formState={formState} eventType={eventType} />

            <PoolRegistrationDetailsFields
              eventType={eventType}
              formState={formState}
              onLanguageToggle={handleLanguageToggle}
              onBarThemeToggle={handleBarThemeToggle}
              onAlcoholComfortSelect={handleAlcoholComfortSelect}
              onDietaryToggle={handleDietaryToggle}
            />
          </XiaoyueCoachCard>
        </View>
      ) : null}

      {error ? (
        <PoolRegistrationErrorCard
          error={error}
          isRegistering={isRegistering}
          reduceMotion={reduceMotion}
          onRetry={handleRegister}
        />
      ) : null}
      </ScrollView>

      <PoolRegistrationFooterBar
        step={step}
        eventType={eventType}
        advanceLabel={advanceLabel}
        advanceDisabled={advanceDisabled}
        isRegistering={isRegistering}
        onAdvance={handleAdvance}
        onBack={handleBack}
        onRegister={handleConfirmCta}
      />

      <RegistrationConfirmModal
        visible={showConfirmModal}
        dateTimeLabel={poolDateTimeLabel}
        area={poolArea}
        highlights={successHighlights}
        isRegistering={isRegistering}
        reduceMotion={reduceMotion}
        onConfirm={handleConfirmModalConfirm}
        onCancel={handleConfirmModalCancel}
      />

      {isDuoSheetOpen ? (
        <DuoInfoSheet reduceMotion={reduceMotion} onClose={handleCloseDuoSheet} />
      ) : null}
    </View>
  )
}

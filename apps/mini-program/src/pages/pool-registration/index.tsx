import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getEventPool, getMyPoolRegistrations, registerForPool, getPoolPersonaSnapshot, type EventPoolSummary, type PoolRegistrationSummary, type PoolPersonaSnapshotResponse } from '@shared/api'
import type { PreJoinVibeBrief } from '@shared/ai/onboarding'
import { ALL_INTENT_VALUES, INTENT_FLEXIBLE_OPTION, toggleIntentValue } from '@shared/constants'

import { useStaggerMount } from '../../hooks/useStaggerMount'
import { useResetOnShow } from '../../hooks/useResetOnShow'
import { useMiniRevealMotion } from '../../hooks/useMiniRevealMotion'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { apiRequest } from '../../lib/api/api'
import { bustRegistrationCaches } from '../../lib/api/registrationCacheBust'
import { discoverAnalytics } from '../../lib/analytics/discoverAnalytics'
import { interactionLatency } from '../../lib/analytics/interactionLatency'
import { useOptimisticRegistration, getEntitlementCode, resolveMessage } from '../../hooks/useOptimisticRegistration'
import { formatDateTime } from '../../lib/matching/groupDisplay'
import {
  buildPoolRegistrationPaymentReturnContext,
  type MiniProgramPoolRegistrationReturnContext,
} from '../../lib/payment/paymentPendingOrder'
import {
  clearPaymentReturnContextStorage,
  persistPaymentReturnContext,
  readStoredPaymentReturnContext,
} from '../../lib/payment/paymentPendingOrderStorage'

import { haptics } from '../../lib/utils/haptics'
import { logInfo, logError, logWarn } from '../../lib/utils/logger'
import { useDuoRegistration } from '../../hooks/useDuoRegistration'
import { usePreloadIntentIcons } from '../../hooks/usePreloadIntentIcons'
import { useLoadingDeadline } from '../../hooks/useLoadingDeadline'
import { AUTH_QUERY_KEY } from '../../lib/api/authSession'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { TOAST_LONG_MS, TOAST_DEFAULT_MS, TOAST_FATAL_MS } from '../../lib/utils/uiConstants'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { requestPoolMatchSubscribeMessage } from '../../lib/wechat/wechatSubscribeMessage'
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
  LANGUAGE_OPTIONS,
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
import PoolRegistrationDetailsExpander from './components/PoolRegistrationDetailsExpander'
import ChoiceCard from './components/ChoiceCard'
import PoolRegistrationErrorCard from './components/PoolRegistrationErrorCard'
import PoolRegistrationFooterBar from './components/PoolRegistrationFooterBar'
import PoolRegistrationIntentGrid from './components/PoolRegistrationIntentGrid'
import PoolRegistrationMascotSection from './components/PoolRegistrationMascotSection'
import PoolRegistrationResumeCard from './components/PoolRegistrationResumeCard'
import PoolRegistrationStepper from './components/PoolRegistrationStepper'
import RegistrationConfirmModal from './components/RegistrationConfirmModal'
import { getIntentFeedback } from './components/intentFeedback'
import PoolRegistrationHeroPersonaSection from './components/PoolRegistrationHeroPersonaSection'
import PoolRegistrationVibePeek from './components/PoolRegistrationVibePeek'
import XiaoyueCoachCard from './components/XiaoyueCoachCard'
import XiaoyueLetterCard from './components/XiaoyueLetterCard'
import PoolRegistrationDuoCard from './components/PoolRegistrationDuoCard'
import PoolRegistrationDuoBanner from './components/PoolRegistrationDuoBanner'
import DuoInfoSheet from './components/DuoInfoSheet'
import {
  PoolRegistrationLoading,
  PoolRegistrationEmpty,
  PoolRegistrationAlreadyJoined,
} from './components/PoolRegistrationTerminalStates'
import PoolRegistrationSuccessCeremony from './components/PoolRegistrationSuccessCeremony'
import './index.scss'

const STEP_BRIEF = 0
const STEP_BUDGET = 1
const STEP_INTENT = 2

const BUDGET_STEP_COPY = {
  budgetStepHelper: '这是报名时最重要的节奏信号之一，悦仔会优先帮你避开预算预期完全不一样的组合。',
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
  // Reset transient overlays on swipe-back so a hidden page never re-shows them.
  useResetOnShow(setReacting, setShowConfirmModal)

  const staggerMounted = useStaggerMount()

  // Gate transient reactions so they only celebrate the first selection per step visit.
  const budgetReactionShownRef = useRef(false)
  const intentReactionShownRef = useRef(false)
  const prevCanSubmitRef = useRef(false)

  const { shouldReduceMotion } = useMiniRevealMotion()
  const reduceMotion = shouldReduceMotion

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
  const duoRegistrationEnabled = user?.features?.duoRegistrationEnabled ?? true
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

  const handleRetryPersonaSnapshot = useCallback(() => {
    refetchPersonaSnapshot()
  }, [refetchPersonaSnapshot])

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

  // Surface a "new registrant" meta pill when count grew meaningfully since last view
  const MIN_BANNER_DELTA = 3
  const BANNER_COOLDOWN_MS = 24 * 60 * 60 * 1000
  const [showNewRegistrantPill, setShowNewRegistrantPill] = useState(false)
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
        setShowNewRegistrantPill(true)
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

  // 双人成行 (duo registration): state/queries/handlers live in the custom hook.
  const duo = useDuoRegistration({
    apiRequest,
    poolId,
    poolTitle: pool?.title,
    eventType,
    invitationCode,
    isDuoInvite,
    enabled: duoRegistrationEnabled,
    step,
    stepBrief: STEP_BRIEF,
    authLoading,
    reduceMotion,
    onInviteInvalid: () => {
      Taro.showToast({ title: '这张邀请卡过期啦，自己来也很好玩', icon: 'none', duration: TOAST_LONG_MS })
      setFormState((currentState) => ({ ...currentState, invitationCode: undefined }))
    },
    onInviteCreateError: (error) => {
      Taro.showToast({ title: resolveMessage(error, 'submit-failed'), icon: 'none', duration: TOAST_LONG_MS })
    },
  })

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
  const scrollErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!error) {
      setScrollErrorId('')
      return
    }
    haptics('medium')
    // Defer scroll so DOM has painted the error card, then clear the anchor so
    // repeated errors can re-scroll (the id must toggle to trigger ScrollView).
    requestAnimationFrame(() => {
      setScrollErrorId('pool-reg-error-anchor')
      scrollErrorTimeoutRef.current = setTimeout(() => {
        setScrollErrorId('')
      }, 500)
    })
    return () => {
      if (scrollErrorTimeoutRef.current) {
        clearTimeout(scrollErrorTimeoutRef.current)
        scrollErrorTimeoutRef.current = null
      }
    }
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
  })

  const brief = briefData ?? fallbackBrief
  const budgetOptions = useMemo(() => getBudgetOptions(eventType), [eventType])
  const stepLabels = useMemo(() => getFlowStepLabels(), [])
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

  // Reset per-step reaction gates (and any in-flight nod) on step entry.
  useEffect(() => {
    setReacting(false)
    if (step === STEP_BUDGET) {
      budgetReactionShownRef.current = false
    }
    if (step === STEP_INTENT) {
      intentReactionShownRef.current = false
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
        ? isRegistering || !hasIntentSelection
        : false

  const advanceLabel = useMemo(() => {
    if (step === STEP_BUDGET) {
      return hasBudgetSelection ? '下一步：选择期待' : '先选一个预算区间'
    }
    if (step === STEP_INTENT) {
      // Phase 2: the intent step is the final step — its CTA opens the
      // confirmation modal instead of advancing to a details step.
      if (isRegistering) return '报名中…'
      if (resumeContext?.paymentStatus === 'paid') return '继续完成报名'
      return hasIntentSelection ? '确认加入这场局' : '先选一个期待方向'
    }
    return '继续填写'
  }, [step, hasBudgetSelection, hasIntentSelection, isRegistering, resumeContext?.paymentStatus])

  const anyDetailSelected = useMemo(
    () => hasAnyDetailSelection(formState, eventType),
    [formState, eventType],
  )

  const successHighlights = useMemo(() => {
    const items = [selectedBudget, ...findLabels(formState.eventIntent, INTENT_FLOW_OPTIONS).slice(0, 2)]
    return items.filter(Boolean)
  }, [formState.eventIntent, selectedBudget])

  // Confirm-modal summary (Phase 2): budget + intents + any details chosen in
  // the step-2 补充细节（可选） expander, so the modal reflects everything the
  // user picked before they 锁定席位. Details join into one trailing segment.
  const confirmHighlights = useMemo(() => {
    const intentLine = findLabels(formState.eventIntent, INTENT_FLOW_OPTIONS).join('、')
    const detailSegments = [
      ...findLabels(formState.preferredLanguages, LANGUAGE_OPTIONS),
      ...(eventType === '酒局' ? formState.barThemes : []),
      ...(eventType === '酒局' && formState.alcoholComfort ? [formState.alcoholComfort] : []),
    ]
    return [selectedBudget, intentLine, detailSegments.join(' · ')].filter(Boolean)
  }, [
    selectedBudget,
    formState.eventIntent,
    formState.preferredLanguages,
    formState.barThemes,
    formState.alcoholComfort,
    eventType,
  ])

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
      haptics('light')
      setPrevStep(step)
      setStep(STEP_BUDGET)
      return
    }

    // Step 2 is the final step — its CTA routes to the confirm modal, so
    // handleAdvance should never fire from it (defensive guard).
    if (step === STEP_INTENT) {
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

    haptics('light')
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

    haptics('light')
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
  // M4 (AC-4): optimistic registration machinery lives in
  // useOptimisticRegistration — wiring, celebratedRef/handledErrorRef guards,
  // entitlement handoff, and success side-effects. The page keeps the AC-2
  // gate branching below.
  const { registerOptimistically } = useOptimisticRegistration({
    poolId,
    poolTitle: pool?.title,
    poolArea,
    eventType,
    step,
    registered,
    user,
    setRegistered,
    setError,
    setResumeContext,
    setShowBlindBoxFlow,
  })
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

    const t0 = interactionLatency.startInteraction()

    // AC-2 gate: entitlement-known users (subscription / event_pack / test)
    // take the optimistic path with its own busy state; null/undefined keeps
    // the byte-identical await → entitlement-403 → payment handoff path below.
    if (user?.entitlementMode != null) {
      registerOptimistically(payload, t0)
      return
    }

    setIsRegistering(true)
    setError('')

    try {
      logInfo('[PoolRegistration] Registering with preferences', {
        poolId,
        eventType,
        step,
        intentCount: payload.eventIntent?.length,
      })
      await registerForPool(apiRequest, poolId, payload)
      await bustRegistrationCaches(queryClient, { poolId })
      // Refresh duo state so the success page reflects a fresh binding.
      void queryClient.invalidateQueries({ queryKey: ['mini-program', 'duo-status', poolId] })
      clearPaymentReturnContextStorage()
      setResumeContext(null)
      // Interaction-latency baseline: registration succeeded, UI flips to success.
      interactionLatency.trackInteraction('registration_submit', t0)
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
    registerOptimistically,
    hasBudgetSelection,
    hasIntentSelection,
    isRegistering,
    pool?.title,
    poolArea,
    poolId,
    queryClient,
    step,
    user?.entitlementMode,
    user?.id,
  ])
  // Step-2 (final step) CTA opens the animated confirmation modal instead of
  // submitting directly; the modal's confirm action then runs handleRegister
  // unchanged.
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
    duo.closeDuoSheet()
    setShowConfirmModal(true)
  }, [hasBudgetSelection, hasIntentSelection, poolId, duo])

  const handleConfirmModalConfirm = useCallback(() => {
    discoverAnalytics.track('registration_confirm_confirmed', poolId)
    setShowConfirmModal(false)
    void handleRegister()
  }, [handleRegister, poolId])

  const handleConfirmModalCancel = useCallback(() => {
    setShowConfirmModal(false)
  }, [])

  const isPageLoading = authLoading || isLoading || isLoadingMyRegistrations
  const { isStale: isPageLoadingStale } = useLoadingDeadline(isPageLoading, 8000)

  if (isPageLoading) {
    return (
      <PoolRegistrationLoading
        isStale={isPageLoadingStale}
        onRetry={() => {
          void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY })
          void refetchPool()
          void refetchMyRegistrations()
        }}
        onBack={() => Taro.navigateBack()}
      />
    )
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
        duoPartnerName={duo.duoPartnerNameForAlreadyJoined}
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
      <PoolRegistrationSuccessCeremony
        poolId={pool.id}
        eventType={eventType}
        highlights={successHighlights}
        pool={pool}
        userArchetype={user?.primaryArchetype ?? null}
        duo={duo.successDuo}
        onEnableNotifications={handleEnableMatchNotifications}
        isEnablingNotifications={isEnablingNotifications}
        notificationsEnabled={notificationsEnabled}
        reduceMotion={reduceMotion}
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

          {/* Step 0 三拍化 (registration-ceremony-spec-20260817 §1): exactly
              three beats — 封面 → 悦仔的信 → 双人单行入口. The old standalone
              new-registrant banner is demoted to one meta pill in the hero's
              meta band (same delta ≥ 3 + 24h cooldown gating). */}
          <PoolRegistrationHeroPersonaSection
            eventType={eventType}
            dateTimeLabel={poolDateTimeLabel}
            area={poolArea}
            price={pool?.price}
            registrationTotal={registrationTotal}
            newRegistrantDelta={
              personaSnapshotEnabled && showNewRegistrantPill && !isLoadingPersonaSnapshot && personaSnapshot
                ? newRegistrantDelta
                : undefined
            }
            visible={staggerMounted}
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
          {/* Persona snapshot / seat heads are data modules — demoted behind a
              collapsed expander so they never share equal billing with the
              letter (spec §1 module keep/drop test). Default collapsed keeps
              the one-mascot rule on Step 0. */}
          <PoolRegistrationVibePeek
            poolId={poolId}
            eventType={eventType}
            snapshot={personaSnapshot}
            isLoadingPersonaSnapshot={isLoadingPersonaSnapshot}
            personaSnapshotError={personaSnapshotError}
            onRetryPersonaSnapshot={handleRetryPersonaSnapshot}
            userArchetype={user?.primaryArchetype ?? null}
            userId={user?.id ?? null}
            sampleArchetypes={pool?.sampleArchetypes}
            visible={staggerMounted}
            reduceMotion={reduceMotion}
            personaSnapshotEnabled={personaSnapshotEnabled}
          />
          {/* 双人成行 (spec §A/附录 H): collapsed single-row entry after the
              letter card — the letter stays the emotional hero of Step 0. */}
          {duoRegistrationEnabled && (
            <PoolRegistrationDuoCard
              state={duo.duoCardState}
              mode={duo.duoCardState === 'error' ? 'solo' : duo.duoMode}
              isCreatingInvite={duo.isCreatingDuoInvite}
              partnerName={duo.partnerName}
              reduceMotion={reduceMotion}
              onSelectMode={(nextMode) => { void duo.selectDuoMode(nextMode) }}
              onOpenInfo={duo.openDuoSheet}
              onRetry={duo.retryDuoStatus}
            />
          )}
        </>
      ) : null}

      {/* Invitee duo context banner — persistent across steps 0–2 (spec §C.1). */}
      {duoRegistrationEnabled && duo.showDuoBanner ? (
        <PoolRegistrationDuoBanner inviterName={duo.partnerName} />
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

      {step >= STEP_BUDGET ? (
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
            copy={BUDGET_STEP_COPY.budgetStepHelper}
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
                  <Text className='pool-reg__completion-text'>期待已收到，可以确认加入了</Text>
                </View>
              ) : (
                <Text className='pool-reg__helper'>至少选择 1 个期待方向后，悦仔才能帮你挑出同频的桌友。</Text>
              )
            }
          >
            <PoolRegistrationIntentGrid selected={formState.eventIntent} onToggle={handleIntentToggle} />
            {/* Phase 2 (spec §6): the removed all-optional details step now
                lives here as a collapsed section. 酒局 bar-theme chips and
                alcohol-comfort cards stay exactly as they were — alcohol
                comfort is safety-relevant and must not move or be dropped. */}
            <PoolRegistrationDetailsExpander reduceMotion={reduceMotion} defaultOpen={anyDetailSelected}>
              <PoolRegistrationDetailsFields
                eventType={eventType}
                formState={formState}
                onLanguageToggle={handleLanguageToggle}
                onBarThemeToggle={handleBarThemeToggle}
                onAlcoholComfortSelect={handleAlcoholComfortSelect}
              />
            </PoolRegistrationDetailsExpander>
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
        highlights={confirmHighlights}
        isRegistering={isRegistering}
        reduceMotion={reduceMotion}
        onConfirm={handleConfirmModalConfirm}
        onCancel={handleConfirmModalCancel}
      />

      {duo.isDuoSheetOpen ? (
        <DuoInfoSheet reduceMotion={reduceMotion} onClose={duo.closeDuoSheet} />
      ) : null}
    </View>
  )
}

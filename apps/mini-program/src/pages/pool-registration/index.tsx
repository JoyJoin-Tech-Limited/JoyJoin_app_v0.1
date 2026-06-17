import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getEventPool, getMyPoolRegistrations, registerForPool, type EventPoolSummary, type PoolRegistrationSummary } from '@shared/api'
import type { PreJoinVibeBrief } from '@shared/ai/onboarding'
import { getErrorMessage, type ErrorCode } from '@shared/copy/errorBaselines'
import { ALL_INTENT_VALUES, INTENT_FLEXIBLE_OPTION } from '@shared/constants'

import { useStaggerMount } from '../../hooks/useStaggerMount'
import { useReactionTimer } from '../../hooks/useReactionTimer'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { apiRequest, type ApiError } from '../../lib/api/api'
import { evictPersistedQuery } from '../../lib/api/persistentCache'
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
import { POOLS_QUERY_KEY, JOINED_EVENTS_QUERY_KEY } from '../../lib/prefetchEngine'
import { haptics } from '../../lib/utils/haptics'
import { logInfo, logError } from '../../lib/utils/logger'
import { usePreloadIntentIcons } from '../../hooks/usePreloadIntentIcons'
import { useLoadingDeadline } from '../../hooks/useLoadingDeadline'
import { AUTH_QUERY_KEY } from '../../lib/api/authSession'
import { TOAST_LONG_MS, TOAST_DEFAULT_MS, TOAST_FATAL_MS } from '../../lib/utils/uiConstants'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { requestPoolMatchSubscribeMessage } from '../../lib/wechat/wechatSubscribeMessage'
import LoadingScreen from '../../components/loading/LoadingScreen'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import StatusCard from '../../components/ui/StatusCard'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import CheckBadge from '../../components/ui/CheckBadge'
import XiaoyueChatBubble from '../../components/mascot/XiaoyueChatBubble'

import {
  ALCOHOL_COMFORT_OPTIONS,
  BAR_THEME_OPTIONS,
  buildFallbackBrief,
  buildPreJoinVibeBriefPath,
  DIETARY_OPTIONS,
  getBudgetOptions,
  getFlowStepLabels,
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
  INITIAL_FORM_STATE,
  resolveRegistrationStep,
  toggleValue,
  type RegistrationFormState,
  type RegistrationStep,
} from './poolRegistrationForm'
import ChoiceCard from './components/ChoiceCard'
import ChoiceChip from './components/ChoiceChip'
import { getIntentFeedback } from './components/intentFeedback'
import PoolRegistrationHero from './components/PoolRegistrationHero'
import StepPill from './components/StepPill'
import XiaoyueCoachCard from './components/XiaoyueCoachCard'
import XiaoyueLetterCard from './components/XiaoyueLetterCard'
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

const MAX_INTENTS = 3

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

function getResumeNoticeCopy(
  context: MiniProgramPoolRegistrationReturnContext,
): { kicker: string; title: string; body: string } {
  if (context.paymentStatus === 'paid') {
    return {
      kicker: '权益已到账',
      title: '刚才那份报名偏好已经替你接回来',
      body: '预算、期待和细节都已恢复，现在点下方按钮就能继续完成这场报名。',
    }
  }

  return {
    kicker: context.handoffCode === 'NO_AVAILABLE_EVENT_PACK_CREDITS' ? '次数已用完' : '偏好已保留',
    title: '先开通权益，再回来继续报名',
    body: '你刚填写的预算和偏好不会丢，完成支付确认后会自动回到这里继续。',
  }
}

export default function PoolRegistrationPage() {
  const router = useRouter()
  const poolId = router.params.id ?? ''
  const invitationCode = router.params.invitationCode ?? ''
  const { user, isLoading: authLoading } = useAuthGuard()

  const resolvedInvitationCode = invitationCode || user?.pendingReferralCode || ''
  const hasTrackedStartRef = useRef(false)
  const registeredRef = useRef(false)
  const queryClient = useQueryClient()
  const appliedReturnContextRef = useRef(0)

  const [step, setStep] = useState<RegistrationStep>(0)
  const [prevStep, setPrevStep] = useState<RegistrationStep>(0)
  const [formState, setFormState] = useState<RegistrationFormState>(INITIAL_FORM_STATE)
  const [isRegistering, setIsRegistering] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [error, setError] = useState('')
  // Scroll-to-error anchor — set when error appears, cleared so it doesn't re-scroll on re-render
  const [scrollErrorId, setScrollErrorId] = useState('')
  const [resumeContext, setResumeContext] = useState<MiniProgramPoolRegistrationReturnContext | null>(null)
  const [showBudgetReaction, triggerBudgetReaction] = useReactionTimer()
  const [showIntentReaction, triggerIntentReaction, hideIntentReaction] = useReactionTimer()
  const staggerMounted = useStaggerMount()

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

  const alreadyRegistered = useMemo(() => {
    if (!myRegistrations || !poolId) return false
    return myRegistrations.some((reg) => reg.poolId === poolId)
  }, [myRegistrations, poolId])

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
  usePreloadIntentIcons(!!pool && !authLoading)

  useEffect(() => {
    if (!pool || authLoading) return

    // Preload error-state mascot so it doesn't flash-load on error
    Taro.getImageInfo({ src: getXiaoyueExpressionAsset('actionFailure') }).catch(() => {
      // Silent — best-effort
    })
  }, [pool, authLoading])

  const { data: briefData, isLoading: briefLoading, refetch: refetchBrief } = useQuery<PreJoinVibeBrief | null>({
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

  useEffect(() => {
    appliedReturnContextRef.current = 0
    setStep(0)

    // Pre-populate intent from user profile if available (only when no return context)
    const userIntent = user?.intent
    const initialIntent =
      Array.isArray(userIntent) && userIntent.length > 0
        ? userIntent
            .filter((intent) => ALL_INTENT_VALUES.includes(intent as (typeof ALL_INTENT_VALUES)[number]))
            .slice(0, MAX_INTENTS)
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
  }, [poolId, resolvedInvitationCode, user?.id])

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
  }, [poolId, user?.id])

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
  const stepLabels = useMemo(() => getFlowStepLabels(eventType), [eventType])
  const selectedBudget =
    eventType === '酒局' ? formState.barBudgetRange?.[0] ?? '' : formState.budgetRange?.[0] ?? ''
  const hasBudgetSelection = selectedBudget !== ''
  const hasIntentSelection = formState.eventIntent.length > 0
  const canSubmit = hasBudgetSelection && hasIntentSelection

  // Brief celebratory Xiaoyue reaction when the user makes their first intent selection
  useEffect(() => {
    if (!hasIntentSelection) {
      hideIntentReaction()
      return
    }
    triggerIntentReaction()
  }, [hasIntentSelection, hideIntentReaction, triggerIntentReaction])
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

  const summaryItems = useMemo(() => {
    const languages = findLabels(formState.preferredLanguages, LANGUAGE_OPTIONS)
    const intents = findLabels(formState.eventIntent, INTENT_FLOW_OPTIONS)
    const dietary = findLabels(formState.dietaryRestrictions, DIETARY_OPTIONS)

    return [
      { label: '预算', value: selectedBudget || '未选择' },
      { label: '这次想收获', value: intents.length > 0 ? intents.join('、') : '未选择' },
      { label: '沟通语言', value: languages.length > 0 ? languages.join('、') : '交给悦仔判断' },
      ...(dietary.length > 0 ? [{ label: '饮食要求', value: dietary.join('、') }] : []),
    ]
  }, [formState.eventIntent, formState.preferredLanguages, formState.dietaryRestrictions, selectedBudget])

  const successHighlights = useMemo(() => {
    const items = [selectedBudget, ...findLabels(formState.eventIntent, INTENT_FLOW_OPTIONS).slice(0, 2)]
    return items.filter(Boolean)
  }, [formState.eventIntent, selectedBudget])

  const handleBudgetSelect = useCallback(
    (value: string) => {
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
      triggerBudgetReaction()
    },
    [eventType, triggerBudgetReaction],
  )

  const handleIntentToggle = useCallback((value: string) => {
    haptics('light')

    if (value === INTENT_FLEXIBLE_OPTION.value) {
      setFormState((currentState) => {
        discoverAnalytics.track('registration_intent_toggled', poolId, { value, flexible: true })
        return {
          ...currentState,
          eventIntent: currentState.eventIntent.includes(value)
            ? currentState.eventIntent.filter((item) => item !== value)
            : [...currentState.eventIntent, value],
        }
      })
      return
    }

    setFormState((currentState) => {
      // Explicit intents (excluding flexible)
      const explicitIntents = currentState.eventIntent.filter(
        (item) => item !== INTENT_FLEXIBLE_OPTION.value,
      )

      // Deselecting
      if (currentState.eventIntent.includes(value)) {
        discoverAnalytics.track('registration_intent_toggled', poolId, {
          value,
          action: 'deselect',
        })
        return {
          ...currentState,
          eventIntent: currentState.eventIntent.filter((item) => item !== value),
        }
      }

      // Selecting: enforce MAX_INTENTS cap on explicit intents only
      if (explicitIntents.length >= MAX_INTENTS) {
        Taro.showToast({
          title: `最多选择 ${MAX_INTENTS} 个期待`,
          icon: 'none',
          duration: TOAST_DEFAULT_MS,
        })
        return currentState
      }

      discoverAnalytics.track('registration_intent_toggled', poolId, {
        value,
        action: 'select',
      })
      return {
        ...currentState,
        eventIntent: [...currentState.eventIntent, value],
      }
    })
  }, [poolId])

  // Memoize intent grid to prevent re-render on unrelated state changes
  const intentGrid = useMemo(() => {
    const isFlexibleActive = formState.eventIntent.includes(INTENT_FLEXIBLE_OPTION.value)
    const explicitCount = formState.eventIntent.filter(
      (item) => item !== INTENT_FLEXIBLE_OPTION.value,
    ).length
    const isCapReached = explicitCount >= MAX_INTENTS
    return (
      <View className='pool-reg__choice-grid'>
        {INTENT_FLOW_OPTIONS.map((option) => {
          const isExplicitlySelected = formState.eventIntent.includes(option.value)
          const isFlexibleOption = option.value === INTENT_FLEXIBLE_OPTION.value
          const isDimmed = isFlexibleActive && !isFlexibleOption && !isExplicitlySelected
          const isDisabled = isCapReached && !isExplicitlySelected && !isFlexibleOption

          return (
            <View
              key={option.value}
              className={[
                'pool-reg__intent-card',
                isExplicitlySelected || isDimmed ? 'pool-reg__intent-card--selected' : '',
                isDimmed ? 'pool-reg__intent-card--dimmed' : '',
                isDisabled ? 'pool-reg__intent-card--disabled' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              hoverClass={isDisabled ? '' : 'pool-reg__intent-card--hover'}
              onClick={() => !isDisabled && handleIntentToggle(option.value)}
              role='button'
              aria-pressed={isExplicitlySelected}
              aria-disabled={isDisabled}
              aria-label={`${option.label}：${option.description}${isDisabled ? '（已达上限）' : ''}`}
            >
              {option.emoji != null ? (
                <JoyJoinIcon
                  emoji={option.emoji}
                  tier='intent'
                  size={48}
                  className='pool-reg__intent-icon'
                />
              ) : null}
              <Text className='pool-reg__intent-label'>{option.label}</Text>
              <Text className='pool-reg__intent-subtitle'>{option.description}</Text>
              {isExplicitlySelected && (
                <CheckBadge className='pool-reg__intent-check' />
              )}
            </View>
          )
        })}
      </View>
    )
  }, [formState.eventIntent, handleIntentToggle])

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

  const handleEnableMatchNotifications = useCallback(() => {
    void requestPoolMatchSubscribeMessage()
  }, [])

  const handleBack = useCallback(() => {
    if (step === STEP_BRIEF) {
      Taro.navigateBack()
      return
    }

    setPrevStep(step)
    setStep((currentStep) => (currentStep > STEP_BRIEF ? ((currentStep - 1) as RegistrationStep) : STEP_BRIEF))
  }, [step])

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
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['mini-program', 'event-pool', poolId] }),
        queryClient.invalidateQueries({ queryKey: ['mini-program', 'event-pools'] }),
        queryClient.invalidateQueries({ queryKey: ['mini-program', 'my-pool-registrations'] }),
        queryClient.invalidateQueries({ queryKey: ['mini-program', 'shell/discover'] }),
      ])
      evictPersistedQuery(POOLS_QUERY_KEY)
      evictPersistedQuery(JOINED_EVENTS_QUERY_KEY)
      clearPaymentReturnContextStorage()
      setResumeContext(null)
      setRegistered(true)
      discoverAnalytics.track('registration_complete', poolId)
      Taro.showToast({ title: '报名成功！', icon: 'success', duration: TOAST_DEFAULT_MS })
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
          url: `/pages/event-ticket-payment/index?poolId=${encodeURIComponent(poolId)}`,
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
    isRegistering,
    pool?.title,
    poolArea,
    poolId,
    queryClient,
    step,
    user?.id,
  ])

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

  if (alreadyRegistered) {
    return (
      <PoolRegistrationAlreadyJoined
        eventType={eventType}
        poolDateTimeLabel={poolDateTimeLabel}
        poolArea={poolArea}
        poolDateTime={pool.dateTime}
      />
    )
  }

  if (registered) {
    return (
      <PoolRegistrationSuccess
        eventType={eventType}
        highlights={successHighlights}
        pool={pool}
        userArchetype={user?.primaryArchetype ?? null}
        onEnableNotifications={handleEnableMatchNotifications}
      />
    )
  }

  const resumeNotice = resumeContext ? getResumeNoticeCopy(resumeContext) : null

  return (
    <ScrollView className='pool-reg' scrollY enhanced showScrollbar={false} scrollIntoView={scrollErrorId}>
      {step === 0 ? (
        <>
          <View className='pool-reg__header'>
            <Text className='pool-reg__eyebrow'>活动池报名</Text>
            <Text className='pool-reg__title pool-reg__title--headline'>{pool?.title ?? '活动报名'}</Text>
          </View>

          <PoolRegistrationHero
            eventType={eventType}
            dateTimeLabel={poolDateTimeLabel}
            area={poolArea}
            price={pool?.price}
            registrationTotal={registrationTotal}
            sampleArchetypes={pool?.sampleArchetypes}
            visible={staggerMounted}
            reduceMotion={reduceMotion}
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
          />
        </>
      ) : null}

      {resumeNotice ? (
        <Card
          className={[
            'pool-reg__resume-card',
            resumeContext?.paymentStatus === 'paid' ? 'pool-reg__resume-card--paid' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <Text className='pool-reg__resume-kicker'>{resumeNotice.kicker}</Text>
          <Text className='pool-reg__resume-title'>{resumeNotice.title}</Text>
          <Text className='pool-reg__resume-copy'>{resumeNotice.body}</Text>
          <View className='pool-reg__resume-pills'>
            {selectedBudget ? <Text className='pool-reg__resume-pill'>{selectedBudget}</Text> : null}
            {formState.eventIntent.length > 0 ? (
              <Text className='pool-reg__resume-pill'>{formState.eventIntent.length} 个期待</Text>
            ) : null}
            <Text className='pool-reg__resume-pill'>{eventType}</Text>
          </View>
        </Card>
      ) : null}

      {step > 0 ? (
        <View className='pool-reg__stepper' role='list' aria-label='报名步骤'>
          {stepLabels.map((label, index) => {
            const stepIndex = index + 1
            return (
              <StepPill
                key={label}
                index={stepIndex}
                label={label}
                active={step === stepIndex}
                complete={step > stepIndex}
              />
            )
          })}
        </View>
      ) : null}

      {showBudgetReaction && step === 1 ? (
        <XiaoyueChatBubble
          content='收到！悦仔会按这个预算帮你配对'
          pose='casual'
          horizontal
          showGlow
          className='pool-reg__step-coach'
        />
      ) : null}

      {step === 1 ? (
        <View className={`pool-reg__step-content pool-reg__step-content--${step > prevStep ? 'forward' : 'back'}`}>
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

      {showIntentReaction && step === 2 ? (
        <XiaoyueChatBubble
          content='收到！悦仔会按这些期待帮你匹配'
          pose='casual'
          horizontal
          showGlow
          className='pool-reg__step-coach'
        />
      ) : null}

      {step === 2 ? (
        <View className={`pool-reg__step-content pool-reg__step-content--${step > prevStep ? 'forward' : 'back'}`}>
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
                <Text className='pool-reg__helper'>至少选择 1 个期待方向后，悦仔就能把你的社交画像和预算一起跑匹配了。</Text>
              )
            }
          >
            {intentGrid}
          </XiaoyueCoachCard>
        </View>
      ) : null}

      {step === 3 ? (
        <View className={`pool-reg__step-content pool-reg__step-content--${step > prevStep ? 'forward' : 'back'}`}>
          <XiaoyueChatBubble
            content='期待已收到，最后补几项细节让匹配更顺'
            pose='pointing'
            horizontal
            showGlow
            className='pool-reg__step-coach'
          />
          <Card className='pool-reg__summary-card'>
            <Text className='pool-reg__section-kicker'>匹配会重点参考</Text>
            <View className='pool-reg__summary-grid'>
              {summaryItems.map((item) => (
                <View key={item.label} className='pool-reg__summary-item'>
                  <Text className='pool-reg__summary-label'>{item.label}</Text>
                  <Text className='pool-reg__summary-value'>{item.value}</Text>
                </View>
              ))}
            </View>
          </Card>

          <Card className='pool-reg__panel'>
            <Text className='pool-reg__section-kicker'>Step 3</Text>
            <Text className='pool-reg__section-title'>再补几项细节，让匹配更顺</Text>
            <Text className='pool-reg__section-copy'>
              语言和具体偏好都可以留空。你填得越清楚，悦仔越容易帮你把这一桌的节奏调顺。
            </Text>

            <View className='pool-reg__field'>
              <Text className='pool-reg__field-title'>愿意用什么语言开聊</Text>
              <View className='pool-reg__chip-row'>
                {LANGUAGE_OPTIONS.map((option) => (
                  <ChoiceChip
                    key={option.value}
                    option={option}
                    selected={formState.preferredLanguages.includes(option.value)}
                    onClick={() => handleLanguageToggle(option.value)}
                  />
                ))}
              </View>
            </View>

            {eventType === '酒局' ? (
              <>
                <View className='pool-reg__field'>
                  <Text className='pool-reg__field-title'>更想去怎样的酒局</Text>
                  <View className='pool-reg__chip-row'>
                    {BAR_THEME_OPTIONS.map((option) => (
                      <ChoiceChip
                        key={option.value}
                        option={option}
                        selected={formState.barThemes.includes(option.value)}
                        onClick={() => handleBarThemeToggle(option.value)}
                      />
                    ))}
                  </View>
                </View>

                <View className='pool-reg__field'>
                  <Text className='pool-reg__field-title'>喝酒舒适度</Text>
                  <View className='pool-reg__choice-grid' role='radiogroup' aria-label='喝酒舒适度'>
                    {ALCOHOL_COMFORT_OPTIONS.map((option) => (
                      <ChoiceCard
                        key={option.value}
                        option={option}
                        selected={formState.alcoholComfort === option.value}
                        onClick={() => handleAlcoholComfortSelect(option.value)}
                        compact
                      />
                    ))}
                  </View>
                </View>
              </>
            ) : (
              <>
                <View className='pool-reg__field'>
                  <Text className='pool-reg__field-title'>需要避开什么</Text>
                  <Text className='pool-reg__field-desc'>你的饮食要求会参与匹配，选好了大家吃起来更自在</Text>
                  <View className='pool-reg__chip-row'>
                    {DIETARY_OPTIONS.map((option) => (
                      <ChoiceChip
                        key={option.value}
                        option={option}
                        selected={formState.dietaryRestrictions.includes(option.value)}
                        onClick={() => handleDietaryToggle(option.value)}
                      />
                    ))}
                  </View>
                </View>
              </>
            )}
          </Card>
        </View>
      ) : null}

      {error ? (
        <View
          className={`pool-reg__error-wrap${reduceMotion ? ' pool-reg__error-wrap--reduce-motion' : ''}`}
          role='alert'
          aria-live='polite'
          id='pool-reg-error-anchor'
        >
          <StatusCard
            tone='error'
            title='提交没成功'
            description={error}
            className='pool-reg__error-card'
            heroSrc={getXiaoyueExpressionAsset('actionFailure')}
            action={{
              label: isRegistering ? '提交中…' : '重新提交',
              onClick: handleRegister,
              variant: 'primary',
              disabled: isRegistering,
              loading: isRegistering,
            }}
            footer={
              <Text className='pool-reg__error-helper'>别担心，悦仔帮你再试一次就好～</Text>
            }
          />
        </View>
      ) : null}

      <View className='pool-reg__footer'>
        {step === 0 ? (
          <Button
            variant='brand'
            className='pool-reg__submit pool-reg__submit--ceremony'
            onClick={handleAdvance}
            hoverClass='pool-reg__submit--active'
          >
            {eventType ? `入座这场${eventType}` : '开始我的报名'}
          </Button>
        ) : (
          <View className='pool-reg__footer-actions'>
            <Button variant='secondary' className='pool-reg__footer-btn' onClick={handleBack}>
              上一步
            </Button>
            <Button
              variant='primary'
              className='pool-reg__footer-btn pool-reg__footer-btn--primary'
              onClick={step === 3 ? handleRegister : handleAdvance}
              disabled={advanceDisabled}
              loading={step === 3 && isRegistering}
            >
              {advanceLabel}
            </Button>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

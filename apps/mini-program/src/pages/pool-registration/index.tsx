import { View, Text, ScrollView, Image } from '@tarojs/components'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { cdnAsset, localAsset } from '../../lib/utils/cdnAssets'
import { preloadRouteAssets, preloadPredictiveAssets } from '../../lib/utils/routePreloadAssets'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getEventPool, registerForPool, type EventPoolSummary } from '@shared/api'
import { getErrorMessage, type ErrorCode } from '@shared/copy/errorBaselines'
import type { PreJoinVibeBrief } from '@shared/ai/onboarding'
import { apiRequest, type ApiError } from '../../lib/api/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { COLOR_PRIMARY, TOAST_LONG_MS, TOAST_DEFAULT_MS, TOAST_FATAL_MS } from '../../lib/utils/uiConstants'
import { logInfo, logError } from '../../lib/utils/logger'
import { formatDateTime } from '../../lib/matching/groupDisplay'
import { openMiniProgramPaymentPage } from '../../lib/payment/paymentEntry'
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
import LoadingScreen from '../../components/loading/LoadingScreen'
import ChemistryMiniGrid from '../../components/discover/ChemistryMiniGrid'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { requestPoolMatchSubscribeMessage } from '../../lib/wechat/wechatSubscribeMessage'
import { evictPersistedQuery } from '../../lib/api/persistentCache'
import { POOLS_QUERY_KEY, JOINED_EVENTS_QUERY_KEY } from '../../lib/prefetchEngine'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import StatusCard from '../../components/ui/StatusCard'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
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
  type FlowOption,
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
import { discoverAnalytics } from '../../lib/analytics/discoverAnalytics'
import './index.scss'

const PRIMARY_BRAND_COLOR = COLOR_PRIMARY

const STEP_BRIEF = 0
const STEP_BUDGET = 1
const STEP_INTENT = 2
const STEP_DETAILS = 3

const TIER_COPY = {
  budgetStepHelper: '这是报名时最重要的节奏信号之一，悦仔会优先帮你避开预算预期完全不一样的组合。',
}

interface ChoiceCardProps {
  option: FlowOption
  selected: boolean
  onClick: () => void
  compact?: boolean
}

function ChoiceCard({ option, selected, onClick, compact = false }: ChoiceCardProps) {
  return (
    <View
      className={[
        'pool-reg__choice-card',
        compact ? 'pool-reg__choice-card--compact' : '',
        selected ? 'pool-reg__choice-card--selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      hoverClass='pool-reg__choice-card--hover'
      onClick={onClick}
    >
      <View className='pool-reg__choice-label-row'>
        {option.emoji ? <Text className='pool-reg__choice-emoji'>{option.emoji}</Text> : null}
        <Text className='pool-reg__choice-title'>{option.label}</Text>
      </View>
      {option.description ? <Text className='pool-reg__choice-desc'>{option.description}</Text> : null}
    </View>
  )
}

interface ChoiceChipProps {
  option: FlowOption
  selected: boolean
  onClick: () => void
}

function ChoiceChip({ option, selected, onClick }: ChoiceChipProps) {
  return (
    <View
      className={['pool-reg__chip', selected ? 'pool-reg__chip--active' : '']
        .filter(Boolean)
        .join(' ')}
      hoverClass='pool-reg__chip--hover'
      onClick={onClick}
    >
      {option.emoji ? <Text className='pool-reg__chip-emoji'>{option.emoji}</Text> : null}
      <Text className='pool-reg__chip-label'>{option.label}</Text>
    </View>
  )
}

interface StepPillProps {
  index: number
  label: string
  active: boolean
  complete: boolean
}

function StepPill({ index, label, active, complete }: StepPillProps) {
  return (
    <View
      className={[
        'pool-reg__step-pill',
        active ? 'pool-reg__step-pill--active' : '',
        complete ? 'pool-reg__step-pill--complete' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Text className='pool-reg__step-index'>{index}</Text>
      <Text className='pool-reg__step-text'>{label}</Text>
    </View>
  )
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
  const { user, isLoading: authLoading } = useAuthGuard()
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
  const [resumeContext, setResumeContext] = useState<MiniProgramPoolRegistrationReturnContext | null>(null)
  const [showBudgetReaction, setShowBudgetReaction] = useState(false)

  const {
    data: pool,
    isLoading,
    error: poolError,
  } = useQuery<EventPoolSummary>({
    queryKey: ['mini-program', 'event-pool', poolId],
    queryFn: () => getEventPool(apiRequest, poolId),
    enabled: !!poolId && !authLoading,
  })

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

  const fallbackBrief = useMemo(
    () => buildFallbackBrief({ eventType, area: poolArea }),
    [eventType, poolArea],
  )

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
    setFormState(INITIAL_FORM_STATE)
    setRegistered(false)
    registeredRef.current = false
    setError('')
    setIsRegistering(false)
    setResumeContext(null)
  }, [poolId])

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
    setFormState(buildFormStateFromDraft(nextContext.draft))
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
      setShowBudgetReaction(true)
      setTimeout(() => setShowBudgetReaction(false), 2200)
    },
    [eventType],
  )

  const handleIntentToggle = useCallback((value: string) => {
    setFormState((currentState) => ({
      ...currentState,
      eventIntent: toggleValue(currentState.eventIntent, value),
    }))
  }, [])

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
        payload,
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

        const handoffCopy =
          entitlementCode === 'NO_AVAILABLE_EVENT_PACK_CREDITS'
            ? '你当前的活动次数已经用完。我们已替你保留刚刚填写的偏好，续充权益后会自动回到这里继续报名。'
            : '这场活动需要专属权益或活动次数包才能报名。我们已替你保留刚刚填写的偏好，开通后会自动回到这里继续报名。'

        const modalResult = await Taro.showModal({
          title: '先开通权益，再回来完成报名',
          content: handoffCopy,
          confirmText: '去开通',
          cancelText: '稍后',
          confirmColor: PRIMARY_BRAND_COLOR,
        })

        if (modalResult.confirm) {
          try {
            await openMiniProgramPaymentPage({
              paymentsEnabled: user?.paymentsEnabled,
              currentUserId: user?.id,
              preserveReturnContext: true,
              returnTab: 'events',
            })
          } catch (navigationError) {
            const navigationMessage = resolveMessage(
              navigationError,
              'payment-failed',
            )
            setError(navigationMessage)
            Taro.showToast({ title: navigationMessage, icon: 'none', duration: TOAST_FATAL_MS })
          }
        }

        return
      }

      const message = resolveMessage(err, 'submit-failed')
      setError(message)
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
    canSubmit,
    eventType,
    formState,
    isRegistering,
    pool?.title,
    poolArea,
    poolId,
    queryClient,
    step,
    user?.id,
    user?.paymentsEnabled,
  ])

  if (authLoading || isLoading) {
    return <LoadingScreen message='正在加载报名信息…' />
  }

  if (!poolId || poolError || !pool) {
    return (
      <View className='pool-reg'>
        <Card className='pool-reg__empty'>
          <Image
            className='pool-reg__empty-hero'
            src={cdnAsset('/assets/lovart/lovart-generic-error.webp')}
            mode='aspectFit'
            lazyLoad
          />
          <Text className='pool-reg__empty-title'>这场活动暂时打不开</Text>
          <Text className='pool-reg__empty-text'>
            {resolveMessage(poolError, 'load-failed')}
          </Text>
          <Button variant='primary' className='pool-reg__single-action' onClick={() => refetchBrief()}>
            重试
          </Button>
          <Button variant='secondary' className='pool-reg__single-action' onClick={() => Taro.navigateBack()}>
            返回上一页
          </Button>
        </Card>
      </View>
    )
  }

  if (registered) {
    return (
      <View className='pool-reg'>
        <Card className='pool-reg__success'>
          <Image
            className='pool-reg__success-mascot'
            mode='aspectFit'
            src={getXiaoyueExpressionAsset('matchSuccess')}
            ariaLabel='匹配成功'
          />
          <Text className='pool-reg__success-title'>已加入这场{eventType}</Text>
          <Text className='pool-reg__success-text'>
            我们会按照你刚刚填写的预算、社交期待和偏好完成匹配，有结果会第一时间通知你。
          </Text>
          <Text className='pool-reg__success-notify-hint'>
            {`想在${DEFAULT_MASCOT_DISPLAY_NAME}帮你匹配成功时收到微信提醒？点一下授权（可在微信授权弹窗中选择）。`}
          </Text>
          <Button
            variant='secondary'
            className='pool-reg__notify-btn'
            onClick={handleEnableMatchNotifications}
          >
            开启匹配结果通知
          </Button>
          {successHighlights.length > 0 ? (
            <View className='pool-reg__success-pills'>
              {successHighlights.map((item) => (
                <Text key={item} className='pool-reg__success-pill'>
                  {item}
                </Text>
              ))}
            </View>
          ) : null}
          <Button
            variant='primary'
            className='pool-reg__back-btn'
            onClick={() => Taro.switchTab({ url: '/pages/events/index' })}
          >
            去看我的足迹
          </Button>
          <ChemistryMiniGrid pool={pool} userArchetype={user?.primaryArchetype ?? null} />
        </Card>
      </View>
    )
  }

  const resumeNotice = resumeContext ? getResumeNoticeCopy(resumeContext) : null

  return (
    <ScrollView className='pool-reg' scrollY enhanced showScrollbar={false}>
      <View className='pool-reg__header'>
        <Text className='pool-reg__eyebrow'>活动池报名</Text>
        <Text className='pool-reg__title'>{pool?.title ?? '活动报名'}</Text>
        {pool?.description ? (
          <Text className='pool-reg__description'>{pool.description}</Text>
        ) : null}
      </View>

      <Card className='pool-reg__card'>
        <View className='pool-reg__info-row'>
          <View className='pool-reg__info-label'>
            <JoyJoinIcon emoji='🎯' size={24} />
            <Text>类型</Text>
          </View>
          <Text className='pool-reg__info-value'>{eventType}</Text>
        </View>
        {pool.dateTime ? (
          <View className='pool-reg__info-row'>
            <View className='pool-reg__info-label'>
              <JoyJoinIcon emoji='📅' size={24} />
              <Text>时间</Text>
            </View>
            <Text className='pool-reg__info-value'>{poolDateTimeLabel}</Text>
          </View>
        ) : null}
        {poolArea ? (
          <View className='pool-reg__info-row'>
            <View className='pool-reg__info-label'>
              <JoyJoinIcon emoji='📍' size={24} />
              <Text>地区</Text>
            </View>
            <Text className='pool-reg__info-value'>{poolArea}</Text>
          </View>
        ) : null}
        {pool.maxParticipants ? (
          <View className='pool-reg__info-row'>
            <View className='pool-reg__info-label'>
              <JoyJoinIcon emoji='👥' size={24} />
              <Text>已报名</Text>
            </View>
            <Text className='pool-reg__info-value'>
              {pool.currentParticipants ?? 0} / {pool.maxParticipants}
            </Text>
          </View>
        ) : null}
      </Card>

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
        <View className='pool-reg__stepper'>
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

      {step === 0 ? (
        <Card className='pool-reg__brief-card'>
          {briefLoading && !briefData ? (
            <View className='pool-reg__brief-skeleton'>
              <View className='pool-reg__brief-skeleton-line pool-reg__brief-skeleton-line--long' />
              <View className='pool-reg__brief-skeleton-line pool-reg__brief-skeleton-line--medium' />
              <View className='pool-reg__brief-skeleton-line pool-reg__brief-skeleton-line--short' />
              <View className='pool-reg__brief-skeleton-line pool-reg__brief-skeleton-line--long' />
              <View className='pool-reg__brief-skeleton-line pool-reg__brief-skeleton-line--medium' />
            </View>
          ) : (
            <>
              <Text className='pool-reg__section-kicker'>加入前的一封小信</Text>
              <Text className='pool-reg__brief-insight'>{brief.insight}</Text>
              <Text className='pool-reg__brief-promise'>{brief.matchingPromise}</Text>

              <View className='pool-reg__reason-list'>
                {brief.reasons.slice(0, 3).map((reason) => (
                  <View key={reason} className='pool-reg__reason-item'>
                    <Text className='pool-reg__reason-bullet'>✦</Text>
                    <Text className='pool-reg__reason-text'>{reason}</Text>
                  </View>
                ))}
              </View>

              <View className='pool-reg__trust-row'>
                <Text className='pool-reg__trust-pill'>匹配后再揭晓桌友</Text>
              </View>
            </>
          )}
        </Card>
      ) : null}

      {showBudgetReaction && step === 1 ? (
        <XiaoyueChatBubble
          content='收到！悦仔会按这个预算帮你配对~'
          pose='casual'
          horizontal
          showGlow
          className='pool-reg__step-coach'
        />
      ) : null}

      {step === 1 ? (
        <View className={`pool-reg__step-content pool-reg__step-content--${step > prevStep ? 'forward' : 'back'}`}>
          <Card className='pool-reg__panel'>
            <Image
              className='pool-reg__tier-mascot'
              src={cdnAsset('/assets/personality/xiaoyue/xiaoyue-coach-guide.webp')}
              mode='aspectFit'
              lazyLoad
            />
            <Text className='pool-reg__section-kicker'>Step 1</Text>
            <Text className='pool-reg__section-title'>先定一个你更舒服的预算区间</Text>
            <Text className='pool-reg__section-copy'>{TIER_COPY.budgetStepHelper}</Text>

            <View className='pool-reg__choice-list'>
              {budgetOptions.map((option) => (
                <ChoiceCard
                  key={option.value}
                  option={option}
                  selected={selectedBudget === option.value}
                  onClick={() => handleBudgetSelect(option.value)}
                />
              ))}
            </View>

            <Text className='pool-reg__helper'>至少选择 1 个预算区间后，才能继续填写偏好。</Text>
          </Card>
        </View>
      ) : null}

      {step === 2 ? (
        <View className={`pool-reg__step-content pool-reg__step-content--${step > prevStep ? 'forward' : 'back'}`}>
          <XiaoyueChatBubble
            content='预算选好了，接下来告诉悦仔你想收获什么'
            pose='pointing'
            horizontal
            showGlow
            className='pool-reg__step-coach'
          />
          <Card className='pool-reg__panel'>
            <Text className='pool-reg__section-kicker'>Step 2</Text>
            <Text className='pool-reg__section-title'>这次你更想收获什么</Text>
            <Text className='pool-reg__section-copy'>
              这里可以多选。悦仔会把你的社交期待和预算一起考虑，不会只按一个标签硬配。
            </Text>

            <View className='pool-reg__choice-grid'>
              {INTENT_FLOW_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option.value}
                  option={option}
                  selected={formState.eventIntent.includes(option.value)}
                  onClick={() => handleIntentToggle(option.value)}
                  compact
                />
              ))}
            </View>

            <Text className='pool-reg__helper'>至少选择 1 个这次想收获的方向后，才能进入最后一步。</Text>
          </Card>
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
                  <View className='pool-reg__choice-grid'>
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
        <StatusCard
          tone='error'
          title='提交没成功'
          description={error}
          className='pool-reg__error-card'
        />
      ) : null}

      <View className='pool-reg__footer'>
        {step === 0 ? (
          <Button
            variant='primary'
            className='pool-reg__submit'
            onClick={handleAdvance}
            disabled={briefLoading && !briefData}
          >
            开始填写偏好
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
              disabled={step === 3 ? isRegistering || !canSubmit : false}
              loading={step === 3 && isRegistering}
            >
              {step === 3
                ? isRegistering
                  ? '报名中…'
                  : resumeContext?.paymentStatus === 'paid'
                    ? '继续完成报名'
                    : '确认加入这场局'
                : '继续填写'}
            </Button>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getEventPool, registerForPool, type EventPoolSummary } from '@shared/api'
import type { PreJoinVibeBrief } from '@shared/ai/onboarding'
import { apiRequest, type ApiError } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { logInfo, logError } from '../../lib/logger'
import { openMiniProgramPaymentPage } from '../../lib/paymentEntry'
import {
  buildPoolRegistrationPaymentReturnContext,
  type MiniProgramPaymentEntitlementCode,
  type MiniProgramPoolRegistrationReturnContext,
} from '../../lib/paymentPendingOrder'
import {
  clearPaymentReturnContextStorage,
  persistPaymentReturnContext,
  readStoredPaymentReturnContext,
} from '../../lib/paymentPendingOrderStorage'
import LoadingScreen from '../../components/LoadingScreen'
import { requestPoolMatchSubscribeMessage } from '../../lib/wechatSubscribeMessage'
import Card from '../../components/Card'
import Button from '../../components/Button'
import {
  ALCOHOL_COMFORT_OPTIONS,
  BAR_THEME_OPTIONS,
  buildFallbackBrief,
  buildPreJoinVibeBriefPath,
  CUISINE_OPTIONS,
  DIETARY_OPTIONS,
  getBudgetOptions,
  getFlowStepLabels,
  INTENT_FLOW_OPTIONS,
  LANGUAGE_OPTIONS,
  resolvePoolEventType,
  TASTE_INTENSITY_OPTIONS,
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
import './index.scss'

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
      onClick={onClick}
    >
      <View className='pool-reg__choice-label-row'>
        <Text className='pool-reg__choice-emoji'>{option.emoji}</Text>
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
      onClick={onClick}
    >
      <Text className='pool-reg__chip-emoji'>{option.emoji}</Text>
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

function resolveMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
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
  const queryClient = useQueryClient()
  const appliedReturnContextRef = useRef(0)

  const [step, setStep] = useState<RegistrationStep>(0)
  const [formState, setFormState] = useState<RegistrationFormState>(INITIAL_FORM_STATE)
  const [isRegistering, setIsRegistering] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [error, setError] = useState('')
  const [resumeContext, setResumeContext] = useState<MiniProgramPoolRegistrationReturnContext | null>(null)

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

  const fallbackBrief = useMemo(
    () => buildFallbackBrief({ eventType, area: poolArea }),
    [eventType, poolArea],
  )

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
          message: resolveMessage(briefError, 'Failed to load brief'),
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
    setError('')
    setIsRegistering(false)
    setResumeContext(null)
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

    return [
      { label: '预算', value: selectedBudget || '未选择' },
      { label: '这次想收获', value: intents.length > 0 ? intents.join('、') : '未选择' },
      { label: '沟通语言', value: languages.length > 0 ? languages.join('、') : '交给系统判断' },
    ]
  }, [formState.eventIntent, formState.preferredLanguages, selectedBudget])

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

  const handleCuisineToggle = useCallback((value: string) => {
    setFormState((currentState) => ({
      ...currentState,
      cuisinePreferences: toggleValue(currentState.cuisinePreferences, value),
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

  const handleTasteIntensitySelect = useCallback((value: string) => {
    setFormState((currentState) => ({
      ...currentState,
      tasteIntensity: currentState.tasteIntensity === value ? undefined : value,
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
    if (step === 0) {
      setStep(1)
      return
    }

    if (step === 3) {
      return
    }

    const blocker = getPoolRegistrationAdvanceBlocker(step, {
      hasBudgetSelection,
      hasIntentSelection,
    })
    if (blocker) {
      Taro.showToast({ title: blocker, icon: 'none', duration: 2500 })
      return
    }

    setStep((currentStep) => ((currentStep + 1) as RegistrationStep))
  }, [hasBudgetSelection, hasIntentSelection, step])

  const handleEnableMatchNotifications = useCallback(() => {
    void requestPoolMatchSubscribeMessage()
  }, [])

  const handleBack = useCallback(() => {
    if (step === 0) {
      Taro.navigateBack()
      return
    }

    setStep((currentStep) => (currentStep > 0 ? ((currentStep - 1) as RegistrationStep) : 0))
  }, [step])

  const handleRegister = useCallback(async () => {
    if (!poolId || isRegistering) return

    const submitBlocker = getPoolRegistrationSubmitBlocker({
      hasBudgetSelection,
      hasIntentSelection,
    })
    if (submitBlocker) {
      Taro.showToast({ title: submitBlocker, icon: 'none', duration: 2500 })
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
      ])
      clearPaymentReturnContextStorage()
      setResumeContext(null)
      setRegistered(true)
      Taro.showToast({ title: '报名成功！', icon: 'success', duration: 2000 })
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
          confirmColor: '#8B5CF6',
        })

        if (modalResult.confirm) {
          try {
            await openMiniProgramPaymentPage({
              paymentsEnabled: user?.paymentsEnabled,
              currentUserId: user?.id,
              preserveReturnContext: true,
            })
          } catch (navigationError) {
            const navigationMessage = resolveMessage(
              navigationError,
              '打开支付页失败，请稍后重试',
            )
            setError(navigationMessage)
            Taro.showToast({ title: navigationMessage, icon: 'none', duration: 3000 })
          }
        }

        return
      }

      const message = resolveMessage(err, '报名失败，请重试')
      setError(message)
      logError('[PoolRegistration] Failed', {
        poolId,
        eventType,
        step,
        message,
      })
      Taro.showToast({ title: message, icon: 'none', duration: 3000 })
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
    return <LoadingScreen />
  }

  if (!poolId || poolError || !pool) {
    return (
      <View className='pool-reg'>
        <Card className='pool-reg__empty'>
          <Text className='pool-reg__empty-title'>这场活动暂时打不开</Text>
          <Text className='pool-reg__empty-text'>
            {resolveMessage(poolError, '活动池可能已下线，或者网络刚刚抖了一下。')}
          </Text>
          <Button variant='primary' className='pool-reg__single-action' onClick={() => Taro.navigateBack()}>
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
          <Text className='pool-reg__success-emoji'>🎉</Text>
          <Text className='pool-reg__success-title'>已加入这场{eventType}</Text>
          <Text className='pool-reg__success-text'>
            我们会按照你刚刚填写的预算、社交期待和偏好完成匹配，有结果会第一时间通知你。
          </Text>
          <Text className='pool-reg__success-notify-hint'>
            想在小悦帮你匹配成功时收到微信提醒？点一下授权（可在系统弹窗中选择）。
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
          <Text className='pool-reg__info-label'>🎯 类型</Text>
          <Text className='pool-reg__info-value'>{eventType}</Text>
        </View>
        {pool.dateTime ? (
          <View className='pool-reg__info-row'>
            <Text className='pool-reg__info-label'>📅 时间</Text>
            <Text className='pool-reg__info-value'>{pool.dateTime}</Text>
          </View>
        ) : null}
        {poolArea ? (
          <View className='pool-reg__info-row'>
            <Text className='pool-reg__info-label'>📍 地区</Text>
            <Text className='pool-reg__info-value'>{poolArea}</Text>
          </View>
        ) : null}
        {pool.maxParticipants ? (
          <View className='pool-reg__info-row'>
            <Text className='pool-reg__info-label'>👥 已报名</Text>
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
          <Text className='pool-reg__section-kicker'>加入前的一封小信</Text>
          {briefLoading ? (
            <Text className='pool-reg__brief-loading'>正在为你准备这场{eventType}的报名简报…</Text>
          ) : null}
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
            <Text className='pool-reg__trust-pill'>预算和偏好都会参与匹配</Text>
          </View>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card className='pool-reg__panel'>
          <Text className='pool-reg__section-kicker'>Step 1</Text>
          <Text className='pool-reg__section-title'>先定一个你更舒服的预算区间</Text>
          <Text className='pool-reg__section-copy'>
            {eventType === '酒局'
              ? '这是报名时最重要的节奏信号之一，系统会优先帮你避开预算预期完全不一样的组合。'
              : '这是报名时最重要的节奏信号之一，系统会优先帮你避开预算预期完全不一样的组合。'}
          </Text>

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
      ) : null}

      {step === 2 ? (
        <Card className='pool-reg__panel'>
          <Text className='pool-reg__section-kicker'>Step 2</Text>
          <Text className='pool-reg__section-title'>这次你更想收获什么</Text>
          <Text className='pool-reg__section-copy'>
            这里可以多选。系统会把你的社交期待和预算一起考虑，不会只按一个标签硬配。
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
      ) : null}

      {step === 3 ? (
        <>
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
              语言和具体偏好都可以留空。你填得越清楚，系统越容易帮你把这一桌的节奏调顺。
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
                  <Text className='pool-reg__field-title'>想吃什么</Text>
                  <View className='pool-reg__chip-row'>
                    {CUISINE_OPTIONS.map((option) => (
                      <ChoiceChip
                        key={option.value}
                        option={option}
                        selected={formState.cuisinePreferences.includes(option.value)}
                        onClick={() => handleCuisineToggle(option.value)}
                      />
                    ))}
                  </View>
                </View>

                <View className='pool-reg__field'>
                  <Text className='pool-reg__field-title'>需要避开什么</Text>
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

                <View className='pool-reg__field'>
                  <Text className='pool-reg__field-title'>口味浓淡</Text>
                  <View className='pool-reg__choice-grid'>
                    {TASTE_INTENSITY_OPTIONS.map((option) => (
                      <ChoiceCard
                        key={option.value}
                        option={option}
                        selected={formState.tasteIntensity === option.value}
                        onClick={() => handleTasteIntensitySelect(option.value)}
                        compact
                      />
                    ))}
                  </View>
                </View>
              </>
            )}
          </Card>
        </>
      ) : null}

      {error ? <Text className='pool-reg__error'>{error}</Text> : null}

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

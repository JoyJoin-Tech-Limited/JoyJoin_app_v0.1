import { View, Text, ScrollView, Image } from '@tarojs/components'
import ArchetypeHead from '../../components/mascot/ArchetypeHead'
import { useStaggerMount } from '../../hooks/useStaggerMount'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { cdnAsset, localAsset } from '../../lib/utils/cdnAssets'
import { preloadRouteAssets, preloadPredictiveAssets } from '../../lib/utils/routePreloadAssets'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getEventPool, getMyPoolRegistrations, registerForPool, type EventPoolSummary, type PoolRegistrationSummary } from '@shared/api'
import { getErrorMessage, type ErrorCode } from '@shared/copy/errorBaselines'
import { ALL_INTENT_VALUES, INTENT_FLEXIBLE_OPTION } from '@shared/constants'
import { ARCHETYPE_BY_ID } from '@shared/personality'
import { getArchetypeTokens } from '@shared/archetypeColorTokens'
import type { PreJoinVibeBrief } from '@shared/ai/onboarding'
import { apiRequest, type ApiError } from '../../lib/api/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { COLOR_PRIMARY, TOAST_LONG_MS, TOAST_DEFAULT_MS, TOAST_FATAL_MS } from '../../lib/utils/uiConstants'
import { logInfo, logError } from '../../lib/utils/logger'
import { haptics } from '../../lib/utils/haptics'
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

const MAX_INTENTS = 3

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
  const handleTap = useCallback(() => {
    try {
      Taro.vibrateShort({ type: 'light' })
    } catch {
      // decorative
    }
    onClick()
  }, [onClick])

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
      onClick={handleTap}
      role='radio'
      aria-label={`${option.label}${option.description ? '：' + option.description : ''}`}
      aria-checked={selected}
    >
      <View className='pool-reg__choice-label-row'>
        {option.emoji ? (
          <JoyJoinIcon
            emoji={option.emoji}
            tier='intent'
            size={compact ? 36 : 40}
            className='pool-reg__choice-icon'
          />
        ) : null}
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
  const handleTap = useCallback(() => {
    try {
      Taro.vibrateShort({ type: 'light' })
    } catch {
      // decorative
    }
    onClick()
  }, [onClick])

  return (
    <View
      className={['pool-reg__chip', selected ? 'pool-reg__chip--active' : '']
        .filter(Boolean)
        .join(' ')}
      hoverClass='pool-reg__chip--hover'
      onClick={handleTap}
      role='checkbox'
      aria-label={option.label}
      aria-checked={selected}
    >
      {option.emoji ? <JoyJoinIcon emoji={option.emoji} tier='intent' size={28} className='pool-reg__chip-icon' /> : null}
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

/** Meta-icon image sources — hoisted to module level to avoid recreation on every render. */
const META_ICON_SRC: Record<string, string> = {
  calendar: localAsset('/assets/icons/ui/icon-calendar.webp'),
  location: localAsset('/assets/icons/ui/icon-location.webp'),
  people: localAsset('/assets/icons/ui/icon-people.webp'),
}

/** Proprietary meta icon using bundled UI assets.
 *  Zero emoji fallback — actual crisp WebP icons shipped in the package. */
interface EventMetaIconProps {
  kind: 'type' | 'calendar' | 'location' | 'people'
}
function EventMetaIcon({ kind }: EventMetaIconProps) {
  if (kind === 'type') {
    // CSS-only target icon — clean, scalable, no emoji, zero failure surface
    return (
      <View className='pool-reg__type-icon' aria-role='img' aria-label='活动类型'>
        <View className='pool-reg__type-icon-ring pool-reg__type-icon-ring--outer' />
        <View className='pool-reg__type-icon-ring pool-reg__type-icon-ring--inner' />
        <View className='pool-reg__type-icon-dot' />
      </View>
    )
  }
  return (
    <Image
      className='pool-reg__meta-icon-img'
      src={META_ICON_SRC[kind]}
      mode='aspectFit'
      lazyLoad={false}
      aria-role='img'
      aria-label={kind === 'calendar' ? '时间' : kind === 'location' ? '地区' : '报名人数'}
      onError={() => {
        // Silently degrade to blank if bundled asset is missing —
        // the adjacent label text carries the semantic meaning.
      }}
    />
  )
}

const MAX_CLUSTER_CIRCLES = 20
const MAX_CIRCLES_PER_ARCHETYPE = 3

/** Archetype avatar cluster — overlapping pills showing crowd composition.
 *  Scales to 20+ circles by deduplicating, sorting by frequency, and
 *  rendering multiple circles for dominant archetypes. */
interface ArchetypeClusterProps {
  archetypes: string[]
  totalCount: number
}
function ArchetypeCluster({ archetypes, totalCount }: ArchetypeClusterProps) {
  const distribution = useMemo(() => {
    if (!archetypes.length) return []
    const counts = new Map<string, number>()
    for (const a of archetypes) {
      counts.set(a, (counts.get(a) ?? 0) + 1)
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])

    const result: string[] = []
    for (const [key, count] of sorted) {
      if (result.length >= MAX_CLUSTER_CIRCLES) break
      const circles = Math.min(
        MAX_CIRCLES_PER_ARCHETYPE,
        Math.max(1, Math.ceil(count / 5)),
        MAX_CLUSTER_CIRCLES - result.length,
      )
      for (let i = 0; i < circles; i++) {
        result.push(key)
      }
    }
    return result
  }, [archetypes])

  const hasOverflow = distribution.length >= MAX_CLUSTER_CIRCLES && totalCount > distribution.length

  const topNames = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of archetypes) {
      counts.set(a, (counts.get(a) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => ARCHETYPE_BY_ID[key]?.nameCn)
      .filter(Boolean)
  }, [archetypes])

  const labelText =
    topNames.length > 0
      ? `已有 ${totalCount} 位伙伴报名，包括${topNames.join('、')}${hasOverflow ? '…' : ''}`
      : `已有 ${totalCount} 位伙伴报名`

  return (
    <View className='pool-reg__archetype-cluster'>
      <View className='pool-reg__archetype-heads'>
        {distribution.map((key, index) => {
          const tokens = getArchetypeTokens(key)
          return (
            <View
              key={key + index}
              className='pool-reg__archetype-head-wrap'
              style={{
                borderColor: tokens.primary,
                backgroundColor: tokens.background,
                zIndex: distribution.length - index,
              }}
            >
              <ArchetypeHead archetype={key} size={40} />
            </View>
          )
        })}
        {hasOverflow ? (
          <View
            className='pool-reg__archetype-overflow-badge'
            aria-role='img'
            aria-label={`还有更多人报名`}
          >
            <Text className='pool-reg__archetype-overflow-text'>+</Text>
          </View>
        ) : null}
      </View>
      <Text className='pool-reg__archetype-cluster-label'>{labelText}</Text>
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
  const invitationCode = router.params.invitationCode ?? ''
  const { user, isLoading: authLoading } = useAuthGuard()

  const resolvedInvitationCode = invitationCode || (user as any)?.pendingReferralCode || ''
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
  const [showBudgetReaction, setShowBudgetReaction] = useState(false)
  const budgetReactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  } = useQuery<EventPoolSummary>({
    queryKey: ['mini-program', 'event-pool', poolId],
    queryFn: () => getEventPool(apiRequest, poolId),
    enabled: !!poolId && !authLoading,
  })

  // Check if the user is already registered for this pool
  const { data: myRegistrations } = useQuery<PoolRegistrationSummary[]>({
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

  // Preload intent icons CDN assets when pool data is ready,
  // so they're cached before the user reaches the intent step.
  useEffect(() => {
    if (!pool || authLoading) return

    const INTENT_ASSET_KEYS = [
      'intent-friends',
      'intent-networking',
      'intent-discussion',
      'intent-fun',
      'intent-romance',
      'intent-flexible',
    ]

    for (const key of INTENT_ASSET_KEYS) {
      const url = cdnAsset(`/assets/icons/intent-icons/${key}.webp`)
      Taro.getImageInfo({ src: url }).catch(() => {
        // Silent — CDN preload is best-effort
      })
    }

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

  // Cleanup budget reaction timer on unmount
  useEffect(() => {
    return () => {
      if (budgetReactionTimerRef.current) {
        clearTimeout(budgetReactionTimerRef.current)
      }
    }
  }, [])

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
      if (budgetReactionTimerRef.current) clearTimeout(budgetReactionTimerRef.current)
      budgetReactionTimerRef.current = setTimeout(() => setShowBudgetReaction(false), 2200)
    },
    [eventType],
  )

  const handleIntentToggle = useCallback((value: string) => {
    haptics('light')

    if (value === INTENT_FLEXIBLE_OPTION.value) {
      setFormState((currentState) => {
        const toggled = !currentState.eventIntent.includes(value)
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
    return (
      <View className='pool-reg__choice-grid'>
        {INTENT_FLOW_OPTIONS.map((option) => {
          const isExplicitlySelected = formState.eventIntent.includes(option.value)
          const isDimmed =
            isFlexibleActive &&
            option.value !== INTENT_FLEXIBLE_OPTION.value &&
            !isExplicitlySelected

          return (
            <View
              key={option.value}
              className={[
                'pool-reg__intent-card',
                isExplicitlySelected || isDimmed ? 'pool-reg__intent-card--selected' : '',
                isDimmed ? 'pool-reg__intent-card--dimmed' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              hoverClass='pool-reg__intent-card--hover'
              onClick={() => handleIntentToggle(option.value)}
              role='button'
              aria-pressed={isExplicitlySelected}
              aria-label={`${option.label}：${option.description}`}
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
                <View className='pool-reg__intent-check'>
                  <Text className='pool-reg__intent-check-icon'>&#x2713;</Text>
                </View>
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
            {poolError
              ? resolveMessage(poolError, 'load-failed')
              : '悦仔正在努力同步这场活动的最新信息，稍后再试就好。'}
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

  if (alreadyRegistered) {
    return (
      <View className='pool-reg'>
        <Card className='pool-reg__already-joined'>
          <Image
            className='pool-reg__already-mascot'
            mode='aspectFit'
            src={getXiaoyueExpressionAsset('homeWelcome')}
            ariaLabel='已报名'
          />
          <Text className='pool-reg__already-title'>你已经加入这场{eventType}了</Text>
          <Text className='pool-reg__already-text'>
            你的预算和社交期待已经在匹配引擎里跑着了，有结果会第一时间通知你。
          </Text>
          <View className='pool-reg__already-meta'>
            <View className='pool-reg__already-meta-row'>
              <EventMetaIcon kind='type' />
              <Text>{eventType}</Text>
            </View>
            {pool.dateTime ? (
              <View className='pool-reg__already-meta-row'>
                <EventMetaIcon kind='calendar' />
                <Text>{poolDateTimeLabel}</Text>
              </View>
            ) : null}
            {poolArea ? (
              <View className='pool-reg__already-meta-row'>
                <EventMetaIcon kind='location' />
                <Text>{poolArea}</Text>
              </View>
            ) : null}
          </View>
          <Button
            variant='primary'
            className='pool-reg__already-cta'
            onClick={() => Taro.switchTab({ url: '/pages/events/index' })}
          >
            去我的足迹查看状态
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
    <ScrollView className='pool-reg' scrollY enhanced showScrollbar={false} scrollIntoView={scrollErrorId}>
      <View className='pool-reg__header'>
        <Text className='pool-reg__eyebrow'>活动池报名</Text>
        <Text className='pool-reg__title pool-reg__title--headline'>{pool?.title ?? '活动报名'}</Text>
        {pool?.description ? (
          <Text className='pool-reg__description'>{pool.description}</Text>
        ) : null}
        {typeof pool?.price === 'number' && pool.price > 0 ? (
          <View className='pool-reg__price-pill'>
            <Text className='pool-reg__price-label'>报名费</Text>
            <Text className='pool-reg__price-value'>¥{pool.price}</Text>
          </View>
        ) : null}
      </View>

      <Card className='pool-reg__card'>
        <View
          className={[
            'pool-reg__info-row',
            staggerMounted ? 'stagger-in stagger-in--0' : 'stagger-in-hidden',
          ].join(' ')}
        >
          <View className='pool-reg__info-label'>
            <EventMetaIcon kind='type' />
            <Text>类型</Text>
          </View>
          <Text className='pool-reg__info-value'>{eventType}</Text>
        </View>
        {pool.dateTime ? (
          <View
            className={[
              'pool-reg__info-row',
              staggerMounted ? 'stagger-in stagger-in--1' : 'stagger-in-hidden',
            ].join(' ')}
          >
            <View className='pool-reg__info-label'>
              <EventMetaIcon kind='calendar' />
              <Text>时间</Text>
            </View>
            <Text className='pool-reg__info-value'>{poolDateTimeLabel}</Text>
          </View>
        ) : null}
        {poolArea ? (
          <View
            className={[
              'pool-reg__info-row',
              staggerMounted ? 'stagger-in stagger-in--2' : 'stagger-in-hidden',
            ].join(' ')}
          >
            <View className='pool-reg__info-label'>
              <EventMetaIcon kind='location' />
              <Text>地区</Text>
            </View>
            <Text className='pool-reg__info-value'>{poolArea}</Text>
          </View>
        ) : null}
        <View
          className={[
            'pool-reg__info-row',
            staggerMounted ? 'stagger-in stagger-in--3' : 'stagger-in-hidden',
          ].join(' ')}
        >
          <View className='pool-reg__info-label'>
            <EventMetaIcon kind='people' />
            <Text>已报名</Text>
          </View>
          <Text
            className={[
              'pool-reg__info-value',
              registrationTotal > 0 ? 'pool-reg__info-value--highlight' : '',
            ].join(' ')}
          >
            {registrationTotal > 0 ? `${registrationTotal} 人` : '等你加入'}
          </Text>
        </View>
      </Card>

      {pool?.sampleArchetypes && pool.sampleArchetypes.length > 0 ? (
        <View
          className={[
            'pool-reg__cluster-wrap',
            staggerMounted ? 'stagger-in stagger-in--4' : 'stagger-in-hidden',
          ].join(' ')}
        >
          <ArchetypeCluster archetypes={pool.sampleArchetypes} totalCount={registrationTotal} />
        </View>
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
              <Image
                className='pool-reg__brief-mascot'
                src={getXiaoyueExpressionAsset('coachGuide')}
                mode='aspectFit'
              />
              <Text className='pool-reg__section-kicker'>加入前的一封小信</Text>
              <Text className='pool-reg__brief-insight'>{brief.insight}</Text>
              <Text className='pool-reg__brief-promise'>{brief.matchingPromise}</Text>

              <View className='pool-reg__reason-list'>
                {brief.reasons.slice(0, 3).map((reason) => (
                  <View key={reason} className='pool-reg__reason-item'>
                    <View className='pool-reg__reason-bullet' />
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

            <Text className='pool-reg__helper'>至少选择 1 个预算区间后，悦仔才能继续帮你匹配合拍的桌友。</Text>
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

            {intentGrid}

            <Text className='pool-reg__helper'>至少选择 1 个期待方向后，悦仔就能把你的社交画像和预算一起跑匹配了。</Text>
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

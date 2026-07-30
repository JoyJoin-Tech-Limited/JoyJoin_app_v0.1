import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import { useAuth } from '../../../hooks/useAuth'
import { shouldShowAlangEntry } from '../../../lib/alang/alangAccess'
import {
  getFlashApiErrorCode,
  getFlashLocationPermission,
  getOneShotFlashLocation,
} from '../../../lib/alang/flashApi'
import { redirectToFlashCanonical } from '../../../lib/alang/flashNavigation'
import { useFlashHome } from '../../../lib/alang/useFlash'
import type { FlashLocationSnapshot, FlashNpcSummary, FlashTaskSummary } from '../../../lib/alang/flashTypes'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { haptics } from '../../../lib/utils/haptics'
import { FLASH_STREET_BOX_ICON } from '../../../lib/alang/flashNpcAssets'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import {
  FlashButton,
  FlashNpcPortrait,
  FlashPageState,
  FlashTaskCard,
  formatFlashRemainingTime,
} from '../../../components/alang/FlashUi'
import '../flash.scss'

const FLASH_AMBIENT_BACKGROUND = '/pages/alang/assets/ui/flash-city-ambient-bg.png'
const FLASH_EMPTY_ONLINE = '/pages/alang/assets/ui/flash-empty-online.png'
const FLASH_EMPTY_TASKS = '/pages/alang/assets/ui/flash-empty-tasks.png'
const FLASH_GATE_WATCHDOG_MS = 12_000
const FLASH_LOCATION_RUNTIME_CONTRACT = 'flash-location-compiler-scope-v4'

type GateState = 'checking' | 'intro' | 'locating' | 'ready' | 'denied' | 'error'

function isLocationPermissionDenied(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { errMsg?: unknown; message?: unknown }
  const message = [candidate.errMsg, candidate.message]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
  return /auth(?:orize)?\s*deny|permission\s*denied|user\s*deny/i.test(message)
}

function FlashIntro({ onContinue }: { onContinue: () => void }) {
  const [step, setStep] = useState(0)
  const steps = [
    {
      eyebrow: '01 · 数字相遇',
      title: '先认识一下街头盲盒',
      description: '你会遇见不定时出现的数字动物角色。它们不是真人工作人员，也不会在现实里等你。',
      note: '谁会出现、何时遇见，留一点惊喜。',
      emoji: null,
    },
    {
      eyebrow: '02 · 一次定位',
      title: '定位只在此刻发生',
      description: '你主动开启后，我们读取一次当前位置，用来显示在线角色并判断你是否到了附近。',
      note: '不会在后台持续追踪，也不会用 IP 猜位置。',
      emoji: '🧭',
    },
    {
      eyebrow: '03 · 安全边界',
      title: '决定权一直在你手里',
      description: '任务不要求消费、拍照或打扰陌生人。去不去、进不进店，都由你自己决定。',
      note: '街头盲盒不会订阅消息，也不会主动推送提醒。',
      emoji: '🛡️',
    },
  ] as const
  const current = steps[step]
  const isLastStep = step === steps.length - 1

  return (
    <View className='flash-intro'>
      <View className='flash-intro__progress' aria-label={`街头盲盒介绍，第 ${step + 1} 步，共 ${steps.length} 步`}>
        {steps.map((item, index) => (
          <View
            key={item.eyebrow}
            className={`flash-intro__progress-dot${index === step ? ' flash-intro__progress-dot--active' : ''}`}
          />
        ))}
      </View>
      <View className='flash-intro__stage'>
        <View className={`flash-intro__visual flash-intro__visual--${step + 1}`} aria-hidden='true'>
          {current.emoji ? (
            <JoyJoinIcon emoji={current.emoji} tier='ui' size={92} className='flash-intro__visual-symbol' />
          ) : (
            <Image className='flash-intro__visual-image' src={FLASH_STREET_BOX_ICON} mode='aspectFit' />
          )}
        </View>
        <Text className='flash-intro__eyebrow'>{current.eyebrow}</Text>
        <Text className='flash-intro__title'>{current.title}</Text>
        <Text className='flash-intro__lead'>{current.description}</Text>
        <View className='flash-intro__note'>
          <Text className='flash-intro__note-mark'>✓</Text>
          <Text className='flash-intro__note-text'>{current.note}</Text>
        </View>
      </View>
      <View className='flash-intro__actions'>
        <FlashButton onClick={isLastStep ? onContinue : () => setStep((value) => value + 1)}>
          {isLastStep ? '我知道了，开启定位' : '下一步'}
        </FlashButton>
        {step > 0 && (
          <View
            className='flash-intro__back'
            hoverClass='flash-intro__back--pressed'
            onClick={() => setStep((value) => value - 1)}
            role='button'
            aria-label='返回上一步'
          >
            <Text className='flash-intro__back-text'>返回上一步</Text>
          </View>
        )}
      </View>
    </View>
  )
}

function OnlineNpcCard({ npc, onClick }: { npc: FlashNpcSummary; onClick: () => void }) {
  return (
    <View
      className='flash-online-card'
      hoverClass='flash-online-card--pressed'
      onClick={onClick}
      role='button'
      aria-label={`去找${npc.name}，${npc.districtName}，${formatFlashRemainingTime(npc.remainingSeconds, npc.endsAt)}`}
    >
      <View className='flash-online-card__glow' />
      <FlashNpcPortrait npc={npc} />
      <View className='flash-online-card__body'>
        <View className='flash-online-card__name-row'>
          <Text className='flash-online-card__name'>{npc.name}</Text>
          <Text className='flash-online-card__online'><Text className='flash-online-card__online-dot' />此刻可遇见</Text>
        </View>
        <Text className='flash-online-card__invite'>{npc.invitation}</Text>
        <Text className='flash-online-card__meta'>
          {npc.districtName} · {formatFlashRemainingTime(npc.remainingSeconds, npc.endsAt)}
        </Text>
      </View>
      <Text className='flash-online-card__arrow' aria-hidden='true'>›</Text>
    </View>
  )
}

function FlashHomeErrorState({
  error,
  onRetry,
}: {
  error: unknown
  onRetry: () => void
}) {
  const apiErrorCode = getFlashApiErrorCode(error)
  const outsideShenzhen = apiErrorCode === 'FLASH_OUTSIDE_SHENZHEN'
  const locationUnavailable = apiErrorCode === 'FLASH_LOCATION_UNAVAILABLE'
  const contentUnavailable = apiErrorCode === 'FLASH_DISABLED'
    || apiErrorCode === 'FLASH_SCHEMA_NOT_READY'
    || apiErrorCode === 'FLASH_CATALOG_NOT_READY'

  return (
    <View className='flash-page'>
      <FlashPageState
        tone={outsideShenzhen || contentUnavailable ? 'plain' : 'error'}
        title={outsideShenzhen
          ? '街头盲盒目前只在深圳'
          : locationUnavailable
            ? '暂时无法确认你是否在深圳'
            : contentUnavailable
              ? '街头盲盒还在准备中'
              : '街头盲盒暂时没打开'}
        description={outsideShenzhen
          ? '你仍然可以使用发现页的其他功能；我们不会改用 IP 猜位置。'
          : locationUnavailable
            ? '位置确认服务暂时不可用，可以稍后再试；我们不会改用 IP 猜位置。'
            : contentUnavailable
              ? '地点和任务需要先通过人工审核，准备好后才会开放。'
              : '你的定位不会被缓存。网络恢复后可以重新读取。'}
        action={outsideShenzhen || contentUnavailable ? undefined : onRetry}
        actionLabel={outsideShenzhen || contentUnavailable ? undefined : '重新读取'}
      />
    </View>
  )
}

export default function FlashHomePage() {
  const { user } = useAuth()
  const enabled = shouldShowAlangEntry(user)
  const [gate, setGate] = useState<GateState>('checking')
  const [location, setLocation] = useState<FlashLocationSnapshot | null>(null)
  const [pageVisible, setPageVisible] = useState(true)
  const locationAttemptRef = useRef(0)
  const locationActiveRef = useRef(false)
  const wasHiddenRef = useRef(false)
  const { data, isLoading, isError, error, refetch } = useFlashHome(
    location,
    enabled && gate === 'ready' && pageVisible,
  )

  const requestLocation = useCallback(async () => {
    if (locationActiveRef.current) return
    locationActiveRef.current = true
    const attempt = ++locationAttemptRef.current
    setGate('locating')
    try {
      const permission = await getFlashLocationPermission()
      if (attempt !== locationAttemptRef.current) return
      if (permission === 'denied') {
        setGate('denied')
        return
      }
      const snapshot = await getOneShotFlashLocation()
      if (attempt !== locationAttemptRef.current) return
      setLocation(snapshot)
      setGate('ready')
    } catch (error) {
      if (attempt !== locationAttemptRef.current) return
      setGate(isLocationPermissionDenied(error) ? 'denied' : 'error')
    } finally {
      if (attempt === locationAttemptRef.current) locationActiveRef.current = false
    }
  }, [])

  const restoreGate = useCallback(() => {
    setGate('intro')
  }, [])

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: '街头盲盒' })
  }, [])

  useEffect(() => {
    if (!enabled || gate !== 'checking') return
    void restoreGate()
  }, [enabled, gate, restoreGate])

  useEffect(() => {
    if (gate !== 'checking' && gate !== 'locating') return undefined
    const timer = setTimeout(() => {
      locationAttemptRef.current += 1
      locationActiveRef.current = false
      setGate('error')
    }, FLASH_GATE_WATCHDOG_MS)
    return () => clearTimeout(timer)
  }, [gate])

  useDidShow(() => {
    setPageVisible(true)
    if (wasHiddenRef.current && (gate === 'checking' || gate === 'locating')) {
      wasHiddenRef.current = false
      locationAttemptRef.current += 1
      locationActiveRef.current = false
      setGate('error')
      return
    }
    wasHiddenRef.current = false
    if (enabled && gate === 'checking') {
      void restoreGate()
      return
    }
    if (gate === 'ready' && location) void refetch()
  })

  useDidHide(() => {
    wasHiddenRef.current = true
    locationAttemptRef.current += 1
    locationActiveRef.current = false
    setPageVisible(false)
  })

  useEffect(() => {
    if (!pageVisible || gate !== 'ready' || !location) return undefined
    const timer = setInterval(() => { void refetch() }, 60_000)
    return () => clearInterval(timer)
  }, [gate, location, pageVisible, refetch])

  useEffect(() => {
    if (!data?.canonicalScreen) return
    void redirectToFlashCanonical(data, MINI_PROGRAM_ROUTES.alangEvent)
  }, [data])

  const openLocationSettings = useCallback(async () => {
    try {
      const setting = await Taro.openSetting()
      if (setting.authSetting?.['scope.userLocation'] === true) {
        await requestLocation()
      } else {
        setGate('denied')
      }
    } catch {
      Taro.showToast({ title: '设置没有打开，请稍后再试', icon: 'none' })
    }
  }, [requestLocation])

  const openNpc = (npc: FlashNpcSummary) => {
    haptics('light')
    const params = [
      `appearanceId=${encodeURIComponent(npc.appearanceId)}`,
      `npcName=${encodeURIComponent(npc.name)}`,
      `npcSlug=${encodeURIComponent(npc.slug)}`,
      `districtName=${encodeURIComponent(npc.districtName)}`,
      npc.locationAddress ? `locationAddress=${encodeURIComponent(npc.locationAddress)}` : '',
      npc.endsAt ? `endsAt=${encodeURIComponent(npc.endsAt)}` : '',
    ].filter(Boolean).join('&')
    void Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.alangSearch}?${params}` })
  }

  const openTask = (task: FlashTaskSummary) => {
    haptics('light')
    const assignmentId = task.assignmentId ?? task.id
    void Taro.navigateTo({
      url: `${MINI_PROGRAM_ROUTES.alangCompanion}?assignmentId=${encodeURIComponent(assignmentId)}`,
    })
  }

  if (!enabled) {
    return (
      <View className='flash-page'>
        <FlashPageState title='街头盲盒正在准备下一次见面' description='这项体验暂时没有开放，过些时候再来看看。' />
      </View>
    )
  }

  if (gate === 'intro') return <FlashIntro onContinue={() => { void requestLocation() }} />

  if (gate === 'checking' || gate === 'locating') {
    return (
      <View className={`flash-page ${FLASH_LOCATION_RUNTIME_CONTRACT}`}>
        <FlashPageState
          title={gate === 'checking' ? '正在打开街头盲盒…' : '看看深圳哪里有角色在线…'}
          description='只进行这一次定位，不会在后台持续追踪。'
        />
      </View>
    )
  }

  if (gate === 'denied') {
    return (
      <View className='flash-page'>
        <FlashPageState
          title='需要定位，才能参加街头盲盒'
          description='我们不会用 IP 猜你的位置。打开定位后，才会读取当前在线角色并判断 50 米到达范围。'
          action={() => { void openLocationSettings() }}
          actionLabel='打开定位设置'
        />
      </View>
    )
  }

  if (gate === 'error') {
    return (
      <View className='flash-page'>
        <FlashPageState
          tone='error'
          title='这次没有拿到位置'
          description='定位响应超时或信号暂时不稳定。你可以重新检查权限并再试一次。'
          action={() => { void requestLocation() }}
          actionLabel='重新定位'
        />
      </View>
    )
  }

  if (isError) {
    return (
      <FlashHomeErrorState error={error} onRetry={() => { void refetch() }} />
    )
  }

  if (isLoading || !data) {
    return (
      <View className='flash-page'>
        <FlashPageState title='正在看看谁在线…' description='角色有自己的出没时间，不一定每次都会遇见。' />
      </View>
    )
  }

  return (
    <View className='flash-page'>
      <ScrollView className='flash-page__scroll' scrollY>
        <View className='flash-page__content'>
          <View className='flash-page__hero'>
            <Image className='flash-page__hero-art' src={FLASH_AMBIENT_BACKGROUND} mode='aspectFill' />
            <View className='flash-page__hero-veil' />
            <View className='flash-page__hero-orbit flash-page__hero-orbit--one' />
            <View className='flash-page__hero-orbit flash-page__hero-orbit--two' />
            <View className='flash-page__hero-copy'>
              <View className='flash-page__hero-status'>
                <Text className='flash-page__hero-status-dot' />
                <Text className='flash-page__eyebrow'>SHENZHEN · NIGHT STORY</Text>
              </View>
              <Text className='flash-page__title'>今天，会碰见谁呢？</Text>
              <Text className='flash-page__lead'>他们不会一直在线。看见想聊的，就去附近碰碰运气。</Text>
            </View>
            <View className='flash-page__hero-token'>
              <Text className='flash-page__hero-token-mark'>?</Text>
              <Text className='flash-page__hero-token-copy'>未知相遇</Text>
            </View>
          </View>

          <View className='flash-page__section'>
            <View className='flash-page__section-head'>
              <View>
                <Text className='flash-page__section-kicker'>ENCOUNTER</Text>
                <Text className='flash-page__section-title'>今晚的角色</Text>
              </View>
              <Text className='flash-page__section-meta'>{data.onlineNpcs.length} 位可遇见</Text>
            </View>
            {data.onlineNpcs.length ? (
              <View className='flash-online-list'>
                {data.onlineNpcs.map((npc) => (
                  <OnlineNpcCard key={npc.appearanceId} npc={npc} onClick={() => openNpc(npc)} />
                ))}
              </View>
            ) : (
              <View className='flash-empty-card'>
                <Image className='flash-empty-card__art' src={FLASH_EMPTY_ONLINE} mode='aspectFit' />
                <Text className='flash-empty-card__title'>这会儿没有谁出来晃荡</Text>
                <Text className='flash-empty-card__copy'>不用守着刷新。角色想出现的时候，自然会来。</Text>
              </View>
            )}
          </View>

          <View className='flash-page__section'>
            <View className='flash-page__section-head'>
              <View>
                <Text className='flash-page__section-kicker'>QUEST LOG</Text>
                <Text className='flash-page__section-title'>我的任务手册</Text>
              </View>
              <View
                className='flash-page__link'
                onClick={() => { void Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.alangPreferences }) }}
                role='button'
                aria-label='打开任务偏好设置'
              >
                <Text>任务偏好</Text>
              </View>
            </View>
            {data.myTasks.length ? (
              <View className='flash-task-list'>
                {data.myTasks.map((task) => (
                  <FlashTaskCard key={task.assignmentId ?? task.id} task={task} onClick={() => openTask(task)} />
                ))}
              </View>
            ) : (
              <View className='flash-empty-card'>
                <Image className='flash-empty-card__art' src={FLASH_EMPTY_TASKS} mode='aspectFit' />
                <Text className='flash-empty-card__title'>口袋还是空的</Text>
                <Text className='flash-empty-card__copy'>先和在线角色聊聊。聊得来，他也许会托你做件小事。</Text>
              </View>
            )}
          </View>

          <View className='flash-page__notice'>
            <JoyJoinIcon
              className='flash-page__notice-mark'
              emoji='✨'
              tier='reveal'
              size={32}
            />
            <Text className='flash-page__notice-text'>这里没有真人 NPC，也不会推送催你出门。到点后角色会正常离开，去不去由你决定。</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

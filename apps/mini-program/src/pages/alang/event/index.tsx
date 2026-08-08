import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import { shouldShowStreetBlindBoxEntry } from '../../../lib/alang/alangAccess'
import { redirectToFlashCanonical } from '../../../lib/alang/flashNavigation'
import { useFlashHome, useFlashStoryFragments } from '../../../lib/alang/useFlash'
import { apiRequest } from '../../../lib/api/api'
import type { FlashLocationSnapshot, FlashNpcSummary } from '../../../lib/alang/flashTypes'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { haptics } from '../../../lib/utils/haptics'
import personalizedPaperWorld from '../assets/onboarding/parallel-personalized-paper-world-v1.jpg'
import standardPaperWorld from '../assets/onboarding/parallel-standard-paper-world-v1.jpg'
import flashAmbientBackground from '../assets/ui/flash-city-ambient-bg.png'
import flashEmptyOnline from '../assets/ui/flash-empty-online.png'
import {
  FlashButton,
  FlashNpcPortrait,
  FlashPageState,
  formatFlashAvailability,
} from '../../../components/alang/FlashUi'
import '../flash.scss'

const FLASH_INFO_ICON = '/assets/icons/status-icons/status-info.webp'
const FLASH_PERSONALIZED_SCENE = personalizedPaperWorld
const FLASH_STANDARD_SCENE = standardPaperWorld
const FLASH_AMBIENT_BACKGROUND = flashAmbientBackground
const FLASH_EMPTY_ONLINE = flashEmptyOnline
const FLASH_LOCATION_TIMEOUT_MS = 12_000
const FLASH_STORY_CONSENT_VERSION = 'flash-story-personalization-v1'

type GateState = 'checking' | 'intro' | 'locating' | 'ready' | 'denied' | 'error'

function getEntryApiErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const data = (error as { data?: unknown }).data
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (typeof record.code === 'string') return record.code
    if (typeof record.error === 'string' && /^[A-Z0-9_]+$/.test(record.error)) return record.error
  }
  return null
}

function isLocationPermissionDenied(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { errMsg?: unknown; message?: unknown }
  const message = [candidate.errMsg, candidate.message]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
  return /auth(?:orize)?\s*deny|permission\s*denied|user\s*deny/i.test(message)
}

function getEntryLocation(): Promise<FlashLocationSnapshot> {
  if (typeof Taro.getLocation !== 'function') {
    return Promise.reject(new Error('WECHAT_LOCATION_API_UNAVAILABLE'))
  }
  return new Promise((resolve, reject) => {
    Taro.getLocation({
      type: 'gcj02',
      success: (result) => {
        resolve({
          latitude: result.latitude,
          longitude: result.longitude,
          accuracy: result.accuracy,
        })
      },
      fail: reject,
    })
  })
}

function FlashIntro({ busy, onSelect }: { busy: boolean; onSelect: (mode: 'personalized' | 'standard') => void }) {
  return (
    <View className='flash-intro'>
      <View className='flash-intro__content'>
        <View className='flash-intro__copy'>
          <Text className='flash-intro__eyebrow'>YOUR PARALLEL UNIVERSE</Text>
          <Text className='flash-intro__title'>这一次，故事想怎样认识你？</Text>
          <Text className='flash-intro__lead'>两个模式都拥有完整剧情、选择后果和个人结局。它们都是虚构的数字动物 NPC，并非现场真人。</Text>
        </View>
        <View className='flash-intro__modes'>
          <View className={`flash-intro__mode${busy ? ' flash-intro__mode--disabled' : ''}`} hoverClass={busy ? '' : 'flash-intro__mode--pressed'} role='button' aria-label='开启更专属的剧情' onClick={() => { if (!busy) onSelect('personalized') }}>
            <Image className='flash-intro__mode-bg' src={FLASH_PERSONALIZED_SCENE} mode='aspectFill' aria-hidden='true' />
            <View className='flash-intro__mode-shade' aria-hidden='true' />
            <View className='flash-intro__mode-copy'>
              <Text className='flash-intro__mode-kicker'>AI · 专属宇宙</Text>
              <Text className='flash-intro__mode-title'>更专属的剧情</Text>
              <Text className='flash-intro__mode-description'>参考你已填写的人格、兴趣与宽泛职业领域，并结合当时环境和此前选择来回应你。点击进入即表示同意本次专属剧情使用这些信息。</Text>
              <Text className='flash-intro__mode-action'>{busy ? '正在开启…' : '进入专属剧情  →'}</Text>
            </View>
          </View>
          <View className={`flash-intro__mode${busy ? ' flash-intro__mode--disabled' : ''}`} hoverClass={busy ? '' : 'flash-intro__mode--pressed'} role='button' aria-label='进入标准剧情' onClick={() => { if (!busy) onSelect('standard') }}>
            <Image className='flash-intro__mode-bg flash-intro__mode-bg--standard' src={FLASH_STANDARD_SCENE} mode='aspectFill' aria-hidden='true' />
            <View className='flash-intro__mode-shade flash-intro__mode-shade--standard' aria-hidden='true' />
            <View className='flash-intro__mode-copy'>
              <Text className='flash-intro__mode-kicker'>不读取个人画像</Text>
              <Text className='flash-intro__mode-title'>标准剧情</Text>
              <Text className='flash-intro__mode-description'>不使用人格、兴趣或职业信息。你的每次选择依然会改变过程、回声和最终结局。</Text>
              <Text className='flash-intro__mode-action'>{busy ? '请稍候…' : '进入标准剧情  →'}</Text>
            </View>
          </View>
        </View>
        <Text className='flash-intro__aside'>选择后才会申请一次定位，用于查看当前在线角色；可在街头盲盒设置中随时更改个性化授权。</Text>
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
      aria-label={`去找${npc.name}，${npc.districtName}，${formatFlashAvailability(npc.availabilityMode, npc.remainingSeconds, npc.endsAt)}`}
    >
      <FlashNpcPortrait npc={npc} />
      <View className='flash-online-card__body'>
        <View className='flash-online-card__name-row'>
          <Text className='flash-online-card__name'>{npc.name}</Text>
          <Text className='flash-online-card__online'>正在闪现</Text>
        </View>
        <Text className='flash-online-card__invite'>{npc.invitation}</Text>
        <Text className='flash-online-card__meta'>
          {npc.districtName} · {formatFlashAvailability(npc.availabilityMode, npc.remainingSeconds, npc.endsAt)}
        </Text>
      </View>
      <Text className='flash-online-card__arrow' aria-hidden='true'>›</Text>
    </View>
  )
}

export default function FlashHomePage() {
  const enabled = shouldShowStreetBlindBoxEntry()
  const [gate, setGate] = useState<GateState>('checking')
  const [location, setLocation] = useState<FlashLocationSnapshot | null>(null)
  const [pageVisible, setPageVisible] = useState(true)
  const [modeSaving, setModeSaving] = useState(false)
  const locationAttemptRef = useRef(0)
  const locationActiveRef = useRef(false)
  const { data, isLoading, isError, error, refetch } = useFlashHome(
    location,
    enabled && gate === 'ready' && pageVisible,
  )
  const fragmentsQuery = useFlashStoryFragments(enabled && gate === 'ready' && pageVisible)

  const requestLocation = useCallback((): Promise<void> => {
    if (locationActiveRef.current) return Promise.resolve()
    locationActiveRef.current = true
    const attempt = ++locationAttemptRef.current
    setGate('locating')
    return getEntryLocation()
      .then((snapshot) => {
        if (attempt !== locationAttemptRef.current) return
        setLocation(snapshot)
        setGate('ready')
      })
      .catch((error: unknown) => {
        if (attempt === locationAttemptRef.current) {
          setGate(isLocationPermissionDenied(error) ? 'denied' : 'error')
        }
      })
      .finally(() => {
        if (attempt === locationAttemptRef.current) locationActiveRef.current = false
      })
  }, [])

  const selectStoryMode = useCallback((mode: 'personalized' | 'standard') => {
    if (modeSaving) return
    setModeSaving(true)
    const personalized = mode === 'personalized'
    let preferenceRequest: Promise<unknown>
    try {
      preferenceRequest = apiRequest({
        path: '/api/alang/flash/preferences',
        method: 'PUT',
        data: {
          personalizationEnabled: personalized,
          usePersonality: personalized,
          useInterests: personalized,
          useIndustry: personalized,
          useDistrict: false,
          useTaskBehavior: false,
          consentVersion: personalized ? FLASH_STORY_CONSENT_VERSION : undefined,
        },
      })
    } catch {
      Taro.showToast({ title: '剧情模式没有保存成功，请再试一次', icon: 'none' })
      setModeSaving(false)
      return
    }

    void preferenceRequest
      .then(() => requestLocation())
      .catch(() => {
        Taro.showToast({ title: '剧情模式没有保存成功，请再试一次', icon: 'none' })
      })
      .finally(() => {
        setModeSaving(false)
      })
  }, [modeSaving, requestLocation])

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: '街头盲盒' })
    if (!enabled) return
    // Consent is session-scoped: every fresh entry discloses the one-shot GPS
    // collection before getLocation, while in-page refreshes do not interrupt.
    setGate('intro')
  }, [enabled])

  useDidShow(() => {
    setPageVisible(true)
  })

  useDidHide(() => {
    setPageVisible(false)
    locationAttemptRef.current += 1
    locationActiveRef.current = false
    setLocation(null)
    if (enabled) setGate('intro')
  })

  useEffect(() => {
    if (gate !== 'locating') return undefined
    const timer = setTimeout(() => {
      locationAttemptRef.current += 1
      locationActiveRef.current = false
      setGate('error')
    }, FLASH_LOCATION_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [gate])

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
      npc.availabilityMode ? `availabilityMode=${encodeURIComponent(npc.availabilityMode)}` : '',
    ].filter(Boolean).join('&')
    void Taro.navigateTo({ url: `${MINI_PROGRAM_ROUTES.alangSearch}?${params}` })
  }

  if (!enabled) {
    return (
      <View className='flash-page'>
        <FlashPageState title='闪现正在准备下一次见面' description='这项体验暂时没有开放，过些时候再来看看。' />
      </View>
    )
  }

  if (gate === 'intro') return <FlashIntro busy={modeSaving} onSelect={(mode) => { void selectStoryMode(mode) }} />

  if (gate === 'checking' || gate === 'locating') {
    return (
      <View className='flash-page'>
        <FlashPageState
          title={gate === 'checking' ? '正在打开闪现…' : '看看深圳哪里有角色在线…'}
          description='正在读取当前位置。选中角色后，地图会在前台持续更新距离和方向。'
        />
      </View>
    )
  }

  if (gate === 'denied') {
    return (
      <View className='flash-page'>
        <FlashPageState
          title='需要定位，才能参加闪现'
          description='我们不会用 IP 猜你的位置。允许后可以查看附近角色；进入地图后只会在前台持续更新位置。'
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
          description='定位响应超时，或当前信号不稳定。你可以检查系统定位权限后再试。'
          action={() => { void requestLocation() }}
          actionLabel='重新定位'
        />
      </View>
    )
  }

  if (isError) {
    const code = getEntryApiErrorCode(error)
    const outsideShenzhen = code === 'FLASH_OUTSIDE_SHENZHEN'
    const contentUnavailable = code === 'FLASH_DISABLED'
      || code === 'FLASH_SCHEMA_NOT_READY'
      || code === 'FLASH_CATALOG_NOT_READY'
    return (
      <View className='flash-page'>
        <FlashPageState
          tone={outsideShenzhen || contentUnavailable ? 'plain' : 'error'}
          title={outsideShenzhen ? '闪现目前只在深圳' : contentUnavailable ? '闪现还在准备中' : '闪现暂时没打开'}
          description={outsideShenzhen
            ? '你仍然可以使用发现页的其他功能；我们不会改用 IP 猜位置。'
            : contentUnavailable
              ? '闪现地点和完整故事季需要先通过人工审核，准备好后才会开放。'
              : '你的定位不会被缓存。网络恢复后可以重新读取。'}
          action={outsideShenzhen || contentUnavailable ? undefined : () => { void refetch() }}
          actionLabel={outsideShenzhen || contentUnavailable ? undefined : '重新读取'}
        />
      </View>
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
    <View className='flash-page flash-map-direct-flow-v1'>
      <ScrollView className='flash-page__scroll' scrollY>
        <View className='flash-page__content'>
          <View className='flash-page__hero'>
            <Image
              className='flash-page__hero-background'
              src={FLASH_AMBIENT_BACKGROUND}
              mode='aspectFill'
              aria-hidden='true'
            />
            <View className='flash-page__hero-copy'>
              <Text className='flash-page__eyebrow'>SHENZHEN · NOW</Text>
              <Text className='flash-page__title'>今天，会碰见谁呢？</Text>
              <Text className='flash-page__lead'>他们不会一直在线。看见想聊的，就去附近碰碰运气。</Text>
            </View>
          </View>

          <View className='flash-page__section'>
            <View className='flash-page__section-head'>
              <Text className='flash-page__section-title'>现在在线</Text>
              <Text className='flash-page__section-meta'>{data.onlineNpcs.length} 位</Text>
            </View>
            {data.onlineNpcs.length ? (
              <View className='flash-online-list'>
                {data.onlineNpcs.map((npc) => (
                  <OnlineNpcCard key={npc.appearanceId} npc={npc} onClick={() => openNpc(npc)} />
                ))}
              </View>
            ) : (
              <View className='flash-empty-card'>
                <Image className='flash-empty-card__image' src={FLASH_EMPTY_ONLINE} mode='aspectFit' />
                <Text className='flash-empty-card__title'>这会儿没有谁出来晃荡</Text>
                <Text className='flash-empty-card__copy'>不用守着刷新。角色想出现的时候，自然会来。</Text>
              </View>
            )}
          </View>

          <View className='flash-page__section'>
            <View className='flash-page__section-head'>
              <Text className='flash-page__section-title'>我的故事碎片</Text>
              <Text className='flash-page__section-meta'>{fragmentsQuery.data?.length ?? 0}/15</Text>
            </View>
            {fragmentsQuery.data?.length ? (
              <View className='flash-story-fragment-list'>
                {fragmentsQuery.data.map((fragment) => (
                  <View key={fragment.id} className={`flash-story-fragment-card flash-story-fragment-card--${fragment.category}`}>
                    <Text className='flash-story-fragment-card__meta'>{fragment.npcName} · {fragment.episodeTitle}</Text>
                    <Text className='flash-story-fragment-card__title'>{fragment.title}</Text>
                    <Text className='flash-story-fragment-card__fact'>{fragment.fact}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View className='flash-empty-card'>
                <Text className='flash-empty-card__title'>故事还没有翻开</Text>
                <Text className='flash-empty-card__copy'>找到一位在线角色，完成一次相遇，就会收下一块属于他的故事碎片。</Text>
              </View>
            )}
          </View>

          <View className='flash-page__notice'>
            <Image className='flash-page__notice-mark' src={FLASH_INFO_ICON} mode='aspectFit' />
            <Text className='flash-page__notice-text'>这里没有真人 NPC，也不会推送催你出门。角色结束本次闪现后会正常离开，去不去由你决定。</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

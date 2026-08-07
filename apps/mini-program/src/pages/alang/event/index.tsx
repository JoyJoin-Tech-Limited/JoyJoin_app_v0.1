import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import { useAuth } from '../../../hooks/useAuth'
import { shouldShowAlangEntry } from '../../../lib/alang/alangAccess'
import { getFlashApiErrorCode, getFlashLocationPermission, getOneShotFlashLocation } from '../../../lib/alang/flashApi'
import { redirectToFlashCanonical } from '../../../lib/alang/flashNavigation'
import { useFlashHome, useFlashStoryFragments } from '../../../lib/alang/useFlash'
import type { FlashLocationSnapshot, FlashNpcSummary } from '../../../lib/alang/flashTypes'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { haptics } from '../../../lib/utils/haptics'
import {
  FlashButton,
  FlashNpcPortrait,
  FlashPageState,
  formatFlashRemainingTime,
} from '../../../components/alang/FlashUi'
import '../flash.scss'

const FLASH_INFO_ICON = '/assets/icons/status-icons/status-info.webp'
const FLASH_INTRO_SCENE = '/pages/alang/assets/onboarding/street-blind-box-onboarding-fullscreen-v7.webp'
const FLASH_AMBIENT_BACKGROUND = '/pages/alang/assets/ui/flash-city-ambient-bg.webp'
const FLASH_EMPTY_ONLINE = '/pages/alang/assets/ui/flash-empty-online.webp'

type GateState = 'checking' | 'intro' | 'locating' | 'ready' | 'denied' | 'error'

function FlashIntro({ onContinue }: { onContinue: () => void }) {
  return (
    <View className='flash-intro'>
      <Image className='flash-intro__backdrop' src={FLASH_INTRO_SCENE} mode='aspectFill' aria-hidden='true' />
      <View className='flash-intro__shade' aria-hidden='true' />
      <View className='flash-intro__content'>
        <View className='flash-intro__copy'>
          <Text className='flash-intro__eyebrow'>SHENZHEN · NOW</Text>
          <Text className='flash-intro__title'>今天，会碰见谁呢？</Text>
        </View>
        <View className='flash-intro__actions'>
          <FlashButton onClick={onContinue}>开启一次定位</FlashButton>
          <Text className='flash-intro__aside'>这次只用来查看在线角色；选定角色后会直接打开前台地图。</Text>
        </View>
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
      <FlashNpcPortrait npc={npc} />
      <View className='flash-online-card__body'>
        <View className='flash-online-card__name-row'>
          <Text className='flash-online-card__name'>{npc.name}</Text>
          <Text className='flash-online-card__online'>正在闪现</Text>
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

export default function FlashHomePage() {
  const { user } = useAuth()
  const enabled = shouldShowAlangEntry(user)
  const [gate, setGate] = useState<GateState>('checking')
  const [location, setLocation] = useState<FlashLocationSnapshot | null>(null)
  const [pageVisible, setPageVisible] = useState(true)
  const { data, isLoading, isError, error, refetch } = useFlashHome(
    location,
    enabled && gate === 'ready' && pageVisible,
  )
  const fragmentsQuery = useFlashStoryFragments(enabled && gate === 'ready' && pageVisible)

  const requestLocation = useCallback(async () => {
    setGate('locating')
    try {
      const snapshot = await getOneShotFlashLocation()
      setLocation(snapshot)
      setGate('ready')
    } catch {
      const permission = await getFlashLocationPermission()
      setGate(permission === 'denied' ? 'denied' : 'error')
    }
  }, [])

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
    setLocation(null)
    if (enabled) setGate('intro')
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

  if (!enabled) {
    return (
      <View className='flash-page'>
        <FlashPageState title='闪现正在准备下一次见面' description='这项体验暂时没有开放，过些时候再来看看。' />
      </View>
    )
  }

  if (gate === 'intro') return <FlashIntro onContinue={() => { void requestLocation() }} />

  if (gate === 'checking' || gate === 'locating') {
    return (
      <View className='flash-page'>
        <FlashPageState
          title={gate === 'checking' ? '正在打开闪现…' : '看看深圳哪里有角色在线…'}
          description='这次只读取当前位置；选定角色后会直接打开地图并开始前台定位。'
        />
      </View>
    )
  }

  if (gate === 'denied') {
    return (
      <View className='flash-page'>
        <FlashPageState
          title='需要定位，才能参加闪现'
          description='我们不会用 IP 猜你的位置。打开后先查看当前在线角色；选定角色后地图会再次明确提示定位用途。'
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
          description='可能是定位信号或网络暂时不稳定。你可以稍后再试。'
          action={() => { void requestLocation() }}
          actionLabel='重新定位'
        />
      </View>
    )
  }

  if (isError) {
    const code = getFlashApiErrorCode(error)
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
            <Text className='flash-page__notice-text'>这里没有真人 NPC，也不会推送催你出门。到点后角色会正常离开，去不去由你决定。</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

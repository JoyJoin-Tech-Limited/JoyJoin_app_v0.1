import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import { useAuth } from '../../../hooks/useAuth'
import { shouldShowAlangDebugTools, shouldShowStreetBlindBoxEntry } from '../../../lib/alang/alangAccess'
import { getFlashApiErrorCode } from '../../../lib/alang/flashApi'
import { hasAcknowledgedFlashIntro, markFlashIntroAcknowledged } from '../../../lib/alang/flashExperienceStorage'
import { redirectToFlashCanonical } from '../../../lib/alang/flashNavigation'
import { useFlashHome, useFlashStoryFragments } from '../../../lib/alang/useFlash'
import type { FlashNpcSummary } from '../../../lib/alang/flashTypes'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { haptics } from '../../../lib/utils/haptics'
import standardPaperWorld from '../assets/onboarding/parallel-standard-paper-world-v1.jpg'
import flashAmbientBackground from '../assets/ui/flash-city-ambient-bg.png'
import flashEmptyOnline from '../assets/ui/flash-empty-online.png'
import {
  FlashNpcPortrait,
  FlashPageState,
  formatFlashAvailability,
} from '../../../components/alang/FlashUi'
import '../flash.scss'

const FLASH_INFO_ICON = '/assets/icons/status-icons/status-info.webp'
const FLASH_STANDARD_SCENE = standardPaperWorld
const FLASH_AMBIENT_BACKGROUND = flashAmbientBackground
const FLASH_EMPTY_ONLINE = flashEmptyOnline

type GateState = 'checking' | 'intro' | 'ready'

function FlashIntro({ onContinue }: { onContinue: () => void }) {
  return (
    <View className='flash-intro'>
      <View className='flash-intro__content'>
        <View className='flash-intro__copy'>
          <Text className='flash-intro__eyebrow'>A REVIEWED STORY</Text>
          <Text className='flash-intro__title'>这一季，只让旧物慢慢开口</Text>
          <Text className='flash-intro__lead'>十五段剧情都经过人工审核，不读取人格、兴趣或职业，也不由 AI 临场续写。它们都是虚构的数字动物 NPC，并非现场真人。</Text>
        </View>
        <View className='flash-intro__modes'>
          <View className='flash-intro__mode' hoverClass='flash-intro__mode--pressed' role='button' aria-label='进入没有名字的旧物' onClick={onContinue}>
            <Image className='flash-intro__mode-bg flash-intro__mode-bg--standard' src={FLASH_STANDARD_SCENE} mode='aspectFill' aria-hidden='true' />
            <View className='flash-intro__mode-shade flash-intro__mode-shade--standard' aria-hidden='true' />
            <View className='flash-intro__mode-copy'>
              <Text className='flash-intro__mode-kicker'>人工审核 · 固定回应</Text>
              <Text className='flash-intro__mode-title'>《没有名字的旧物》</Text>
              <Text className='flash-intro__mode-description'>你的回应会接上对应的审核对白，并解锁一块固定事实碎片；定位只会在你主动寻找角色时开启。</Text>
              <Text className='flash-intro__mode-action'>收下第一条线索  →</Text>
            </View>
          </View>
        </View>
        <Text className='flash-intro__aside'>选定角色后，地图页会单独说明定位用途；故事过程不会读取你的个人画像。</Text>
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
          <Text className='flash-online-card__online'>当前在线</Text>
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
  const { user } = useAuth()
  const enabled = shouldShowStreetBlindBoxEntry()
  const canReplayStories = shouldShowAlangDebugTools(user)
  const [gate, setGate] = useState<GateState>('checking')
  const [pageVisible, setPageVisible] = useState(true)
  const { data, isLoading, isError, error, refetch } = useFlashHome(enabled && gate === 'ready' && pageVisible)
  const fragmentsQuery = useFlashStoryFragments(enabled && gate === 'ready' && pageVisible)

  const continueReviewedStory = () => {
    markFlashIntroAcknowledged()
    setGate('ready')
  }

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: '街头盲盒' })
    if (!enabled) return
    setGate(hasAcknowledgedFlashIntro() ? 'ready' : 'intro')
  }, [enabled])

  useDidShow(() => {
    setPageVisible(true)
  })

  useDidHide(() => {
    setPageVisible(false)
  })

  useEffect(() => {
    if (!pageVisible || gate !== 'ready') return undefined
    const timer = setInterval(() => { void refetch() }, 60_000)
    return () => clearInterval(timer)
  }, [gate, pageVisible, refetch])

  useEffect(() => {
    if (!data?.canonicalScreen) return
    void redirectToFlashCanonical(data, MINI_PROGRAM_ROUTES.alangEvent)
  }, [data])

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
        <FlashPageState title='街头盲盒正在准备下一次见面' description='这项体验暂时没有开放，过些时候再来看看。' />
      </View>
    )
  }

  if (gate === 'intro') return <FlashIntro onContinue={continueReviewedStory} />

  if (gate === 'checking') {
    return (
      <View className='flash-page'>
        <FlashPageState
          title='正在打开街头盲盒…'
          description='正在查看深圳当前在线的数字角色。'
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
          title={outsideShenzhen ? '街头盲盒目前只在深圳' : contentUnavailable ? '街头盲盒还在准备中' : '街头盲盒暂时没打开'}
          description={outsideShenzhen
            ? '你仍然可以使用发现页的其他功能；我们不会改用 IP 猜位置。'
            : contentUnavailable
              ? '街头盲盒地点和完整故事季需要先通过人工审核，准备好后才会开放。'
              : '网络暂时没有连通。恢复后可以重新读取在线角色。'}
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
                    {canReplayStories ? (
                      <View
                        className='flash-story-fragment-card__replay'
                        hoverClass='flash-story-fragment-card__replay--pressed'
                        role='button'
                        aria-label={`重新游玩${fragment.episodeTitle}`}
                        onClick={() => {
                          haptics('light')
                          void Taro.navigateTo({
                            url: `${MINI_PROGRAM_ROUTES.alangDialogue}?encounterId=${encodeURIComponent(fragment.encounterId)}&replay=1`,
                          })
                        }}
                      >
                        <Text>重新游玩</Text>
                      </View>
                    ) : null}
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
            <Text className='flash-page__notice-text'>这里没有真人 NPC，也不会推送催你出门。角色结束本次在线后会正常离开，去不去由你决定。</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

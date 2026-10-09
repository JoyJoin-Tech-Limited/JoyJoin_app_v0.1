import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import { isStreetBlindBoxLive, shouldShowStreetBlindBoxEntry } from '../../lib/alang/alangAccess'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { alangEvents } from '../../lib/alang/alangAnalytics'
import { discoverAnalytics } from '../../lib/analytics/discoverAnalytics'
import { useAuth } from '../../hooks/useAuth'
import { useMiniRevealMotion } from '../../hooks/useMiniRevealMotion'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import { haptics } from '../../lib/utils/haptics'
import { logInfo, logWarn } from '../../lib/utils/logger'
import { FLASH_STREET_BOX_ICON } from '../../lib/alang/flashNpcAssets'
import './AlangDiscoverCard.scss'

// Stable id used by IntersectionObserver; module scope keeps the lookup
// deterministic across re-mounts (same pattern as HeroPromoBanner).
const ALANG_DISCOVER_CARD_ID = 'alang-discover-card'

// Teaser-mode icon: Lovart box+wolf-silhouette composite, CDN-primary
// (manifest: assets/alang/flash-teaser-icon-v1.webp; brief:
// docs/design/lovart-brief-flash-teaser-20261009.md). Falls back to the
// bundled street-box icon until the CDN upload lands or if the fetch fails.
const FLASH_TEASER_ICON_CDN = cdnAsset('/assets/alang/flash-teaser-icon-v1.webp')

/**
 * A deliberately static entry. Discover must not fetch NPC state, pre-load the
 * Flash subpackage, or request location before the user explicitly enters.
 *
 * Two modes (sprint_20261009_flash_teaser_mode): while `alangEnabled` is off
 * the card renders the「内测中」teaser variant and routes to the static teaser
 * page; when the flag flips on, the same card becomes the live entry with zero
 * code changes.
 */
export default function AlangDiscoverCard() {
  const { user } = useAuth()
  const { shouldReduceMotion } = useMiniRevealMotion()
  const { isDegradation } = useDeviceTier()
  const [isInView, setIsInView] = useState(true)
  const [teaserIconFailed, setTeaserIconFailed] = useState(false)
  const teaserImpressionFiredRef = useRef(false)

  const isLive = isStreetBlindBoxLive(user)

  // Teaser idle motion (halo breath + sheen sweep) runs only while the card is
  // in the viewport — the Discover hero banner owns the top-of-screen peak.
  useEffect(() => {
    if (isLive || shouldReduceMotion || isDegradation) {
      setIsInView(true)
      return
    }
    let observer: ReturnType<typeof Taro.createIntersectionObserver> | null = null
    try {
      const page = Taro.getCurrentInstance()?.page as unknown as Record<string, unknown> | undefined
      if (!page) {
        setIsInView(true)
        return
      }
      observer = Taro.createIntersectionObserver(page, {
        thresholds: [0, 0.01],
        nativeMode: true,
      } as Taro.createIntersectionObserver.Option)
    } catch {
      setIsInView(true)
      return
    }
    if (!observer) {
      setIsInView(true)
      return
    }
    observer
      .relativeToViewport()
      .observe(`#${ALANG_DISCOVER_CARD_ID}`, (res: any) => {
        setIsInView(Boolean(res?.intersectionRatio > 0))
      })
    return () => {
      try {
        observer?.disconnect?.()
      } catch {
        // Cleanup is best-effort; never throw in unmount.
      }
    }
  }, [isLive, shouldReduceMotion, isDegradation])

  // Teaser demand signal: impression once per mount; mode resolution logs on
  // every change (auth revalidation can flip the flag mid-session).
  const lastLoggedModeRef = useRef<'live' | 'teaser' | null>(null)
  useEffect(() => {
    const mode = isLive ? 'live' : 'teaser'
    if (lastLoggedModeRef.current !== mode) {
      lastLoggedModeRef.current = mode
      logInfo('[FlashTeaser] mode resolved', { mode })
    }
    if (isLive || teaserImpressionFiredRef.current) return
    teaserImpressionFiredRef.current = true
    discoverAnalytics.track('flash_teaser_impression', undefined, { surface: 'card' })
  }, [isLive])

  if (!shouldShowStreetBlindBoxEntry()) return null

  const animateTeaser = !isLive && isInView && !shouldReduceMotion && !isDegradation

  const handleTap = async () => {
    haptics('light')
    if (!isLive) {
      discoverAnalytics.track('flash_teaser_tap', undefined, { surface: 'card' })
      try {
        await Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.alangTeaser })
      } catch (error) {
        logWarn('[FlashTeaser] failed to open teaser page', { error: String(error) })
        await Taro.showToast({
          title: '预告页打开失败，请更新小程序后重试',
          icon: 'none',
        })
      }
      return
    }
    alangEvents.discoverCardTap()
    try {
      await Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.alangEvent })
    } catch (error) {
      // A stale development build can contain the Discover entry without the
      // matching Flash subpackage. Never swallow that failure: make the
      // recovery action visible and keep the native error in the realtime log.
      console.error('[Flash] failed to open street blind box subpackage', error)
      await Taro.showToast({
        title: '街头盲盒打开失败，请更新小程序后重试',
        icon: 'none',
      })
    }
  }

  if (!isLive) {
    return (
      <View
        id={ALANG_DISCOVER_CARD_ID}
        className={[
          'alang-discover-card',
          'alang-discover-card--teaser',
          animateTeaser ? 'alang-discover-card--teaser-animate' : '',
        ].filter(Boolean).join(' ')}
        hoverClass='alang-discover-card--pressed'
        onClick={handleTap}
        role='button'
        aria-label='街头盲盒内测预告，点击查看'
      >
        <View className='alang-discover-card__bolt alang-discover-card__bolt--teaser' aria-hidden='true'>
          <View className='alang-discover-card__halo' />
          <Image
            className='alang-discover-card__icon'
            src={teaserIconFailed ? FLASH_STREET_BOX_ICON : FLASH_TEASER_ICON_CDN}
            mode='aspectFit'
            onError={() => setTeaserIconFailed(true)}
          />
        </View>
        <View className='alang-discover-card__content'>
          <View className='alang-discover-card__title-row'>
            <Text className='alang-discover-card__title'>街头盲盒</Text>
            <Text className='alang-discover-card__beta-pill'>内测中</Text>
          </View>
          <Text className='alang-discover-card__description'>这座城市还藏着几个朋友，正在路上</Text>
        </View>
        <View className='alang-discover-card__sheen' aria-hidden='true' />
        <Text className='alang-discover-card__arrow' aria-hidden='true'>›</Text>
      </View>
    )
  }

  return (
    <View
      id={ALANG_DISCOVER_CARD_ID}
      className='alang-discover-card'
      hoverClass='alang-discover-card--pressed'
      onClick={handleTap}
      role='button'
      aria-label='进入街头盲盒，查看深圳当前在线的数字角色'
    >
      <View className='alang-discover-card__bolt' aria-hidden='true'>
        <Image className='alang-discover-card__icon' src={FLASH_STREET_BOX_ICON} mode='aspectFill' />
      </View>
      <View className='alang-discover-card__content'>
        <View className='alang-discover-card__title-row'>
          <Text className='alang-discover-card__title'>街头盲盒</Text>
          <Text className='alang-discover-card__city'>深圳限定</Text>
        </View>
        <Text className='alang-discover-card__description'>城市里的数字角色，偶尔会出来聊两句</Text>
      </View>
      <Text className='alang-discover-card__arrow' aria-hidden='true'>›</Text>
    </View>
  )
}

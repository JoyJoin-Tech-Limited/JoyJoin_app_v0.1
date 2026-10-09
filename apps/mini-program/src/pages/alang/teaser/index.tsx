import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { cdnAsset } from '../../../lib/utils/cdnAssets'
import { haptics } from '../../../lib/utils/haptics'
import './index.scss'

// Lovart dusk-city hero (brief: docs/design/lovart-brief-flash-teaser-20261009.md).
// Until the asset lands on the CDN — or if the request fails — the CSS dusk
// gradient painted on the page shell carries the surface (REL-02).
const FLASH_TEASER_HERO_CDN = cdnAsset('/assets/alang/flash-teaser-hero-v1.webp')

/**
 * 街头盲盒「内测中」静态预告页 (sprint_20261009_flash_teaser_mode)。
 * Reached from the Discover teaser card and promo banner variant D while
 * alangEnabled is off. Deliberately static: no NPC state, no location
 * requests, no API calls — the teaser must never look like a dead link.
 */
export default function FlashTeaserPage() {
  const { shouldReduceMotion } = useMiniRevealMotion()
  const { isDegradation } = useDeviceTier()
  const [heroLoaded, setHeroLoaded] = useState(false)
  const [heroFailed, setHeroFailed] = useState(false)
  const [boxPulse, setBoxPulse] = useState(false)
  const boxPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const animate = !shouldReduceMotion && !isDegradation

  // Swipe-back safety: the pulse is transient; never let it survive re-entry.
  useResetOnShow(setBoxPulse)

  // 「摸一下盒子」: a promise you can touch. Opacity-only glow pulse over the
  // box area; no layout work, suppressed under reduced-motion/degradation.
  const pulseBox = (withHaptics: boolean) => {
    if (!animate || boxPulse) return
    if (withHaptics) haptics('medium')
    setBoxPulse(true)
    if (boxPulseTimerRef.current) clearTimeout(boxPulseTimerRef.current)
    boxPulseTimerRef.current = setTimeout(() => {
      boxPulseTimerRef.current = null
      setBoxPulse(false)
    }, 700)
  }

  const handleBoxTap = () => pulseBox(true)

  // The box introduces itself: one silent pulse shortly after the hero
  // reveals — discoverability for the tap without a word of hint copy.
  useEffect(() => {
    if (!heroLoaded || !animate) return
    const introTimer = setTimeout(() => pulseBox(false), 600)
    return () => clearTimeout(introTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroLoaded, animate])

  // Timer hygiene on unmount (navigateBack inside the 700ms window).
  useEffect(
    () => () => {
      if (boxPulseTimerRef.current) clearTimeout(boxPulseTimerRef.current)
    },
    [],
  )

  const handleBack = async () => {
    haptics('light')
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      await Taro.navigateBack()
    } else {
      await Taro.switchTab({ url: '/pages/discover/index' })
    }
  }

  return (
    <View
      className={[
        'flash-teaser',
        animate ? 'flash-teaser--animate' : '',
      ].filter(Boolean).join(' ')}
    >
      {!heroFailed && (
        <Image
          className={[
            'flash-teaser__hero',
            heroLoaded ? 'flash-teaser__hero--revealed' : '',
          ].filter(Boolean).join(' ')}
          src={FLASH_TEASER_HERO_CDN}
          mode='aspectFill'
          onLoad={() => setHeroLoaded(true)}
          onError={() => setHeroFailed(true)}
          onClick={handleBoxTap}
          aria-hidden='true'
        />
      )}
      <View
        className={[
          'flash-teaser__glow',
          boxPulse ? 'flash-teaser__glow--pulse' : '',
        ].filter(Boolean).join(' ')}
        aria-hidden='true'
      />
      <View className='flash-teaser__particles' aria-hidden='true'>
        <View className='flash-teaser__particle flash-teaser__particle--1' />
        <View className='flash-teaser__particle flash-teaser__particle--2' />
        <View className='flash-teaser__particle flash-teaser__particle--3' />
      </View>

      <View className='flash-teaser__content'>
        <Text className='flash-teaser__pill'>内测中</Text>
        <Text className='flash-teaser__title'>盒子还没准备好</Text>
        <View className='flash-teaser__subtitle'>
          <Text className='flash-teaser__subtitle-line'>这座城市里藏着几位数字朋友</Text>
          <Text className='flash-teaser__subtitle-line'>内测结束，就来见你</Text>
        </View>
        <Text className='flash-teaser__promise'>正式上线时，第一时间告诉你</Text>
      </View>

      <View className='flash-teaser__footer'>
        <View
          className='flash-teaser__back'
          hoverClass='flash-teaser__back--pressed'
          onClick={handleBack}
          role='button'
          aria-label='返回发现页'
        >
          <Text className='flash-teaser__back-text'>再逛逛</Text>
        </View>
      </View>
    </View>
  )
}

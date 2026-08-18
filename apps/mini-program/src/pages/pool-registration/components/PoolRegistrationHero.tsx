import { View, Text, Image } from '@tarojs/components'
import { useCallback, useState } from 'react'
import { cdnAsset, useCdnFirstSrc } from '../../../lib/utils/cdnAssets'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import type { PoolEventType } from '../flowConfig'

// Primary source: CDN (fast once Tencent Cloud CDN is enabled).
// Fallback source: subpackage local copy for offline resilience.
const HERO_BASE_PATH = '/assets/ceremony/lovart-pool-registration-hero'
const DINING_HERO_CDN = cdnAsset(`${HERO_BASE_PATH}-dining-20260702-v2.webp`)
const DRINKS_HERO_CDN = cdnAsset(`${HERO_BASE_PATH}-drinks-20260702-v2.webp`)
const DINING_HERO_SUBPACKAGE = '/pages/pool-registration/assets/ceremony/lovart-pool-registration-hero-dining-20260702-v2.webp'
const DRINKS_HERO_SUBPACKAGE = '/pages/pool-registration/assets/ceremony/lovart-pool-registration-hero-drinks-20260702-v2.webp'

const HERO_ATTEMPTS = [
  (eventType: PoolEventType) => (eventType === '酒局' ? DRINKS_HERO_CDN : DINING_HERO_CDN),
  (eventType: PoolEventType) => (eventType === '酒局' ? DRINKS_HERO_SUBPACKAGE : DINING_HERO_SUBPACKAGE),
]

interface PoolRegistrationHeroProps {
  eventType: PoolEventType
  dateTimeLabel?: string
  area?: string
  price?: number | null
  registrationTotal: number
  /** Step 0 三拍化: the old standalone new-registrant banner is demoted to one
      compact meta pill in the meta band; parent applies the same delta/cooldown
      gating and passes the delta only when it should surface. */
  newRegistrantDelta?: number
  visible: boolean
}

function resolveHeroSrc(eventType: PoolEventType, attempt: number): string {
  const index = Math.max(0, Math.min(attempt, HERO_ATTEMPTS.length - 1))
  return HERO_ATTEMPTS[index](eventType)
}

export default function PoolRegistrationHero({
  eventType,
  dateTimeLabel,
  area,
  price,
  registrationTotal,
  newRegistrantDelta,
  visible,
}: PoolRegistrationHeroProps) {
  const calendarIcon = useCdnFirstSrc('/assets/icons/ui/icon-calendar.webp')
  const locationIcon = useCdnFirstSrc('/assets/icons/ui/icon-location.webp')
  const deviceTier = useDeviceTier()
  // Attempt index: 0 = CDN, 1 = subpackage local, 2+ = failed
  const [imageAttempt, setImageAttempt] = useState(0)
  const [imageLoaded, setImageLoaded] = useState(false)
  const heroSrc = resolveHeroSrc(eventType, imageAttempt)

  const showAurora = imageAttempt >= HERO_ATTEMPTS.length
  const rootClasses = [
    'pool-registration-hero',
    visible ? 'pool-registration-hero--visible' : 'pool-registration-hero--hidden',
    deviceTier.isDegradation ? 'pool-registration-hero--low-end' : '',
  ].join(' ')

  const seatsText = registrationTotal > 0 ? `${registrationTotal} 人已报名` : '等你加入'

  const handleImageError = useCallback(() => {
    setImageAttempt((prev) => Math.min(prev + 1, HERO_ATTEMPTS.length))
  }, [])

  return (
    <View className={rootClasses}>
      <View className='pool-registration-hero__frame'>
        {!imageLoaded && (
          <View className='pool-registration-hero__skeleton' aria-hidden>
            <View className='pool-registration-hero__skeleton-shimmer' />
          </View>
        )}

        {showAurora ? (
          <View className='pool-registration-hero__aurora'>
            <View className='pool-registration-hero__aurora-orb pool-registration-hero__aurora-orb--1' />
            <View className='pool-registration-hero__aurora-orb pool-registration-hero__aurora-orb--2' />
            <View className='pool-registration-hero__aurora-orb pool-registration-hero__aurora-orb--3' />
          </View>
        ) : (
          <Image
            className='pool-registration-hero__image'
            src={heroSrc}
            mode='widthFix'
            style={{ width: '100%' }}
            lazyLoad={false}
            aria-label={`${eventType}邀请图`}
            onLoad={() => setImageLoaded(true)}
            onError={handleImageError}
          />
        )}

        <View className='pool-registration-hero__scrim' />
        <View className='pool-registration-hero__scrim-left' />

        <View className='pool-registration-hero__top-chrome'>
          <View className='pool-registration-hero__badge'>
            <Text className='pool-registration-hero__badge-text'>{eventType}</Text>
          </View>

          <View className='pool-registration-hero__seats-pill' aria-label={seatsText}>
            <Text className='pool-registration-hero__seats-text'>{seatsText}</Text>
          </View>
        </View>

        <View className='pool-registration-hero__meta-band'>
          {dateTimeLabel ? (
            <View className='pool-registration-hero__meta-pill' aria-label={`时间：${dateTimeLabel}`}>
              <Image
                className='pool-registration-hero__meta-icon'
                src={calendarIcon.src}
                mode='aspectFit'
                onError={calendarIcon.onError}
              />
              <Text className='pool-registration-hero__meta-text'>{dateTimeLabel}</Text>
            </View>
          ) : null}
          {area ? (
            <View className='pool-registration-hero__meta-pill' aria-label={`地区：${area}`}>
              <Image
                className='pool-registration-hero__meta-icon'
                src={locationIcon.src}
                mode='aspectFit'
                onError={locationIcon.onError}
              />
              <Text className='pool-registration-hero__meta-text'>{area}</Text>
            </View>
          ) : null}
          {typeof price === 'number' && price > 0 ? (
            <View className='pool-registration-hero__meta-pill' aria-label={`报名费：${price} 元`}>
              <Text className='pool-registration-hero__meta-currency'>¥</Text>
              <Text className='pool-registration-hero__meta-text'>{price}</Text>
            </View>
          ) : null}
          {typeof newRegistrantDelta === 'number' && newRegistrantDelta > 0 ? (
            <View
              className='pool-registration-hero__meta-pill pool-registration-hero__meta-pill--accent'
              aria-label={`最近新增 ${newRegistrantDelta} 位`}
            >
              <Text className='pool-registration-hero__meta-text pool-registration-hero__meta-text--accent'>
                最近新增 {newRegistrantDelta} 位
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}

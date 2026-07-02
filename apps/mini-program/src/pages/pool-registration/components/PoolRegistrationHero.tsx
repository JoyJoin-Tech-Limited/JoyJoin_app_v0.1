import { View, Text, Image } from '@tarojs/components'
import { useCallback, useMemo, useState } from 'react'
import { getArchetypeTokens } from '@shared/archetypeColorTokens'
import { cdnAsset, localAsset, useCdnFirstSrc } from '../../../lib/utils/cdnAssets'
import ArchetypeHead from '../../../components/mascot/ArchetypeHead'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import type { PoolEventType } from '../flowConfig'
import './PoolRegistrationHero.scss'

// Primary source: CDN (fast once Tencent Cloud CDN is enabled).
// Fallback source: main-package local copy that survives clean:cdn-assets.
// Subpackage local copy is kept as a tertiary fallback for offline resilience.
const HERO_BASE_PATH = '/assets/ceremony/lovart-pool-registration-hero'
const DINING_HERO_CDN = cdnAsset(`${HERO_BASE_PATH}-dining-20260702-v2.webp`)
const DRINKS_HERO_CDN = cdnAsset(`${HERO_BASE_PATH}-drinks-20260702-v2.webp`)
const DINING_HERO_LOCAL = localAsset('/assets/ceremony/lovart-pool-registration-hero-dining-20260702-v2.webp')
const DRINKS_HERO_LOCAL = localAsset('/assets/ceremony/lovart-pool-registration-hero-drinks-20260702-v2.webp')
const DINING_HERO_SUBPACKAGE = '/pages/pool-registration/assets/ceremony/lovart-pool-registration-hero-dining-20260702-v2.webp'
const DRINKS_HERO_SUBPACKAGE = '/pages/pool-registration/assets/ceremony/lovart-pool-registration-hero-drinks-20260702-v2.webp'

const HERO_ATTEMPTS = [
  (eventType: PoolEventType) => (eventType === '酒局' ? DRINKS_HERO_CDN : DINING_HERO_CDN),
  (eventType: PoolEventType) => (eventType === '酒局' ? DRINKS_HERO_LOCAL : DINING_HERO_LOCAL),
  (eventType: PoolEventType) => (eventType === '酒局' ? DRINKS_HERO_SUBPACKAGE : DINING_HERO_SUBPACKAGE),
]

const MAX_COMPACT_HEADS = 5
const SEAT_HEAD_SIZE = 48

interface PoolRegistrationHeroProps {
  eventType: PoolEventType
  dateTimeLabel?: string
  area?: string
  price?: number | null
  registrationTotal: number
  sampleArchetypes?: string[]
  visible: boolean
  reduceMotion: boolean
}

function resolveHeroSrc(eventType: PoolEventType, attempt: number): string {
  const index = Math.max(0, Math.min(attempt, HERO_ATTEMPTS.length - 1))
  return HERO_ATTEMPTS[index](eventType)
}

function SeatHeads({
  sampleArchetypes,
  visible,
  reduceMotion,
}: {
  sampleArchetypes?: string[]
  visible: boolean
  reduceMotion: boolean
}) {
  const compactHeads = useMemo(() => {
    const archetypes = sampleArchetypes ?? []
    if (!archetypes.length) return []
    const counts = new Map<string, number>()
    for (const a of archetypes) {
      counts.set(a, (counts.get(a) ?? 0) + 1)
    }
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key)
    return sorted.slice(0, MAX_COMPACT_HEADS)
  }, [sampleArchetypes])

  const hasOverflow = (sampleArchetypes?.length ?? 0) > MAX_COMPACT_HEADS

  if (compactHeads.length === 0) {
    return (
      <View className='pool-registration-hero__seat-empty'>
        <Text className='pool-registration-hero__seat-empty-text'>等你加入</Text>
      </View>
    )
  }

  return (
    <>
      {compactHeads.map((key, index) => {
        const tokens = getArchetypeTokens(key)
        const delayClass =
          visible && !reduceMotion
            ? `pool-registration-hero__seat-head--delay-${Math.min(index, 4)}`
            : ''
        return (
          <View
            key={key}
            className={['pool-registration-hero__seat-head', delayClass].join(' ')}
            style={{
              borderColor: tokens.primary,
              backgroundColor: tokens.background,
              zIndex: compactHeads.length - index,
            }}
          >
            <ArchetypeHead archetype={key} size={SEAT_HEAD_SIZE} variant='grid' />
          </View>
        )
      })}
      {hasOverflow ? (
        <View className='pool-registration-hero__seat-overflow'>
          <Text className='pool-registration-hero__seat-overflow-text'>+</Text>
        </View>
      ) : null}
    </>
  )
}

export default function PoolRegistrationHero({
  eventType,
  dateTimeLabel,
  area,
  price,
  registrationTotal,
  sampleArchetypes,
  visible,
  reduceMotion,
}: PoolRegistrationHeroProps) {
  const calendarIcon = useCdnFirstSrc('/assets/icons/ui/icon-calendar.webp')
  const locationIcon = useCdnFirstSrc('/assets/icons/ui/icon-location.webp')
  const deviceTier = useDeviceTier()
  // Attempt index: 0 = CDN, 1 = main-package local, 2 = subpackage local, 3+ = failed
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
            <View className='pool-registration-hero__seats-heads'>
              <SeatHeads sampleArchetypes={sampleArchetypes} visible={visible} reduceMotion={reduceMotion} />
            </View>
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
        </View>
      </View>
    </View>
  )
}

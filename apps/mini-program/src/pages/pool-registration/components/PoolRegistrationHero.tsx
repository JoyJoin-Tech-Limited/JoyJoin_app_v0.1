import { View, Text, Image } from '@tarojs/components'
import { useMemo, useState } from 'react'
import { getArchetypeTokens } from '@shared/archetypeColorTokens'
import { localAsset } from '../../../lib/utils/cdnAssets'
import ArchetypeHead from '../../../components/mascot/ArchetypeHead'
import type { PoolEventType } from '../flowConfig'
import './PoolRegistrationHero.scss'

const DINING_HERO_SRC = localAsset('/assets/ceremony/pool-registration/lovart-pool-registration-hero-dining-20260613-v1.webp')
const DRINKS_HERO_SRC = localAsset('/assets/ceremony/pool-registration/lovart-pool-registration-hero-drinks-20260613-v1.webp')

const MAX_COMPACT_HEADS = 5
const SEAT_HEAD_SIZE = 40

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

function resolveHeroSrc(eventType: PoolEventType): string {
  return eventType === '酒局' ? DRINKS_HERO_SRC : DINING_HERO_SRC
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
  const [imageFailed, setImageFailed] = useState(false)
  const heroSrc = resolveHeroSrc(eventType)

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

  const showAurora = imageFailed
  const rootClasses = [
    'pool-registration-hero',
    visible ? (reduceMotion ? 'pool-registration-hero--visible' : 'pool-registration-hero--enter') : 'pool-registration-hero--hidden',
  ].join(' ')

  return (
    <View className={rootClasses}>
      <View className='pool-registration-hero__frame'>
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
            mode='aspectFill'
            lazyLoad={false}
            aria-label={`${eventType}邀请图`}
            onError={() => setImageFailed(true)}
          />
        )}

        <View className='pool-registration-hero__scrim' />

        <View className='pool-registration-hero__badge'>
          <Text className='pool-registration-hero__badge-text'>{eventType}</Text>
        </View>

        <View className='pool-registration-hero__meta-band'>
          {dateTimeLabel ? (
            <View className='pool-registration-hero__meta-pill' aria-label={`时间：${dateTimeLabel}`}>
              <Image
                className='pool-registration-hero__meta-icon'
                src={localAsset('/assets/icons/ui/icon-calendar.webp')}
                mode='aspectFit'
              />
              <Text className='pool-registration-hero__meta-text'>{dateTimeLabel}</Text>
            </View>
          ) : null}
          {area ? (
            <View className='pool-registration-hero__meta-pill' aria-label={`地区：${area}`}>
              <Image
                className='pool-registration-hero__meta-icon'
                src={localAsset('/assets/icons/ui/icon-location.webp')}
                mode='aspectFit'
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

          <View className='pool-registration-hero__seats'>
            <View className='pool-registration-hero__seats-heads'>
              {compactHeads.length > 0 ? (
                <>
                  {compactHeads.map((key, index) => {
                    const tokens = getArchetypeTokens(key)
                    const delayClass = visible && !reduceMotion ? `pool-registration-hero__seat-head--delay-${Math.min(index, 4)}` : ''
                    return (
                      <View
                        key={key + index}
                        className={['pool-registration-hero__seat-head', delayClass].join(' ')}
                        style={{
                          borderColor: tokens.primary,
                          backgroundColor: tokens.background,
                          zIndex: compactHeads.length - index,
                        }}
                      >
                        <ArchetypeHead archetype={key} size={SEAT_HEAD_SIZE} />
                      </View>
                    )
                  })}
                  {hasOverflow ? (
                    <View className='pool-registration-hero__seat-overflow'>
                      <Text className='pool-registration-hero__seat-overflow-text'>+</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <View className='pool-registration-hero__seat-dot' />
              )}
            </View>
            <Text className='pool-registration-hero__seats-text'>
              {registrationTotal > 0 ? `${registrationTotal} 人已报名` : '等你加入'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

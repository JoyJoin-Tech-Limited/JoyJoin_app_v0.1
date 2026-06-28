import { View, Text, Image } from '@tarojs/components'
import { useState, useCallback, useMemo } from 'react'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import type { PoolGroupMemberSummary } from '@shared/api'
import type { PairExplanation } from '@shared/types/groupAnalysis'
import { ARCHETYPE_ASSET_MAP } from '../../lib/utils/archetypeAssets'
import MissingArchetypePlaceholder from '../../components/mascot/MissingArchetypePlaceholder'
import ConnectionPointPill from '../../components/ConnectionPointPill'
import { haptics } from '../../lib/utils/haptics'

export interface TeammateCardProps {
  member: PoolGroupMemberSummary
  viewerPair?: PairExplanation | null
  index: number
  total: number
  focused: boolean
  isCurrentUser: boolean
  reduceMotion: boolean
  isDegradation: boolean
  onFocus: () => void
}

function getConnectionPoints(pair?: PairExplanation | null) {
  if (!pair) return []
  if (pair.connectionPointsWithRarity && pair.connectionPointsWithRarity.length > 0) {
    return pair.connectionPointsWithRarity.slice(0, 2)
  }
  if (pair.connectionPoints && pair.connectionPoints.length > 0) {
    return pair.connectionPoints.slice(0, 2).map((text) => ({ text, rarity: 'common' as const }))
  }
  return []
}

function getArchetypeAssetUrl(archetype?: string | null): string | undefined {
  if (!archetype) return undefined
  return ARCHETYPE_ASSET_MAP[archetype]?.webp
}

function getMemberName(member: PoolGroupMemberSummary): string {
  return member.displayName || '匿名'
}

function getArchetypeDisplayName(archetype?: string | null): string {
  if (!archetype) return ''
  return ARCHETYPE_BY_ID[archetype]?.nameCn || archetype
}

export default function TeammateCard({
  member,
  viewerPair,
  index,
  total,
  focused,
  isCurrentUser,
  reduceMotion,
  isDegradation,
  onFocus,
}: TeammateCardProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const handleImageError = useCallback(() => setImageError(true), [])
  const handleImageLoad = useCallback(() => setImageLoaded(true), [])

  const name = getMemberName(member)
  const archetypeName = getArchetypeDisplayName(member.archetype)
  const connectionPoints = useMemo(() => getConnectionPoints(viewerPair), [viewerPair])
  const hasConnectionReason = Boolean(viewerPair?.explanation)

  const assetUrl = getArchetypeAssetUrl(member.archetype)
  const showPlaceholder = !member.archetype || imageError

  const handleTap = useCallback(() => {
    haptics('light')
    onFocus()
  }, [onFocus])

  // Fan geometry: center card is 0°, step size shrinks as group grows.
  const step = total <= 1 ? 0 : Math.min(14, 48 / total)
  const baseRotation = (index - (total - 1) / 2) * step
  const baseTranslateX = (index - (total - 1) / 2) * (total <= 3 ? 28 : 18)
  const baseTranslateY = Math.abs(baseRotation) * 1.4

  // Focused state lifts the card and centers it.
  const focusRotation = focused ? 0 : baseRotation
  const focusTranslateX = focused ? 0 : baseTranslateX
  const focusTranslateY = focused ? (isDegradation ? -8 : -24) : baseTranslateY
  const focusScale = focused ? (isDegradation ? 1.02 : 1.06) : 1
  const focusZIndex = focused ? 50 : total - Math.abs(index - Math.floor(total / 2))

  const transform = `translate3d(${focusTranslateX}rpx, ${focusTranslateY}rpx, 0) rotate(${focusRotation}deg) scale(${focusScale})`

  const transitionDuration = reduceMotion ? '0ms' : isDegradation ? '180ms' : '320ms'

  return (
    <View
      className={[
        'squad-unboxing__deck-card',
        focused ? 'squad-unboxing__deck-card--focused' : '',
        isCurrentUser ? 'squad-unboxing__deck-card--current' : '',
        reduceMotion ? 'squad-unboxing__deck-card--reduce-motion' : '',
        isDegradation ? 'squad-unboxing__deck-card--degradation' : '',
      ].filter(Boolean).join(' ')}
      style={{
        transform,
        zIndex: focusZIndex,
        transitionDuration,
      }}
      onClick={handleTap}
      hoverClass='squad-unboxing__deck-card--pressed'
      role='listitem'
      aria-label={`${name}${archetypeName ? `，${archetypeName}` : ''}${isCurrentUser ? '（我）' : ''}`}
    >
      <View className='squad-unboxing__deck-card-inner'>
        {isCurrentUser ? (
          <View className='squad-unboxing__deck-card-current-badge'>
            <Text className='squad-unboxing__deck-card-current-badge-text'>我</Text>
          </View>
        ) : null}

        <View className='squad-unboxing__deck-card-art-wrap'>
          {showPlaceholder ? (
            <MissingArchetypePlaceholder size={180} className='squad-unboxing__deck-card-placeholder' />
          ) : (
            <>
              {!imageLoaded ? (
                <View className='squad-unboxing__deck-card-art-skeleton' />
              ) : null}
              {assetUrl ? (
                <Image
                  className='squad-unboxing__deck-card-art'
                  src={assetUrl}
                  mode='aspectFit'
                  lazyLoad={false}
                  onError={handleImageError}
                  onLoad={handleImageLoad}
                  aria-hidden='true'
                />
              ) : null}
            </>
          )}
        </View>

        <View className='squad-unboxing__deck-card-content'>
          <Text className='squad-unboxing__deck-card-name'>{name}</Text>
          {archetypeName ? (
            <Text className='squad-unboxing__deck-card-archetype'>{archetypeName}</Text>
          ) : null}

          {connectionPoints.length > 0 ? (
            <View className='squad-unboxing__deck-card-pills'>
              {connectionPoints.map((point) => (
                <ConnectionPointPill key={point.text} text={point.text} rarity={point.rarity} />
              ))}
            </View>
          ) : hasConnectionReason ? (
            <Text className='squad-unboxing__deck-card-reason' numberOfLines={2}>
              {viewerPair?.explanation}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  )
}

import { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { useState, useCallback, useMemo } from 'react'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { getArchetypeHSL, formatHSLAsRGBA } from '@shared/archetypeColors'
import type { PoolGroupMemberSummary } from '@shared/api'
import type { PairExplanation } from '@shared/types/groupAnalysis'
import { normalizeMatchingCopy } from '@shared/features/matching-status'
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
  anyFocused: boolean
  isCurrentUser: boolean
  isRevealed: boolean
  emergeComplete: boolean
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
  return ARCHETYPE_BY_ID[archetype]?.nameCn || '神秘伙伴'
}

export default function TeammateCard({
  member,
  viewerPair,
  index,
  total,
  focused,
  anyFocused,
  isCurrentUser,
  isRevealed,
  emergeComplete,
  reduceMotion,
  isDegradation,
  onFocus,
}: TeammateCardProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
  useDidShow(() => setIsFlipped(false))

  const handleImageError = useCallback(() => setImageError(true), [])
  const handleImageLoad = useCallback(() => setImageLoaded(true), [])

  const name = getMemberName(member)
  const archetypeName = getArchetypeDisplayName(member.archetype)
  const connectionPoints = useMemo(() => getConnectionPoints(viewerPair), [viewerPair])
  const connectionReason = useMemo(() => normalizeMatchingCopy(viewerPair?.explanation), [viewerPair?.explanation])
  const hasConnectionReason = connectionReason.length > 0

  const assetUrl = getArchetypeAssetUrl(member.archetype)
  const showPlaceholder = !member.archetype || imageError

  const handleTap = useCallback(() => {
    if (isRevealed) {
      haptics('light')
      setIsFlipped((prev) => !prev)
      onFocus()
    }
  }, [isRevealed, onFocus])

  const handleLongPress = useCallback(() => {
    if (isRevealed) {
      haptics('medium')
      setIsFlipped(true)
      onFocus()
    }
  }, [isRevealed, onFocus])

  const step = total <= 1 ? 0 : Math.min(14, 48 / total)
  const baseRotation = (index - (total - 1) / 2) * step
  // Count-responsive fan: spread cards so every card exposes a tappable leading
  // edge (>= FAN_STEP_MIN_RPX) without overflowing the ~600rpx deck for up to 8
  // members. The previous fixed step (total<=3 ? 32 : 22) left cards ~85%
  // overlapped, so only the top card was reachable (Bug 3).
  const CARD_WIDTH_RPX = 220
  const USABLE_FAN_WIDTH_RPX = 560
  const FAN_STEP_MIN_RPX = 48
  const FAN_STEP_MAX_RPX = 90
  const fanStep = total <= 1
    ? 0
    : Math.max(
        FAN_STEP_MIN_RPX,
        Math.min(
          FAN_STEP_MAX_RPX,
          (USABLE_FAN_WIDTH_RPX - CARD_WIDTH_RPX) / Math.max(1, total - 1),
        ),
      )
  const baseTranslateX = (index - (total - 1) / 2) * fanStep
  const baseTranslateY = -Math.abs(baseRotation) * 1.0

  const focusRotation = focused ? 0 : baseRotation
  const focusTranslateX = focused ? 0 : baseTranslateX
  const focusTranslateY = focused ? (isDegradation ? -10 : -32) : baseTranslateY
  const focusScale = focused ? (isDegradation ? 1.04 : 1.07) : 1
  const focusZIndex = focused ? 50 : total - Math.abs(index - Math.floor(total / 2))
  const isDimmed = anyFocused && !focused

  const startTransform = 'translate3d(-50%, 120rpx, 0) scale(0.5) rotate(0deg)'
  const restTransform = `translate3d(${focusTranslateX}rpx, ${focusTranslateY}rpx, 0) rotate(${focusRotation}deg) scale(${focusScale})`
  const transform = isRevealed ? restTransform : startTransform
  const opacity = isRevealed ? (isDimmed ? 0.55 : 1) : 0
  const emergeDelayMs = reduceMotion ? 0 : 280 + index * 50
  const transitionDuration = reduceMotion ? 0 : emergeComplete ? 320 : 550

  const archetypeAccent = useMemo(() => {
    const hsl = getArchetypeHSL(member.archetype)
    return {
      borderColor: formatHSLAsRGBA(hsl, 0.28),
      background: formatHSLAsRGBA(hsl, 0.08),
      shadow: formatHSLAsRGBA(hsl, 0.18),
      radialStart: formatHSLAsRGBA(hsl, 0.92),
      radialEnd: formatHSLAsRGBA(hsl, 0.62),
      edgeHighlight: formatHSLAsRGBA({ ...hsl, l: Math.min(100, hsl.l + 18) }, 0.45),
    }
  }, [member.archetype])

  const backFaceStyle = useMemo(
    () => ({
      background: `radial-gradient(140% 140% at 30% 20%, ${archetypeAccent.radialStart} 0%, ${archetypeAccent.radialEnd} 100%)`,
      boxShadow: `inset 0 0 0 1rpx ${archetypeAccent.edgeHighlight}`,
    }),
    [archetypeAccent],
  )

  const focusBoxShadow = focused ? `0 28rpx 64rpx ${archetypeAccent.shadow}` : undefined

  return (
    <View
      className={[
        'squad-unboxing__deck-card',
        focused ? 'squad-unboxing__deck-card--focused' : '',
        isDimmed ? 'squad-unboxing__deck-card--dimmed' : '',
        isCurrentUser ? 'squad-unboxing__deck-card--current' : '',
        isFlipped ? 'squad-unboxing__deck-card--flipped' : '',
        reduceMotion ? 'squad-unboxing__deck-card--reduce-motion' : '',
        isDegradation ? 'squad-unboxing__deck-card--degradation' : '',
      ].filter(Boolean).join(' ')}
      style={{
        transform,
        opacity,
        zIndex: focusZIndex,
        transitionDuration: `${transitionDuration}ms`,
        transitionDelay: `${emergeDelayMs}ms`,
        borderColor: archetypeAccent.borderColor,
        backgroundColor: archetypeAccent.background,
        boxShadow: focusBoxShadow,
      }}
      onClick={handleTap}
      onLongPress={handleLongPress}
      hoverClass='squad-unboxing__deck-card--pressed'
      role='listitem'
      aria-label={`${name}${archetypeName ? `，${archetypeName}` : ''}${isCurrentUser ? '（我）' : ''}`}
    >
      <View className='squad-unboxing__deck-card-inner'>
        <View
          className='squad-unboxing__deck-card-face squad-unboxing__deck-card-face--back'
          style={backFaceStyle}
        >
          {isCurrentUser ? (
            <View className='squad-unboxing__deck-card-current-badge'>
              <Text className='squad-unboxing__deck-card-current-badge-text'>我</Text>
            </View>
          ) : null}
          <View className='squad-unboxing__deck-card-back-art'>
            <View className='squad-unboxing__deck-card-back-shine' />
          </View>
        </View>

        <View className='squad-unboxing__deck-card-face squad-unboxing__deck-card-face--front'>
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
                {connectionReason}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  )
}

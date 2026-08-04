import { View, Text, Image } from '@tarojs/components'
import { useCallback, useMemo, useState } from 'react'
import { useCdnFirstSrc } from '../../lib/utils/cdnAssets'
import { ARCHETYPE_ASSET_MAP, ASSET_BASE_WEBP_LOCAL } from '../../lib/utils/archetypeAssets'
import { getArchetypeVisual } from '../../pages/onboarding/personality-test/visuals'
import './ProfileReviewInviteCard.scss'

export interface ProfileReviewInviteCardProps {
  /** The user's archetype id — rendered at the radar center. */
  archetypeId?: string
  /** Used for the accessibility label. */
  displayName?: string
  /** Top interest label (e.g. first 必聊项), omitted when absent. */
  topInterestLabel?: string | null
  /** Primary intent label, omitted when absent. */
  intentLabel?: string | null
  /** Additional class names. */
  className?: string
  /** Whether the card is visible (controls entrance + radar pop-in). */
  visible?: boolean
  /** Whether motion is reduced. */
  reduceMotion?: boolean
}

const INVITE_IMAGE_PATH = '/assets/lovart/profile-review/invite-teaser.webp'

/** Registry order drives the deterministic satellite selection. */
const ARCHETYPE_IDS = Object.keys(ARCHETYPE_ASSET_MAP)

/** Base satellite angles (degrees); rotated per user so layouts differ. */
const SATELLITE_ANGLES = [25, 115, 205, 295]
/** Orbit radius as a fraction of the disc size (92rpx on a 264rpx disc).
 *  Percentage positioning lets the whole radar scale under media queries. */
const ORBIT_RATIO = 92 / 264

/** Local bundled icon path — zero CDN dependency inside the subpackage. */
function getLocalArchetypeIcon(id: string): string {
  return `${ASSET_BASE_WEBP_LOCAL}/archetype-${id}.webp`
}

/**
 * Profile-review summary card: full-bleed Lovart banner with a playful
 * "kindred radar" — the user's archetype sits at the center while four other
 * archetypes pop in around it. Display-only summary; the screen's primary CTA
 * remains the single completion path.
 */
export default function ProfileReviewInviteCard({
  archetypeId = '',
  displayName = '',
  topInterestLabel = null,
  intentLabel = null,
  className = '',
  visible = true,
  reduceMotion = false,
}: ProfileReviewInviteCardProps): JSX.Element {
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const [imageErrorCount, setImageErrorCount] = useState(0)

  const visual = useMemo(() => getArchetypeVisual(archetypeId || null), [archetypeId])
  const hasKnownArchetype = Boolean(archetypeId) && ARCHETYPE_IDS.includes(archetypeId)

  const satellites = useMemo(() => {
    if (!hasKnownArchetype) return []
    const userIndex = ARCHETYPE_IDS.indexOf(archetypeId)
    const rotation = userIndex * 30
    return SATELLITE_ANGLES.map((baseAngle, index) => {
      const id = ARCHETYPE_IDS[(userIndex + index + 1) % ARCHETYPE_IDS.length]
      const rad = ((baseAngle + rotation) * Math.PI) / 180
      return {
        id,
        left: `${50 + ORBIT_RATIO * 100 * Math.cos(rad)}%`,
        top: `${50 + ORBIT_RATIO * 100 * Math.sin(rad)}%`,
        // Pop-in: +500ms after the card lands, then 140ms stagger.
        popDelay: 0.5 + index * 0.14,
        // Gentle continuous float, offset per satellite so they drift in waves.
        floatDelay: index * 0.45,
      }
    })
  }, [archetypeId, hasKnownArchetype])

  const summaryParts: string[] = []
  if (hasKnownArchetype && visual.name) summaryParts.push(visual.name)
  if (topInterestLabel) summaryParts.push(`热衷${topInterestLabel}`)
  if (intentLabel) summaryParts.push(`想${intentLabel}`)
  const summaryLine = summaryParts.length > 0 ? summaryParts.join(' · ') : visual.tagline

  const { src: imageSrc, onError: onImageError, isLocal } = useCdnFirstSrc(INVITE_IMAGE_PATH)
  const hasImageError = imageErrorCount >= 2 || (imageErrorCount >= 1 && isLocal)

  const handleImageLoad = useCallback(() => {
    setIsImageLoaded(true)
  }, [])

  const handleImageError = useCallback(() => {
    setImageErrorCount((count) => {
      const next = count + 1
      if (next === 1) {
        // First failure: CDN path failed. Trigger useCdnFirstSrc local fallback.
        onImageError()
      }
      return next
    })
  }, [onImageError])

  const rootClass = [
    'profile-review-invite-card',
    visible ? 'profile-review-invite-card--visible' : '',
    reduceMotion ? 'profile-review-invite-card--reduce-motion' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const ariaLabel = [
    displayName ? `${displayName}的入场卡摘要` : '入场卡摘要',
    hasKnownArchetype ? `原型${visual.name}` : '',
    topInterestLabel ? `热衷${topInterestLabel}` : '',
    intentLabel ? `想${intentLabel}` : '',
  ]
    .filter(Boolean)
    .join('，')

  return (
    <View className={rootClass} role='img' aria-label={ariaLabel}>
      {/* Full-bleed Lovart banner. On total failure the card keeps its flat
          cream background — the radar (all-local assets) carries the visual. */}
      <View className='profile-review-invite-card__bg' aria-hidden='true'>
        {!isImageLoaded && !hasImageError ? (
          <View className='profile-review-invite-card__bg-shimmer' />
        ) : null}
        {!hasImageError ? (
          <Image
            className={[
              'profile-review-invite-card__bg-image',
              isImageLoaded ? 'profile-review-invite-card__bg-image--loaded' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            src={imageSrc}
            mode='aspectFill'
            lazyLoad={false}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        ) : null}
      </View>
      <View className='profile-review-invite-card__scrim' aria-hidden='true' />

      <View className='profile-review-invite-card__radar' aria-hidden='true'>
        <View className='profile-review-invite-card__radar-disc' />
        <View className='profile-review-invite-card__radar-ring profile-review-invite-card__radar-ring--outer' />
        <View className='profile-review-invite-card__radar-ring profile-review-invite-card__radar-ring--inner' />
        <View className='profile-review-invite-card__radar-sweep' />
        <View className='profile-review-invite-card__radar-wave profile-review-invite-card__radar-wave--one' />
        <View className='profile-review-invite-card__radar-wave profile-review-invite-card__radar-wave--two' />

        {satellites.map((satellite) => (
          <View
            key={satellite.id}
            className='profile-review-invite-card__radar-satellite'
            style={{
              left: satellite.left,
              top: satellite.top,
              animationDelay: reduceMotion ? '0s' : `${satellite.popDelay}s`,
            }}
          >
            <View
              className='profile-review-invite-card__radar-satellite-float'
              style={{ animationDelay: reduceMotion ? '0s' : `${satellite.floatDelay}s` }}
            >
              <Image
                className='profile-review-invite-card__radar-satellite-icon'
                src={getLocalArchetypeIcon(satellite.id)}
                mode='aspectFit'
                lazyLoad={false}
              />
            </View>
          </View>
        ))}

        {hasKnownArchetype ? (
          <View className='profile-review-invite-card__radar-center'>
            <View
              className='profile-review-invite-card__radar-center-ring'
              style={{ borderColor: visual.accentBorder }}
            >
              <Image
                className='profile-review-invite-card__radar-center-icon'
                src={getLocalArchetypeIcon(archetypeId)}
                mode='aspectFit'
                lazyLoad={false}
              />
            </View>
            <Text
              className='profile-review-invite-card__radar-center-name'
              style={{ color: visual.accentText, backgroundColor: visual.accentSoft }}
            >
              {visual.name}
            </Text>
          </View>
        ) : null}
      </View>

      <View className='profile-review-invite-card__copy'>
        <View className='profile-review-invite-card__voice-row'>
          <View className='profile-review-invite-card__spark-dot' aria-hidden='true' />
          <Text className='profile-review-invite-card__kicker'>入场卡摘要</Text>
        </View>
        <Text className='profile-review-invite-card__title'>你的同频雷达已就位</Text>
        {summaryLine ? (
          <Text className='profile-review-invite-card__summary'>{summaryLine}</Text>
        ) : null}
        <Text className='profile-review-invite-card__tagline'>同频的人，悦仔帮你留意着。</Text>
      </View>
    </View>
  )
}

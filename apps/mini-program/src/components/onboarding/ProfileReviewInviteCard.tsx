import { View, Text, Image } from '@tarojs/components'
import { useCallback, useState } from 'react'
import { useCdnFirstSrc } from '../../lib/utils/cdnAssets'
import { haptics } from '../../lib/utils/haptics'
import BrandLogo from '../ui/BrandLogo'
import './ProfileReviewInviteCard.scss'

export interface ProfileReviewInviteCardProps {
  /** Called when the user taps the card. */
  onTap?: () => void
  /** Additional class names. */
  className?: string
  /** Whether the card is visible (controls entrance animation). */
  visible?: boolean
  /** Whether motion is reduced. */
  reduceMotion?: boolean
  /** Whether the card is disabled (e.g. while the parent submission is in flight). */
  disabled?: boolean
  /** Whether the card shows a busy visual state. */
  busy?: boolean
}

const INVITE_IMAGE_PATH = '/assets/lovart/profile-review/invite-teaser.webp'

/**
 * Xiaoyue invitation teaser for the profile-review / 入场卡 screen.
 *
 * Warm recommendation card: mascot art + personalized copy + a gentle
 * secondary path that completes the onboarding flow.
 */
export default function ProfileReviewInviteCard({
  onTap,
  className = '',
  visible = true,
  reduceMotion = false,
  disabled = false,
  busy = false,
}: ProfileReviewInviteCardProps): JSX.Element {
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const [imageErrorCount, setImageErrorCount] = useState(0)

  const handleTap = () => {
    if (disabled || busy) return
    haptics('heavy')
    onTap?.()
  }

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
    disabled || busy ? 'profile-review-invite-card--disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View
      className={rootClass}
      onClick={handleTap}
      hoverClass={disabled || busy ? '' : 'profile-review-invite-card--pressed'}
      role='button'
      aria-label={disabled || busy ? '正在确认入场卡，请稍候' : '悦仔按你的兴趣挑了几个局，点击查看推荐'}
      aria-disabled={disabled || busy}
    >
      <View className='profile-review-invite-card__art'>
        {!isImageLoaded && !hasImageError ? (
          <View className='profile-review-invite-card__art-shimmer' aria-hidden='true' />
        ) : null}
        {hasImageError ? (
          <View className='profile-review-invite-card__art-fallback' aria-hidden='true'>
            <BrandLogo size='sm' ariaLabel='JoyJoin' />
          </View>
        ) : (
          <Image
            className={[
              'profile-review-invite-card__image',
              isImageLoaded ? 'profile-review-invite-card__image--loaded' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            src={imageSrc}
            mode='aspectFill'
            lazyLoad={false}
            onLoad={handleImageLoad}
            onError={handleImageError}
            aria-hidden='true'
          />
        )}
      </View>

      <View className='profile-review-invite-card__copy'>
        <View className='profile-review-invite-card__voice-row'>
          <View className='profile-review-invite-card__spark-dot' aria-hidden='true' />
          <Text className='profile-review-invite-card__title'>悦仔给你挑了几个局</Text>
        </View>
        <Text className='profile-review-invite-card__body'>
          确认后，悦仔会按你的热量地图，帮你挑最对味的局。
        </Text>
        <View className='profile-review-invite-card__hint'>
          <Text className='profile-review-invite-card__hint-text'>
            {busy ? '正在进入发现…' : '确认并进入发现'}
          </Text>
        </View>
      </View>
    </View>
  )
}

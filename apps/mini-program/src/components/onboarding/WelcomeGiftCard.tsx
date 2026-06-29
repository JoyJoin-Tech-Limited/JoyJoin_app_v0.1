import { View, Text, Image } from '@tarojs/components'
import { useCdnFirstSrc } from '../../lib/utils/cdnAssets'
import { haptics } from '../../lib/utils/haptics'
import './WelcomeGiftCard.scss'

export interface WelcomeGiftCardProps {
  /** Coupon discount value, e.g. 50 for a 50% coupon. */
  discountValue: number
  /** Called when the user taps the card. */
  onTap?: () => void
  /** Additional class names. */
  className?: string
  /** Whether the card is visible (controls entrance animation). */
  visible?: boolean
  /** Whether motion is reduced. */
  reduceMotion?: boolean
}

const COUPON_IMAGE_PATH = '/assets/lovart/gift-card/coupon.webp'

function formatBadgeLabel(discountValue: number): string {
  if (discountValue > 0 && discountValue <= 100) {
    const zhe = Math.round((100 - discountValue) / 10)
    if (zhe >= 1 && zhe <= 9) {
      return `${zhe}折`
    }
  }
  return `${discountValue}`
}

/**
 * Premium welcome-gift card for the profile-review / 入场卡 screen.
 *
 * Renders the Lovart coupon illustration as a full-bleed card, with copy
 * overlaid on the right-hand framed area. Designed to drive discover-page
 * conversion by surfacing the lifetime welcome coupon at the emotional peak
 * of onboarding.
 */
export default function WelcomeGiftCard({
  discountValue,
  onTap,
  className = '',
  visible = true,
  reduceMotion = false,
}: WelcomeGiftCardProps): JSX.Element {
  const handleTap = () => {
    haptics('light')
    onTap?.()
  }

  const badgeLabel = formatBadgeLabel(discountValue)
  const { src: imageSrc, onError: onImageError } = useCdnFirstSrc(COUPON_IMAGE_PATH)

  const rootClass = [
    'welcome-gift-card',
    visible ? 'welcome-gift-card--visible' : '',
    reduceMotion ? 'welcome-gift-card--reduce-motion' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View
      className={rootClass}
      onClick={handleTap}
      hoverClass='welcome-gift-card--pressed'
      role='button'
      aria-label={`悦仔见面礼，送你一张 ${badgeLabel} 券，报名可用`}
    >
      <View className='welcome-gift-card__placeholder' />
      <Image
        className='welcome-gift-card__image'
        src={imageSrc}
        mode='aspectFill'
        lazyLoad={false}
        onError={onImageError}
        aria-hidden='true'
      />

      <View className='welcome-gift-card__overlay'>
        <Text className='welcome-gift-card__eyebrow'>悦仔见面礼</Text>
        <Text className='welcome-gift-card__title'>送你一张 {badgeLabel} 券</Text>
        <Text className='welcome-gift-card__body'>
          首场局，轻松开场。收下它，去发现页看看今晚有什么在等你。
        </Text>
        <View className='welcome-gift-card__hint'>
          <Text className='welcome-gift-card__hint-text'>报名可用</Text>
        </View>
      </View>
    </View>
  )
}

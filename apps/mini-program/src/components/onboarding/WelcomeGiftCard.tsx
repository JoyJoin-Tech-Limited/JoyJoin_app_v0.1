import { View, Text, Image } from '@tarojs/components'
import { useCdnFirstSrc } from '../../lib/utils/cdnAssets'
import { formatCouponValidUntilLabel } from '../../lib/utils/couponValidity'
import { haptics } from '../../lib/utils/haptics'
import './WelcomeGiftCard.scss'

export interface WelcomeGiftCardProps {
  /**
   * Coupon discount value, e.g. 50 for a 50% coupon; cents for
   * `fixed_amount` (canonical 见面礼 WELCOME20 = 2000 → 20元).
   */
  discountValue?: number
  /**
   * Wire discount type. `fixed_amount` renders whole yuan; absent/percentage
   * keeps the legacy 折 rendering.
   */
  discountType?: string | null
  /**
   * Coupon expiry (ISO-8601, from the grant response's `validUntil`). When
   * present, renders a small 「有效期至 M月D日」 caption; when absent, nothing
   * is rendered (fail-closed). Audit F5.
   */
  validUntil?: string | null
  /** Called when the user taps the card. */
  onTap?: () => void
  /** Additional class names. */
  className?: string
  /** Whether the card is visible (controls entrance animation). */
  visible?: boolean
  /** Whether motion is reduced. */
  reduceMotion?: boolean
  /** When true, renders a skeleton placeholder instead of coupon content. */
  isLoading?: boolean
}

const COUPON_IMAGE_PATH = '/assets/lovart/gift-card/coupon.webp'

function formatDiscount(
  discountValue: number,
  discountType?: string | null,
): { value: string; unit: string } {
  // Canonical fixed 见面礼 (WELCOME20): display whole yuan. Legacy percentage
  // coupons keep the 折 rendering.
  if (discountType === 'fixed_amount' && discountValue > 0) {
    return { value: `${Math.floor(discountValue / 100)}`, unit: '元' }
  }
  if (discountValue > 0 && discountValue <= 100) {
    const zhe = Math.round((100 - discountValue) / 10)
    if (zhe >= 1 && zhe <= 9) {
      return { value: `${zhe}`, unit: '折' }
    }
  }
  return { value: `${discountValue}`, unit: '%' }
}

/**
 * Premium welcome-gift card for the profile-review / 入场卡 screen.
 *
 * Renders the Lovart coupon illustration as a full-bleed card, with the dynamic
 * discount level displayed prominently in the right-hand framed area using
 * brand colour, weight, and typeface.
 */
export default function WelcomeGiftCard({
  discountValue = 0,
  discountType = null,
  validUntil = null,
  onTap,
  className = '',
  visible = true,
  reduceMotion = false,
  isLoading = false,
}: WelcomeGiftCardProps): JSX.Element {
  const handleTap = () => {
    haptics('light')
    onTap?.()
  }

  const { value, unit } = formatDiscount(discountValue, discountType)
  const badgeLabel = `${value}${unit}`
  const validityHint = formatCouponValidUntilLabel(validUntil)
  const { src: imageSrc, onError: onImageError } = useCdnFirstSrc(COUPON_IMAGE_PATH)

  const rootClass = [
    'welcome-gift-card',
    visible ? 'welcome-gift-card--visible' : '',
    reduceMotion ? 'welcome-gift-card--reduce-motion' : '',
    isLoading ? 'welcome-gift-card--loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (isLoading) {
    return (
      <View className={rootClass} aria-label='悦仔见面礼加载中' role='status' aria-live='polite'>
        <View className='welcome-gift-card__placeholder welcome-gift-card__placeholder--shimmer' />
        <View className='welcome-gift-card__skeleton'>
          <View className='welcome-gift-card__skeleton-row'>
            <View className='welcome-gift-card__skeleton-text welcome-gift-card__skeleton-text--short' />
            <View className='welcome-gift-card__skeleton-discount' />
          </View>
          <View className='welcome-gift-card__skeleton-text welcome-gift-card__skeleton-text--medium' />
          <View className='welcome-gift-card__skeleton-text welcome-gift-card__skeleton-text--long' />
          <View className='welcome-gift-card__skeleton-pill' />
        </View>
      </View>
    )
  }

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
        <View className='welcome-gift-card__copy-col'>
          <Text className='welcome-gift-card__eyebrow'>悦仔见面礼</Text>
          <Text className='welcome-gift-card__title'>一点小心意</Text>
          <Text className='welcome-gift-card__body'>今晚去发现页，挑一场对味的局</Text>
          <View className='welcome-gift-card__hint'>
            <Text className='welcome-gift-card__hint-text'>报名可用</Text>
          </View>
          {validityHint ? (
            <Text className='welcome-gift-card__expiry'>有效期至 {validityHint}</Text>
          ) : null}
        </View>

        <View className='welcome-gift-card__discount' aria-hidden='true'>
          <Text className='welcome-gift-card__discount-value'>{value}</Text>
          <Text className='welcome-gift-card__discount-unit'>{unit}</Text>
        </View>
      </View>
    </View>
  )
}

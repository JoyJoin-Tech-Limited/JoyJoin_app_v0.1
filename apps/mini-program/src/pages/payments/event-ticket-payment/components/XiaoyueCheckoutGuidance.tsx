import { Text, View } from '@tarojs/components'
import type { UserCouponSummary } from '@shared/api'
import { getCouponDisplayName } from '../../../../lib/payment/couponDisplay'
import { formatPrice, type SelectedPlan } from '../ticketHelpers'
// Styles are @use'd by the owning payment page SCSS (subpackage WXSS guard).

const PLAN_LABELS: Record<SelectedPlan, string> = {
  single: '单场局票',
  pack_3: '三连局包',
  pack_6: '六连局包',
  vip_monthly: '悦聚月卡',
}

interface XiaoyueCheckoutGuidanceProps {
  selectedPlan: SelectedPlan | null | undefined
  bestCoupon: UserCouponSummary | null
  effectiveCouponCode?: string
  discountAmount: number | null | undefined
  finalPrice: number | null | undefined
}

function isValidAmount(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/**
 * Presentational checkout note only: no selection, coupon, payment, or pricing
 * authority. Every value comes from the existing checkout view model.
 */
export default function XiaoyueCheckoutGuidance({
  selectedPlan,
  bestCoupon,
  effectiveCouponCode,
  discountAmount,
  finalPrice,
}: XiaoyueCheckoutGuidanceProps) {
  const planLabel = selectedPlan ? PLAN_LABELS[selectedPlan] : undefined
  const hasFinalPrice = isValidAmount(finalPrice)
  const planLine = planLabel
    ? hasFinalPrice
      ? `你选的是「${planLabel}」，本次实付 ${formatPrice(finalPrice)}。`
      : `你选的是「${planLabel}」。`
    : hasFinalPrice
      ? `本次实付 ${formatPrice(finalPrice)}。`
      : ''

  const couponCode = effectiveCouponCode?.trim() ?? ''
  const couponDiscount = isValidAmount(discountAmount) && discountAmount > 0 ? discountAmount : null
  const hasEffectiveCoupon = Boolean(
    couponCode && bestCoupon?.code === couponCode && couponDiscount !== null,
  )
  const couponLine = hasEffectiveCoupon && couponDiscount !== null
    ? `${getCouponDisplayName(couponCode)}已计入，优惠 ${formatPrice(couponDiscount)}。`
    : ''

  if (!planLine && !couponLine) return null

  return (
    <View className='xiaoyue-checkout-guidance' role='note' aria-label='悦仔帮你核对订单'>
      <Text className='xiaoyue-checkout-guidance__label'>悦仔核对</Text>
      {planLine ? <Text className='xiaoyue-checkout-guidance__line'>{planLine}</Text> : null}
      {couponLine ? <Text className='xiaoyue-checkout-guidance__line'>{couponLine}</Text> : null}
    </View>
  )
}

import { View, Text } from '@tarojs/components'
import type { UserCouponSummary } from '@shared/api'

import { haptics } from '../../../../lib/utils/haptics'
import { discoverAnalytics } from '../../../../lib/analytics/discoverAnalytics'
import { formatPrice, type SelectedPlan } from '../ticketHelpers'

export type { SelectedPlan } from '../ticketHelpers'

/**
 * View model for the D2 悦聚月卡 upsell card. The page builds this from
 * resolveVipMonthlyOffer + getVipMonthlyAnchorLabel and only passes a
 * non-null value when the upsell flag is ON and ritual-context carries the
 * monthly plan — null keeps the legacy three-plan layout byte-identical.
 */
export interface VipMonthlyPlanView {
  displayName: string
  description: string | null
  priceInCents: number
  anchorLabel: string | null
}

interface TicketPlanSelectionProps {
  selectedPlan: SelectedPlan
  onSelectPlan: (plan: SelectedPlan) => void
  singlePrice: number
  pack3Price: number
  pack6Price: number
  currentPrice: number
  discountAmount: number
  finalPrice: number
  bestCoupon: UserCouponSummary | null
  poolId: string
  /**
   * Audit F4-b: true when a 见面礼 welcome coupon exists but is ineligible
   * for the currently selected plan — renders a quiet eligibility note under
   * the plan cards (System UI register, no promo styling).
   */
  showWelcomeCouponHint?: boolean
  /**
   * D2 悦聚月卡 upsell offer. Non-null renders the monthly card FIRST as the
   * recommended option; null/undefined = legacy three-plan layout.
   */
  vipMonthlyPlan?: VipMonthlyPlanView | null
}

export default function TicketPlanSelection({
  selectedPlan,
  onSelectPlan,
  singlePrice,
  pack3Price,
  pack6Price,
  currentPrice,
  discountAmount,
  finalPrice,
  bestCoupon,
  poolId,
  showWelcomeCouponHint = false,
  vipMonthlyPlan = null,
}: TicketPlanSelectionProps) {
  const handleSelect = (plan: SelectedPlan) => {
    haptics('light')
    if (selectedPlan !== plan) {
      discoverAnalytics.track('plan_switch', undefined, {
        fromPlan: selectedPlan,
        toPlan: plan,
        poolId,
        couponCode: bestCoupon?.code ?? null,
      })
    }
    onSelectPlan(plan)
  }

  // Monthly card description: server-provided plan description + the derived
  // per-event anchor. Both segments optional; omitted entirely when neither
  // exists (never hardcoded quota copy).
  const vipMonthlyDesc = vipMonthlyPlan
    ? [vipMonthlyPlan.description, vipMonthlyPlan.anchorLabel].filter(Boolean).join(' · ')
    : ''

  return (
    <>
      <View className='ticket-plan-section'>
        <View className='ticket-plan-section__header'>
          <View className='ticket-plan-section__header-accent' />
          <Text className='ticket-plan-section__label'>选择入场方案</Text>
        </View>

        <View className='ticket-plan-cards'>
          {/* D2 悦聚月卡 (flag checkoutSubscriptionUpsellEnabled): first
              position, recommended badge. One-time purchase — renewal is
              manual at full price, so no recurring-discount copy here. */}
          {vipMonthlyPlan ? (
            <View
              className={`ticket-plan-card ticket-plan-card--recommended ${selectedPlan === 'vip_monthly' ? 'ticket-plan-card--selected' : ''}`}
              hoverClass='ticket-plan-card--pressed'
              onClick={() => handleSelect('vip_monthly')}
            >
              <View className='ticket-plan-card__radio'>
                <View className={`ticket-plan-card__radio-dot ${selectedPlan === 'vip_monthly' ? 'ticket-plan-card__radio-dot--active' : ''}`} />
              </View>
              <View className='ticket-plan-card__body'>
                <View className='ticket-plan-card__top'>
                  <View className='ticket-plan-card__title-wrap'>
                    <Text className='ticket-plan-card__title'>{vipMonthlyPlan.displayName}</Text>
                    <View className='ticket-plan-card__badge ticket-plan-card__badge--recommended'>
                      <Text>推荐</Text>
                    </View>
                  </View>
                  <Text className='ticket-plan-card__price'>{formatPrice(vipMonthlyPlan.priceInCents)}</Text>
                </View>
                {vipMonthlyDesc ? <Text className='ticket-plan-card__desc'>{vipMonthlyDesc}</Text> : null}
              </View>
            </View>
          ) : null}

          <View
            className={`ticket-plan-card ${selectedPlan === 'single' ? 'ticket-plan-card--selected' : ''}`}
            hoverClass='ticket-plan-card--pressed'
            onClick={() => handleSelect('single')}
          >
            <View className='ticket-plan-card__radio'>
              <View className={`ticket-plan-card__radio-dot ${selectedPlan === 'single' ? 'ticket-plan-card__radio-dot--active' : ''}`} />
            </View>
            <View className='ticket-plan-card__body'>
              <View className='ticket-plan-card__top'>
                <Text className='ticket-plan-card__title'>单场局票</Text>
                <Text className='ticket-plan-card__price'>{formatPrice(singlePrice)}</Text>
              </View>
              <Text className='ticket-plan-card__desc'>先体验一场，合适再续杯</Text>
            </View>
          </View>

          <View
            className={`ticket-plan-card ${selectedPlan === 'pack_3' ? 'ticket-plan-card--selected' : ''}`}
            hoverClass='ticket-plan-card--pressed'
            onClick={() => handleSelect('pack_3')}
          >
            <View className='ticket-plan-card__radio'>
              <View className={`ticket-plan-card__radio-dot ${selectedPlan === 'pack_3' ? 'ticket-plan-card__radio-dot--active' : ''}`} />
            </View>
            <View className='ticket-plan-card__body'>
              <View className='ticket-plan-card__top'>
                <View className='ticket-plan-card__title-wrap'>
                  <Text className='ticket-plan-card__title'>三连局包</Text>
                  <View className='ticket-plan-card__badge'>
                    <Text>先试试看</Text>
                  </View>
                </View>
                <Text className='ticket-plan-card__price'>{formatPrice(pack3Price)}</Text>
              </View>
              <Text className='ticket-plan-card__desc'>3 场局名额，先认识三桌新朋友 · 每次约 {formatPrice(Math.floor(pack3Price / 3))}</Text>
            </View>
          </View>

          <View
            className={`ticket-plan-card ${selectedPlan === 'pack_6' ? 'ticket-plan-card--selected' : ''}`}
            hoverClass='ticket-plan-card--pressed'
            onClick={() => handleSelect('pack_6')}
          >
            <View className='ticket-plan-card__radio'>
              <View className={`ticket-plan-card__radio-dot ${selectedPlan === 'pack_6' ? 'ticket-plan-card__radio-dot--active' : ''}`} />
            </View>
            <View className='ticket-plan-card__body'>
              <View className='ticket-plan-card__top'>
                <View className='ticket-plan-card__title-wrap'>
                  <Text className='ticket-plan-card__title'>六连局包</Text>
                  <View className='ticket-plan-card__badge ticket-plan-card__badge--best'>
                    <Text>更灵活</Text>
                  </View>
                </View>
                <Text className='ticket-plan-card__price'>{formatPrice(pack6Price)}</Text>
              </View>
              <Text className='ticket-plan-card__desc'>6 场局名额，慢慢玩成常客 · 每次约 {formatPrice(Math.floor(pack6Price / 6))}</Text>
            </View>
          </View>
        </View>

        {/* F4-b eligibility note: plan-neutral canonical vocabulary only
            (连局包 / 悦聚卡 per brand-copy-strategy §3.1). If server-side
            per-plan coupon validation lands later, keep this copy honest. */}
        {showWelcomeCouponHint ? (
          <View className='ticket-plan-hint'>
            <Text className='ticket-plan-hint__text'>见面礼可用于连局包与悦聚卡</Text>
          </View>
        ) : null}
      </View>

      <View className='ticket-price-summary'>
        <View className='ticket-price-summary__row'>
          <Text className='ticket-price-summary__label'>方案金额</Text>
          <Text className={`ticket-price-summary__value ${discountAmount > 0 ? 'ticket-price-summary__value--struck' : ''}`}>
            {formatPrice(currentPrice)}
          </Text>
        </View>
        {discountAmount > 0 && (
          <View className='ticket-price-summary__row'>
            <Text className='ticket-price-summary__label'>新人优惠</Text>
            <Text className='ticket-price-summary__value ticket-price-summary__value--discount'>
              -{formatPrice(discountAmount)}
            </Text>
          </View>
        )}
        <View className='ticket-price-summary__row ticket-price-summary__row--total'>
          <Text className='ticket-price-summary__label'>实付金额</Text>
          <Text className='ticket-price-summary__value ticket-price-summary__value--total'>{formatPrice(finalPrice)}</Text>
        </View>
      </View>
    </>
  )
}

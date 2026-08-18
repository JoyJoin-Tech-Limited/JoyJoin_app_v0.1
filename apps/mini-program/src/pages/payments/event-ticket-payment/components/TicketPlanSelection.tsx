import { View, Text } from '@tarojs/components'
import type { UserCouponSummary } from '@shared/api'

import { haptics } from '../../../../lib/utils/haptics'
import { discoverAnalytics } from '../../../../lib/analytics/discoverAnalytics'
import { formatPrice } from '../ticketHelpers'

export type SelectedPlan = 'single' | 'pack_3' | 'pack_6'

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

  return (
    <>
      <View className='ticket-plan-section'>
        <View className='ticket-plan-section__header'>
          <View className='ticket-plan-section__header-accent' />
          <Text className='ticket-plan-section__label'>选择入场方案</Text>
        </View>

        <View className='ticket-plan-cards'>
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

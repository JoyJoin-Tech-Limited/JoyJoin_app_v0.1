import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'

/** Staged order-creation copy advances ~1.6s in (creation → payment
 *  channel). Honest stages only, never a fake progress bar. The component is
 *  mounted only while the order is creating; unmounting (success, failure,
 *  or return) clears the timer and resets the stage. */
const ORDER_STAGE_ADVANCE_MS = 1600

/**
 * Creating-state skeleton for the order-creation wait: branded
 * opacity-pulse shapes mirroring the real plan card + honest staged copy.
 * SCSS stays in the owning page chunk (event-ticket-payment/index.scss) —
 * see the subpackage WXSS guard.
 */
export default function TicketOrderSkeleton() {
  const [creatingStage, setCreatingStage] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setCreatingStage(1), ORDER_STAGE_ADVANCE_MS)
    return () => clearTimeout(t)
  }, [])

  return (
    <View className='ticket-order-skeleton' role='status' aria-live='polite'>
      <Text className='ticket-order-skeleton__title'>
        {creatingStage === 0 ? '正在为你创建订单…' : '确认支付通道中…'}
      </Text>
      <Text className='ticket-order-skeleton__subtitle'>方案与优惠正在核对</Text>
      <View className='ticket-order-skeleton__plans'>
        {/* Byte-honest: the real plan list shows 3 cards (single / 3-pack / 6-pack). */}
        <View className='ticket-order-skeleton__plan' />
        <View className='ticket-order-skeleton__plan' />
        <View className='ticket-order-skeleton__plan' />
      </View>
      <View className='ticket-order-skeleton__summary'>
        <View className='ticket-order-skeleton__row' />
        <View className='ticket-order-skeleton__row ticket-order-skeleton__row--short' />
        <View className='ticket-order-skeleton__row ticket-order-skeleton__row--total' />
      </View>
    </View>
  )
}

/** Sticky-footer CTA label for the payment page: staged while the order is
 *  being created, then the confirmed price. */
export function getTicketCtaLabel(isPaying: boolean, isCreating: boolean, priceLabel: string): string {
  if (!isPaying) return `立即锁定席位 · ${priceLabel}`
  return isCreating ? '请稍候…' : '支付中…'
}

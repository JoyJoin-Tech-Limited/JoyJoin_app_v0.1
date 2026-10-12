import { View, Text } from '@tarojs/components'

/**
 * D3 refund-guarantee caption (flag `preRevealRefundEnabled`, 2026-10-11).
 *
 * One quiet System-UI line rendered directly under the payment CTA on the
 * event-ticket-payment page — same muted caption register as the trust row's
 * 「微信支付 · 安全加密」. Fail-closed: when the flag is off or absent the
 * parent passes `visible={false}` and this renders NOTHING (null tree), and
 * the existing 退款政策 link stays untouched.
 */
export default function RefundGuaranteeLine({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <View className='ticket-refund-guarantee'>
      <Text className='ticket-refund-guarantee__text'>排桌完成前取消，全额退款</Text>
    </View>
  )
}

import { View, Text } from '@tarojs/components'

/**
 * D3 refund-guarantee caption (flag `preRevealRefundEnabled`, 2026-10-11);
 * 转化 P0d two-line caption stack (2026-10-21).
 *
 * Quiet System-UI register rendered directly under the payment CTA on the
 * event-ticket-payment page — same muted caption family as the trust row's
 * 「微信支付 · 安全加密」. Fail-closed chain (AC-06):
 *
 * - `visible=false` (flag off / absent) → renders NOTHING (null tree); the
 *   existing 退款政策 link stays untouched.
 * - `visible=true` + `narrative=true` (server bucket 1) → two-line stack:
 *   the narrative row 「这一桌已经写上你的名字」 on top, the permanent fact
 *   row 「排桌完成前取消，全额退款」 below — the fact row is the promise
 *   layer and is NEVER removed; the narrative row is rhetoric on top of it.
 * - `visible=true` + `narrative=false` (bucket 0 / field absent / any
 *   anomaly) → legacy single fact line, byte-level status quo.
 *
 * Zero animation by design (对标平台 §5.3.2: 收银台编排预算为零 — 信任面的装饰
 * 即减信；排版精度本身是全部高级感).
 */
export default function RefundGuaranteeLine({ visible, narrative = false }: { visible: boolean; narrative?: boolean }) {
  if (!visible) return null
  return (
    <View className='ticket-refund-guarantee'>
      {narrative ? (
        <Text className='ticket-refund-guarantee__text ticket-refund-guarantee__text--narrative'>
          这一桌已经写上你的名字
        </Text>
      ) : null}
      <Text className='ticket-refund-guarantee__text'>排桌完成前取消，全额退款</Text>
    </View>
  )
}

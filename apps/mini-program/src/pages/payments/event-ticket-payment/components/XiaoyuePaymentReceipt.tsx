import { Text, View } from '@tarojs/components'
import { formatPrice } from '../ticketHelpers'
// Styles are @use'd by BOTH owning page SCSS files (subpackage WXSS guard).

export interface XiaoyuePaymentReceiptSnapshot {
  orderId: string
  planLabel?: string
  finalAmount?: number
  discountAmount?: number
}

/** Additive-tolerant shape for the existing status/reconcile responses. */
export interface ConfirmedOrderReceiptSource {
  status?: string
  orderId?: string
  wechatOrderId?: string
  outTradeNo?: string
  plan?: string
  planType?: string
  finalAmount?: number
  discountAmount?: number
}

const CONFIRMED_PLAN_LABELS: Record<string, string> = {
  single: '单场局票',
  event: '单场局票',
  event_single: '单场局票',
  pack_3: '三连局包',
  pack_6: '六连局包',
  monthly: '悦聚月卡',
  vip_monthly: '悦聚月卡',
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function validAmount(value: unknown, allowZero: boolean): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    (allowZero ? value >= 0 : value > 0)
  )
}

/**
 * Capture a receipt only after server confirmation. The current status and
 * reconcile payloads confirm the requested order but carry no monetary order
 * fields, so the snapshot intentionally contains only `orderId`. Amount,
 * plan, and savings stay omitted unless a confirmed response explicitly names
 * the SAME order and supplies those fields — never fall back to mutable
 * checkout selections.
 */
export function captureSameOrderReceipt(
  requestedOrderId: string,
  response: ConfirmedOrderReceiptSource,
): XiaoyuePaymentReceiptSnapshot | null {
  const orderId = nonEmptyString(requestedOrderId)
  if (!orderId || response.status !== 'completed') return null

  const responseOrderIds = [
    nonEmptyString(response.orderId),
    nonEmptyString(response.wechatOrderId),
    nonEmptyString(response.outTradeNo),
  ].filter((value): value is string => Boolean(value))

  if (responseOrderIds.some((value) => value !== orderId)) return null

  // A status-only response confirms payment for this request, but is not
  // receipt provenance for plan/amount/savings. Require an explicit order id.
  const hasSameOrderProvenance = responseOrderIds.includes(orderId)
  if (!hasSameOrderProvenance) return { orderId }

  const rawPlan = nonEmptyString(response.planType) ?? nonEmptyString(response.plan)
  const planLabel = rawPlan ? CONFIRMED_PLAN_LABELS[rawPlan] : undefined

  return {
    orderId,
    ...(planLabel ? { planLabel } : {}),
    ...(validAmount(response.finalAmount, true) ? { finalAmount: response.finalAmount } : {}),
    ...(validAmount(response.discountAmount, false) ? { discountAmount: response.discountAmount } : {}),
  }
}

interface XiaoyuePaymentReceiptProps {
  mode: 'paid' | 'entitlement'
  receipt?: XiaoyuePaymentReceiptSnapshot | null
  guidance?: string
}

/** Quiet success note; entitlement mode structurally excludes all money rows. */
export default function XiaoyuePaymentReceipt({
  mode,
  receipt,
  guidance,
}: XiaoyuePaymentReceiptProps) {
  const showReceiptDetails = mode === 'paid' && Boolean(
    receipt?.planLabel ||
      validAmount(receipt?.finalAmount, true) ||
      validAmount(receipt?.discountAmount, false),
  )
  const cleanGuidance = guidance?.trim() ?? ''

  return (
    <View className={`xiaoyue-payment-receipt xiaoyue-payment-receipt--${mode}`}>
      <Text className='xiaoyue-payment-receipt__title'>
        {mode === 'paid' ? '支付已确认' : '报名已确认'}
      </Text>
      {cleanGuidance ? (
        <Text className='xiaoyue-payment-receipt__guidance'>{cleanGuidance}</Text>
      ) : null}

      {showReceiptDetails && receipt ? (
        <View className='xiaoyue-payment-receipt__details'>
          {receipt.planLabel ? (
            <View className='xiaoyue-payment-receipt__row'>
              <Text className='xiaoyue-payment-receipt__label'>入场方案</Text>
              <Text className='xiaoyue-payment-receipt__value'>{receipt.planLabel}</Text>
            </View>
          ) : null}
          {validAmount(receipt.finalAmount, true) ? (
            <View className='xiaoyue-payment-receipt__row'>
              <Text className='xiaoyue-payment-receipt__label'>订单金额</Text>
              <Text className='xiaoyue-payment-receipt__value'>
                实付 {formatPrice(receipt.finalAmount)}
              </Text>
            </View>
          ) : null}
          {validAmount(receipt.discountAmount, false) ? (
            <View className='xiaoyue-payment-receipt__row'>
              <Text className='xiaoyue-payment-receipt__label'>订单优惠</Text>
              <Text className='xiaoyue-payment-receipt__value xiaoyue-payment-receipt__value--savings'>
                已省 {formatPrice(receipt.discountAmount)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

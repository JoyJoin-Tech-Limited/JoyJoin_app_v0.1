import type { UserCouponSummary } from '@shared/api'

/**
 * Friendly, user-facing coupon naming (2026-10-12, solidification S-7).
 *
 * Internal coupon codes must not leak into brand surfaces — a user who sees
 * "WELCOME20" may screenshot/share it as a redeemable code, and support flows
 * read better with names. The raw code stays available for support only.
 */
export function getCouponDisplayName(code?: string | null): string {
  const normalized = (code ?? '').trim().toUpperCase()
  if (!normalized) return '优惠券'
  if (normalized.startsWith('WELCOME')) return '见面礼券'
  if (normalized.startsWith('INVITE')) return '邀请奖励券'
  if (normalized.startsWith('REFERRAL')) return '推荐奖励券'
  // Redeemed catalog codes: the server writes `code: item.id`, so without these
  // the raw token (coupon_10_off) reached the wallet and the checkout list.
  // Discount-bearing codes use a neutral name because every surface renders the
  // actual value next to it — "5折 / 5折优惠券" read as a duplicated label.
  const redeemedCodeNames: Record<string, string> = {
    COUPON_10_OFF: '活动折扣券',
    COUPON_20_OFF: '活动折扣券',
    COUPON_30_OFF: '活动折扣券',
    COUPON_50_OFF: '活动折扣券',
    FREE_EVENT_TICKET: '免费活动名额',
    PRIORITY_ACCESS: '优先报名通行证',
  }
  if (redeemedCodeNames[normalized]) return redeemedCodeNames[normalized]
  return code?.trim() ?? '优惠券'
}

/**
 * Human benefit label: fixed cents → 「立减 ¥20」; percentage → 「5折」
 * (50% off = 5折 — the raw "50%" wording was ambiguous/awkward in Chinese
 * surfaces). Falls back to a neutral label for unknown shapes.
 */
export function formatCouponBenefitLabel(
  coupon: Pick<UserCouponSummary, 'discountType' | 'discountValue'>,
): string {
  const value = coupon.discountValue ?? 0
  if (value <= 0) return '优惠'

  if (coupon.discountType === 'fixed_amount') {
    return `立减 ¥${Math.floor(value / 100)}`
  }

  if (coupon.discountType === 'percentage') {
    const zhe = Math.round((100 - value) / 10)
    if (zhe >= 1 && zhe <= 9) return `${zhe}折`
    return `抵扣 ${value}%`
  }

  return '优惠'
}

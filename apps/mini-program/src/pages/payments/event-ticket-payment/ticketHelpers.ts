import type { UserCouponSummary } from '@shared/api'
import { getIntentLabel } from '@shared/constants'

/** Pricing-plan DTO from GET /api/payments/ritual-context. */
export interface PricingPlan {
  planType: string
  priceInCents: number
  originalPriceInCents?: number | null
}

export function formatPrice(cents: number): string {
  return `¥${(cents / 100).toFixed(0)}`
}

export function formatBudgetLabel(budget: string): string {
  if (!budget || budget.startsWith('¥')) return budget
  return `¥${budget}`
}

export function calculateSavings(singlePrice: number, packPrice: number, count: number): number {
  return singlePrice * count - packPrice
}

export function getBestCoupon(coupons: UserCouponSummary[], originalAmount: number): UserCouponSummary | null {
  const available = coupons.filter((c) => c.status === 'available' && !c.isUsed)
  if (!available.length) return null
  let best: UserCouponSummary | null = null
  let bestDiscount = 0
  for (const c of available) {
    const discountType = c.discountType
    const discountValue = c.discountValue ?? 0
    let d = 0
    if (discountType === 'percentage') {
      d = Math.floor(originalAmount * (discountValue / 100))
    } else if (discountType === 'fixed_amount') {
      d = Math.min(originalAmount, discountValue)
    }
    if (d > bestDiscount) {
      best = c
      bestDiscount = d
    }
  }
  return best
}

export function findWelcomeCoupon(coupons: UserCouponSummary[]): UserCouponSummary | null {
  const welcomes = coupons.filter((c) => {
    const code = c.code?.toUpperCase?.() ?? ''
    return code.startsWith('WELCOME') && c.status === 'available' && !c.isUsed
  })
  if (!welcomes.length) return null
  // Prefer the highest-value welcome coupon (e.g. WELCOME50 > WELCOME40).
  return welcomes.reduce((best, c) => {
    const bestValue = best.discountValue ?? 0
    const currentValue = c.discountValue ?? 0
    return currentValue > bestValue ? c : best
  }, welcomes[0])
}

export function calculateDiscount(coupon: UserCouponSummary | null, originalAmount: number): number {
  if (!coupon) return 0
  const discountType = coupon.discountType
  const discountValue = coupon.discountValue ?? 0
  if (discountType === 'percentage') {
    return Math.floor(originalAmount * (discountValue / 100))
  }
  if (discountType === 'fixed_amount') {
    return Math.min(originalAmount, discountValue)
  }
  return 0
}

// Localized display labels for registration draft values.
// Mirrors the most common option sets without importing across app boundaries.
const DIETARY_LABELS: Record<string, string> = {
  none: '无限制',
  vegetarian: '素食',
  halal: '清真',
  seafood_allergy: '海鲜过敏',
}

const LANGUAGE_LABELS: Record<string, string> = {
  粤语: '粤语',
  普通话: '普通话',
  英语: '英文交流',
  English: '英文交流',
}

const ALCOHOL_LABELS: Record<string, string> = {
  可以喝酒: '可以喝酒',
  微醺就好: '微醺就好',
  无酒精: '无酒精',
}

export function getDisplayLabel(value: string, category: 'intent' | 'language' | 'dietary' | 'alcohol' | 'other'): string {
  if (!value) return value
  if (category === 'intent') {
    return getIntentLabel(value)
  }
  if (category === 'language') {
    return LANGUAGE_LABELS[value] ?? value
  }
  if (category === 'dietary') {
    return DIETARY_LABELS[value] ?? value
  }
  if (category === 'alcohol') {
    return ALCOHOL_LABELS[value] ?? value
  }
  return value
}

export function formatDateTimeLabel(dateTime?: string | null): string {
  if (!dateTime) return ''
  const d = new Date(dateTime)
  if (Number.isNaN(d.getTime())) return dateTime
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' })
}

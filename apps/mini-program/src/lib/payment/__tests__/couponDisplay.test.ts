import { describe, expect, it } from 'vitest'
import { formatCouponBenefitLabel, getCouponDisplayName } from '../couponDisplay'

describe('getCouponDisplayName (S-7: no raw codes in brand surfaces)', () => {
  it('maps the canonical welcome family to 见面礼券', () => {
    expect(getCouponDisplayName('WELCOME20')).toBe('见面礼券')
    expect(getCouponDisplayName('welcome50')).toBe('见面礼券')
  })

  it('maps invite/referral families to friendly names', () => {
    expect(getCouponDisplayName('INVITE_REWARD')).toBe('邀请奖励券')
    expect(getCouponDisplayName('REFERRAL10')).toBe('推荐奖励券')
  })

  it('passes unknown codes through and falls back for empty input', () => {
    expect(getCouponDisplayName('SUMMER2026')).toBe('SUMMER2026')
    expect(getCouponDisplayName(undefined)).toBe('优惠券')
    expect(getCouponDisplayName('')).toBe('优惠券')
  })
})

describe('formatCouponBenefitLabel', () => {
  it('renders fixed cents as 立减 ¥20', () => {
    expect(formatCouponBenefitLabel({ discountType: 'fixed_amount', discountValue: 2000 })).toBe('立减 ¥20')
  })

  it('converts percentage to 折 (50% off = 5折)', () => {
    expect(formatCouponBenefitLabel({ discountType: 'percentage', discountValue: 50 })).toBe('5折')
    expect(formatCouponBenefitLabel({ discountType: 'percentage', discountValue: 40 })).toBe('6折')
  })

  it('falls back to a neutral label for unknown or zero values', () => {
    expect(formatCouponBenefitLabel({ discountType: 'fixed_amount', discountValue: 0 })).toBe('优惠')
    expect(formatCouponBenefitLabel({ discountType: 'gift', discountValue: 1 })).toBe('优惠')
  })
})

/**
 * Contract test: the mini-program payment page vs. the admin-editable
 * `GET /api/pricing` payload.
 *
 * The admin console edits `pricing_settings` (and reads cents from
 * `/api/admin/pricing`), while the mini-program consumes the public endpoint
 * in yuan. If the two drift — renamed keys, cents leaking through, planType
 * renaming — the payment page silently falls back to hardcoded prices
 * (98 / 294 / 211 / 370) and shows a price the operator did not set.
 * These fixtures mirror the real public response captured from the dev API.
 */
import { describe, expect, it } from 'vitest'
import type { PricingPlan } from '@shared/api'
import {
  buildMiniProgramPaymentAmountSummary,
  DEFAULT_MINI_PROGRAM_PAYMENT_PLANS,
  formatMiniProgramPaymentPrice,
  resolveMiniProgramPaymentPlans,
} from '../paymentPageModel'

/** Shape returned by GET /api/pricing (yuan, not cents). */
const PUBLIC_PRICING_RESPONSE: PricingPlan[] = [
  {
    id: 'plan-monthly',
    planType: 'monthly',
    displayName: '悦聚月卡',
    displayNameEn: 'YueJu Monthly',
    description: '每月 6 场局，说走就走',
    price: 98,
    originalPrice: null,
    durationDays: 30,
    isActive: true,
    isFeatured: false,
  },
  {
    id: 'plan-quarterly',
    planType: 'quarterly',
    displayName: '悦聚季卡',
    displayNameEn: 'YueJu Quarterly',
    description: '一季 18 场局，场场有人陪',
    price: 294,
    originalPrice: 300,
    durationDays: 90,
    isActive: true,
    isFeatured: false,
  },
  {
    id: 'plan-single',
    planType: 'event_single',
    displayName: '单场局票',
    displayNameEn: 'Single Pass',
    description: '先参加一场看看',
    price: 88,
    durationDays: null,
    isActive: true,
    isFeatured: false,
  } as unknown as PricingPlan,
  {
    id: 'plan-pack-3',
    planType: 'pack_3',
    displayName: '三连局包',
    description: '3 场局名额，先认识三桌新朋友',
    price: 211,
    durationDays: 60,
    isActive: true,
    isFeatured: false,
  },
  {
    id: 'plan-pack-6',
    planType: 'pack_6',
    displayName: '六连局包',
    description: '6 场局名额，慢慢玩成常客',
    price: 370,
    durationDays: 180,
    isActive: true,
    isFeatured: false,
  },
]

describe('resolveMiniProgramPaymentPlans vs public /api/pricing', () => {
  it('maps the DB planType values (monthly/quarterly, not vip_*) to the payment page keys', () => {
    const plans = resolveMiniProgramPaymentPlans(PUBLIC_PRICING_RESPONSE)

    // monthly -> vip_monthly, quarterly -> vip_quarterly (identifier aliases)
    expect(plans.vip_monthly.price).toBe(98)
    expect(plans.vip_monthly.displayName).toBe('悦聚月卡')
    expect(plans.vip_quarterly.price).toBe(294)
    expect(plans.vip_quarterly.displayName).toBe('悦聚季卡')
    expect(plans.pack_3.price).toBe(211)
    expect(plans.pack_6.price).toBe(370)
  })

  it('shows the operator-set price instead of the hardcoded fallback', () => {
    const edited = PUBLIC_PRICING_RESPONSE.map((plan) =>
      plan.planType === 'monthly' ? { ...plan, price: 120 } : plan,
    )

    const plans = resolveMiniProgramPaymentPlans(edited)

    expect(plans.vip_monthly.price).toBe(120)
    expect(formatMiniProgramPaymentPrice(plans.vip_monthly.price)).toBe('¥120')
    // Untouched rows keep the API value, not a hardcoded one.
    expect(plans.pack_3.price).toBe(211)
  })

  it('falls back to the shipped defaults when a plan row is missing or the fetch failed', () => {
    const plans = resolveMiniProgramPaymentPlans([])

    expect(plans).toEqual(DEFAULT_MINI_PROGRAM_PAYMENT_PLANS)
    expect(plans.vip_monthly.price).toBe(98)
    expect(plans.vip_quarterly.price).toBe(294)
    expect(plans.pack_3.price).toBe(211)
    expect(plans.pack_6.price).toBe(370)
  })

  it('ignores plans it does not render (event_single) and order changes', () => {
    const shuffled = [...PUBLIC_PRICING_RESPONSE].reverse()
    const plans = resolveMiniProgramPaymentPlans(shuffled)

    expect(Object.keys(plans).sort()).toEqual(
      ['vip_monthly', 'vip_quarterly', 'pack_3', 'pack_6'].sort(),
    )
    expect(plans.vip_monthly.id).toBe('plan-monthly')
  })

  it('tolerates the legacy vip_monthly/vip_quarterly planType spelling', () => {
    const legacy = [
      { ...PUBLIC_PRICING_RESPONSE[0], planType: 'vip_monthly' },
      { ...PUBLIC_PRICING_RESPONSE[1], planType: 'vip_quarterly' },
    ]

    const plans = resolveMiniProgramPaymentPlans(legacy)

    expect(plans.vip_monthly.price).toBe(98)
    expect(plans.vip_quarterly.price).toBe(294)
  })
})

describe('buildMiniProgramPaymentAmountSummary', () => {
  it('prices the summary from the API plan, not a constant', () => {
    const plan = { ...PUBLIC_PRICING_RESPONSE[0], price: 120 }

    const withCoupon = buildMiniProgramPaymentAmountSummary({
      plan,
      discountAmount: 20,
      finalAmount: 100,
      hasSelectedCoupon: true,
    })

    expect(withCoupon.payableAmount).toBe(100)
    expect(withCoupon.rows.map((row) => row.value)).toEqual(['悦聚月卡', '- ¥20', '¥100'])

    const withoutCoupon = buildMiniProgramPaymentAmountSummary({
      plan,
      discountAmount: 0,
      finalAmount: null,
      hasSelectedCoupon: false,
    })

    expect(withoutCoupon.payableAmount).toBe(120)
    expect(withoutCoupon.rows.at(-1)?.value).toBe('¥120')
  })

  it('renders the struck-through original price when the operator set one', () => {
    const quarterly = PUBLIC_PRICING_RESPONSE[1]

    const summary = buildMiniProgramPaymentAmountSummary({
      plan: quarterly,
      discountAmount: 0,
      finalAmount: null,
      hasSelectedCoupon: false,
    })

    expect(summary.rows.map((row) => row.kind)).toEqual(['selection', 'original', 'total'])
    expect(summary.rows.map((row) => row.value)).toEqual(['悦聚季卡', '¥300', '¥294'])
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { UserCouponSummary } from '@shared/api'
import {
  buildPlansShown,
  calculateDiscount,
  findWelcomeCoupon,
  getBestCoupon,
  getVipMonthlyAnchorLabel,
  isAnchorSafeCoupon,
  isAnchorSafeWelcomeCoupon,
  isWelcomeCouponAutoApplyEligible,
  isWelcomeCouponCode,
  resolvePaymentCheckoutFlags,
  resolveRefundNarrativeBucket,
  resolveVipMonthlyOffer,
} from '../ticketHelpers'

function makeCoupon(partial: Partial<UserCouponSummary>): UserCouponSummary {
  return {
    id: 'c1',
    code: 'WELCOME50',
    discountType: 'percentage',
    discountValue: 50,
    isUsed: false,
    status: 'available',
    ...partial,
  }
}

describe('isWelcomeCouponCode', () => {
  it('matches the WELCOME prefix case-insensitively', () => {
    expect(isWelcomeCouponCode('WELCOME50')).toBe(true)
    expect(isWelcomeCouponCode('welcome40')).toBe(true)
    expect(isWelcomeCouponCode('WELCOME_ABC')).toBe(true)
  })

  it('rejects non-welcome codes and empty input', () => {
    expect(isWelcomeCouponCode('REFERRAL10')).toBe(false)
    expect(isWelcomeCouponCode('')).toBe(false)
    expect(isWelcomeCouponCode(undefined)).toBe(false)
    expect(isWelcomeCouponCode(null)).toBe(false)
  })
})

describe('isWelcomeCouponAutoApplyEligible (audit F4)', () => {
  it('never auto-applies to the anchor 单场局票 plan', () => {
    expect(isWelcomeCouponAutoApplyEligible('single')).toBe(false)
  })

  it('keeps auto-apply for 连局包 and future subscription plans', () => {
    expect(isWelcomeCouponAutoApplyEligible('pack_3')).toBe(true)
    expect(isWelcomeCouponAutoApplyEligible('pack_6')).toBe(true)
    expect(isWelcomeCouponAutoApplyEligible('monthly')).toBe(true)
    expect(isWelcomeCouponAutoApplyEligible('quarterly')).toBe(true)
  })

  it('D2: keeps auto-apply for the 悦聚月卡 checkout plan key', () => {
    expect(isWelcomeCouponAutoApplyEligible('vip_monthly')).toBe(true)
  })
})

describe('findWelcomeCoupon', () => {
  it('prefers the canonical fixed WELCOME20 over legacy percentage codes', () => {
    const coupons = [
      makeCoupon({ id: 'a', code: 'WELCOME50', discountValue: 50 }),
      makeCoupon({ id: 'b', code: 'WELCOME20', discountType: 'fixed_amount', discountValue: 2000 }),
    ]
    expect(findWelcomeCoupon(coupons)?.code).toBe('WELCOME20')
  })

  it('keeps the legacy chain order WELCOME50 > WELCOME40 when the canonical coupon is absent', () => {
    const coupons = [
      makeCoupon({ id: 'a', code: 'WELCOME40', discountValue: 40 }),
      makeCoupon({ id: 'b', code: 'WELCOME50', discountValue: 50 }),
    ]
    expect(findWelcomeCoupon(coupons)?.code).toBe('WELCOME50')
  })

  it('ignores used or non-welcome coupons', () => {
    const coupons = [
      makeCoupon({ id: 'a', code: 'WELCOME50', isUsed: true }),
      makeCoupon({ id: 'b', code: 'REFERRAL10', discountValue: 90 }),
    ]
    expect(findWelcomeCoupon(coupons)).toBeNull()
  })
})

describe('isAnchorSafeWelcomeCoupon (F4 revision 2026-10-12)', () => {
  it('accepts only the canonical fixed ¥20 welcome coupon', () => {
    expect(
      isAnchorSafeWelcomeCoupon(
        makeCoupon({ code: 'WELCOME20', discountType: 'fixed_amount', discountValue: 2000 }),
      ),
    ).toBe(true)
  })

  it('rejects legacy percentage codes, oversized fixed values, and non-welcome codes', () => {
    expect(isAnchorSafeWelcomeCoupon(makeCoupon({ code: 'WELCOME50', discountValue: 50 }))).toBe(false)
    expect(
      isAnchorSafeWelcomeCoupon(
        makeCoupon({ code: 'WELCOME100', discountType: 'fixed_amount', discountValue: 10000 }),
      ),
    ).toBe(false)
    expect(
      isAnchorSafeWelcomeCoupon(
        makeCoupon({ code: 'REFERRAL20', discountType: 'fixed_amount', discountValue: 2000 }),
      ),
    ).toBe(false)
  })
})

describe('isAnchorSafeCoupon (generalized anchor invariant 2026-10-12)', () => {
  it('accepts any fixed coupon capped at ¥20, regardless of code family', () => {
    expect(isAnchorSafeCoupon(makeCoupon({ code: 'WELCOME20', discountType: 'fixed_amount', discountValue: 2000 }))).toBe(true)
    expect(isAnchorSafeCoupon(makeCoupon({ code: 'REFERRAL10', discountType: 'fixed_amount', discountValue: 1000 }))).toBe(true)
  })

  it('rejects percentage coupons and oversized fixed coupons', () => {
    expect(isAnchorSafeCoupon(makeCoupon({ code: 'WELCOME50', discountValue: 50 }))).toBe(false)
    expect(isAnchorSafeCoupon(makeCoupon({ code: 'INVITE_REWARD', discountType: 'fixed_amount', discountValue: 5000 }))).toBe(false)
  })
})

describe('eligible-coupon filtering recipe (F4 revised + generalized 2026-10-12)', () => {
  // Mirrors the page-level memo: on 'single', ONLY anchor-safe coupons
  // (fixed ≤ ¥20, any family) survive — legacy percentage WELCOME codes and
  // big reward coupons are both excluded.
  it('getBestCoupon returns null when only a legacy percentage welcome coupon exists on the anchor plan', () => {
    const all = [makeCoupon({ code: 'WELCOME50' })]
    const eligible = all.filter(isAnchorSafeCoupon)
    expect(getBestCoupon(eligible, 8800)).toBeNull()
  })

  it('canonical fixed welcome coupon rides the anchor plan (8800 → 6800)', () => {
    const all = [
      makeCoupon({ id: 'w20', code: 'WELCOME20', discountType: 'fixed_amount', discountValue: 2000 }),
      makeCoupon({ id: 'w50', code: 'WELCOME50', discountValue: 50 }),
    ]
    const eligible = all.filter(isAnchorSafeCoupon)
    expect(eligible.map((c) => c.code)).toEqual(['WELCOME20'])
    const best = getBestCoupon(eligible, 8800)
    expect(best?.code).toBe('WELCOME20')
    expect(calculateDiscount(best, 8800)).toBe(2000)
    expect(8800 - calculateDiscount(best, 8800)).toBe(6800)
  })

  it('a small non-welcome fixed coupon may ride the anchor plan', () => {
    const all = [makeCoupon({ code: 'REFERRAL20', discountType: 'fixed_amount', discountValue: 2000 })]
    const eligible = all.filter(isAnchorSafeCoupon)
    expect(getBestCoupon(eligible, 8800)?.code).toBe('REFERRAL20')
  })

  it('a non-welcome percentage coupon no longer rides the anchor plan', () => {
    const all = [makeCoupon({ code: 'PROMO10', discountType: 'percentage', discountValue: 10 })]
    const eligible = all.filter(isAnchorSafeCoupon)
    expect(getBestCoupon(eligible, 8800)).toBeNull()
  })

  it('a big fixed reward coupon can never ride the anchor plan', () => {
    const all = [makeCoupon({ code: 'INVITE_REWARD', discountType: 'fixed_amount', discountValue: 5000 })]
    const eligible = all.filter(isAnchorSafeCoupon)
    expect(getBestCoupon(eligible, 8800)).toBeNull()
  })

  it('getBestCoupon applies the welcome coupon on eligible plans', () => {
    const all = [makeCoupon({ code: 'WELCOME50', discountValue: 50 })]
    const eligible = isWelcomeCouponAutoApplyEligible('pack_3')
      ? all
      : all.filter(isAnchorSafeCoupon)
    expect(getBestCoupon(eligible, 21100)?.code).toBe('WELCOME50')
  })

  it('D2: welcome coupon auto-apply recipe stays honest on 悦聚月卡', () => {
    // Mirrors the page memo chain for vip_monthly: the WELCOME family is NOT
    // filtered out, so the best-coupon pick + discount math apply once to the
    // first purchase at the server-derived monthly price (9800 → ¥49 saved).
    const all = [makeCoupon({ code: 'WELCOME50', discountValue: 50 })]
    const eligible = isWelcomeCouponAutoApplyEligible('vip_monthly')
      ? all
      : all.filter(isAnchorSafeCoupon)
    const best = getBestCoupon(eligible, 9800)
    expect(best?.code).toBe('WELCOME50')
    expect(calculateDiscount(best, 9800)).toBe(4900)
  })
})

// ─── D2: checkout feature flags (2026-10-11) ───────────────────────────────

describe('resolvePaymentCheckoutFlags (D2/D3 fail-closed flags)', () => {
  it('reads both flags as false when the user or features are absent', () => {
    expect(resolvePaymentCheckoutFlags(undefined)).toEqual({
      checkoutSubscriptionUpsellEnabled: false,
      preRevealRefundEnabled: false,
    })
    expect(resolvePaymentCheckoutFlags(null)).toEqual({
      checkoutSubscriptionUpsellEnabled: false,
      preRevealRefundEnabled: false,
    })
    expect(resolvePaymentCheckoutFlags({})).toEqual({
      checkoutSubscriptionUpsellEnabled: false,
      preRevealRefundEnabled: false,
    })
    expect(resolvePaymentCheckoutFlags({ features: {} })).toEqual({
      checkoutSubscriptionUpsellEnabled: false,
      preRevealRefundEnabled: false,
    })
  })

  it('reads true only for strict boolean true', () => {
    expect(
      resolvePaymentCheckoutFlags({
        features: { checkoutSubscriptionUpsellEnabled: true, preRevealRefundEnabled: true },
      }),
    ).toEqual({ checkoutSubscriptionUpsellEnabled: true, preRevealRefundEnabled: true })

    // Truthy non-boolean wire junk stays OFF (fail-closed).
    const flags = resolvePaymentCheckoutFlags({
      features: { checkoutSubscriptionUpsellEnabled: 1, preRevealRefundEnabled: 'yes' },
    } as never)
    expect(flags.checkoutSubscriptionUpsellEnabled).toBe(false)
    expect(flags.preRevealRefundEnabled).toBe(false)
  })
})

// ─── D2: 悦聚月卡 offer resolution (fail-closed) ───────────────────────────

describe('resolveVipMonthlyOffer (D2)', () => {
  it('returns null for missing/garbage payloads', () => {
    expect(resolveVipMonthlyOffer(undefined)).toBeNull()
    expect(resolveVipMonthlyOffer(null)).toBeNull()
    expect(resolveVipMonthlyOffer('nope')).toBeNull()
    expect(resolveVipMonthlyOffer({})).toBeNull()
    expect(resolveVipMonthlyOffer({ plans: [] })).toBeNull()
  })

  it('returns null when no monthly subscription plan is carried (fail-closed)', () => {
    const payload = {
      plans: [
        { planType: 'event_single', priceInCents: 8800 },
        { planType: 'pack_3', priceInCents: 21100 },
        { planType: 'pack_6', priceInCents: 37000 },
        { planType: 'quarterly', priceInCents: 29400, durationDays: 90 },
      ],
    }
    expect(resolveVipMonthlyOffer(payload)).toBeNull()
  })

  it('resolves the seed-shaped monthly row from the legacy plans array', () => {
    // Today's ritual-context already returns pricing_settings rows; the seed
    // uses plan_type `monthly` (alias normalization covers vip_monthly too).
    const offer = resolveVipMonthlyOffer({
      plans: [
        {
          planType: 'monthly',
          displayName: '悦聚月卡',
          description: '每月 6 场局，说走就走',
          priceInCents: 9800,
          durationDays: 30,
        },
      ],
    })
    expect(offer).not.toBeNull()
    expect(offer?.priceInCents).toBe(9800)
    expect(offer?.durationDays).toBe(30)
    expect(offer?.displayName).toBe('悦聚月卡')
    expect(offer?.description).toBe('每月 6 场局，说走就走')
    // No structured quota on legacy plan rows — the anchor stays derivable-only.
    expect(offer?.eventQuota).toBeNull()
  })

  it('resolves the additive subscriptionPlans field (priceCents + quota)', () => {
    const offer = resolveVipMonthlyOffer({
      subscriptionPlans: [
        { planType: 'vip_quarterly', priceCents: 29400, durationDays: 90, eventQuota: 18 },
        { planType: 'vip_monthly', priceCents: 9800, durationDays: 30, eventQuota: 6 },
      ],
    })
    expect(offer?.priceInCents).toBe(9800)
    expect(offer?.eventQuota).toBe(6)
    expect(offer?.durationDays).toBe(30)
  })

  it('rejects monthly plans without a positive numeric price (never hardcode)', () => {
    expect(resolveVipMonthlyOffer({ plans: [{ planType: 'vip_monthly' }] })).toBeNull()
    expect(resolveVipMonthlyOffer({ plans: [{ planType: 'vip_monthly', priceInCents: 0 }] })).toBeNull()
    expect(resolveVipMonthlyOffer({ plans: [{ planType: 'vip_monthly', priceInCents: -9800 }] })).toBeNull()
    expect(resolveVipMonthlyOffer({ plans: [{ planType: 'vip_monthly', priceInCents: '9800' }] })).toBeNull()
  })

  it('falls back to the canonical 悦聚月卡 display name when the server omits it', () => {
    const offer = resolveVipMonthlyOffer({ plans: [{ planType: 'monthly', priceInCents: 9800 }] })
    expect(offer?.displayName).toBe('悦聚月卡')
    expect(offer?.description).toBeNull()
  })
})

describe('getVipMonthlyAnchorLabel (D2 derived anchor)', () => {
  it('derives the per-event anchor from price and quota (9800/6 → ¥16)', () => {
    const offer = resolveVipMonthlyOffer({
      subscriptionPlans: [{ planType: 'vip_monthly', priceCents: 9800, eventQuota: 6 }],
    })
    expect(getVipMonthlyAnchorLabel(offer)).toBe('每次约 ¥16')
  })

  it('returns null when quota is absent or non-positive — derived or omitted', () => {
    expect(getVipMonthlyAnchorLabel(null)).toBeNull()
    expect(
      getVipMonthlyAnchorLabel(
        resolveVipMonthlyOffer({ plans: [{ planType: 'monthly', priceInCents: 9800 }] }),
      ),
    ).toBeNull()
    expect(
      getVipMonthlyAnchorLabel({
        displayName: '悦聚月卡',
        description: null,
        priceInCents: 9800,
        durationDays: 30,
        eventQuota: 0,
      }),
    ).toBeNull()
  })
})

describe('buildPlansShown (D2 dynamic plan_selector_impression metadata)', () => {
  it('matches the legacy three-plan render list when the upsell is absent', () => {
    expect(buildPlansShown(false)).toEqual(['single', 'pack_3', 'pack_6'])
  })

  it('prepends vip_monthly when the monthly card is rendered', () => {
    expect(buildPlansShown(true)).toEqual(['vip_monthly', 'single', 'pack_3', 'pack_6'])
  })
})

// ─── D2/D3 page wiring contract (source scan, mirrors usePaymentCoupon) ────

describe('resolveRefundNarrativeBucket (转化 P0d, fail-closed)', () => {
  it('resolves the exact literals 0 and 1', () => {
    expect(resolveRefundNarrativeBucket({ refundNarrativeBucket: 0 })).toBe(0)
    expect(resolveRefundNarrativeBucket({ refundNarrativeBucket: 1 })).toBe(1)
  })

  it('absent field / null / undefined payload collapses to null (control arm)', () => {
    expect(resolveRefundNarrativeBucket({})).toBeNull()
    expect(resolveRefundNarrativeBucket(null)).toBeNull()
    expect(resolveRefundNarrativeBucket(undefined)).toBeNull()
  })

  it('malformed values (out-of-range number, string, boolean) collapse to null — never promoted to treatment', () => {
    expect(resolveRefundNarrativeBucket({ refundNarrativeBucket: 2 as never })).toBeNull()
    expect(resolveRefundNarrativeBucket({ refundNarrativeBucket: '1' as never })).toBeNull()
    expect(resolveRefundNarrativeBucket({ refundNarrativeBucket: true as never })).toBeNull()
  })
})

describe('event-ticket-payment page wiring contract (D2/D3)', () => {
  const pageSource = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '..', 'index.tsx'),
    'utf8',
  )

  it('plansShown metadata is dynamic — no hardcoded three-plan literal', () => {
    expect(pageSource).toContain('plansShown: buildPlansShown(')
    expect(pageSource).not.toContain("plansShown: ['single', 'pack_3', 'pack_6']")
  })

  it('reads both checkout flags via the fail-closed resolver', () => {
    expect(pageSource).toContain('resolvePaymentCheckoutFlags(user)')
    expect(pageSource).toContain('checkoutSubscriptionUpsellEnabled')
    expect(pageSource).toContain('preRevealRefundEnabled')
  })

  it('gates the monthly card on the server-carried offer, not the flag alone', () => {
    expect(pageSource).toContain('resolveVipMonthlyOffer(ritualContext)')
    expect(pageSource).toContain('vipMonthlyPlan={vipMonthlyPlanView}')
  })

  it('creates the 悦聚月卡 payment with the server-accepted plan identifier', () => {
    expect(pageSource).toContain("type: 'vip_monthly'")
    expect(pageSource).toContain("planId: 'vip_monthly'")
  })

  it('books the pool seat after a confirmed 悦聚月卡 payment (honest ceremony)', () => {
    expect(pageSource).toContain('registerForPool(apiRequest, poolId')
  })

  it('renders the D3 refund-guarantee line only under preRevealRefundEnabled', () => {
    expect(pageSource).toContain('<RefundGuaranteeLine visible={preRevealRefundEnabled}')
  })

  it('转化 P0d: bucket 经 fail-closed resolver 透传；全量决策后 flag ON 即两行（2026-10-21 用户拍板砍灰度）', () => {
    expect(pageSource).toContain('resolveRefundNarrativeBucket(ritualContext)')
    expect(pageSource).toContain('showRefundNarrativeStack = preRevealRefundEnabled')
    expect(pageSource).not.toContain('showRefundNarrativeStack = preRevealRefundEnabled &&')
    expect(pageSource).toContain('narrative={showRefundNarrativeStack}')
  })

  it('转化 P0d: spacer grows pixel-exact for the two-line stack (CSS-reserved, no JS measurement)', () => {
    expect(pageSource).toContain('ticket-bottom-spacer--with-guarantee-stack')
    expect(pageSource).not.toContain('getBoundingClientRect')
  })

  it('转化 P0d: guardrail exposure meters once per page visit with enum-only bucket metadata', () => {
    expect(pageSource).toContain('ticket_refund_guarantee_impression')
    expect(pageSource).toContain('refundNarrativeBucket: refundNarrativeBucket ?? 0')
    expect(pageSource).toContain('hasTrackedRefundGuaranteeImpressionRef')
  })
})

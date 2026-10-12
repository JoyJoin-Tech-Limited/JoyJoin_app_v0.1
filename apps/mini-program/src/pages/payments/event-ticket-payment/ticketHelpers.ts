import { normalizeSubscriptionPlanType, type AuthUserResponse, type UserCouponSummary } from '@shared/api'
import { BUDGET_TIER_BY_ID, formatBudgetTier } from '@shared/budgetTiers'
import { getIntentLabel } from '@shared/constants'
import type { ApiError } from '../../../lib/api/api'

/** Pricing-plan DTO from GET /api/payments/ritual-context. */
export interface PricingPlan {
  planType: string
  priceInCents: number
  originalPriceInCents?: number | null
}

/**
 * Selectable plans on the first-event checkout. `vip_monthly` (D2 悦聚月卡
 * upsell, 2026-10-11) is only renderable when the
 * `checkoutSubscriptionUpsellEnabled` flag is on AND ritual-context carries a
 * monthly subscription plan — see resolveVipMonthlyOffer.
 */
export type SelectedPlan = 'single' | 'pack_3' | 'pack_6' | 'vip_monthly'

/**
 * Raw ritual-context payload. Both fields are additive-tolerant: old servers
 * only return `plans`; the subscription upsell batch adds `subscriptionPlans`.
 * Wire truth (apps/server routes/domains/payments.ts, 2026-10-11): each row
 * carries `planType: 'monthly' | 'quarterly'` + `priceInCents` +
 * `durationDays` (+ displayName/description) — the event quota lives in the
 * plan description copy, NOT in a structured field. `resolveVipMonthlyOffer`
 * additionally tolerates legacy aliases (`vip_*` plan types, `priceCents`,
 * structured quota keys) so older payloads keep resolving.
 */
export interface RitualContextPayload {
  plans?: PricingPlan[]
  subscriptionPlans?: Array<Record<string, unknown>>
}

/**
 * Payment-checkout feature flags (D2/D3, 2026-10-11), exposed by the server
 * on GET /api/auth/user → `features`. Both default OFF and are fail-closed
 * here: absent, undefined, or non-boolean values all read as false. The
 * shared AuthUserResponse type can lag the wire while the server rolls out,
 * so read through a widened record instead of trusting the static type.
 */
export interface PaymentCheckoutFeatureFlags {
  checkoutSubscriptionUpsellEnabled: boolean
  preRevealRefundEnabled: boolean
}

export function resolvePaymentCheckoutFlags(
  user: Pick<AuthUserResponse, 'features'> | null | undefined,
): PaymentCheckoutFeatureFlags {
  const features = (user?.features ?? {}) as Record<string, unknown>
  return {
    checkoutSubscriptionUpsellEnabled: features.checkoutSubscriptionUpsellEnabled === true,
    preRevealRefundEnabled: features.preRevealRefundEnabled === true,
  }
}

/**
 * 悦聚月卡 upsell offer resolved from GET /api/payments/ritual-context (D2).
 *
 * Fail-closed by design: the monthly card renders ONLY when the server
 * carries a monthly subscription plan with a positive price. Unlike the
 * legacy pack prices (which keep the pre-seed hardcoded fallbacks at
 * index.tsx), the monthly price must come from server data — otherwise the
 * card does not render at all.
 *
 * Resolution order: the additive `subscriptionPlans` array first, then the
 * legacy `plans` array (whose seed rows use plan_type `monthly`/`quarterly`;
 * `normalizeSubscriptionPlanType` covers both the `vip_*` and bare aliases).
 */
export interface VipMonthlyOffer {
  displayName: string
  description: string | null
  priceInCents: number
  durationDays: number | null
  eventQuota: number | null
}

function pickPositiveInt(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.floor(value)
    }
  }
  return null
}

export function resolveVipMonthlyOffer(ritualContext: unknown): VipMonthlyOffer | null {
  if (!ritualContext || typeof ritualContext !== 'object') return null
  const raw = ritualContext as { subscriptionPlans?: unknown; plans?: unknown }
  const candidates: unknown[] = [
    ...(Array.isArray(raw.subscriptionPlans) ? raw.subscriptionPlans : []),
    ...(Array.isArray(raw.plans) ? raw.plans : []),
  ]
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const record = candidate as Record<string, unknown>
    const planType = typeof record.planType === 'string' ? record.planType : undefined
    if (normalizeSubscriptionPlanType(planType) !== 'monthly') continue
    const priceInCents = pickPositiveInt(record.priceCents, record.priceInCents)
    if (priceInCents === null) continue
    return {
      displayName:
        typeof record.displayName === 'string' && record.displayName.trim() !== ''
          ? record.displayName.trim()
          : '悦聚月卡',
      description:
        typeof record.description === 'string' && record.description.trim() !== ''
          ? record.description.trim()
          : null,
      priceInCents,
      durationDays: pickPositiveInt(record.durationDays),
      eventQuota: pickPositiveInt(record.eventQuota, record.quota, record.eventsPerPeriod),
    }
  }
  return null
}

/**
 * Per-event anchor line for the monthly card (e.g. 「每次约 ¥16」), derived
 * from priceInCents/eventQuota. Returns null when the server carries no
 * usable quota — the anchor is derived or omitted, never hardcoded.
 */
export function getVipMonthlyAnchorLabel(offer: VipMonthlyOffer | null | undefined): string | null {
  if (!offer || !offer.eventQuota || offer.eventQuota <= 0) return null
  return `每次约 ${formatPrice(Math.floor(offer.priceInCents / offer.eventQuota))}`
}

// ─── HIGH-1 (2026-10-12): active-subscription suppression for the upsell ──

/**
 * Subscription-status query key + payload for GET /api/subscription/status
 * (`{ hasActiveSubscription, subscription?, daysRemaining? }`). No other
 * mini-program surface consumed this endpoint before the D2 checkout, so the
 * key + type live here next to their only consumer; promote to
 * `@shared/api/payments` if a second surface ever needs them.
 */
export const SUBSCRIPTION_STATUS_QUERY_KEY = ['mini-program', 'subscription-status'] as const

export interface SubscriptionStatusPayload {
  hasActiveSubscription?: boolean
}

/**
 * True only on an AFFIRMATIVE active signal. Loading, errored, and malformed
 * reads all resolve false — the upsell card fail-opens to rendered and the
 * server-side 409 SUBSCRIPTION_ALREADY_ACTIVE remains the real backstop.
 */
export function isSubscriptionActive(payload: SubscriptionStatusPayload | null | undefined): boolean {
  return payload?.hasActiveSubscription === true
}

/**
 * 409 SUBSCRIPTION_ALREADY_ACTIVE surface copy: prefer the server's own
 * Chinese message (code-contract safety net — an unmapped code must never
 * collapse to the generic 「出了点问题」). Fall back to an honest local line
 * only when the wire carries nothing user-facing. Either way the copy must
 * stay truthful: the payment did NOT go through; the card is already active.
 */
export function resolveSubscriptionConflictMessage(error: unknown): string {
  const data = (error as ApiError | undefined)?.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const message = (data as { message?: unknown }).message
    if (typeof message === 'string') {
      const trimmed = message.trim()
      // User-facing = non-empty Chinese text, not a bare machine code.
      if (trimmed !== '' && !/^[A-Z][A-Z0-9_]*$/.test(trimmed) && /[\u4e00-\u9fff]/.test(trimmed)) {
        return trimmed
      }
    }
  }
  return '你的悦聚月卡还在有效期内，无需再次购买'
}

// ─── HIGH-2 (2026-10-12): terminal seat-booking failures for the vip flow ──

/**
 * Registration rejections that can NEVER succeed on retry for THIS pool.
 * Mirrors the availability codes emitted by the register route
 * (`describePoolRegistrationAvailability`): full / closed / cancelled /
 * deadline-passed are terminal. When the 悦聚月卡 payment already went
 * through, the card stays valid for OTHER pools — so the honest surface is a
 * terminal state + 「去看看其他局」, never an infinite 补上报名 retry loop.
 *
 * Deliberately absent:
 * - ALREADY_REGISTERED — a terminal JOINED state, handled as success upstream.
 * - REGISTRATION_FAILED / 5xx / network errors — transient; keep the retry.
 */
export type TerminalRegistrationCode =
  | 'POOL_FULL'
  | 'POOL_CLOSED'
  | 'POOL_CANCELLED'
  | 'REGISTRATION_DEADLINE_PASSED'

export interface TerminalRegistrationBlock {
  code: TerminalRegistrationCode
  /** true = the 悦聚月卡 payment was already confirmed and only the seat
   *  booking failed; false = blocked before any charge (pre-charge guard). */
  paid: boolean
}

export function getTerminalRegistrationCode(error: unknown): TerminalRegistrationCode | null {
  const data = (error as ApiError | undefined)?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const code = (data as { code?: unknown }).code
  if (
    code === 'POOL_FULL' ||
    code === 'POOL_CLOSED' ||
    code === 'POOL_CANCELLED' ||
    code === 'REGISTRATION_DEADLINE_PASSED'
  ) {
    return code
  }
  return null
}

/**
 * System-UI copy for the terminal surface. Zero emoji, no urgency framing.
 * The paid variant leads with the truthful 月卡已生效 — the subscription
 * payment succeeded and no event quota was consumed; only the seat booking
 * failed. The unpaid variant must NOT claim the card is active.
 */
export function getTerminalRegistrationCopy(block: TerminalRegistrationBlock): {
  title: string
  body: string
} {
  const title =
    block.code === 'POOL_FULL'
      ? '这桌刚刚满员'
      : block.code === 'POOL_CANCELLED'
        ? '这场活动已取消'
        : '这场报名已截止'
  const body = block.paid
    ? '你的悦聚月卡已生效，这次名额没有消耗。月卡在其他场局照样能用，去挑一场还在报名的吧。'
    : '这次还没有扣款。去看看其他还在报名的局吧。'
  return { title, body }
}

/**
 * The actual rendered plan list, in render order — feeds the
 * `plan_selector_impression` analytics metadata so it stays truthful when the
 * monthly upsell card is on the page (D2 stale-metadata fix).
 */
export function buildPlansShown(vipMonthlyRendered: boolean): SelectedPlan[] {
  return vipMonthlyRendered
    ? ['vip_monthly', 'single', 'pack_3', 'pack_6']
    : ['single', 'pack_3', 'pack_6']
}

export function formatPrice(cents: number): string {
  return `¥${(cents / 100).toFixed(0)}`
}

/**
 * Budget chip label. Draft values are canonical tier ids after the tier
 * cutover, so resolve them to the registry display label (which carries the
 * required per-person unit, e.g. `150-200/人`). Legacy labels keep their old
 * `¥`-prefixed rendering.
 */
export function formatBudgetLabel(budget: string): string {
  if (!budget || budget.startsWith('¥')) return budget
  const tier = BUDGET_TIER_BY_ID.get(budget)
  return `¥${tier ? formatBudgetTier(tier) : budget}`
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

/** True when a coupon code belongs to the 见面礼 welcome family. */
export function isWelcomeCouponCode(code?: string | null): boolean {
  return (code?.toUpperCase?.() ?? '').startsWith('WELCOME')
}

/**
 * Audit F4 (interim, client-side gate): the 见面礼 welcome coupon never
 * auto-applies to the anchor 单场局票 plan — the first transaction stays
 * full-price so the anchor product doesn't train discount anchoring.
 * 连局包 and the 悦聚卡 subscription plans (D2: vip_monthly) keep the existing
 * auto-apply behaviour. The coupon applies ONCE to this first purchase —
 * 悦聚月卡 renewal is manual at full price, so no copy may imply a recurring
 * discount. Server-side per-plan enforcement is a later schema change; a
 * future manual coupon picker for 单场局票 stays unaffected.
 */
export function isWelcomeCouponAutoApplyEligible(plan: string): boolean {
  return plan !== 'single'
}

export function findWelcomeCoupon(coupons: UserCouponSummary[]): UserCouponSummary | null {
  const welcomes = coupons.filter((c) => {
    return isWelcomeCouponCode(c.code) && c.status === 'available' && !c.isUsed
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

export function getDisplayLabel(value: string, category: 'intent' | 'language' | 'alcohol' | 'other'): string {
  if (!value) return value
  if (category === 'intent') {
    return getIntentLabel(value)
  }
  if (category === 'language') {
    return LANGUAGE_LABELS[value] ?? value
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

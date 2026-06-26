import type { ApiTransport } from './core.js'

export interface PricingPlan {
  id: string
  planType: string
  displayName: string
  displayNameEn?: string
  description?: string
  price: number
  originalPrice?: number | null
  durationDays?: number
  isActive?: boolean
  isFeatured?: boolean
}

export type SubscriptionPlanType = 'monthly' | 'quarterly'
export type VipSubscriptionPlanKey = 'vip_monthly' | 'vip_quarterly'
export type EventPackPlanKey = 'pack_3' | 'pack_6'
export type SubscriptionPlanIdentifier = SubscriptionPlanType | VipSubscriptionPlanKey

const EVENT_PACK_PLAN_TYPE_SET = new Set<EventPackPlanKey>(['pack_3', 'pack_6'])

const SUBSCRIPTION_PLAN_IDENTIFIER_MAP: Record<SubscriptionPlanIdentifier, SubscriptionPlanType> = {
  monthly: 'monthly',
  quarterly: 'quarterly',
  vip_monthly: 'monthly',
  vip_quarterly: 'quarterly',
}

interface RawPricingPlan {
  id?: string | number
  planType?: string
  displayName?: string
  name?: string
  displayNameEn?: string
  nameEn?: string
  description?: string
  price?: number | string
  originalPrice?: number | string | null
  durationDays?: number | string
  isActive?: boolean
  isFeatured?: boolean
  [key: string]: unknown
}

export type UserCouponStatus = 'available' | 'used' | 'expired'

interface RawUserCoupon {
  id?: string
  couponId?: string | null
  coupon_id?: string | null
  code?: string
  discountType?: string
  discount_type?: string
  discountValue?: number | string | null
  discount_value?: number | string | null
  validFrom?: string | null
  valid_from?: string | null
  validUntil?: string | null
  valid_until?: string | null
  isUsed?: boolean
  is_used?: boolean
  usedAt?: string | null
  used_at?: string | null
  source?: string | null
  sourceId?: string | null
  source_id?: string | null
  createdAt?: string | null
  created_at?: string | null
  [key: string]: unknown
}

export interface UserCouponsResponse {
  count: number
  availableCount: number
  coupons: UserCouponSummary[]
}

export interface UserCouponSummary {
  id: string
  couponId?: string | null
  code?: string
  discountType?: string
  discountValue?: number
  validFrom?: string | null
  validUntil?: string | null
  isUsed: boolean
  usedAt?: string | null
  source?: string | null
  sourceId?: string | null
  createdAt?: string | null
  status: UserCouponStatus
  [key: string]: unknown
}

type RawUserCouponsResponse =
  | RawUserCoupon[]
  | {
      count?: unknown
      coupons?: RawUserCoupon[]
    }

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

export function normalizeSubscriptionPlanType(
  planType: string | null | undefined
): SubscriptionPlanType | null {
  if (typeof planType !== 'string') {
    return null
  }

  const normalized = planType.trim() as SubscriptionPlanIdentifier
  return SUBSCRIPTION_PLAN_IDENTIFIER_MAP[normalized] ?? null
}

export function isEventPackPlanType(
  planType: string | null | undefined
): planType is EventPackPlanKey {
  if (typeof planType !== 'string') {
    return false
  }

  return EVENT_PACK_PLAN_TYPE_SET.has(planType.trim() as EventPackPlanKey)
}

function pricingPlanMatches(plan: Pick<PricingPlan, 'planType'>, targetPlanType: string): boolean {
  const normalizedPlanType = normalizeSubscriptionPlanType(plan.planType)
  const normalizedTargetPlanType = normalizeSubscriptionPlanType(targetPlanType)

  if (normalizedPlanType && normalizedTargetPlanType) {
    return normalizedPlanType === normalizedTargetPlanType
  }

  return plan.planType === targetPlanType
}

export function findPricingPlan(
  pricingPlans: PricingPlan[] | null | undefined,
  targetPlanType: string
): PricingPlan | undefined {
  return pricingPlans?.find((plan) => pricingPlanMatches(plan, targetPlanType))
}

function isCouponExpired(validUntil?: string | null): boolean {
  if (!validUntil) {
    return false
  }

  const expiryTime = new Date(validUntil).getTime()
  if (Number.isNaN(expiryTime)) {
    return false
  }

  return expiryTime < Date.now()
}

function normalizeUserCoupon(rawCoupon: RawUserCoupon): UserCouponSummary {
  const validUntil = rawCoupon.validUntil ?? rawCoupon.valid_until ?? null
  const isUsed = Boolean(rawCoupon.isUsed ?? rawCoupon.is_used)
  const status: UserCouponStatus = isUsed
    ? 'used'
    : isCouponExpired(validUntil)
      ? 'expired'
      : 'available'

  return {
    ...rawCoupon,
    id: String(rawCoupon.id ?? ''),
    couponId: rawCoupon.couponId ?? rawCoupon.coupon_id ?? null,
    discountType: rawCoupon.discountType ?? rawCoupon.discount_type,
    discountValue: parseNumber(rawCoupon.discountValue ?? rawCoupon.discount_value),
    validFrom: rawCoupon.validFrom ?? rawCoupon.valid_from ?? null,
    validUntil,
    isUsed,
    usedAt: rawCoupon.usedAt ?? rawCoupon.used_at ?? null,
    source: rawCoupon.source ?? null,
    sourceId: rawCoupon.sourceId ?? rawCoupon.source_id ?? null,
    createdAt: rawCoupon.createdAt ?? rawCoupon.created_at ?? null,
    status,
  }
}

function normalizeUserCouponsResponse(rawResponse: RawUserCouponsResponse): UserCouponsResponse {
  const rawCoupons = Array.isArray(rawResponse)
    ? rawResponse
    : Array.isArray(rawResponse?.coupons)
      ? rawResponse.coupons
      : []

  const coupons = rawCoupons.map(normalizeUserCoupon)
  const availableCount = coupons.filter((coupon) => coupon.status === 'available').length
  const explicitCount = Array.isArray(rawResponse)
    ? undefined
    : parseNumber(rawResponse?.count)

  return {
    count: explicitCount ?? coupons.length,
    availableCount,
    coupons,
  }
}

function normalizePricingPlan(rawPlan: RawPricingPlan): PricingPlan | null {
  const price = parseNumber(rawPlan.price)
  if (price === undefined) {
    return null
  }

  const displayName =
    typeof rawPlan.displayName === 'string' && rawPlan.displayName.trim() !== ''
      ? rawPlan.displayName
      : typeof rawPlan.name === 'string' && rawPlan.name.trim() !== ''
        ? rawPlan.name
        : String(rawPlan.planType ?? '')

  return {
    id: String(rawPlan.id ?? rawPlan.planType ?? ''),
    planType: String(rawPlan.planType ?? ''),
    displayName,
    displayNameEn:
      typeof rawPlan.displayNameEn === 'string' && rawPlan.displayNameEn.trim() !== ''
        ? rawPlan.displayNameEn
        : typeof rawPlan.nameEn === 'string' && rawPlan.nameEn.trim() !== ''
          ? rawPlan.nameEn
          : undefined,
    description: typeof rawPlan.description === 'string' ? rawPlan.description : undefined,
    price,
    originalPrice: parseNumber(rawPlan.originalPrice) ?? null,
    durationDays: parseNumber(rawPlan.durationDays),
    isActive: typeof rawPlan.isActive === 'boolean' ? rawPlan.isActive : undefined,
    isFeatured: typeof rawPlan.isFeatured === 'boolean' ? rawPlan.isFeatured : undefined,
  }
}

export function getPricing(api: ApiTransport): Promise<PricingPlan[]> {
  return api<RawPricingPlan[]>({ path: '/api/pricing' }).then((plans) =>
    Array.isArray(plans)
      ? plans.map(normalizePricingPlan).filter((plan): plan is PricingPlan => plan !== null)
      : []
  )
}

export function getUserCoupons(api: ApiTransport): Promise<UserCouponsResponse> {
  return api<RawUserCouponsResponse>({ path: '/api/user/coupons' }).then(normalizeUserCouponsResponse)
}

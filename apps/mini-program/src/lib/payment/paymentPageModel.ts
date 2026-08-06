import {
  findPricingPlan,
  isEventPackPlanType,
  type EventPackPlanKey,
  type PricingPlan,
  type UserCouponSummary,
  type VipSubscriptionPlanKey,
} from '@shared/api'

export type MiniProgramPaymentPlanKey = VipSubscriptionPlanKey | EventPackPlanKey

interface MiniProgramPaymentPlanMeta {
  badge: string
  supportCopy: string
  isEventPack: boolean
}

interface MiniProgramPaymentAmountSummaryRow {
  kind: 'selection' | 'original' | 'discount' | 'total'
  label: string
  value: string
}

interface MiniProgramPaymentAmountSummary {
  payableAmount: number
  rows: MiniProgramPaymentAmountSummaryRow[]
}

interface MiniProgramPaymentCouponDisplayModel {
  id: string
  code: string
  title: string
  description: string
}

const DEFAULT_PAYMENT_PLAN_META: Record<MiniProgramPaymentPlanKey, Omit<MiniProgramPaymentPlanMeta, 'isEventPack'>> = {
  vip_monthly: {
    badge: '近期常用',
    supportCopy: '适合最近一阵子想连续报名的人',
  },
  vip_quarterly: {
    badge: '更省心',
    supportCopy: '适合这段时间想稳定多参加活动的人',
  },
  pack_3: {
    badge: '先试试看',
    supportCopy: '先补回次数，再按自己的节奏继续报名',
  },
  pack_6: {
    badge: '更灵活',
    supportCopy: '按次参加但希望留出更充足余量',
  },
}

export const DEFAULT_MINI_PROGRAM_PAYMENT_PLANS: Record<MiniProgramPaymentPlanKey, PricingPlan> = {
  vip_monthly: {
    id: 'vip_monthly',
    planType: 'vip_monthly',
    displayName: '悦聚月卡',
    description: '每月 6 场局，说走就走',
    price: 98,
  },
  vip_quarterly: {
    id: 'vip_quarterly',
    planType: 'vip_quarterly',
    displayName: '悦聚季卡',
    description: '一季 18 场局，场场有人陪',
    price: 294,
  },
  pack_3: {
    id: 'pack_3',
    planType: 'pack_3',
    displayName: '三连局包',
    description: '3 场局名额，先认识三桌新朋友',
    price: 211,
  },
  pack_6: {
    id: 'pack_6',
    planType: 'pack_6',
    displayName: '六连局包',
    description: '6 场局名额，慢慢玩成常客',
    price: 370,
  },
}

export function resolveMiniProgramPaymentPlans(
  pricingPlans: PricingPlan[],
): Record<MiniProgramPaymentPlanKey, PricingPlan> {
  return {
    vip_monthly: findPricingPlan(pricingPlans, 'vip_monthly') ?? DEFAULT_MINI_PROGRAM_PAYMENT_PLANS.vip_monthly,
    vip_quarterly: findPricingPlan(pricingPlans, 'vip_quarterly') ?? DEFAULT_MINI_PROGRAM_PAYMENT_PLANS.vip_quarterly,
    pack_3: findPricingPlan(pricingPlans, 'pack_3') ?? DEFAULT_MINI_PROGRAM_PAYMENT_PLANS.pack_3,
    pack_6: findPricingPlan(pricingPlans, 'pack_6') ?? DEFAULT_MINI_PROGRAM_PAYMENT_PLANS.pack_6,
  }
}

export function formatMiniProgramPaymentPrice(value: number): string {
  return `¥${value.toFixed(0)}`
}

export function getMiniProgramPaymentPlanMeta(
  planKey: MiniProgramPaymentPlanKey,
): MiniProgramPaymentPlanMeta {
  return {
    ...DEFAULT_PAYMENT_PLAN_META[planKey],
    isEventPack: isEventPackPlanType(planKey),
  }
}

export function buildMiniProgramPaymentAmountSummary(input: {
  plan: PricingPlan
  discountAmount: number
  finalAmount: number | null
  hasSelectedCoupon: boolean
}): MiniProgramPaymentAmountSummary {
  const payableAmount = input.finalAmount ?? input.plan.price
  const rows: MiniProgramPaymentAmountSummaryRow[] = [
    {
      kind: 'selection',
      label: '当前选择',
      value: input.plan.displayName,
    },
  ]

  if (input.plan.originalPrice) {
    rows.push({
      kind: 'original',
      label: '原价',
      value: formatMiniProgramPaymentPrice(input.plan.originalPrice),
    })
  }

  if (input.hasSelectedCoupon && input.discountAmount > 0) {
    rows.push({
      kind: 'discount',
      label: '优惠减免',
      value: `- ${formatMiniProgramPaymentPrice(input.discountAmount)}`,
    })
  }

  rows.push({
    kind: 'total',
    label: '应付金额',
    value: formatMiniProgramPaymentPrice(payableAmount),
  })

  return {
    payableAmount,
    rows,
  }
}

export function buildMiniProgramPaymentCouponDisplayModel(
  coupon: UserCouponSummary,
): MiniProgramPaymentCouponDisplayModel {
  const code = coupon.code ?? ''

  return {
    id: coupon.id,
    code,
    title: code || '优惠券',
    description:
      coupon.discountType === 'percentage'
        ? `${coupon.discountValue || 0}% 折扣`
        : `立减 ${formatMiniProgramPaymentPrice((coupon.discountValue || 0) / 100)}`,
  }
}
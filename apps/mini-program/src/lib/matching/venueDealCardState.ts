import type { VenueDealSummary } from '@shared/api'

/**
 * VenueDealCard 状态真值表（S3，Verifier 第 2 轮修订）。
 *
 * 关键区分：
 * - hasGuaranteedDeal        = 当前保底仍有效（权益被撤销后会变 false）
 * - hasGuaranteedDealBinding = 这桌确实基于保底绑定成局（撤销后仍为 true）
 * 只有前者会导致「撤销后整卡静默消失」，所以 adjusted 必须认两者之一。
 */
export interface VenueDealCardStateInput {
  deal?: VenueDealSummary | null
  hasGuaranteedDeal?: boolean
  hasGuaranteedDealBinding?: boolean
  venueAssignmentStatus?: string | null
  /** 真实 query/refetch 失败（页面仍有既有小组数据） */
  queryError?: boolean
  /** venueDealsEnabled flag：首个用户可见触点，默认暗发 */
  flagEnabled?: boolean
  isCollapsedGroup?: boolean
}

export type VenueDealCardState = 'hidden' | 'ticket' | 'locked' | 'adjusted' | 'error'

export function resolveVenueDealCardState(input: VenueDealCardStateInput): VenueDealCardState {
  if (!input.flagEnabled || input.isCollapsedGroup) return 'hidden'

  const assigned = input.venueAssignmentStatus === 'assigned'
  const hasPromise = input.hasGuaranteedDeal === true
  const hasBinding = input.hasGuaranteedDealBinding === true

  // 有权益就出票券：非保底池也一样，且优先于任何错误/承诺语义
  if (input.deal) return 'ticket'
  if (hasPromise && !assigned) return 'locked'
  if (input.queryError && (hasPromise || hasBinding)) return 'error'
  // 正常响应里 deal=null = 权益失效 / 被撤销 / 跨店，不是网络错误
  if (assigned && (hasPromise || hasBinding)) return 'adjusted'
  return 'hidden'
}

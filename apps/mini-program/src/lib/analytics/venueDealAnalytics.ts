import type { VenueDealSummary } from '@shared/api'
import { discoverAnalytics } from './discoverAnalytics'

/** 仅允许 id/枚举/耗时进入 venue-deal 分析；暗号、地址、用户文本永远不在参数类型里。 */
export interface VenueDealAnalyticsInput {
  poolId: string
  groupId: string
  deal: Pick<VenueDealSummary, 'id' | 'kind' | 'method'>
}

function metadata({ groupId, deal }: VenueDealAnalyticsInput) {
  return { groupId, dealId: deal.id, kind: deal.kind, method: deal.method }
}

export function trackVenueDealCardImpression(input: VenueDealAnalyticsInput): void {
  discoverAnalytics.track('deal_card_impression', input.poolId, metadata(input))
}

export function trackVenueDealCardTap(input: VenueDealAnalyticsInput): void {
  discoverAnalytics.track('deal_card_tap', input.poolId, metadata(input))
}

export function trackVenueDealRedeemPageOpen(input: VenueDealAnalyticsInput): void {
  discoverAnalytics.track('redeem_page_open', input.poolId, metadata(input))
}

export function trackVenueDealCredentialPresent(
  input: VenueDealAnalyticsInput,
  secondsFromOpen: number,
): void {
  discoverAnalytics.track('deal_credential_present', input.poolId, {
    ...metadata(input),
    secondsFromOpen: Number.isFinite(secondsFromOpen) ? Math.max(0, Math.floor(secondsFromOpen)) : 0,
  })
}

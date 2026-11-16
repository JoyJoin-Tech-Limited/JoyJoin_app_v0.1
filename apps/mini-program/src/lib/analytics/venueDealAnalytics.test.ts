import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  trackVenueDealCardImpression,
  trackVenueDealCardTap,
  trackVenueDealCredentialPresent,
  trackVenueDealRedeemPageOpen,
} from './venueDealAnalytics'
import { discoverAnalytics } from './discoverAnalytics'

vi.mock('./discoverAnalytics', () => ({ discoverAnalytics: { track: vi.fn() } }))

const input = {
  poolId: 'pool-1', groupId: 'group-1',
  deal: { id: 'deal-1', kind: 'discount' as const, method: 'code' as const },
}

describe('venueDealAnalytics', () => {
  beforeEach(() => vi.clearAllMocks())

  it('四个事件只带 poolId 顶层与白名单 metadata', () => {
    trackVenueDealCardImpression(input)
    trackVenueDealCardTap(input)
    trackVenueDealRedeemPageOpen(input)
    trackVenueDealCredentialPresent(input, 2.9)
    expect(vi.mocked(discoverAnalytics.track).mock.calls).toEqual([
      ['deal_card_impression', 'pool-1', { groupId: 'group-1', dealId: 'deal-1', kind: 'discount', method: 'code' }],
      ['deal_card_tap', 'pool-1', { groupId: 'group-1', dealId: 'deal-1', kind: 'discount', method: 'code' }],
      ['redeem_page_open', 'pool-1', { groupId: 'group-1', dealId: 'deal-1', kind: 'discount', method: 'code' }],
      ['deal_credential_present', 'pool-1', { groupId: 'group-1', dealId: 'deal-1', kind: 'discount', method: 'code', secondsFromOpen: 2 }],
    ])
  })

  it('secondsFromOpen 非法值/负数安全归零', () => {
    trackVenueDealCredentialPresent(input, Number.NaN)
    trackVenueDealCredentialPresent(input, -3)
    expect(vi.mocked(discoverAnalytics.track).mock.calls[0][2]).toMatchObject({ secondsFromOpen: 0 })
    expect(vi.mocked(discoverAnalytics.track).mock.calls[1][2]).toMatchObject({ secondsFromOpen: 0 })
  })
})

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { findRecentInviteReward, INVITE_REWARD_RECENT_WINDOW_MS } from './inviteReward'

const NOW = Date.parse('2026-10-14T12:00:00+08:00')

function coupon(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    isUsed: false,
    status: 'available',
    source: 'invitation_reward',
    createdAt: new Date(NOW - 60 * 60 * 1000).toISOString(),
    ...overrides,
  } as never
}

describe('findRecentInviteReward (2026-10-14 PRD E19)', () => {
  it('selects an available invitation_reward coupon issued within the window', () => {
    expect(findRecentInviteReward([coupon()], NOW)).toBeDefined()
  })

  it('rejects stale, used, wrong-source, and undated coupons (fail-closed)', () => {
    const stale = coupon({ createdAt: new Date(NOW - INVITE_REWARD_RECENT_WINDOW_MS - 1000).toISOString() })
    const used = coupon({ status: 'used' })
    const wrongSource = coupon({ source: 'promotion' })
    const undated = coupon({ createdAt: null })
    const notAvailable = coupon({ isUsed: true })
    expect(findRecentInviteReward([stale], NOW)).toBeUndefined()
    expect(findRecentInviteReward([used], NOW)).toBeUndefined()
    expect(findRecentInviteReward([wrongSource], NOW)).toBeUndefined()
    expect(findRecentInviteReward([undated], NOW)).toBeUndefined()
    // isUsed alone is not the gate — status is (the DTO's canonical field).
    expect(findRecentInviteReward([notAvailable], NOW)).toBeDefined()
  })

  it('returns the FIRST qualifying coupon and undefined for an empty list', () => {
    const first = coupon({ id: 'c1' })
    const second = coupon({ id: 'c2' })
    expect(findRecentInviteReward([first, second], NOW)?.id).toBe('c1')
    expect(findRecentInviteReward([], NOW)).toBeUndefined()
  })
})

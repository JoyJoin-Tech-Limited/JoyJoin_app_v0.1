import { describe, expect, it, vi } from 'vitest'
import Taro from '@tarojs/taro'
import {
  buildDuoSharePath,
  buildDuoShareStorageKey,
  consumePendingDuoContext,
  isPendingDuoContextStale,
  resolveInviteShareMode,
} from './duoContext'

describe('duoContext pure helpers', () => {
  it('buildDuoSharePath carries id + invitationCode + duo=1 (spec §A.5 contract)', () => {
    expect(buildDuoSharePath('pool-1', 'ABC123')).toBe(
      '/pages/pool-registration/index?id=pool-1&invitationCode=ABC123&duo=1',
    )
  })

  it('buildDuoSharePath encodes reserved characters', () => {
    expect(buildDuoSharePath('pool/1', 'A B&C')).toBe(
      '/pages/pool-registration/index?id=pool%2F1&invitationCode=A%20B%26C&duo=1',
    )
  })

  it('buildDuoShareStorageKey is per-pool', () => {
    expect(buildDuoShareStorageKey('pool-1')).toBe('jj_duo_share_pool-1')
    expect(buildDuoShareStorageKey('pool-2')).not.toBe(buildDuoShareStorageKey('pool-1'))
  })

  it('isPendingDuoContextStale expires contexts older than 30 days', () => {
    const now = Date.now()
    const fresh = { poolId: 'p', invitationCode: 'c', duo: true, savedAt: now - 1000 }
    const stale = { ...fresh, savedAt: now - 31 * 24 * 60 * 60 * 1000 }
    expect(isPendingDuoContextStale(fresh, now)).toBe(false)
    expect(isPendingDuoContextStale(stale, now)).toBe(true)
  })

  it('resolveInviteShareMode picks duo only when enabled and the code resolved', () => {
    expect(resolveInviteShareMode({ duoSharePath: '/pages/pool-registration/index?id=p&invitationCode=c&duo=1', duoEnabled: true })).toBe('duo')
    expect(resolveInviteShareMode({ duoSharePath: null, duoEnabled: true })).toBe('referral')
    expect(resolveInviteShareMode({ duoSharePath: '/x', duoEnabled: false })).toBe('referral')
  })
})

/**
 * S2 (Dependencies, solo 归因压制): the pending duo context replay is
 * single-shot BY CONSTRUCTION (read + clear in one call). After a
 * 「就我一个人」confirm the replay must never inject the code into a
 * payload again — the first lock is that the context itself can only
 * replay once.
 */
describe('consumePendingDuoContext — replay exactly once (S2 Dependencies)', () => {
  it('returns the context on first consume and null on every later read', () => {
    const context = { poolId: 'pool-1', invitationCode: 'abc123', duo: true, savedAt: Date.now() }
    const storage = new Map<string, unknown>([['jj_pending_duo_context', context]])
    vi.mocked(Taro.getStorageSync).mockImplementation((key: string) => storage.get(key) ?? '')
    vi.mocked(Taro.removeStorageSync).mockImplementation((key: string) => {
      storage.delete(key)
    })

    expect(consumePendingDuoContext()).toEqual(context)
    expect(Taro.removeStorageSync).toHaveBeenCalledWith('jj_pending_duo_context')
    // Second consume: the context is gone — no replay, no re-injection.
    expect(consumePendingDuoContext()).toBeNull()
    expect(consumePendingDuoContext()).toBeNull()
  })

  it('returns null when nothing was captured', () => {
    vi.mocked(Taro.getStorageSync).mockReturnValue('')
    expect(consumePendingDuoContext()).toBeNull()
  })
})

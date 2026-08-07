import { describe, expect, it } from 'vitest'
import {
  buildDuoSharePath,
  buildDuoShareStorageKey,
  isPendingDuoContextStale,
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
})

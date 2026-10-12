import Taro from '@tarojs/taro'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import {
  clearPendingReferralCode,
  persistPendingReferralCode,
  readPendingReferralCode,
} from './pendingReferralCode'

vi.mock('@tarojs/taro', () => {
  const storage = new Map<string, string>()

  return {
    default: {
      getStorageSync: vi.fn((key: string) => storage.get(key)),
      setStorageSync: vi.fn((key: string, value: string) => {
        storage.set(key, value)
      }),
      removeStorageSync: vi.fn((key: string) => {
        storage.delete(key)
      }),
    },
  }
})

const setStorageSyncMock = Taro.setStorageSync as unknown as Mock

describe('pending referral code attribution storage', () => {
  beforeEach(() => {
    clearPendingReferralCode()
    setStorageSyncMock.mockClear()
  })

  it('persists a code and reads it back until consumed (survives restarts)', () => {
    persistPendingReferralCode('INVITE42')
    expect(readPendingReferralCode()).toBe('INVITE42')
    // A second read must NOT consume — only an explicit clear may.
    expect(readPendingReferralCode()).toBe('INVITE42')
  })

  it('trims surrounding whitespace on persist and read', () => {
    persistPendingReferralCode('  INVITE42  ')
    expect(readPendingReferralCode()).toBe('INVITE42')
  })

  it('never overwrites with an empty/blank code', () => {
    persistPendingReferralCode('INVITE42')
    setStorageSyncMock.mockClear()
    persistPendingReferralCode('')
    persistPendingReferralCode('   ')
    persistPendingReferralCode(null)
    persistPendingReferralCode(undefined)
    expect(setStorageSyncMock).not.toHaveBeenCalled()
    expect(readPendingReferralCode()).toBe('INVITE42')
  })

  it('clearPendingReferralCode consumes the stored code', () => {
    persistPendingReferralCode('INVITE42')
    clearPendingReferralCode()
    expect(readPendingReferralCode()).toBe('')
  })

  it('read/clear tolerate an empty store', () => {
    expect(readPendingReferralCode()).toBe('')
    expect(() => clearPendingReferralCode()).not.toThrow()
  })
})

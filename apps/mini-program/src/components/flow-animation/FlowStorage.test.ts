import { beforeEach, describe, expect, it, vi } from 'vitest'
import Taro from '@tarojs/taro'
import {
  clearPendingFlow,
  getFlowStorageKey,
  hasPendingFlow,
  hasSeenFlow,
  markFlowSeen,
  markFlowPending,
  shouldShowFlow,
} from './FlowStorage'

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: vi.fn(),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
  },
}))

describe('FlowStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('isolates seen state by flow, version and user', () => {
    expect(getFlowStorageKey('joyjoin-intro', 'user-a')).toBe(
      'joyjoin_flow_seen:v2:joyjoin-intro:user-a',
    )
    expect(getFlowStorageKey('blind-box-lifecycle', 'user-b')).toBe(
      'joyjoin_flow_seen:v2:blind-box-lifecycle:user-b',
    )
  })

  it('shows an unseen flow and hides a seen flow', () => {
    vi.mocked(Taro.getStorageSync).mockReturnValueOnce(undefined).mockReturnValueOnce(true)

    expect(shouldShowFlow('joyjoin-intro', 'user-a')).toBe(true)
    expect(hasSeenFlow('joyjoin-intro', 'user-a')).toBe(true)
  })

  it('marks completion without throwing when storage is unavailable', () => {
    markFlowSeen('blind-box-lifecycle', 'user-a')
    expect(Taro.setStorageSync).toHaveBeenCalledWith(
      'joyjoin_flow_seen:v2:blind-box-lifecycle:user-a',
      true,
    )

    vi.mocked(Taro.setStorageSync).mockImplementationOnce(() => {
      throw new Error('storage unavailable')
    })
    expect(() => markFlowSeen('blind-box-lifecycle', 'user-a')).not.toThrow()
  })

  it('persists a cross-page intro handoff until the destination clears it', () => {
    markFlowPending('joyjoin-intro', 'user-a')
    expect(Taro.setStorageSync).toHaveBeenCalledWith(
      'joyjoin_flow_pending:v2:joyjoin-intro:user-a',
      true,
    )

    vi.mocked(Taro.getStorageSync).mockReturnValueOnce(true)
    expect(hasPendingFlow('joyjoin-intro', 'user-a')).toBe(true)

    clearPendingFlow('joyjoin-intro', 'user-a')
    expect(Taro.removeStorageSync).toHaveBeenCalledWith(
      'joyjoin_flow_pending:v2:joyjoin-intro:user-a',
    )
  })
})

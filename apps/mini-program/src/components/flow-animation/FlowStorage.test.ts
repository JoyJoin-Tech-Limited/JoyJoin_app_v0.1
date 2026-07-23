import { beforeEach, describe, expect, it, vi } from 'vitest'
import Taro from '@tarojs/taro'
import {
  getFlowStorageKey,
  hasSeenFlow,
  markFlowSeen,
  shouldShowFlow,
} from './FlowStorage'

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: vi.fn(),
    setStorageSync: vi.fn(),
  },
}))

describe('FlowStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('isolates seen state by flow, version and user', () => {
    expect(getFlowStorageKey('joyjoin-intro', 'user-a')).toBe(
      'joyjoin_flow_seen:v1:joyjoin-intro:user-a',
    )
    expect(getFlowStorageKey('blind-box-lifecycle', 'user-b')).toBe(
      'joyjoin_flow_seen:v1:blind-box-lifecycle:user-b',
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
      'joyjoin_flow_seen:v1:blind-box-lifecycle:user-a',
      true,
    )

    vi.mocked(Taro.setStorageSync).mockImplementationOnce(() => {
      throw new Error('storage unavailable')
    })
    expect(() => markFlowSeen('blind-box-lifecycle', 'user-a')).not.toThrow()
  })
})

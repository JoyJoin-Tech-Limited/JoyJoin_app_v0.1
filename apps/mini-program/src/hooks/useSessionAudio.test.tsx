import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionAudio } from './useSessionAudio'

const taro = vi.hoisted(() => ({
  createInnerAudioContext: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: { createInnerAudioContext: taro.createInnerAudioContext },
}))

function mockContext() {
  return {
    src: '',
    volume: 1,
    play: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
  }
}

describe('useSessionAudio (S9)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    taro.createInnerAudioContext.mockImplementation(() => mockContext())
  })

  it('creates no player while the flag is off (zero side effects)', () => {
    const { unmount } = renderHook(() => useSessionAudio(false))
    expect(taro.createInnerAudioContext).not.toHaveBeenCalled()
    unmount()
  })

  it('preloads on enable and destroys every context on unmount', () => {
    const { unmount } = renderHook(() => useSessionAudio(true))
    expect(taro.createInnerAudioContext).toHaveBeenCalledTimes(6)
    const ctx = taro.createInnerAudioContext.mock.results[0].value
    unmount()
    expect(ctx.destroy).toHaveBeenCalled()
  })

  it('playPattern plays when the player is live and no-ops when it is not', () => {
    const { result, unmount } = renderHook(() => useSessionAudio(true))
    expect(result.current.playPattern('socialNudge')).toBe(true)
    unmount()
    expect(result.current.playPattern('socialNudge')).toBe(false)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeepScreenOn } from '../hooks/useKeepScreenOn'

const taroRuntime = vi.hoisted(() => ({
  setKeepScreenOn: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: taroRuntime,
}))

describe('useKeepScreenOn (S2 POCKET posture, ruling 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('holds the screen while enabled and releases on disable', () => {
    const { rerender } = renderHook(({ enabled }) => useKeepScreenOn(enabled), {
      initialProps: { enabled: true },
    })
    expect(taroRuntime.setKeepScreenOn).toHaveBeenCalledTimes(1)
    expect(taroRuntime.setKeepScreenOn).toHaveBeenLastCalledWith({ keepScreenOn: true })

    rerender({ enabled: false })
    expect(taroRuntime.setKeepScreenOn).toHaveBeenLastCalledWith({ keepScreenOn: false })
  })

  it('releases on unmount', () => {
    const { unmount } = renderHook(() => useKeepScreenOn(true))
    expect(taroRuntime.setKeepScreenOn).toHaveBeenLastCalledWith({ keepScreenOn: true })
    unmount()
    expect(taroRuntime.setKeepScreenOn).toHaveBeenLastCalledWith({ keepScreenOn: false })
  })

  it('never touches the API while disabled (flag-off = today\'s behavior)', () => {
    renderHook(() => useKeepScreenOn(false))
    expect(taroRuntime.setKeepScreenOn).not.toHaveBeenCalled()
  })

  it('never throws into the page when the bridge rejects', () => {
    taroRuntime.setKeepScreenOn.mockImplementation(() => {
      throw new Error('bridge down')
    })
    const { unmount } = renderHook(() => useKeepScreenOn(true))
    expect(() => unmount()).not.toThrow()
  })
})

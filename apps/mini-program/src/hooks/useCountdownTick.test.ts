import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useCountdownTick } from './useCountdownTick'

const { taroMocks } = vi.hoisted(() => ({
  taroMocks: {
    useDidShow: vi.fn(),
    useDidHide: vi.fn(),
  },
}))

vi.mock('@tarojs/taro', async () => {
  const actual = await vi.importActual<typeof import('@tarojs/taro')>('@tarojs/taro')
  return {
    ...actual,
    useDidShow: taroMocks.useDidShow,
    useDidHide: taroMocks.useDidHide,
  }
})

function fireShow() {
  const calls = taroMocks.useDidShow.mock.calls
  const cb = calls[calls.length - 1][0] as () => void
  act(() => cb())
}

function fireHide() {
  const calls = taroMocks.useDidHide.mock.calls
  const cb = calls[calls.length - 1][0] as () => void
  act(() => cb())
}

describe('useCountdownTick', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T10:00:00Z'))
    taroMocks.useDidShow.mockClear()
    taroMocks.useDidHide.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts ticking on show and advances every second', () => {
    const { result } = renderHook(() => useCountdownTick())
    fireShow()
    const initial = result.current.now

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.now).toBeGreaterThan(initial)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.now).toBeGreaterThan(initial + 1000)
  })

  it('pauses ticking while hidden', () => {
    const { result } = renderHook(() => useCountdownTick())
    fireShow()
    fireHide()
    const frozenAt = result.current.now

    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(result.current.now).toBe(frozenAt)
  })

  it('catches up immediately on re-show after a hidden period', () => {
    const { result } = renderHook(() => useCountdownTick())
    fireShow()
    fireHide()
    const hiddenAt = result.current.now

    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    vi.setSystemTime(new Date('2026-08-01T10:00:05Z'))

    fireShow()
    expect(result.current.now).toBeGreaterThanOrEqual(hiddenAt + 5_000)

    // Ticker resumes: two more seconds advance it past the hidden period.
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(result.current.now).toBeGreaterThan(hiddenAt + 6_000)
  })

  it('does not create a duplicate interval across repeated show events', () => {
    const { result } = renderHook(() => useCountdownTick())
    fireShow()
    fireShow()
    const initial = result.current.now

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    // A duplicate interval would advance by 2s in one second; expect exactly 1s.
    expect(result.current.now).toBe(initial + 1000)
  })

  it('clears the interval on unmount (no leaked timer)', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    const { unmount } = renderHook(() => useCountdownTick())
    fireShow()

    expect(clearSpy).not.toHaveBeenCalled()

    unmount()
    expect(clearSpy).toHaveBeenCalled()
  })
})

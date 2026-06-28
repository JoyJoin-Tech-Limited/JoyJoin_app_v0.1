import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useEventCountdown } from '../useEventCountdown'

import { useEffect, useRef } from 'react'

function createTargetSecondsFromNow(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

// Vitest hoists vi.mock to the top of the file; the factory must not reference
// top-level variables. We therefore build the mock inside the factory.
vi.mock('@tarojs/taro', () => {
  const mockOnAppHide = vi.fn()
  const mockOnAppShow = vi.fn()
  const mockOffAppHide = vi.fn()
  const mockOffAppShow = vi.fn()
  const mockGetSystemInfoSync = vi.fn()
  const mockGetCurrentInstance = vi.fn()
  const mockCreateIntersectionObserver = vi.fn()

  return {
    default: {
      onAppHide: mockOnAppHide,
      onAppShow: mockOnAppShow,
      offAppHide: mockOffAppHide,
      offAppShow: mockOffAppShow,
      getSystemInfoSync: mockGetSystemInfoSync,
      getCurrentInstance: mockGetCurrentInstance,
      createIntersectionObserver: mockCreateIntersectionObserver,
    },
    useDidShow: (fn: () => void) => {
      const didRunRef = useRef(false)
      useEffect(() => {
        if (!didRunRef.current) {
          didRunRef.current = true
          fn()
        }
      }, [fn])
    },
    __mockFns: {
      mockOnAppHide,
      mockOnAppShow,
      mockOffAppHide,
      mockOffAppShow,
      mockGetSystemInfoSync,
      mockGetCurrentInstance,
      mockCreateIntersectionObserver,
    },
  }
})

// Re-expose the mock controls so tests can configure them.
const mockedTaro = await import('@tarojs/taro')
const mocks = (mockedTaro as unknown as { __mockFns: Record<string, ReturnType<typeof vi.fn>> }).__mockFns

describe('useEventCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.mockGetSystemInfoSync.mockReturnValue({ reduceMotion: false })
    mocks.mockGetCurrentInstance.mockReturnValue({ page: {} })
    mocks.mockCreateIntersectionObserver.mockReturnValue({
      relativeToViewport: vi.fn().mockReturnThis(),
      observe: vi.fn().mockImplementation((_selector: string, cb: (res: { intersectionRatio: number }) => void) => {
        // Default visible.
        cb({ intersectionRatio: 1 })
        return { disconnect: vi.fn() }
      }),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('returns null display when target is missing', () => {
    const { result } = renderHook(() => useEventCountdown({}))
    expect(result.current.display).toBeNull()
    expect(result.current.segments).toBeNull()
    expect(result.current.isUrgent).toBe(false)
    expect(result.current.hasStarted).toBe(false)
  })

  it('returns null display when disabled', () => {
    const { result } = renderHook(() =>
      useEventCountdown({ target: createTargetSecondsFromNow(3600), enabled: false }),
    )
    expect(result.current.display).toBeNull()
  })

  it('formats remaining time as HH:MM:SS', () => {
    const target = createTargetSecondsFromNow(3661)
    const { result } = renderHook(() => useEventCountdown({ target, enabled: true }))
    expect(result.current.display).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(result.current.hasStarted).toBe(false)
  })

  it('ticks every second while live', () => {
    const target = createTargetSecondsFromNow(120)
    const { result } = renderHook(() => useEventCountdown({ target, enabled: true, elementId: 'clock-1' }))

    const initial = result.current.display

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.display).not.toBe(initial)
  })

  it('marks urgent when within threshold', () => {
    const target = createTargetSecondsFromNow(30 * 60) // 30 minutes
    const { result } = renderHook(() => useEventCountdown({ target, enabled: true, urgentThresholdMinutes: 60 }))
    expect(result.current.isUrgent).toBe(true)
  })

  it('does not mark urgent when above threshold', () => {
    const target = createTargetSecondsFromNow(2 * 60 * 60) // 2 hours
    const { result } = renderHook(() => useEventCountdown({ target, enabled: true, urgentThresholdMinutes: 60 }))
    expect(result.current.isUrgent).toBe(false)
  })

  it('returns 进行中 when target has passed', () => {
    const target = new Date(Date.now() - 1000).toISOString()
    const { result } = renderHook(() => useEventCountdown({ target, enabled: true }))
    expect(result.current.display).toBe('进行中')
    expect(result.current.hasStarted).toBe(true)
  })

  it('exposes structured segments', () => {
    const target = createTargetSecondsFromNow(90061) // 1d 1h 1m 1s
    const { result } = renderHook(() => useEventCountdown({ target, enabled: true }))
    const { segments } = result.current
    expect(segments).not.toBeNull()
    expect(segments?.days).toBe(1)
    expect(segments?.hours).toBe(1)
    expect(segments?.minutes).toBe(1)
    expect(segments?.seconds).toBe(1)
    expect(segments?.progress).toBeGreaterThan(0)
    expect(segments?.progress).toBeLessThan(1)
  })

  it('is not live on degradation-tier devices', () => {
    mocks.mockGetSystemInfoSync.mockReturnValue({ benchmarkLevel: 10, reduceMotion: false })
    const target = createTargetSecondsFromNow(3600)
    const { result } = renderHook(() => useEventCountdown({ target, enabled: true }))
    expect(result.current.isLive).toBe(false)
  })

  it('is not live when reduced motion is enabled', () => {
    mocks.mockGetSystemInfoSync.mockReturnValue({ reduceMotion: true })
    const target = createTargetSecondsFromNow(3600)
    const { result } = renderHook(() => useEventCountdown({ target, enabled: true }))
    expect(result.current.isLive).toBe(false)
  })

  it('still displays a static readout when reduced motion is enabled', () => {
    mocks.mockGetSystemInfoSync.mockReturnValue({ reduceMotion: true })
    const target = createTargetSecondsFromNow(3600)
    const { result } = renderHook(() => useEventCountdown({ target, enabled: true }))
    expect(result.current.display).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(result.current.isLive).toBe(false)
  })
})

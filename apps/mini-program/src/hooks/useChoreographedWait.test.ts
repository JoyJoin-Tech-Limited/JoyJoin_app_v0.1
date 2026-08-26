import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChoreographedWait } from './useChoreographedWait'

describe('useChoreographedWait', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('auto-completes after minDuration and fires onComplete once', () => {
    const onComplete = vi.fn()
    const onFinish = vi.fn()
    const { result } = renderHook(() =>
      useChoreographedWait({ minDuration: 1500, skipDelay: 600, onComplete, onFinish }),
    )
    expect(result.current.canSkip).toBe(false)
    act(() => { vi.advanceTimersByTime(600) })
    expect(result.current.canSkip).toBe(true)
    expect(result.current.isComplete).toBe(false)
    act(() => { vi.advanceTimersByTime(900) })
    expect(result.current.isComplete).toBe(true)
    expect(onFinish).toHaveBeenCalledWith('auto')
    expect(onComplete).toHaveBeenCalledTimes(1)
    // Late timers must not double-fire
    act(() => { vi.advanceTimersByTime(5000) })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('skip() is a no-op before the skip delay and completes after it', () => {
    const onComplete = vi.fn()
    const onFinish = vi.fn()
    const { result } = renderHook(() =>
      useChoreographedWait({ minDuration: 1500, skipDelay: 600, onComplete, onFinish }),
    )
    act(() => { result.current.skip() })
    expect(onComplete).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(600) })
    act(() => { result.current.skip() })
    expect(onFinish).toHaveBeenCalledWith('tap')
    expect(onComplete).toHaveBeenCalledTimes(1)
    // The auto timer fires later but completion is guarded
    act(() => { vi.advanceTimersByTime(2000) })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('stays inert while active=false and re-arms on activation', () => {
    const onComplete = vi.fn()
    const { result, rerender } = renderHook(
      ({ active }) => useChoreographedWait({ active, minDuration: 1000, onComplete }),
      { initialProps: { active: false } },
    )
    act(() => { vi.advanceTimersByTime(3000) })
    expect(onComplete).not.toHaveBeenCalled()
    rerender({ active: true })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})

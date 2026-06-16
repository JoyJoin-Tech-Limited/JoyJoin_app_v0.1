import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useLoadingDeadline } from './useLoadingDeadline'

describe('useLoadingDeadline', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts non-stale while loading is within deadline', () => {
    const { result } = renderHook(() => useLoadingDeadline(true, 5000))

    expect(result.current.isStale).toBe(false)
    expect(result.current.elapsedMs).toBe(0)
  })

  it('becomes stale after the deadline passes', () => {
    const { result } = renderHook(() => useLoadingDeadline(true, 1000))

    act(() => vi.advanceTimersByTime(1000))

    expect(result.current.isStale).toBe(true)
    expect(result.current.elapsedMs).toBeGreaterThanOrEqual(1000)
  })

  it('resets when loading becomes false', () => {
    const { result, rerender } = renderHook(
      ({ isLoading }: { isLoading: boolean }) => useLoadingDeadline(isLoading, 1000),
      { initialProps: { isLoading: true } }
    )

    act(() => vi.advanceTimersByTime(1500))
    expect(result.current.isStale).toBe(true)

    rerender({ isLoading: false })

    expect(result.current.isStale).toBe(false)
    expect(result.current.elapsedMs).toBe(0)
  })

  it('resets timer when loading flips back to true', () => {
    const { result, rerender } = renderHook(
      ({ isLoading }: { isLoading: boolean }) => useLoadingDeadline(isLoading, 1000),
      { initialProps: { isLoading: true } }
    )

    act(() => vi.advanceTimersByTime(1500))
    expect(result.current.isStale).toBe(true)

    rerender({ isLoading: false })
    rerender({ isLoading: true })

    expect(result.current.isStale).toBe(false)
    expect(result.current.elapsedMs).toBe(0)

    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.isStale).toBe(true)
  })
})

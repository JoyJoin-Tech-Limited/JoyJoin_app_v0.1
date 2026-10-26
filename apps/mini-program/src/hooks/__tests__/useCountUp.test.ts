import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCountUp } from '../useCountUp'

// P1-3 (2026-10-22): coverage for the existing hook + the new
// brandBezier / cadenceFloorMs options. Real timers with short durations —
// fake-timer + rAF interplay in jsdom is too flaky for tick-level asserts.

describe('useCountUp', () => {
  it('starts at 0 and settles exactly on the target (default easing)', async () => {
    const { result } = renderHook(() => useCountUp(60, { duration: 50 }))
    expect(result.current).toBe(0)
    await waitFor(() => expect(result.current).toBe(60), { timeout: 500 })
  })

  it('brandBezier also starts at 0 and settles exactly on the target', async () => {
    const { result } = renderHook(() => useCountUp(100, { duration: 50, easing: 'brandBezier' }))
    expect(result.current).toBe(0)
    await waitFor(() => expect(result.current).toBe(100), { timeout: 500 })
  })

  it('cadenceFloorMs larger than the duration still settles exactly (final frame is never skipped)', async () => {
    const { result } = renderHook(() => useCountUp(42, { duration: 50, cadenceFloorMs: 5000 }))
    await waitFor(() => expect(result.current).toBe(42), { timeout: 500 })
  })

  it('snaps (never re-animates from 0) when the target changes after settling', async () => {
    const { result, rerender } = renderHook(({ value }) => useCountUp(value, { duration: 50 }), {
      initialProps: { value: 50 },
    })
    await waitFor(() => expect(result.current).toBe(50), { timeout: 500 })
    rerender({ value: 87 })
    await waitFor(() => expect(result.current).toBe(87), { timeout: 500 })
  })

  it('respects prefersReducedMotion — final value immediately, no animation', () => {
    const { result } = renderHook(() => useCountUp(99, { prefersReducedMotion: true }))
    expect(result.current).toBe(99)
  })

  it('enabled:false renders the target without animating', () => {
    const { result } = renderHook(() => useCountUp(7, { enabled: false }))
    expect(result.current).toBe(7)
  })
})

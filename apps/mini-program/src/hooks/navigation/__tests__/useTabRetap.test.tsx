import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTabRetapScroll } from '../useTabRetap'

function scrollEvent(scrollTop: number) {
  return { detail: { scrollTop } } as never
}

describe('useTabRetapScroll', () => {
  it('scrolls to the top instead of refreshing when the list is scrolled', () => {
    const onRefresh = vi.fn()
    const { result } = renderHook(() => useTabRetapScroll({ onRefresh }))

    act(() => result.current.handleScroll(scrollEvent(640)))

    let outcome: unknown
    act(() => {
      outcome = result.current.onRetap()
    })

    expect(outcome).toEqual({ action: 'scroll-to-top', atTop: false })
    expect(result.current.scrollTop).toBe(0)
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('refreshes once when the list is already at the top', () => {
    const onRefresh = vi.fn()
    const { result } = renderHook(() => useTabRetapScroll({ onRefresh }))

    act(() => result.current.handleScroll(scrollEvent(3)))

    let outcome: unknown
    act(() => {
      outcome = result.current.onRetap()
    })

    expect(outcome).toEqual({ action: 'refresh', atTop: true })
    expect(onRefresh).toHaveBeenCalledTimes(1)
    // No scroll is issued at the top: the controlled offset keeps the tiny
    // pre-threshold value it already had, because the list is already where
    // it belongs.
    expect(result.current.scrollTop).toBe(3)
  })

  it('treats the threshold as the boundary between scroll and refresh', () => {
    const onRefresh = vi.fn()
    const { result } = renderHook(() => useTabRetapScroll({ onRefresh, threshold: 8 }))

    act(() => result.current.handleScroll(scrollEvent(8)))
    let atBoundary: unknown
    act(() => {
      atBoundary = result.current.onRetap()
    })
    expect(atBoundary).toEqual({ action: 'refresh', atTop: true })

    act(() => result.current.handleScroll(scrollEvent(9)))
    let pastBoundary: unknown
    act(() => {
      pastBoundary = result.current.onRetap()
    })
    expect(pastBoundary).toEqual({ action: 'scroll-to-top', atTop: false })
  })

  it('does not re-render while the list stays scrolled', () => {
    const { result } = renderHook(() => useTabRetapScroll({}))

    act(() => result.current.handleScroll(scrollEvent(120)))
    const firstRendered = result.current.scrollTop

    act(() => result.current.handleScroll(scrollEvent(480)))
    act(() => result.current.handleScroll(scrollEvent(900)))

    // State only flips on the 0 <-> non-zero transition; the ref keeps the
    // exact offset, so mid-scroll frames must not re-render the page.
    expect(result.current.scrollTop).toBe(firstRendered)
  })
})

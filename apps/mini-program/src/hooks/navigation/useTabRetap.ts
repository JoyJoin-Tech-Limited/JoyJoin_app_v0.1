import { useCallback, useRef, useState } from 'react'
import Taro, { usePageScroll } from '@tarojs/taro'

/**
 * Outcome of a re-tap on the tab the user is already looking at.
 *
 * The chrome guarantees the haptic and the `mini_program_tab_bar_retap`
 * analytics event; the page owns the outcome because only it knows whether its
 * content scrolls at the page level or inside a `ScrollView`, and which query a
 * silent refresh should invalidate.
 */
export interface TabRetapOutcome {
  action: 'scroll-to-top' | 'refresh' | 'none'
  atTop: boolean
}

interface TabRetapOptions {
  /** Silent refresh: must not raise a visible loading shell. */
  onRefresh?: () => void | Promise<void>
  /** Scroll distance (rpx) still treated as "at the top". */
  threshold?: number
}

const AT_TOP_THRESHOLD_RPX = 8

/**
 * Re-tap outcome for a page whose content lives in a `<ScrollView>`.
 *
 * Returns the controlled `scrollTop` prop plus the scroll/refresh handlers to
 * spread onto that ScrollView. State only changes on the 0 ⇄ non-zero
 * transition: the ScrollView needs a `scrollTop` value to drive 回顶, but
 * re-rendering on every scroll frame would defeat scroll performance.
 */
export function useTabRetapScroll({
  onRefresh,
  threshold = AT_TOP_THRESHOLD_RPX,
}: TabRetapOptions = {}) {
  const [scrollTop, setScrollTop] = useState(0)
  const scrollTopRef = useRef(0)

  const handleScroll = useCallback((event: { detail?: { scrollTop?: number } }) => {
    const next = Number(event?.detail?.scrollTop ?? 0)
    scrollTopRef.current = next
    setScrollTop((previous) => ((previous === 0) === (next === 0) ? previous : next))
  }, [])

  const onRetap = useCallback((): TabRetapOutcome => {
    if (scrollTopRef.current > threshold) {
      scrollTopRef.current = 0
      setScrollTop(0)
      return { action: 'scroll-to-top', atTop: false }
    }
    void onRefresh?.()
    return { action: 'refresh', atTop: true }
  }, [onRefresh, threshold])

  return { scrollTop, handleScroll, onRetap }
}

/**
 * Re-tap outcome for a page that scrolls at the page level (Discover).
 *
 * Mirrors `useTabRetapScroll` but tracks the position in a ref only — there is
 * no controlled prop to feed, and a `setState` per scroll frame would cost a
 * re-render for no visual gain.
 */
export function useTabRetapPageScroll({
  onRefresh,
  threshold = AT_TOP_THRESHOLD_RPX,
}: TabRetapOptions = {}) {
  const scrollTopRef = useRef(0)

  usePageScroll(({ scrollTop }) => {
    scrollTopRef.current = Number(scrollTop ?? 0)
  })

  const onRetap = useCallback((): TabRetapOutcome => {
    if (scrollTopRef.current > threshold) {
      void Taro.pageScrollTo({ scrollTop: 0, duration: 200 })
      return { action: 'scroll-to-top', atTop: false }
    }
    void onRefresh?.()
    return { action: 'refresh', atTop: true }
  }, [onRefresh, threshold])

  return { onRetap }
}

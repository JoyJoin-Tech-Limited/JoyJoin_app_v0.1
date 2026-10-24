import { useCallback, useRef, useState } from 'react'
import Taro from '@tarojs/taro'

// P0-8 / P2-5 shared scroll state machine for the profile page.
// One ScrollView onScroll feeds one hook; P0-8 consumes `navCondensed`,
// P2-5 (iOS large title) will consume the same state machine for the
// title-fold. Hysteresis band prevents flicker at the boundary:
// enter condensation at ≥96rpx of scroll, exit only below 64rpx.
// The handler setState's ONLY on band crossings, so per-frame scroll events
// cost zero re-renders and need no time-based throttle.
const ENTER_RPX = 96
const EXIT_RPX = 64

let cachedWindowWidth: number | null = null

function rpxToPx(rpx: number): number {
  if (cachedWindowWidth === null) {
    try {
      cachedWindowWidth = Taro.getSystemInfoSync().windowWidth
    } catch {
      cachedWindowWidth = 375 // standard-density fallback (2rpx ≈ 1px)
    }
  }
  return (rpx / 750) * cachedWindowWidth
}

export function useProfileScroll() {
  const [navCondensed, setNavCondensed] = useState(false)
  const condensedRef = useRef(false)

  const handleScroll = useCallback((event: any) => {
    const top: number = event?.detail?.scrollTop ?? 0
    const next = condensedRef.current
      ? top >= rpxToPx(EXIT_RPX)
      : top >= rpxToPx(ENTER_RPX)
    if (next !== condensedRef.current) {
      condensedRef.current = next
      setNavCondensed(next)
    }
  }, [])

  return { navCondensed, handleScroll }
}

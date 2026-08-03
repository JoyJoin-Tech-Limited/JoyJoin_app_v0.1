import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useDidShow, useDidHide } from '@tarojs/taro'

const TICK_INTERVAL_MS = 1000

export interface CountdownTickValue {
  /** Monotonic wall-clock readout, refreshed once per second while visible. */
  now: number
}

/**
 * Per-page 1s countdown ticker (P2 contract D1).
 *
 * The page that owns a list of countdown cards mounts `CountdownTickProvider`,
 * which starts a SINGLE 1s interval while the page is visible and stops it on
 * hide (WeChat fires `onHide` on both navigation-away and app-background).
 * Leaf `EventCountdownClock` components consume the value via context and
 * derive their display with `useMemo` — no per-card timers, no global
 * singleton shared across pages in the navigation stack.
 *
 * On re-show the ticker immediately catches up (fresh `Date.now()`) so clocks
 * do not display a stale readout after a hidden period.
 */
export function useCountdownTick(): CountdownTickValue {
  const [now, setNow] = useState(() => Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    if (timerRef.current) return
    // Catch-up on (re)show so clocks never render a stale readout.
    setNow(Date.now())
    timerRef.current = setInterval(() => {
      setNow(Date.now())
    }, TICK_INTERVAL_MS)
  }, [])

  useDidShow(() => {
    start()
  })

  useDidHide(() => {
    stop()
  })

  useEffect(() => stop, [stop])

  return { now }
}

export const CountdownTickContext = createContext<CountdownTickValue | null>(null)

export function CountdownTickProvider({ children }: { children: ReactNode }) {
  const value = useCountdownTick()
  return <CountdownTickContext.Provider value={value}>{children}</CountdownTickContext.Provider>
}

/**
 * Returns the shared tick value, or `null` when no provider is mounted.
 * Clock leaves outside a provider render a static readout (no ticking).
 */
export function useCountdownTickValue(): CountdownTickValue | null {
  return useContext(CountdownTickContext)
}

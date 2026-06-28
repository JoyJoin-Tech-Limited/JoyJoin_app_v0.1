import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDeviceTier } from './useDeviceTier'

export interface UseEventCountdownOptions {
  /** Target ISO datetime string. When undefined/null/invalid, the hook returns hidden state. */
  target?: string | null
  /** Whether the countdown should be running at all. */
  enabled?: boolean
  /** Threshold in minutes; when remaining time drops below this, isUrgent becomes true. Default: 60. */
  urgentThresholdMinutes?: number
  /** Optional stable id of the host element for viewport intersection pausing. */
  elementId?: string
}

export interface UseEventCountdownResult {
  /** Formatted countdown label, or null when hidden. */
  display: string | null
  /** True when remaining time is within the urgent threshold. */
  isUrgent: boolean
  /** True when the target has passed (event is in-progress or started). */
  hasStarted: boolean
}

function parseTarget(target?: string | null): Date | null {
  if (!target) return null
  const parsed = new Date(target)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0')
}

function formatLedCountdown(diffMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) {
    return `${pad2(days)} 天 ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
  }
  if (hours > 0) {
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
  }
  return `${pad2(minutes)}:${pad2(seconds)}`
}

function prefersReducedMotion(): boolean {
  try {
    return Boolean((Taro.getSystemInfoSync() as unknown as { reduceMotion?: boolean }).reduceMotion)
  } catch {
    return false
  }
}

function getCurrentPage(): unknown | undefined {
  try {
    return Taro.getCurrentInstance().page
  } catch {
    return undefined
  }
}

/**
 * Live LED countdown hook for event cards.
 *
 * Features:
 * - Ticks every second while enabled and in viewport.
 * - Pauses on unmount, app background, host leaving viewport, terminal status,
 *   reduced-motion preference, or degradation-tier devices.
 * - Resets and recalculates on `useDidShow`.
 */
export function useEventCountdown(options: UseEventCountdownOptions): UseEventCountdownResult {
  const { target, enabled = true, urgentThresholdMinutes = 60, elementId } = options
  const { isDegradation } = useDeviceTier()
  const reduceMotion = prefersReducedMotion()

  const [tick, setTick] = useState(0)
  const isInViewportRef = useRef(true)
  const isAppVisibleRef = useRef(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const intersectionObserverRef = useRef<Taro.IntersectionObserver | null>(null)

  const shouldRun = enabled && !isDegradation && !reduceMotion

  const forceTick = useCallback(() => {
    setTick((t) => t + 1)
  }, [])

  // Pure, memoized display result derived from props and tick.
  const { display, isUrgent, hasStarted } = useMemo(() => {
    const parsed = parseTarget(target)
    if (!parsed || !enabled || !shouldRun) {
      return { display: null, isUrgent: false, hasStarted: false }
    }

    const now = Date.now()
    const diff = parsed.getTime() - now
    const hasStarted = diff <= 0

    if (hasStarted) {
      return { display: '进行中', isUrgent: false, hasStarted }
    }

    const urgentThresholdMs = urgentThresholdMinutes * 60 * 1000
    return {
      display: formatLedCountdown(diff),
      isUrgent: diff <= urgentThresholdMs,
      hasStarted,
    }
  }, [target, enabled, shouldRun, tick, urgentThresholdMinutes])

  // Stop the interval once the event has started so we don't keep ticking.
  useEffect(() => {
    if (!shouldRun || !hasStarted || !timerRef.current) return
    clearInterval(timerRef.current)
    timerRef.current = null
  }, [shouldRun, hasStarted])

  // Viewport intersection observer: pause countdown when the card is off-screen.
  useEffect(() => {
    if (!shouldRun || !elementId) {
      isInViewportRef.current = true
      return
    }

    const page = getCurrentPage()
    if (!page) {
      isInViewportRef.current = true
      return
    }

    try {
      const observer = Taro.createIntersectionObserver(page as any, { thresholds: [0] })
      observer.relativeToViewport({ top: 0, bottom: 0 })
      observer.observe(`#${elementId}`, (res) => {
        const ratio = res?.intersectionRatio ?? 0
        isInViewportRef.current = ratio > 0
      })
      intersectionObserverRef.current = observer
    } catch {
      // Fail-open: assume visible if intersection observer is unavailable.
      isInViewportRef.current = true
    }

    return () => {
      try {
        intersectionObserverRef.current?.disconnect?.()
      } catch {
        // ignore
      }
      intersectionObserverRef.current = null
    }
  }, [shouldRun, elementId])

  // App lifecycle: pause while backgrounded.
  useEffect(() => {
    if (!shouldRun) return

    const handleAppHide = () => {
      isAppVisibleRef.current = false
    }
    const handleAppShow = () => {
      isAppVisibleRef.current = true
      forceTick()
    }

    Taro.onAppHide(handleAppHide)
    Taro.onAppShow(handleAppShow)

    return () => {
      Taro.offAppHide(handleAppHide)
      Taro.offAppShow(handleAppShow)
    }
  }, [shouldRun, forceTick])

  // One-second ticker, gated by visibility flags.
  useEffect(() => {
    if (!shouldRun) return

    const startTimer = () => {
      if (timerRef.current) return
      timerRef.current = setInterval(() => {
        if (isAppVisibleRef.current && isInViewportRef.current) {
          setTick((t) => t + 1)
        }
      }, 1000)
    }

    const stopTimer = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    startTimer()

    return () => {
      stopTimer()
    }
  }, [shouldRun])

  useDidShow(() => {
    if (!shouldRun) return
    isAppVisibleRef.current = true
    forceTick()
  })

  return { display, isUrgent, hasStarted }
}

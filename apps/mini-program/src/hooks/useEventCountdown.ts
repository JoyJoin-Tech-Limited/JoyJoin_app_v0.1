import Taro, { useDidShow, useDidHide } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDeviceTier } from './useDeviceTier'

export interface UseEventCountdownOptions {
  /** Target ISO datetime string. When undefined/null/invalid, the hook returns hidden state. */
  target?: string | null
  /** Whether the countdown should be displayed at all. */
  enabled?: boolean
  /** Threshold in minutes; when remaining time drops below this, isUrgent becomes true. Default: 60. */
  urgentThresholdMinutes?: number
  /** Optional stable id of the host element for viewport intersection pausing. */
  elementId?: string
}

export interface CountdownSegments {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalMs: number
  /** 0–1 progress until the target (1 = target reached). Only meaningful when positive. */
  progress: number
}

export interface UseEventCountdownResult {
  /** Formatted countdown label, or null when hidden. */
  display: string | null
  /** Structured segments for segmented-clock UI. */
  segments: CountdownSegments | null
  /** True when remaining time is within the urgent threshold. */
  isUrgent: boolean
  /** True when the target has passed (event is in-progress or started). */
  hasStarted: boolean
  /** True when the live ticker is actively ticking (primary-tier, motion enabled, in viewport). */
  isLive: boolean
}

function parseTarget(target?: string | null): Date | null {
  if (!target) return null
  const parsed = new Date(target)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0')
}

const DEFAULT_URGENT_THRESHOLD_MINUTES = 60
const PROGRESS_HORIZON_MS = 7 * 24 * 60 * 60 * 1000

export interface CountdownComputedResult {
  /** Formatted countdown label, or null when hidden. */
  display: string | null
  /** Structured segments for segmented-clock UI. */
  segments: CountdownSegments | null
  /** True when remaining time is within the urgent threshold. */
  isUrgent: boolean
  /** True when the target has passed (event is in-progress or started). */
  hasStarted: boolean
  /** True when the live ticker is actively ticking (motion enabled, in viewport, app visible). */
  isLive: boolean
}

/**
 * Pure countdown derivation shared by `useEventCountdown` and the
 * `EventCountdownClock` leaf in the list path (P2 contract D2).
 *
 * Deterministic given `now` — the caller controls ticking, so N clock leaves
 * can derive identical readouts from a single shared tick without owning
 * timers themselves.
 */
export function computeCountdownResult(
  target: string | null | undefined,
  enabled: boolean,
  now: number,
  urgentThresholdMinutes: number,
  isLive: boolean,
): CountdownComputedResult {
  const parsedTarget = parseTarget(target)
  if (!parsedTarget || !enabled) {
    return { display: null, segments: null, isUrgent: false, hasStarted: false, isLive: false }
  }

  const diff = parsedTarget.getTime() - now
  const hasStarted = diff <= 0

  if (hasStarted) {
    return {
      display: '进行中',
      segments: null,
      isUrgent: false,
      hasStarted,
      isLive: false,
    }
  }

  const urgentThresholdMs = urgentThresholdMinutes * 60 * 1000
  return {
    display: formatLedCountdown(diff),
    segments: computeSegments(diff),
    isUrgent: diff <= urgentThresholdMs,
    hasStarted,
    isLive,
  }
}

function computeSegments(diffMs: number): CountdownSegments {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  // Progress is anchored on a 7-day horizon for event countdowns so the
  // segmented bar always has usable resolution without a fixed total duration.
  const progress = Math.min(1, Math.max(0, 1 - diffMs / PROGRESS_HORIZON_MS))

  return { days, hours, minutes, seconds, totalMs: diffMs, progress }
}

function formatLedCountdown(diffMs: number): string {
  const { days, hours, minutes, seconds } = computeSegments(diffMs)

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
 * - Computes display/segments whenever enabled so reduced-motion and low-end
 *   devices still see a static "paused" remaining-time readout instead of a
 *   blank space.
 * - Ticks every second while enabled and in viewport on primary-tier devices.
 * - Pauses ticking on unmount, app background, host leaving viewport, terminal
 *   status, reduced-motion preference, or degradation-tier devices.
 * - Resets and recalculates on `useDidShow`.
 */
export function useEventCountdown(options: UseEventCountdownOptions): UseEventCountdownResult {
  const urgentThresholdMinutes = options.urgentThresholdMinutes ?? DEFAULT_URGENT_THRESHOLD_MINUTES
  const { isDegradation } = useDeviceTier()
  // Memoized: getSystemInfoSync is synchronous + deprecated and this hook
  // re-renders every second per countdown card — an unmemoized read taxes the
  // JS thread ~1 call/card/sec even when the hosting page is hidden.
  const reduceMotion = useMemo(() => prefersReducedMotion(), [])

  const [tick, setTick] = useState(0)
  // Track viewport/app visibility as state (not refs) so `isLive` is derived
  // safely during render without reading refs in render phase.
  const [isInViewport, setIsInViewport] = useState(true)
  const [isAppVisible, setIsAppVisible] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const intersectionObserverRef = useRef<Taro.IntersectionObserver | null>(null)

  const parsedTarget = useMemo(() => parseTarget(options.target), [options.target])
  const canDisplay = Boolean(parsedTarget) && Boolean(options.enabled)
  const shouldTick = canDisplay && !isDegradation && !reduceMotion

  const forceTick = useCallback(() => {
    setTick((t) => t + 1)
  }, [])

  // Pure, memoized display result derived from props, tick, and live state.
  const result = useMemo(
    () =>
      computeCountdownResult(
        options.target,
        Boolean(options.enabled),
        Date.now(),
        urgentThresholdMinutes,
        shouldTick && isInViewport && isAppVisible,
      ),
    [options.target, options.enabled, urgentThresholdMinutes, shouldTick, isInViewport, isAppVisible, tick],
  )

  const { display, segments, isUrgent, hasStarted, isLive } = result

  // Stop the interval once the event has started so we don't keep ticking.
  useEffect(() => {
    if (!shouldTick || !hasStarted || !timerRef.current) return
    clearInterval(timerRef.current)
    timerRef.current = null
  }, [shouldTick, hasStarted])

  // Viewport intersection observer: pause countdown when the card is off-screen.
  useEffect(() => {
    if (!shouldTick || !options.elementId) {
      setIsInViewport(true)
      return
    }

    const page = getCurrentPage()
    if (!page) {
      setIsInViewport(true)
      return
    }

    try {
      const observer = Taro.createIntersectionObserver(page as any, { thresholds: [0] })
      observer.relativeToViewport({ top: 0, bottom: 0 })
      observer.observe(`#${options.elementId}`, (res) => {
        const ratio = res?.intersectionRatio ?? 0
        setIsInViewport((prev) => {
          const next = ratio > 0
          return prev === next ? prev : next
        })
      })
      intersectionObserverRef.current = observer
    } catch {
      // Fail-open: assume visible if intersection observer is unavailable.
      setIsInViewport(true)
    }

    return () => {
      try {
        intersectionObserverRef.current?.disconnect?.()
      } catch {
        // ignore
      }
      intersectionObserverRef.current = null
    }
  }, [shouldTick, options.elementId])

  // App lifecycle: pause while backgrounded.
  useEffect(() => {
    if (!shouldTick) return

    const handleAppHide = () => {
      setIsAppVisible(false)
    }
    const handleAppShow = () => {
      setIsAppVisible(true)
      forceTick()
    }

    Taro.onAppHide(handleAppHide)
    Taro.onAppShow(handleAppShow)

    return () => {
      Taro.offAppHide(handleAppHide)
      Taro.offAppShow(handleAppShow)
    }
  }, [shouldTick, forceTick])

  // One-second ticker, gated by visibility state.
  useEffect(() => {
    if (!shouldTick) return

    const startTimer = () => {
      if (timerRef.current) return
      timerRef.current = setInterval(() => {
        setTick((t) => t + 1)
      }, 1000)
    }

    const stopTimer = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    // Only tick while visible; this keeps the interval alive but gated,
    // so returning to the screen resumes immediately.
    if (isLive) {
      startTimer()
    } else {
      stopTimer()
    }

    return () => {
      stopTimer()
    }
  }, [shouldTick, isLive])

  useDidShow(() => {
    if (!shouldTick) return
    setIsAppVisible(true)
    forceTick()
  })

  // WeChat keeps tab pages alive-but-hidden in the page stack; without this,
  // hidden cards keep ticking (and re-rendering) every second in the
  // background while the user is on another page.
  useDidHide(() => {
    setIsAppVisible(false)
  })

  return { display, segments, isUrgent, hasStarted, isLive }
}

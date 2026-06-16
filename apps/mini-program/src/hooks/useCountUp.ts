import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'

export interface UseCountUpOptions {
  /** Animation duration in milliseconds. Default: 900. */
  duration?: number
  /** Start counting only when true. Default: true. */
  enabled?: boolean
  /** Delay before counting starts. Default: 0. */
  delay?: number
  /** Explicitly request reduced-motion handling. If omitted, the hook reads the system setting once. */
  prefersReducedMotion?: boolean
}

let systemReducedMotion = false
try {
  systemReducedMotion = (Taro.getSystemInfoSync() as any).reduceMotion === true
} catch {
  systemReducedMotion = false
}

/**
 * Animate a numeric value from 0 to `target` using an ease-out-cubic curve.
 *
 * Designed for small hero numbers (stats, completion percentages). Falls back
 * instantly to the target when `enabled` is false or on the degradation tier.
 *
 * Once the animation has completed for a given mount, re-enabling does not
 * reset to 0 — it snaps to the target to avoid a flash on re-fetch/re-show.
 */
export function useCountUp(target: number, options: UseCountUpOptions = {}): number {
  const { duration = 900, enabled = true, delay = 0, prefersReducedMotion } = options
  const shouldReduceMotion = prefersReducedMotion ?? systemReducedMotion
  const [value, setValue] = useState(enabled && !shouldReduceMotion ? 0 : target)
  const hasAnimatedRef = useRef(false)

  useEffect(() => {
    if (!enabled || shouldReduceMotion) {
      setValue(target)
      return
    }

    // If we already animated on this mount, snap to target to avoid flashing
    // from final -> 0 -> final when enabled flips (e.g., pull-to-refresh).
    if (hasAnimatedRef.current) {
      setValue(target)
      return
    }

    let rafId = 0
    let startTime: number | null = null
    const startValue = 0

    const step = (timestamp: number) => {
      if (startTime == null) {
        startTime = timestamp
      }
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = Math.round(startValue + (target - startValue) * eased)
      setValue(next)
      if (progress < 1) {
        rafId = requestAnimationFrame(step)
      } else {
        hasAnimatedRef.current = true
      }
    }

    const timeoutId = setTimeout(() => {
      rafId = requestAnimationFrame(step)
    }, delay)

    return () => {
      clearTimeout(timeoutId)
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [target, duration, enabled, delay])

  return value
}

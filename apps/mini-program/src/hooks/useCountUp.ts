import { useEffect, useState } from 'react'

export interface UseCountUpOptions {
  /** Animation duration in milliseconds. Default: 900. */
  duration?: number
  /** Start counting only when true. Default: true. */
  enabled?: boolean
  /** Delay before counting starts. Default: 0. */
  delay?: number
}

/**
 * Animate a numeric value from 0 to `target` using an ease-out-cubic curve.
 *
 * Designed for small hero numbers (stats, completion percentages). Falls back
 * instantly to the target when `enabled` is false or on the degradation tier.
 */
export function useCountUp(target: number, options: UseCountUpOptions = {}): number {
  const { duration = 900, enabled = true, delay = 0 } = options
  const [value, setValue] = useState(enabled ? 0 : target)

  useEffect(() => {
    if (!enabled) {
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

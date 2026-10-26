import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { getSystemReducedMotionCompat } from '../lib/utils/systemInfo'

export interface UseCountUpOptions {
  /** Animation duration in milliseconds. Default: 900. */
  duration?: number
  /** Start counting only when true. Default: true. */
  enabled?: boolean
  /** Delay before counting starts. Default: 0. */
  delay?: number
  /** Explicitly request reduced-motion handling. If omitted, the hook reads the system setting once. */
  prefersReducedMotion?: boolean
  /**
   * P1-3 (2026-10-22, UIUX memo §9): easing curve. 'easeOutCubic' (default,
   * legacy) or 'brandBezier' = the brand token cubic-bezier(0.22, 1, 0.36, 1)
   * sampled in JS (bisection solver — `1-(1-t)^3` is NOT the same curve).
   */
  easing?: 'easeOutCubic' | 'brandBezier'
  /**
   * P1-3: minimum milliseconds between setState ticks (0 = every frame).
   * 33 halves setData churn vs 60fps with no perceptible step at 600ms.
   */
  cadenceFloorMs?: number
}

/** cubic-bezier(0.22, 1, 0.36, 1) sampler — bisection solve t for x, then Y(t). */
function sampleBrandBezier(x: number): number {
  const X1 = 0.22
  const X2 = 0.36
  const sample = (t: number, a1: number, a2: number) => {
    const inv = 1 - t
    return 3 * inv * inv * t * a1 + 3 * inv * t * t * a2 + t * t * t
  }
  let lo = 0
  let hi = 1
  let t = x
  for (let i = 0; i < 12; i += 1) {
    t = (lo + hi) / 2
    if (sample(t, X1, X2) < x) lo = t
    else hi = t
  }
  // Y control points are (1, 1) → Y(t) = 3t(1-t) + t³
  return sample(t, 1, 1)
}

let systemReducedMotion = false
try {
  systemReducedMotion = getSystemReducedMotionCompat()
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
  const { duration = 900, enabled = true, delay = 0, prefersReducedMotion, easing = 'easeOutCubic', cadenceFloorMs = 0 } = options
  const shouldReduceMotion = prefersReducedMotion ?? systemReducedMotion
  const [value, setValue] = useState(enabled && !shouldReduceMotion ? 0 : target)
  const hasAnimatedRef = useRef(false)
  const lastTickRef = useRef(0)

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
      const eased = easing === 'brandBezier'
        ? sampleBrandBezier(progress)
        : 1 - Math.pow(1 - progress, 3)
      const next = Math.round(startValue + (target - startValue) * eased)
      // P1-3 cadence floor: skip sub-floor frames entirely (no setState),
      // but never skip the final settle frame.
      if (cadenceFloorMs > 0 && progress < 1 && timestamp - lastTickRef.current < cadenceFloorMs) {
        rafId = requestAnimationFrame(step)
        return
      }
      lastTickRef.current = timestamp
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
  }, [target, duration, enabled, delay, shouldReduceMotion, easing, cadenceFloorMs])

  return value
}

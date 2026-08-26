import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseChoreographedWaitOptions {
  /** Master switch — timers run only while true; re-arms on the false→true edge. */
  active?: boolean
  /** Auto-complete after this long (ms). */
  minDuration: number
  /** Tap-through becomes available after this long (ms). Default 600. */
  skipDelay?: number
  /** Fired exactly once when the wait completes (auto or skip). */
  onComplete?: () => void
  /** Fired with the finish mode before onComplete ('auto' | 'tap'). */
  onFinish?: (mode: 'auto' | 'tap') => void
}

export interface ChoreographedWait {
  /** True once the skip delay has elapsed — safe to show the skip affordance. */
  canSkip: boolean
  isComplete: boolean
  /** Tap-through: no-op before canSkip or after completion. */
  skip: () => void
  /** Ref-based guard — immune to stale render closures (fake-timer tests,
   *  taps landing between the skip timer and the re-render flush). */
  isSkippable: () => boolean
}

export const CHOREOGRAPHED_SKIP_DELAY_MS = 600

/**
 * useChoreographedWait — the shared "min display + tap-through" contract
 * (AnalyzingAnimation pattern): hold a beat for at least `minDuration`,
 * allow the user to tap through once `skipDelay` has elapsed, and fire
 * `onComplete` exactly once either way.
 *
 * Callbacks are held in refs so inline arrow parents never re-arm timers.
 */
export function useChoreographedWait({
  active = true,
  minDuration,
  skipDelay = CHOREOGRAPHED_SKIP_DELAY_MS,
  onComplete,
  onFinish,
}: UseChoreographedWaitOptions): ChoreographedWait {
  const [canSkip, setCanSkip] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const canSkipRef = useRef(false)
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  const finish = useCallback((mode: 'auto' | 'tap') => {
    if (completedRef.current) return
    completedRef.current = true
    setIsComplete(true)
    onFinishRef.current?.(mode)
    onCompleteRef.current?.()
  }, [])

  const skip = useCallback(() => {
    if (!canSkipRef.current || completedRef.current) return
    finish('tap')
  }, [finish])

  const isSkippable = useCallback(
    () => canSkipRef.current && !completedRef.current,
    [],
  )

  useEffect(() => {
    if (!active) return undefined
    completedRef.current = false
    canSkipRef.current = false
    setCanSkip(false)
    setIsComplete(false)
    const skipTimer = setTimeout(() => {
      canSkipRef.current = true
      setCanSkip(true)
    }, skipDelay)
    const completeTimer = setTimeout(() => finish('auto'), minDuration)
    return () => {
      clearTimeout(skipTimer)
      clearTimeout(completeTimer)
    }
  }, [active, minDuration, skipDelay, finish])

  return { canSkip, isComplete, skip, isSkippable }
}

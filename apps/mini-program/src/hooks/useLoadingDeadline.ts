import { useEffect, useState } from 'react'

interface UseLoadingDeadlineResult {
  /** True once `isLoading` has been true for at least `deadlineMs`. */
  isStale: boolean
  /** Approximate milliseconds spent in the current loading spell. */
  elapsedMs: number
}

/**
 * Watches a loading flag and surfaces when it has been active for longer than
 * an acceptable deadline. This is a UX safeguard against hung requests that
 * never settle: instead of letting the user stare at a spinner forever, the UI
 * can switch to a recoverable error / retry state.
 *
 * The timer resets automatically whenever `isLoading` becomes false, so a
 * successful load clears the stale flag for the next spell.
 */
export function useLoadingDeadline(
  isLoading: boolean,
  deadlineMs: number,
): UseLoadingDeadlineResult {
  const [isStale, setIsStale] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (!isLoading) {
      setIsStale(false)
      setElapsedMs(0)
      return
    }

    const startTime = Date.now()
    setIsStale(false)
    setElapsedMs(0)

    const intervalId = setInterval(() => {
      const elapsed = Date.now() - startTime
      setElapsedMs(elapsed)
      if (elapsed >= deadlineMs) {
        setIsStale(true)
        clearInterval(intervalId)
      }
    }, 250)

    return () => clearInterval(intervalId)
  }, [isLoading, deadlineMs])

  return { isStale, elapsedMs }
}

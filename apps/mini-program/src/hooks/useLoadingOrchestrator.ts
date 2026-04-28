import { useState, useEffect, useRef } from 'react'

export interface LoadingOrchestratorResult {
  shouldShow: boolean
  hasBeenLongEnough: boolean
}

/**
 * Manages loading state transitions with debounce.
 * - Resolves within 120ms → skip showing loader entirely
 * - Second loading within 300ms of first → hold same frame (no flash)
 */
export function useLoadingOrchestrator(isLoading: boolean): LoadingOrchestratorResult {
  const [shouldShow, setShouldShow] = useState(false)
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef<number>(0)
  const hideTimeRef = useRef<number>(0)

  useEffect(() => {
    if (isLoading) {
      const sinceHide = Date.now() - hideTimeRef.current
      startTimeRef.current = Date.now()

      // If hidden very recently (<300ms), show immediately to avoid flash
      if (sinceHide < 300) {
        setShouldShow(true)
        return
      }

      // Wait 120ms before committing to show
      showTimerRef.current = setTimeout(() => {
        setShouldShow(true)
      }, 120)

      return () => {
        if (showTimerRef.current) {
          clearTimeout(showTimerRef.current)
          showTimerRef.current = null
        }
      }
    }

    // Loading resolved
    const elapsed = Date.now() - startTimeRef.current
    hideTimeRef.current = Date.now()
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
    setShouldShow(false)
  }, [isLoading])

  return { shouldShow, hasBeenLongEnough: shouldShow }
}

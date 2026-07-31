import { useEffect, useRef, useState } from 'react'
import { FLOW_ANIMATION_TIMING } from './flowAnimation.config'

interface FlowProgressState {
  progress: number
  completed: boolean
}

interface UseFlowProgressOptions {
  durationMs: number
  shouldReduceMotion: boolean
  /** When false, the progress stays at 0 until enabled becomes true. */
  enabled?: boolean
}

export function useFlowProgress(
  durationMs: number,
  shouldReduceMotion: boolean,
  enabled = true,
): FlowProgressState {
  const [progress, setProgress] = useState(shouldReduceMotion ? 1 : 0)
  const startTimeRef = useRef<number | null>(null)
  const wasEnabledRef = useRef(enabled)

  useEffect(() => {
    if (shouldReduceMotion) {
      setProgress(1)
      return
    }

    if (!enabled) {
      setProgress(0)
      return
    }

    // Reset only when transitioning from disabled to enabled.
    if (!wasEnabledRef.current) {
      setProgress(0)
    }
    wasEnabledRef.current = enabled
    startTimeRef.current = Date.now()

    const timer = setInterval(() => {
      const startedAt = startTimeRef.current
      if (startedAt === null) return

      const nextProgress = Math.min((Date.now() - startedAt) / durationMs, 1)
      setProgress(nextProgress)

      if (nextProgress >= 1) {
        clearInterval(timer)
      }
    }, FLOW_ANIMATION_TIMING.progressTickMs)

    return () => {
      clearInterval(timer)
      startTimeRef.current = null
    }
  }, [durationMs, enabled, shouldReduceMotion])

  return {
    progress,
    completed: progress >= 1,
  }
}

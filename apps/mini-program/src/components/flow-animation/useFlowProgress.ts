import { useEffect, useRef, useState } from 'react'
import { FLOW_ANIMATION_TIMING } from './flowAnimation.config'

interface FlowProgressState {
  progress: number
  completed: boolean
}

export function useFlowProgress(
  durationMs: number,
  shouldReduceMotion: boolean,
): FlowProgressState {
  const [progress, setProgress] = useState(shouldReduceMotion ? 1 : 0)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (shouldReduceMotion) {
      setProgress(1)
      return
    }

    setProgress(0)
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
  }, [durationMs, shouldReduceMotion])

  return {
    progress,
    completed: progress >= 1,
  }
}

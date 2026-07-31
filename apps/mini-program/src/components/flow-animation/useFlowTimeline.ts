import { useCallback, useEffect, useRef, useState } from 'react'
import { FLOW_ANIMATION_TIMING } from './flowAnimation.config'

interface FlowTimelineState {
  stageIndex: number
  stageProgress: number
  globalProgress: number
  completed: boolean
}

interface UseFlowTimelineOptions {
  stageDurationsMs: readonly number[]
  shouldReduceMotion: boolean
  onStageLand?: (index: number) => void
  onComplete?: () => void
}

interface UseFlowTimelineReturn extends FlowTimelineState {
  advance: () => void
  skip: () => void
}

function computeGlobalProgress(durations: readonly number[], stageIndex: number, stageProgress: number): number {
  const total = durations.reduce((sum, d) => sum + d, 0)
  if (total <= 0) return 1
  const elapsedBefore = durations.slice(0, stageIndex).reduce((sum, d) => sum + d, 0)
  const currentDuration = durations[stageIndex] ?? 0
  const currentElapsed = currentDuration > 0 ? currentDuration * Math.min(1, Math.max(0, stageProgress)) : 0
  return Math.min(1, (elapsedBefore + currentElapsed) / total)
}

export function useFlowTimeline({
  stageDurationsMs,
  shouldReduceMotion,
  onStageLand,
  onComplete,
}: UseFlowTimelineOptions): UseFlowTimelineReturn {
  const totalStages = Math.max(1, stageDurationsMs.length)
  // Content key guards against consumers passing a fresh array literal each
  // render — effect/callback identity must track CONTENT, not reference,
  // or the stage timer restarts every render and the timeline never advances.
  const durationsKey = stageDurationsMs.join(',')
  const [state, setState] = useState<FlowTimelineState>(() =>
    shouldReduceMotion
      ? { stageIndex: totalStages - 1, stageProgress: 1, globalProgress: 1, completed: true }
      : { stageIndex: 0, stageProgress: 0, globalProgress: 0, completed: false },
  )
  const startTimeRef = useRef<number | null>(null)
  const hasCompletedRef = useRef(false)
  const landedStagesRef = useRef<Set<number>>(new Set())

  const markComplete = useCallback(() => {
    if (hasCompletedRef.current) return
    hasCompletedRef.current = true
    setState({
      stageIndex: totalStages - 1,
      stageProgress: 1,
      globalProgress: 1,
      completed: true,
    })
    onComplete?.()
  }, [totalStages, onComplete])

  const advanceToStage = useCallback(
    (nextIndex: number) => {
      if (nextIndex >= totalStages) {
        markComplete()
        return
      }
      startTimeRef.current = Date.now()
      setState((prev) => ({
        ...prev,
        stageIndex: nextIndex,
        stageProgress: 0,
        globalProgress: computeGlobalProgress(stageDurationsMs, nextIndex, 0),
      }))
    },
    [markComplete, stageDurationsMs, totalStages],
  )

  const advance = useCallback(() => {
    if (state.completed || hasCompletedRef.current) return
    advanceToStage(state.stageIndex + 1)
  }, [advanceToStage, state.completed, state.stageIndex])

  const skip = useCallback(() => {
    markComplete()
  }, [markComplete])

  useEffect(() => {
    if (shouldReduceMotion) {
      markComplete()
      return
    }

    startTimeRef.current = Date.now()
    const timer = setInterval(() => {
      const startedAt = startTimeRef.current
      if (startedAt === null) return

      setState((prev) => {
        if (prev.completed) return prev
        const duration = stageDurationsMs[prev.stageIndex]
        if (!duration || duration <= 0) {
          return {
            ...prev,
            stageProgress: 1,
            globalProgress: computeGlobalProgress(stageDurationsMs, prev.stageIndex, 1),
          }
        }
        const elapsed = Date.now() - startedAt
        const progress = Math.min(1, elapsed / duration)
        if (progress >= 1) {
          const nextIndex = prev.stageIndex + 1
          if (!landedStagesRef.current.has(nextIndex) && nextIndex < totalStages) {
            landedStagesRef.current.add(nextIndex)
            onStageLand?.(nextIndex)
          }
          if (nextIndex >= totalStages) {
            hasCompletedRef.current = true
            onComplete?.()
            return {
              stageIndex: totalStages - 1,
              stageProgress: 1,
              globalProgress: 1,
              completed: true,
            }
          }
          startTimeRef.current = Date.now()
          return {
            ...prev,
            stageIndex: nextIndex,
            stageProgress: 0,
            globalProgress: computeGlobalProgress(stageDurationsMs, nextIndex, 0),
          }
        }
        return {
          ...prev,
          stageProgress: progress,
          globalProgress: computeGlobalProgress(stageDurationsMs, prev.stageIndex, progress),
        }
      })
    }, FLOW_ANIMATION_TIMING.progressTickMs)

    return () => {
      clearInterval(timer)
      startTimeRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- durationsKey tracks content
  }, [markComplete, onComplete, onStageLand, shouldReduceMotion, durationsKey, totalStages])

  return {
    ...state,
    advance,
    skip,
  }
}

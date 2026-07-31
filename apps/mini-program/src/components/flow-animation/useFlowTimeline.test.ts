import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useFlowTimeline } from './useFlowTimeline'

const STAGE_DURATIONS = [160, 160, 160]

describe('useFlowTimeline', () => {
  it('starts at stage 0 and auto-completes after total duration', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const onComplete = vi.fn()
    const { result } = renderHook(() =>
      useFlowTimeline({
        stageDurationsMs: STAGE_DURATIONS,
        shouldReduceMotion: false,
        onComplete,
      }),
    )

    expect(result.current.stageIndex).toBe(0)
    expect(result.current.completed).toBe(false)

    act(() => vi.advanceTimersByTime(160))
    expect(result.current.stageIndex).toBe(1)

    act(() => vi.advanceTimersByTime(160))
    expect(result.current.stageIndex).toBe(2)

    act(() => vi.advanceTimersByTime(160))
    expect(result.current.completed).toBe(true)
    expect(result.current.stageIndex).toBe(2)
    expect(onComplete).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('advance() jumps to the next stage', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { result } = renderHook(() =>
      useFlowTimeline({
        stageDurationsMs: STAGE_DURATIONS,
        shouldReduceMotion: false,
      }),
    )

    expect(result.current.stageIndex).toBe(0)
    act(() => result.current.advance())
    expect(result.current.stageIndex).toBe(1)

    vi.useRealTimers()
  })

  it('skip() completes immediately', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const onComplete = vi.fn()
    const { result } = renderHook(() =>
      useFlowTimeline({
        stageDurationsMs: STAGE_DURATIONS,
        shouldReduceMotion: false,
        onComplete,
      }),
    )

    act(() => result.current.skip())
    expect(result.current.completed).toBe(true)
    expect(result.current.stageIndex).toBe(2)
    expect(onComplete).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('starts completed under reduced motion', () => {
    const { result } = renderHook(() =>
      useFlowTimeline({
        stageDurationsMs: STAGE_DURATIONS,
        shouldReduceMotion: true,
      }),
    )

    expect(result.current.completed).toBe(true)
    expect(result.current.stageIndex).toBe(STAGE_DURATIONS.length - 1)
  })

  it('fires onStageLand when a stage lands', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const onStageLand = vi.fn()
    renderHook(() =>
      useFlowTimeline({
        stageDurationsMs: STAGE_DURATIONS,
        shouldReduceMotion: false,
        onStageLand,
      }),
    )

    act(() => vi.advanceTimersByTime(160))
    expect(onStageLand).toHaveBeenCalledWith(1)
    expect(onStageLand).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('globalProgress maps to cumulative stage durations', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { result } = renderHook(() =>
      useFlowTimeline({
        stageDurationsMs: STAGE_DURATIONS,
        shouldReduceMotion: false,
      }),
    )

    const total = STAGE_DURATIONS.reduce((a, b) => a + b, 0)
    act(() => vi.advanceTimersByTime(80))
    expect(result.current.globalProgress).toBeCloseTo(80 / total, 1)

    act(() => vi.advanceTimersByTime(80))
    expect(result.current.stageIndex).toBe(1)
    expect(result.current.globalProgress).toBeCloseTo(160 / total, 1)

    vi.useRealTimers()
  })

  it('does not restart the stage timer when the consumer passes a fresh array each render (B1 regression)', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // Simulates the BlindBoxLifecycleFlow bug: Array.from(...) on every render.
    const { result, rerender } = renderHook(() =>
      useFlowTimeline({
        stageDurationsMs: [...STAGE_DURATIONS],
        shouldReduceMotion: false,
      }),
    )

    act(() => vi.advanceTimersByTime(80))
    const progressAfterOneTick = result.current.globalProgress
    expect(progressAfterOneTick).toBeGreaterThan(0)

    // Re-render (new array identity) several times; progress must keep climbing.
    rerender()
    rerender()
    act(() => vi.advanceTimersByTime(80))
    rerender()
    act(() => vi.advanceTimersByTime(80))
    expect(result.current.stageIndex).toBe(1)

    vi.useRealTimers()
  })
})

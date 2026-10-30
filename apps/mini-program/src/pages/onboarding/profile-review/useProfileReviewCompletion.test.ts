import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PROFILE_REVIEW_SUCCESS_DWELL_MS,
  useProfileReviewCompletion,
} from './useProfileReviewCompletion'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function createOptions() {
  return {
    shouldReduceMotion: false,
    complete: vi.fn(),
    resolveNextStep: vi.fn(),
    navigate: vi.fn().mockResolvedValue(undefined),
    onServerComplete: vi.fn(),
    onStepCompleted: vi.fn(),
    onNavigate: vi.fn(),
    onFailure: vi.fn(),
  }
}

describe('useProfileReviewCompletion', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('deduplicates same-tick submits and navigates once after the inline success beat', async () => {
    const request = deferred<{ nextStep: 'discover' }>()
    const options = createOptions()
    options.complete.mockReturnValue(request.promise)
    const { result } = renderHook(() => useProfileReviewCompletion(options))

    let completion!: Promise<void>
    act(() => {
      completion = result.current.begin()
      void result.current.begin()
      void result.current.begin()
    })
    expect(options.complete).toHaveBeenCalledTimes(1)
    expect(result.current.phase).toBe('submitting')

    await act(async () => {
      request.resolve({ nextStep: 'discover' })
      await completion
    })
    expect(result.current.phase).toBe('celebrating')
    expect(options.onServerComplete).toHaveBeenCalledTimes(1)
    expect(options.navigate).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROFILE_REVIEW_SUCCESS_DWELL_MS - 1)
    })
    expect(options.navigate).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(options.navigate).toHaveBeenCalledTimes(1)
    expect(options.navigate).toHaveBeenCalledWith('discover')
    expect(options.onStepCompleted).toHaveBeenCalledTimes(1)
  })

  it('uses zero artificial success delay for reduced motion', async () => {
    const options = createOptions()
    options.shouldReduceMotion = true
    options.complete.mockResolvedValue({ nextStep: 'discover' })
    const { result } = renderHook(() => useProfileReviewCompletion(options))

    await act(async () => {
      await result.current.begin()
    })

    expect(options.navigate).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('falls back to the server state only when nextStep is nullish', async () => {
    const options = createOptions()
    options.complete.mockResolvedValue({ nextStep: null })
    options.resolveNextStep.mockResolvedValue({ nextStep: 'essential-data' })
    options.shouldReduceMotion = true
    const { result } = renderHook(() => useProfileReviewCompletion(options))

    await act(async () => {
      await result.current.begin()
    })

    expect(options.resolveNextStep).toHaveBeenCalledTimes(1)
    expect(options.navigate).toHaveBeenCalledWith('essential-data')
  })

  it('keeps a second null nextStep retryable instead of defaulting to discover', async () => {
    const options = createOptions()
    options.complete.mockResolvedValue({ nextStep: null })
    options.resolveNextStep.mockResolvedValue({ nextStep: null })
    options.shouldReduceMotion = true
    const { result } = renderHook(() => useProfileReviewCompletion(options))

    await act(async () => {
      await result.current.begin()
    })

    expect(result.current.phase).toBe('error')
    expect(options.navigate).not.toHaveBeenCalled()
    expect(options.onStepCompleted).not.toHaveBeenCalled()
    expect(options.onFailure).toHaveBeenCalledWith(
      'navigate',
      expect.any(Error),
      expect.any(String),
    )

    options.resolveNextStep.mockResolvedValue({ nextStep: 'essential-data' })
    await act(async () => {
      await result.current.begin()
    })
    expect(options.complete).toHaveBeenCalledTimes(1)
    expect(options.navigate).toHaveBeenCalledWith('essential-data')
  })

  it('keeps a failed completion retryable', async () => {
    const options = createOptions()
    options.complete
      .mockRejectedValueOnce(new Error('network offline'))
      .mockResolvedValueOnce({ nextStep: 'discover' })
    options.shouldReduceMotion = true
    const { result } = renderHook(() => useProfileReviewCompletion(options))

    await act(async () => {
      await result.current.begin()
    })
    expect(result.current.phase).toBe('error')
    expect(result.current.error).toContain('网络')
    expect(options.onFailure).toHaveBeenCalledWith(
      'complete',
      expect.any(Error),
      expect.stringContaining('网络'),
    )

    await act(async () => {
      await result.current.begin()
    })
    expect(options.complete).toHaveBeenCalledTimes(2)
    expect(options.navigate).toHaveBeenCalledTimes(1)
  })

  it('retries only navigation after a post-completion routing failure', async () => {
    const options = createOptions()
    options.complete.mockResolvedValue({ nextStep: 'discover' })
    options.navigate
      .mockRejectedValueOnce(new Error('switchTab failed'))
      .mockResolvedValueOnce(undefined)
    options.shouldReduceMotion = true
    const { result } = renderHook(() => useProfileReviewCompletion(options))

    await act(async () => {
      await result.current.begin()
    })
    expect(result.current.phase).toBe('error')
    expect(options.complete).toHaveBeenCalledTimes(1)
    expect(options.onStepCompleted).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.begin()
    })
    expect(options.complete).toHaveBeenCalledTimes(1)
    expect(options.onServerComplete).toHaveBeenCalledTimes(1)
    expect(options.onStepCompleted).toHaveBeenCalledTimes(1)
    expect(options.navigate).toHaveBeenCalledTimes(2)
    expect(result.current.phase).toBe('navigating')
    expect(result.current.isCelebrating).toBe(false)
  })

  it('holds the live completion latch across hide/show and resumes the success beat on show', async () => {
    const request = deferred<{ nextStep: 'discover' }>()
    const options = createOptions()
    options.complete.mockReturnValue(request.promise)
    const { result } = renderHook(() => useProfileReviewCompletion(options))

    let completion!: Promise<void>
    act(() => {
      completion = result.current.begin()
      result.current.handleHide()
      void result.current.begin()
    })
    expect(options.complete).toHaveBeenCalledTimes(1)

    await act(async () => {
      request.resolve({ nextStep: 'discover' })
      await completion
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROFILE_REVIEW_SUCCESS_DWELL_MS * 2)
    })
    expect(options.navigate).not.toHaveBeenCalled()

    act(() => {
      result.current.handleShow()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROFILE_REVIEW_SUCCESS_DWELL_MS)
    })
    expect(options.complete).toHaveBeenCalledTimes(1)
    expect(options.navigate).toHaveBeenCalledTimes(1)
  })

  it('pauses a late nextStep resolution while hidden and resumes without replaying celebration', async () => {
    const resolution = deferred<{ nextStep: 'essential-data' }>()
    const options = createOptions()
    options.complete.mockResolvedValue({ nextStep: null })
    options.resolveNextStep.mockReturnValue(resolution.promise)
    options.shouldReduceMotion = true
    const { result } = renderHook(() => useProfileReviewCompletion(options))

    await act(async () => {
      await result.current.begin()
    })
    expect(options.resolveNextStep).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.handleHide()
    })
    await act(async () => {
      resolution.resolve({ nextStep: 'essential-data' })
      await resolution.promise
      await Promise.resolve()
    })
    expect(options.navigate).not.toHaveBeenCalled()
    expect(options.onStepCompleted).not.toHaveBeenCalled()

    await act(async () => {
      result.current.handleShow()
      await Promise.resolve()
    })
    expect(options.navigate).toHaveBeenCalledWith('essential-data')
    expect(options.onServerComplete).toHaveBeenCalledTimes(1)
    expect(options.onStepCompleted).toHaveBeenCalledTimes(1)
    expect(result.current.isCelebrating).toBe(false)
  })

  it('ignores a deferred nextStep resolution after unmount', async () => {
    const resolution = deferred<{ nextStep: 'discover' }>()
    const options = createOptions()
    options.complete.mockResolvedValue({ nextStep: null })
    options.resolveNextStep.mockReturnValue(resolution.promise)
    options.shouldReduceMotion = true
    const { result, unmount } = renderHook(() => useProfileReviewCompletion(options))

    await act(async () => {
      await result.current.begin()
    })
    unmount()
    await act(async () => {
      resolution.resolve({ nextStep: 'discover' })
      await resolution.promise
      await Promise.resolve()
    })

    expect(options.navigate).not.toHaveBeenCalled()
    expect(options.onStepCompleted).not.toHaveBeenCalled()
    expect(options.onNavigate).not.toHaveBeenCalled()
  })

  it('deduplicates navigation while the routing promise is still pending', async () => {
    const navigation = deferred<void>()
    const options = createOptions()
    options.complete.mockResolvedValue({ nextStep: 'discover' })
    options.navigate.mockReturnValue(navigation.promise)
    options.shouldReduceMotion = true
    const { result } = renderHook(() => useProfileReviewCompletion(options))

    await act(async () => {
      await result.current.begin()
      void result.current.begin()
      void result.current.begin()
    })
    expect(options.navigate).toHaveBeenCalledTimes(1)

    await act(async () => {
      navigation.resolve()
      await navigation.promise
    })
  })
})

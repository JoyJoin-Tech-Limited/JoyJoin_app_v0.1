import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requestAnimationFrame: vi.fn(),
  cancelAnimationFrame: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    requestAnimationFrame: mocks.requestAnimationFrame,
    cancelAnimationFrame: mocks.cancelAnimationFrame,
  },
}))

import { measureFrameBudget } from './frameBudget'

describe('measureFrameBudget', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.requestAnimationFrame.mockReset()
    mocks.cancelAnimationFrame.mockReset()
    mocks.requestAnimationFrame.mockReturnValue(17)
  })

  it('uses the matching Taro cancellation API without requiring a browser global', async () => {
    const originalCancelAnimationFrame = globalThis.cancelAnimationFrame
    Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')

    try {
      const resultPromise = measureFrameBudget(10)
      await vi.advanceTimersByTimeAsync(10)

      await expect(resultPromise).resolves.toEqual({
        tier: 'full',
        avgFps: 60,
        droppedFrames: 0,
      })
      expect(mocks.cancelAnimationFrame).toHaveBeenCalledWith(17)
    } finally {
      if (originalCancelAnimationFrame) {
        globalThis.cancelAnimationFrame = originalCancelAnimationFrame
      }
      vi.useRealTimers()
    }
  })
})

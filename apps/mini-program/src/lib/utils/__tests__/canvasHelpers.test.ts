import Taro from '@tarojs/taro'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exportCanvasWithRetry } from '../canvasHelpers'

describe('exportCanvasWithRetry cleanup ownership', () => {
  const unlinkSync = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    unlinkSync.mockReset()
    ;(Taro as unknown as { canvasToTempFilePath: unknown }).canvasToTempFilePath = vi.fn()
      .mockResolvedValue({ tempFilePath: 'tmp://poster' })
    ;(Taro as unknown as { getFileSystemManager: unknown }).getFileSystemManager = vi.fn()
      .mockReturnValue({ unlinkSync })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('preserves the legacy 60 second auto-cleanup by default', async () => {
    await expect(exportCanvasWithRetry('poster', 100, 200)).resolves.toBe('tmp://poster')
    expect(unlinkSync).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(unlinkSync).toHaveBeenCalledWith('tmp://poster')
  })

  it('lets a lifecycle-owning caller opt out without scheduling cleanup', async () => {
    await expect(
      exportCanvasWithRetry('poster', 100, 200, [2, 1], { autoCleanup: false }),
    ).resolves.toBe('tmp://poster')

    await vi.advanceTimersByTimeAsync(120_000)
    expect(unlinkSync).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})

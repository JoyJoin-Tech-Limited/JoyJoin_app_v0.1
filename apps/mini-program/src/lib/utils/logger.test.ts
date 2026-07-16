import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getRealtimeLogManager: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getRealtimeLogManager: mocks.getRealtimeLogManager,
  },
}))

describe('mini-program realtime logger safety', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.getRealtimeLogManager.mockReset()
  })

  it('does not fail module initialization when WeChat rejects the manager', async () => {
    mocks.getRealtimeLogManager.mockImplementationOnce(() => {
      throw new Error('realtime logger unavailable')
    })

    const logger = await import('./logger')

    expect(() => logger.logInfo('tap')).not.toThrow()
    expect(() => logger.logWarn('retry')).not.toThrow()
    expect(() => logger.logError('failure')).not.toThrow()
  })

  it('never lets a realtime log method interrupt the calling workflow', async () => {
    const manager = {
      info: vi.fn(() => { throw new Error('info failed') }),
      warn: vi.fn(() => { throw new Error('warn failed') }),
      error: vi.fn(() => { throw new Error('error failed') }),
    }
    mocks.getRealtimeLogManager.mockReturnValue(manager)
    const logger = await import('./logger')

    expect(() => logger.logInfo('start', { slug: 'alang-demo' })).not.toThrow()
    expect(() => logger.logWarn('retry', { circular: undefined })).not.toThrow()
    expect(() => logger.logError('failed')).not.toThrow()
    expect(manager.info).toHaveBeenCalledTimes(1)
    expect(manager.warn).toHaveBeenCalledTimes(1)
    expect(manager.error).toHaveBeenCalledTimes(1)
  })
})

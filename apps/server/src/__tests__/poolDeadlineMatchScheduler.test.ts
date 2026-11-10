import { describe, expect, it, vi } from 'vitest'
import {
  createPoolDeadlineMatchScheduler,
  POOL_DEADLINE_MATCH_SWEEP_INTERVAL_MS,
  type PoolDeadlineMatchSweepResult,
} from '../lib/poolDeadlineMatchScheduler'

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}

function emptyResult(): PoolDeadlineMatchSweepResult {
  return { scannedPools: 0, matchedPools: 0, closedPools: 0, failedPools: 0 }
}

function makeScheduler(overrides: {
  isEnabled?: () => Promise<boolean>
  sweep?: () => Promise<PoolDeadlineMatchSweepResult>
  logger?: ReturnType<typeof makeLogger>
} = {}) {
  const logger = overrides.logger ?? makeLogger()
  const sweep = vi.fn(overrides.sweep ?? (async () => emptyResult()))
  const scheduler = createPoolDeadlineMatchScheduler({
    logger: logger as never,
    isEnabled: overrides.isEnabled ?? (async () => true),
    sweep: sweep as never,
    now: () => new Date('2026-11-10T10:00:00+08:00'),
    intervalMs: POOL_DEADLINE_MATCH_SWEEP_INTERVAL_MS,
  })

  return { scheduler, logger, sweep }
}

describe('createPoolDeadlineMatchScheduler', () => {
  it('does not sweep while the kill switch is off', async () => {
    const { scheduler, sweep } = makeScheduler({ isEnabled: async () => false })

    await scheduler.runOnce()

    expect(sweep).not.toHaveBeenCalled()
  })

  it('runs one sweep per tick when enabled', async () => {
    const { scheduler, sweep } = makeScheduler()

    await scheduler.runOnce()
    await scheduler.runOnce()

    expect(sweep).toHaveBeenCalledTimes(2)
  })

  it('fails open when the sweep throws, so the next tick still retries', async () => {
    const logger = makeLogger()
    const { scheduler } = makeScheduler({
      logger,
      sweep: async () => {
        throw new Error('db down')
      },
    })

    await expect(scheduler.runOnce()).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalled()
  })

  it('stops scheduling after stop() and never double-starts', async () => {
    vi.useFakeTimers()
    try {
      const { scheduler, sweep } = makeScheduler()

      scheduler.start()
      scheduler.start()
      // start() runs immediately once — a second start() must not add a timer.
      await vi.advanceTimersByTimeAsync(0)
      expect(sweep).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(POOL_DEADLINE_MATCH_SWEEP_INTERVAL_MS)
      expect(sweep).toHaveBeenCalledTimes(2)

      scheduler.stop()
      await vi.advanceTimersByTimeAsync(POOL_DEADLINE_MATCH_SWEEP_INTERVAL_MS * 3)
      expect(sweep).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

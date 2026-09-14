import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * W8 (AC-W8.4) — stuck-`matching` watchdog scheduler.
 *
 * `saveMatchResults` flips a pool `active → matching` as its execution guard; a
 * crash between that CAS and the commit leaves the pool stuck forever. The
 * watchdog resets such pools to `active` and pages ops.
 */

vi.mock('../db', () => ({ db: {} }));
vi.mock('../lib/wecomNotifications/matching', () => ({
  notifyStuckMatchingPool: vi.fn().mockResolvedValue(undefined),
}));

const { loggerErrorMock, loggerWarnMock, loggerInfoMock } = vi.hoisted(() => ({
  loggerErrorMock: vi.fn(),
  loggerWarnMock: vi.fn(),
  loggerInfoMock: vi.fn(),
}));
vi.mock('../lib/logger', () => ({
  logger: { error: loggerErrorMock, warn: loggerWarnMock, info: loggerInfoMock },
}));

import {
  createPoolMatchingWatchdogScheduler,
  POOL_MATCHING_WATCHDOG_INTERVAL_MS,
} from '../lib/poolMatchingWatchdog';

function makePool(overrides: Partial<any> = {}) {
  return { id: 'pool-1', title: 'Test Pool', updatedAt: new Date(Date.now() - 30 * 60 * 1000), ...overrides };
}

describe('W8 AC-W8.4 — pool matching watchdog scheduler', () => {
  beforeEach(() => {
    loggerErrorMock.mockReset();
    loggerWarnMock.mockReset();
    loggerInfoMock.mockReset();
  });

  it('logs an error when stuck pools are recovered', async () => {
    const resetStuckMatchingPools = vi.fn().mockResolvedValue([makePool()]);
    const scheduler = createPoolMatchingWatchdogScheduler({
      logger: { info: loggerInfoMock, error: loggerErrorMock },
      resetStuckMatchingPools,
    });

    await scheduler.run();

    expect(resetStuckMatchingPools).toHaveBeenCalledTimes(1);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      '[Pool Matching Watchdog] recovered stuck matching pools',
      expect.objectContaining({ recoveredCount: 1, poolIds: ['pool-1'] }),
    );
    expect(scheduler.getConsecutiveFailures()).toBe(0);
  });

  it('stays fail-open on a transient error (does not stop the watchdog)', async () => {
    const resetStuckMatchingPools = vi.fn().mockRejectedValueOnce(new Error('db down'));
    const scheduler = createPoolMatchingWatchdogScheduler({
      logger: { info: loggerInfoMock, error: loggerErrorMock },
      resetStuckMatchingPools,
    });

    await scheduler.run();

    expect(scheduler.isStopped()).toBe(false);
    expect(scheduler.getConsecutiveFailures()).toBe(1);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      '[Pool Matching Watchdog] sweep failed; will retry next tick',
      expect.objectContaining({ failOpen: true, consecutiveFailures: 1, error: 'db down' }),
    );
  });

  it('schedules on the documented interval and stops cleanly', async () => {
    vi.useFakeTimers();
    try {
      const resetStuckMatchingPools = vi.fn().mockResolvedValue([]);
      const scheduler = createPoolMatchingWatchdogScheduler({
        logger: { info: loggerInfoMock, error: loggerErrorMock },
        resetStuckMatchingPools,
      });

      scheduler.start();
      await vi.advanceTimersByTimeAsync(POOL_MATCHING_WATCHDOG_INTERVAL_MS);
      expect(resetStuckMatchingPools).toHaveBeenCalledTimes(1);

      scheduler.stop();
      await vi.advanceTimersByTimeAsync(POOL_MATCHING_WATCHDOG_INTERVAL_MS * 3);
      expect(resetStuckMatchingPools).toHaveBeenCalledTimes(1);
      expect(scheduler.isStopped()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

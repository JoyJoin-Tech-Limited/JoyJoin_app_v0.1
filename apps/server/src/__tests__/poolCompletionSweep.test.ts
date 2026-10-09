import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Pool completion sweep scheduler (2026-10-06).
 *
 * Before this sweep, event_pools.status='completed' was only reachable via
 * manual admin PATCH and matchStatus='completed' had zero writers. These tests
 * lock the scheduler contract: flag-gated, fail-open, idempotent no-op ticks.
 */

const { loggerInfoMock, loggerWarnMock, loggerErrorMock } = vi.hoisted(() => ({
  loggerInfoMock: vi.fn(),
  loggerWarnMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: loggerInfoMock, warn: loggerWarnMock, error: loggerErrorMock },
}));

vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: vi.fn().mockResolvedValue(true),
}));

// The DB-touching core is mocked at the module boundary; its SQL correctness
// rests on the declarative idempotent WHERE clauses (status-scoped updates).
vi.mock('../lib/poolCompletionSweep', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/poolCompletionSweep')>();
  return { ...actual, sweepCompletedPools: vi.fn() };
});

import {
  createPoolCompletionSweepScheduler,
  sweepCompletedPools,
  POOL_COMPLETION_SWEEP_INTERVAL_MS,
} from '../lib/poolCompletionSweep';

const sweepMock = vi.mocked(sweepCompletedPools);

function makeScheduler(overrides: Partial<Parameters<typeof createPoolCompletionSweepScheduler>[0]> = {}) {
  return createPoolCompletionSweepScheduler({
    logger: { info: loggerInfoMock, warn: loggerWarnMock, error: loggerErrorMock },
    isEnabled: vi.fn().mockResolvedValue(true),
    sweep: sweepMock,
    now: () => new Date('2026-10-06T12:00:00Z'),
    intervalMs: POOL_COMPLETION_SWEEP_INTERVAL_MS,
    ...overrides,
  });
}

describe('pool completion sweep scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sweepMock.mockResolvedValue({ completedPools: 0, completedRegistrations: 0, poolIds: [] });
  });

  it('runs a sweep tick and logs only when pools completed', async () => {
    sweepMock.mockResolvedValue({ completedPools: 2, completedRegistrations: 9, poolIds: ['p1', 'p2'] });
    const scheduler = makeScheduler();
    await scheduler.runOnce();
    expect(sweepMock).toHaveBeenCalledTimes(1);
    expect(loggerInfoMock).toHaveBeenCalledWith(
      '[PoolCompletionSweep] tick completed pools',
      expect.objectContaining({ completedPools: 2, completedRegistrations: 9 }),
    );
  });

  it('stays quiet on an empty tick (idempotent no-op)', async () => {
    const scheduler = makeScheduler();
    await scheduler.runOnce();
    expect(sweepMock).toHaveBeenCalledTimes(1);
    expect(loggerInfoMock).not.toHaveBeenCalledWith(
      '[PoolCompletionSweep] tick completed pools',
      expect.anything(),
    );
  });

  it('does nothing when the feature flag is off', async () => {
    const scheduler = makeScheduler({ isEnabled: vi.fn().mockResolvedValue(false) });
    await scheduler.runOnce();
    expect(sweepMock).not.toHaveBeenCalled();
  });

  it('is fail-open: a sweep error is logged, not thrown', async () => {
    sweepMock.mockRejectedValue(new Error('db down'));
    const scheduler = makeScheduler();
    await expect(scheduler.runOnce()).resolves.toBeUndefined();
    expect(loggerWarnMock).toHaveBeenCalledWith(
      '[PoolCompletionSweep] tick failed; will retry next interval',
      expect.objectContaining({ error: expect.stringContaining('db down') }),
    );
  });

  it('stop() prevents further ticks', async () => {
    const scheduler = makeScheduler();
    scheduler.stop();
    await scheduler.runOnce();
    expect(sweepMock).not.toHaveBeenCalled();
  });

  it('defaults the flag read to poolCompletionSweepEnabled with default true', async () => {
    const { getFeatureFlag } = await import('../lib/featureFlags');
    const scheduler = createPoolCompletionSweepScheduler({
      logger: { info: loggerInfoMock, warn: loggerWarnMock, error: loggerErrorMock },
      isEnabled: () => vi.mocked(getFeatureFlag)('poolCompletionSweepEnabled', true),
      sweep: sweepMock,
      now: () => new Date(),
      intervalMs: POOL_COMPLETION_SWEEP_INTERVAL_MS,
    });
    await scheduler.runOnce();
    expect(vi.mocked(getFeatureFlag)).toHaveBeenCalledWith('poolCompletionSweepEnabled', true);
  });
});

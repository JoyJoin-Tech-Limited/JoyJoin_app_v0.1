import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerInfoMock, loggerErrorMock, sweepExpiredSessionsMock } = vi.hoisted(() => ({
  loggerInfoMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  sweepExpiredSessionsMock: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    info: loggerInfoMock,
    error: loggerErrorMock,
  },
}));

vi.mock('../lib/socialIcebreakerStore', () => ({
  sweepExpiredSessions: sweepExpiredSessionsMock,
}));

import {
  createSocialIcebreakerSweepScheduler,
  SOCIAL_ICEBREAKER_SWEEP_INTERVAL_MS,
  SWEEP_RETRY_BASE_DELAY_MS,
  sweepRetryDelayMs,
} from '../lib/socialIcebreakerSweep';

describe('social icebreaker ttl sweep scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    loggerInfoMock.mockReset();
    loggerErrorMock.mockReset();
    sweepExpiredSessionsMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // W8 (AC-W8.2): a transient store failure must NOT permanently disable the
  // sweep. Guards against the pre-W8 behavior where one failure stopped all
  // future TTL housekeeping for the life of the process.
  it('recovers from a transient failure with a backoff retry instead of disabling', async () => {
    sweepExpiredSessionsMock
      .mockRejectedValueOnce(
        Object.assign(new Error('relation "social_icebreaker_sessions" does not exist'), {
          code: '42P01',
        }),
      )
      .mockResolvedValue(undefined);

    const scheduler = createSocialIcebreakerSweepScheduler();

    scheduler.start();

    // First sweep fails → logged fail-open + a retry is scheduled.
    await vi.advanceTimersByTimeAsync(SOCIAL_ICEBREAKER_SWEEP_INTERVAL_MS);
    expect(sweepExpiredSessionsMock).toHaveBeenCalledTimes(1);
    expect(scheduler.isDisabled()).toBe(false);
    expect(scheduler.getConsecutiveFailures()).toBe(1);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Social icebreaker TTL sweep failed; retrying with backoff',
      expect.objectContaining({
        component: 'social_icebreaker_ttl_sweep',
        failOpen: true,
        disableFutureSweeps: false,
        consecutiveFailures: 1,
        retryInMs: SWEEP_RETRY_BASE_DELAY_MS,
        code: '42P01',
        error: 'relation "social_icebreaker_sessions" does not exist',
      }),
    );

    // Backoff retry fires and succeeds → failures reset, sweep stays enabled.
    await vi.advanceTimersByTimeAsync(SWEEP_RETRY_BASE_DELAY_MS);
    expect(sweepExpiredSessionsMock).toHaveBeenCalledTimes(2);
    expect(scheduler.isDisabled()).toBe(false);
    expect(scheduler.getConsecutiveFailures()).toBe(0);
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'Social icebreaker TTL sweep recovered after failure',
      expect.objectContaining({ previousConsecutiveFailures: 1 }),
    );
  });

  it('keeps sweeping on the normal interval after recovery', async () => {
    sweepExpiredSessionsMock.mockRejectedValueOnce(new Error('transient')).mockResolvedValue(undefined);

    const scheduler = createSocialIcebreakerSweepScheduler();
    scheduler.start();

    await vi.advanceTimersByTimeAsync(SOCIAL_ICEBREAKER_SWEEP_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(SWEEP_RETRY_BASE_DELAY_MS);
    const callsAfterRecovery = sweepExpiredSessionsMock.mock.calls.length;

    await vi.advanceTimersByTimeAsync(SOCIAL_ICEBREAKER_SWEEP_INTERVAL_MS);

    expect(sweepExpiredSessionsMock.mock.calls.length).toBeGreaterThan(callsAfterRecovery);
    expect(scheduler.isDisabled()).toBe(false);
  });

  it('stop() halts all future sweeps and retries', async () => {
    sweepExpiredSessionsMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);

    const scheduler = createSocialIcebreakerSweepScheduler();
    scheduler.start();

    await vi.advanceTimersByTimeAsync(SOCIAL_ICEBREAKER_SWEEP_INTERVAL_MS);
    scheduler.stop();
    expect(scheduler.isDisabled()).toBe(true);

    await vi.advanceTimersByTimeAsync(SOCIAL_ICEBREAKER_SWEEP_INTERVAL_MS * 3);
    expect(sweepExpiredSessionsMock).toHaveBeenCalledTimes(1);
  });

  it('caps the backoff delay', () => {
    expect(sweepRetryDelayMs(1)).toBe(SWEEP_RETRY_BASE_DELAY_MS);
    expect(sweepRetryDelayMs(2)).toBe(SWEEP_RETRY_BASE_DELAY_MS * 2);
    expect(sweepRetryDelayMs(20)).toBe(5 * 60 * 1000);
  });
});

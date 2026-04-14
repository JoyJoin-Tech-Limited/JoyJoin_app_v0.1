import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerErrorMock, sweepExpiredSessionsMock } = vi.hoisted(() => ({
  loggerErrorMock: vi.fn(),
  sweepExpiredSessionsMock: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    error: loggerErrorMock,
  },
}));

vi.mock('../lib/socialIcebreakerStore', () => ({
  sweepExpiredSessions: sweepExpiredSessionsMock,
}));

import {
  createSocialIcebreakerSweepScheduler,
  SOCIAL_ICEBREAKER_SWEEP_INTERVAL_MS,
} from '../lib/socialIcebreakerSweep';

describe('social icebreaker ttl sweep scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    loggerErrorMock.mockReset();
    sweepExpiredSessionsMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fails open and disables future sweeps after the first store failure', async () => {
    // Guards against regression: missing or drifted social icebreaker tables
    // must not crash the API process through the background sweep.
    sweepExpiredSessionsMock.mockRejectedValue(
      Object.assign(new Error('relation "social_icebreaker_sessions" does not exist'), {
        code: '42P01',
      }),
    );

    const scheduler = createSocialIcebreakerSweepScheduler();

    scheduler.start();

    await vi.advanceTimersByTimeAsync(SOCIAL_ICEBREAKER_SWEEP_INTERVAL_MS);

    expect(sweepExpiredSessionsMock).toHaveBeenCalledTimes(1);
    expect(scheduler.isDisabled()).toBe(true);
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Disabled social icebreaker TTL sweep after failure',
      expect.objectContaining({
        component: 'social_icebreaker_ttl_sweep',
        failOpen: true,
        disableFutureSweeps: true,
        code: '42P01',
        error: 'relation "social_icebreaker_sessions" does not exist',
      }),
    );

    await vi.advanceTimersByTimeAsync(SOCIAL_ICEBREAKER_SWEEP_INTERVAL_MS * 2);

    expect(sweepExpiredSessionsMock).toHaveBeenCalledTimes(1);
  });
});
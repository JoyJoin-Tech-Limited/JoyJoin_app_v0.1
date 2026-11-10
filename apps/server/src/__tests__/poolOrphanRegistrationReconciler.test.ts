import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPoolOrphanRegistrationScheduler,
  POOL_ORPHAN_SWEEP_INTERVAL_MS,
  type PoolOrphanSweepResult,
} from "../lib/poolOrphanRegistrationReconciler";

function makeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function emptyResult(): PoolOrphanSweepResult {
  return { scannedPools: 0, orphanRegistrations: 0, refundedPools: 0, failedPools: 0 };
}

function makeScheduler(overrides: Partial<Parameters<typeof createPoolOrphanRegistrationScheduler>[0]> = {}) {
  const logger = makeLogger();
  const sweep = vi.fn(async () => emptyResult());
  const scheduler = createPoolOrphanRegistrationScheduler({
    logger,
    isEnabled: async () => true,
    sweep,
    now: () => new Date("2026-11-11T10:00:00+08:00"),
    intervalMs: POOL_ORPHAN_SWEEP_INTERVAL_MS,
    ...overrides,
  });
  return { scheduler, logger, sweep };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("poolOrphanRegistrationScheduler", () => {
  it("does not sweep while the kill switch is off", async () => {
    const { scheduler, sweep } = makeScheduler({ isEnabled: async () => false });

    await scheduler.runOnce();

    expect(sweep).not.toHaveBeenCalled();
  });

  it("sweeps once per tick when enabled", async () => {
    const { scheduler, sweep } = makeScheduler();

    await scheduler.runOnce();
    await scheduler.runOnce();

    expect(sweep).toHaveBeenCalledTimes(2);
  });

  it("fails open when the sweep throws", async () => {
    const throwingSweep = vi.fn(async () => {
      throw new Error("db down");
    });
    const { scheduler, logger } = makeScheduler({ sweep: throwingSweep });

    await expect(scheduler.runOnce()).resolves.toBeUndefined();
    expect(throwingSweep).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalled();
  });

  it("starts once, ticks on the interval, and stops cleanly", async () => {
    vi.useFakeTimers();
    const { scheduler, sweep } = makeScheduler();

    scheduler.start();
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(sweep).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(POOL_ORPHAN_SWEEP_INTERVAL_MS);
    expect(sweep).toHaveBeenCalledTimes(2);

    scheduler.stop();
    await vi.advanceTimersByTimeAsync(POOL_ORPHAN_SWEEP_INTERVAL_MS * 3);
    expect(sweep).toHaveBeenCalledTimes(2);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * W8 (AC-W8.5) — venue-TBD retry scheduler.
 *
 * Venue assignment runs once; when it leaves a group unassigned the scheduler
 * retries and warns ops after repeated failures. Inside the T-24h window the
 * promise wins: the pool is cancelled and refunded instead of alerted on.
 */

vi.mock('../lib/venueTbdRetry', () => ({
  retryVenueTbdAssignments: vi.fn(),
  cancelPoolForUnresolvedVenue: vi.fn(),
}));

const { loggerWarnMock, loggerErrorMock, loggerInfoMock, notifyMock, cancelMock } = vi.hoisted(() => ({
  loggerWarnMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  notifyMock: vi.fn().mockResolvedValue(undefined),
  cancelMock: vi.fn().mockResolvedValue({
    poolId: 'pool-1',
    cancelled: true,
    refunded: true,
    reason: 'venue_unresolved_deadline',
  }),
}));

vi.mock('../lib/logger', () => ({
  logger: { warn: loggerWarnMock, error: loggerErrorMock, info: loggerInfoMock },
}));

vi.mock('../lib/wecomNotifications/matching', () => ({
  notifyVenueTbdEscalation: notifyMock,
}));

import {
  createVenueTbdRetryScheduler,
  resolveVenueTbdAction,
  VENUE_TBD_DECISION_HOURS,
  VENUE_TBD_ESCALATION_THRESHOLD,
} from '../lib/venueTbdRetryScheduler';

const NOW = new Date('2026-09-12T12:00:00Z').getTime();

function makeResult(hoursUntilEvent: number, stillUnassigned = 1) {
  return {
    retriedPools: 1,
    totalAssigned: 0,
    totalStillUnassigned: stillUnassigned,
    pools: [
      {
        poolId: 'pool-1',
        poolTitle: 'Test Pool',
        poolDateTimeIso: new Date(NOW + hoursUntilEvent * 60 * 60 * 1000).toISOString(),
        totalGroups: 3,
        unassignedBefore: stillUnassigned,
        assignedThisPass: 0,
        stillUnassigned,
        reasonBreakdown: { no_suitable_venue: stillUnassigned },
      },
    ],
  };
}

function makeScheduler(retry: () => Promise<any>) {
  return createVenueTbdRetryScheduler({
    logger: { info: loggerInfoMock, warn: loggerWarnMock, error: loggerErrorMock },
    retryVenueTbdAssignments: retry,
    notifyEscalation: notifyMock as any,
    cancelPool: cancelMock as any,
    now: () => NOW,
  });
}

describe('W8 AC-W8.5 — venue TBD retry scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyMock.mockResolvedValue(undefined);
    cancelMock.mockResolvedValue({
      poolId: 'pool-1',
      cancelled: true,
      refunded: true,
      reason: 'venue_unresolved_deadline',
    });
  });

  it('resolveVenueTbdAction: cancels inside T-24h, warns after repeated retries outside it', () => {
    expect(VENUE_TBD_DECISION_HOURS).toBe(24);
    expect(resolveVenueTbdAction({ consecutiveUnresolved: 1, hoursUntilEvent: 48 })).toBeNull();
    expect(resolveVenueTbdAction({ consecutiveUnresolved: VENUE_TBD_ESCALATION_THRESHOLD, hoursUntilEvent: 48 })).toBe('warning');
    expect(resolveVenueTbdAction({ consecutiveUnresolved: 1, hoursUntilEvent: 24 })).toBe('cancel');
    expect(resolveVenueTbdAction({ consecutiveUnresolved: 1, hoursUntilEvent: 1 })).toBe('cancel');
    expect(resolveVenueTbdAction({ consecutiveUnresolved: 1, hoursUntilEvent: null })).toBeNull();
  });

  it('does not alert on the first unresolved retry, then warns on the second', async () => {
    const retry = vi.fn().mockResolvedValue(makeResult(48));
    const scheduler = makeScheduler(retry);

    await scheduler.run();
    expect(notifyMock).not.toHaveBeenCalled();
    expect(cancelMock).not.toHaveBeenCalled();
    expect(scheduler.getConsecutiveUnresolved()).toBe(1);

    await scheduler.run();
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        poolId: 'pool-1',
        unassignedGroups: 1,
        severity: 'warning',
        hoursUntilEvent: 48,
      }),
    );
  });

  it('cancels instead of escalating once the T-24h venue deadline is reached', async () => {
    const retry = vi.fn().mockResolvedValue(makeResult(24));
    const scheduler = makeScheduler(retry);

    await scheduler.run();

    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(cancelMock).toHaveBeenCalledWith('pool-1');
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('stays fail-open when the deadline cancellation throws', async () => {
    const retry = vi.fn().mockResolvedValue(makeResult(3));
    cancelMock.mockRejectedValueOnce(new Error('refund provider down'));
    const scheduler = makeScheduler(retry);

    await scheduler.run();

    expect(scheduler.isStopped()).toBe(false);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      '[VenueTbdRetry] deadline cancellation failed; will retry',
      expect.objectContaining({ poolId: 'pool-1', error: 'refund provider down' }),
    );
  });

  it('resets the unresolved counter when all TBD venues resolve', async () => {
    const retry = vi
      .fn()
      .mockResolvedValueOnce(makeResult(48))
      .mockResolvedValueOnce({ ...makeResult(48), totalStillUnassigned: 0, pools: [] });
    const scheduler = makeScheduler(retry);

    await scheduler.run();
    expect(scheduler.getConsecutiveUnresolved()).toBe(1);

    await scheduler.run();
    expect(scheduler.getConsecutiveUnresolved()).toBe(0);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('stays fail-open on a transient retry error', async () => {
    const retry = vi.fn().mockRejectedValueOnce(new Error('db down'));
    const scheduler = makeScheduler(retry);

    await scheduler.run();

    expect(scheduler.isStopped()).toBe(false);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      '[VenueTbdRetry] retry pass failed; will retry next tick',
      expect.objectContaining({ failOpen: true, error: 'db down' }),
    );
  });
});

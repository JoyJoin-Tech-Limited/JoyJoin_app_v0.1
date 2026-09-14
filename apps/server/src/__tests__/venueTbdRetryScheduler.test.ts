import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * W8 (AC-W8.5) — venue-TBD retry scheduler.
 *
 * Venue assignment runs once; when it leaves a group unassigned the members are
 * promised a decision by T-2h. The scheduler retries and escalates: a `warning`
 * after repeated unresolved retries, `critical` once T-2h has been breached.
 */

vi.mock('../lib/venueTbdRetry', () => ({
  retryVenueTbdAssignments: vi.fn(),
}));

const { loggerWarnMock, loggerErrorMock, loggerInfoMock, notifyMock } = vi.hoisted(() => ({
  loggerWarnMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  notifyMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/logger', () => ({
  logger: { warn: loggerWarnMock, error: loggerErrorMock, info: loggerInfoMock },
}));

vi.mock('../lib/wecomNotifications/matching', () => ({
  notifyVenueTbdEscalation: notifyMock,
}));

import {
  createVenueTbdRetryScheduler,
  resolveVenueTbdEscalationSeverity,
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
    now: () => NOW,
  });
}

describe('W8 AC-W8.5 — venue TBD retry scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyMock.mockResolvedValue(undefined);
  });

  it('resolveVenueTbdEscalationSeverity: critical at/after T-2h, warning after repeated retries', () => {
    expect(resolveVenueTbdEscalationSeverity({ consecutiveUnresolved: 1, hoursUntilEvent: 24 })).toBeNull();
    expect(resolveVenueTbdEscalationSeverity({ consecutiveUnresolved: VENUE_TBD_ESCALATION_THRESHOLD, hoursUntilEvent: 24 })).toBe('warning');
    expect(resolveVenueTbdEscalationSeverity({ consecutiveUnresolved: 1, hoursUntilEvent: 2 })).toBe('critical');
    expect(resolveVenueTbdEscalationSeverity({ consecutiveUnresolved: 1, hoursUntilEvent: 1 })).toBe('critical');
    expect(resolveVenueTbdEscalationSeverity({ consecutiveUnresolved: 1, hoursUntilEvent: null })).toBeNull();
  });

  it('does not alert on the first unresolved retry, then warns on the second', async () => {
    const retry = vi.fn().mockResolvedValue(makeResult(24));
    const scheduler = makeScheduler(retry);

    await scheduler.run();
    expect(notifyMock).not.toHaveBeenCalled();
    expect(scheduler.getConsecutiveUnresolved()).toBe(1);

    await scheduler.run();
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        poolId: 'pool-1',
        unassignedGroups: 1,
        severity: 'warning',
        hoursUntilEvent: 24,
      }),
    );
  });

  it('escalates immediately at the T-2h deadline', async () => {
    const retry = vi.fn().mockResolvedValue(makeResult(2));
    const scheduler = makeScheduler(retry);

    await scheduler.run();

    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'critical', hoursUntilEvent: 2 }),
    );
  });

  it('resets the unresolved counter when all TBD venues resolve', async () => {
    const retry = vi
      .fn()
      .mockResolvedValueOnce(makeResult(24))
      .mockResolvedValueOnce({ ...makeResult(24), totalStillUnassigned: 0, pools: [] });
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

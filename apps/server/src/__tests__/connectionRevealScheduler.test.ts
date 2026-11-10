import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * G0 (2026-11-10) — connection reveal scheduler.
 *
 * The sweep must be totally inert when `mutualSelectionV2Enabled` is OFF (the
 * default), idempotent under duplicate/overlapping ticks, and never able to
 * take the process down: a throw is logged and retried on the next tick.
 */

const flagState = vi.hoisted(() => ({ enabled: false }));
const finalizeMock = vi.hoisted(() => vi.fn());
const notifyMock = vi.hoisted(() => vi.fn());
const purgeMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: vi.fn(async () => flagState.enabled),
}));

vi.mock('../repositories/connectionSelectionRepo', () => ({
  finalizeConnectionReveals: finalizeMock,
  purgeClosedConnectionSelections: purgeMock,
}));

vi.mock('../lib/connectionRevealNotifications', () => ({
  notifyRevealedConnections: notifyMock,
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  CONNECTION_REVEAL_INTERVAL_MS,
  runConnectionRevealTick,
  startConnectionRevealScheduler,
  stopConnectionRevealScheduler,
} from '../lib/connectionRevealScheduler';

const NOW = new Date('2026-11-11T13:00:00.000Z');

beforeEach(() => {
  flagState.enabled = false;
  finalizeMock.mockReset();
  finalizeMock.mockResolvedValue({ revealed: 0, connections: [] });
  notifyMock.mockReset();
  notifyMock.mockResolvedValue({
    notifiedConnections: 0,
    notifiedUsers: 0,
    skippedDuplicates: 0,
    failed: 0,
  });
  purgeMock.mockReset();
  purgeMock.mockResolvedValue({ deleted: 0, cutoff: NOW });
});

afterEach(() => {
  stopConnectionRevealScheduler();
  vi.useRealTimers();
});

describe('runConnectionRevealTick', () => {
  it('does nothing while the flag is OFF (default)', async () => {
    const result = await runConnectionRevealTick(NOW);

    expect(result).toEqual({
      enabled: false,
      revealed: 0,
      notifiedUsers: 0,
      cleaned: 0,
      skipped: false,
    });
    expect(finalizeMock).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
    expect(purgeMock).not.toHaveBeenCalled();
  });

  it('sweeps once and reports the flipped count when the flag is ON', async () => {
    flagState.enabled = true;
    finalizeMock.mockResolvedValue({
      revealed: 2,
      connections: [
        { id: 'c1', eventId: 'e1', userAId: 'a', userBId: 'b' },
        { id: 'c2', eventId: 'e1', userAId: 'c', userBId: 'd' },
      ],
    });
    notifyMock.mockResolvedValue({
      notifiedConnections: 2,
      notifiedUsers: 4,
      skippedDuplicates: 0,
      failed: 0,
    });

    const result = await runConnectionRevealTick(NOW);

    expect(result).toEqual({
      enabled: true,
      revealed: 2,
      notifiedUsers: 4,
      cleaned: 0,
      skipped: false,
    });
    expect(finalizeMock).toHaveBeenCalledWith({ now: NOW });
    expect(notifyMock).toHaveBeenCalledWith([
      { id: 'c1', eventId: 'e1', userAId: 'a', userBId: 'b' },
      { id: 'c2', eventId: 'e1', userAId: 'c', userBId: 'd' },
    ]);
  });

  it('never notifies when the sweep revealed nothing', async () => {
    flagState.enabled = true;

    await runConnectionRevealTick(NOW);

    expect(notifyMock).not.toHaveBeenCalled();
    // Retention cleanup still runs — it is independent of this tick's reveals.
    expect(purgeMock).toHaveBeenCalledWith({ now: NOW });
  });

  it('keeps the reveal when the notification fan-out throws', async () => {
    flagState.enabled = true;
    finalizeMock.mockResolvedValue({
      revealed: 1,
      connections: [{ id: 'c1', eventId: 'e1', userAId: 'a', userBId: 'b' }],
    });
    notifyMock.mockRejectedValueOnce(new Error('notifications table missing'));

    await expect(runConnectionRevealTick(NOW)).resolves.toEqual({
      enabled: true,
      revealed: 1,
      notifiedUsers: 0,
      cleaned: 0,
      skipped: false,
    });
  });

  it('keeps the tick healthy when retention cleanup throws', async () => {
    flagState.enabled = true;
    purgeMock.mockRejectedValueOnce(new Error('lock timeout'));

    await expect(runConnectionRevealTick(NOW)).resolves.toMatchObject({
      enabled: true,
      skipped: false,
    });
  });

  it('reports the purged row count', async () => {
    flagState.enabled = true;
    purgeMock.mockResolvedValueOnce({ deleted: 7, cutoff: NOW });

    await expect(runConnectionRevealTick(NOW)).resolves.toMatchObject({ cleaned: 7 });
  });

  it('is idempotent under a duplicate tick (second sweep finds nothing)', async () => {
    flagState.enabled = true;
    finalizeMock
      .mockResolvedValueOnce({ revealed: 1, connections: [] })
      .mockResolvedValueOnce({ revealed: 0, connections: [] });

    const first = await runConnectionRevealTick(NOW);
    const second = await runConnectionRevealTick(NOW);

    expect(first.revealed).toBe(1);
    expect(second.revealed).toBe(0);
  });

  it('skips a tick that overlaps an in-flight sweep', async () => {
    flagState.enabled = true;
    let release: (value: { revealed: number; connections: never[] }) => void = () => {};
    finalizeMock.mockImplementationOnce(
      () => new Promise((resolve) => { release = resolve as never; }),
    );

    const inFlight = runConnectionRevealTick(NOW);
    const overlap = await runConnectionRevealTick(NOW);

    expect(overlap).toEqual({
      enabled: true,
      revealed: 0,
      notifiedUsers: 0,
      cleaned: 0,
      skipped: true,
    });
    expect(finalizeMock).toHaveBeenCalledTimes(1);

    release({ revealed: 0, connections: [] });
    await expect(inFlight).resolves.toEqual({
      enabled: true,
      revealed: 0,
      notifiedUsers: 0,
      cleaned: 0,
      skipped: false,
    });
  });

  it('swallows a sweep failure and retries on the next tick', async () => {
    flagState.enabled = true;
    finalizeMock.mockRejectedValueOnce(new Error('db down'));

    await expect(runConnectionRevealTick(NOW)).resolves.toEqual({
      enabled: true,
      revealed: 0,
      notifiedUsers: 0,
      cleaned: 0,
      skipped: false,
    });

    finalizeMock.mockResolvedValueOnce({ revealed: 1, connections: [] });
    await expect(runConnectionRevealTick(NOW)).resolves.toMatchObject({ revealed: 1 });
  });
});

describe('startConnectionRevealScheduler', () => {
  it('registers exactly one 1-minute interval and is idempotent', () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    startConnectionRevealScheduler();
    startConnectionRevealScheduler();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), CONNECTION_REVEAL_INTERVAL_MS);
    expect(CONNECTION_REVEAL_INTERVAL_MS).toBe(60_000);
  });

  it('stops cleanly', () => {
    vi.useFakeTimers();
    startConnectionRevealScheduler();
    stopConnectionRevealScheduler();
    // A second stop must not throw.
    expect(() => stopConnectionRevealScheduler()).not.toThrow();
  });
});

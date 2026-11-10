import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The 24h venue promise ends in money: when a matched pool still has no venue
 * inside T-24h the pool must be cancelled AND every paid registration refunded.
 * These tests lock the abort rule (a failed refund must never cancel) and the
 * early exits, because a regression here strands paid users on a dead event.
 */

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  selectResults: [] as Row[][],
  updateRows: [] as Row[],
  refundCalls: [] as string[],
  invalidateCalls: [] as unknown[],
  refundThrows: false,
}));

vi.mock('../db', () => {
  const select = vi.fn(() => {
    const rows = state.selectResults.shift() ?? [];
    const builder: Record<string, unknown> = {
      from: () => builder,
      where: () => builder,
      limit: () => builder,
      then: (resolve: (value: Row[]) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    };
    return builder;
  });

  const update = vi.fn(() => {
    const builder: Record<string, unknown> = {
      set: () => builder,
      where: () => builder,
      returning: () => Promise.resolve(state.updateRows),
    };
    return builder;
  });

  return { db: { select, update } };
});

vi.mock('../services/autoRefundService', () => ({
  refundPoolCancellation: vi.fn(async (poolId: string) => {
    state.refundCalls.push(poolId);
    if (state.refundThrows) throw new Error('refund provider down');
    return { refundedPayments: 2, refundedCredits: 0 };
  }),
}));

vi.mock('../lib/connectionSelectionLifecycle', () => ({
  invalidateConnectionSelections: vi.fn(async (input: unknown) => {
    state.invalidateCalls.push(input);
  }),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { cancelPoolForUnresolvedVenue } from '../lib/venueTbdRetry';

describe('cancelPoolForUnresolvedVenue — 24h venue deadline', () => {
  beforeEach(() => {
    state.selectResults = [];
    state.updateRows = [{ id: 'pool-1' }];
    state.refundCalls = [];
    state.invalidateCalls = [];
    state.refundThrows = false;
  });

  it('refunds, closes the 互选 window, and cancels the pool', async () => {
    state.selectResults = [[{ id: 'pool-1', title: '周五饭局', status: 'matched' }], [{ id: 'group-1' }]];

    const result = await cancelPoolForUnresolvedVenue('pool-1');

    expect(result).toEqual({
      poolId: 'pool-1',
      cancelled: true,
      refunded: true,
      reason: 'venue_unresolved_deadline',
    });
    expect(state.refundCalls).toEqual(['pool-1']);
    expect(state.invalidateCalls).toEqual([{ poolId: 'pool-1', reason: 'pool_cancelled' }]);
  });

  it('keeps the pool open when the refund fails so a later tick can retry', async () => {
    state.refundThrows = true;
    state.selectResults = [[{ id: 'pool-1', title: '周五饭局', status: 'matched' }], [{ id: 'group-1' }]];

    const result = await cancelPoolForUnresolvedVenue('pool-1');

    expect(result).toEqual({
      poolId: 'pool-1',
      cancelled: false,
      refunded: false,
      reason: 'refund_failed',
    });
    expect(state.refundCalls).toEqual(['pool-1']);
  });

  it('does nothing when the venue already resolved', async () => {
    state.selectResults = [[{ id: 'pool-1', title: '周五饭局', status: 'matched' }], []];

    const result = await cancelPoolForUnresolvedVenue('pool-1');

    expect(result).toEqual({
      poolId: 'pool-1',
      cancelled: false,
      refunded: false,
      reason: 'venue_resolved',
    });
    expect(state.refundCalls).toEqual([]);
  });

  it('does nothing once the pool is no longer matched', async () => {
    state.selectResults = [[{ id: 'pool-1', title: '周五饭局', status: 'cancelled' }]];

    const result = await cancelPoolForUnresolvedVenue('pool-1');

    expect(result.cancelled).toBe(false);
    expect(result.reason).toBe('pool_status_cancelled');
    expect(state.refundCalls).toEqual([]);
  });
});

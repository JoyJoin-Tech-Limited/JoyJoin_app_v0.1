import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * G0 P0 hardening (2026-11-10) — the authoritative 0–5 selection cap.
 *
 * The route-level union check is a fast pre-check; it cannot hold under
 * concurrency (two devices, a PUT racing a POST /feedback, a retry storm). These
 * tests lock the repository-side authority:
 *
 *   - every write opens a transaction and takes `pg_advisory_xact_lock` keyed by
 *     (user, event) BEFORE reading the caller's persisted selections;
 *   - the cap is evaluated inside that lock, so a concurrent write can never
 *     push the union past 5;
 *   - a full-replace payload above 5 fails closed instead of writing.
 */

const dbState = vi.hoisted(() => ({
  /** Peers the caller already holds for the event. */
  persistedPeerIds: [] as string[],
  calls: [] as string[],
  lockSql: '',
  insertedValues: [] as any[],
  deletedRows: 0,
}));

const dialect = new PgDialect();

vi.mock('../db', () => {
  const transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(createTx());
  return { db: { transaction } };
});

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function createTx() {
  return {
    execute: async (statement: any) => {
      dbState.calls.push('lock');
      dbState.lockSql = dialect.sqlToQuery(statement).sql;
      return { rows: [] };
    },
    insert: () => ({
      values: (values: any) => ({
        onConflictDoNothing: async () => {
          dbState.calls.push('insert');
          dbState.insertedValues.push(values);
        },
      }),
    }),
    select: (fields?: unknown) => ({
      from: () => ({
        where: async () => {
          if (fields && typeof fields === 'object') {
            // The caller's persisted selection read (runs inside the lock).
            dbState.calls.push('select-own');
            return dbState.persistedPeerIds.map((peerId) => ({
              userAId: peerId,
              userBId: 'user-1',
            }));
          }
          if (dbState.insertedValues.length === 0) {
            // `replaceConnectionSelection`'s opening read of the caller's
            // existing rows (nothing inserted yet in this transaction).
            dbState.calls.push('select-existing');
            return [];
          }
          // Per-pair authoritative re-fetch after the insert. Returning the row
          // with the caller as initiator makes `applyConnectionSelection` a
          // no-op transition, which keeps this test focused on the cap.
          dbState.calls.push('select-row');
          const lastInserted = dbState.insertedValues[dbState.insertedValues.length - 1];
          return [{ id: `conn-${dbState.insertedValues.length}`, status: 'pending', ...lastInserted }];
        },
      }),
    }),
    update: () => ({
      set: () => ({ where: () => ({ returning: async () => [] }) }),
    }),
    delete: () => ({
      where: () => ({
        returning: async () => {
          dbState.deletedRows += 1;
          return [];
        },
      }),
    }),
  };
}

import {
  applyConnectionSelectionsForEvent,
  ConnectionSelectionCapExceededError,
  replaceConnectionSelection,
} from '../repositories/connectionSelectionRepo';

const REVEAL_AT = new Date('2026-11-11T13:00:00.000Z');

beforeEach(() => {
  dbState.persistedPeerIds = [];
  dbState.calls = [];
  dbState.lockSql = '';
  dbState.insertedValues = [];
  dbState.deletedRows = 0;
});

describe('applyConnectionSelectionsForEvent — authoritative cap', () => {
  it('takes the (user, event) advisory lock BEFORE reading persisted selections', async () => {
    dbState.persistedPeerIds = ['peer-1'];

    await applyConnectionSelectionsForEvent({
      eventId: 'event-1',
      callerId: 'user-1',
      peerIds: ['peer-2'],
      mutualSelectionV2Enabled: true,
      revealAt: REVEAL_AT,
    });

    expect(dbState.calls[0]).toBe('lock');
    expect(dbState.calls.indexOf('lock')).toBeLessThan(dbState.calls.indexOf('select-own'));
    // The key is the cap's scope: one caller per event, never cross-user.
    expect(dbState.lockSql).toContain('pg_advisory_xact_lock');
    expect(dbState.lockSql).toContain('hashtextextended');
  });

  it('rejects peers that would push the union past 5 (concurrent-write case)', async () => {
    // The caller already holds 3 peers; a racing write submits 4 more.
    dbState.persistedPeerIds = ['peer-1', 'peer-2', 'peer-3'];

    const result = await applyConnectionSelectionsForEvent({
      eventId: 'event-1',
      callerId: 'user-1',
      peerIds: ['peer-4', 'peer-5', 'peer-6', 'peer-7'],
      mutualSelectionV2Enabled: true,
      revealAt: REVEAL_AT,
    });

    expect(result.acceptedPeerIds).toEqual(['peer-4', 'peer-5']);
    expect(result.rejectedPeerIds).toEqual(['peer-6', 'peer-7']);
    // Only the accepted peers are written.
    expect(dbState.insertedValues.map((values) => [values.userAId, values.userBId].sort())).toEqual([
      ['peer-4', 'user-1'],
      ['peer-5', 'user-1'],
    ]);
  });

  it('accepts a payload that repeats already-held peers (union, not sum)', async () => {
    dbState.persistedPeerIds = ['peer-1', 'peer-2', 'peer-3', 'peer-4', 'peer-5'];

    const result = await applyConnectionSelectionsForEvent({
      eventId: 'event-1',
      callerId: 'user-1',
      peerIds: ['peer-1', 'peer-2', 'peer-3', 'peer-4', 'peer-5'],
      mutualSelectionV2Enabled: true,
      revealAt: REVEAL_AT,
    });

    expect(result.rejectedPeerIds).toEqual([]);
    expect(result.acceptedPeerIds).toHaveLength(5);
  });

  it('never writes the 6th distinct peer even when the caller holds nothing', async () => {
    const result = await applyConnectionSelectionsForEvent({
      eventId: 'event-1',
      callerId: 'user-1',
      peerIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'],
      mutualSelectionV2Enabled: true,
      revealAt: REVEAL_AT,
    });

    expect(result.acceptedPeerIds).toHaveLength(5);
    expect(result.rejectedPeerIds).toEqual(['p6']);
    expect(dbState.insertedValues).toHaveLength(5);
  });
});

describe('replaceConnectionSelection — fail-closed cap', () => {
  it('throws ConnectionSelectionCapExceededError for a >5 payload and writes nothing', async () => {
    await expect(
      replaceConnectionSelection({
        eventId: 'event-1',
        callerId: 'user-1',
        peerIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'],
        revealAt: REVEAL_AT,
      }),
    ).rejects.toBeInstanceOf(ConnectionSelectionCapExceededError);

    expect(dbState.insertedValues).toEqual([]);
    expect(dbState.calls).toEqual(['lock']);
  });

  it('accepts exactly 5 peers', async () => {
    await expect(
      replaceConnectionSelection({
        eventId: 'event-1',
        callerId: 'user-1',
        peerIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
        revealAt: REVEAL_AT,
      }),
    ).resolves.toMatchObject({ selectedCount: 5 });

    expect(dbState.calls[0]).toBe('lock');
    expect(dbState.insertedValues).toHaveLength(5);
  });

  it('carries the client-facing error code on the typed error', () => {
    const error = new ConnectionSelectionCapExceededError();
    expect(error.code).toBe('TOO_MANY_SELECTIONS');
    expect(error.maxSelections).toBe(5);
  });
});

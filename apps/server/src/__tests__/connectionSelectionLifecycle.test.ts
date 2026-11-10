import { PgDialect } from 'drizzle-orm/pg-core';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * G0 P0 hardening (2026-11-10) — connection-selection lifecycle invalidation.
 *
 * Locks the three properties the reveal flow depends on when an event stops
 * being a real event:
 *
 *   1. a cancelled pool/event CLOSES the selection window immediately, so a
 *      PUT /connection-selection or a peer-carrying POST /feedback returns 409;
 *   2. every non-mutual (`pending` / `mutual_pending`) row is voided;
 *   3. an already-`mutual` row is NEVER touched — a delivered connection is
 *      permanent.
 *
 * The fake executor renders the real drizzle predicates with `PgDialect`, so the
 * `status IN (...)` list, the (user, event) scope and the monotone window write
 * are asserted as SQL rather than as a copy of the source text.
 */

const loggerMock = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock('../lib/logger', () => ({ logger: loggerMock }));
vi.mock('../db', () => ({ db: { select: vi.fn(), insert: vi.fn(), delete: vi.fn() } }));

import { connectionSelectionWindows, connections } from '@shared/schema';
import {
  invalidateConnectionSelections,
  voidConnectionSelectionsForUsers,
} from '../lib/connectionSelectionLifecycle';

const dialect = new PgDialect();

/** Statuses the lifecycle module may ever delete. `mutual` is deliberately absent. */
const VOIDABLE_STATUSES = ['pending', 'mutual_pending'];

interface SeedRow {
  id: string;
  eventId: string;
  status: string;
  userAId: string;
  userBId: string;
}

interface FakeState {
  rows: SeedRow[];
  /** Every `connection_selection_windows` insert payload. */
  windowWrites: Array<Record<string, unknown>>;
  /** Rendered `ON CONFLICT DO UPDATE SET` clause of the last window write. */
  windowConflictSet: string;
  /** Rendered delete predicate of the last void. */
  deletePredicate: string;
  /** Bound params of the last delete predicate. */
  deleteParams: unknown[];
  deleteCalls: number;
}

function createExecutor(seed: {
  rows?: SeedRow[];
  poolEventIds?: Array<string | null>;
}) {
  const state: FakeState = {
    rows: (seed.rows ?? []).map((row) => ({ ...row })),
    windowWrites: [],
    windowConflictSet: '',
    deletePredicate: '',
    deleteParams: [],
    deleteCalls: 0,
  };

  const executor = {
    select: () => ({
      from: (table: unknown) => ({
        where: async () => {
          if (table === connections) return state.rows.map((row) => ({ ...row }));
          // `event_pool_groups` — the pool → events fan-out.
          return (seed.poolEventIds ?? []).map((eventId) => ({ eventId }));
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoUpdate: async (config: { set: unknown }) => {
          if (table !== connectionSelectionWindows) return;
          state.windowWrites.push(values);
          // `set` is a plain object of SQL fragments; render each one.
          state.windowConflictSet = Object.entries(config.set as Record<string, unknown>)
            .map(([, value]) => dialect.sqlToQuery(value as never).sql)
            .join(' | ');
        },
      }),
    }),
    delete: (table: unknown) => ({
      where: (predicate: unknown) => ({
        returning: async () => {
          if (table !== connections) return [];
          state.deleteCalls += 1;
          const query = dialect.sqlToQuery(predicate as never);
          state.deletePredicate = query.sql;
          state.deleteParams = query.params;

          const stringParams = query.params.filter(
            (value): value is string => typeof value === 'string',
          );
          // The predicate is built from three disjoint value sets: event ids,
          // the two voidable statuses, and (optionally) user ids. Classifying by
          // membership keeps the fake honest without parsing placeholder order.
          const eventParamSet = new Set(
            (seed.poolEventIds ?? []).filter((id): id is string => typeof id === 'string'),
          );
          const statusParams = stringParams.filter((value) =>
            VOIDABLE_STATUSES.includes(value),
          );
          const userParams = stringParams.filter(
            (value) => !eventParamSet.has(value) && !VOIDABLE_STATUSES.includes(value),
          );
          const userFilter = new Set(userParams);

          const removed = state.rows.filter((row) => {
            const eventMatched = eventParamSet.has(row.eventId);
            const statusMatched = statusParams.includes(row.status);
            if (!eventMatched || !statusMatched) return false;
            if (userFilter.size === 0) return true;
            return userFilter.has(row.userAId) || userFilter.has(row.userBId);
          });

          state.rows = state.rows.filter((row) => !removed.includes(row));
          return removed.map((row) => ({ id: row.id, status: row.status }));
        },
      }),
    }),
  };

  return { executor, state };
}

const NOW = new Date('2026-11-10T18:00:00.000Z');

const PENDING = {
  id: 'c-pending',
  eventId: 'event-1',
  status: 'pending',
  userAId: 'user-a',
  userBId: 'user-b',
};
const MUTUAL_PENDING = {
  id: 'c-mutual-pending',
  eventId: 'event-1',
  status: 'mutual_pending',
  userAId: 'user-a',
  userBId: 'user-c',
};
const MUTUAL = {
  id: 'c-mutual',
  eventId: 'event-1',
  status: 'mutual',
  userAId: 'user-a',
  userBId: 'user-d',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('invalidateConnectionSelections — event cancellation', () => {
  it('closes the window and voids every non-mutual row, keeping mutual rows', async () => {
    const { executor, state } = createExecutor({
      rows: [PENDING, MUTUAL_PENDING, MUTUAL],
      poolEventIds: ['event-1'],
    });

    const result = await invalidateConnectionSelections({
      poolId: 'pool-1',
      reason: 'pool_cancelled',
      now: NOW,
      executor,
    });

    expect(result).toMatchObject({ eventIds: ['event-1'], windowsClosed: 1, voided: 2 });

    // Window closed at `now` — `getConnectionSelectionWindow` then reports
    // `state: 'closed'`, which is what makes the write routes 409.
    expect(state.windowWrites).toEqual([
      { eventId: 'event-1', opensAt: NOW, closesAt: NOW, revealAt: NOW },
    ]);

    // The two non-mutual rows are gone; the delivered pair survives untouched.
    expect(state.rows.map((row) => row.id)).toEqual(['c-mutual']);
    expect(state.deleteParams).toContain('pending');
    expect(state.deleteParams).toContain('mutual_pending');
    expect(state.deleteParams).not.toContain('mutual');
  });

  it('voids across every table of a multi-group pool', async () => {
    const { executor, state } = createExecutor({
      rows: [PENDING, MUTUAL],
      poolEventIds: ['event-1', 'event-2'],
    });

    const result = await invalidateConnectionSelections({
      poolId: 'pool-1',
      reason: 'pool_cancelled',
      now: NOW,
      executor,
    });

    expect(result.eventIds.sort()).toEqual(['event-1', 'event-2']);
    expect(state.windowWrites).toHaveLength(2);
    expect(state.rows.map((row) => row.id)).toEqual(['c-mutual']);
  });

  it('is idempotent — a re-run rewrites the window but deletes nothing', async () => {
    const { executor, state } = createExecutor({
      rows: [PENDING, MUTUAL_PENDING],
      poolEventIds: ['event-1'],
    });

    const first = await invalidateConnectionSelections({
      poolId: 'pool-1',
      reason: 'pool_cancelled',
      now: NOW,
      executor,
    });
    const second = await invalidateConnectionSelections({
      poolId: 'pool-1',
      reason: 'pool_cancelled',
      now: NOW,
      executor,
    });

    expect(first.voided).toBe(2);
    expect(second.voided).toBe(0);
    expect(state.rows).toEqual([]);
  });

  it('reports `unresolved` when a cancelled pool never committed a group', async () => {
    const { executor, state } = createExecutor({ rows: [PENDING], poolEventIds: [] });

    const result = await invalidateConnectionSelections({
      poolId: 'pool-without-groups',
      reason: 'pool_cancelled',
      now: NOW,
      executor,
    });

    expect(result.unresolved).toBe(true);
    expect(result.windowsClosed).toBe(0);
    expect(result.voided).toBe(0);
    expect(state.windowWrites).toEqual([]);
    // Nothing resolved means nothing to delete.
    expect(state.rows).toHaveLength(1);
    expect(state.deleteCalls).toBe(0);
  });
});

describe('invalidateConnectionSelections — per-seat reasons keep the window open', () => {
  it('voids only the cancelled seat and never closes the window', async () => {
    const { executor, state } = createExecutor({
      rows: [PENDING, MUTUAL_PENDING, MUTUAL],
      poolEventIds: ['event-1'],
    });

    const result = await voidConnectionSelectionsForUsers({
      canonicalEventId: 'event-1',
      userIds: ['user-b'],
      reason: 'seat_cancelled',
      now: NOW,
      executor,
    });

    // Only the row involving user-b is voided; user-a/user-c's waiting pair and
    // the delivered pair both survive.
    expect(result?.voided).toBe(1);
    expect(state.rows.map((row) => row.id).sort()).toEqual(['c-mutual', 'c-mutual-pending']);
    expect(state.windowWrites).toEqual([]);
  });

  it('never touches a mutual row even when that seat is cancelled', async () => {
    const { executor, state } = createExecutor({
      rows: [MUTUAL],
      poolEventIds: ['event-1'],
    });

    await voidConnectionSelectionsForUsers({
      canonicalEventId: 'event-1',
      userIds: ['user-d'],
      reason: 'seat_cancelled',
      now: NOW,
      executor,
    });

    expect(state.rows.map((row) => row.id)).toEqual(['c-mutual']);
    expect(state.deleteParams).not.toContain('mutual');
  });

  it('is a no-op with an empty user list', async () => {
    const { executor, state } = createExecutor({ rows: [PENDING] });

    await expect(
      voidConnectionSelectionsForUsers({
        canonicalEventId: 'event-1',
        userIds: [],
        reason: 'no_show',
        executor,
      }),
    ).resolves.toBeNull();
    expect(state.deleteCalls).toBe(0);
  });

  it('returns null when the caller passed no event scope at all', async () => {
    const { executor, state } = createExecutor({ rows: [PENDING] });

    await expect(
      voidConnectionSelectionsForUsers({
        userIds: ['user-b'],
        reason: 'no_show',
        executor,
      }),
    ).resolves.toBeNull();
    expect(state.deleteCalls).toBe(0);
  });
});

describe('invalidateConnectionSelections — cancellation / refund / no-show wiring', () => {
  const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(TEST_DIR, '../../../..');

  function source(relativePath: string): string {
    return readFileSync(path.join(repoRoot, relativePath), 'utf8');
  }

  /**
   * Structural contract for the hooks the P0 hardening added. A refactor that
   * deletes a call site without replacing it regresses this test instead of
   * silently leaving a live selection window behind a cancelled event.
   */
  it.each([
    ['admin pool cancellation', 'apps/server/src/routes/domains/adminEventPools.ts', 'reason: "pool_cancelled"'],
    ['refund pipeline (Trigger A)', 'apps/server/src/services/autoRefundService.ts', 'reason: "pool_cancelled"'],
    ['refund pipeline (per seat)', 'apps/server/src/services/autoRefundService.ts', 'voidConnectionSelectionsForUsers'],
    ['post-reveal seat cancel', 'apps/server/src/lib/poolRegistrationCancel.ts', 'reason: "seat_cancelled"'],
    ['post-reveal collapse', 'apps/server/src/lib/poolRegistrationCancel.ts', 'reason: "group_collapsed"'],
    ['self-reported no-show', 'apps/server/src/routes/domains/blindBoxEvents.ts', 'voidNoShowConnectionSelections'],
    ['admin no-show override', 'apps/server/src/routes/domains/attendance.ts', 'voidNoShowConnectionSelections'],
  ])('wires the %s hook', (_label, relativePath, needle) => {
    expect(source(relativePath)).toContain(needle);
  });
});

describe('invalidateConnectionSelections — statement guards', () => {
  it('scopes the delete to non-mutual statuses on the resolved events', async () => {
    const { executor, state } = createExecutor({ rows: [], poolEventIds: ['event-1'] });

    await invalidateConnectionSelections({
      poolId: 'pool-1',
      reason: 'pool_cancelled',
      now: NOW,
      executor,
    });

    expect(state.deletePredicate).toContain('"connections"."event_id" in (');
    expect(state.deletePredicate).toContain('"connections"."status" in (');
    // Exactly two statuses, both non-mutual.
    expect(state.deleteParams.filter((value) => typeof value === 'string')).toEqual([
      'event-1',
      ...VOIDABLE_STATUSES,
    ]);
  });

  it('makes the window write monotone — LEAST(existing, now) for every instant', async () => {
    const { executor, state } = createExecutor({ rows: [], poolEventIds: ['event-1'] });

    await invalidateConnectionSelections({
      poolId: 'pool-1',
      reason: 'pool_cancelled',
      now: NOW,
      executor,
    });

    // A later call can only move the instants EARLIER, so an invalidation that
    // races a normal reveal can never reopen or extend the window.
    expect(state.windowConflictSet).toContain('LEAST(');
    expect(state.windowConflictSet).toContain('"opens_at"');
    expect(state.windowConflictSet).toContain('"closes_at"');
    expect(state.windowConflictSet).toContain('"reveal_at"');
  });

  it('logs counts only — never a user id, a pair id or a seat', async () => {
    const { executor } = createExecutor({ rows: [PENDING, MUTUAL], poolEventIds: ['event-1'] });

    await invalidateConnectionSelections({
      poolId: 'pool-1',
      reason: 'pool_cancelled',
      now: NOW,
      executor,
    });

    const payloads = [
      ...loggerMock.info.mock.calls.map((call) => call[1]),
      ...loggerMock.warn.mock.calls.map((call) => call[1]),
    ].filter(Boolean);
    const serialized = JSON.stringify(payloads);
    expect(serialized).not.toContain('user-a');
    expect(serialized).not.toContain('user-b');
    expect(serialized).not.toContain('c-pending');
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connections, events, users, connectionSelectionWindows } from '@shared/schema';

/**
 * G0 (2026-11-10) — connection selection repository.
 *
 * `applyConnectionSelection` takes an injectable executor, so the transition
 * payloads (the exact thing that decides whether an identity leaks early) are
 * asserted without a database. The fake executor returns canned rows and
 * ignores the drizzle WHERE predicates — it is a recorder, not a SQL engine;
 * the guards those predicates carry are additionally locked by the source
 * assertions at the bottom of this file.
 */

const dbState = vi.hoisted(() => ({
  connectionRows: [] as any[],
  windowRows: [] as any[],
  eventRows: [] as any[],
}));

function awaitable<T>(value: T) {
  const promise = Promise.resolve(value) as Promise<T> & { limit: (n: number) => Promise<T> };
  promise.limit = () => Promise.resolve(value);
  return promise;
}

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === connectionSelectionWindows) return awaitable(dbState.windowRows);
          if (table === events) return awaitable(dbState.eventRows);
          return awaitable(dbState.connectionRows);
        },
      }),
    }),
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  applyConnectionSelection,
  CONNECTION_SELECTION_CLEANUP_BATCH_LIMIT,
  CONNECTION_SELECTION_RETENTION_DAYS,
  decideSelectionWithdrawal,
  expireIneligibleRevealSelections,
  finalizeConnectionReveals,
  getConnectionSelectionWindow,
  getOwnPendingReveal,
  projectConnectionPrivacy,
  purgeClosedConnectionSelections,
} from '../repositories/connectionSelectionRepo';

// ── Fake executor ──────────────────────────────────────────────────────────

interface FakeExecutorState {
  rows: any[];
  inserted: any[];
  updated: any[];
  deleted: number;
  userSelects: number;
  connectionSelects: number;
}

function createFakeExecutor(seed: any[] = [], wechat: Record<string, string> = {}): {
  executor: any;
  state: FakeExecutorState;
} {
  const state: FakeExecutorState = {
    rows: seed.map((row) => ({ ...row })),
    inserted: [],
    updated: [],
    deleted: 0,
    userSelects: 0,
    connectionSelects: 0,
  };

  const executor = {
    insert: () => ({
      values: (values: any) => ({
        onConflictDoNothing: async () => {
          state.inserted.push(values);
          const duplicate = state.rows.some(
            (row) =>
              row.eventId === values.eventId &&
              row.userAId === values.userAId &&
              row.userBId === values.userBId,
          );
          if (!duplicate) {
            state.rows.push({ id: `conn-${state.rows.length + 1}`, ...values });
          }
        },
      }),
    }),
    select: (fields?: any) => ({
      from: (table: unknown) => ({
        where: async () => {
          if (table === users) {
            state.userSelects += 1;
            return [{ wechatContactId: wechat[fields ? 'any' : 'any'] ?? 'wx-snapshot' }];
          }
          state.connectionSelects += 1;
          return state.rows.map((row) => ({ ...row }));
        },
      }),
    }),
    update: () => ({
      set: (values: any) => ({
        where: () => ({
          returning: async () => {
            state.updated.push(values);
            const updated = state.rows.map((row) => Object.assign(row, values));
            return updated.map((row) => ({ ...row }));
          },
        }),
      }),
    }),
    delete: () => ({
      where: () => ({
        returning: async () => {
          const removed = state.rows.splice(0, state.rows.length);
          state.deleted += removed.length;
          return removed;
        },
      }),
    }),
  };

  return { executor, state };
}

const REVEAL_AT = new Date('2026-11-11T13:00:00.000Z');

function pendingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn-existing',
    eventId: 'event-1',
    userAId: 'peer-1',
    userBId: 'user-1',
    status: 'pending',
    initiatorId: 'peer-1',
    userAWechatId: null,
    userBWechatId: null,
    revealedAt: null,
    revealAt: null,
    createdAt: new Date('2026-11-10T15:00:00.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  dbState.connectionRows = [];
  dbState.windowRows = [];
  dbState.eventRows = [];
});

// ── applyConnectionSelection ───────────────────────────────────────────────

describe('applyConnectionSelection — flag OFF is the legacy immediate mutual', () => {
  it('flips pending -> mutual, snapshots both WeChat ids and stamps revealedAt', async () => {
    const { executor, state } = createFakeExecutor([pendingRow()]);

    const result = await applyConnectionSelection(executor, {
      eventId: 'event-1',
      callerId: 'user-1',
      peerId: 'peer-1',
      mutualSelectionV2Enabled: false,
      revealAt: REVEAL_AT,
    });

    expect(result.transition).toBe('mutual');
    expect(result.row.status).toBe('mutual');
    expect(state.updated).toHaveLength(1);
    expect(state.updated[0]).toMatchObject({
      status: 'mutual',
      userAWechatId: 'wx-snapshot',
      userBWechatId: 'wx-snapshot',
    });
    expect(state.updated[0].revealedAt).toBeInstanceOf(Date);
    // Legacy never consults revealAt on the update.
    expect(state.updated[0]).not.toHaveProperty('revealAt');
    expect(state.userSelects).toBe(2);
  });

  it('does not stamp revealAt on the first-side insert', async () => {
    const { executor, state } = createFakeExecutor();

    await applyConnectionSelection(executor, {
      eventId: 'event-1',
      callerId: 'user-1',
      peerId: 'peer-1',
      mutualSelectionV2Enabled: false,
      revealAt: REVEAL_AT,
    });

    expect(state.inserted[0]).toMatchObject({
      eventId: 'event-1',
      userAId: 'peer-1',
      userBId: 'user-1',
      status: 'pending',
      initiatorId: 'user-1',
    });
    expect(state.inserted[0]).not.toHaveProperty('revealAt');
  });
});

describe('applyConnectionSelection — flag ON waits for the reveal', () => {
  it('flips pending -> mutual_pending with revealAt and never snapshots WeChat', async () => {
    const { executor, state } = createFakeExecutor([pendingRow()]);

    const result = await applyConnectionSelection(executor, {
      eventId: 'event-1',
      callerId: 'user-1',
      peerId: 'peer-1',
      mutualSelectionV2Enabled: true,
      revealAt: REVEAL_AT,
    });

    expect(result.transition).toBe('mutual_pending');
    expect(state.updated).toHaveLength(1);
    expect(state.updated[0]).toEqual({ status: 'mutual_pending', revealAt: REVEAL_AT });
    // No identity snapshot, no revealedAt — the invariants AC-4 is about.
    expect(state.updated[0]).not.toHaveProperty('userAWechatId');
    expect(state.updated[0]).not.toHaveProperty('userBWechatId');
    expect(state.updated[0]).not.toHaveProperty('revealedAt');
    // `users` was never queried: a leak cannot happen without the snapshot.
    expect(state.userSelects).toBe(0);
  });

  it('stamps revealAt on the first-side insert so own-pending countdown exists', async () => {
    const { executor, state } = createFakeExecutor();

    await applyConnectionSelection(executor, {
      eventId: 'event-1',
      callerId: 'user-1',
      peerId: 'peer-1',
      mutualSelectionV2Enabled: true,
      revealAt: REVEAL_AT,
    });

    expect(state.inserted[0]).toMatchObject({ status: 'pending', revealAt: REVEAL_AT });
  });

  it('fails closed (stays pending) when the reveal instant is missing', async () => {
    const { executor, state } = createFakeExecutor([pendingRow()]);

    const result = await applyConnectionSelection(executor, {
      eventId: 'event-1',
      callerId: 'user-1',
      peerId: 'peer-1',
      mutualSelectionV2Enabled: true,
      revealAt: null,
    });

    expect(result.transition).toBeNull();
    expect(result.row.status).toBe('pending');
    expect(state.updated).toHaveLength(0);
    expect(state.userSelects).toBe(0);
  });
});

describe('applyConnectionSelection — no-op paths', () => {
  it('is a no-op when the initiator re-submits (idempotent)', async () => {
    const { executor, state } = createFakeExecutor([pendingRow({ initiatorId: 'user-1' })]);

    const result = await applyConnectionSelection(executor, {
      eventId: 'event-1',
      callerId: 'user-1',
      peerId: 'peer-1',
      mutualSelectionV2Enabled: true,
      revealAt: REVEAL_AT,
    });

    expect(result.transition).toBeNull();
    expect(state.updated).toHaveLength(0);
  });

  it('is a no-op on an already-revealed row under either flag', async () => {
    for (const flag of [true, false]) {
      const { executor, state } = createFakeExecutor([pendingRow({ status: 'mutual' })]);

      const result = await applyConnectionSelection(executor, {
        eventId: 'event-1',
        callerId: 'user-1',
        peerId: 'peer-1',
        mutualSelectionV2Enabled: flag,
        revealAt: REVEAL_AT,
      });

      expect(result.transition).toBeNull();
      expect(state.updated).toHaveLength(0);
    }
  });

  it('is a no-op on an existing mutual_pending row', async () => {
    const { executor, state } = createFakeExecutor([
      pendingRow({ status: 'mutual_pending', revealAt: REVEAL_AT }),
    ]);

    const result = await applyConnectionSelection(executor, {
      eventId: 'event-1',
      callerId: 'user-1',
      peerId: 'peer-1',
      mutualSelectionV2Enabled: true,
      revealAt: REVEAL_AT,
    });

    expect(result.transition).toBeNull();
    expect(state.updated).toHaveLength(0);
  });

  it('orders the pair alphabetically regardless of who selected first', async () => {
    const { executor, state } = createFakeExecutor();

    await applyConnectionSelection(executor, {
      eventId: 'event-1',
      callerId: 'zz-user',
      peerId: 'aa-user',
      mutualSelectionV2Enabled: true,
      revealAt: REVEAL_AT,
    });

    expect(state.inserted[0]).toMatchObject({ userAId: 'aa-user', userBId: 'zz-user', initiatorId: 'zz-user' });
  });
});

// ── decideSelectionWithdrawal ──────────────────────────────────────────────

describe('decideSelectionWithdrawal', () => {
  it('keeps peers that are still selected', () => {
    expect(
      decideSelectionWithdrawal({
        keepSelected: true,
        rowStatus: 'mutual_pending',
        rowInitiatorId: 'peer-1',
        callerId: 'user-1',
      }),
    ).toBe('keep');
  });

  it('never revokes an already-revealed connection', () => {
    expect(
      decideSelectionWithdrawal({
        keepSelected: false,
        rowStatus: 'mutual',
        rowInitiatorId: 'user-1',
        callerId: 'user-1',
      }),
    ).toBe('protected');
  });

  it('downgrades a withdrawn mutual_pending row to the peer\'s pending claim', () => {
    expect(
      decideSelectionWithdrawal({
        keepSelected: false,
        rowStatus: 'mutual_pending',
        rowInitiatorId: 'user-1',
        callerId: 'user-1',
      }),
    ).toBe('downgrade');
  });

  it('deletes only the caller\'s own one-sided claim', () => {
    expect(
      decideSelectionWithdrawal({
        keepSelected: false,
        rowStatus: 'pending',
        rowInitiatorId: 'user-1',
        callerId: 'user-1',
      }),
    ).toBe('delete');
  });

  it('ignores a peer-initiated pending row (their selection, not ours)', () => {
    expect(
      decideSelectionWithdrawal({
        keepSelected: false,
        rowStatus: 'pending',
        rowInitiatorId: 'peer-1',
        callerId: 'user-1',
      }),
    ).toBe('ignore');
  });
});

// ── finalizeConnectionReveals ──────────────────────────────────────────────

describe('finalizeConnectionReveals', () => {
  it('flips due rows and reports them', async () => {
    const execute = vi.fn(async () => ({
      rows: [{ id: 'c1', event_id: 'event-1', user_a_id: 'a', user_b_id: 'b' }],
    }));

    const result = await finalizeConnectionReveals({ now: REVEAL_AT, executor: { execute } });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.revealed).toBe(1);
    expect(result.connections).toEqual([{ id: 'c1', eventId: 'event-1', userAId: 'a', userBId: 'b' }]);
  });

  it('is a no-op under a duplicate sweep (the statement matches nothing)', async () => {
    const execute = vi.fn(async () => ({ rows: [] }));

    const first = await finalizeConnectionReveals({ now: REVEAL_AT, executor: { execute } });
    const second = await finalizeConnectionReveals({ now: REVEAL_AT, executor: { execute } });

    expect(first.revealed).toBe(0);
    expect(second.revealed).toBe(0);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('tolerates a driver result without rows', async () => {
    const execute = vi.fn(async () => ({}) as any);
    await expect(finalizeConnectionReveals({ now: REVEAL_AT, executor: { execute } }))
      .resolves.toEqual({ revealed: 0, connections: [] });
  });
});

// ── source guards (the predicates a fake executor cannot evaluate) ─────────

describe('finalizeConnectionReveals statement guards', () => {
  const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
  const SOURCE = readFileSync(
    path.resolve(TEST_DIR, '../repositories/connectionSelectionRepo.ts'),
    'utf8',
  );

  it('only matches unrevealed mutual_pending rows that are due', () => {
    const start = SOURCE.indexOf('UPDATE connections');
    expect(start).toBeGreaterThanOrEqual(0);
    const statement = SOURCE.slice(start, SOURCE.indexOf('RETURNING id, event_id', start));

    expect(statement).toContain("WHERE status = 'mutual_pending'");
    expect(statement).toContain('AND revealed_at IS NULL');
    expect(statement).toContain('AND reveal_at IS NOT NULL');
    expect(statement).toContain('AND reveal_at <= ${now}');
  });

  it('snapshots both WeChat ids inside the same statement', () => {
    expect(SOURCE).toContain('user_a_wechat_id = (SELECT wechat_contact_id FROM users WHERE id = connections.user_a_id)');
    expect(SOURCE).toContain('user_b_wechat_id = (SELECT wechat_contact_id FROM users WHERE id = connections.user_b_id)');
  });
});

describe('purgeClosedConnectionSelections statement guards', () => {
  const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
  const SOURCE = readFileSync(
    path.resolve(TEST_DIR, '../repositories/connectionSelectionRepo.ts'),
    'utf8',
  );
  // Anchor on the id-subquery form: the ineligible-reveal expiry statement also
  // starts with `DELETE FROM connections`, so a bare indexOf would grab the
  // wrong statement after the G0 P0 hardening.
  const start = SOURCE.indexOf('DELETE FROM connections\n    WHERE id IN (');
  const statement = SOURCE.slice(start, SOURCE.indexOf('RETURNING id', start));

  it('never deletes a revealed mutual connection', () => {
    expect(start).toBeGreaterThanOrEqual(0);
    // `status <> 'mutual'` is the protection: a delivered pair is permanent.
    expect(statement).toContain("WHERE status <> 'mutual'");
  });

  it('only considers rows whose reveal window actually closed', () => {
    expect(statement).toContain('AND reveal_at IS NOT NULL');
    expect(statement).toContain('AND reveal_at <= ${cutoff}');
  });

  it('is bounded — the id subquery carries a LIMIT', () => {
    expect(statement).toContain('LIMIT ${limit}');
    expect(statement).toContain('ORDER BY reveal_at ASC');
  });

  it('documents the 30-day retention + privacy rationale', () => {
    expect(SOURCE).toContain('CONNECTION_SELECTION_RETENTION_DAYS = 30');
    expect(SOURCE).toContain('Why hard delete');
  });
});

// ── pre-reveal privacy ─────────────────────────────────────────────────────

describe('getOwnPendingReveal', () => {
  it('returns only count + revealAt for the caller\'s own selection', async () => {
    dbState.connectionRows = [{ count: 2, revealAt: REVEAL_AT }];

    const result = await getOwnPendingReveal('user-1', new Date('2026-11-10T20:00:00.000Z'));

    expect(result).toEqual({ count: 2, revealAt: REVEAL_AT });
    expect(Object.keys(result ?? {})).toEqual(['count', 'revealAt']);
  });

  it('returns null when nothing is awaiting reveal', async () => {
    dbState.connectionRows = [{ count: 0, revealAt: null }];
    await expect(getOwnPendingReveal('user-1', new Date())).resolves.toBeNull();
  });
});

describe('projectConnectionPrivacy', () => {
  it('drops peer identities entirely under V2 and keeps only the caller\'s own count', () => {
    const pendingRequests = [
      { id: 'c1', peerName: 'Alice', peerArchetype: 'corgi', eventTitle: '周五桌' },
      { id: 'c2', peerName: 'Bob', peerArchetype: 'corgi', eventTitle: '周五桌' },
    ];

    const result = projectConnectionPrivacy({
      mutualSelectionV2Enabled: true,
      pendingRequests,
      ownPendingReveal: { count: 3, revealAt: REVEAL_AT },
    });

    expect(result.pendingRequests).toEqual([]);
    expect(result.pendingReveal).toEqual({ count: 3, revealAt: REVEAL_AT.toISOString() });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('Alice');
    expect(serialized).not.toContain('Bob');
  });

  it('reports a zero count rather than hiding the card when nothing is pending', () => {
    const result = projectConnectionPrivacy({
      mutualSelectionV2Enabled: true,
      pendingRequests: [],
      ownPendingReveal: null,
    });

    expect(result).toEqual({ pendingRequests: [], pendingReveal: { count: 0, revealAt: null } });
  });

  it('keeps the legacy list byte-identically when the flag is OFF', () => {
    const pendingRequests = [{ id: 'c1', peerName: 'Alice', peerArchetype: 'corgi', eventTitle: '周五桌' }];

    const result = projectConnectionPrivacy({
      mutualSelectionV2Enabled: false,
      pendingRequests,
      ownPendingReveal: { count: 1, revealAt: REVEAL_AT },
    });

    expect(result.pendingRequests).toBe(pendingRequests);
    expect(result.pendingReveal).toBeNull();
  });
});

// ── window resolution ──────────────────────────────────────────────────────

describe('getConnectionSelectionWindow', () => {
  it('prefers an ops override row', async () => {
    const opensAt = new Date('2026-11-10T10:00:00.000Z');
    const closesAt = new Date('2026-11-11T10:00:00.000Z');
    dbState.windowRows = [{ opensAt, closesAt, revealAt: closesAt }];

    const resolved = await getConnectionSelectionWindow('event-1', new Date('2026-11-10T12:00:00.000Z'));

    expect(resolved?.source).toBe('override');
    expect(resolved?.window.revealAt.toISOString()).toBe(closesAt.toISOString());
    expect(resolved?.window.state).toBe('open');
  });

  it('derives from events.date_time when no override exists', async () => {
    dbState.windowRows = [];
    dbState.eventRows = [{ dateTime: new Date('2026-11-10T11:00:00.000Z') }];

    const resolved = await getConnectionSelectionWindow('event-1', new Date('2026-11-10T15:00:00.000Z'));

    expect(resolved?.source).toBe('derived');
    expect(resolved?.window.revealAt.toISOString()).toBe('2026-11-11T13:00:00.000Z');
    expect(resolved?.window.state).toBe('open');
  });

  it('ignores a malformed override row instead of throwing on the feedback path', async () => {
    dbState.windowRows = [{ opensAt: undefined, closesAt: 'nope', revealAt: null }];
    dbState.eventRows = [{ dateTime: new Date('2026-11-10T11:00:00.000Z') }];

    const resolved = await getConnectionSelectionWindow('event-1', new Date('2026-11-10T15:00:00.000Z'));

    expect(resolved?.source).toBe('derived');
    expect(resolved?.window.state).toBe('open');
  });

  it('returns null for an unknown event (callers surface a coded error)', async () => {
    dbState.windowRows = [];
    dbState.eventRows = [];
    await expect(getConnectionSelectionWindow('event-missing', new Date())).resolves.toBeNull();
  });
});

// ── purgeClosedConnectionSelections ────────────────────────────────────────

describe('purgeClosedConnectionSelections', () => {
  const NOW = new Date('2026-12-11T13:00:00.000Z');

  it('hard-deletes with a 30-day cutoff and the default batch bound', async () => {
    const execute = vi.fn(async () => ({ rows: [{ id: 'c1' }, { id: 'c2' }] }));

    const result = await purgeClosedConnectionSelections({ now: NOW, executor: { execute } });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.deleted).toBe(2);
    // 2026-12-11T13:00Z minus 30 days.
    expect(result.cutoff.toISOString()).toBe('2026-11-11T13:00:00.000Z');
    expect(CONNECTION_SELECTION_RETENTION_DAYS).toBe(30);
  });

  it('is a no-op when nothing is old enough', async () => {
    const execute = vi.fn(async () => ({ rows: [] }));

    await expect(
      purgeClosedConnectionSelections({ now: NOW, executor: { execute } }),
    ).resolves.toMatchObject({ deleted: 0 });
  });

  it('tolerates a driver result without rows', async () => {
    const execute = vi.fn(async () => undefined);
    await expect(
      purgeClosedConnectionSelections({ now: NOW, executor: { execute } as any }),
    ).resolves.toMatchObject({ deleted: 0 });
  });

  it('clamps the batch bound so a tick can never delete unboundedly', async () => {
    const captured: string[] = [];
    const execute = vi.fn(async (statement: any) => {
      captured.push(
        (statement?.queryChunks ?? [])
          .map((chunk: any) =>
            typeof chunk === 'string' || typeof chunk === 'number'
              ? String(chunk)
              : (chunk?.value ?? ''),
          )
          .join(''),
      );
      return { rows: [] };
    });

    await purgeClosedConnectionSelections({ now: NOW, limit: 0, executor: { execute } });
    await purgeClosedConnectionSelections({ now: NOW, limit: 10_000, executor: { execute } });

    // `limit: 0` is coerced to the minimum, not "unlimited"; a huge value is
    // clamped to the hard ceiling (rendered as a bound primitive chunk).
    expect(captured[0]).toContain('LIMIT 1');
    expect(captured[1]).toContain('LIMIT 5000');
    expect(CONNECTION_SELECTION_CLEANUP_BATCH_LIMIT).toBe(500);
  });
});

// ── reveal eligibility (P0 hardening, 2026-11-10) ──────────────────────────

const dialect = new PgDialect();

function captureStatements(rows: unknown[] = []) {
  const captured: any[] = [];
  const execute = vi.fn(async (statement: any) => {
    captured.push(statement);
    return { rows };
  });
  return { execute, captured };
}

describe('finalizeConnectionReveals — seat eligibility gate', () => {
  it('only reveals a pair whose BOTH sides still hold a seat', async () => {
    const { execute, captured } = captureStatements();

    await finalizeConnectionReveals({ now: REVEAL_AT, executor: { execute } as any });

    const text = dialect.sqlToQuery(captured[0]).sql.toLowerCase();

    // Pool-derived events: both users must still be matched/completed in THIS
    // group, and the owning pool must not be cancelled/archived.
    expect(text).toContain('from event_pool_registrations');
    expect(text).toContain("match_status in ('matched', 'completed')");
    expect(text).toContain("p.status in ('cancelled', 'archived')");
    // Legacy events: a cancelled seat or a no-show (absent) blocks the reveal.
    expect(text).toContain('from event_attendance');
    expect(text).toContain("a.status = 'cancelled'");
    expect(text).toContain("attendance_status = 'absent'");
    // Both user sides are checked, not just one.
    expect(text).toContain('r.user_id = connections.user_a_id');
    expect(text).toContain('r.user_id = connections.user_b_id');
  });

  it('keeps the due/unrevealed guards alongside the eligibility gate', async () => {
    const { execute, captured } = captureStatements();

    await finalizeConnectionReveals({ now: REVEAL_AT, executor: { execute } as any });

    const text = dialect.sqlToQuery(captured[0]).sql.toLowerCase();
    expect(text).toContain("where status = 'mutual_pending'");
    expect(text).toContain('and revealed_at is null');
    expect(text).toContain('and reveal_at <= ');
  });

  it('expires the pairs it skipped instead of notifying them', async () => {
    const { execute, captured } = captureStatements([{ id: 'c1' }, { id: 'c2' }]);

    const result = await expireIneligibleRevealSelections({
      now: REVEAL_AT,
      executor: { execute } as any,
    });

    const text = dialect.sqlToQuery(captured[0]).sql.toLowerCase();
    // Delete only the due, still-waiting rows the eligibility gate rejected.
    expect(text).toContain("where status = 'mutual_pending'");
    expect(text).toContain('and reveal_at <= ');
    expect(text).toContain('and not (');
    expect(result.expired).toBe(2);
  });

  it('is a no-op when nothing is due', async () => {
    const { execute } = captureStatements([]);

    await expect(
      expireIneligibleRevealSelections({ now: REVEAL_AT, executor: { execute } as any }),
    ).resolves.toEqual({ expired: 0 });
  });
});

// Keep the imports meaningful for future window-resolution cases.
void connections;

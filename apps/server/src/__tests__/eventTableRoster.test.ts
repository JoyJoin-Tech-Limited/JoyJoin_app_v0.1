import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * G0 (2026-11-10) — table roster authority for the selection write paths.
 *
 * Locks three things:
 *   - the pool-group roster is TABLE-scoped (that is the source the participants
 *     endpoint reads, keyed by the canonical events.id);
 *   - the attendance fallback is same-event only and reports
 *     `tableScoped: false` (documented schema gap, see the module TODO);
 *   - `findInvalidTablemates` is a pure fail-closed filter.
 */

const loggerMock = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock('../lib/logger', () => ({ logger: loggerMock }));
vi.mock('../db', () => ({ db: { select: vi.fn() } }));

import { eventAttendance, eventPoolGroups } from '@shared/schema';
import {
  findInvalidTablemates,
  getEventTableRoster,
  validateTablemateSelection,
} from '../repositories/eventTableRosterRepo';

interface ExecutorSeed {
  groupRows?: Array<{ groupId: string }>;
  memberRows?: Array<{ userId: string }>;
  attendanceRows?: Array<{ userId: string }>;
  /** `event_pool_groups` rows covering the event — drives the multi-table gate. */
  tableRows?: Array<{ id: string }>;
}

function createExecutor(seed: ExecutorSeed) {
  const calls: string[] = [];

  const executor = {
    select: () => ({
      from: (table: unknown) => {
        return {
          innerJoin: () => ({
            where: () => ({
              limit: async () => {
                calls.push('group');
                return seed.groupRows ?? [];
              },
            }),
          }),
          where: async () => {
            // `event_pool_groups` drives the table-count probe (P0 hardening);
            // `event_attendance` stays the legacy fallback; everything else is
            // the registrations table (member list).
            if (table === eventPoolGroups) {
              calls.push('tables');
              return seed.tableRows ?? [];
            }
            if (table === eventAttendance) {
              calls.push('attendance');
              return seed.attendanceRows ?? [];
            }
            calls.push('members');
            return seed.memberRows ?? [];
          },
        };
      },
    }),
  };

  return { executor, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getEventTableRoster', () => {
  it('prefers the pool group and reports it as table-scoped', async () => {
    const { executor, calls } = createExecutor({
      groupRows: [{ groupId: 'group-1' }],
      memberRows: [{ userId: 'viewer' }, { userId: 'peer-1' }, { userId: 'peer-1' }],
      attendanceRows: [{ userId: 'someone-else-event-wide' }],
    });

    const roster = await getEventTableRoster('event-1', 'viewer', { executor });

    expect(roster.source).toBe('pool_group');
    expect(roster.tableScoped).toBe(true);
    expect(roster.scope).toBe('table');
    expect(roster.userIds.sort()).toEqual(['peer-1', 'viewer']);
    // The attendance table is never consulted once the group is known.
    expect(calls).not.toContain('attendance');
  });

  it('falls back to attendance membership and admits it is not table-scoped', async () => {
    const { executor } = createExecutor({
      groupRows: [],
      attendanceRows: [{ userId: 'viewer' }, { userId: 'peer-1' }],
    });

    const roster = await getEventTableRoster('event-1', 'viewer', { executor });

    expect(roster.source).toBe('event_attendance');
    expect(roster.tableScoped).toBe(false);
    expect(roster.scope).toBe('event');
    expect(roster.userIds.sort()).toEqual(['peer-1', 'viewer']);
  });

  it('allows the same-event fallback on a SINGLE-table event (tableRows ≤ 1)', async () => {
    const { executor, calls } = createExecutor({
      groupRows: [],
      tableRows: [{ id: 'group-only' }],
      attendanceRows: [{ userId: 'viewer' }, { userId: 'peer-1' }],
    });

    const roster = await getEventTableRoster('event-1', 'viewer', { executor });

    // One table means same-event == same-table, so the fallback is provably safe.
    expect(roster.scope).toBe('event');
    expect(roster.tableCount).toBe(1);
    expect(roster.userIds.sort()).toEqual(['peer-1', 'viewer']);
    expect(calls).toContain('tables');
  });

  it('fails CLOSED when the event has >1 table and the viewer group is unresolved', async () => {
    const { executor } = createExecutor({
      groupRows: [],
      // Two tables: the viewer might be at either, so same-event attendance is
      // not evidence of same-table membership.
      tableRows: [{ id: 'group-1' }, { id: 'group-2' }],
      attendanceRows: [{ userId: 'viewer' }, { userId: 'other-table-peer' }],
    });

    const roster = await getEventTableRoster('event-1', 'viewer', { executor });

    expect(roster.userIds).toEqual([]);
    expect(roster.scope).toBe('multi_table_unresolved');
    expect(roster.tableCount).toBe(2);
    expect(roster.tableScoped).toBe(false);
  });

  it('rejects every peer with multi_table_unresolved on a multi-table event', async () => {
    const { executor } = createExecutor({
      groupRows: [],
      tableRows: [{ id: 'group-1' }, { id: 'group-2' }],
      attendanceRows: [{ userId: 'viewer' }, { userId: 'peer-1' }],
    });

    const result = await validateTablemateSelection({
      canonicalEventId: 'event-1',
      viewerId: 'viewer',
      peerIds: ['peer-1'],
      route: 'PUT /api/events/:eventId/connection-selection',
      executor,
    });

    expect(result.invalidPeerIds).toEqual(['peer-1']);
    expect(result.reason).toBe('multi_table_unresolved');
    expect(findInvalidTablemates(['peer-1'], result.roster)).toEqual(['peer-1']);
    // Two warns: the roster-level fail-closed notice, then the selection gate.
    const payload = loggerMock.warn.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      roster_scope: 'multi_table_unresolved',
      roster_table_count: 2,
      rejection_reason: 'multi_table_unresolved',
    });
  });

  it('accepts a same-table peer on a multi-table event when the group IS resolved', async () => {
    const { executor } = createExecutor({
      groupRows: [{ groupId: 'group-2' }],
      tableRows: [{ id: 'group-1' }, { id: 'group-2' }],
      memberRows: [{ userId: 'viewer' }, { userId: 'same-table-peer' }],
      // A peer from the OTHER table is in the event-wide attendance list — it
      // must never leak into the roster once the group is known.
      attendanceRows: [{ userId: 'viewer' }, { userId: 'other-table-peer' }],
    });

    const result = await validateTablemateSelection({
      canonicalEventId: 'event-1',
      viewerId: 'viewer',
      peerIds: ['same-table-peer'],
      route: 'PUT /api/events/:eventId/connection-selection',
      executor,
    });

    expect(result.invalidPeerIds).toEqual([]);
    expect(result.reason).toBe('none');
    expect(result.roster.scope).toBe('table');
    expect(findInvalidTablemates(['other-table-peer'], result.roster)).toEqual([
      'other-table-peer',
    ]);
  });

  it('returns an empty roster for an unknown event (fail closed downstream)', async () => {
    const { executor } = createExecutor({ groupRows: [], attendanceRows: [] });

    const roster = await getEventTableRoster('event-missing', 'viewer', { executor });

    expect(roster.userIds).toEqual([]);
    expect(roster.tableScoped).toBe(false);
  });

  it('never queries without both ids', async () => {
    const { executor, calls } = createExecutor({});

    const roster = await getEventTableRoster('', 'viewer', { executor });

    expect(roster.userIds).toEqual([]);
    expect(calls).toEqual([]);
  });
});

describe('findInvalidTablemates', () => {
  const roster = { userIds: ['viewer', 'peer-1', 'peer-2'] };

  it('passes only peers on the roster', () => {
    expect(findInvalidTablemates(['peer-1', 'peer-2'], roster)).toEqual([]);
  });

  it('returns every stranger', () => {
    expect(findInvalidTablemates(['peer-1', 'stranger-1', 'stranger-2'], roster)).toEqual([
      'stranger-1',
      'stranger-2',
    ]);
  });

  it('rejects everything against an empty roster', () => {
    expect(findInvalidTablemates(['peer-1'], { userIds: [] })).toEqual(['peer-1']);
  });
});

describe('validateTablemateSelection', () => {
  it('accepts a valid selection without logging', async () => {
    const { executor } = createExecutor({
      groupRows: [{ groupId: 'group-1' }],
      memberRows: [{ userId: 'viewer' }, { userId: 'peer-1' }],
    });

    const result = await validateTablemateSelection({
      canonicalEventId: 'event-1',
      viewerId: 'viewer',
      peerIds: ['peer-1'],
      route: 'PUT /api/events/:eventId/connection-selection',
      executor,
    });

    expect(result.invalidPeerIds).toEqual([]);
    expect(loggerMock.warn).not.toHaveBeenCalled();
  });

  it('logs counts only (no peer ids, no names) when it rejects', async () => {
    const { executor } = createExecutor({ groupRows: [], attendanceRows: [{ userId: 'viewer' }] });

    const result = await validateTablemateSelection({
      canonicalEventId: 'event-1',
      viewerId: 'viewer',
      peerIds: ['stranger-1'],
      route: 'POST /api/events/:eventId/feedback',
      executor,
    });

    expect(result.invalidPeerIds).toEqual(['stranger-1']);
    const payload = loggerMock.warn.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      eventId: 'event-1',
      invalid_count: 1,
      roster_source: 'event_attendance',
      roster_table_scoped: false,
    });
    expect(JSON.stringify(payload)).not.toContain('stranger-1');
  });
});

// Keep the schema imports meaningful: the roster reads these tables only.
void eventPoolGroups;
void eventAttendance;

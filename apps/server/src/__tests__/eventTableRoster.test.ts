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
}

function createExecutor(seed: ExecutorSeed) {
  const calls: string[] = [];

  const executor = {
    select: () => ({
      from: (table: unknown) => {
        const isRegistrationsTable = table !== eventAttendance;
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
            if (isRegistrationsTable) {
              calls.push('members');
              return seed.memberRows ?? [];
            }
            calls.push('attendance');
            return seed.attendanceRows ?? [];
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
    expect(roster.userIds.sort()).toEqual(['peer-1', 'viewer']);
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

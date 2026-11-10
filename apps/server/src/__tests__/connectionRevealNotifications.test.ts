import { describe, expect, it, vi } from 'vitest';

/**
 * G0 (2026-11-10) — reveal notification fan-out.
 *
 * Contract:
 *   - one in-app notification per side, deep-linked to Connections
 *     (`type: 'mutual_match'`, which the mini-program maps to switchTab);
 *   - the copy names nobody and states no count;
 *   - dedupe is part of the INSERT (`WHERE NOT EXISTS` on user + type +
 *     connection id) so duplicate scheduler ticks cannot double-send;
 *   - one failed connection never aborts the rest of the batch.
 */

const loggerMock = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock('../lib/logger', () => ({ logger: loggerMock }));
vi.mock('../db', () => ({ db: { execute: vi.fn() } }));

import {
  CONNECTION_REVEAL_NOTIFICATION,
  REVEAL_NOTIFICATION_BATCH_LIMIT,
  notifyRevealedConnections,
} from '../lib/connectionRevealNotifications';

interface CapturedStatement {
  /** Every SQL text/primitive chunk joined — drizzle keeps primitive
   *  interpolations in `queryChunks`, so bound values are visible here. */
  text: string;
}

/** Minimal drizzle-`sql` probe: captures the rendered text + bound params. */
function createExecutor(rowsPerCall: unknown[][]) {
  const statements: CapturedStatement[] = [];
  let call = 0;

  const executor = {
    execute: vi.fn(async (statement: any) => {
      statements.push({
        text: statement?.queryChunks ? renderChunks(statement) : String(statement),
      });
      const rows = rowsPerCall[call] ?? [];
      call += 1;
      return { rows: rows.map((_, index) => ({ id: `n-${index}` })) };
    }),
  };

  return { executor, statements };
}

function renderChunks(statement: any): string {
  return textOf(statement?.queryChunks ?? []);
}

function textOf(chunks: any[]): string {
  return chunks
    .map((chunk: any) => {
      if (chunk === null || chunk === undefined) return '';
      if (typeof chunk === 'string') return chunk;
      if (Array.isArray(chunk?.queryChunks)) return textOf(chunk.queryChunks);
      if (typeof chunk?.value === 'string') return chunk.value;
      if (Array.isArray(chunk?.value)) return chunk.value.join('');
      return '';
    })
    .join('');
}

const CONNECTION = { id: 'conn-1', eventId: 'event-1', userAId: 'user-a', userBId: 'user-b' };

describe('notifyRevealedConnections', () => {
  it('inserts one notification per side in a single deduped statement', async () => {
    const { executor, statements } = createExecutor([[{}, {}]]);

    const result = await notifyRevealedConnections([CONNECTION], { executor });

    expect(result).toEqual({
      notifiedConnections: 1,
      notifiedUsers: 2,
      skippedDuplicates: 0,
      failed: 0,
    });
    expect(executor.execute).toHaveBeenCalledTimes(1);

    const statement = statements[0].text;
    expect(statement).toContain('INSERT INTO notifications');
    // Both recipients come from one VALUES list — no N+1 fan-out.
    expect(statement).toContain('FROM (VALUES');
    // Dedupe predicate is part of the INSERT, not a separate read.
    expect(statement).toContain('WHERE NOT EXISTS');
    expect(statement).toContain('n.user_id = recipient.user_id');
    expect(statement).toContain('n.type = ');
    expect(statement).toContain('n.related_resource_id = ');
    // Recipients + the dedupe key are bound values, not interpolated SQL text.
    expect(statement).toContain('user-a');
    expect(statement).toContain('user-b');
    expect(statement).toContain('conn-1');
  });

  it('uses the Connections deep-link type and copy that names nobody', async () => {
    const { executor } = createExecutor([[{}, {}]]);

    await notifyRevealedConnections([CONNECTION], { executor });

    expect(CONNECTION_REVEAL_NOTIFICATION.type).toBe('mutual_match');
    expect(CONNECTION_REVEAL_NOTIFICATION.category).toBe('chat');
    expect(CONNECTION_REVEAL_NOTIFICATION.message).toBe('有同桌和你互相选择，去看看吧');
    // No count, no name, no archetype in the user-visible copy.
    expect(CONNECTION_REVEAL_NOTIFICATION.message).not.toMatch(/\d/);
    expect(CONNECTION_REVEAL_NOTIFICATION.title).not.toMatch(/\d/);
    expect(CONNECTION_REVEAL_NOTIFICATION.message).not.toContain('用户');
  });

  it('counts a fully-deduped connection as skipped, not notified', async () => {
    // Both rows already exist → the INSERT returns nothing.
    const { executor } = createExecutor([[]]);

    const result = await notifyRevealedConnections([CONNECTION], { executor });

    expect(result).toEqual({
      notifiedConnections: 0,
      notifiedUsers: 0,
      skippedDuplicates: 1,
      failed: 0,
    });
  });

  it('is idempotent across a duplicate tick (second pass inserts nothing)', async () => {
    const { executor } = createExecutor([[{}, {}], []]);

    const first = await notifyRevealedConnections([CONNECTION], { executor });
    const second = await notifyRevealedConnections([CONNECTION], { executor });

    expect(first.notifiedUsers).toBe(2);
    expect(second.notifiedUsers).toBe(0);
    expect(second.skippedDuplicates).toBe(1);
  });

  it('continues past a failed connection (fail-open)', async () => {
    const executor = {
      execute: vi
        .fn()
        .mockRejectedValueOnce(new Error('insert failed'))
        .mockResolvedValueOnce({ rows: [{}, {}] }),
    };

    const result = await notifyRevealedConnections(
      [CONNECTION, { ...CONNECTION, id: 'conn-2' }],
      { executor },
    );

    expect(result).toEqual({
      notifiedConnections: 1,
      notifiedUsers: 2,
      skippedDuplicates: 0,
      failed: 1,
    });
    expect(loggerMock.warn).toHaveBeenCalledWith(
      expect.stringContaining('Reveal notification insert failed'),
      expect.objectContaining({ connectionId: 'conn-1' }),
    );
  });

  it('never notifies a degenerate row', async () => {
    const { executor } = createExecutor([]);

    const result = await notifyRevealedConnections(
      [{ id: 'conn-self', eventId: 'event-1', userAId: 'same', userBId: 'same' }],
      { executor },
    );

    expect(executor.execute).not.toHaveBeenCalled();
    expect(result.notifiedUsers).toBe(0);
  });

  it('bounds the batch per tick', async () => {
    const { executor } = createExecutor([]);
    const connections = Array.from({ length: REVEAL_NOTIFICATION_BATCH_LIMIT + 5 }, (_, index) => ({
      id: `conn-${index}`,
      eventId: 'event-1',
      userAId: `a-${index}`,
      userBId: `b-${index}`,
    }));

    await notifyRevealedConnections(connections, { executor });

    expect(executor.execute).toHaveBeenCalledTimes(REVEAL_NOTIFICATION_BATCH_LIMIT);
  });

  it('tolerates an executor that returns nothing', async () => {
    const executor = { execute: vi.fn(async () => undefined) };

    await expect(
      notifyRevealedConnections([CONNECTION], { executor }),
    ).resolves.toMatchObject({ notifiedUsers: 0 });
  });
});

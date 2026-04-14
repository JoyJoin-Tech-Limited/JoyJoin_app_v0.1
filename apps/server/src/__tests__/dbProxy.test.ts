import { beforeEach, describe, expect, it, vi } from 'vitest';

const { trackDbOpMock } = vi.hoisted(() => ({
  trackDbOpMock: vi.fn(),
}));

vi.mock('../perf', () => ({
  trackDbOp: trackDbOpMock,
}));

import { wrapDb } from '../db_proxy';

function createThenableDeleteBuilder() {
  return {
    executed: false,
    whereClauses: [] as string[],
    where(this: { whereClauses: string[] }, clause: string) {
      this.whereClauses.push(clause);
      return this;
    },
    then(
      this: { executed: boolean; whereClauses: string[] },
      onFulfilled?: (value: { whereClauses: string[] }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      this.executed = true;
      return Promise.resolve({ whereClauses: [...this.whereClauses] }).then(onFulfilled, onRejected);
    },
  };
}

describe('wrapDb', () => {
  beforeEach(() => {
    trackDbOpMock.mockReset();
  });

  it('keeps thenable builders chainable and defers execution until await', async () => {
    // Guards against regression: Drizzle builders are thenable, but delete()
    // must stay chainable until where() is attached.
    const builder = createThenableDeleteBuilder();
    const rawDb = {
      delete: vi.fn(() => builder),
    };

    const db = wrapDb(rawDb);
    const query = db.delete('social_icebreaker_sessions');

    expect(rawDb.delete).toHaveBeenCalledWith('social_icebreaker_sessions');
    expect(builder.executed).toBe(false);
    expect(typeof query.where).toBe('function');

    const chainedQuery = query.where('expires_at < now()');

    expect(builder.executed).toBe(false);

    await expect(chainedQuery).resolves.toEqual({
      whereClauses: ['expires_at < now()'],
    });

    expect(builder.executed).toBe(true);
    expect(trackDbOpMock).toHaveBeenCalledTimes(1);
  });
});
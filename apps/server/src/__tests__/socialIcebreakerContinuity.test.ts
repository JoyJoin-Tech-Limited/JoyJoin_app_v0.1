import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * W8 (AC-W8.1) — Social Icebreaker session continuity.
 *
 * Locks the two halves of the fix:
 *  1. Expired sessions are TOMBSTONED (not hard-deleted), so a post-sweep read
 *     reports `expired: true` (410) rather than "never existed" (404 →
 *     `/start` creating a fresh session and losing mid-event progress).
 *  2. The TTL slides on heartbeat so an active session never expires mid-event.
 */

const { dbMock, state } = vi.hoisted(() => {
  const state = {
    setCalls: [] as any[],
    deleteCount: 0,
    selectRows: [] as any[],
    returningRows: [] as any[],
  };

  function chainableUpdate() {
    const returning = vi.fn(() => Promise.resolve(state.returningRows));
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn((values: any) => {
      state.setCalls.push(values);
      return { where };
    });
    return { set, where, returning };
  }

  const dbMock = {
    update: vi.fn(() => chainableUpdate()),
    delete: vi.fn(() => {
      state.deleteCount += 1;
      const where = vi.fn(() => Promise.resolve());
      return { where };
    }),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(state.selectRows)),
        })),
      })),
    })),
    transaction: vi.fn(async (cb: any) =>
      cb({
        update: vi.fn(() => chainableUpdate()),
        delete: vi.fn(() => {
          state.deleteCount += 1;
          const where = vi.fn(() => Promise.resolve());
          return { where };
        }),
        select: vi.fn(() => ({
          from: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })),
        })),
      }),
    ),
  };

  return { dbMock, state };
});

vi.mock('../db', () => ({ db: dbMock }));

import {
  SESSION_TTL_MS,
  SESSION_EXPIRED_MARKER,
  SESSION_EXPIRED_TOMBSTONE_RETENTION_MS,
  getSession,
  getSessionWithExpiry,
  isExpiredSessionState,
  renewSessionTtl,
  sweepExpiredSessions,
} from '../lib/socialIcebreakerStore';

describe('W8 AC-W8.1 — session expiry semantics', () => {
  beforeEach(() => {
    state.setCalls = [];
    state.deleteCount = 0;
    state.selectRows = [];
    state.returningRows = [];
    vi.clearAllMocks();
  });

  it('isExpiredSessionState recognizes the tombstone marker only', () => {
    expect(isExpiredSessionState({ [SESSION_EXPIRED_MARKER]: true })).toBe(true);
    expect(isExpiredSessionState({ currentPhase: 'warmup' })).toBe(false);
    expect(isExpiredSessionState(null)).toBe(false);
    expect(isExpiredSessionState('nope')).toBe(false);
  });

  it('getSessionWithExpiry reports expired=true for a past-TTL row (no fresh session)', async () => {
    state.selectRows = [{ stateJson: {}, expiresAt: new Date(Date.now() - 1000) }];

    const result = await getSessionWithExpiry('social_x');

    expect(result.expired).toBe(true);
    expect(result.state).toBeNull();
  });

  it('getSession treats a past-TTL row as absent', async () => {
    state.selectRows = [{ stateJson: {}, expiresAt: new Date(Date.now() - 1000) }];
    expect(await getSession('social_x')).toBeNull();
  });

  it('renewSessionTtl extends a live session by exactly SESSION_TTL_MS', async () => {
    const nowMs = 1_700_000_000_000;
    state.returningRows = [{ id: 'social_x' }];

    const renewed = await renewSessionTtl('social_x', nowMs);

    expect(renewed).toBe(true);
    const expiresAt = state.setCalls.at(-1)?.expiresAt as Date;
    expect(expiresAt.getTime()).toBe(nowMs + SESSION_TTL_MS);
  });

  it('renewSessionTtl never revives an already-expired/tombstoned session', async () => {
    state.returningRows = []; // guarded UPDATE matched no live row

    const renewed = await renewSessionTtl('social_x', Date.now());

    expect(renewed).toBe(false);
  });

  it('sweepExpiredSessions tombstones expired sessions instead of hard-deleting them', async () => {
    await sweepExpiredSessions();

    // The marker is written into state_json (the 410 signal survives the sweep).
    const tombstoneWrite = state.setCalls.find(
      (values) => values?.stateJson?.[SESSION_EXPIRED_MARKER] === true,
    );
    expect(tombstoneWrite).toBeDefined();
    // Participant cleanup + tombstone purge deletes happen, but the tombstone
    // write is what preserves the expired signal.
    expect(state.deleteCount).toBeGreaterThanOrEqual(2);
    expect(dbMock.transaction).toHaveBeenCalledTimes(1);
    // Retention window is explicit (storage stays bounded).
    expect(SESSION_EXPIRED_TOMBSTONE_RETENTION_MS).toBeGreaterThan(0);
  });
});

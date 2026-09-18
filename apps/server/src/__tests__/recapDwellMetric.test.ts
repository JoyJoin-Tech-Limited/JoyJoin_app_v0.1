/**
 * Wave 5 T-2 (release-train §2-f G3-b) — recap dwell on session termination.
 *
 * `savePhaseMetric` only fires when LEAVING a phase via transitionPhase;
 * recap is terminal, so the recap dwell leg of launch gate G3 needs these
 * termination-path writers. Covered here:
 *   - computeRecapDwellMs (pure dwell 口径 + floor)
 *   - recordRecapDwellMetric (single-session write, first-write-wins)
 *   - recordRecapDwellForExpiringSessions (TTL sweep path)
 *
 * Idempotency evidence: every insert uses onConflictDoNothing targeted at
 * [socialSessionId, phase] — backed by the unique index
 * `idx_phase_metrics_session_phase` (schema/_definitions_social.ts:192) —
 * so a force-end followed by a sweep, or a repeated sweep, can never
 * duplicate or overwrite the first termination row.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbCtx = vi.hoisted(() => ({
  selectRows: [] as Array<Record<string, unknown>>,
  insertCalls: [] as Array<{ values: unknown; conflictTarget: unknown }>,
}));

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => dbCtx.selectRows,
      }),
    }),
    insert: () => ({
      values: (values: unknown) => ({
        onConflictDoNothing: (opts?: { target?: unknown }) => {
          dbCtx.insertCalls.push({ values, conflictTarget: opts?.target });
          return Promise.resolve();
        },
      }),
    }),
  },
}));

import {
  RECAP_DWELL_MIN_MS,
  computeRecapDwellMs,
  recordRecapDwellMetric,
  recordRecapDwellForExpiringSessions,
} from '../lib/socialIcebreakerStore';

describe('computeRecapDwellMs (dwell 口径: recap entry → session close)', () => {
  it('returns terminatedAt − phaseStartedAt when at or above the floor', () => {
    expect(computeRecapDwellMs(1_000_000, 1_000_000 + 65_000)).toBe(65_000);
    expect(computeRecapDwellMs(1_000_000, 1_000_000 + RECAP_DWELL_MIN_MS)).toBe(RECAP_DWELL_MIN_MS);
  });

  it('returns null below the 1s floor (mirrors the transitionPhase floor)', () => {
    expect(computeRecapDwellMs(1_000_000, 1_000_000 + RECAP_DWELL_MIN_MS - 1)).toBeNull();
  });

  it('returns null when phaseStartedAt is missing or not finite', () => {
    expect(computeRecapDwellMs(null, 2_000_000)).toBeNull();
    expect(computeRecapDwellMs(undefined, 2_000_000)).toBeNull();
    expect(computeRecapDwellMs(NaN, 2_000_000)).toBeNull();
  });

  it('returns null for negative dwell (clock skew guard)', () => {
    expect(computeRecapDwellMs(2_000_000, 1_000_000)).toBeNull();
  });
});

describe('recordRecapDwellMetric (force-end path writer)', () => {
  beforeEach(() => {
    dbCtx.selectRows = [];
    dbCtx.insertCalls = [];
  });

  it('inserts a recap row with onConflictDoNothing on the session+phase unique target', async () => {
    const startedAt = new Date(1_700_000_000_000);
    const endedAt = new Date(1_700_000_120_000);

    await recordRecapDwellMetric('social_x', {
      dwellTimeMs: 120_000,
      startedAt,
      endedAt,
      participantCount: 6,
    });

    expect(dbCtx.insertCalls).toHaveLength(1);
    const call = dbCtx.insertCalls[0];
    expect(call.values).toEqual({
      socialSessionId: 'social_x',
      phase: 'recap',
      dwellTimeMs: 120_000,
      startedAt,
      endedAt,
      participantCount: 6,
    });
    // Idempotency evidence: conflict target = [socialSessionId, phase]
    // (unique index idx_phase_metrics_session_phase) — first write wins.
    expect(Array.isArray(call.conflictTarget)).toBe(true);
    expect(call.conflictTarget as unknown[]).toHaveLength(2);
  });
});

describe('recordRecapDwellForExpiringSessions (TTL sweep path writer)', () => {
  beforeEach(() => {
    dbCtx.selectRows = [];
    dbCtx.insertCalls = [];
  });

  it('writes recap rows for expiring recap sessions with dwell = expiresAt − phaseStartedAt', async () => {
    const phaseStartedAtMs = 1_700_000_000_000;
    const expiresAt = new Date(phaseStartedAtMs + 300_000);
    dbCtx.selectRows = [
      {
        id: 'social_exp1',
        expiresAt,
        phaseStartedAtMs: String(phaseStartedAtMs),
        playerCount: '5',
      },
    ];

    const written = await recordRecapDwellForExpiringSessions(new Date());

    expect(written).toBe(1);
    expect(dbCtx.insertCalls).toHaveLength(1);
    expect(dbCtx.insertCalls[0].values).toEqual([
      {
        socialSessionId: 'social_exp1',
        phase: 'recap',
        dwellTimeMs: 300_000,
        startedAt: new Date(phaseStartedAtMs),
        endedAt: expiresAt,
        participantCount: 5,
      },
    ]);
    expect(dbCtx.insertCalls[0].conflictTarget as unknown[]).toHaveLength(2);
  });

  it('skips rows below the dwell floor or with a missing phaseStartedAt', async () => {
    const now = 1_700_000_000_000;
    dbCtx.selectRows = [
      // below floor
      { id: 'social_short', expiresAt: new Date(now + 500), phaseStartedAtMs: String(now), playerCount: '4' },
      // missing phaseStartedAt
      { id: 'social_nostart', expiresAt: new Date(now + 60_000), phaseStartedAtMs: null, playerCount: '4' },
      // unparseable playerCount still writes, with null participantCount
      { id: 'social_ok', expiresAt: new Date(now + 60_000), phaseStartedAtMs: String(now), playerCount: null },
    ];

    const written = await recordRecapDwellForExpiringSessions(new Date());

    expect(written).toBe(1);
    const values = dbCtx.insertCalls[0].values as Array<Record<string, unknown>>;
    expect(values).toHaveLength(1);
    expect(values[0].socialSessionId).toBe('social_ok');
    expect(values[0].participantCount).toBeNull();
  });

  it('performs no insert when no expiring recap sessions exist', async () => {
    dbCtx.selectRows = [];

    const written = await recordRecapDwellForExpiringSessions(new Date());

    expect(written).toBe(0);
    expect(dbCtx.insertCalls).toHaveLength(0);
  });
});

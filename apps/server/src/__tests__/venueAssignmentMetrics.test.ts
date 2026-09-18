/**
 * Venue-assignment observability metrics — regression tests (budget-tier
 * workstream T8, spec §8.3: `unassignedBreakdown` promoted to metrics).
 *
 * Drives the real `saveVenueAssignments` through the house chainable db mock
 * and asserts the outcome lands in the matching-metrics registry:
 *   - an unassignable group increments the reason-labelled counter, and
 *   - a successful assignment increments the assigned counter, and
 *   - `getMatchingMetricsText()` exposes the new Prometheus series.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { eventPoolGroups, venueTimeSlots, venueTimeSlotBookings } from '@shared/schema';

// ── Mock DB chain (house pattern, see adminMatchingReview.test.ts) ──────────

type Results = {
  groups?: Array<{ id: string; groupNumber: number }>;
  bookings?: Array<{ eventGroupId: string; id: string }>;
  slots?: Array<{ id: string; maxConcurrentEvents: number }>;
};

let currentResults: Results = {};

function resolver(state: { op: string; table: unknown }) {
  if (state.op === 'select') {
    if (state.table === eventPoolGroups) return currentResults.groups ?? [];
    if (state.table === venueTimeSlotBookings) return currentResults.bookings ?? [];
    if (state.table === venueTimeSlots) return currentResults.slots ?? [];
  }
  return [];
}

function createChain() {
  const state = { op: '', table: null as unknown };
  const chain: Record<string, unknown> = {
    select: () => { state.op = 'select'; return chain; },
    from: (table: unknown) => { state.table = table; return chain; },
    where: () => chain,
    for: () => chain,
    groupBy: () => chain,
    update: (table: unknown) => { state.op = 'update'; state.table = table; return chain; },
    set: () => chain,
    insert: (table: unknown) => { state.op = 'insert'; state.table = table; return chain; },
    values: () => chain,
    then: (onFulfilled: (value: unknown) => unknown) =>
      Promise.resolve(resolver(state)).then(onFulfilled),
  };
  return chain;
}

const mockDb = {
  select: vi.fn(() => {
    const chain = createChain();
    (chain.select as () => unknown)();
    return chain;
  }),
  update: vi.fn((table: unknown) => {
    const chain = createChain();
    (chain.update as (t: unknown) => unknown)(table);
    return chain;
  }),
  insert: vi.fn((table: unknown) => {
    const chain = createChain();
    (chain.insert as (t: unknown) => unknown)(table);
    return chain;
  }),
  transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(mockDb)),
};

vi.mock('../db', () => ({ db: mockDb }));

vi.mock('../lib/wecomNotifier', () => ({
  notifyVenueUnassigned: vi.fn(() => Promise.resolve()),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Subject under test (real matching metrics, NOT mocked) ─────────────────
// Dynamically imported AFTER the mocks are registered: a static import would
// evaluate the ../db mock factory before `mockDb` is initialized (TDZ), the
// same reason adminMatchingReview.test.ts lazy-imports its subject.

import {
  _resetMatchingMetricsForTest,
  getMatchingMetricsSnapshot,
  getMatchingMetricsText,
} from '../matchingMetrics';

let saveVenueAssignments: typeof import('../venueAssignmentService').saveVenueAssignments;

beforeAll(async () => {
  ({ saveVenueAssignments } = await import('../venueAssignmentService'));
});

const POOL_DATE = new Date('2026-10-02T11:30:00.000Z'); // 2026-10-02 19:30 CST

describe('venue-assignment observability metrics (T8)', () => {
  beforeEach(() => {
    _resetMatchingMetricsForTest();
    currentResults = {};
    vi.clearAllMocks();
  });

  it('increments the reason-labelled counter for an unassignable group', async () => {
    currentResults = {
      groups: [{ id: 'g1', groupNumber: 1 }],
      bookings: [],
    };

    await saveVenueAssignments(
      'pool-1',
      POOL_DATE,
      new Map(),
      new Map([[1, 'budget_mismatch']]),
      { title: '测试池', city: '深圳' },
    );

    const snapshot = getMatchingMetricsSnapshot();
    expect(snapshot.venueAssignment.assigned).toBe(0);
    expect(snapshot.venueAssignment.unassignedTotal).toBe(1);
    expect(snapshot.venueAssignment.unassignedByReason).toEqual({ budget_mismatch: 1 });

    const text = getMatchingMetricsText();
    expect(text).toContain('# TYPE joyjoin_venue_assignment_groups_total counter');
    expect(text).toContain(
      'joyjoin_venue_assignment_groups_total{outcome="unassigned",reason="budget_mismatch"} 1',
    );
  });

  it('increments the assigned counter when a booking is persisted', async () => {
    currentResults = {
      groups: [{ id: 'g1', groupNumber: 1 }],
      bookings: [],
      slots: [{ id: 'slot-1', maxConcurrentEvents: 1 }],
    };

    const assignments = new Map([
      [
        1,
        {
          venue: { id: 'v1', brandName: 'Bruma', name: 'bruma', address: '南山' },
          score: 80,
          reasons: ['预算匹配'],
          timeSlotId: 'slot-1',
        },
      ],
    ]);

    await saveVenueAssignments('pool-1', POOL_DATE, assignments, new Map(), {
      title: '测试池',
      city: '深圳',
    });

    const snapshot = getMatchingMetricsSnapshot();
    expect(snapshot.venueAssignment.assigned).toBe(1);
    expect(snapshot.venueAssignment.unassignedTotal).toBe(0);

    const text = getMatchingMetricsText();
    expect(text).toContain('joyjoin_venue_assignment_groups_total{outcome="assigned"} 1');
  });

  it('does not double-count groups that already have a booking (idempotent re-run)', async () => {
    currentResults = {
      groups: [{ id: 'g1', groupNumber: 1 }],
      bookings: [{ eventGroupId: 'g1', id: 'booking-1' }],
      slots: [{ id: 'slot-1', maxConcurrentEvents: 1 }],
    };

    const assignments = new Map([
      [
        1,
        {
          venue: { id: 'v1', brandName: 'Bruma', name: 'bruma', address: '南山' },
          score: 80,
          reasons: [],
          timeSlotId: 'slot-1',
        },
      ],
    ]);

    await saveVenueAssignments('pool-1', POOL_DATE, assignments, new Map());

    const snapshot = getMatchingMetricsSnapshot();
    expect(snapshot.venueAssignment.assigned).toBe(0);
    expect(snapshot.venueAssignment.unassignedTotal).toBe(0);
  });
});

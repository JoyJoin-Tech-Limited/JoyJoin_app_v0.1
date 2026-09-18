/**
 * T7 budget-aware assignment degradation — regression tests.
 *
 * Covers the sprint contract `.git/.orchestration/sprints/sprint-contract.budget-t7-degradation-20260916.md`:
 *   AC-2  flag OFF is byte-for-byte the legacy budget path
 *   AC-3  flag ON: distance 0 → 40, distance 1 → 20, distance ≥2 → not placeable
 *   AC-5  two-pass rescue (strict → relaxed), one-tier cap enforced in both
 *   AC-9  LOCKED: real `scoreVenueForGroup` proves no empty-consensus +40, an
 *         adjacent placement carries `budget_adjacent`, and distance ≥2 is not
 *         placeable.
 *
 * Tier ids are derived from the registry (never hardcoded) and both passes are
 * exercised through the exported DB-free functions, so this suite needs no
 * database. `scoreVenueForGroup` receives `adjacencyEnabled` explicitly — the
 * default branch resolves the feature flag via `getFeatureFlagSync`.
 */
import { describe, it, expect } from 'vitest';
import { venues, venueTimeSlots } from '@shared/schema';
import { getTiersForEventType, type BudgetEventType } from '@shared/budgetTiers';
import {
  findBestVenueForGroup,
  scoreVenueForGroup,
} from '../venueAssignmentService';
import {
  _resetMatchingMetricsForTest,
  getMatchingMetricsSnapshot,
  observeVenueAssignmentRun,
} from '../matchingMetrics';
import { DEFAULT_FLAG_VALUES, FLAG_ENV_MAP } from '../lib/featureFlags';
import type { MatchGroup, UserWithProfile } from '../poolMatchingService';

// ── Registry-derived tier ids (no literals → ratchet-safe) ──────────────────

function tierIdAt(eventType: BudgetEventType, order: number): string {
  const tier = getTiersForEventType(eventType).find((t) => t.order === order);
  if (!tier) throw new Error(`No ${eventType} tier at order ${order}`);
  return tier.id;
}

const DINING_0 = tierIdAt('饭局', 0); // cheapest 饭局 tier
const DINING_1 = tierIdAt('饭局', 1);
const DINING_2 = tierIdAt('饭局', 2);
const DINING_3 = tierIdAt('饭局', 3); // priciest registered 饭局 tier

// ── Fixtures ────────────────────────────────────────────────────────────────

const makeMember = (budgetRange: string[]): UserWithProfile =>
  ({ budgetRange, barBudgetRange: [] } as unknown as UserWithProfile);

const makeGroup = (size: number): MatchGroup =>
  ({ members: Array.from({ length: size }, () => makeMember([DINING_2])) } as unknown as MatchGroup);

const makeVenue = (
  budgetCategories: string[] | null,
  seatingCapacity = 12,
): typeof venues.$inferSelect =>
  ({
    budgetCategories,
    cuisines: [],
    seatingCapacity,
    capacity: seatingCapacity,
  } as unknown as typeof venues.$inferSelect);

const NONE = new Date('2026-06-05T11:30:00.000Z');

const score = (
  venue: typeof venues.$inferSelect,
  groupBudget: string[],
  group: MatchGroup,
  options: { adjacencyEnabled: boolean; strictPass?: boolean },
) =>
  scoreVenueForGroup(venue, group, NONE, '饭局', groupBudget, options);

// ── AC-1: flag registration + safe default ───────────────────────────────────

describe('T7 degradation — flag registration (AC-1)', () => {
  it('maps to BUDGET_ADJACENCY_ENABLED and defaults to false', () => {
    expect(FLAG_ENV_MAP.budgetAdjacencyEnabled).toBe('BUDGET_ADJACENCY_ENABLED');
    expect(DEFAULT_FLAG_VALUES.budgetAdjacencyEnabled).toBe(false);
  });
});

// ── AC-2: flag OFF parity ────────────────────────────────────────────────────

describe('T7 degradation — flag OFF parity (AC-2)', () => {
  it('empty consensus still receives the legacy flat +40', async () => {
    const scored = await score(makeVenue([DINING_2]), [], makeGroup(3), { adjacencyEnabled: false });
    // 40 budget + 15 cuisine + 20 capacity + 10 location
    expect(scored.score).toBe(85);
    expect(scored.reasons.join(' | ')).toContain('未设置预算限制');
    expect(scored.reasons.join(' | ')).not.toContain('budget_adjacent');
  });

  it('exact overlap still scores the full 40 budget points', async () => {
    const scored = await score(makeVenue([DINING_2]), [DINING_2], makeGroup(3), {
      adjacencyEnabled: false,
    });
    expect(scored.score).toBe(85);
    expect(scored.reasons.join(' | ')).toContain('预算匹配');
  });

  it('zero overlap still hard-fails with 预算不匹配', async () => {
    const scored = await score(makeVenue([DINING_2]), [DINING_3], makeGroup(3), {
      adjacencyEnabled: false,
    });
    expect(scored.score).toBe(0);
    expect(scored.reasons.join(' | ')).toContain('预算不匹配');
  });

  it('a distance-2 venue is still a plain hard-fail (no adjacency wording leaks)', async () => {
    const scored = await score(makeVenue([DINING_2]), [DINING_0], makeGroup(3), {
      adjacencyEnabled: false,
    });
    expect(scored.score).toBe(0);
    expect(scored.reasons.join(' | ')).not.toContain('budget_adjacent');
  });
});

// ── AC-3 / AC-9: flag ON adjacency + empty-consensus neutrality ─────────────

describe('T7 degradation — flag ON adjacency (AC-3, AC-9)', () => {
  it('AC-9(a): empty consensus no longer receives the unconditional +40', async () => {
    const off = await score(makeVenue([DINING_2]), [], makeGroup(3), { adjacencyEnabled: false });
    const on = await score(makeVenue([DINING_2]), [], makeGroup(3), { adjacencyEnabled: true });

    expect(off.score).toBe(85); // legacy: 40 budget points
    expect(on.score).toBe(45); // neutral: 0 budget + 15 + 20 + 10
    expect(on.score).not.toBe(off.score);
    expect(on.reasons.join(' | ')).toContain('未设置预算限制');
  });

  it('AC-9(b): a distance-1 tier is placeable and disclosed as budget_adjacent', async () => {
    // group consensus DINING_2 (order 2), venue DINING_3 (order 3) → distance 1
    const scored = await score(makeVenue([DINING_3]), [DINING_2], makeGroup(3), {
      adjacencyEnabled: true,
    });
    expect(scored.score).toBe(65); // 20 budget + 15 + 20 + 10
    expect(scored.reasons.join(' | ')).toContain('budget_adjacent');
  });

  it('AC-9(c): a distance-2 tier is NOT placeable (B4 one-tier cap)', async () => {
    // group consensus DINING_0, venue DINING_2 → distance 2
    const scored = await score(makeVenue([DINING_2]), [DINING_0], makeGroup(3), {
      adjacencyEnabled: true,
    });
    expect(scored.score).toBe(0);
    expect(scored.reasons.join(' | ')).toContain('预算不匹配');
  });

  it('exact overlap still scores 40 under the flag', async () => {
    const scored = await score(makeVenue([DINING_2]), [DINING_2], makeGroup(3), {
      adjacencyEnabled: true,
    });
    expect(scored.score).toBe(85);
    expect(scored.reasons.join(' | ')).toContain('预算匹配');
  });

  it('distance-1 remains placeable in both directions (up and down a tier)', async () => {
    const up = await score(makeVenue([DINING_3]), [DINING_2], makeGroup(3), { adjacencyEnabled: true });
    const down = await score(makeVenue([DINING_1]), [DINING_2], makeGroup(3), { adjacencyEnabled: true });
    expect(up.reasons.join(' | ')).toContain('budget_adjacent');
    expect(down.reasons.join(' | ')).toContain('budget_adjacent');
    expect(up.score).toBeGreaterThan(0);
    expect(down.score).toBeGreaterThan(0);
  });
});

// ── AC-5: two-pass rescue ────────────────────────────────────────────────────

interface FakeSlot {
  id: string;
  maxConcurrentEvents: number;
}

function venueWithSlot(
  venue: typeof venues.$inferSelect,
  slotId: string,
): { venue: typeof venues.$inferSelect; timeSlot: typeof venueTimeSlots.$inferSelect } {
  return {
    venue,
    timeSlot: { id: slotId, maxConcurrentEvents: 1 } as unknown as typeof venueTimeSlots.$inferSelect,
  };
}

describe('T7 degradation — two-pass rescue (AC-5)', () => {
  const untagged = makeVenue(null);
  const budgetedVenue = makeVenue([DINING_2]);
  const group = makeGroup(3);
  const alwaysAvailable = () => true;

  it('rescue: an untagged venue is rejected in pass 1 but placed in pass 2 (flag on)', async () => {
    const best = await findBestVenueForGroup(
      group,
      [venueWithSlot(untagged, 'slot-1')],
      NONE,
      '饭局',
      [DINING_2],
      { adjacencyEnabled: true, canUseSlot: alwaysAvailable },
    );
    expect(best).not.toBeNull();
    expect(best!.venue).toBe(untagged);
    expect(best!.score).toBeGreaterThan(0);
    expect(best!.reasons.join(' | ')).toContain('按偏好处理');
  });

  it('no rescue when the flag is off: an untagged venue yields null', async () => {
    const best = await findBestVenueForGroup(
      group,
      [venueWithSlot(untagged, 'slot-1')],
      NONE,
      '饭局',
      [DINING_2],
      { adjacencyEnabled: false, canUseSlot: alwaysAvailable },
    );
    expect(best).toBeNull();
  });

  it('cap holds in pass 2: a distance-2 venue is never rescued', async () => {
    const best = await findBestVenueForGroup(
      group,
      [venueWithSlot(makeVenue([DINING_0]), 'slot-1')],
      NONE,
      '饭局',
      [DINING_2],
      { adjacencyEnabled: true, canUseSlot: alwaysAvailable },
    );
    expect(best).toBeNull();
  });

  it('pass 1 wins when a strict candidate exists (no needless adjacent pick)', async () => {
    const best = await findBestVenueForGroup(
      group,
      [venueWithSlot(untagged, 'slot-untagged'), venueWithSlot(budgetedVenue, 'slot-budgeted')],
      NONE,
      '饭局',
      [DINING_2],
      { adjacencyEnabled: true, canUseSlot: alwaysAvailable },
    );
    expect(best).not.toBeNull();
    expect(best!.venue).toBe(budgetedVenue);
  });

  it('slot predicate is honoured (full slot is skipped)', async () => {
    const best = await findBestVenueForGroup(
      group,
      [venueWithSlot(budgetedVenue, 'slot-full')],
      NONE,
      '饭局',
      [DINING_2],
      { adjacencyEnabled: false, canUseSlot: () => false },
    );
    expect(best).toBeNull();
  });
});

// ── AC-6: budget_adjacent is a SUCCESS reason, not an unassigned reason ─────

describe('T7 degradation — metrics reason boundary (AC-6)', () => {
  it('budget_adjacent collapses to __other__ in the unassigned-reason allowlist', () => {
    _resetMatchingMetricsForTest();
    observeVenueAssignmentRun({
      assignedCount: 0,
      unassignedByReason: { budget_adjacent: 1 },
    });

    const snapshot = getMatchingMetricsSnapshot();
    const byReason = snapshot.venueAssignment.unassignedByReason;

    // The allowlist is a bounded enum — an unknown reason must never become a
    // first-class label. This proves budget_adjacent stays a success disclosure.
    expect(byReason.budget_adjacent).toBeUndefined();
    expect(byReason.__other__).toBe(1);
  });
});

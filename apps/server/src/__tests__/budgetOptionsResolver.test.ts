/**
 * City-level budget-options resolver — regression tests (T7 / spec §5).
 *
 * Covers:
 *   AC-7  every registry tier is annotated with coverage (never filtered)
 *   AC-8  fail-open on DB error and on empty result → full registry
 *   AC-10 single aggregate query, no per-tier N+1
 * plus cache hit / invalidation behaviour.
 *
 * Tier ids are derived from the registry (no hardcoded budget literals).
 * The db module is mocked with the house chainable pattern.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTiersForEventType } from '@shared/budgetTiers';

// ── House chainable db mock (hoisted) ───────────────────────────────────────
const h = vi.hoisted(() => {
  const state = {
    rows: [] as Array<{ budgetCategories: string[] | null }>,
    shouldThrow: false,
    selectCalls: 0,
  };
  const chain: Record<string, unknown> = {
    select: () => chain,
    from: () => chain,
    where: () => {
      if (state.shouldThrow) return Promise.reject(new Error('db unavailable'));
      return Promise.resolve(state.rows);
    },
  };
  const db = {
    select: vi.fn(() => {
      state.selectCalls += 1;
      return chain;
    }),
  };
  return { state, db };
});

vi.mock('../db', () => ({ db: h.db }));
vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  resolveBudgetOptions,
  invalidateBudgetOptionsCache,
  SPARSE_COVERAGE_MAX_VENUES,
} from '../lib/budgetOptionsResolver';

function tierIdAt(order: number): string {
  const tier = getTiersForEventType('饭局').find((t) => t.order === order);
  if (!tier) throw new Error(`No 饭局 tier at order ${order}`);
  return tier.id;
}

const DINING_0 = tierIdAt(0);
const DINING_1 = tierIdAt(1);
const DINING_2 = tierIdAt(2);
const DINING_3 = tierIdAt(3);
const DINING_TIERS = getTiersForEventType('饭局');

beforeEach(() => {
  invalidateBudgetOptionsCache();
  h.state.rows = [];
  h.state.shouldThrow = false;
  h.state.selectCalls = 0;
});

describe('resolveBudgetOptions — annotate, never hide (AC-7)', () => {
  it('returns every registry tier for the event type', async () => {
    h.state.rows = [{ budgetCategories: [DINING_2] }];

    const options = await resolveBudgetOptions('深圳', '饭局');

    expect(options.map((o) => o.id)).toEqual(DINING_TIERS.map((t) => t.id));
  });

  it('annotates coverage available / sparse / none per eligible-venue count', async () => {
    h.state.rows = [
      { budgetCategories: [DINING_2] },
      { budgetCategories: [DINING_2] }, // DINING_2 → 2 venues → available
      { budgetCategories: [DINING_1] }, // DINING_1 → 1 venue → sparse
    ];

    const options = await resolveBudgetOptions('深圳', '饭局');
    const byId = new Map(options.map((o) => [o.id, o]));

    expect(byId.get(DINING_2)?.coverage).toBe('available');
    expect(byId.get(DINING_2)?.venueCount).toBe(2);
    expect(byId.get(DINING_1)?.coverage).toBe('sparse');
    expect(byId.get(DINING_1)?.venueCount).toBe(1);
    expect(byId.get(DINING_0)?.coverage).toBe('none');
    expect(byId.get(DINING_3)?.coverage).toBe('none');
    expect(SPARSE_COVERAGE_MAX_VENUES).toBe(1);
  });

  it('counts legacy labels and canonical ids toward the same tier', async () => {
    // Mix of a canonical id and its legacy label on two venues.
    const legacyLabelFor = (order: number) => DINING_TIERS.find((t) => t.order === order)?.label ?? '';
    h.state.rows = [
      { budgetCategories: [DINING_2] },
      { budgetCategories: [legacyLabelFor(2)] },
    ];

    const options = await resolveBudgetOptions('深圳', '饭局');
    const dining2 = options.find((o) => o.id === DINING_2);
    expect(dining2?.venueCount).toBe(2);
    expect(dining2?.coverage).toBe('available');
  });
});

describe('resolveBudgetOptions — fail-open (AC-8)', () => {
  it('returns the full registry when the query throws', async () => {
    h.state.shouldThrow = true;

    const options = await resolveBudgetOptions('深圳', '饭局');

    expect(options.map((o) => o.id)).toEqual(DINING_TIERS.map((t) => t.id));
    expect(options.every((o) => o.coverage === 'none')).toBe(true);
  });

  it('returns the full registry when no eligible venues exist', async () => {
    h.state.rows = [];

    const options = await resolveBudgetOptions('深圳', '饭局');

    expect(options.map((o) => o.id)).toEqual(DINING_TIERS.map((t) => t.id));
    expect(options.every((o) => o.coverage === 'none')).toBe(true);
  });

  it('returns the full registry without querying when city is missing', async () => {
    const options = await resolveBudgetOptions('', '饭局');

    expect(options.map((o) => o.id)).toEqual(DINING_TIERS.map((t) => t.id));
    expect(h.state.selectCalls).toBe(0);
  });
});

describe('resolveBudgetOptions — query + cache (AC-10)', () => {
  it('issues exactly one query per cache miss (no N+1)', async () => {
    h.state.rows = [{ budgetCategories: [DINING_2] }];

    await resolveBudgetOptions('深圳', '饭局');

    expect(h.state.selectCalls).toBe(1);
  });

  it('serves a cached result without re-querying', async () => {
    h.state.rows = [{ budgetCategories: [DINING_2] }];

    const first = await resolveBudgetOptions('深圳', '饭局');
    const second = await resolveBudgetOptions('深圳', '饭局');

    expect(h.state.selectCalls).toBe(1);
    expect(second).toEqual(first);
  });

  it('re-queries after invalidation and reflects catalog changes', async () => {
    h.state.rows = [{ budgetCategories: [DINING_2] }];
    await resolveBudgetOptions('深圳', '饭局');

    h.state.rows = [{ budgetCategories: [DINING_3] }];
    invalidateBudgetOptionsCache('深圳');
    const refreshed = await resolveBudgetOptions('深圳', '饭局');

    expect(h.state.selectCalls).toBe(2);
    expect(refreshed.find((o) => o.id === DINING_3)?.coverage).toBe('sparse');
    expect(refreshed.find((o) => o.id === DINING_2)?.coverage).toBe('none');
  });

  it('caches per city × event type', async () => {
    h.state.rows = [{ budgetCategories: [DINING_2] }];
    await resolveBudgetOptions('深圳', '饭局');

    const hk = await resolveBudgetOptions('香港', '饭局');

    expect(h.state.selectCalls).toBe(2);
    expect(hk.map((o) => o.id)).toEqual(DINING_TIERS.map((t) => t.id));
  });
});

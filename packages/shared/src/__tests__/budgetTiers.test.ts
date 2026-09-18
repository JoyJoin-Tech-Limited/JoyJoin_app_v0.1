import { describe, it, expect } from 'vitest';
import {
  BUDGET_TIERS,
  BUDGET_TIER_BY_ID,
  LEGACY_BUDGET_LABEL_TO_TIER_ID,
  UNMAPPABLE_BLIND_BOX_BUDGET_LABEL,
  formatBudgetTier,
  getOfferedTiers,
  getTiersForEventType,
  isValidTierId,
  normalizeBudgetTierIds,
  type BudgetEventType,
} from '../budgetTiers';

const EVENT_TYPES: BudgetEventType[] = ['饭局', '酒局'];
const NAMESPACE_PREFIX: Record<BudgetEventType, string> = {
  '饭局': 'dining_',
  '酒局': 'drinks_',
};

describe('budgetTiers registry', () => {
  it('frozen registry has exactly the six canonical tiers', () => {
    expect(BUDGET_TIERS).toHaveLength(6);
    expect([...BUDGET_TIER_BY_ID.keys()].sort()).toEqual(
      [
        'dining_150_below',
        'dining_150_200',
        'dining_200_300',
        'dining_300_500',
        'drinks_80_below',
        'drinks_80_150',
      ].sort(),
    );
  });

  it('has unique ids and an id decoupled from its label', () => {
    const ids = BUDGET_TIERS.map((tier) => tier.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(BUDGET_TIER_BY_ID.size).toBe(BUDGET_TIERS.length);
    for (const tier of BUDGET_TIERS) {
      expect(tier.id).not.toBe(tier.label);
    }
  });

  it('has unique labels within each namespace', () => {
    for (const eventType of EVENT_TYPES) {
      const labels = getTiersForEventType(eventType).map((tier) => tier.label);
      expect(labels.length).toBeGreaterThan(0);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it('has strictly increasing order starting at 0 within each namespace', () => {
    for (const eventType of EVENT_TYPES) {
      const orders = getTiersForEventType(eventType).map((tier) => tier.order);
      expect(orders[0]).toBe(0);
      expect(new Set(orders).size).toBe(orders.length);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    }
  });

  it('keeps bounds consistent with order (contiguous ladder, ascending max)', () => {
    for (const eventType of EVENT_TYPES) {
      const tiers = getTiersForEventType(eventType);
      for (const tier of tiers) {
        if (tier.min !== null && tier.max !== null) {
          expect(tier.min).toBeLessThan(tier.max);
        }
      }
      for (let i = 1; i < tiers.length; i += 1) {
        expect(tiers[i].min).not.toBeNull();
        expect(tiers[i - 1].max).not.toBeNull();
        expect(tiers[i].min).toBe(tiers[i - 1].max);
      }
      expect(tiers[0].min).toBeNull();
      expect(tiers[tiers.length - 1].max).not.toBeNull();
    }
  });

  it('keeps namespaces disjoint', () => {
    for (const eventType of EVENT_TYPES) {
      const tiers = getTiersForEventType(eventType);
      for (const tier of tiers) {
        expect(tier.eventType).toBe(eventType);
        expect(tier.id.startsWith(NAMESPACE_PREFIX[eventType])).toBe(true);
      }
    }
    expect(getTiersForEventType('饭局').every((tier) => tier.unit === 'per_person')).toBe(true);
    expect(getTiersForEventType('酒局').every((tier) => tier.unit === 'per_person')).toBe(true);
  });

  it('uses per_person for both ladders and formats drinks tiers with /人 (Q3 amendment)', () => {
    for (const eventType of EVENT_TYPES) {
      expect(getTiersForEventType(eventType).every((tier) => tier.unit === 'per_person')).toBe(
        true,
      );
    }
    expect(formatBudgetTier(BUDGET_TIER_BY_ID.get('drinks_80_150')!)).toBe('80-150/人');
  });
});

describe('formatBudgetTier', () => {
  it('appends /人 for per_person and /杯 for per_drink', () => {
    expect(formatBudgetTier(BUDGET_TIER_BY_ID.get('dining_150_200')!)).toBe('150-200/人');
    expect(formatBudgetTier(BUDGET_TIER_BY_ID.get('dining_150_below')!)).toBe('150以下/人');
    expect(formatBudgetTier(BUDGET_TIER_BY_ID.get('drinks_80_150')!)).toBe('80-150/人');
    expect(formatBudgetTier(BUDGET_TIER_BY_ID.get('drinks_80_below')!)).toBe('80以下/人');
    // `per_drink` stays a valid value for future tiers; no registered tier uses it (Q3 amendment).
    expect(
      formatBudgetTier({ ...BUDGET_TIER_BY_ID.get('drinks_80_150')!, unit: 'per_drink' }),
    ).toBe('80-150/杯');
  });
});

describe('isValidTierId', () => {
  it('accepts registered ids only', () => {
    for (const tier of BUDGET_TIERS) {
      expect(isValidTierId(tier.id)).toBe(true);
    }
    expect(isValidTierId('150以下')).toBe(false);
    expect(isValidTierId('100-200')).toBe(false);
    expect(isValidTierId('drinks_150_200')).toBe(false);
    expect(isValidTierId('')).toBe(false);
  });
});

describe('normalizeBudgetTierIds', () => {
  it('maps every legacy label within the correct namespace', () => {
    expect(
      normalizeBudgetTierIds(['150以下', '150-200', '200-300', '300-500'], { eventType: '饭局' }),
    ).toEqual({
      ids: ['dining_150_below', 'dining_150_200', 'dining_200_300', 'dining_300_500'],
      unknown: [],
    });

    expect(normalizeBudgetTierIds(['80以下', '80-150'], { eventType: '酒局' })).toEqual({
      ids: ['drinks_80_below', 'drinks_80_150'],
      unknown: [],
    });
  });

  it('has a namespaced legacy map whose values are all registered', () => {
    for (const eventType of EVENT_TYPES) {
      for (const [label, id] of Object.entries(LEGACY_BUDGET_LABEL_TO_TIER_ID[eventType])) {
        expect(isValidTierId(id)).toBe(true);
        expect(BUDGET_TIER_BY_ID.get(id)!.eventType).toBe(eventType);
        expect(label).not.toBe(id);
      }
    }
  });

  it('rejects cross-namespace labels instead of coercing', () => {
    expect(normalizeBudgetTierIds(['80以下', '80-150'], { eventType: '饭局' })).toEqual({
      ids: [],
      unknown: ['80以下', '80-150'],
    });
    expect(normalizeBudgetTierIds(['150-200'], { eventType: '酒局' })).toEqual({
      ids: [],
      unknown: ['150-200'],
    });
  });

  it('rejects cross-namespace ids', () => {
    expect(normalizeBudgetTierIds(['dining_150_200'], { eventType: '酒局' })).toEqual({
      ids: [],
      unknown: ['dining_150_200'],
    });
    expect(normalizeBudgetTierIds(['drinks_80_150'], { eventType: '饭局' })).toEqual({
      ids: [],
      unknown: ['drinks_80_150'],
    });
  });

  it('returns the blind-box 100-200 in unknown (decision B3 pending)', () => {
    expect(UNMAPPABLE_BLIND_BOX_BUDGET_LABEL).toBe('100-200');
    for (const eventType of EVENT_TYPES) {
      expect(normalizeBudgetTierIds(['100-200'], { eventType })).toEqual({
        ids: [],
        unknown: ['100-200'],
      });
    }
  });

  it('passes through already-valid ids', () => {
    expect(normalizeBudgetTierIds('dining_200_300', { eventType: '饭局' })).toEqual({
      ids: ['dining_200_300'],
      unknown: [],
    });
  });

  it('dedupes ids and unknown values while preserving first-seen order', () => {
    expect(
      normalizeBudgetTierIds(['150-200', 'dining_150_200', '150-200', 'nope', 'nope'], {
        eventType: '饭局',
      }),
    ).toEqual({
      ids: ['dining_150_200'],
      unknown: ['nope'],
    });
  });

  it('trims whitespace and ignores empty strings', () => {
    expect(normalizeBudgetTierIds([' 150-200 ', '', '   '], { eventType: '饭局' })).toEqual({
      ids: ['dining_150_200'],
      unknown: [],
    });
  });

  it('handles undefined / null / non-array / non-string input safely', () => {
    expect(normalizeBudgetTierIds(undefined, { eventType: '饭局' })).toEqual({ ids: [], unknown: [] });
    expect(normalizeBudgetTierIds(null, { eventType: '饭局' })).toEqual({ ids: [], unknown: [] });
    expect(normalizeBudgetTierIds(42, { eventType: '饭局' })).toEqual({ ids: [], unknown: [] });
    expect(normalizeBudgetTierIds({ bad: true }, { eventType: '饭局' })).toEqual({
      ids: [],
      unknown: [],
    });
    expect(normalizeBudgetTierIds([], { eventType: '饭局' })).toEqual({ ids: [], unknown: [] });
    expect(normalizeBudgetTierIds([1, null, {}, '150-200'], { eventType: '饭局' })).toEqual({
      ids: ['dining_150_200'],
      unknown: [],
    });
  });
});

describe('getOfferedTiers', () => {
  it('intersects the namespace registry with covered ids, preserving order', () => {
    const offered = getOfferedTiers('饭局', [
      '200-300',
      'dining_150_200',
      'unknown',
      'dining_150_below',
    ]);
    expect(offered.map((tier) => tier.id)).toEqual(['dining_150_below', 'dining_150_200']);
  });

  it('ignores cross-namespace covered ids', () => {
    expect(
      getOfferedTiers('酒局', ['dining_150_200', 'drinks_80_150']).map((tier) => tier.id),
    ).toEqual(['drinks_80_150']);
  });

  it('accepts any iterable of ids', () => {
    expect(getOfferedTiers('酒局', new Set(['drinks_80_below'])).map((tier) => tier.id)).toEqual([
      'drinks_80_below',
    ]);
  });

  it('returns an empty list when nothing is covered', () => {
    expect(getOfferedTiers('饭局', [])).toEqual([]);
  });

  it('round-trips the full namespace registry', () => {
    for (const eventType of EVENT_TYPES) {
      const ids = getTiersForEventType(eventType).map((tier) => tier.id);
      expect(getOfferedTiers(eventType, ids).map((tier) => tier.id)).toEqual(ids);
    }
  });
});

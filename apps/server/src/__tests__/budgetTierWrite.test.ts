/**
 * Budget-tier L1 write normalization — regression tests.
 *
 * Covers `normalizeBudgetRangeForWrite` / `resolveBudgetEventType`
 * (apps/server/src/lib/budgetTierWrite.ts) and the real registration payload
 * builder that consumes it.
 *
 * Contract: sprint-contract.budget-cutover-server-20260916.md AC-01/AC-05/OBS-01.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  normalizeBudgetRangeForWrite,
  resolveBudgetEventType,
} from '../lib/budgetTierWrite';
import {
  buildEventPoolRegistrationInsert,
  BudgetTierValidationError,
} from '../lib/eventPoolRegistration';
import { logger } from '../lib/logger';
import { insertEventPoolRegistrationSchema } from '@shared/schema';
import {
  getTiersForEventType,
  LEGACY_BUDGET_LABEL_TO_TIER_ID,
  UNMAPPABLE_BLIND_BOX_BUDGET_LABEL,
} from '@shared/budgetTiers';

/**
 * Capture the typed budget validation error from a builder call. Vitest's
 * toThrowError does not do deep object matching reliably, so assert on the
 * caught instance instead.
 */
function captureBudgetError(fn: () => unknown): BudgetTierValidationError {
  try {
    fn();
  } catch (error) {
    if (error instanceof BudgetTierValidationError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected BudgetTierValidationError to be thrown');
}

describe('normalizeBudgetRangeForWrite', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps dining legacy labels to canonical dining ids', () => {
    expect(normalizeBudgetRangeForWrite(['150以下', '150-200', '200-300', '300-500'], '饭局', 'test')).toEqual([
      'dining_150_below',
      'dining_150_200',
      'dining_200_300',
      'dining_300_500',
    ]);
  });

  it('maps drinks legacy labels to canonical drinks ids', () => {
    expect(normalizeBudgetRangeForWrite(['80以下', '80-150'], '酒局', 'test')).toEqual([
      'drinks_80_below',
      'drinks_80_150',
    ]);
  });

  it('passes canonical ids through and is idempotent', () => {
    const first = normalizeBudgetRangeForWrite(['200-300', '80-150'], '饭局', 'test');
    // 80-150 is not a dining label → unmappable, preserved after the id.
    expect(first).toEqual(['dining_200_300', '80-150']);
    const second = normalizeBudgetRangeForWrite(first, '饭局', 'test');
    expect(second).toEqual(first);
  });

  it('preserves the blind-box vocabulary 100-200 verbatim and logs a warning', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const result = normalizeBudgetRangeForWrite(['100-200'], '饭局', 'test.blindbox');

    expect(result).toEqual(['100-200']); // never guessed, never dropped
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('preserving as-is'),
      expect.objectContaining({
        context: 'test.blindbox',
        eventType: '饭局',
        unknown: ['100-200'],
      }),
    );
  });

  it('treats 150-200 as unmappable in the 酒局 namespace (withheld drinks_150_200)', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const result = normalizeBudgetRangeForWrite(['150-200'], '酒局', 'test.bar');

    expect(result).toEqual(['150-200']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ eventType: '酒局', unknown: ['150-200'] }),
    );
  });

  it('does not warn and returns [] for empty / non-array input', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    expect(normalizeBudgetRangeForWrite([], '饭局', 'test')).toEqual([]);
    expect(normalizeBudgetRangeForWrite(undefined, '饭局', 'test')).toEqual([]);
    expect(normalizeBudgetRangeForWrite(null, '酒局', 'test')).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('resolveBudgetEventType', () => {
  it('defaults non-酒局 values to the 饭局 namespace', () => {
    expect(resolveBudgetEventType('酒局')).toBe('酒局');
    expect(resolveBudgetEventType('饭局')).toBe('饭局');
    expect(resolveBudgetEventType('其他')).toBe('饭局');
    expect(resolveBudgetEventType(undefined)).toBe('饭局');
  });
});

describe('buildEventPoolRegistrationInsert (write boundary)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists canonical ids when the payload carries legacy labels', () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const { values } = buildEventPoolRegistrationInsert({
      poolId: 'pool-1',
      userId: 'user-1',
      payload: { budgetRange: ['200-300'], barBudgetRange: ['80-150'] },
    });

    expect(values.budgetRange).toEqual(['dining_200_300']);
    expect(values.barBudgetRange).toEqual(['drinks_80_150']);
  });

  it('keeps an unmappable blind-box value intact through the builder', () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const { values } = buildEventPoolRegistrationInsert({
      poolId: 'pool-1',
      userId: 'user-1',
      payload: { budgetRange: ['100-200'] },
    });

    expect(values.budgetRange).toEqual(['100-200']);
  });

  it('keeps canonical ids unchanged (idempotent through the builder)', () => {
    const { values } = buildEventPoolRegistrationInsert({
      poolId: 'pool-1',
      userId: 'user-1',
      payload: { budgetRange: ['dining_150_200'], barBudgetRange: ['drinks_80_150'] },
    });

    expect(values.budgetRange).toEqual(['dining_150_200']);
    expect(values.barBudgetRange).toEqual(['drinks_80_150']);
  });
});

/**
 * T6-strict: the registration funnel validates the NORMALIZED value against the
 * registry allow-list. Legacy labels normalize first and pass; the B3-pending
 * blind-box label stays tolerated; any other non-registry value fails closed
 * with INVALID_BUDGET_TIER. No budget literal is hand-written here — ids come
 * from the registry and labels from LEGACY_BUDGET_LABEL_TO_TIER_ID (ratchet).
 */
describe('buildEventPoolRegistrationInsert (T6-strict allow-list)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects a non-registry value with code INVALID_BUDGET_TIER', () => {
    const error = captureBudgetError(() =>
      buildEventPoolRegistrationInsert({
        poolId: 'pool-1',
        userId: 'user-1',
        payload: { budgetRange: ['not-a-registry-tier'] },
      }),
    );

    expect(error.name).toBe('BudgetTierValidationError');
    expect(error.code).toBe('INVALID_BUDGET_TIER');
  });

  it('rejects a tier id used in the wrong event-type namespace', () => {
    const diningId = getTiersForEventType('饭局')[0].id;
    const error = captureBudgetError(() =>
      buildEventPoolRegistrationInsert({
        poolId: 'pool-1',
        userId: 'user-1',
        // A dining id in the drinks-scoped field is not a valid 酒局 value.
        payload: { barBudgetRange: [diningId] },
      }),
    );

    expect(error.code).toBe('INVALID_BUDGET_TIER');
  });

  it('accepts canonical registry ids for both namespaces', () => {
    const diningId = getTiersForEventType('饭局')[0].id;
    const drinksId = getTiersForEventType('酒局')[0].id;
    const { values } = buildEventPoolRegistrationInsert({
      poolId: 'pool-1',
      userId: 'user-1',
      payload: { budgetRange: [diningId], barBudgetRange: [drinksId] },
    });

    expect(values.budgetRange).toEqual([diningId]);
    expect(values.barBudgetRange).toEqual([drinksId]);
  });

  it('maps a legacy label to its id and then accepts it', () => {
    const legacyLabel = Object.keys(LEGACY_BUDGET_LABEL_TO_TIER_ID['饭局'])[0];
    const expectedId = LEGACY_BUDGET_LABEL_TO_TIER_ID['饭局'][legacyLabel];
    const { values } = buildEventPoolRegistrationInsert({
      poolId: 'pool-1',
      userId: 'user-1',
      payload: { budgetRange: [legacyLabel] },
    });

    expect(values.budgetRange).toEqual([expectedId]);
  });

  it('accepts a multi-select budget (no max(1) cap — decision B5)', () => {
    const multi = getTiersForEventType('饭局')
      .slice(0, 2)
      .map((tier) => tier.id);
    const { values } = buildEventPoolRegistrationInsert({
      poolId: 'pool-1',
      userId: 'user-1',
      payload: { budgetRange: multi },
    });

    expect(values.budgetRange).toEqual(multi);
    expect(multi.length).toBeGreaterThan(1);
  });

  it('keeps tolerating the B3-pending blind-box label through the builder', () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const { values } = buildEventPoolRegistrationInsert({
      poolId: 'pool-1',
      userId: 'user-1',
      payload: { budgetRange: [UNMAPPABLE_BLIND_BOX_BUDGET_LABEL] },
    });

    expect(values.budgetRange).toEqual([UNMAPPABLE_BLIND_BOX_BUDGET_LABEL]);
  });

  it('insertEventPoolRegistrationSchema rejects a non-registry budgetRange', () => {
    const result = insertEventPoolRegistrationSchema.safeParse({
      poolId: 'pool-1',
      userId: 'user-1',
      budgetRange: ['not-a-registry-tier'],
    });

    expect(result.success).toBe(false);
  });

  it('insertEventPoolRegistrationSchema accepts canonical registry ids', () => {
    const diningId = getTiersForEventType('饭局')[1].id;
    const result = insertEventPoolRegistrationSchema.safeParse({
      poolId: 'pool-1',
      userId: 'user-1',
      budgetRange: [diningId],
    });

    expect(result.success).toBe(true);
  });
});

export type BudgetUnit = 'per_person' | 'per_drink';

export type BudgetEventType = '饭局' | '酒局';

export interface BudgetTier {
  id: string;
  eventType: BudgetEventType;
  label: string;
  unit: BudgetUnit;
  min: number | null;
  max: number | null;
  order: number;
}

/**
 * Canonical budget-tier registry. `order` is 0 = cheapest and strictly
 * increasing within each event-type namespace.
 *
 * Reserved (intentionally NOT registered yet): `drinks_150_200`
 * (`酒局`, label `150-200`, `per_person`, min 150, max 200, order 2). It is
 * withheld because an included-but-unsupplied tier would be a phantom dead
 * tier. Adding it later is an APPEND: it must keep order 2 and MUST NOT
 * renumber the existing drinks orders.
 */
export const BUDGET_TIERS: readonly BudgetTier[] = [
  {
    id: 'dining_150_below',
    eventType: '饭局',
    label: '150以下',
    unit: 'per_person',
    min: null,
    max: 150,
    order: 0,
  },
  {
    id: 'dining_150_200',
    eventType: '饭局',
    label: '150-200',
    unit: 'per_person',
    min: 150,
    max: 200,
    order: 1,
  },
  {
    id: 'dining_200_300',
    eventType: '饭局',
    label: '200-300',
    unit: 'per_person',
    min: 200,
    max: 300,
    order: 2,
  },
  {
    id: 'dining_300_500',
    eventType: '饭局',
    label: '300-500',
    unit: 'per_person',
    min: 300,
    max: 500,
    order: 3,
  },
  {
    id: 'drinks_80_below',
    eventType: '酒局',
    label: '80以下',
    unit: 'per_person',
    min: null,
    max: 80,
    order: 0,
  },
  {
    id: 'drinks_80_150',
    eventType: '酒局',
    label: '80-150',
    unit: 'per_person',
    min: 80,
    max: 150,
    order: 1,
  },
];

export const BUDGET_TIER_BY_ID: ReadonlyMap<string, BudgetTier> = new Map(
  BUDGET_TIERS.map((tier) => [tier.id, tier]),
);

/**
 * Decision B3 (pending): the blind-box vocabulary `100-200` has no canonical
 * registry counterpart — it straddles `150以下` and `150-200` on the dining
 * ladder. Do not guess a mapping; callers must surface it through `unknown`
 * until B3 is resolved.
 */
export const UNMAPPABLE_BLIND_BOX_BUDGET_LABEL = '100-200';

/**
 * Legacy label → canonical tier id, namespaced by event type. The legacy
 * vocabulary is ambiguous across namespaces (`150-200` is a dining label and
 * also appears on a bar), so lookups MUST be scoped by `eventType`.
 */
export const LEGACY_BUDGET_LABEL_TO_TIER_ID: Readonly<
  Record<BudgetEventType, Readonly<Record<string, string>>>
> = {
  '饭局': {
    '150以下': 'dining_150_below',
    '150-200': 'dining_150_200',
    '200-300': 'dining_200_300',
    '300-500': 'dining_300_500',
  },
  '酒局': {
    '80以下': 'drinks_80_below',
    '80-150': 'drinks_80_150',
  },
};

const BUDGET_UNIT_SUFFIX: Record<BudgetUnit, string> = {
  per_person: '人',
  per_drink: '杯',
};

export function getTiersForEventType(eventType: BudgetEventType): BudgetTier[] {
  return BUDGET_TIERS.filter((tier) => tier.eventType === eventType).sort(
    (a, b) => a.order - b.order,
  );
}

export function isValidTierId(id: string): boolean {
  return BUDGET_TIER_BY_ID.has(id);
}

export function formatBudgetTier(tier: BudgetTier): string {
  return `${tier.label}/${BUDGET_UNIT_SUFFIX[tier.unit]}`;
}

export function getOfferedTiers(
  eventType: BudgetEventType,
  coveredTierIds: Iterable<string>,
): BudgetTier[] {
  const covered = new Set(coveredTierIds);
  return getTiersForEventType(eventType).filter((tier) => covered.has(tier.id));
}

export function normalizeBudgetTierIds(
  raw: unknown,
  context: { eventType: BudgetEventType },
): { ids: string[]; unknown: string[] } {
  const ids: string[] = [];
  const unknown: string[] = [];
  const seenIds = new Set<string>();
  const seenUnknown = new Set<string>();

  const pushId = (id: string): void => {
    if (!seenIds.has(id)) {
      seenIds.add(id);
      ids.push(id);
    }
  };

  const pushUnknown = (value: string): void => {
    if (!seenUnknown.has(value)) {
      seenUnknown.add(value);
      unknown.push(value);
    }
  };

  const candidates = typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw : [];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }

    const value = candidate.trim();
    if (!value) {
      continue;
    }

    if (isValidTierId(value)) {
      const tier = BUDGET_TIER_BY_ID.get(value);
      if (tier && tier.eventType === context.eventType) {
        pushId(value);
      } else {
        pushUnknown(value);
      }
      continue;
    }

    if (value === UNMAPPABLE_BLIND_BOX_BUDGET_LABEL) {
      pushUnknown(value);
      continue;
    }

    const mapped = LEGACY_BUDGET_LABEL_TO_TIER_ID[context.eventType][value];
    if (mapped) {
      pushId(mapped);
      continue;
    }

    pushUnknown(value);
  }

  return { ids, unknown };
}

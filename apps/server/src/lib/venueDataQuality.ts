/**
 * Venue Data Quality Checker
 * 场地数据质量检查模块
 *
 * Runs lightweight validation rules against a list of venue records and
 * produces a structured report suitable for the admin portal.
 *
 * Checks performed per venue:
 *   1. Required fields present: name, venueType, address, city, area.
 *   2. Contact info present: contactPerson or contactPhone.
 *   3. Budget/price range configured: priceRange or budgetCategories non-empty.
 *   4. Atmosphere tags present: tags array non-empty.
 *   5. Commission rate plausible: 1–100 inclusive.
 *   6. Operating hours set.
 *   7. Partner status is not "ended" while isActive is true (inconsistency).
 *
 * Summary:
 *   - Per-venue issue list.
 *   - Aggregate counts: total, passing, warning, failing.
 *   - Duplicate name detection across the venue list.
 */

export interface VenueRecord {
  id: string;
  name?: string | null;
  venueType?: string | null;
  address?: string | null;
  city?: string | null;
  area?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  priceRange?: string | null;
  budgetCategories?: string[] | null;
  tags?: string[] | null;
  commissionRate?: number | null;
  operatingHours?: string | null;
  partnerStatus?: string | null;
  isActive?: boolean | null;
}

export type IssueSeverity = 'error' | 'warning';

export interface VenueIssue {
  field: string;
  message: string;
  severity: IssueSeverity;
}

export interface VenueQualityResult {
  venueId: string;
  venueName: string;
  issues: VenueIssue[];
  /** 'pass' = no errors/warnings, 'warning' = only warnings, 'fail' = has errors */
  quality: 'pass' | 'warning' | 'fail';
}

export interface VenueQualitySummary {
  checkedAt: string;
  total: number;
  passing: number;
  withWarnings: number;
  failing: number;
  /** Venue names (and IDs) that appear more than once in the list. */
  duplicateNames: Array<{ name: string; venueIds: string[] }>;
  results: VenueQualityResult[];
}

/**
 * Normalize raw venue rows from storage/SQL into the camelCased shape expected
 * by the quality rules. Supports both the current schema field names and older
 * route/storage aliases used elsewhere in the codebase.
 */
export function normalizeVenueQualityRecord(
  venue: Record<string, unknown>,
): VenueRecord {
  return {
    ...venue,
    id: String(venue.id ?? ''),
    name: (venue.name as string | null | undefined) ?? null,
    venueType:
      (venue.venueType as string | null | undefined)
      ?? (venue.venue_type as string | null | undefined)
      ?? (venue.type as string | null | undefined)
      ?? null,
    address:
      (venue.address as string | null | undefined)
      ?? (venue.address_cn as string | null | undefined)
      ?? (venue.address_zh as string | null | undefined)
      ?? null,
    city: (venue.city as string | null | undefined) ?? null,
    area:
      (venue.area as string | null | undefined)
      ?? (venue.district as string | null | undefined)
      ?? null,
    contactPerson:
      (venue.contactPerson as string | null | undefined)
      ?? (venue.contact_person as string | null | undefined)
      ?? (venue.contact_name as string | null | undefined)
      ?? (venue.contactName as string | null | undefined)
      ?? null,
    contactPhone:
      (venue.contactPhone as string | null | undefined)
      ?? (venue.contact_phone as string | null | undefined)
      ?? null,
    priceRange:
      (venue.priceRange as string | null | undefined)
      ?? (venue.price_range as string | null | undefined)
      ?? null,
    budgetCategories:
      (venue.budgetCategories as string[] | null | undefined)
      ?? (venue.budget_categories as string[] | null | undefined)
      ?? null,
    tags: (venue.tags as string[] | null | undefined) ?? null,
    commissionRate:
      (venue.commissionRate as number | null | undefined)
      ?? (venue.commission_rate as number | null | undefined)
      ?? null,
    operatingHours:
      (venue.operatingHours as string | null | undefined)
      ?? (venue.operating_hours as string | null | undefined)
      ?? null,
    partnerStatus:
      (venue.partnerStatus as string | null | undefined)
      ?? (venue.partner_status as string | null | undefined)
      ?? null,
    isActive:
      (venue.isActive as boolean | null | undefined)
      ?? (venue.is_active as boolean | null | undefined)
      ?? null,
  };
}

// ── Rule definitions ──────────────────────────────────────────────────────

interface Rule {
  field: string;
  severity: IssueSeverity;
  message: string;
  check: (v: VenueRecord) => boolean;
}

const RULES: Rule[] = [
  {
    field: 'name',
    severity: 'error',
    message: 'Missing required field: name',
    check: (v) => Boolean(v.name?.trim()),
  },
  {
    field: 'venueType',
    severity: 'error',
    message: 'Missing required field: venueType',
    check: (v) => Boolean(v.venueType?.trim()),
  },
  {
    field: 'address',
    severity: 'error',
    message: 'Missing required field: address',
    check: (v) => Boolean(v.address?.trim()),
  },
  {
    field: 'city',
    severity: 'error',
    message: 'Missing required field: city',
    check: (v) => Boolean(v.city?.trim()),
  },
  {
    field: 'area',
    severity: 'error',
    message: 'Missing required field: area',
    check: (v) => Boolean(v.area?.trim()),
  },
  {
    field: 'contact',
    severity: 'warning',
    message: 'No contact information (contactPerson or contactPhone)',
    check: (v) => Boolean(v.contactPerson?.trim() || v.contactPhone?.trim()),
  },
  {
    field: 'priceRange',
    severity: 'warning',
    message: 'No price range configured (priceRange or budgetCategories)',
    check: (v) =>
      Boolean(v.priceRange?.trim()) ||
      (Array.isArray(v.budgetCategories) && v.budgetCategories.length > 0),
  },
  {
    field: 'tags',
    severity: 'warning',
    message: 'No atmosphere tags configured',
    check: (v) => Array.isArray(v.tags) && v.tags.length > 0,
  },
  {
    field: 'commissionRate',
    severity: 'error',
    message: 'Commission rate must be between 1 and 100',
    check: (v) => {
      const rate = v.commissionRate;
      if (rate == null) return true; // treated as "not set" — not a hard error
      return rate >= 1 && rate <= 100;
    },
  },
  {
    field: 'operatingHours',
    severity: 'warning',
    message: 'Operating hours not set',
    check: (v) => Boolean(v.operatingHours?.trim()),
  },
  {
    field: 'partnerStatus',
    severity: 'warning',
    message: 'Partner status is "ended" but venue is still marked active',
    check: (v) => !(v.partnerStatus === 'ended' && v.isActive === true),
  },
];

// ── Core function ─────────────────────────────────────────────────────────

/**
 * Run all quality rules against the provided venue records and return a
 * structured summary.
 *
 * @param venues Array of venue objects (any superset of `VenueRecord` works).
 */
export function checkVenueDataQuality(venues: VenueRecord[]): VenueQualitySummary {
  const results: VenueQualityResult[] = venues.map((venue) => {
    const issues: VenueIssue[] = RULES
      .filter((rule) => !rule.check(venue))
      .map((rule) => ({ field: rule.field, message: rule.message, severity: rule.severity }));

    let quality: VenueQualityResult['quality'];
    if (issues.some((i) => i.severity === 'error')) {
      quality = 'fail';
    } else if (issues.length > 0) {
      quality = 'warning';
    } else {
      quality = 'pass';
    }

    return {
      venueId: venue.id,
      venueName: venue.name ?? '(unnamed)',
      issues,
      quality,
    };
  });

  // Duplicate name detection
  const nameCounts = new Map<string, string[]>();
  for (const venue of venues) {
    const key = (venue.name ?? '').trim().toLowerCase();
    if (!key) continue;
    if (!nameCounts.has(key)) nameCounts.set(key, []);
    nameCounts.get(key)!.push(venue.id);
  }
  const duplicateNames = Array.from(nameCounts.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([name, venueIds]) => ({ name, venueIds }));

  const total = results.length;
  const passing = results.filter((r) => r.quality === 'pass').length;
  const withWarnings = results.filter((r) => r.quality === 'warning').length;
  const failing = results.filter((r) => r.quality === 'fail').length;

  return {
    checkedAt: new Date().toISOString(),
    total,
    passing,
    withWarnings,
    failing,
    duplicateNames,
    results,
  };
}

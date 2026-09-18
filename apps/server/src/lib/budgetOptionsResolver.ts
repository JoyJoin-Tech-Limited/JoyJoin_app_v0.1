/**
 * City-level budget-options resolver (T7 budget-tier workstream / spec §5).
 *
 * Given `city × eventType`, return the canonical registry tiers for that event
 * type annotated with venue **coverage** — never filtered, so a tier with no
 * supply still survives as a demand signal for 招商.
 *
 * Boundaries:
 *   - Catalog-level only. Availability (time slots) stays in the assignment
 *     layer — this module must NOT join `venue_time_slots` (decision Q5b).
 *   - Coverage is scoped to the SAME eligibility predicate the assignment
 *     layer uses (`lib/venueEligibility.ts`), so "covered" means "assignable
 *     here", not a looser marketing claim.
 *   - Fail-open: any error or empty result returns the full registry for the
 *     event type. Registration must never be blocked or emptied (§5).
 *   - Annotate, never hide: `available | sparse | none` per tier.
 *
 * Caching: reuses the repo's in-memory `matchingCache` (500-entry cap) keyed by
 * `budgetOptions:<city>:<eventType>` with a short TTL. There is no venue-catalog
 * mutation hook today, so a catalog edit can be stale for up to the TTL;
 * `invalidateBudgetOptionsCache()` is exported for a future hook and TTL is
 * deliberately short (5 min) to bound staleness.
 */

import { getTiersForEventType, normalizeBudgetTierIds } from "@shared/budgetTiers";
import type { BudgetEventType, BudgetTier } from "@shared/budgetTiers";
import { venues } from "@shared/schema";
import { db } from "../db";
import { matchingCache } from "../matchingCache";
import { logger } from "./logger";
import { buildEligibleVenueConditions, toBudgetEventType } from "./venueEligibility";

export type BudgetTierCoverage = "available" | "sparse" | "none";

export interface BudgetOption {
  id: string;
  label: string;
  unit: BudgetTier["unit"];
  min: number | null;
  max: number | null;
  order: number;
  /** Coverage annotation — the tier is always present regardless of value. */
  coverage: BudgetTierCoverage;
  /** Number of eligible venues in the city offering this tier (diagnostic). */
  venueCount: number;
}

/** 0 venues → none; 1 → sparse; ≥2 → available. */
export const SPARSE_COVERAGE_MAX_VENUES = 1;

/** Short TTL bounding venue-catalog staleness (no mutation hook exists). */
export const BUDGET_OPTIONS_CACHE_TTL_MS = 5 * 60 * 1000;

const CACHE_KEY_PREFIX = "budgetOptions";

export function budgetOptionsCacheKey(city: string, eventType: string): string {
  return `${CACHE_KEY_PREFIX}:${city}:${eventType}`;
}

/**
 * Invalidate cached budget options. Called with a city to scope to that city,
 * or with no argument to clear all cities. Safe to call from an admin venue
 * mutation hook if one is added later.
 */
export function invalidateBudgetOptionsCache(city?: string): number {
  return matchingCache.invalidate(
    city ? `${CACHE_KEY_PREFIX}:${city}:` : `${CACHE_KEY_PREFIX}:`,
  );
}

function coverageFor(venueCount: number): BudgetTierCoverage {
  if (venueCount <= 0) return "none";
  if (venueCount <= SPARSE_COVERAGE_MAX_VENUES) return "sparse";
  return "available";
}

function annotate(tiers: BudgetTier[], counts: Map<string, number>): BudgetOption[] {
  return tiers.map((tier) => {
    const venueCount = counts.get(tier.id) ?? 0;
    return { ...tier, coverage: coverageFor(venueCount), venueCount };
  });
}

/** Full registry for the event type with zero coverage — the fail-open shape. */
function fullRegistry(budgetEventType: BudgetEventType): BudgetOption[] {
  return annotate(getTiersForEventType(budgetEventType), new Map());
}

/**
 * Resolve budget options for a city × event type. Always resolves (never
 * throws); on failure returns the full registry.
 */
export async function resolveBudgetOptions(
  city: string,
  eventType: string,
): Promise<BudgetOption[]> {
  const budgetEventType = toBudgetEventType(eventType);
  const cacheKey = budgetOptionsCacheKey(city, eventType);

  const cached = matchingCache.get<BudgetOption[]>(cacheKey);
  if (cached) {
    return cached;
  }

  let options: BudgetOption[];
  try {
    if (!city || typeof city !== "string") {
      // No city to scope supply — full registry annotated with zero coverage.
      options = fullRegistry(budgetEventType);
    } else {
      // Single aggregate read over eligible venues — no per-tier/per-venue N+1.
      const rows = await db
        .select({ budgetCategories: venues.budgetCategories })
        .from(venues)
        .where(buildEligibleVenueConditions(city, null, eventType));

      const counts = new Map<string, number>();
      for (const row of rows) {
        const ids = new Set(
          normalizeBudgetTierIds(row.budgetCategories ?? [], { eventType: budgetEventType }).ids,
        );
        for (const id of ids) {
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      }

      // Annotate, never hide — every registry tier for the event type returns.
      options = annotate(getTiersForEventType(budgetEventType), counts);
    }
  } catch (error) {
    logger.warn("[BudgetOptionsResolver] Coverage query failed; falling back to full registry", {
      city,
      eventType,
      error: String(error),
    });
    options = fullRegistry(budgetEventType);
  }

  matchingCache.set(cacheKey, options, BUDGET_OPTIONS_CACHE_TTL_MS);
  return options;
}

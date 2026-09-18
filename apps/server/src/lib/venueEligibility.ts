/**
 * Venue eligibility — single source of the "is this venue assignable?"
 * predicate (T7 budget-tier workstream).
 *
 * This predicate previously lived inline in `assignVenuesToGroups`. It is
 * extracted here so the city-level budget-options resolver
 * (`lib/budgetOptionsResolver.ts`) scopes coverage to exactly the same venue
 * set the assignment layer would consider, rather than duplicating a looser
 * copy (spec §5 "覆盖 = 与派场同一有效性判定").
 *
 * Scope note: this is catalog eligibility only. Time-slot availability stays
 * in the assignment layer (`checkTimeSlotAvailability`) — the resolver is a
 * city-level catalog query and must NOT join `venue_time_slots` (decision
 * Q5b).
 */

import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { venues } from "@shared/schema";
import type { BudgetEventType } from "@shared/budgetTiers";

/**
 * Resolve the budget-tier registry namespace for an event type. Only 酒局 is a
 * distinct namespace today; everything else (including the pool `其他` value)
 * is treated as the 饭局 dining namespace. Also drives the allowed venue-type
 * set below, so the two mappings can never drift apart.
 */
export function toBudgetEventType(eventType: string): BudgetEventType {
  return eventType === "酒局" ? "酒局" : "饭局";
}

/**
 * Allowed venue types per budget namespace. 饭局 → restaurant/cafe;
 * 酒局 → bar/homebar.
 */
export const ALLOWED_VENUE_TYPES_BY_EVENT: Readonly<
  Record<BudgetEventType, readonly string[]>
> = {
  饭局: ["restaurant", "cafe"],
  酒局: ["bar", "homebar"],
};

export function getAllowedVenueTypes(eventType: string): string[] {
  return [...ALLOWED_VENUE_TYPES_BY_EVENT[toBudgetEventType(eventType)]];
}

/**
 * Build the Drizzle condition for "venues eligible for assignment in this
 * city (and optional district) for this event type":
 *   isActive ∧ onboardingStatus='active' ∧ partnerStatus='active'
 *   ∧ (contractEndDate IS NULL OR contractEndDate >= today)
 *   ∧ venueType ∈ allowed(eventType)
 *
 * When `district` is null the district clause is omitted (city-wide), matching
 * the previous inline behaviour for pools without a district.
 */
export function buildEligibleVenueConditions(
  city: string,
  district: string | null,
  eventType: string,
): SQL | undefined {
  const allowedVenueTypes = getAllowedVenueTypes(eventType);

  const conditions = [
    eq(venues.city, city),
    ...(district ? [eq(venues.area, district)] : []),
    eq(venues.isActive, true),
    eq(venues.onboardingStatus, "active"),
    eq(venues.partnerStatus, "active"),
    sql`${venues.contractEndDate} IS NULL OR ${venues.contractEndDate} >= CURRENT_DATE`,
    inArray(venues.venueType, allowedVenueTypes),
  ];

  return and(...conditions);
}

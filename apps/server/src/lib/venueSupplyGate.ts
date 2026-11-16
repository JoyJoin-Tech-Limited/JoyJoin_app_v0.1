import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { venues } from "@shared/schema";
import { buildEligibleVenueConditions } from "./venueEligibility";
import { checkTimeSlotAvailability } from "../venueAssignmentService";
import { getFeatureFlag } from "./featureFlags";
import { logger } from "./logger";

/**
 * D5 (2026-11-11): a pool may only be listed when the venue catalog can actually
 * seat the tables it promises.
 *
 * Rationale: the 100-user simulation and the 24h venue promise both show the same
 * failure mode from opposite sides. A pool can collect registrations, match, and
 * then discover at T-24h that no eligible venue exists — the pool is cancelled and
 * every paid registration refunded. The cheapest fix is upstream: refuse to open a
 * pool the catalog cannot serve, and tell operations exactly how far short it is.
 *
 * The gate is deliberately narrow:
 * - It counts *venues*, not bookings. A venue with one table's worth of headroom
 *   still counts once it is eligible and has a slot covering the start time.
 * - Budget alignment is NOT a condition. `budgetAdjacencyEnabled` relaxes budgets
 *   at assignment time, so blocking a pool on strict budget overlap would reject
 *   pools that would otherwise be served.
 * - Missing inputs (no city / no start time) never block; the guard must not
 *   become a new way to fail a legitimate request.
 */

export const VENUE_SUPPLY_GATE_FLAG = "venueSupplyGateEnabled";

export interface VenueSupplyGateInput {
  city: string | null | undefined;
  district: string | null | undefined;
  eventType: string | null | undefined;
  dateTime: Date | null | undefined;
  maxGroupSize: number | null | undefined;
  targetGroups: number | null | undefined;
}

export interface VenueSupplyGateResult {
  allowed: boolean;
  /** How many tables the pool promised. */
  requiredGroups: number;
  /** How many distinct venues could serve one of those tables. */
  serviceableVenues: number;
  /** Operator-facing explanation; absent when the pool passes. */
  reason?: string;
  /** True when the gate could not evaluate the inputs and let the pool through. */
  skipped: boolean;
}

function describeShortfall(
  requiredGroups: number,
  serviceableVenues: number,
  city: string,
  district: string | null | undefined,
  eventType: string,
): string {
  const place = district ? `${city} ${district}` : city;
  if (serviceableVenues === 0) {
    return `${place}当前没有可承接${eventType}的场地，暂不能上架；请先补充该区供给`;
  }
  return `${place}该时段只有 ${serviceableVenues} 家可承接 ${requiredGroups} 桌${eventType}的场地（需要 ${requiredGroups} 家），暂不能上架；请先补充供给`;
}

/**
 * Pure-ish evaluator: reads the catalog, never writes. Exported for tests.
 */
export async function evaluateVenueSupplyGate(
  input: VenueSupplyGateInput,
): Promise<VenueSupplyGateResult> {
  const requiredGroups = Math.max(1, input.targetGroups ?? 1);
  const city = typeof input.city === "string" ? input.city.trim() : "";
  const eventType = typeof input.eventType === "string" ? input.eventType.trim() : "";
  const dateTime = input.dateTime instanceof Date ? input.dateTime : null;
  const maxGroupSize = Math.max(1, input.maxGroupSize ?? 6);

  if (!city || !eventType || !dateTime) {
    return { allowed: true, requiredGroups, serviceableVenues: 0, skipped: true };
  }

  const conditions = buildEligibleVenueConditions(
    city,
    input.district?.trim() ? input.district.trim() : null,
    eventType,
  );

  // `seating_capacity` is nullable in the catalog; COALESCE keeps a missing value
  // from silently passing a capacity check it never satisfied.
  const candidates = await db
    .select({ id: venues.id, seatingCapacity: venues.seatingCapacity })
    .from(venues)
    .where(
      and(
        conditions,
        gte(sql`COALESCE(${venues.seatingCapacity}, 0)`, sql`${maxGroupSize}`),
        eq(venues.isActive, true),
      ),
    );

  let serviceableVenues = 0;
  for (const candidate of candidates) {
    try {
      const slot = await checkTimeSlotAvailability(candidate.id, dateTime);
      if (slot) serviceableVenues += 1;
    } catch (error) {
      // A slot lookup failure must not reject the pool; treat it as unknown.
      logger.warn("[VenueSupplyGate] slot lookup failed; treating venue as unknown", {
        venue_id: candidate.id,
        error: String(error),
      });
    }
  }

  if (serviceableVenues >= requiredGroups) {
    return { allowed: true, requiredGroups, serviceableVenues, skipped: false };
  }

  return {
    allowed: false,
    requiredGroups,
    serviceableVenues,
    skipped: false,
    reason: describeShortfall(
      requiredGroups,
      serviceableVenues,
      city,
      input.district,
      eventType,
    ),
  };
}

/**
 * Route-facing wrapper: applies the kill switch and fails open, because a supply
 * guard that throws would block every pool creation.
 */
export async function assertVenueSupply(
  input: VenueSupplyGateInput,
): Promise<VenueSupplyGateResult> {
  const enabled = await getFeatureFlag(VENUE_SUPPLY_GATE_FLAG, true);
  if (!enabled) {
    return { allowed: true, requiredGroups: 1, serviceableVenues: 0, skipped: true };
  }

  try {
    return await evaluateVenueSupplyGate(input);
  } catch (error) {
    logger.error("[VenueSupplyGate] evaluation failed; allowing pool", {
      error: String(error),
      city: input.city,
      district: input.district,
    });
    return { allowed: true, requiredGroups: 1, serviceableVenues: 0, skipped: true };
  }
}

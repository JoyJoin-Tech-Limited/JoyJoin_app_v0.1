/**
 * Venue Assignment Service
 * 
 * Automatically assigns optimal venues to matched event pool groups
 * based on budget, cuisine preferences, availability, and capacity.
 */

import { db } from "./db";
import { venues, venueTimeSlots, venueTimeSlotBookings, eventPoolGroups } from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { logger } from "./lib/logger";
import { notifyVenueUnassigned } from "./lib/wecomNotifier";
import { parseEventDate } from "./lib/eventDateTime";
import {
  BUDGET_TIER_BY_ID,
  normalizeBudgetTierIds,
  type BudgetEventType,
  type BudgetTier,
} from "@shared/budgetTiers";
import { observeVenueAssignmentRun } from "./matchingMetrics";
import { getFeatureFlag, getFeatureFlagSync } from "./lib/featureFlags";
import { buildEligibleVenueConditions, toBudgetEventType } from "./lib/venueEligibility";
import type { UserWithProfile, MatchGroup } from "./poolMatchingService";

interface VenueScore {
  venue: any;
  score: number;
  reasons: string[];
  timeSlotId: string;
}

interface VenueWithSlot {
  venue: typeof venues.$inferSelect;
  timeSlot: typeof venueTimeSlots.$inferSelect;
}

/**
 * Parse an event Date into business-local (UTC+8) date, time and weekday components.
 *
 * Storage convention: `event_pools.date_time` / `blind_box_events.date_time` are
 * `timestamp without time zone` and hold a **true UTC instant** (Drizzle writes
 * `value.toISOString()`). Business-local fields are derived by shifting +8h — never
 * from the raw stored substrings, and never from the host's ambient timezone.
 *
 * Implemented in `lib/eventDateTime.ts` and re-exported here to preserve this module's
 * public surface for `routes/domains/venues.ts` and `services/matchingTestService.ts`.
 */
export { parseEventDate };

/**
 * Normalize a raw budget value list (legacy label OR canonical tier id) to the
 * canonical ids for an event-type namespace.
 *
 * Read-path safety net for the vocabulary cutover: the venue side and the
 * group-consensus side may be on opposite conventions while the data migration
 * rolls out (mixed state). Comparing after this normalization makes the
 * migration order non-dangerous. Unmappable values are dropped here (the read
 * path has no way to act on them); the write path preserves+logs them instead.
 */
function normalizeTierIdsForComparison(
  values: string[] | null | undefined,
  eventType: string,
): string[] {
  return normalizeBudgetTierIds(values ?? [], { eventType: toBudgetEventType(eventType) }).ids;
}

/**
 * Budget-match outcome under the T7 degradation policy.
 *
 * Resolved ambiguity (sprint contract §6): the spec's gradient prose mentions
 * `±2 → 8`, but confirmed decision B4 caps placement at ONE tier away. These
 * two cannot both hold — a distance-2 venue scored 8 would still be placeable.
 * This implementation resolves toward B4: distance ≥ 2 is `out_of_policy` and
 * is NOT placeable in either pass. The `±2 → 8` band is deliberately not
 * implemented. This matches the spec §6 residual note (an order-0 group whose
 * only candidate sits two orders away still ends up 地点待定).
 */
export type BudgetMatchOutcome =
  | "exact" // distance 0 → 40 pts
  | "adjacent" // distance 1 → 20 pts (disclosed as `budget_adjacent`)
  | "out_of_policy" // distance ≥ 2 → excluded (B4 one-tier cap)
  | "unknown" // venue has no recognizable tier — strict pass rejects, relaxed pass treats as preference
  | "none"; // group set no budget — neutral, never a gate

export interface BudgetMatchEvaluation {
  points: number;
  outcome: BudgetMatchOutcome;
  /** false ⇒ the caller must reject the venue (score 0). */
  placeable: boolean;
  /** Human-readable reason; always non-empty. */
  reason: string;
  /** Venue tier ids at the minimum distance (used for disclosure). */
  matchedTierIds: string[];
}

/**
 * Pure budget evaluation for one venue × group, parameterised by pass.
 *
 * Caller passes already-normalized canonical tier ids (group side via
 * `calculateGroupBudget`, venue side via `normalizeTierIdsForComparison`), so
 * the legacy-label mixed state is handled before this point.
 *
 * `strictPass` (pass 1) rejects an untagged venue; the relaxed pass (pass 2)
 * demotes that undecidable case to a 0-point preference so a group is never
 * left unassigned solely because a venue lacks budget tags. The ≥2-tier cap is
 * enforced in BOTH passes.
 */
export function evaluateBudgetMatch(
  venueBudgets: string[],
  groupBudget: string[],
  eventType: string,
  strictPass: boolean,
): BudgetMatchEvaluation {
  const namespace = toBudgetEventType(eventType);

  // No group consensus → neutral. The legacy flat +40 is deliberately gone:
  // budget contributes nothing and is not a gate, so it cannot inflate or
  // block placement. (Rank-neutral within the group.)
  if (groupBudget.length === 0) {
    return {
      points: 0,
      outcome: "none",
      placeable: true,
      reason: "未设置预算限制，所有价位均可接受",
      matchedTierIds: [],
    };
  }

  const venueTiers = venueBudgets
    .map((id) => BUDGET_TIER_BY_ID.get(id))
    .filter((tier): tier is BudgetTier => tier !== undefined && tier.eventType === namespace);

  if (venueTiers.length === 0) {
    return {
      points: 0,
      outcome: "unknown",
      placeable: !strictPass,
      reason: strictPass ? "场地未标注预算" : "场地未标注预算，按偏好处理",
      matchedTierIds: [],
    };
  }

  const groupTiers = groupBudget
    .map((id) => BUDGET_TIER_BY_ID.get(id))
    .filter((tier): tier is BudgetTier => tier !== undefined && tier.eventType === namespace);

  if (groupTiers.length === 0) {
    return {
      points: 0,
      outcome: "unknown",
      placeable: !strictPass,
      reason: strictPass ? "场地未标注预算" : "场地未标注预算，按偏好处理",
      matchedTierIds: [],
    };
  }

  let minDistance = Number.POSITIVE_INFINITY;
  const matchedTierIds: string[] = [];
  for (const venueTier of venueTiers) {
    for (const groupTier of groupTiers) {
      const distance = Math.abs(venueTier.order - groupTier.order);
      if (distance < minDistance) {
        minDistance = distance;
        matchedTierIds.length = 0;
        matchedTierIds.push(venueTier.id);
      } else if (distance === minDistance) {
        matchedTierIds.push(venueTier.id);
      }
    }
  }

  if (minDistance === 0) {
    return {
      points: 40,
      outcome: "exact",
      placeable: true,
      reason: `预算匹配 (${matchedTierIds.join(", ")})`,
      matchedTierIds,
    };
  }

  if (minDistance === 1) {
    const actualLabels = matchedTierIds
      .map((id) => BUDGET_TIER_BY_ID.get(id)?.label ?? id)
      .join("、");
    const consensusLabels = groupTiers.map((tier) => tier.label).join("、");
    return {
      points: 20,
      outcome: "adjacent",
      placeable: true,
      // Machine code + actual tier disclosure, per spec §6.4.
      reason: `预算就近安排 (budget_adjacent: 实际 ${actualLabels} / 共识 ${consensusLabels})`,
      matchedTierIds,
    };
  }

  // B4: two or more tiers away is never a silent over-placement.
  return {
    points: 0,
    outcome: "out_of_policy",
    placeable: false,
    reason: "预算不匹配 (超出一档容差)",
    matchedTierIds,
  };
}

/**
 * Calculate group's budget consensus
 * Returns array of budget ranges supported by at least 30% of group
 */
export function calculateGroupBudget(members: UserWithProfile[], eventType: string): string[] {
  const budgetCounts = new Map<string, number>();
  
  for (const member of members) {
    const rawBudgets = eventType === "酒局" 
      ? (member.barBudgetRange || [])
      : (member.budgetRange || []);
    const budgets = normalizeTierIdsForComparison(rawBudgets, eventType);
    
    for (const budget of budgets) {
      budgetCounts.set(budget, (budgetCounts.get(budget) || 0) + 1);
    }
  }
  
  // Return budgets supported by at least 30% of group (lower threshold for flexibility)
  const threshold = Math.ceil(members.length * 0.3);
  const consensusBudgets: string[] = [];
  
  for (const [budget, count] of budgetCounts.entries()) {
    if (count >= threshold) {
      consensusBudgets.push(budget);
    }
  }
  
  return consensusBudgets.length > 0 ? consensusBudgets : [];
}

/**
 * Calculate cuisine preference overlap between group and venue
 */
function calculateCuisineMatch(
  members: UserWithProfile[], 
  venueCuisines: string[] | null
): number {
  if (!venueCuisines || venueCuisines.length === 0) {
    return 50; // Neutral score for venues without cuisine tags
  }
  
  const groupCuisinePrefs = new Map<string, number>();
  
  for (const member of members) {
    const prefs = member.cuisinePreferences || [];
    for (const cuisine of prefs) {
      groupCuisinePrefs.set(cuisine, (groupCuisinePrefs.get(cuisine) || 0) + 1);
    }
  }
  
  if (groupCuisinePrefs.size === 0) {
    return 50; // Neutral if group has no preferences
  }
  
  // Calculate overlap score - normalized by total member count
  let matchCount = 0;
  for (const venueCuisine of venueCuisines) {
    if (groupCuisinePrefs.has(venueCuisine)) {
      matchCount += groupCuisinePrefs.get(venueCuisine)!;
    }
  }
  
  // Normalize by member count to get percentage of members satisfied
  // This prevents easy saturation and reflects actual overlap
  return Math.min(100, Math.round((matchCount / members.length) * 100));
}

/**
 * Check if venue has available time slot at event time,
 * respecting maxConcurrentEvents and existing bookings.
 * Returns the available time slot record, or null if fully booked.
 */
export async function checkTimeSlotAvailability(
  venueId: string,
  eventDateTime: Date
): Promise<typeof venueTimeSlots.$inferSelect | null> {
  const { dateStr, timeStr, dayOfWeek } = parseEventDate(eventDateTime);
  
  // Check for weekly recurring slots
  const weeklySlots = await db
    .select()
    .from(venueTimeSlots)
    .where(and(
      eq(venueTimeSlots.venueId, venueId),
      eq(venueTimeSlots.dayOfWeek, dayOfWeek),
      eq(venueTimeSlots.isActive, true),
      sql`${venueTimeSlots.startTime} <= ${timeStr}`,
      sql`${venueTimeSlots.endTime} >= ${timeStr}`
    ));
  
  // Check for specific date slots - compare as date type
  const specificSlots = await db
    .select()
    .from(venueTimeSlots)
    .where(and(
      eq(venueTimeSlots.venueId, venueId),
      sql`${venueTimeSlots.specificDate} = ${dateStr}::date`,
      eq(venueTimeSlots.isActive, true),
      sql`${venueTimeSlots.startTime} <= ${timeStr}`,
      sql`${venueTimeSlots.endTime} >= ${timeStr}`
    ));
  
  const allSlots = [...weeklySlots, ...specificSlots];
  
  if (allSlots.length === 0) {
    return null;
  }
  
  // Batch query booking counts for all matching slots to avoid N+1
  const slotIds = allSlots.map(s => s.id);
  const bookingCounts = slotIds.length > 0
    ? await db
        .select({
          timeSlotId: venueTimeSlotBookings.timeSlotId,
          count: sql<number>`count(*)`,
        })
        .from(venueTimeSlotBookings)
        .where(and(
          inArray(venueTimeSlotBookings.timeSlotId, slotIds),
          sql`${venueTimeSlotBookings.bookingDate} = ${dateStr}::date`,
          eq(venueTimeSlotBookings.status, 'confirmed')
        ))
        .groupBy(venueTimeSlotBookings.timeSlotId)
    : [];
  
  const countMap = new Map(bookingCounts.map((b: { timeSlotId: string; count: number }) => [b.timeSlotId, b.count]));
  
  for (const slot of allSlots) {
    const bookingCount = countMap.get(slot.id) ?? 0;
    const maxConcurrent = slot.maxConcurrentEvents ?? 1;
    
    if (bookingCount < maxConcurrent) {
      return slot; // This slot has capacity
    }
  }
  
  return null; // All matching slots are fully booked
}

export interface AvailableSlotInfo {
  slot: typeof venueTimeSlots.$inferSelect;
  remainingCapacity: number;
}

/**
 * Return all available time slots for a venue at event time,
 * each with remaining capacity. Used by admin manual-assignment fallback.
 */
export async function getAvailableTimeSlotsForVenue(
  venueId: string,
  eventDateTime: Date
): Promise<AvailableSlotInfo[]> {
  const { dateStr, timeStr, dayOfWeek } = parseEventDate(eventDateTime);

  const weeklySlots = await db
    .select()
    .from(venueTimeSlots)
    .where(and(
      eq(venueTimeSlots.venueId, venueId),
      eq(venueTimeSlots.dayOfWeek, dayOfWeek),
      eq(venueTimeSlots.isActive, true),
      sql`${venueTimeSlots.startTime} <= ${timeStr}`,
      sql`${venueTimeSlots.endTime} >= ${timeStr}`
    ));

  const specificSlots = await db
    .select()
    .from(venueTimeSlots)
    .where(and(
      eq(venueTimeSlots.venueId, venueId),
      sql`${venueTimeSlots.specificDate} = ${dateStr}::date`,
      eq(venueTimeSlots.isActive, true),
      sql`${venueTimeSlots.startTime} <= ${timeStr}`,
      sql`${venueTimeSlots.endTime} >= ${timeStr}`
    ));

  const allSlots = [...weeklySlots, ...specificSlots];
  if (allSlots.length === 0) return [];

  const slotIds = allSlots.map(s => s.id);
  const bookingCounts = await db
    .select({
      timeSlotId: venueTimeSlotBookings.timeSlotId,
      count: sql<number>`count(*)`,
    })
    .from(venueTimeSlotBookings)
    .where(and(
      inArray(venueTimeSlotBookings.timeSlotId, slotIds),
      sql`${venueTimeSlotBookings.bookingDate} = ${dateStr}::date`,
      eq(venueTimeSlotBookings.status, 'confirmed')
    ))
    .groupBy(venueTimeSlotBookings.timeSlotId);

  const countMap = new Map(bookingCounts.map((b: { timeSlotId: string; count: number }) => [b.timeSlotId, b.count]));

  return allSlots
    .map((slot) => {
      const bookingCount = Number(countMap.get(slot.id) ?? 0);
      const maxConcurrent = Number(slot.maxConcurrentEvents ?? 1);
      const remainingCapacity = maxConcurrent - bookingCount;
      return { slot, remainingCapacity };
    })
    .filter(({ remainingCapacity }) => remainingCapacity > 0);
}

export interface VenueScoreOptions {
  /**
   * T7 degradation switch. When omitted, resolved from the
   * `budgetAdjacencyEnabled` feature flag (env-only sync read, so direct
   * callers stay DB-free). `assignVenuesToGroups` resolves the DB-backed flag
   * once per run and passes it explicitly.
   */
  adjacencyEnabled?: boolean;
  /** true = pass 1 (strict), false = pass 2 (budget demoted to preference). */
  strictPass?: boolean;
}

/**
 * Score venue suitability for group (0-100)
 *
 * Exported for the read-normalization regression tests (the previous suite
 * re-implemented this logic inline, which is the false-negative called out in
 * spec §2 B-NEW-2 / AC-9).
 */
export async function scoreVenueForGroup(
  venue: typeof venues.$inferSelect,
  group: MatchGroup,
  eventDateTime: Date,
  eventType: string,
  groupBudget: string[],
  options: VenueScoreOptions = {},
): Promise<Omit<VenueScore, 'timeSlotId'>> {
  let score = 0;
  const reasons: string[] = [];

  // 0. Capacity Hard Constraint — reject venues that cannot physically fit the group
  const groupSize = group.members.length;
  const seatingCapacity = venue.seatingCapacity ?? venue.capacity ?? 0;
  if (seatingCapacity > 0 && seatingCapacity < groupSize) {
    return { venue, score: 0, reasons: [`容量不足 (仅可容纳${seatingCapacity}人，需要${groupSize}人)`] };
  }

  // 1. Budget Match (40 points)
  // Normalize the venue side through the registry so a legacy-labelled venue
  // still matches a group whose consensus is already canonical ids (and vice
  // versa). This is what makes the migration order safe.
  const venueBudgets = normalizeTierIdsForComparison(venue.budgetCategories, eventType);

  const adjacencyEnabled =
    options.adjacencyEnabled ?? getFeatureFlagSync("budgetAdjacencyEnabled");
  const strictPass = options.strictPass ?? true;

  if (!adjacencyEnabled) {
    // ── Legacy path — byte-for-byte the pre-T7 behaviour. Do not edit
    //    without re-validating flag-off parity (AC-2). ──
    if (groupBudget.length === 0) {
      // No budget constraint set by group — treat all venue budgets as acceptable
      score += 40;
      reasons.push(`未设置预算限制，所有价位均可接受`);
    } else {
      const budgetOverlap = venueBudgets.filter((vb: string) => groupBudget.includes(vb));

      if (budgetOverlap.length > 0) {
        const budgetScore = Math.min(
          40,
          (budgetOverlap.length / Math.max(groupBudget.length, 1)) * 40
        );
        score += budgetScore;
        reasons.push(`预算匹配 (${budgetOverlap.join(', ')})`);
      } else {
        reasons.push(`预算不匹配`);
        return { venue, score: 0, reasons }; // Hard fail if no budget overlap
      }
    }
  } else {
    // ── T7 degradation path (budgetAdjacencyEnabled = true) ──
    const evaluation = evaluateBudgetMatch(venueBudgets, groupBudget, eventType, strictPass);
    if (!evaluation.placeable) {
      reasons.push(evaluation.reason);
      return { venue, score: 0, reasons };
    }
    if (evaluation.points > 0) {
      score += evaluation.points;
    }
    reasons.push(evaluation.reason);
  }

  // 2. Cuisine Match (30 points)
  const cuisineScore = calculateCuisineMatch(group.members, venue.cuisines);
  score += cuisineScore * 0.3;
  if (cuisineScore > 60) {
    reasons.push(`菜系匹配度 ${cuisineScore}%`);
  }
  
  // 3. Capacity Match (20 points)
  // Uses seatingCapacity (max people per event) for group size fit.
  // Hard constraint already enforced above; this only awards bonus points.
  if (seatingCapacity >= groupSize) {
    score += 20;
    reasons.push(`容量充足 (可容纳${seatingCapacity}人)`);
  }
  
  // 4. Location (10 points) - same district as group members
  // NOTE: Location scoring uses default 10pts; district-level matching is future work.
  score += 10; // Default for now
  
  return { venue, score: Math.round(score), reasons };
}

export interface FindBestVenueOptions {
  adjacencyEnabled: boolean;
  /** In-memory slot-capacity predicate (current usage < maxConcurrentEvents). */
  canUseSlot: (timeSlotId: string) => boolean;
}

/**
 * Select the best venue for one group, applying the T7 two-pass rule.
 *
 * Pass 1 always runs (strict budget). When it yields no candidate AND the
 * degradation flag is on, pass 2 runs with budget demoted to a plain
 * preference. The one-tier cap is enforced inside `evaluateBudgetMatch` in
 * both passes, so pass 2 can never place a group ≥2 tiers away — a genuine
 * ≥2-tier supply gap still ends as `venue_tbd` (documented product residual).
 *
 * Exported and DB-free (scoreVenueForGroup takes a venue object) so the
 * two-pass behaviour is unit-testable without a live database.
 */
export async function findBestVenueForGroup(
  group: MatchGroup,
  venuesWithSlots: VenueWithSlot[],
  eventDateTime: Date,
  eventType: string,
  groupBudget: string[],
  options: FindBestVenueOptions,
): Promise<VenueScore | null> {
  const scorePass = async (strictPass: boolean): Promise<VenueScore[]> => {
    const scored: VenueScore[] = [];
    for (const { venue, timeSlot } of venuesWithSlots) {
      if (!options.canUseSlot(timeSlot.id)) continue;

      const scoredVenue = await scoreVenueForGroup(
        venue,
        group,
        eventDateTime,
        eventType,
        groupBudget,
        { adjacencyEnabled: options.adjacencyEnabled, strictPass },
      );
      if (scoredVenue.score > 0) {
        scored.push({ ...scoredVenue, timeSlotId: timeSlot.id });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored;
  };

  const passOne = await scorePass(true);
  if (passOne.length > 0) {
    return passOne[0];
  }
  if (!options.adjacencyEnabled) {
    return null;
  }

  const passTwo = await scorePass(false);
  return passTwo.length > 0 ? passTwo[0] : null;
}

/**
 * Main function: Assign venues to all groups in a pool
 */
export interface VenueAssignmentResult {
  assignments: Map<number, { venue: any; score: number; reasons: string[]; timeSlotId: string }>;
  unassigned: Map<number, string>; // groupNumber -> reason code
}

export async function assignVenuesToGroups(
  groups: MatchGroup[],
  poolId: string,
  poolDateTime: Date,
  poolCity: string,
  poolDistrict: string | null,
  eventType: string
): Promise<VenueAssignmentResult> {
  
  logger.info(`[VenueAssignment] Starting assignment for ${groups.length} groups in pool ${poolId}`);
  
  const assignments = new Map<number, { venue: any; score: number; reasons: string[]; timeSlotId: string }>();
  const unassigned = new Map<number, string>();

  // T7: resolve the degradation flag once per run (DB-first with env fallback)
  // and pass it down — never a per-venue flag lookup.
  const budgetAdjacencyEnabled = await getFeatureFlag("budgetAdjacencyEnabled");

  // 1. Get all active venues in city/district with appropriate venue type.
  //    The eligibility predicate lives in lib/venueEligibility.ts so the
  //    budget-options resolver scopes coverage to the exact same venue set.
  const venueQuery = buildEligibleVenueConditions(poolCity, poolDistrict, eventType);

  const availableVenues = await db
    .select()
    .from(venues)
    .where(venueQuery);
  
  logger.info(`[VenueAssignment] Found ${availableVenues.length} active venues in ${poolCity} ${poolDistrict || ''}`);
  
  // 2. Filter by time slot availability (respects maxConcurrentEvents + existing bookings)
  const slotResults = await Promise.all(
    availableVenues.map((venue: typeof venues.$inferSelect) => checkTimeSlotAvailability(venue.id, poolDateTime))
  );

  const venuesWithSlots: VenueWithSlot[] = [];
  for (let i = 0; i < availableVenues.length; i++) {
    if (slotResults[i]) {
      venuesWithSlots.push({ venue: availableVenues[i], timeSlot: slotResults[i]! });
    }
  }
  
  logger.info(`[VenueAssignment] ${venuesWithSlots.length} venues have available time slots with capacity`);
  
  if (venuesWithSlots.length === 0) {
    logger.warn(`[VenueAssignment] No venues available at ${poolDateTime}. Groups will remain unassigned.`);
    for (let i = 0; i < groups.length; i++) {
      unassigned.set(i + 1, "no_available_slots");
    }
    return { assignments, unassigned };
  }
  
  // Track in-memory slot usage to prevent overbooking multiple groups in the same pool
  const slotUsageTracker = new Map<string, number>(); // timeSlotId -> count
  const slotMaxConcurrent = new Map<string, number>(
    venuesWithSlots.map(({ timeSlot }) => [timeSlot.id, timeSlot.maxConcurrentEvents ?? 1]),
  );

  // 3. Assign venue to each group
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const groupBudget = calculateGroupBudget(group.members, eventType);
    
    logger.info(`[VenueAssignment] Group ${i + 1}: ${group.members.length} members, budget: ${groupBudget.join(', ')}`);
    
    // Two-pass selection (strict → relaxed) lives in findBestVenueForGroup.
    const bestMatch = await findBestVenueForGroup(
      group,
      venuesWithSlots,
      poolDateTime,
      eventType,
      groupBudget,
      {
        adjacencyEnabled: budgetAdjacencyEnabled,
        // In-memory concurrency guard: skip slots this pool has already filled.
        canUseSlot: (timeSlotId) =>
          (slotUsageTracker.get(timeSlotId) ?? 0) < (slotMaxConcurrent.get(timeSlotId) ?? 1),
      },
    );

    if (bestMatch) {
      // Use 1-based group index to align with group.groupNumber in saveVenueAssignments
      assignments.set(i + 1, bestMatch);
      slotUsageTracker.set(bestMatch.timeSlotId, (slotUsageTracker.get(bestMatch.timeSlotId) ?? 0) + 1);
      logger.info(`[VenueAssignment] Group ${i + 1} → ${bestMatch.venue.brandName || bestMatch.venue.name} (score: ${bestMatch.score})`);
      logger.info(`[VenueAssignment] Reasons: ${bestMatch.reasons.join(', ')}`);
    } else {
      // Determine why no venue was found
      const groupBudget = calculateGroupBudget(group.members, eventType);
      let reason = "no_suitable_venue";
      
      // Check if budget was the blocker (most common)
      if (groupBudget.length > 0) {
        const anyBudgetOverlap = venuesWithSlots.some(({ venue }) => {
          // Normalize the venue side to match the already-normalized group
          // consensus — otherwise a mixed legacy/id state would misreport
          // `budget_mismatch` even when the budgets actually overlap.
          const venueBudgets = normalizeTierIdsForComparison(venue.budgetCategories, eventType);
          return venueBudgets.some((vb: string) => groupBudget.includes(vb));
        });
        if (!anyBudgetOverlap) {
          reason = "budget_mismatch";
        }
      }
      
      // Check if capacity was the blocker
      const groupSize = group.members.length;
      const anyCapacityFit = venuesWithSlots.some(({ venue }) => {
        const seatingCapacity = venue.seatingCapacity ?? venue.capacity ?? 0;
        return seatingCapacity >= groupSize;
      });
      if (!anyCapacityFit && reason === "no_suitable_venue") {
        reason = "capacity_insufficient";
      }
      
      unassigned.set(i + 1, reason);
      logger.warn(`[VenueAssignment] No suitable venue found for group ${i + 1}: ${reason}`);
    }
  }
  
  return { assignments, unassigned };
}

/**
 * Update database with venue assignments and persist time-slot bookings
 */
export interface PoolInfoForAlert {
  title?: string;
  city?: string;
  district?: string | null;
}

export async function saveVenueAssignments(
  poolId: string,
  eventDateTime: Date,
  assignments: Map<number, { venue: any; score: number; reasons: string[]; timeSlotId: string }>,
  unassigned: Map<number, string> = new Map(),
  poolInfo?: PoolInfoForAlert
): Promise<void> {

  const { dateStr: bookingDate } = parseEventDate(eventDateTime);

  // Get all groups for this pool
  const groups: Array<{ id: string; groupNumber: number }> = await db
    .select({ id: eventPoolGroups.id, groupNumber: eventPoolGroups.groupNumber })
    .from(eventPoolGroups)
    .where(eq(eventPoolGroups.poolId, poolId));

  if (groups.length === 0) {
    logger.info(`[VenueAssignment] No groups found for pool ${poolId}. Skipping.`);
    return;
  }

  const groupIds = groups.map(g => g.id);
  const assignedSlotIds = [...new Set(
    groups
      .map(g => assignments.get(g.groupNumber)?.timeSlotId)
      .filter((id): id is string => !!id)
  )];

  // Batch query 1: existing bookings for all groups (idempotency guard)
  const existingBookings = groupIds.length > 0
    ? await db
        .select({ eventGroupId: venueTimeSlotBookings.eventGroupId, id: venueTimeSlotBookings.id })
        .from(venueTimeSlotBookings)
        .where(inArray(venueTimeSlotBookings.eventGroupId, groupIds))
    : [];
  const existingBookingMap = new Map<string, string>(existingBookings.map((b: { eventGroupId: string; id: string }) => [b.eventGroupId, b.id]));

  // Batch query 2: time slot info for all assigned slots
  const timeSlots = assignedSlotIds.length > 0
    ? await db
        .select()
        .from(venueTimeSlots)
        .where(inArray(venueTimeSlots.id, assignedSlotIds))
    : [];
  const timeSlotMap = new Map<string, typeof venueTimeSlots.$inferSelect>(timeSlots.map((s: typeof venueTimeSlots.$inferSelect) => [s.id, s]));

  // Metrics-only counter (T8): groups bounced by the save-time slot race
  // guard are persisted as unassigned('slot_fully_booked_at_save') inside the
  // transaction but are invisible to the post-transaction breakdown below.
  // Counting them here lets the metric signal stay accurate without touching
  // assignment logic.
  let saveTimeSlotFullSkips = 0;

  // Execute all writes atomically
  await db.transaction(async (tx: typeof db) => {
    const inTransactionSlotUsage = new Map<string, number>();

    // Cross-pool race-condition guard:
    // 1. Lock the slot rows themselves so concurrent assignments for the same slot
    //    serialize even when there are zero existing bookings.
    // 2. Lock existing booking rows so the count query is consistent.
    if (assignedSlotIds.length > 0) {
      await tx
        .select()
        .from(venueTimeSlots)
        .where(inArray(venueTimeSlots.id, assignedSlotIds))
        .for('update');

      await tx
        .select()
        .from(venueTimeSlotBookings)
        .where(and(
          inArray(venueTimeSlotBookings.timeSlotId, assignedSlotIds),
          sql`${venueTimeSlotBookings.bookingDate} = ${bookingDate}::date`,
          eq(venueTimeSlotBookings.status, 'confirmed')
        ))
        .for('update');
    }

    // Now count is safe — no concurrent tx can insert for these slots until we commit
    const lockedBookingCounts = assignedSlotIds.length > 0
      ? await tx
          .select({
            timeSlotId: venueTimeSlotBookings.timeSlotId,
            count: sql<number>`count(*)`,
          })
          .from(venueTimeSlotBookings)
          .where(and(
            inArray(venueTimeSlotBookings.timeSlotId, assignedSlotIds),
            sql`${venueTimeSlotBookings.bookingDate} = ${bookingDate}::date`,
            eq(venueTimeSlotBookings.status, 'confirmed')
          ))
          .groupBy(venueTimeSlotBookings.timeSlotId)
      : [];
    const bookingCountMap = new Map<string, number>(lockedBookingCounts.map((b: { timeSlotId: string; count: number }) => [b.timeSlotId, b.count]));

    for (const group of groups) {
      const assignment = assignments.get(group.groupNumber);
      const unassignedReason = unassigned.get(group.groupNumber);

      if (assignment) {
        // Idempotency guard
        if (existingBookingMap.has(group.id)) {
          logger.info(`[VenueAssignment] Group ${group.groupNumber} already has a booking. Skipping.`);
          continue;
        }

        // Save-time concurrency guard
        const slot = timeSlotMap.get(assignment.timeSlotId);
        const maxConcurrent = slot?.maxConcurrentEvents ?? 1;
        const preTxCount = bookingCountMap.get(assignment.timeSlotId) ?? 0;
        const txCount = inTransactionSlotUsage.get(assignment.timeSlotId) ?? 0;
        const totalCount = preTxCount + txCount;

        if (totalCount >= maxConcurrent) {
          logger.warn(`[VenueAssignment] Slot ${assignment.timeSlotId} fully booked at save time. Skipping group ${group.groupNumber}.`);
          saveTimeSlotFullSkips += 1;
          await tx
            .update(eventPoolGroups)
            .set({
              venueAssignmentStatus: 'unassigned',
              venueAssignmentReason: 'slot_fully_booked_at_save',
            })
            .where(eq(eventPoolGroups.id, group.id));
          continue;
        }

        // Persist booking record
        await tx.insert(venueTimeSlotBookings).values({
          venueId: assignment.venue.id,
          timeSlotId: assignment.timeSlotId,
          eventPoolId: poolId,
          eventGroupId: group.id,
          bookingDate,
          status: 'confirmed',
        });
        inTransactionSlotUsage.set(assignment.timeSlotId, txCount + 1);

        // Update group with venue assignment
        await tx
          .update(eventPoolGroups)
          .set({
            venueName: assignment.venue.brandName || assignment.venue.name,
            venueAddress: assignment.venue.address,
            venueId: assignment.venue.id,
            venueAssignmentStatus: 'assigned',
            venueAssignmentReason: null,
          })
          .where(eq(eventPoolGroups.id, group.id));
      } else if (unassignedReason) {
        // Mark as unassigned with reason
        await tx
          .update(eventPoolGroups)
          .set({
            venueAssignmentStatus: 'unassigned',
            venueAssignmentReason: unassignedReason,
          })
          .where(eq(eventPoolGroups.id, group.id));
      }
    }
  });

  // Side-effect: structured logging outside the transaction
  let newlyAssigned = 0;
  const unassignedBreakdown: Record<string, number> = {};
  for (const group of groups) {
    const assignment = assignments.get(group.groupNumber);
    const unassignedReason = unassigned.get(group.groupNumber);
    if (assignment && !existingBookingMap.has(group.id)) {
      newlyAssigned++;
      logger.info(`[VenueAssignment] Saved: Group ${group.groupNumber} → ${assignment.venue.brandName || assignment.venue.name} (slot: ${assignment.timeSlotId})`);
    } else if (unassignedReason) {
      unassignedBreakdown[unassignedReason] = (unassignedBreakdown[unassignedReason] || 0) + 1;
      logger.info(`[VenueAssignment] Marked group ${group.groupNumber} as unassigned: ${unassignedReason}`);
    }
  }

  // T8 observability: mirror the run outcome into the matching metrics
  // registry. Groups bounced by the save-time slot race guard were persisted
  // as unassigned('slot_fully_booked_at_save') but are absent from
  // `unassignedBreakdown` (and are over-counted as "Saved" in the log above —
  // pre-existing log inaccuracy, left untouched here); correct that for the
  // metric signal only. The recorder is fail-safe and never throws.
  const unassignedForMetrics: Record<string, number> = { ...unassignedBreakdown };
  if (saveTimeSlotFullSkips > 0) {
    unassignedForMetrics.slot_fully_booked_at_save =
      (unassignedForMetrics.slot_fully_booked_at_save ?? 0) + saveTimeSlotFullSkips;
  }
  observeVenueAssignmentRun({
    assignedCount: newlyAssigned - saveTimeSlotFullSkips,
    unassignedByReason: unassignedForMetrics,
  });

  // WeCom alert for unassigned groups
  if (Object.keys(unassignedBreakdown).length > 0) {
    void notifyVenueUnassigned({
      poolTitle: poolInfo?.title || poolId,
      poolCity: poolInfo?.city || "",
      poolDistrict: poolInfo?.district || undefined,
      poolDate: bookingDate,
      unassignedCount: Object.values(unassignedBreakdown).reduce((a, b) => a + b, 0),
      totalGroups: groups.length,
      daysUntilEvent: Math.round((new Date(bookingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      reasonBreakdown: unassignedBreakdown,
    }).catch((err) => {
      logger.warn("[VenueAssignment] Failed to send WeCom alert", { error: String(err) });
    });
  }
}

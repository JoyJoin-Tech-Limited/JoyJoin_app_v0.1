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
 * Parse event Date into consistent local date components.
 * PostgreSQL timestamps are stored without timezone; we treat the raw
 * wall-clock time as the intended local time. Parsing from the ISO string
 * avoids local timezone shift on Date methods.
 */
function parseEventDate(eventDateTime: Date): { dateStr: string; timeStr: string; dayOfWeek: number } {
  const iso = eventDateTime.toISOString(); // e.g. "2026-06-05T19:30:00.000Z"
  const [datePart, timePart] = iso.split('T');
  const timeStr = timePart.substring(0, 5); // "HH:MM"
  const [y, m, d] = datePart.split('-').map(Number);
  const dayOfWeek = new Date(y, m - 1, d).getDay();
  return { dateStr: datePart, timeStr, dayOfWeek };
}

/**
 * Calculate group's budget consensus
 * Returns array of budget ranges supported by at least 30% of group
 */
function calculateGroupBudget(members: UserWithProfile[], eventType: string): string[] {
  const budgetCounts = new Map<string, number>();
  
  for (const member of members) {
    const budgets = eventType === "酒局" 
      ? (member.barBudgetRange || [])
      : (member.budgetRange || []);
    
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
async function checkTimeSlotAvailability(
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

/**
 * Score venue suitability for group (0-100)
 */
async function scoreVenueForGroup(
  venue: typeof venues.$inferSelect,
  group: MatchGroup,
  eventDateTime: Date,
  eventType: string,
  groupBudget: string[]
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
  const venueBudgets = venue.budgetCategories || [];
  
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
  
  // 1. Get all active venues in city/district with appropriate venue type
  const allowedVenueTypes = eventType === "酒局" 
    ? ["bar", "homebar"]
    : ["restaurant", "cafe"];
  
  const venueQuery = poolDistrict 
    ? and(
        eq(venues.city, poolCity),
        eq(venues.area, poolDistrict),
        eq(venues.isActive, true),
        eq(venues.onboardingStatus, 'active'),
        eq(venues.partnerStatus, 'active'),
        sql`${venues.contractEndDate} IS NULL OR ${venues.contractEndDate} >= CURRENT_DATE`,
        inArray(venues.venueType, allowedVenueTypes)
      )
    : and(
        eq(venues.city, poolCity),
        eq(venues.isActive, true),
        eq(venues.onboardingStatus, 'active'),
        eq(venues.partnerStatus, 'active'),
        sql`${venues.contractEndDate} IS NULL OR ${venues.contractEndDate} >= CURRENT_DATE`,
        inArray(venues.venueType, allowedVenueTypes)
      );
  
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
  
  // 3. Assign venue to each group
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const groupBudget = calculateGroupBudget(group.members, eventType);
    
    logger.info(`[VenueAssignment] Group ${i + 1}: ${group.members.length} members, budget: ${groupBudget.join(', ')}`);
    
    // Score all available venues
    const scoredVenues: VenueScore[] = [];
    for (const { venue, timeSlot } of venuesWithSlots) {
      // In-memory concurrency guard: skip if this pool has already consumed all capacity
      const currentUsage = slotUsageTracker.get(timeSlot.id) ?? 0;
      const maxConcurrent = timeSlot.maxConcurrentEvents ?? 1;
      if (currentUsage >= maxConcurrent) {
        continue;
      }
      
      const scored = await scoreVenueForGroup(venue, group, poolDateTime, eventType, groupBudget);
      if (scored.score > 0) { // Only consider venues with non-zero score
        scoredVenues.push({ ...scored, timeSlotId: timeSlot.id });
      }
    }
    
    // Sort by score descending
    scoredVenues.sort((a, b) => b.score - a.score);
    
    if (scoredVenues.length > 0) {
      const bestMatch = scoredVenues[0];
      // Use 1-based group index to align with group.groupNumber in saveVenueAssignments
      assignments.set(i + 1, bestMatch);
      slotUsageTracker.set(bestMatch.timeSlotId, (slotUsageTracker.get(bestMatch.timeSlotId) ?? 0) + 1);
      logger.info(`[VenueAssignment] Group ${i + 1} → ${bestMatch.venue.name} (score: ${bestMatch.score})`);
      logger.info(`[VenueAssignment] Reasons: ${bestMatch.reasons.join(', ')}`);
    } else {
      // Determine why no venue was found
      const groupBudget = calculateGroupBudget(group.members, eventType);
      let reason = "no_suitable_venue";
      
      // Check if budget was the blocker (most common)
      if (groupBudget.length > 0) {
        const anyBudgetOverlap = venuesWithSlots.some(({ venue }) => {
          const venueBudgets = venue.budgetCategories || [];
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
            venueName: assignment.venue.name,
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
      logger.info(`[VenueAssignment] Saved: Group ${group.groupNumber} → ${assignment.venue.name} (slot: ${assignment.timeSlotId})`);
    } else if (unassignedReason) {
      unassignedBreakdown[unassignedReason] = (unassignedBreakdown[unassignedReason] || 0) + 1;
      logger.info(`[VenueAssignment] Marked group ${group.groupNumber} as unassigned: ${unassignedReason}`);
    }
  }

  // WeCom alert for unassigned groups
  if (Object.keys(unassignedBreakdown).length > 0) {
    void notifyVenueUnassigned({
      poolTitle: poolInfo?.title || poolId,
      poolCity: poolInfo?.city || "",
      poolDistrict: poolInfo?.district || undefined,
      poolDate: bookingDate,
      unassignedCount: Object.values(unassignedBreakdown).reduce((a, b) => a + b, 0),
      reasonBreakdown: unassignedBreakdown,
    }).catch((err) => {
      logger.warn("[VenueAssignment] Failed to send WeCom alert", { error: String(err) });
    });
  }
}

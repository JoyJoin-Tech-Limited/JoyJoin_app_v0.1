/**
 * Venue Assignment Service
 * 
 * Automatically assigns optimal venues to matched event pool groups
 * based on budget, cuisine preferences, availability, and capacity.
 */

import { db } from "./db";
import { venues, venueTimeSlots, eventPoolGroups } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import type { UserWithProfile, MatchGroup } from "./poolMatchingService";

interface VenueScore {
  venue: any;
  score: number;
  reasons: string[];
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
  
  // Calculate overlap score
  let matchCount = 0;
  for (const venueCuisine of venueCuisines) {
    if (groupCuisinePrefs.has(venueCuisine)) {
      matchCount += groupCuisinePrefs.get(venueCuisine)!;
    }
  }
  
  // Normalize to 0-100
  const maxPossible = members.length * venueCuisines.length;
  return Math.min(100, Math.round((matchCount / Math.max(1, groupCuisinePrefs.size)) * 100));
}

/**
 * Check if venue has available time slot at event time
 */
async function checkTimeSlotAvailability(
  venueId: string,
  eventDateTime: Date
): Promise<boolean> {
  const dayOfWeek = eventDateTime.getDay();
  const timeStr = eventDateTime.toTimeString().substring(0, 5); // "HH:MM"
  const dateStr = eventDateTime.toISOString().split('T')[0]; // "YYYY-MM-DD"
  
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
  
  if (weeklySlots.length > 0) return true;
  
  // Check for specific date slots
  const specificSlots = await db
    .select()
    .from(venueTimeSlots)
    .where(and(
      eq(venueTimeSlots.venueId, venueId),
      sql`${venueTimeSlots.specificDate}::text = ${dateStr}`,
      eq(venueTimeSlots.isActive, true),
      sql`${venueTimeSlots.startTime} <= ${timeStr}`,
      sql`${venueTimeSlots.endTime} >= ${timeStr}`
    ));
  
  return specificSlots.length > 0;
}

/**
 * Score venue suitability for group (0-100)
 */
async function scoreVenueForGroup(
  venue: any,
  group: MatchGroup,
  eventDateTime: Date,
  eventType: string,
  groupBudget: string[]
): Promise<VenueScore> {
  let score = 0;
  const reasons: string[] = [];
  
  // 1. Budget Match (40 points)
  const venueBudgets = venue.budgetCategories || [];
  const budgetOverlap = venueBudgets.filter((vb: string) => groupBudget.includes(vb));
  
  if (budgetOverlap.length > 0) {
    const budgetScore = Math.min(40, (budgetOverlap.length / Math.max(groupBudget.length, 1)) * 40);
    score += budgetScore;
    reasons.push(`预算匹配 (${budgetOverlap.join(', ')})`);
  } else {
    reasons.push(`预算不匹配`);
    return { venue, score: 0, reasons }; // Hard fail if no budget overlap
  }
  
  // 2. Cuisine Match (30 points)
  const cuisineScore = calculateCuisineMatch(group.members, venue.cuisines);
  score += cuisineScore * 0.3;
  if (cuisineScore > 60) {
    reasons.push(`菜系匹配度 ${cuisineScore}%`);
  }
  
  // 3. Capacity Match (20 points)
  const groupSize = group.members.length;
  if (venue.capacity && venue.capacity >= groupSize) {
    score += 20;
    reasons.push(`容量充足 (可容纳${venue.capacity}人)`);
  } else if (venue.capacity) {
    reasons.push(`容量不足 (仅可容纳${venue.capacity}人，需要${groupSize}人)`);
  }
  
  // 4. Location (10 points) - same district as group members
  // TODO: Calculate based on member locations if needed
  score += 10; // Default for now
  
  return { venue, score: Math.round(score), reasons };
}

/**
 * Main function: Assign venues to all groups in a pool
 */
export async function assignVenuesToGroups(
  groups: MatchGroup[],
  poolId: string,
  poolDateTime: Date,
  poolCity: string,
  poolDistrict: string | null,
  eventType: string
): Promise<Map<number, { venue: any; score: number; reasons: string[] }>> {
  
  console.log(`[VenueAssignment] Starting assignment for ${groups.length} groups in pool ${poolId}`);
  
  const assignments = new Map<number, { venue: any; score: number; reasons: string[] }>();
  
  // 1. Get all active venues in city/district
  const venueQuery = poolDistrict 
    ? and(
        eq(venues.city, poolCity),
        eq(venues.area, poolDistrict),
        eq(venues.isActive, true)
      )
    : and(
        eq(venues.city, poolCity),
        eq(venues.isActive, true)
      );
  
  const availableVenues = await db
    .select()
    .from(venues)
    .where(venueQuery);
  
  console.log(`[VenueAssignment] Found ${availableVenues.length} active venues in ${poolCity} ${poolDistrict || ''}`);
  
  // 2. Filter by time slot availability
  const venuesWithSlots: any[] = [];
  for (const venue of availableVenues) {
    const hasSlot = await checkTimeSlotAvailability(venue.id, poolDateTime);
    if (hasSlot) {
      venuesWithSlots.push(venue);
    }
  }
  
  console.log(`[VenueAssignment] ${venuesWithSlots.length} venues have available time slots`);
  
  if (venuesWithSlots.length === 0) {
    console.warn(`[VenueAssignment] No venues available at ${poolDateTime}. Groups will remain unassigned.`);
    return assignments;
  }
  
  // 3. Assign venue to each group
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const groupBudget = calculateGroupBudget(group.members, eventType);
    
    console.log(`[VenueAssignment] Group ${i + 1}: ${group.members.length} members, budget: ${groupBudget.join(', ')}`);
    
    // Score all available venues
    const scoredVenues: VenueScore[] = [];
    for (const venue of venuesWithSlots) {
      const scored = await scoreVenueForGroup(venue, group, poolDateTime, eventType, groupBudget);
      if (scored.score > 0) { // Only consider venues with non-zero score
        scoredVenues.push(scored);
      }
    }
    
    // Sort by score descending
    scoredVenues.sort((a, b) => b.score - a.score);
    
    if (scoredVenues.length > 0) {
      const bestMatch = scoredVenues[0];
      assignments.set(i, bestMatch);
      console.log(`[VenueAssignment] Group ${i + 1} → ${bestMatch.venue.name} (score: ${bestMatch.score})`);
      console.log(`[VenueAssignment] Reasons: ${bestMatch.reasons.join(', ')}`);
    } else {
      console.warn(`[VenueAssignment] No suitable venue found for group ${i + 1}`);
    }
  }
  
  return assignments;
}

/**
 * Update database with venue assignments
 */
export async function saveVenueAssignments(
  poolId: string,
  assignments: Map<number, { venue: any; score: number; reasons: string[] }>
): Promise<void> {
  
  // Get all groups for this pool
  const groups = await db
    .select()
    .from(eventPoolGroups)
    .where(eq(eventPoolGroups.poolId, poolId));
  
  for (const group of groups) {
    const assignment = assignments.get(group.groupNumber);
    
    if (assignment) {
      // Update group with venue assignment
      await db
        .update(eventPoolGroups)
        .set({
          venueName: assignment.venue.name,
          venueAddress: assignment.venue.address,
          venueId: assignment.venue.id,
        })
        .where(eq(eventPoolGroups.id, group.id));
      
      console.log(`[VenueAssignment] Saved: Group ${group.groupNumber} → ${assignment.venue.name}`);
    }
  }
}

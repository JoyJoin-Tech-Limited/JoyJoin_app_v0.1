/**
 * Venue-TBD retry executor (W8 AC-W8.5).
 *
 * Venue assignment runs exactly once after matching. When no suitable venue is
 * found the group is marked `venueAssignmentStatus='unassigned'` and the members
 * get a `venue_tbd` notification promising a decision by T-2h. This executor is
 * the retry pass the scheduler invokes: it re-runs assignment for every pool
 * that still has unassigned groups whose event has not started, so a slot that
 * frees up (or a venue added later) can resolve the group.
 *
 * Scope bounded deliberately: only future/upcoming matched pools are retried; a
 * past event is left as-is (no point booking a venue for a finished dinner).
 */

import { and, eq, gte, inArray } from "drizzle-orm";
import { eventPoolGroups, eventPoolRegistrations, eventPools } from "@shared/schema";
import { db } from "../db";
import { logger } from "./logger";
import { assignVenuesToGroups, saveVenueAssignments } from "../venueAssignmentService";
import type { MatchGroup, UserWithProfile } from "../poolMatchingService";

export interface VenueTbdRetryPoolResult {
  poolId: string;
  poolTitle: string;
  poolDateTimeIso: string;
  totalGroups: number;
  unassignedBefore: number;
  assignedThisPass: number;
  stillUnassigned: number;
  reasonBreakdown: Record<string, number>;
}

export interface VenueTbdRetryResult {
  retriedPools: number;
  totalAssigned: number;
  totalStillUnassigned: number;
  pools: VenueTbdRetryPoolResult[];
}

interface GroupRow {
  id: string;
  poolId: string;
  groupNumber: number;
  memberCount: number;
  venueAssignmentStatus: string | null;
}

interface MemberRow {
  assignedGroupId: string | null;
  userId: string;
  budgetRange: unknown;
  barBudgetRange: unknown;
  cuisinePreferences: unknown;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Pools with at least one unassigned group whose event has not started. */
export async function findPoolsWithUnassignedVenues(): Promise<string[]> {
  const rows = await db
    .select({ poolId: eventPoolGroups.poolId })
    .from(eventPoolGroups)
    .innerJoin(eventPools, eq(eventPools.id, eventPoolGroups.poolId))
    .where(
      and(
        eq(eventPoolGroups.venueAssignmentStatus, "unassigned"),
        eq(eventPools.status, "matched"),
        gte(eventPools.dateTime, new Date()),
      ),
    )
    .groupBy(eventPoolGroups.poolId);
  return rows.map((row: { poolId: string }) => row.poolId);
}

/**
 * Re-run venue assignment for one pool. Passes ALL of the pool's groups (so the
 * `assignVenuesToGroups` → `groupNumber` mapping stays stable), but only the
 * unassigned groups can actually be placed — groups with an existing booking are
 * skipped by `saveVenueAssignments`'s idempotency guard.
 */
export async function retryVenueAssignmentForPool(poolId: string): Promise<VenueTbdRetryPoolResult | null> {
  const [pool] = await db
    .select()
    .from(eventPools)
    .where(eq(eventPools.id, poolId))
    .limit(1);
  if (!pool) return null;

  const groups = (await db
    .select({
      id: eventPoolGroups.id,
      poolId: eventPoolGroups.poolId,
      groupNumber: eventPoolGroups.groupNumber,
      memberCount: eventPoolGroups.memberCount,
      venueAssignmentStatus: eventPoolGroups.venueAssignmentStatus,
    })
    .from(eventPoolGroups)
    .where(eq(eventPoolGroups.poolId, poolId))) as GroupRow[];

  if (groups.length === 0) return null;

  const unassignedGroups = groups
    .filter((group) => group.venueAssignmentStatus === "unassigned")
    .sort((a, b) => a.groupNumber - b.groupNumber);
  if (unassignedGroups.length === 0) return null;

  const groupIds = groups.map((group) => group.id);
  const memberRows = (await db
    .select({
      assignedGroupId: eventPoolRegistrations.assignedGroupId,
      userId: eventPoolRegistrations.userId,
      budgetRange: eventPoolRegistrations.budgetRange,
      barBudgetRange: eventPoolRegistrations.barBudgetRange,
      cuisinePreferences: eventPoolRegistrations.cuisinePreferences,
    })
    .from(eventPoolRegistrations)
    .where(
      and(
        inArray(eventPoolRegistrations.assignedGroupId, groupIds),
        eq(eventPoolRegistrations.matchStatus, "matched"),
      ),
    )) as MemberRow[];

  const membersByGroup = new Map<string, UserWithProfile[]>();
  for (const row of memberRows) {
    if (!row.assignedGroupId) continue;
    const list = membersByGroup.get(row.assignedGroupId) ?? [];
    list.push({
      userId: row.userId,
      registrationId: "",
      budgetRange: asStringArray(row.budgetRange),
      barBudgetRange: asStringArray(row.barBudgetRange),
      cuisinePreferences: asStringArray(row.cuisinePreferences),
    } as unknown as UserWithProfile);
    membersByGroup.set(row.assignedGroupId, list);
  }

  // Only the unassigned groups need scoring (existing assignments are skipped
  // by saveVenueAssignments). Sort by groupNumber so index i+1 is stable, then
  // remap the result back onto the real groupNumber keys.
  const retryGroups: MatchGroup[] = unassignedGroups.map((group) => ({
    members: membersByGroup.get(group.id) ?? [],
    avgPairScore: 0,
    avgChemistryScore: 0,
    diversityScore: 0,
    communicationBalance: 0,
    overallScore: 0,
    temperatureLevel: "warm",
    explanation: "",
  }));

  const eventDateTime = pool.dateTime ? new Date(pool.dateTime) : new Date();
  const { assignments, unassigned } = await assignVenuesToGroups(
    retryGroups,
    poolId,
    eventDateTime,
    pool.city || "",
    pool.district,
    pool.eventType || "饭局",
  );

  const remappedAssignments = new Map<number, { venue: any; score: number; reasons: string[]; timeSlotId: string }>();
  const remappedUnassigned = new Map<number, string>();
  unassignedGroups.forEach((group, index) => {
    const assignment = assignments.get(index + 1);
    if (assignment) remappedAssignments.set(group.groupNumber, assignment);
    const reason = unassigned.get(index + 1);
    if (reason) remappedUnassigned.set(group.groupNumber, reason);
  });

  await saveVenueAssignments(
    poolId,
    eventDateTime,
    remappedAssignments,
    remappedUnassigned,
    { title: pool.title, city: pool.city, district: pool.district },
  );

  const reasonBreakdown: Record<string, number> = {};
  for (const reason of remappedUnassigned.values()) {
    reasonBreakdown[reason] = (reasonBreakdown[reason] || 0) + 1;
  }

  return {
    poolId,
    poolTitle: pool.title,
    poolDateTimeIso: eventDateTime.toISOString(),
    totalGroups: groups.length,
    unassignedBefore: unassignedGroups.length,
    assignedThisPass: remappedAssignments.size,
    stillUnassigned: remappedUnassigned.size,
    reasonBreakdown,
  };
}

/** Retry venue assignment across every pool that still has TBD groups. */
export async function retryVenueTbdAssignments(): Promise<VenueTbdRetryResult> {
  const poolIds = await findPoolsWithUnassignedVenues();
  const pools: VenueTbdRetryPoolResult[] = [];
  let totalAssigned = 0;
  let totalStillUnassigned = 0;

  for (const poolId of poolIds) {
    try {
      const result = await retryVenueAssignmentForPool(poolId);
      if (!result) continue;
      pools.push(result);
      totalAssigned += result.assignedThisPass;
      totalStillUnassigned += result.stillUnassigned;
    } catch (error) {
      logger.warn("[VenueTbdRetry] retry failed for pool; continuing", {
        component: "venue_tbd_retry",
        poolId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { retriedPools: pools.length, totalAssigned, totalStillUnassigned, pools };
}

import { blindBoxEvents, eventAttendance, eventPoolGroups, eventPoolRegistrations, eventPools } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { db } from "../db";

type SocialIcebreakerAccessResult =
  | { allowed: true }
  | { allowed: false; status: 403 | 404 | 410; body: Record<string, unknown> };

/**
 * Authorize a user for a social icebreaker session.
 *
 * Replaces the legacy getIcebreakerSessionParticipantAccess() which required
 * querying the deprecated icebreakerSessions table first.  This version
 * authorizes directly against eventPoolGroups, blindBoxEvents, or
 * eventAttendance — the same three paths, just without the legacy
 * indirection.
 *
 * @param sessionId - Polymorphic identifier.  Tried in order as:
 *   1. eventPoolGroups.id
 *   2. blindBoxEvents.id
 *   3. eventAttendance.eventId
 * @param userId
 */
export async function getSocialIcebreakerAccess(
  sessionId: string,
  userId: string,
): Promise<SocialIcebreakerAccessResult> {
  // --- Path 1: groupId ---
  const [group] = await db
    .select()
    .from(eventPoolGroups)
    .where(eq(eventPoolGroups.id, sessionId))
    .limit(1);

  if (group) {
    if (group.status === "completed" || group.status === "cancelled") {
      return {
        allowed: false,
        status: 410,
        body: { message: "Icebreaker session has expired" },
      };
    }

    const [registration] = await db
      .select({ id: eventPoolRegistrations.id })
      .from(eventPoolRegistrations)
      .where(
        and(
          eq(eventPoolRegistrations.assignedGroupId, sessionId),
          eq(eventPoolRegistrations.userId, userId),
        ),
      )
      .limit(1);

    if (!registration) {
      return { allowed: false, status: 403, body: { message: "Forbidden" } };
    }

    return { allowed: true };
  }

  // --- Path 2: blindBoxEventId ---
  const [event] = await db
    .select()
    .from(blindBoxEvents)
    .where(eq(blindBoxEvents.id, sessionId))
    .limit(1);

  if (event) {
    if (event.status === "completed" || event.status === "canceled") {
      return {
        allowed: false,
        status: 410,
        body: { message: "Event session has expired" },
      };
    }

    const matchedAttendees = Array.isArray(event.matchedAttendees)
      ? event.matchedAttendees
      : [];
    const isParticipant = matchedAttendees.some(
      (attendee: any) => attendee?.userId === userId,
    );

    if (!isParticipant) {
      return { allowed: false, status: 403, body: { message: "Forbidden" } };
    }

    return { allowed: true };
  }

  // --- Path 3: eventId ---
  const [attendance] = await db
    .select({ userId: eventAttendance.userId })
    .from(eventAttendance)
    .where(
      and(
        eq(eventAttendance.eventId, sessionId),
        eq(eventAttendance.userId, userId),
      ),
    )
    .limit(1);

  if (attendance) {
    return { allowed: true };
  }

  return {
    allowed: false,
    status: 404,
    body: { message: "Icebreaker session not found" },
  };
}

/**
 * Determine default icebreaker tier for a session.
 * Returns 'custom' when the session's group belongs to a test pool (isTestPool=true),
 * otherwise 'breeze'.
 */
export async function resolveIcebreakerDefaultTier(sessionId: string): Promise<'breeze' | 'custom'> {
  const [group] = await db
    .select({ poolId: eventPoolGroups.poolId })
    .from(eventPoolGroups)
    .where(eq(eventPoolGroups.id, sessionId))
    .limit(1);
  if (!group) return 'breeze';
  const [pool] = await db
    .select({ isTestPool: eventPools.isTestPool })
    .from(eventPools)
    .where(eq(eventPools.id, group.poolId))
    .limit(1);
  return pool?.isTestPool ? 'custom' : 'breeze';
}

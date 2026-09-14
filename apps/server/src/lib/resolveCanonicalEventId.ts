import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { events, eventPoolGroups, eventPoolRegistrations } from "@shared/schema";
import { logger } from "./logger";

/**
 * Resolve the canonical events.id for the three event id families the
 * mini-program can pass to /api/events/:eventId/* routes:
 *
 *   1. direct events.id
 *   2. blind_box_events.id (per-user blind box row) — via the group's
 *      eventId back-link (matches the participants route Path 1)
 *   3. event_pools.id — via the viewer's registration.assignedGroupId →
 *      group.eventId (matches the participants route Path 2)
 *
 * event_feedback / connections FKs reference events.id, so a blind-box or
 * pool id passed straight into the insert violates
 * `event_feedback_event_id_events_id_fk` (seen in the single-test局 flow,
 * where squad-unboxing redirects with blindBoxEventId).
 *
 * Returns null when the id resolves to no event (caller decides 404).
 */
export async function resolveCanonicalEventId(
  rawEventId: string,
  userId: string,
): Promise<string | null> {
  const [direct] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, rawEventId))
    .limit(1);
  if (direct?.id) return direct.id;

  const [viaBlindBox] = await db
    .select({ eventId: eventPoolGroups.eventId })
    .from(eventPoolGroups)
    .where(eq(eventPoolGroups.blindBoxEventId, rawEventId))
    .limit(1);
  if (viaBlindBox?.eventId) return viaBlindBox.eventId;

  const [poolRegistration] = await db
    .select({ assignedGroupId: eventPoolRegistrations.assignedGroupId })
    .from(eventPoolRegistrations)
    .where(
      and(
        eq(eventPoolRegistrations.poolId, rawEventId),
        eq(eventPoolRegistrations.userId, userId),
      ),
    )
    .limit(1);
  if (poolRegistration?.assignedGroupId) {
    const [group] = await db
      .select({ eventId: eventPoolGroups.eventId })
      .from(eventPoolGroups)
      .where(eq(eventPoolGroups.id, poolRegistration.assignedGroupId))
      .limit(1);
    if (group?.eventId) return group.eventId;
  }

  return null;
}

/** Default route param carrying the client-supplied event id. */
export const CANONICAL_EVENT_ID_PARAM = "eventId";

/**
 * W8 (AC-W8.8): centralize canonicalization as a route guard.
 *
 * Before W8 every route that wrote an event-FK'd column had to remember to call
 * `resolveCanonicalEventId` itself — the single-test 局 FK violation happened
 * because one route forgot. Mount this guard after `requireAuth` on any
 * `/api/events/:eventId/*` write route: it resolves the three id families, 404s
 * on an unresolvable id, and exposes the canonical id at
 * `req.canonicalEventId`. The raw param vs. canonical id stays observable in
 * the warn log for ops triage.
 */
export function canonicalEventIdGuard(paramName: string = CANONICAL_EVENT_ID_PARAM) {
  return async function canonicalEventIdGuard(req: any, res: any, next: any): Promise<unknown> {
    const userId: string | undefined = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const rawEventId = req.params?.[paramName];
    const canonicalEventId = await resolveCanonicalEventId(rawEventId, userId);
    if (!canonicalEventId) {
      logger.warn("Canonical event id could not be resolved", {
        route: req.originalUrl,
        rawEventId,
        userId,
      });
      return res.status(404).json({ message: "未找到对应的活动" });
    }

    req.canonicalEventId = canonicalEventId;
    return next();
  };
}

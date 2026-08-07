import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { eventPoolGroups, eventPoolRegistrations, events } from "@shared/schema";

type FeedbackDb = Pick<typeof db, "select">;

/**
 * event_feedback intentionally references the canonical events table, while
 * mini-program routes can expose an events.id, blind_box_events.id, or
 * event_pools.id. Resolve those public identifiers before persisting feedback.
 */
export async function resolveCanonicalFeedbackEventId(
  routeEventId: string,
  userId: string,
  database: FeedbackDb = db,
): Promise<string | undefined> {
  const [canonicalEvent] = await database
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, routeEventId))
    .limit(1);
  if (canonicalEvent) return canonicalEvent.id;

  const [blindBoxGroup] = await database
    .select({ eventId: eventPoolGroups.eventId })
    .from(eventPoolGroups)
    .where(eq(eventPoolGroups.blindBoxEventId, routeEventId))
    .limit(1);
  if (blindBoxGroup?.eventId) return blindBoxGroup.eventId;

  const [registration] = await database
    .select({ assignedGroupId: eventPoolRegistrations.assignedGroupId })
    .from(eventPoolRegistrations)
    .where(
      and(
        eq(eventPoolRegistrations.poolId, routeEventId),
        eq(eventPoolRegistrations.userId, userId),
      ),
    )
    .limit(1);
  if (!registration?.assignedGroupId) return undefined;

  const [poolGroup] = await database
    .select({ eventId: eventPoolGroups.eventId })
    .from(eventPoolGroups)
    .where(eq(eventPoolGroups.id, registration.assignedGroupId))
    .limit(1);
  return poolGroup?.eventId ?? undefined;
}

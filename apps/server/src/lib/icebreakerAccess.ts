import { blindBoxEvents, eventAttendance, eventPoolGroups, eventPoolRegistrations, icebreakerSessions } from "@shared/schema";
import type { BlindBoxEvent, IcebreakerSession } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { db } from "../db";

type SessionAccessResult =
  | {
      allowed: true;
      session: IcebreakerSession;
      event?: BlindBoxEvent;
      group?: typeof eventPoolGroups.$inferSelect;
    }
  | {
      allowed: false;
      status: 403 | 404 | 410;
      body: Record<string, unknown>;
    };

type BlindBoxAccessResult =
  | { allowed: true; event: BlindBoxEvent }
  | { allowed: false; status: 403 | 404 | 410; body: Record<string, unknown> };

export async function getBlindBoxEventParticipantAccess(
  eventId: string,
  userId: string,
): Promise<BlindBoxAccessResult> {
  const [event] = await db.select().from(blindBoxEvents).where(eq(blindBoxEvents.id, eventId)).limit(1);

  if (!event) {
    return { allowed: false, status: 404, body: { message: "Event not found" } };
  }

  if (event.status === "completed" || event.status === "canceled") {
    return { allowed: false, status: 410, body: { message: "Event session has expired" } };
  }

  const matchedAttendees = Array.isArray(event.matchedAttendees) ? event.matchedAttendees : [];
  const isParticipant = matchedAttendees.some((attendee: any) => attendee?.userId === userId);

  if (!isParticipant) {
    return { allowed: false, status: 403, body: { message: "Forbidden" } };
  }

  return { allowed: true, event };
}

export async function getIcebreakerSessionParticipantAccess(
  sessionId: string,
  userId: string,
): Promise<SessionAccessResult> {
  const [session] = await db.select().from(icebreakerSessions).where(eq(icebreakerSessions.id, sessionId)).limit(1);

  if (!session) {
    return { allowed: false, status: 404, body: { message: "Icebreaker session not found" } };
  }

  if (session.groupId) {
    const [group] = await db.select().from(eventPoolGroups).where(eq(eventPoolGroups.id, session.groupId)).limit(1);

    if (!group) {
      return { allowed: false, status: 404, body: { message: "Event group not found" } };
    }

    if (group.status === "completed" || group.status === "cancelled") {
      return { allowed: false, status: 410, body: { message: "Icebreaker session has expired" } };
    }

    const [registration] = await db
      .select({ id: eventPoolRegistrations.id })
      .from(eventPoolRegistrations)
      .where(
        and(
          eq(eventPoolRegistrations.assignedGroupId, session.groupId),
          eq(eventPoolRegistrations.userId, userId),
        ),
      )
      .limit(1);

    if (!registration) {
      return { allowed: false, status: 403, body: { message: "Forbidden" } };
    }

    return { allowed: true, session, group };
  }

  if (session.blindBoxEventId) {
    const eventAccess = await getBlindBoxEventParticipantAccess(session.blindBoxEventId, userId);
    if (!eventAccess.allowed) {
      return eventAccess;
    }

    return { allowed: true, session, event: eventAccess.event };
  }

  if (session.eventId) {
    const [attendance] = await db
      .select({ userId: eventAttendance.userId })
      .from(eventAttendance)
      .where(
        and(eq(eventAttendance.eventId, session.eventId), eq(eventAttendance.userId, userId)),
      )
      .limit(1);

    if (!attendance) {
      return { allowed: false, status: 403, body: { message: "Forbidden" } };
    }

    if (session.endedAt) {
      return { allowed: false, status: 410, body: { message: "Icebreaker session has expired" } };
    }

    return { allowed: true, session };
  }

  return { allowed: false, status: 404, body: { message: "Icebreaker session not found" } };
}

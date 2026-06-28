/**
 * Joined Events Repository — N+1-free bulk queries for GET /api/events/joined
 *
 * Returns all events a user has joined (legacy events + pool registrations)
 * in a single unified shape, sorted by dateTime descending.
 *
 * Why a dedicated repository?
 *   - The legacy `storage.getUserJoinedEvents()` has an N+1 on participants
 *     (line 214 of legacyStorageRepo.ts).
 *   - The Events tab only needs id/title/dateTime/location/status/description.
 *   - Pool registrations are also "joined events" and must be included.
 */

import { eq, desc, and, inArray } from "drizzle-orm";
import { db } from "../db";
import { events, eventAttendance, eventPools, eventPoolRegistrations, eventPoolGroups } from "@shared/schema";
import type { JoinedEventSummary } from "@shared/api";

/**
 * Fetch all events a user has joined (legacy + pool) as JoinedEventSummary[].
 * N+1-free: exactly 2 DB round-trips in parallel.
 */
export async function getUserJoinedEventsSummary(userId: string): Promise<JoinedEventSummary[]> {
  // 1. Legacy events via eventAttendance (1 round-trip)
  const legacyRows = await db
    .select({
      id: events.id,
      title: events.title,
      dateTime: events.dateTime,
      location: events.location,
      area: events.area,
      status: events.status,
      description: events.description,
      attendanceStatus: eventAttendance.status,
    })
    .from(eventAttendance)
    .innerJoin(events, eq(eventAttendance.eventId, events.id))
    .where(eq(eventAttendance.userId, userId))
    .orderBy(desc(events.dateTime));

  // 2. Pool events via eventPoolRegistrations (1 round-trip)
  const poolRows = await db
    .select({
      id: eventPools.id,
      title: eventPools.title,
      dateTime: eventPools.dateTime,
      location: eventPools.city,
      status: eventPools.status,
      description: eventPools.description,
      eventType: eventPools.eventType,
      city: eventPools.city,
      district: eventPools.district,
      registrationDeadline: eventPools.registrationDeadline,
      price: eventPools.price,
      matchedAt: eventPools.matchedAt,
      matchStatus: eventPoolRegistrations.matchStatus,
      assignedGroupId: eventPoolRegistrations.assignedGroupId,
      venueName: eventPoolGroups.venueName,
      venueAddress: eventPoolGroups.venueAddress,
      finalDateTime: eventPoolGroups.finalDateTime,
    })
    .from(eventPoolRegistrations)
    .innerJoin(eventPools, eq(eventPoolRegistrations.poolId, eventPools.id))
    .leftJoin(eventPoolGroups, eq(eventPoolRegistrations.assignedGroupId, eventPoolGroups.id))
    .where(
      and(
        eq(eventPoolRegistrations.userId, userId),
        inArray(eventPoolRegistrations.matchStatus, ["pending", "matched"])
      )
    )
    .orderBy(desc(eventPools.dateTime));

  // 3. Merge into unified shape
  const legacyEvents: JoinedEventSummary[] = legacyRows.map((row: typeof legacyRows[number]) => ({
    id: row.id,
    title: row.title ?? undefined,
    dateTime: row.dateTime?.toISOString?.() ?? String(row.dateTime),
    location: row.location ?? undefined,
    district: row.area ?? undefined,
    status: row.attendanceStatus ?? row.status ?? undefined,
    description: row.description ?? undefined,
  }));

  const poolEvents: JoinedEventSummary[] = poolRows.map((row: typeof poolRows[number]) => ({
    id: row.id,
    title: row.title ?? undefined,
    dateTime: row.dateTime?.toISOString?.() ?? String(row.dateTime),
    location: row.location ?? undefined,
    status: row.matchStatus ?? row.status ?? undefined,
    description: row.description ?? undefined,
    eventType: row.eventType ?? undefined,
    city: row.city ?? undefined,
    district: row.district ?? undefined,
    venueName: row.venueName ?? undefined,
    venueAddress: row.venueAddress ?? undefined,
    registrationDeadline: row.registrationDeadline?.toISOString?.() ?? undefined,
    price: row.price ?? undefined,
    matchedAt: row.matchedAt?.toISOString?.() ?? undefined,
    groupId: row.assignedGroupId ?? undefined,
    finalDateTime: row.finalDateTime?.toISOString?.() ?? undefined,
  }));

  // 4. Merge and sort by dateTime descending
  const allEvents = [...legacyEvents, ...poolEvents];
  allEvents.sort((a, b) => {
    const dateA = a.dateTime ? new Date(a.dateTime).getTime() : 0;
    const dateB = b.dateTime ? new Date(b.dateTime).getTime() : 0;
    return dateB - dateA;
  });

  return allEvents;
}

/**
 * Lightweight event slice for the Connections shell context resolver.
 *
 * Only id/title/dateTime are returned, and results are capped to reduce payload
 * size for users with long event histories. Upcoming events are naturally at the
 * top of a descending-by-dateTime list, so the cap still covers the nearest
 * upcoming event and the most recent past events for feedback-pending logic.
 */
export interface ConnectionsContextEvent {
  id: string;
  title?: string;
  dateTime?: string;
}

const CONNECTIONS_CONTEXT_EVENT_LIMIT = 50;

export async function getConnectionsContextEvents(userId: string): Promise<ConnectionsContextEvent[]> {
  const now = new Date();

  const [legacyRows, poolRows] = await Promise.all([
    db
      .select({
        id: events.id,
        title: events.title,
        dateTime: events.dateTime,
      })
      .from(eventAttendance)
      .innerJoin(events, eq(eventAttendance.eventId, events.id))
      .where(eq(eventAttendance.userId, userId))
      .orderBy(desc(events.dateTime))
      .limit(CONNECTIONS_CONTEXT_EVENT_LIMIT),

    db
      .select({
        id: eventPools.id,
        title: eventPools.title,
        dateTime: eventPools.dateTime,
      })
      .from(eventPoolRegistrations)
      .innerJoin(eventPools, eq(eventPoolRegistrations.poolId, eventPools.id))
      .where(
        and(
          eq(eventPoolRegistrations.userId, userId),
          inArray(eventPoolRegistrations.matchStatus, ["pending", "matched"])
        )
      )
      .orderBy(desc(eventPools.dateTime))
      .limit(CONNECTIONS_CONTEXT_EVENT_LIMIT),
  ]);

  const legacyEvents: ConnectionsContextEvent[] = legacyRows.map((row: typeof legacyRows[number]) => ({
    id: row.id,
    title: row.title ?? undefined,
    dateTime: row.dateTime?.toISOString?.() ?? String(row.dateTime),
  }));

  const poolEvents: ConnectionsContextEvent[] = poolRows.map((row: typeof poolRows[number]) => ({
    id: row.id,
    title: row.title ?? undefined,
    dateTime: row.dateTime?.toISOString?.() ?? String(row.dateTime),
  }));

  const allEvents = [...legacyEvents, ...poolEvents];
  allEvents.sort((a, b) => {
    const dateA = a.dateTime ? new Date(a.dateTime).getTime() : 0;
    const dateB = b.dateTime ? new Date(b.dateTime).getTime() : 0;
    return dateB - dateA;
  });

  return allEvents.slice(0, CONNECTIONS_CONTEXT_EVENT_LIMIT);
}

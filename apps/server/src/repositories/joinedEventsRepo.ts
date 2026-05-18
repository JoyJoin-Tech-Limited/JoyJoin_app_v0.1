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
import { events, eventAttendance, eventPools, eventPoolRegistrations } from "@shared/schema";
import type { JoinedEventSummary } from "@shared/api";

/**
 * Fetch all events a user has joined (legacy + pool) as JoinedEventSummary[].
 * N+1-free: exactly 2 DB round-trips in parallel.
 */
export async function getUserJoinedEventsSummary(userId: string): Promise<JoinedEventSummary[]> {
  const now = new Date();

  // 1. Legacy events via eventAttendance (1 round-trip)
  const legacyRows = await db
    .select({
      id: events.id,
      title: events.title,
      dateTime: events.dateTime,
      location: events.location,
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
      matchStatus: eventPoolRegistrations.matchStatus,
    })
    .from(eventPoolRegistrations)
    .innerJoin(eventPools, eq(eventPoolRegistrations.poolId, eventPools.id))
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

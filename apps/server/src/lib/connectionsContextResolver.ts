import type { ConnectionsShellContext } from "@shared/api";

export interface JoinedEventForContext {
  id: string;
  title?: string;
  dateTime?: string;
}

/**
 * Resolve which Connections empty-state context a user should see.
 *
 * Priority:
 *   1. no-events — user has never joined an event.
 *   2. upcoming-event — user has at least one future event; show the nearest one.
 *   3. feedback-pending — most recent past event is missing feedback.
 *   4. feedback-complete — all past events have feedback but no mutual connections yet.
 *
 * Pure function: safe to unit-test without DB or cache.
 */
export function resolveConnectionsContext(
  events: JoinedEventForContext[],
  feedbackEventIds: Set<string>,
  now: Date,
): ConnectionsShellContext | null {
  if (events.length === 0) {
    return { mode: "no-events" };
  }

  const eventsWithTimestamp = events
    .filter((e): e is JoinedEventForContext & { timestamp: number } => {
      if (e.dateTime == null) return false;
      const ts = new Date(e.dateTime).getTime();
      return !Number.isNaN(ts);
    })
    .map((e) => ({
      ...e,
      timestamp: new Date(e.dateTime!).getTime(),
    }));

  if (eventsWithTimestamp.length === 0) {
    return { mode: "no-events" };
  }

  const upcoming = eventsWithTimestamp
    .filter((e) => e.timestamp >= now.getTime())
    .sort((a, b) => a.timestamp - b.timestamp);

  if (upcoming.length > 0) {
    return {
      mode: "upcoming-event",
      upcomingEventTitle: upcoming[0].title ?? null,
    };
  }

  const pastNoFeedback = eventsWithTimestamp
    .filter((e) => e.timestamp < now.getTime() && !feedbackEventIds.has(e.id))
    .sort((a, b) => b.timestamp - a.timestamp);

  if (pastNoFeedback.length > 0) {
    return {
      mode: "feedback-pending",
      nextFeedbackEventId: pastNoFeedback[0].id,
      nextFeedbackEventTitle: pastNoFeedback[0].title ?? null,
    };
  }

  const pastAll = eventsWithTimestamp.filter((e) => e.timestamp < now.getTime());
  if (pastAll.length > 0) {
    return { mode: "feedback-complete" };
  }

  return null;
}

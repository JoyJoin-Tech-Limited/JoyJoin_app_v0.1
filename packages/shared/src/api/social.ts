import type { ApiTransport } from './core.js'

/**
 * One tablemate in the event-feedback mutual-contact picker (2026-07-28).
 * Privacy-minimal: only the fields the picker renders (head, name). Age /
 * industry / WeChat id stay server-side — the picker never needs them.
 */
export interface EventParticipantSummary {
  id: string
  displayName: string
  firstName: string | null
  archetype: string | null
  /** Approved profile image, falling back to the user's WeChat avatar. */
  avatarUrl?: string | null
}

/**
 * Roster of the event's table for the feedback mutual-contact step.
 * Resolves blind-box events (matchedAttendees), event pools (matched group
 * members), and legacy events (attendance) behind one shape.
 */
export function getEventParticipants(
  api: ApiTransport,
  eventId: string,
): Promise<EventParticipantSummary[]> {
  return api<EventParticipantSummary[]>({
    path: `/api/events/${encodeURIComponent(eventId)}/participants`,
  })
}

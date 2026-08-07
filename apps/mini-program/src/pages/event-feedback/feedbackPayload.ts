import {
  MAX_IMPROVEMENT_AREAS,
  MAX_TAGS_PER_ATTENDEE,
  type ConnectionRadarState,
} from './feedbackOptions'

export interface AttendeeTraitInput {
  displayName: string
  tags: string[]
  improvementNote: string
}

/**
 * Balanced (5-dimension) feedback layer — every field is optional; the
 * payload only ever carries what the user actually filled in.
 */
export interface BalancedFeedbackInput {
  atmosphereScore: number
  atmosphereNote: string
  attendeeTraits: Record<string, AttendeeTraitInput>
  connectionRadar: ConnectionRadarState
  connectionStatus: string | null
  hasNewConnections: boolean
  improvementAreas: string[]
  improvementOther: string
  venueStyleRating: 'like' | 'neutral' | 'dislike' | null
}

interface EventFeedbackPayloadInput {
  rating: number
  /** Free-text comment. Wire key MUST be `feedback` — insertEventFeedbackSchema
   * derives from the event_feedback.feedback column and Zod strips unknown keys,
   * so `comment` would be silently dropped (2026-08-07 wire-contract fix). */
  comment: string
  connections: string[]
  /** Omit to submit the base 3-step flow without the balanced layer. */
  balanced?: Partial<BalancedFeedbackInput>
}

interface CleanAttendeeTrait {
  displayName: string
  tags: string[]
  needsImprovement: boolean
  improvementNote: string | undefined
}

/**
 * Drop attendee entries the user left completely empty and derive
 * needsImprovement from the presence of a 悄悄话 note (keeps the UI toggle-free).
 */
function cleanAttendeeTraits(
  raw: Record<string, AttendeeTraitInput> | undefined,
): Record<string, CleanAttendeeTrait> {
  const cleaned: Record<string, CleanAttendeeTrait> = {}
  if (!raw) return cleaned
  for (const [userId, trait] of Object.entries(raw)) {
    const note = trait.improvementNote.trim()
    if (trait.tags.length === 0 && note === '') continue
    cleaned[userId] = {
      displayName: trait.displayName,
      tags: trait.tags.slice(0, MAX_TAGS_PER_ATTENDEE),
      needsImprovement: note !== '',
      improvementNote: note || undefined,
    }
  }
  return cleaned
}

/** Keep only radar dimensions the user actually rated (0 = untouched). */
function cleanConnectionRadar(
  raw: Partial<ConnectionRadarState> | undefined,
): Partial<ConnectionRadarState> {
  if (!raw) return {}
  return Object.fromEntries(
    Object.entries(raw).filter(
      ([, value]) => typeof value === 'number' && value >= 1 && value <= 5,
    ),
  )
}

export function buildEventFeedbackPayload({
  rating,
  comment,
  connections,
  balanced,
}: EventFeedbackPayloadInput) {
  const payload: Record<string, unknown> = {
    ...(rating > 0 ? { rating } : {}),
    feedback: comment.trim() || undefined,
    connections,
  }

  if (!balanced) return payload

  if (typeof balanced.atmosphereScore === 'number' && balanced.atmosphereScore > 0) {
    payload.atmosphereScore = balanced.atmosphereScore
  }
  const atmosphereNote = balanced.atmosphereNote?.trim()
  if (atmosphereNote) payload.atmosphereNote = atmosphereNote

  const attendeeTraits = cleanAttendeeTraits(balanced.attendeeTraits)
  if (Object.keys(attendeeTraits).length > 0) payload.attendeeTraits = attendeeTraits

  const connectionRadar = cleanConnectionRadar(balanced.connectionRadar)
  if (Object.keys(connectionRadar).length > 0) payload.connectionRadar = connectionRadar

  if (balanced.connectionStatus) payload.connectionStatus = balanced.connectionStatus
  if (typeof balanced.hasNewConnections === 'boolean') {
    payload.hasNewConnections = balanced.hasNewConnections
  }

  const improvementAreas = (balanced.improvementAreas ?? [])
    .map((area) => area.trim())
    .filter((area) => area.length > 0)
    .slice(0, MAX_IMPROVEMENT_AREAS)
  if (improvementAreas.length > 0) payload.improvementAreas = improvementAreas

  const improvementOther = balanced.improvementOther?.trim()
  if (improvementOther) payload.improvementOther = improvementOther

  if (balanced.venueStyleRating) payload.venueStyleRating = balanced.venueStyleRating

  return payload
}

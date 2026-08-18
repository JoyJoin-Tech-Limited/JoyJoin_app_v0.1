/**
 * R3-10 lightweight experiment marker.
 *
 * Pure, dependency-free bucketing for client-side A/B markers on analytics
 * events. Given an active feature flag and a stable subject (userId when
 * logged in, anonymousId otherwise), the same subject always lands in the
 * same bucket for that flag — across sessions, devices, and the
 * anonymous→login handoff (the onboarding analytics anonymousId survives it).
 *
 * The marker is observability-only: it NEVER gates UI. Server-side feature
 * flags still decide which variant renders; the bucket on the event payload
 * lets analysis split funnel metrics by { flagKey, bucket }.
 */

export type ExperimentBucket = 'A' | 'B'

export interface ExperimentMarker {
  flagKey: string
  bucket: ExperimentBucket
}

/** FNV-1a 32-bit — tiny, stable, and identical on every device. */
export function hashExperimentSubject(subject: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < subject.length; index += 1) {
    hash ^= subject.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Deterministic bucket for a (flagKey, subject) pair. */
export function bucketForSubject(flagKey: string, subject: string): ExperimentBucket {
  // The flagKey participates in the hash so the same user decorrelates
  // across concurrent experiments instead of landing in bucket A everywhere.
  return hashExperimentSubject(`${flagKey}:${subject}`) % 2 === 0 ? 'A' : 'B'
}

export interface ResolveExperimentMarkerInput {
  /** Feature-flag key, e.g. 'personalitySlotProfileFast'. */
  flagKey: string
  /** Resolved flag value (e.g. from auth user features). Inactive flag → no marker. */
  flagEnabled?: boolean
  /** Authenticated user id — preferred subject when present. */
  userId?: string | null
  /** Client-persisted anonymous id (onboarding analytics). Fallback subject. */
  anonymousId?: string | null
}

/**
 * Returns the experiment marker for an active flag, or null when the
 * experiment is off or no stable subject exists (pre-auth, no anonymous id).
 */
export function resolveExperimentMarker(
  input: ResolveExperimentMarkerInput,
): ExperimentMarker | null {
  if (!input.flagEnabled) {
    return null
  }
  const userId = typeof input.userId === 'string' && input.userId.trim() !== '' ? input.userId : null
  const anonymousId =
    typeof input.anonymousId === 'string' && input.anonymousId.trim() !== '' ? input.anonymousId : null
  const subject = userId ?? anonymousId
  if (!subject) {
    return null
  }
  return { flagKey: input.flagKey, bucket: bucketForSubject(input.flagKey, subject) }
}

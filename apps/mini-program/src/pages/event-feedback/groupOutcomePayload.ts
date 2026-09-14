import type { SubmitGroupOutcomeRequest } from '@shared/api'
import type { ConnectionStatusLiteral } from './feedbackOptions'

/**
 * W4 (AC-W4.2a): canonical outcome wiring.
 *
 * The legacy feedback page posts rich balanced feedback to
 * `POST /api/events/:eventId/feedback` (the `event_feedback` table). That table
 * is NOT read by the matching learning pipeline. This builder maps the fields
 * the user actually provided on this page onto the canonical outcome contract
 * (`SubmitGroupOutcomeRequest`) consumed by
 * `POST /api/event-pools/:poolId/group-outcome`
 * (`event_group_outcomes` → `match_history` → calibration).
 *
 * Scope: this is the pool-event bridge only. Blind-box feedback is intentionally
 * NOT bridged here — it has no group/member radar and must not be coerced into
 * this contract.
 *
 * Mapping notes (no new user-facing UI — call wiring only):
 * - `atmosphereScore` is the thermometer value, falling back to the overall
 *   rating when the user skipped the thermometer.
 * - `wouldMeetAgain` is derived from the strongest available signals: the user
 *   selected someone to keep in touch with, set the thermometer to 4+, rated
 *   the night ≥ 4, or reported a positive post-event connection status. The
 *   atmosphere signal matters because derivation OR-poisons the pair on any
 *   `false`, so a lone 5° thermometer must not read as a negative.
 * - `connectionRadar` carries one entry per other group member (selected = 5,
 *   otherwise a neutral 3). The server validates that every key is a real group
 *   member, so only server-returned participant ids are used.
 * - `icebreakerRatings` is not collected by this surface; a single explicit
 *   `neutral` default is emitted because the schema requires a non-empty map.
 *   The derivation/calibration pipeline does not read this field.
 */

export interface GroupOutcomePayloadInput {
  groupId: string
  /** Overall experience rating (1-5, 0 = skipped). */
  rating: number
  /** Atmosphere thermometer (1-5, 0 = untouched). */
  atmosphereScore: number
  connectionStatus: ConnectionStatusLiteral | null
  selectedConnections: string[]
  /** Other members of the group, as returned by the participants endpoint. */
  memberUserIds: string[]
}

const POSITIVE_CONNECTION_STATUSES = new Set<ConnectionStatusLiteral>([
  '已交换联系方式',
  '有但还没联系',
  '没有但很愉快',
])

const SELECTED_MEMBER_SCORE = 5
const NEUTRAL_MEMBER_SCORE = 3
const NEUTRAL_ATMOSPHERE_FALLBACK = 3

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return NEUTRAL_ATMOSPHERE_FALLBACK
  return Math.min(5, Math.max(1, Math.round(value)))
}

/**
 * Build the canonical group-outcome payload, or null when it cannot be built
 * safely: no resolvable group, no other members to reference, or no usable
 * signal (everything optional was skipped).
 */
export function buildGroupOutcomePayload(
  input: GroupOutcomePayloadInput,
): SubmitGroupOutcomeRequest | null {
  const groupId = typeof input.groupId === 'string' ? input.groupId.trim() : ''
  const memberUserIds = [...new Set(input.memberUserIds)].filter(
    (memberId): memberId is string => typeof memberId === 'string' && memberId.length > 0,
  )

  // The schema requires a non-empty connectionRadar whose keys are group
  // members, so a payload without members is unbuildable.
  if (!groupId || memberUserIds.length === 0) {
    return null
  }

  const selected = new Set(
    input.selectedConnections.filter((userId) => memberUserIds.includes(userId)),
  )

  // An all-optional-skipped submission carries no outcome. `wouldMeetAgain`
  // uses OR-semantics at derivation time (one `false` poisons the pair), so
  // persisting an empty row would inject a false negative into calibration.
  const hasSignal =
    selected.size > 0 ||
    input.rating > 0 ||
    input.atmosphereScore > 0 ||
    input.connectionStatus !== null
  if (!hasSignal) {
    return null
  }

  // Thermometer wins; the overall rating is the fallback; neutral when only a
  // connection-status signal was provided (never the 1-point floor).
  const atmosphereSource =
    input.atmosphereScore > 0
      ? input.atmosphereScore
      : input.rating > 0
        ? input.rating
        : NEUTRAL_ATMOSPHERE_FALLBACK
  const atmosphereScore = clampScore(atmosphereSource)

  // A lone warm thermometer (4-5°) is a positive signal even if the user never
  // touched the rating faces or connection status. Omitting it here turned a
  // satisfied-but-quiet user into a hard `false` that OR-poisoned the pair for
  // every member (`shouldSkipNegative...` style derivation), so it must be part
  // of the positive set. `atmosphereScore` already folds in the rating fallback.
  const wouldMeetAgain =
    selected.size > 0 ||
    atmosphereScore >= 4 ||
    input.rating >= 4 ||
    (input.connectionStatus !== null &&
      POSITIVE_CONNECTION_STATUSES.has(input.connectionStatus))

  const connectionRadar: Record<string, number> = {}
  for (const memberUserId of memberUserIds) {
    connectionRadar[memberUserId] = selected.has(memberUserId)
      ? SELECTED_MEMBER_SCORE
      : NEUTRAL_MEMBER_SCORE
  }

  return {
    groupId,
    atmosphereScore,
    wouldMeetAgain,
    connectionRadar,
    icebreakerRatings: { overall: 'neutral' },
  }
}

/**
 * Canonical event-group-outcome API contract.
 *
 * Request body for `POST /api/event-pools/:poolId/group-outcome`, consumed by
 * `insertEventGroupOutcomeSchema` on the server and produced by the
 * mini-program feedback page. Server-owned fields (`id`, `poolId`,
 * `submittedBy`, `submittedAt`, `updatedAt`) are intentionally omitted.
 *
 * Scope note: this is the **pool-event** outcome path only (it feeds
 * `event_group_outcomes` → `match_history` → calibration). The legacy
 * blind-box `event_feedback` surface is intentionally NOT bridged onto this
 * DTO — blind-box feedback does not carry a `groupId`/member radar and must
 * not be coerced into a shape the matching pipeline would misread.
 */
export interface SubmitGroupOutcomeRequest {
  /** Matched group id the outcome applies to. */
  groupId: string
  /** Atmosphere thermometer / overall experience, 1-5. */
  atmosphereScore: number
  /** Strongest available positive signal; OR-semantics at derivation time. */
  wouldMeetAgain: boolean
  /** Per-other-member chemistry score, 1-5 (keys must be real group members). */
  connectionRadar: Record<string, number>
  /** Icebreaker phase ratings; schema requires at least one entry. */
  icebreakerRatings: Record<string, 'helpful' | 'neutral' | 'awkward'>
  /** Optional free-text signal, content-moderated server-side before persist. */
  freeTextSignal?: string | null
}

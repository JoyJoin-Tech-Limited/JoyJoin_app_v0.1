import type { ApiTransport } from './core.js'

/**
 * One tablemate in the event-feedback mutual-contact picker (2026-07-28).
 * Privacy-minimal baseline (head, name) extended 2026-10-16 with the same
 * visibility-gated identity fields the pool-group detail already exposes to
 * tablemates (ageLabel / industryLabel / gender) plus the user's self-selected
 * socialTag — the feedback wrap-up row renders them so an alias like 「晨曦」
 * can be tied back to the actual person met at the table. WeChat id and any
 * free-text bio stay server-side.
 */
export interface EventParticipantSummary {
  id: string
  displayName: string
  firstName: string | null
  /** Archetype id (coalesced from primary_archetype + legacy archetype). */
  archetype: string | null
  /** Approved profile image, falling back to the user's WeChat avatar. */
  avatarUrl?: string | null
  /** Visibility-gated age band (e.g. "95后"), null when hidden. */
  ageLabel?: string | null
  /** 女性 / 男性; null when the user chose 不透露. */
  gender?: string | null
  /** Visibility-gated industry label (segment ?? category), null when hidden. */
  industryLabel?: string | null
  /** Self-selected social identity tag (e.g. "数据拓荒人·巷口密探"). */
  socialTag?: string | null
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

/**
 * Canonical preset impression tags for the event-feedback wrapup step
 * (「同桌给你的感觉」 chips). Purely positive first impressions by design.
 *
 * Server-side consumers (e.g. the connections-tab 印象标签回流 aggregation in
 * `apps/server/src/repositories/connectionsRepo.ts`) filter against this list
 * so only preset words ever surface — crafted payloads cannot inject
 * arbitrary strings onto another user's connection card.
 *
 * NOTE (2026-10-16): the mini-program keeps its own copy at
 * `apps/mini-program/src/pages/event-feedback/feedbackOptions.ts`
 * (`ATTENDEE_TRAIT_PRESETS`). The two MUST stay in sync; the mini-program
 * copy could not be switched over to this shared constant in the same pass
 * because that file was under active in-flight work. Order here defines the
 * deterministic tie-break when two tags carry the same frequency.
 */
export const POSITIVE_IMPRESSION_TAG_PRESETS = [
  '有趣',
  '会聊天',
  '温暖',
  '会倾听',
  '有想法',
  '活跃',
  '同频',
] as const
export type PositiveImpressionTag = (typeof POSITIVE_IMPRESSION_TAG_PRESETS)[number]

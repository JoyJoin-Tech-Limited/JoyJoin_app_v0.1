/**
 * Wrap-up step derivations (2026-10-16 extraction).
 *
 * The event-day title anchor and the pre-submit order-summary line are pure
 * display rules with real edge cases (missing/unparseable dateTime, empty
 * optional fields, whitespace-only notes) — they lived inline in index.tsx
 * and are locked by __tests__/feedbackSummary.test.ts from here on.
 */

/**
 * 「10.15 那局，怎么样？」— anchor the title to the actual event day so the
 * T+1 recap-push entry never greets the user with a "昨晚" mismatch.
 *
 * `dateTime` is a true UTC instant (pool date_time read path), so the label is
 * derived in business time (+8) rather than the device timezone — a traveller
 * in another TZ still sees the calendar day the event happened in China.
 * Returns null when the date is missing/unparseable (caller falls back to
 * 「这局怎么样？」).
 */
export function formatEventDayLabel(dateTime: string | null | undefined): string | null {
  if (!dateTime) return null
  const date = new Date(dateTime)
  if (Number.isNaN(date.getTime())) return null
  const businessTime = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  return `${businessTime.getUTCMonth() + 1}.${businessTime.getUTCDate()}`
}

export interface WrapupSummaryInput {
  attendees: ReadonlyArray<{ id: string }>
  attendeeTraits: Record<string, { tags: readonly string[]; note: string } | undefined>
  improvementAreas: readonly string[]
  comment: string
}

/**
 * Pre-submit order-summary (#14): proves the form understood the user at the
 * exact commit point. Returns [] when everything is empty — the caller renders
 * nothing rather than shaming an empty optional form.
 */
export function buildWrapupSummaryParts({
  attendees,
  attendeeTraits,
  improvementAreas,
  comment,
}: WrapupSummaryInput): string[] {
  const parts: string[] = []
  const taggedCount = attendees.filter((a) => (attendeeTraits[a.id]?.tags.length ?? 0) > 0).length
  if (taggedCount > 0) parts.push(`${taggedCount} 位伙伴的印象`)
  const noteCount = attendees.filter((a) => (attendeeTraits[a.id]?.note.trim() ?? '') !== '').length
  if (noteCount > 0) parts.push(`${noteCount} 条印象补充`)
  if (improvementAreas.length > 0) parts.push(`${improvementAreas.length} 条建议`)
  if (comment.trim() !== '') parts.push('留言')
  return parts
}

import type {
  StructuredInterestSelection,
  StructuredInterestTopPriority,
  UserInterestsResponse,
} from '@shared/api'

/**
 * entryCardFacts — deterministic facts shown on the entry card face.
 *
 * The card face ranks the user's real interest selections. It never samples
 * one row per tier (that would invent a shape the user did not choose) and it
 * never normalizes against the strongest row, because a user whose strongest
 * interest is 感兴趣 must still see a 33% bar rather than a full one.
 */

export interface EntryCardInterestFact {
  topicId: string
  label: string
  level: 1 | 2 | 3
  heat: 3 | 10 | 25
}

export interface EntryCardInterestFacts {
  /** Top rows for the card face, capped by `limit`. */
  items: EntryCardInterestFact[]
  /** Every deduped row, ranked. The card back and archive consume this. */
  all: EntryCardInterestFact[]
  /** Deduped row count (not `totalSelections`, which can double-count). */
  total: number
}

type InterestSource =
  | Pick<UserInterestsResponse, 'selections' | 'topPriorities'>
  | null
  | undefined

function mergeInterest(
  map: Map<string, EntryCardInterestFact>,
  rawTopicId: string | null | undefined,
  rawLabel: string | null | undefined,
  level: 1 | 2 | 3,
  heat: 3 | 10 | 25,
): void {
  const topicId = rawTopicId?.trim()
  if (!topicId) return
  const label = rawLabel?.trim() ?? ''
  const previous = map.get(topicId)

  if (!previous) {
    map.set(topicId, { topicId, label, level, heat })
    return
  }

  if (level > previous.level) previous.level = level
  if (heat > previous.heat) previous.heat = heat
  // A priority row can arrive without a label; keep the named selection.
  if (!previous.label && label) previous.label = label
}

/**
 * Merge `selections` and `topPriorities` by topic id, take the strongest
 * signal for each topic, drop rows with no usable copy, then rank by
 * level → heat → stable topic id.
 */
export function buildEntryCardInterestFacts(
  source: InterestSource,
  limit = 4,
): EntryCardInterestFacts {
  const map = new Map<string, EntryCardInterestFact>()

  source?.selections?.forEach((selection: StructuredInterestSelection) => {
    // Defensive: a legacy payload may miss level/heat even though the type
    // requires them. Fall back to the weakest honest row, never a fabricated
    // stronger one.
    const level = selection.level === 2 || selection.level === 3 ? selection.level : 1
    const heat = selection.heat === 10 || selection.heat === 25 ? selection.heat : 3
    mergeInterest(map, selection.topicId, selection.label, level, heat)
  })

  source?.topPriorities?.forEach((priority: StructuredInterestTopPriority) => {
    mergeInterest(map, priority.topicId, priority.label, 3, 25)
  })

  const all = [...map.values()]
    .filter((item) => item.label.length > 0)
    .sort(
      (a, b) =>
        b.level - a.level ||
        b.heat - a.heat ||
        a.topicId.localeCompare(b.topicId),
    )

  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 4

  return {
    items: all.slice(0, safeLimit),
    all,
    total: all.length,
  }
}

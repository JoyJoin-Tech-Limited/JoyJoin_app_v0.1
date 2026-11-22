import { TRAIT_DISPLAY_CONFIG } from '@shared/personality/traitDisplayConfig'

/**
 * ACOEXP trait keys in the same order the assessment result exposes them.
 * The order is intentional: it is the deterministic tie-break when two
 * traits are equally distinctive.
 */
export const ENTRY_CARD_TRAIT_KEYS = ['A', 'O', 'C', 'E', 'X', 'P'] as const

export type EntryCardTraitKey = (typeof ENTRY_CARD_TRAIT_KEYS)[number]

export type EntryCardTraitScores = Partial<Record<EntryCardTraitKey, number>>

const MIN_DEVIATION = 8
const MAX_TRAITS = 2

/**
 * Turns the six ACOEXP scores into one quiet, non-clinical line for the
 * entry card. Only the two most distinctive traits are kept; scores are
 * never displayed and a flat profile (everything near 50) returns null
 * instead of inventing a personality claim.
 */
export function buildEntryCardPersonalityLine(
  scores: EntryCardTraitScores | null | undefined,
): string | null {
  if (!scores) {
    return null
  }

  const candidates = ENTRY_CARD_TRAIT_KEYS.flatMap((key, index) => {
    const raw = scores[key]
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      return []
    }

    const value = Math.max(0, Math.min(100, raw))
    const config = TRAIT_DISPLAY_CONFIG[key]
    if (!config) {
      return []
    }

    return [
      {
        index,
        deviation: Math.abs(value - 50),
        label: value >= 50 ? config.highEndLabel : config.lowEndLabel,
      },
    ]
  })

  const distinctive = candidates
    .filter((candidate) => candidate.deviation >= MIN_DEVIATION)
    .sort((a, b) => b.deviation - a.deviation || a.index - b.index)
    .slice(0, MAX_TRAITS)

  if (distinctive.length === 0) {
    return null
  }

  return `相处方式：${distinctive.map((candidate) => candidate.label).join(' · ')}`
}

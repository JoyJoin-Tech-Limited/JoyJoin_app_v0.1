/**
 * professionTraitTags — pure derivation for the reveal card's read-only tag
 * section (two groups):
 *
 *  1. 特质 chips — deterministic archetype traits (registry content, AIGC-label
 *     exempt). Server `archetypeContext.traits` wins; the client registry is
 *     the fallback when the response carries no archetype context. This group
 *     fulfills the footer bridge line's promise (「你的『xx』特质…」).
 *  2. 印象 chips — AI `displayTags`, fail-closed behind
 *     `meta.aigc.aiGenerated === true`, and filtered so they never restate a
 *     visible ladder row (类别 / 细分 / 角色) after label normalization.
 *
 * The section is read-only — the removed-2026-09-15 tag soup sinned by being
 * remove-only tappable (false affordance); these chips carry no interaction.
 */

import { archetypeRegistry } from '@shared/personality/archetypeRegistry'
import { dedupeProfessionTags } from './professionSubmissionGuard'
import { normalizeLabelForDedup } from './professionLadderReducer'

export const MAX_ARCHETYPE_TRAIT_TAGS = 3
export const MAX_IMPRESSION_TAGS = 3

export interface ProfessionTraitTagGroups {
  /** 特质 chips (group 1) — ≤3, deterministic, always render when available. */
  archetypeTraits: string[]
  /** 印象 chips (group 2) — ≤3, AI-only (fail-closed), ladder-label filtered. */
  impressions: string[]
}

export interface DeriveProfessionTraitTagsInput {
  /** `data.displayTags` from the classify response. */
  displayTags?: readonly string[] | null
  /** `data.archetypeContext?.traits` from the classify response. */
  serverArchetypeTraits?: readonly string[] | null
  /** The user's archetype id — drives the client registry fallback. */
  userArchetype?: string | null
  /** `meta.aigc.aiGenerated === true` — the ONLY gate for 印象 chips. */
  aiGenerated?: boolean
  /** Labels of the visible, resolved ladder rows (类别 / 细分 / 角色). */
  ladderRowLabels?: readonly string[] | null
}

function capStrings(tags: readonly string[], max: number): string[] {
  return tags.slice(0, max)
}

/**
 * Group 1 — server traits first (they are already the registry traits when the
 * server resolved the archetype), client registry fallback otherwise. Unknown
 * or missing archetype → empty.
 */
export function resolveArchetypeTraitTags(
  serverArchetypeTraits: readonly string[] | null | undefined,
  userArchetype: string | null | undefined,
): string[] {
  const server = dedupeProfessionTags(serverArchetypeTraits)
  if (server.length > 0) return capStrings(server, MAX_ARCHETYPE_TRAIT_TAGS)
  if (!userArchetype) return []
  const record = archetypeRegistry[userArchetype as keyof typeof archetypeRegistry]
  const registryTraits = Array.isArray(record?.narrative?.traits) ? record.narrative.traits : []
  return capStrings(dedupeProfessionTags(registryTraits), MAX_ARCHETYPE_TRAIT_TAGS)
}

/**
 * Group 2 — AI 印象 chips. Fail-closed: anything short of an explicit
 * `aiGenerated === true` renders nothing. Tags that merely restate a visible
 * ladder row label (after AC-22 normalization, so 「并购顾问」 matches the
 * 角色 row and 「前端工程师」 matches a 前端开发 细分) are dropped — the card
 * must never look duplicated.
 */
export function resolveImpressionTags(
  displayTags: readonly string[] | null | undefined,
  aiGenerated: boolean | undefined,
  ladderRowLabels: readonly string[] | null | undefined,
): string[] {
  if (aiGenerated !== true) return []
  const ladderKeys = new Set(
    (ladderRowLabels ?? [])
      .map((label) => normalizeLabelForDedup(label))
      .filter((key) => key.length > 0),
  )
  const filtered = dedupeProfessionTags(displayTags).filter((tag) => {
    const key = normalizeLabelForDedup(tag)
    return key.length > 0 && !ladderKeys.has(key)
  })
  return capStrings(filtered, MAX_IMPRESSION_TAGS)
}

/** Derive both groups in one pass (memoize at the call site). */
export function deriveProfessionTraitTagGroups(
  input: DeriveProfessionTraitTagsInput,
): ProfessionTraitTagGroups {
  return {
    archetypeTraits: resolveArchetypeTraitTags(input.serverArchetypeTraits, input.userArchetype),
    impressions: resolveImpressionTags(input.displayTags, input.aiGenerated, input.ladderRowLabels),
  }
}

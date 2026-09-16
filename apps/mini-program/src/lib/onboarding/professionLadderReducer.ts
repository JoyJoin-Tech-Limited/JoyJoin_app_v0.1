/**
 * professionLadderReducer — pure state machine for the onboarding 职业坐标阶梯.
 *
 * Spec: docs/design/profession-profile-correction-spec-20260915.md §6.1 / §6.3 / §7.5
 * Contract: .git/.orchestration/sprints/sprint-contract.20260915_profession_chips_ladder.md
 *   - applyTierCorrection        (AC-05 cascade / REL-01)
 *   - deriveTiersFromOccupation  (AC-06 — 3 explicit states, never guess niche)
 *   - normalizeLabelForDedup     (AC-22 segment ≈ role de-dup)
 *
 * The ladder exposes three rows (类别 › 细分 › 角色). `industryNiche` is the
 * hidden fourth taxonomy concept (§6.1) — it is carried in state so it persists,
 * but never rendered as its own row.
 */

import { OCCUPATIONS } from '@shared/occupations'
import { findCategoryById, findNicheById, findSegmentById } from '@shared/industryTaxonomy'

export type LadderTier = 'category' | 'segment' | 'occupation'

export interface LadderValue {
  id: string
  label: string
}

/** ≤3 single-select correction options per tier (mirrors the component contract). */
export interface CorrectionCandidateMap {
  category?: LadderValue[]
  segment?: LadderValue[]
  occupation?: LadderValue[]
}

export interface ProfessionLadderState {
  category: LadderValue | null
  segment: LadderValue | null
  /** Derived `industryNiche` — persisted, never rendered as its own row (§6.1). */
  niche: LadderValue | null
  /** 角色 row — the (canonical) occupation shown to the user. */
  occupation: LadderValue | null
  /** Canonical `OCCUPATIONS.id`, decoupled from `niche.id` (§7.4). */
  standardizedOccupationId: string | null
  /** True once the user corrected at least one tier → source='user', confidence=1.0 (§7.3). */
  corrected: boolean
}

/** Result of §7.5 derivation — 3 explicit states, `niche` is never guessed. */
export interface DerivedTiers {
  category: LadderValue
  segment: LadderValue
  niche: LadderValue | null
}

/** Structural input — the persisted three-tier fields (avoids a lib → component import). */
export interface ProfessionClassificationLike {
  occupationId?: string | null
  standardizedOccupationId?: string | null
  industryCategory?: string | null
  industryCategoryLabel?: string | null
  industrySegmentNew?: string | null
  industrySegmentLabel?: string | null
  industryNiche?: string | null
  industryNicheLabel?: string | null
}

export interface LadderRowDescriptor {
  tier: LadderTier
  /** Left micro-label: 类别 / 细分 / 角色. */
  label: string
  value: LadderValue | null
  /** True when this row absorbed a near-duplicate 细分 label (AC-22). */
  merged: boolean
}

export const LADDER_TIER_LABELS: Record<LadderTier, string> = {
  category: '类别',
  segment: '细分',
  occupation: '角色',
}

/** Exposed for the submit mapper — the only generated source tag for corrected rows. */
export const USER_CORRECTED_SOURCE = 'user'
export const USER_CORRECTED_CONFIDENCE = 1

function toValue(id: string | null | undefined, label: string | null | undefined): LadderValue | null {
  if (!id) return null
  const trimmed = (label ?? '').trim()
  // A code without a label is an inconsistent pair — render it as unresolved
  // rather than showing a bare id (labels and codes must never decouple, §7.2).
  if (!trimmed) return null
  return { id, label: trimmed }
}

/**
 * §7.5 `industryNiche` derivation — three explicit states.
 *
 *  (a) occupation has `seedMappings` WITH a `niche` key → all three tiers.
 *  (b) occupation has `seedMappings` WITHOUT a `niche` key → category/segment
 *      backfilled, `niche = null`.
 *  (c) occupation has no `seedMappings` (or is unknown) → `null` (the caller
 *      keeps the upper rows untouched).
 *
 * Never guesses a niche from the occupation label.
 */
export function deriveTiersFromOccupation(
  occupationId: string | null | undefined,
): DerivedTiers | null {
  if (!occupationId) return null
  const occupation = OCCUPATIONS.find((candidate) => candidate.id === occupationId)
  if (!occupation?.seedMappings) return null

  const category = findCategoryById(occupation.seedMappings.category)
  if (!category) return null
  const segment = findSegmentById(occupation.seedMappings.category, occupation.seedMappings.segment)
  if (!segment) return null

  // State (a) only when the seed mapping actually carries a niche AND the
  // taxonomy resolves it. Otherwise niche stays null (state b) — no guessing.
  let niche: LadderValue | null = null
  if (occupation.seedMappings.niche) {
    const nicheFound = findNicheById(
      occupation.seedMappings.category,
      occupation.seedMappings.segment,
      occupation.seedMappings.niche,
    )
    if (nicheFound) {
      niche = { id: nicheFound.id, label: nicheFound.label }
    }
  }

  return {
    category: { id: category.id, label: category.label },
    segment: { id: segment.id, label: segment.label },
    niche,
  }
}

/**
 * AC-05 cascade (§7.5):
 *  - change 类别 → clears segment / niche / role (→ 待补充)
 *  - change 细分 → clears niche / role; REJECTED when the segment does not
 *    belong to the current 类别 (mixed-parent guard, REL-01)
 *  - change 角色 → role + canonical id only; upper tiers are reconciled from
 *    the occupation's canonical `seedMappings` when available (rules 1–2 of
 *    §7.5 — same source, so the triple never mixes a user parent with an
 *    AI-derived child), otherwise preserved untouched (rule 3).
 */
export function applyTierCorrection(
  state: ProfessionLadderState,
  tier: LadderTier,
  choice: LadderValue,
): ProfessionLadderState {
  const nextChoice: LadderValue = { id: choice.id, label: choice.label }

  switch (tier) {
    case 'category':
      return {
        ...state,
        category: nextChoice,
        segment: null,
        niche: null,
        occupation: null,
        standardizedOccupationId: null,
        corrected: true,
      }
    case 'segment': {
      // Mixed-parent guard (REL-01): a 细分 must belong to the CURRENT 类别.
      // After a 类别 correction the tray could still offer segments scoped to
      // the old category — persisting one would mix a user parent with a
      // stale child (e.g. category=金融 + segment=<tech segment>). Reject.
      if (state.category && !findSegmentById(state.category.id, choice.id)) {
        return state
      }
      return {
        ...state,
        segment: nextChoice,
        niche: null,
        occupation: null,
        standardizedOccupationId: null,
        corrected: true,
      }
    }
    case 'occupation': {
      const derived = deriveTiersFromOccupation(choice.id)
      if (!derived) {
        // State (c): keep the confirmed upper tiers, drop the stale niche.
        return {
          ...state,
          occupation: nextChoice,
          standardizedOccupationId: choice.id,
          niche: null,
          corrected: true,
        }
      }
      // States (a)/(b): reconcile the whole triple from one canonical source.
      return {
        ...state,
        category: derived.category,
        segment: derived.segment,
        niche: derived.niche,
        occupation: nextChoice,
        standardizedOccupationId: choice.id,
        corrected: true,
      }
    }
  }
}

/** Build ladder state from persisted three-tier fields (server or local classification). */
export function createLadderStateFromClassification(
  classification: ProfessionClassificationLike | null | undefined,
): ProfessionLadderState | null {
  if (!classification) return null

  const standardizedOccupationId = classification.standardizedOccupationId ?? null
  const canonical = standardizedOccupationId
    ? OCCUPATIONS.find((occupation) => occupation.id === standardizedOccupationId)
    : undefined
  // Display priority: canonical OCCUPATIONS display name → niche label.
  // The niche label covers the parallel-rollout window in which the server still
  // returns a niche id (§7.4 landing separately). No row is shown without a
  // canonical id, and raw user text is never used as a code (SEC-02).
  const occupationLabel = standardizedOccupationId
    ? (canonical?.displayName ?? classification.industryNicheLabel ?? null)
    : null

  return {
    category: toValue(classification.industryCategory, classification.industryCategoryLabel),
    segment: toValue(classification.industrySegmentNew, classification.industrySegmentLabel),
    niche: toValue(classification.industryNiche, classification.industryNicheLabel),
    occupation: toValue(standardizedOccupationId, occupationLabel),
    standardizedOccupationId,
    corrected: false,
  }
}

/**
 * Re-scope tray candidates after a parent-tier correction (REL-01 companion).
 *
 * The server ships `correctionCandidates` scoped to the ORIGINAL classification.
 * Once the user corrects 类别 (or 细分), the child-tier candidates are stale —
 * offering them would let the user persist a mixed parent/child pair. A candidate
 * is dropped only when it is PROVEN to belong to a *different* parent; candidates
 * with no `seedMappings` are kept (spec §7.5 rule 3 — the occupation↔industry
 * paths are decoupled, so an unseeded occupation is legitimate, not a mixed pair).
 */
export function rescopeCorrectionCandidates(
  candidates: CorrectionCandidateMap | null,
  tier: LadderTier,
  choice: LadderValue,
): CorrectionCandidateMap | null {
  if (!candidates) return candidates
  if (tier === 'category') {
    return {
      ...candidates,
      segment: (candidates.segment ?? []).filter(
        (candidate) => !!findSegmentById(choice.id, candidate.id),
      ),
      occupation: (candidates.occupation ?? []).filter((candidate) => {
        const seed = OCCUPATIONS.find((occupation) => occupation.id === candidate.id)?.seedMappings
        return !seed || seed.category === choice.id
      }),
    }
  }
  if (tier === 'segment') {
    return {
      ...candidates,
      occupation: (candidates.occupation ?? []).filter((candidate) => {
        const seed = OCCUPATIONS.find((occupation) => occupation.id === candidate.id)?.seedMappings
        return !seed || seed.segment === choice.id
      }),
    }
  }
  return candidates
}

/** Number of resolved (non-待补充) rows — drives analytics + the honest checkmark. */
export function countResolvedTiers(state: ProfessionLadderState | null): number {
  if (!state) return 0
  return [state.category, state.segment, state.occupation].filter(Boolean).length
}

const ROLE_SUFFIX_PATTERN =
  /(工程师|设计师|专员|经理|主管|总监|顾问|老师|人员|从业|执业|开发|工作|岗位|职位|师|员)/g
const PUNCTUATION_PATTERN = /[\s·・\-—_/（）()「」【】"'’]/g
const SEGMENT_ROLE_MERGE_MIN_LENGTH = 2

/**
 * AC-22 — canonical form for the 细分 ≈ 角色 de-dup comparison.
 * Lowercases, strips punctuation/whitespace and generic role suffixes so
 * 「前端开发」/「前端工程师」 collapse to the same key.
 */
export function normalizeLabelForDedup(label: string): string {
  return String(label ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(PUNCTUATION_PATTERN, '')
    .replace(ROLE_SUFFIX_PATTERN, '')
    .trim()
}

/**
 * AC-22 — true when 细分 and 角色 read as the same thing (normalized-equal or
 * one contains the other, e.g. 「数据」vs「数据分析师」). When merged, only the
 * 角色 row renders (the correction target), the 细分 value stays persisted.
 */
export function shouldMergeSegmentAndRole(
  segment: LadderValue | null,
  occupation: LadderValue | null,
): boolean {
  if (!segment || !occupation) return false
  const a = normalizeLabelForDedup(segment.label)
  const b = normalizeLabelForDedup(occupation.label)
  if (!a || !b) return false
  if (a === b) return true
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
  return shorter.length >= SEGMENT_ROLE_MERGE_MIN_LENGTH && longer.includes(shorter)
}

/** Rendered ladder rows, with the 细分 row folded into 角色 when near-duplicate. */
export function resolveVisibleLadderRows(
  state: ProfessionLadderState | null,
): LadderRowDescriptor[] {
  if (!state) return []
  const merged = shouldMergeSegmentAndRole(state.segment, state.occupation)
  const rows: LadderRowDescriptor[] = [
    { tier: 'category', label: LADDER_TIER_LABELS.category, value: state.category, merged: false },
  ]
  if (!merged) {
    rows.push({ tier: 'segment', label: LADDER_TIER_LABELS.segment, value: state.segment, merged: false })
  }
  rows.push({
    tier: 'occupation',
    label: LADDER_TIER_LABELS.occupation,
    value: state.occupation,
    merged,
  })
  return rows
}

export interface PersistedClassificationFields {
  standardizedOccupationId: string | null
  industryCategory: string | null
  industryCategoryLabel: string | null
  industrySegmentNew: string | null
  industrySegmentLabel: string | null
  industryNiche: string | null
  industryNicheLabel: string | null
  /** Only present after a correction — sanitized to `manual` at submit (§7.3). */
  industrySource?: string
  industryConfidence?: number
}

/**
 * §7.2 — codes and labels always move together; corrected rows carry the
 * user-confirmed source/confidence so the persisted pair stays coherent.
 */
export function toPersistedClassificationFields(
  state: ProfessionLadderState,
): PersistedClassificationFields {
  const fields: PersistedClassificationFields = {
    standardizedOccupationId: state.standardizedOccupationId,
    industryCategory: state.category?.id ?? null,
    industryCategoryLabel: state.category?.label ?? null,
    industrySegmentNew: state.segment?.id ?? null,
    industrySegmentLabel: state.segment?.label ?? null,
    industryNiche: state.niche?.id ?? null,
    industryNicheLabel: state.niche?.label ?? null,
  }
  if (state.corrected) {
    fields.industrySource = USER_CORRECTED_SOURCE
    fields.industryConfidence = USER_CORRECTED_CONFIDENCE
  }
  return fields
}

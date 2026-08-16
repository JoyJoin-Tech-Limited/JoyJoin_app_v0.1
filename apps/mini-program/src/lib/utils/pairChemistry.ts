import type { PoolGroupMemberSummary } from '@shared/api'

/**
 * Pair-chemistry display helpers shared by every 桌友 surface (squad unboxing
 * deck, matching-status carousels, pool-group-detail strip). Extracted from
 * `pages/squad-unboxing/squadUnboxingViewModels.ts` (2026-08-15) so the
 * lightweight `TablemateCard` component does not import from a page module.
 * The view-models module re-exports everything below for backward compat.
 */

export type ChemistryType = 'fire' | 'warm' | 'cold' | 'mild'

export const CHEMISTRY_TITLES: Record<ChemistryType, string> = {
  fire: '超级火花',
  warm: '暖意融融',
  mild: '相聊甚欢',
  cold: '慢慢发现',
}

export const CHEMISTRY_FALLBACK_WORD = '今晚有戏'

export function scoreToChemistryType(score: number): ChemistryType {
  // Mirrors server `getTemperatureLevel` thresholds (poolMatchingService.ts):
  // fire >= 85, warm >= 70, mild >= 55, else cold.
  if (score >= 85) return 'fire'
  if (score >= 70) return 'warm'
  if (score >= 55) return 'mild'
  return 'cold'
}

export function getPairChemistryWord(score?: number | null): string {
  if (typeof score !== 'number' || Number.isNaN(score)) return CHEMISTRY_FALLBACK_WORD
  return CHEMISTRY_TITLES[scoreToChemistryType(score)]
}

/**
 * Raw chemistry tier for a pair score (2026-07-24 polish): drives the
 * tier-aware temperature-chip tint — a cold read must not wear hot pink.
 */
export function getPairChemistryTier(score?: number | null): ChemistryType | null {
  if (typeof score !== 'number' || Number.isNaN(score)) return null
  return scoreToChemistryType(score)
}

/**
 * Tier → JoyJoinIcon chemistry-tier emoji key (2026-08-16 polish): the
 * temperature chips on 桌友 cards / detail sheets render the mapped
 * proprietary icon. Emoji literals stay in the `emoji:` shape so the
 * mini-program inline-emoji guardrail recognises them as icon-system usage.
 */
export const CHEMISTRY_TIER_EMOJI: Record<ChemistryType, { emoji: string }> = {
  fire: { emoji: '🔥' },
  warm: { emoji: '✨' },
  mild: { emoji: '🌱' },
  cold: { emoji: '💬' },
}

/**
 * Server-side connection copy sometimes arrives wrapped in full-width parens
 * (e.g. （都偏内向细腻）). Inside the pill's 1-line nowrap+ellipsis the leading
 * （ made the truncated text read as a severed fragment (`（都偏内向…`). Strip
 * one pair of WRAPPING full-width parens so the pill starts with content.
 * Inner parens and unbalanced pairs are left untouched.
 */
export function stripConnectionPointParens(text: string): string {
  const value = (text ?? '').trim()
  if (value.length >= 2 && value.startsWith('（') && value.endsWith('）')) {
    return value.slice(1, -1).trim()
  }
  return value
}

/**
 * Card-pill copy budget (2026-07-24 full-marks): a mid-glyph ellipsis
 * (`都爱在…`) reads as broken, not mysterious. Strip the leading filler
 * （都 / 爱在 / 喜欢 / 是 / 偏 …) so the pill carries the semantic core
 * ("咖啡馆里发呆", "阅读习惯相似") and only ellipsizes truly long tails.
 * Display-only — narration keeps the full governed copy.
 */
export function shortenConnectionPointForPill(text: string): string {
  let value = stripConnectionPointParens(text)
  value = value.replace(/^都/, '')
  value = value.replace(/^(爱在|喜欢去|喜欢看|喜欢听|喜欢|爱看|爱去|爱听|爱)/, '')
  value = value.replace(/^(是|偏|偏好|相信)/, '')
  return value.trim() || stripConnectionPointParens(text)
}

/**
 * Row-4 fallback hook (2026-07-16 PM "every card has a hook"): when a card
 * has no viewer connection point, the hook pill falls back to the member's
 * top interest so every card deals a full 4-row face. Returns the first
 * non-empty trimmed interest, or '' when the member has none (row 4 then
 * collapses, same as before).
 */
export function buildInterestHookText(member?: PoolGroupMemberSummary | null): string {
  return (member?.topInterests ?? []).map((interest) => (interest ?? '').trim()).filter(Boolean)[0] ?? ''
}

export function buildPairKeyMemberMap(
  members: PoolGroupMemberSummary[],
): Map<string, [PoolGroupMemberSummary, PoolGroupMemberSummary]> {
  const map = new Map<string, [PoolGroupMemberSummary, PoolGroupMemberSummary]>()

  for (let index = 0; index < members.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < members.length; nextIndex += 1) {
      const pairKey = [members[index].userId, members[nextIndex].userId].sort().join('-')
      map.set(pairKey, [members[index], members[nextIndex]])
    }
  }

  return map
}

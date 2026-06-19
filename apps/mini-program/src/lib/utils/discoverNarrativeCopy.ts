/**
 * Discover Narrative Copy — Oracle Card copy system
 *
 * Emotion-led, mystery-first copy for blind-box social event cards.
 * The 4-branch narrative pivot (empty / rare / present / dominant) selects
 * the emotional frame — numbers drive branch selection but never appear in copy.
 *
 * Design principle (PM-approved 2026-06-20):
 *   The card is a mirror, not a menu. It answers "are my people here?"
 *   through emotional resonance, not data disclosure.
 *
 * HARD RULES:
 *   - Never emit raw match counts, percentages, or "AI"/"匹配"
 *   - Every emotional claim must be data-anchored (e.g. highChemistry > 0
 *     before promising compatibility)
 *   - Zero command-form CTAs; invites over pushes
 *   - No "你" starting two consecutive sentences
 */

import type { EventPoolSummary } from '@shared/api'

const BANNED_WORDS = ['AI', '匹配']

function guardBannedWords(text: string): string {
  for (const word of BANNED_WORDS) {
    if (text.includes(word)) {
      throw new Error(`Banned word "${word}" detected in narrative copy: ${text}`)
    }
  }
  return text
}

/**
 * Generate the one-line type-density teaser for the Oracle Card (L5).
 * Emotion-driven — hints at who's inside without revealing counts.
 */
export function getTypeDensityTeaser(
  pool: EventPoolSummary,
  userArchetype: string | null
): string {
  const { userTypeCount = 0, highChemistryCount = 0, registrationCount = 0, narrativePivot } = pool

  // Null archetype fallback — warm but generic
  if (!userArchetype) {
    const text = registrationCount > 0
      ? '大家已经开始入座了'
      : '第一张椅子已经摆好了'
    return guardBannedWords(text)
  }

  switch (narrativePivot) {
    case 'empty':
      return guardBannedWords('这场局的故事还没开始写 · 第一个坐下的，总会遇到最有意思的人')

    case 'rare':
      return guardBannedWords('同类不多，但恰好有几个频率相同的人')

    case 'present':
      if (highChemistryCount > 0) {
        return guardBannedWords('这场局的氛围，已经有点像你了 · 有几个跟你很合拍的人也在这里')
      }
      return guardBannedWords('这场局的氛围，已经有点像你了')

    case 'dominant':
      if (highChemistryCount > 0) {
        return guardBannedWords('这场局的气质，就是你 · 有几个跟你很合拍的人也在这里')
      }
      return guardBannedWords('这场局的气质，就是你')

    default:
      if (userTypeCount > 0) {
        return guardBannedWords('氛围正热，来加入')
      }
      return guardBannedWords('新局刚开，等你来')
  }
}

/**
 * Generate CTA label with primary (invitation) and fallback (transactional) variants.
 */
export function getCtaLabel(
  pool: EventPoolSummary
): { primary: string; fallback: string } {
  const price = pool.price
  if (price != null && price > 0) {
    return {
      primary: `看看谁在等你 · ¥${price}`,
      fallback: `立即报名 · ¥${price}`,
    }
  }

  return {
    primary: '看看谁在等你',
    fallback: '立即报名',
  }
}

/**
 * Generate the personalized hero message for the Oracle Card (L1).
 * The most prominent text — answers "are my people here?"
 */
export function getHeroMessage(
  pool: EventPoolSummary,
  userArchetype: string | null
): string {
  const { highChemistryCount = 0, narrativePivot, userTypeCount = 0 } = pool

  if (!userArchetype) {
    return guardBannedWords('这里有值得认识的人')
  }

  // Data-anchored: high-chemistry takes priority across all pivots
  if (highChemistryCount > 0) {
    return guardBannedWords('这里藏着一个跟你很合拍的人')
  }

  switch (narrativePivot) {
    case 'empty':
      return guardBannedWords('这张桌子刚摆好，第一个位置留给你了')

    case 'rare':
      return guardBannedWords('你的类型在这里很少见 · 来了就是惊喜')

    case 'present':
    case 'dominant':
    default:
      if (userTypeCount > 0) {
        return guardBannedWords('跟你相似的人已经入座了')
      }
      return guardBannedWords('这里有值得认识的人')
  }
}

// ─── ParticipantPresenceStrip copy helpers ─────────────────────

export interface PresenceStripCountInput {
  state: 'empty' | 'partial' | 'almost_full' | 'full'
  count: number
  max: number | undefined
}

export interface PresenceStripAriaInput extends PresenceStripCountInput {
  hasUserArchetype: boolean
}

/**
 * Generate the visible count label for the ParticipantPresenceStrip.
 */
export function getPresenceStripCountLabel({
  state,
  count,
  max,
}: PresenceStripCountInput): string {
  if (state === 'empty') {
    const text = typeof max === 'number' && max > 0
      ? `虚位以待 · 0/${max}`
      : '虚位以待'
    return guardBannedWords(text)
  }

  if (state === 'full') {
    const text = typeof max === 'number' && max > 0
      ? `${count}/${max}`
      : '已满员'
    return guardBannedWords(text)
  }

  if (state === 'almost_full') {
    const text = typeof max === 'number' && max > 0
      ? `即将满员 · ${count}/${max}`
      : `${count} 位已入座`
    return guardBannedWords(text)
  }

  // partial
  if (typeof max === 'number' && max > 0) {
    return guardBannedWords(`${count}/${max}`)
  }

  return guardBannedWords(`${count} 位已入座`)
}

/**
 * Generate an aggregate aria-label for the ParticipantPresenceStrip.
 */
export function getPresenceStripAriaLabel({
  state,
  count,
  max,
  hasUserArchetype,
}: PresenceStripAriaInput): string {
  if (state === 'empty') {
    const text = typeof max === 'number' && max > 0
      ? `虚位以待，0/${max}`
      : '虚位以待'
    return guardBannedWords(text)
  }

  if (state === 'full') {
    return guardBannedWords('已满员')
  }

  if (state === 'almost_full') {
    const text = typeof max === 'number' && max > 0
      ? `即将满员，${count}/${max}`
      : `即将满员，${count} 人已入池`
    return guardBannedWords(text)
  }

  // partial
  const hasMax = typeof max === 'number' && max > 0
  const seatText = hasMax ? `${count}/${max}` : `${count} 人已入池`
  const text = hasUserArchetype
    ? `${seatText} 已入池，包含你的类型`
    : `${seatText} 已入池`
  return guardBannedWords(text)
}

/**
 * Generate subline text for the type-density teaser.
 */
export function getTypeDensitySubline(pool: EventPoolSummary): string {
  const { topComplementaryType } = pool

  if (topComplementaryType) {
    return guardBannedWords('最佳搭档类型已入池')
  }

  return guardBannedWords('好奇的话，点开看看')
}

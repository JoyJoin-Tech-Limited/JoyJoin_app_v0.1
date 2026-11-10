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
import { ARCHETYPE_FAMILY_MAP } from '@shared/archetypeColors'

const BANNED_WORDS = ['AI', '匹配']

/**
 * The teaser describes the pool, not the viewer. A room's "atmosphere" is the
 * aggregate of everyone who registered, so we summarise the dominant archetype
 * family instead of claiming the whole room resembles one person.
 */
const FAMILY_TEASER: Record<string, { line: string; word: string }> = {
  warm: { line: '这桌自带热场体质', word: '热络' },
  fire: { line: '这局有点小火花', word: '有火花' },
  cool: { line: '松弛得很高级，不用急着表现', word: '松弛' },
  calm: { line: '安静但不冷场，适合慢慢聊', word: '安静' },
}

/** No usable archetype sample — stay honest instead of inventing a vibe. */
const TEASER_FALLBACK = '这局的气质还在长，等你来定个调'
/** Only appended when a real compatible person is in the pool. */
const CHEMISTRY_SUFFIX = ' · 其中几个跟你特别对得上'

function resolvePoolFamily(pool: EventPoolSummary): string | null {
  const tally: Record<string, number> = {}

  const add = (archetype: string | null | undefined, weight: number) => {
    if (!archetype) return
    // Only trusted archetype ids contribute; unknown ids must not invent a vibe.
    const family = ARCHETYPE_FAMILY_MAP[archetype]
    if (!family) return
    tally[family] = (tally[family] ?? 0) + weight
  }

  if (pool.topArchetypes?.length) {
    pool.topArchetypes.forEach(({ archetype, count }) => add(archetype, Math.max(1, count ?? 1)))
  } else if (pool.sampleArchetypes?.length) {
    pool.sampleArchetypes.forEach((archetype) => add(archetype, 1))
  }

  let dominant: string | null = null
  let dominantCount = 0
  for (const [family, count] of Object.entries(tally)) {
    if (count > dominantCount) {
      dominant = family
      dominantCount = count
    }
  }

  return dominant
}

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

    case 'present': {
      // Group portrait: describe what the room is like, not who the viewer is.
      const family = resolvePoolFamily(pool)
      const base = (family && FAMILY_TEASER[family]?.line) || TEASER_FALLBACK
      return guardBannedWords(
        highChemistryCount > 0 ? `${base}${CHEMISTRY_SUFFIX}` : base
      )
    }

    case 'dominant': {
      const family = resolvePoolFamily(pool)
      const word = family ? FAMILY_TEASER[family]?.word : null
      const base = word ? `这桌多半和你一个频道 · ${word}` : '这桌多半和你一个频道'
      return guardBannedWords(
        highChemistryCount > 0 ? `${base}${CHEMISTRY_SUFFIX}` : base
      )
    }

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
    // Empty pools are invitation moments — frame as an exclusive opening,
    // not a capacity readout. Never emit "0/max" which turns the card into a menu.
    return guardBannedWords('首座留给你')
  }

  if (state === 'full') {
    const text = typeof max === 'number' && max > 0
      ? `${count}/${max}`
      : '已满员'
    return guardBannedWords(text)
  }

  if (state === 'almost_full') {
    // 报名池口径：这里说的是“多少个名额已被报名占用”，不是桌位。
    const text = typeof max === 'number' && max > 0
      ? `${count} 人已报名 · 剩 ${max - count} 个名额`
      : `${count} 人已报名`
    return guardBannedWords(text)
  }

  // partial
  return guardBannedWords(`${count} 人已报名`)
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
    return guardBannedWords('虚位以待，首座留给你')
  }

  if (state === 'full') {
    return guardBannedWords('已满员')
  }

  if (state === 'almost_full') {
    const text = typeof max === 'number' && max > 0
      ? `${count} 人已报名，还剩 ${max - count} 个名额`
      : `${count} 人已报名`
    return guardBannedWords(text)
  }

  // partial
  const text = `${count} 人已报名`
  return guardBannedWords(
    hasUserArchetype ? `${text}，包含你的类型` : text
  )
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

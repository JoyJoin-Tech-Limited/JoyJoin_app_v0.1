/**
 * Discover Narrative Copy — Oracle Card copy system
 *
 * 4-branch narrative pivot (Phase 2):
 * - 'empty': pool has < 3 registrants
 * - 'rare': user archetype is scarce in this pool
 * - 'present': user archetype is present but not dominant
 * - 'dominant': user archetype is dominant in this pool
 *
 * HARD RULE: These functions must NEVER emit strings containing
 * "AI" or "匹配". Banned words are enforced by unit test.
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
 * Generate the one-line type-density teaser for the Oracle Card.
 */
export function getTypeDensityTeaser(
  pool: EventPoolSummary,
  userArchetype: string | null
): string {
  const { userTypeCount = 0, highChemistryCount = 0, topComplementaryType, registrationCount = 0, narrativePivot } = pool

  // Null archetype fallback
  if (!userArchetype) {
    const text = registrationCount > 0
      ? `${registrationCount} 位探索者已加入`
      : '首批探索者虚位以待'
    return guardBannedWords(text)
  }

  // 4-branch Phase 2
  switch (narrativePivot) {
    case 'empty':
      return guardBannedWords('首批探索者已就位 · 你来定义氛围')

    case 'rare': {
      if (highChemistryCount > 0) {
        return guardBannedWords(`你的类型很稀有 · 高默契类型: ${highChemistryCount}人`)
      }
      return guardBannedWords(`你的类型在此局较稀有 · 目前仅 ${userTypeCount} 个同类`)
    }

    case 'present': {
      if (highChemistryCount > 0 && topComplementaryType) {
        return guardBannedWords(`${userTypeCount} 个同类已加入 · 高默契: ${highChemistryCount}人`)
      }
      if (highChemistryCount > 0) {
        return guardBannedWords(`高默契类型: ${highChemistryCount}人已入池`)
      }
      return guardBannedWords(`${userTypeCount} 个同类已加入 · 氛围正热`)
    }

    case 'dominant': {
      if (highChemistryCount > 0) {
        return guardBannedWords(`${userTypeCount} 个同类已加入 · 高默契: ${highChemistryCount}人`)
      }
      return guardBannedWords(`${userTypeCount} 个同类已加入 · 你的类型在此局占主导`)
    }

    default: {
      if (userTypeCount === 0) {
        return guardBannedWords('首批探索者虚位以待')
      }
      return guardBannedWords(`${userTypeCount} 个同类已加入 · 氛围正热`)
    }
  }
}

/**
 * Generate CTA label with primary (reframed) and fallback (transactional) variants.
 */
export function getCtaLabel(
  pool: EventPoolSummary
): { primary: string; fallback: string } {
  const price = pool.price
  if (price != null && price > 0) {
    return {
      primary: `解锁默契地图 · ¥${price}`,
      fallback: `立即报名 · ¥${price}`,
    }
  }

  return {
    primary: '解锁默契地图',
    fallback: '立即报名',
  }
}

/**
 * Generate the personalized hero message for the Oracle Card.
 */
export function getHeroMessage(
  pool: EventPoolSummary,
  userArchetype: string | null
): string {
  const { highChemistryCount = 0, narrativePivot } = pool

  if (!userArchetype) {
    return guardBannedWords('这局有值得认识的人')
  }

  switch (narrativePivot) {
    case 'empty':
      return guardBannedWords('首批探索者虚位以待')

    case 'rare': {
      if (highChemistryCount > 0) {
        return guardBannedWords(`这局有 ${highChemistryCount} 个高默契对象`)
      }
      return guardBannedWords('你的类型在此局很亮眼')
    }

    case 'present': {
      if (highChemistryCount > 0) {
        return guardBannedWords(`这局有 ${highChemistryCount} 个高默契对象`)
      }
      return guardBannedWords('同类已聚集 · 等你加入')
    }

    case 'dominant': {
      if (highChemistryCount > 0) {
        return guardBannedWords(`这局有 ${highChemistryCount} 个高默契对象`)
      }
      return guardBannedWords('同类众多 · 等你加入')
    }

    default:
      return guardBannedWords('同类已聚集 · 等你加入')
  }
}

/**
 * Generate subline text for the type-density teaser.
 */
export function getTypeDensitySubline(pool: EventPoolSummary): string {
  const { topComplementaryType } = pool

  if (topComplementaryType) {
    return guardBannedWords(`最佳搭档类型已入池`)
  }

  return guardBannedWords('报名后揭晓完整人群分析')
}

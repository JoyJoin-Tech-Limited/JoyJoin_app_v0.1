/**
 * Achievement definitions for gamification.
 *
 * Single source of truth consumed by both web and mini-program clients.
 */

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface Achievement {
  id: string
  title: string
  description: string
  rarity: AchievementRarity
  emoji: string
}

export const ACHIEVEMENTS: Record<string, Achievement> = {
  first_answer: {
    id: 'first_answer',
    title: '初次回答',
    description: '完成第一道题目',
    rarity: 'common',
    emoji: '🎯',
  },
  quick_thinker: {
    id: 'quick_thinker',
    title: '快速思考',
    description: '在5秒内回答问题',
    rarity: 'rare',
    emoji: '⚡',
  },
  halfway_hero: {
    id: 'halfway_hero',
    title: '半程英雄',
    description: '完成50%的进度',
    rarity: 'common',
    emoji: '🏃',
  },
  explorer: {
    id: 'explorer',
    title: '探索者',
    description: '使用换题功能',
    rarity: 'common',
    emoji: '🔍',
  },
  destined_match: {
    id: 'destined_match',
    title: '命中注定',
    description: '原型匹配度超过85%',
    rarity: 'epic',
    emoji: '✨',
  },
  night_owl: {
    id: 'night_owl',
    title: '夜猫子',
    description: '在深夜完成测评',
    rarity: 'rare',
    emoji: '🦉',
  },
  perfectionist: {
    id: 'perfectionist',
    title: '完美主义',
    description: '比最低要求多回答4道题',
    rarity: 'legendary',
    emoji: '💎',
  },
}

/**
 * Rarity-specific SCSS class names for the mini-program achievement popup.
 *
 * Web uses Tailwind utility classes directly; the mini-program maps these
 * into BEM-style class suffixes applied by AchievementPopup.scss.
 */
export function getRarityClassName(rarity: AchievementRarity): string {
  switch (rarity) {
    case 'common':
      return 'common'
    case 'rare':
      return 'rare'
    case 'epic':
      return 'epic'
    case 'legendary':
      return 'legendary'
  }
}

/** Haptic vibration pattern per rarity tier (milliseconds). */
export function getRarityHapticPattern(rarity: AchievementRarity): number[] {
  switch (rarity) {
    case 'common':
      return [50]
    case 'rare':
      return [50, 30, 50]
    case 'epic':
      return [50, 30, 50, 30, 80]
    case 'legendary':
      return [80, 40, 80, 40, 160]
  }
}

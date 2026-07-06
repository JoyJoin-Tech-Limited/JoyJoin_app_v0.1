import type { TierMachineId } from '@shared/socialIcebreakerTierManifest'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import type { VibeId } from '../../lib/vibeMapping'

export type TierPresetId = 'easy-start' | 'deep-chat' | 'play-fun'

export interface TierPreset {
  id: TierPresetId
  tier: TierMachineId
  vibe: VibeId
  title: string
  subtitle: string
  duration: string
  gameCount: string
  description: string
  recommended?: boolean
  /** Visual token for analytics/reference; maps to full-card background art. */
  iconToken: 'sparkle' | 'heart' | 'controller'
}

/** Opinionated tier+vibe presets. Reduces the 3×3 grid to 3 human intentions. */
export const TIER_PRESETS: TierPreset[] = [
  {
    id: 'easy-start',
    tier: 'breeze',
    vibe: 'balanced',
    title: '轻松破冰',
    subtitle: '对话为主 · 适合初次见面',
    duration: '40min',
    gameCount: '2 个游戏',
    description: '从轻快小游戏开始，让大家慢慢熟络',
    iconToken: 'sparkle',
  },
  {
    id: 'deep-chat',
    tier: 'glow',
    vibe: 'deep_chat',
    title: '深度畅聊',
    subtitle: '沉浸交流 · 默认推荐',
    duration: '60min',
    gameCount: '3 个游戏',
    description: '更多走心话题，聊到大家都不想散场',
    recommended: true,
    iconToken: 'heart',
  },
  {
    id: 'play-fun',
    tier: 'blaze',
    vibe: 'play_fun',
    title: '游戏狂欢',
    subtitle: '活力互动 · 适合熟人群体',
    duration: '90min',
    gameCount: '5-6 个游戏',
    description: '全量游戏环节，大家一起玩过瘾',
    iconToken: 'controller',
  },
]

/**
 * Tier card side-art is served from the CDN, consistent with the rest of the
 * Lovart icebreaker asset tree. Source files live in
 * `src/assets/lovart/icebreaker/` and are uploaded via `upload:cdn-assets`.
 */
export const TIER_CARD_BACKGROUNDS: Record<'breeze' | 'glow' | 'blaze' | 'custom', string> = {
  breeze: cdnAsset('/assets/lovart/icebreaker/tier-card-breeze.webp'),
  glow: cdnAsset('/assets/lovart/icebreaker/tier-card-glow.webp'),
  blaze: cdnAsset('/assets/lovart/icebreaker/tier-card-blaze.webp'),
  custom: cdnAsset('/assets/lovart/icebreaker/tier-card-custom.webp'),
}

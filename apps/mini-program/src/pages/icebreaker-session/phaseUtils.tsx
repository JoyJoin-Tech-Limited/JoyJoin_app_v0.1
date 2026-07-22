import { Image, View } from '@tarojs/components'
import { useState } from 'react'
import type { AtmosphereMood, SocialIcebreakerPhase } from '@shared/socialIcebreaker'
import { cdnAsset } from '../../lib/utils/cdnAssets'

export type SessionPhase = 'waiting' | SocialIcebreakerPhase | 'ended'

export interface SessionParticipant {
  userId: string
  displayName?: string
  archetype?: string
  interests?: string[]
  isHost?: boolean
  isActive?: boolean
}

/** Root-relative paths — work from any JS chunk (e.g. `dist/common.js`); avoid `require('../../assets/…')` which resolves wrong when hoisted. */
export const MOOD_OPTIONS: Array<{ mood: AtmosphereMood; label: string; asset: string }> = [
  { mood: 'funny', label: '搞笑', asset: '/pages/icebreaker-session/assets/mood-icons/mood-funny.webp' },
  { mood: 'life', label: '生活', asset: '/pages/icebreaker-session/assets/mood-icons/mood-life.webp' },
  { mood: 'relaxed', label: '轻松', asset: '/pages/icebreaker-session/assets/mood-icons/mood-relaxed.webp' },
  { mood: 'emotional', label: '情感', asset: '/pages/icebreaker-session/assets/mood-icons/mood-emotional.webp' },
]

// CDN-backed phase icons — eliminates domain-whitelist dependency and keeps the
// mini-program package small. Assets uploaded via `npm run upload:cdn-assets`.
export const PHASE_ICON_SRC_MAP: Record<string, string> = {
  warmup: cdnAsset('/assets/icons/phase-icons/phase-warmup.webp'),
  'topic-card': cdnAsset('/assets/icons/phase-icons/phase-topic-card.webp'),
  micro_challenge: cdnAsset('/assets/icons/phase-icons/phase-micro-challenge.webp'),
  lie_detective: cdnAsset('/assets/icons/phase-icons/phase-lie-detective.webp'),
  personality_dice: cdnAsset('/assets/icons/phase-icons/phase-personality-dice.webp'),
  auction: cdnAsset('/assets/icons/phase-icons/phase-auction.webp'),
  quip_battle: cdnAsset('/assets/icons/phase-icons/phase-quip-battle.webp'),
  undercover_word: cdnAsset('/assets/icons/phase-icons/phase-undercover-word.webp'),
  group_mirror: cdnAsset('/assets/icons/phase-icons/phase-group-mirror.webp'),
  speed_friending: cdnAsset('/assets/icons/phase-icons/phase-speed-friending.webp'),
  mini_script: cdnAsset('/assets/icons/phase-icons/phase-mini-script.webp'),
  recap: cdnAsset('/assets/icons/phase-icons/phase-recap.webp'),
}

export function getPhaseLabel(phase: SessionPhase): string {
  switch (phase) {
    case 'waiting':
      return '等待中'
    case 'warmup':
      return '话题卡'
    case 'micro_challenge':
      return '挑战'
    case 'lie_detective':
      return '谎言侦探'
    case 'personality_dice':
      return '人格骰子'
    case 'auction':
      return '拍卖'
    case 'speed_friending':
      return '快速交友'
    case 'quip_battle':
      return '机智对决'
    case 'undercover_word':
      return '谁是卧底'
    case 'group_mirror':
      return '群像镜像'
    case 'mini_script':
      return '迷你剧本杀'
    case 'recap':
      return '回顾'
    case 'phase_selection':
      return '环节选择'
    case 'ended':
      return '已结束'
    default:
      return phase
  }
}

/** Render a phase icon (Lovart 240px source, Taro downscales)
 *
 * Source assets are 240×240px WebP with transparent background.
 * Recommended display sizes:
 *   - 40–48rpx: inline / list / header (default)
 *   - 80rpx:  phase card header
 *   - 120rpx: hero / modal / loading
 *   - 240rpx: full-screen feature (e.g., phase intro)
 */
export function PhaseHeaderIcon({
  phase,
  size = 48,
  className,
}: {
  phase: SessionPhase | string
  size?: number
  className?: string
}) {
  const [hasError, setHasError] = useState(false)
  const sizeStr = `${size}rpx`
  const src = PHASE_ICON_SRC_MAP[phase]

  if (!src || hasError) {
    return (
      <View
        className={className}
        style={{
          width: sizeStr,
          height: sizeStr,
          borderRadius: '50%',
          background: 'rgba(139, 92, 246, 0.08)',
          border: '1rpx solid rgba(139, 92, 246, 0.12)',
          verticalAlign: 'middle',
        }}
        aria-hidden='true'
      />
    )
  }

  return (
    <Image
      src={src}
      mode='aspectFit'
      className={className}
      style={{ width: sizeStr, height: sizeStr, verticalAlign: 'middle' }}
      lazyLoad
      onError={() => setHasError(true)}
    />
  )
}

export function getMoodLabel(mood?: AtmosphereMood | null): string {
  switch (mood) {
    case 'funny':
      return '搞笑'
    case 'life':
      return '生活'
    case 'relaxed':
      return '轻松'
    case 'emotional':
      return '情感'
    default:
      return '待选择'
  }
}

import { Image, Text, View } from '@tarojs/components'
import { useState } from 'react'
import type { AtmosphereMood, SocialIcebreakerPhase } from '@shared/socialIcebreaker'
import { cdnAsset, localAsset } from '../../lib/utils/cdnAssets'

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

// Local bundled tier (icebreaker-uiux-wave1, AC-12): the 12 webp live inside
// the icebreaker-session SUBPACKAGE (copied via config/index.ts; packOptions
// include covers them) so they cost nothing against the main-package budget
// and survive CDN outages on device.
const PHASE_ICON_LOCAL_MAP: Record<string, string> = {
  warmup: '/pages/icebreaker-session/assets/phase-icons/phase-warmup.webp',
  'topic-card': '/pages/icebreaker-session/assets/phase-icons/phase-topic-card.webp',
  micro_challenge: '/pages/icebreaker-session/assets/phase-icons/phase-micro-challenge.webp',
  lie_detective: '/pages/icebreaker-session/assets/phase-icons/phase-lie-detective.webp',
  personality_dice: '/pages/icebreaker-session/assets/phase-icons/phase-personality-dice.webp',
  auction: '/pages/icebreaker-session/assets/phase-icons/phase-auction.webp',
  quip_battle: '/pages/icebreaker-session/assets/phase-icons/phase-quip-battle.webp',
  undercover_word: '/pages/icebreaker-session/assets/phase-icons/phase-undercover-word.webp',
  group_mirror: '/pages/icebreaker-session/assets/phase-icons/phase-group-mirror.webp',
  speed_friending: '/pages/icebreaker-session/assets/phase-icons/phase-speed-friending.webp',
  mini_script: '/pages/icebreaker-session/assets/phase-icons/phase-mini-script.webp',
  recap: '/pages/icebreaker-session/assets/phase-icons/phase-recap.webp',
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
      return '轮桌畅聊'
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
 *
 * Three-tier fallback chain (icebreaker-uiux-wave1, AC-12): bundled
 * subpackage asset → CDN → brand placeholder (brand-purple disc + the phase
 * label's first glyph). The pre-chain fallback was an empty purple RING —
 * on a CDN 404 it read as an unexplained white/purple block.
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
  const [srcTier, setSrcTier] = useState<'local' | 'cdn' | 'placeholder'>('local')
  const sizeStr = `${size}rpx`
  const localSrc = PHASE_ICON_LOCAL_MAP[phase]
  const cdnSrc = PHASE_ICON_SRC_MAP[phase]

  if ((!localSrc && !cdnSrc) || srcTier === 'placeholder') {
    // Brand placeholder: solid brand-purple disc + phase name first glyph.
    const label = getPhaseLabel(phase as SessionPhase)
    return (
      <View
        className={className}
        style={{
          width: sizeStr,
          height: sizeStr,
          borderRadius: '50%',
          background: '#8B5CF6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          verticalAlign: 'middle',
        }}
        aria-label={label}
      >
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: `${Math.round(size * 0.44)}rpx`,
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          {label.slice(0, 1)}
        </Text>
      </View>
    )
  }

  const effectiveTier = srcTier === 'local' && !localSrc ? 'cdn' : srcTier
  const src = effectiveTier === 'local' ? localAsset(localSrc) : cdnSrc
  return (
    <Image
      src={src}
      mode='aspectFit'
      className={className}
      style={{ width: sizeStr, height: sizeStr, verticalAlign: 'middle' }}
      lazyLoad
      onError={() => setSrcTier(effectiveTier === 'local' && cdnSrc ? 'cdn' : 'placeholder')}
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

import { Image } from '@tarojs/components'
import type { AtmosphereMood, SocialIcebreakerPhase } from '@shared/socialIcebreaker'

export type SessionPhase = 'waiting' | SocialIcebreakerPhase | 'ended'

export interface SessionParticipant {
  userId: string
  displayName?: string
  archetype?: string
  interests?: string[]
  isHost?: boolean
  isActive?: boolean
}

export const MOOD_OPTIONS: Array<{ mood: AtmosphereMood; label: string; asset: string }> = [
  { mood: 'funny', label: '搞笑', asset: '/assets/icons/mood-icons/mood-funny.png' },
  { mood: 'life', label: '生活', asset: '/assets/icons/mood-icons/mood-life.png' },
  { mood: 'relaxed', label: '轻松', asset: '/assets/icons/mood-icons/mood-relaxed.png' },
  { mood: 'emotional', label: '情感', asset: '/assets/icons/mood-icons/mood-emotional.png' },
]

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
    case 'ended':
      return '已结束'
    default:
      return phase
  }
}

const PHASE_EMOJI_MAP: Record<SessionPhase, string> = {
  waiting: '',
  warmup: '',
  micro_challenge: '',
  lie_detective: '',
  personality_dice: '',
  auction: '',
  mini_script: '',
  quip_battle: '',
  undercover_word: '',
  group_mirror: '',
  recap: '',
  ended: '',
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
  phase: SessionPhase
  size?: number
  className?: string
}) {
  const sizeStr = `${size}rpx`
  // Canonical filename mapping — WebP primary (~80-90% smaller than PNG source)
  const srcMap: Record<string, string> = {
    warmup: '/assets/icons/phase-icons/phase-warmup.webp',
    micro_challenge: '/assets/icons/phase-icons/phase-micro-challenge.webp',
    lie_detective: '/assets/icons/phase-icons/phase-lie-detective.webp',
    personality_dice: '/assets/icons/phase-icons/phase-personality-dice.webp',
    auction: '/assets/icons/phase-icons/phase-auction.webp',
    quip_battle: '/assets/icons/phase-icons/phase-quip-battle.webp',
    undercover_word: '/assets/icons/phase-icons/phase-undercover-word.webp',
    group_mirror: '/assets/icons/phase-icons/phase-group-mirror.webp',
    mini_script: '/assets/icons/phase-icons/phase-mini-script.webp',
    recap: '/assets/icons/phase-icons/phase-recap.webp',
  }
  const src = srcMap[phase]
  if (src) {
    return (
      <Image
        src={src}
        mode='aspectFit'
        className={className}
        style={{ width: sizeStr, height: sizeStr, verticalAlign: 'middle' }}
        lazyLoad
      />
    )
  }
  // Zero-emoji policy: render nothing if asset missing
  return null
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

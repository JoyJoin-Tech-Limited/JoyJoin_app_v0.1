import { View } from '@tarojs/components'
import { useEffect, useMemo, useState } from 'react'
import spritesheetManifest from '../../assets/mascot/xiaoyue-spritesheet-manifest.json'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import './XiaoyueSpriteAnimator.scss'

const BASE_PATH = cdnAsset('/assets/mascot')

export type XiaoyueSpriteState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'loading'
  | 'curious'
  | 'nod'
  | 'surprised'
  | 'celebrate'
  | 'coach'
  | 'neutral'
  | 'error'
  | 'success'
  | 'waiting'
  | 'reveal'
  | 'thanks'
  | 'trust'
  | 'reassure'
  | 'empty'
  | 'welcome'
  | 'intro'

export interface XiaoyueSpriteAnimatorProps {
  /** Animation state key */
  state: XiaoyueSpriteState
  /** Display size (width/height). Defaults to 96rpx. */
  size?: string
  /** Additional CSS class */
  className?: string
  /** Whether to auto-play on mount / state change. Default true. */
  autoPlay?: boolean
  /** Callback when a one-shot animation completes */
  onComplete?: () => void
  /** Whether to show a subtle glow ring behind the sprite */
  showGlow?: boolean
  /** Loading state override (forces thinking animation) */
  isLoading?: boolean
}

interface SpriteStateMeta {
  sheet: string
  frameCount: number
  frameWidth: number
  frameHeight: number
  duration: number
  loop: boolean
  oneShot: boolean
}

function getStateMeta(state: XiaoyueSpriteState): SpriteStateMeta | null {
  const meta = (spritesheetManifest.states as Record<string, SpriteStateMeta>)[state]
  return meta ?? null
}

/**
 * XiaoyueSpriteAnimator — frame-based sprite animation for the JoyJoin mascot.
 *
 * Each state has its own horizontal-strip spritesheet:
 *   /assets/mascot/xiaoyue-<state>.webp
 *
 * CSS background-position + steps() drives animation for GPU efficiency.
 *
 * Spec:
 * - Frame size: 200×200px source, scaled via CSS to any display size
 * - Manifest: src/assets/mascot/xiaoyue-spritesheet-manifest.json (generated)
 * - One-shot states freeze on last frame via animation-fill-mode: forwards
 * - State changes remount the sprite to restart animation from frame 0
 * - Reduced motion: animation disabled, first frame shown statically
 */
export default function XiaoyueSpriteAnimator({
  state,
  size = '96rpx',
  className = '',
  autoPlay = true,
  onComplete,
  showGlow = false,
  isLoading = false,
}: XiaoyueSpriteAnimatorProps) {
  const resolvedState: XiaoyueSpriteState = isLoading ? 'thinking' : state
  const meta = getStateMeta(resolvedState)

  // Increment playKey on state change to force remount and restart animation
  const [playKey, setPlayKey] = useState(0)
  useEffect(() => {
    setPlayKey((k) => k + 1)
  }, [resolvedState])

  const style = useMemo(() => {
    if (!meta) {
      return {
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'rgba(139, 92, 246, 0.08)',
      }
    }

    const { sheet, frameCount, duration, loop } = meta
    const baseStyle: Record<string, string | number> = {
      width: size,
      height: size,
      backgroundImage: `url(${BASE_PATH}/${sheet})`,
      backgroundSize: `${frameCount * 100}% 100%`,
      backgroundPosition: '0% 0%',
      backgroundRepeat: 'no-repeat',
      borderRadius: '50%',
    }

    if (frameCount > 1 && autoPlay) {
      const durationSec = (duration / 1000).toFixed(2)
      const steps = frameCount - 1
      const loopMode = loop ? 'infinite' : 'forwards'
      baseStyle.animation = `xiaoyue-sprite-play ${durationSec}s steps(${steps}) ${loopMode}`
    }

    return baseStyle
  }, [meta, size, autoPlay, resolvedState])

  if (!meta) {
    return (
      <View
        className={`xiaoyue-sprite xiaoyue-sprite--fallback ${className}`}
        style={style}
      />
    )
  }

  return (
    <View
      className={`xiaoyue-sprite ${showGlow ? 'xiaoyue-sprite--glow' : ''} ${className}`}
    >
      <View
        key={playKey}
        className='xiaoyue-sprite__frame'
        style={style}
        onAnimationEnd={onComplete}
      />
    </View>
  )
}

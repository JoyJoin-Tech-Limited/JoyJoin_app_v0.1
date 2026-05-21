import { View } from '@tarojs/components'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  /** Crossfade duration in ms when switching states. Default 180. */
  transitionMs?: number
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
  transitionMs = 180,
}: XiaoyueSpriteAnimatorProps) {
  const resolvedState: XiaoyueSpriteState = isLoading ? 'thinking' : state
  const meta = getStateMeta(resolvedState)

  // ── Crossfade transition state ──
  // When state changes, we keep the old sprite frame visible and fade it out
  // while the new frame fades in underneath. This eliminates the jarring
  // background-image swap that made static↔sprite transitions feel disconnected.
  const [exitMeta, setExitMeta] = useState<SpriteStateMeta | null>(null)
  const [isFading, setIsFading] = useState(false)
  const prevStateRef = useRef(resolvedState)
  const prevMetaRef = useRef<SpriteStateMeta | null>(meta)

  useEffect(() => {
    if (resolvedState !== prevStateRef.current) {
      const oldMeta = prevMetaRef.current
      if (oldMeta) {
        // State changed — begin crossfade using the PREVIOUS meta as exit
        setExitMeta(oldMeta)
        setIsFading(true)
        const timer = setTimeout(() => {
          setExitMeta(null)
          setIsFading(false)
        }, transitionMs)
        // Update refs AFTER capturing exit meta so the next transition uses the correct source
        prevStateRef.current = resolvedState
        prevMetaRef.current = meta
        return () => clearTimeout(timer)
      }
      // No previous meta to crossfade from — just update refs
      prevStateRef.current = resolvedState
      prevMetaRef.current = meta
    }
  }, [resolvedState, meta, transitionMs])

  // Increment playKey on state change to force remount and restart animation
  const [playKey, setPlayKey] = useState(0)
  useEffect(() => {
    setPlayKey((k) => k + 1)
  }, [resolvedState])

  const makeStyle = useCallback((m: SpriteStateMeta | null): Record<string, string | number> => {
    if (!m) {
      return {
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'rgba(139, 92, 246, 0.08)',
      }
    }

    const { sheet, frameCount, duration, loop } = m
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
  }, [size, autoPlay])

  const currentStyle = useMemo(() => makeStyle(meta), [makeStyle, meta])
  const exitStyle = useMemo(() => makeStyle(exitMeta), [makeStyle, exitMeta])

  if (!meta) {
    return (
      <View
        className={`xiaoyue-sprite xiaoyue-sprite--fallback ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <View
      className={`xiaoyue-sprite ${showGlow ? 'xiaoyue-sprite--glow' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Current state — opacity wrapper handles enter fade, inner handles sprite play */}
      <View
        className={`xiaoyue-sprite__frame ${isFading ? 'xiaoyue-sprite__frame--enter' : ''}`}
      >
        <View
          key={playKey}
          className='xiaoyue-sprite__frame-inner'
          style={currentStyle}
          onAnimationEnd={onComplete}
        />
      </View>
      {/* Exiting state — opacity wrapper handles exit fade, inner handles sprite play */}
      {exitMeta && (
        <View className='xiaoyue-sprite__frame xiaoyue-sprite__frame--exit'>
          <View className='xiaoyue-sprite__frame-inner' style={exitStyle} />
        </View>
      )}
    </View>
  )
}

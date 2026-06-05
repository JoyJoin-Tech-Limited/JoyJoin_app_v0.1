import { Image, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import spritesheetManifest from '../../assets/mascot/xiaoyue-spritesheet-manifest.json'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import { logWarn } from '../../lib/utils/logger'
import { useDeviceTier } from '../../hooks/useDeviceTier'
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
  /** Crossfade duration in ms when switching states. Default 220. */
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

interface SpriteFrameProps {
  meta: SpriteStateMeta
  size: string
  autoPlay: boolean
  onComplete?: () => void
  onError?: () => void
}

/**
 * Render a single sprite state using the WeChat-safe <Image> + overflow:hidden
 * + transform:translate() pattern. Each frame is cropped by translating the
 * full spritesheet inside a clipped circular container.
 *
 * Animation is JS-driven (setInterval) to avoid dynamic-WXSS-keyframe issues
 * and to give exact per-frame control over timing, looping, and completion.
 */
function SpriteFrame({ meta, size, autoPlay, onComplete, onError }: SpriteFrameProps) {
  const [currentFrame, setCurrentFrame] = useState(0)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const { sheet, frameCount, frameWidth, frameHeight, duration, loop } = meta
  const sizeNum = parseInt(size, 10) || 96
  const scale = sizeNum / frameWidth
  const padding = spritesheetManifest.frame.padding
  const stride = frameWidth + padding * 2
  const sheetWidth = frameCount * stride
  const sheetHeight = frameHeight + padding * 2

  const imgW = Math.round(sheetWidth * scale)
  const imgH = Math.round(sheetHeight * scale)
  const translateX = Math.round(-(currentFrame * stride + padding) * scale)
  const translateY = Math.round(-padding * scale)

  useEffect(() => {
    setCurrentFrame(0)
    if (!autoPlay || frameCount <= 1) return

    const frameDuration = duration / frameCount
    let frame = 0
    const isVisibleRef = { current: true }

    const handleAppShow = () => { isVisibleRef.current = true }
    const handleAppHide = () => { isVisibleRef.current = false }
    Taro.onAppShow(handleAppShow)
    Taro.onAppHide(handleAppHide)

    const timer = setInterval(() => {
      if (!isVisibleRef.current) return
      frame++
      if (frame >= frameCount) {
        if (loop) {
          frame = 0
        } else {
          clearInterval(timer)
          Taro.offAppShow(handleAppShow)
          Taro.offAppHide(handleAppHide)
          onCompleteRef.current?.()
          return
        }
      }
      setCurrentFrame(frame)
    }, frameDuration)

    return () => {
      clearInterval(timer)
      Taro.offAppShow(handleAppShow)
      Taro.offAppHide(handleAppHide)
    }
  }, [autoPlay, frameCount, duration, loop])

  return (
    <View className='xiaoyue-sprite__frame-inner'>
      <Image
        src={`${BASE_PATH}/${sheet}`}
        mode='aspectFill'
        style={{
          width: `${imgW}rpx`,
          height: `${imgH}rpx`,
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translate(${translateX}rpx, ${translateY}rpx)`,
          willChange: 'transform',
        }}
        onError={onError}
      />
    </View>
  )
}

/**
 * XiaoyueSpriteAnimator — frame-based sprite animation for the JoyJoin mascot.
 *
 * Each state has its own horizontal-strip spritesheet:
 *   /assets/mascot/xiaoyue-<state>.webp
 *
 * Uses the WeChat-safe <Image> + overflow:hidden + transform:translate()
 * pattern instead of CSS background-image, which silently fails in many
 * WeChat runtime versions.
 *
 * Spec:
 * - Frame size: 200×200px source, scaled via transform to any display size
 * - Manifest: src/assets/mascot/xiaoyue-spritesheet-manifest.json (generated)
 * - One-shot states freeze on last frame after duration elapses
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
  transitionMs = 220,
}: XiaoyueSpriteAnimatorProps) {
  const resolvedState: XiaoyueSpriteState = isLoading ? 'thinking' : state
  const meta = getStateMeta(resolvedState)
  const [spriteError, setSpriteError] = useState(false)
  const { isDegradation } = useDeviceTier()

  // Detect system reduced-motion preference
  const [reducedMotion, setReducedMotion] = useState(false)
  useEffect(() => {
    try {
      const info = Taro.getSystemInfoSync()
      setReducedMotion((info as any).reduceMotion === true)
    } catch {
      setReducedMotion(false)
    }
  }, [])

  const motionEnabled = autoPlay && !reducedMotion && !isDegradation

  // Reset error state when state changes (CDN failure for one state shouldn't block others)
  useEffect(() => {
    setSpriteError(false)
  }, [resolvedState])

  // ── Crossfade transition state ──
  // When state changes, we keep the old sprite frame visible and fade it out
  // while the new frame fades in underneath. This eliminates the jarring
  // image swap that made static↔sprite transitions feel disconnected.
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

  if (!meta || spriteError) {
    return (
      <View
        className={`xiaoyue-sprite xiaoyue-sprite--fallback ${className}`}
        style={{ width: size, height: size }}
      >
        {showGlow && <View className='xiaoyue-sprite--glow-fallback' />}
      </View>
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
        <SpriteFrame
          key={playKey}
          meta={meta}
          size={size}
          autoPlay={autoPlay && !reducedMotion}
          onComplete={onComplete}
          onError={() => {
            if (!spriteError) {
              logWarn('[XiaoyueSpriteAnimator] CDN sprite load failed — falling back', {
                state: resolvedState,
                sheet: meta.sheet,
              })
              setSpriteError(true)
            }
          }}
        />
      </View>
      {/* Exiting state — opacity wrapper handles exit fade, inner keeps animating */}
      {exitMeta && (
        <View className='xiaoyue-sprite__frame xiaoyue-sprite__frame--exit'>
          <SpriteFrame
            meta={exitMeta}
            size={size}
            autoPlay={motionEnabled}
          />
        </View>
      )}
    </View>
  )
}

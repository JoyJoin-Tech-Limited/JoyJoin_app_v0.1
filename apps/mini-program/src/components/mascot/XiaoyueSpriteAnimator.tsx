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
  /**
   * When set, the sprite renders a single static frame and does not animate.
   * Useful for question screens where we want a consistent, eyes-open mascot
   * pose instead of a looping frame that may show eyes closed.
   */
  staticFrame?: number
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

function spriteSrc(sheet: string, local = false) {
  return local ? `/assets/mascot/${sheet}` : `${BASE_PATH}/${sheet}`
}

interface SpriteGeometry {
  imgW: number
  imgH: number
  staticX: number
  staticY: number
  startX: number
  startY: number
  endX: number
  endY: number
}

function computeSpriteGeometry(meta: SpriteStateMeta, size: string, staticFrame?: number): SpriteGeometry {
  const { frameCount, frameWidth, frameHeight } = meta
  const sizeNum = parseInt(size, 10) || 96
  const scale = sizeNum / frameWidth
  const padding = spritesheetManifest.frame.padding
  const stride = frameWidth + padding * 2
  const sheetWidth = frameCount * stride
  const sheetHeight = frameHeight + padding * 2

  const displayFrame = Math.max(0, Math.min(staticFrame ?? 0, frameCount - 1))

  return {
    imgW: sheetWidth * scale,
    imgH: sheetHeight * scale,
    staticX: -(displayFrame * stride + padding) * scale,
    staticY: -padding * scale,
    startX: -padding * scale,
    startY: -padding * scale,
    endX: -((frameCount - 1) * stride + padding) * scale,
    endY: -padding * scale,
  }
}

interface SpriteFrameProps {
  meta: SpriteStateMeta
  size: string
  staticFrame?: number
  animate?: boolean
  loop?: boolean
  duration?: number
  animationGen?: number
  isAppVisible?: boolean
  onError?: () => void
  onAnimationEnd?: () => void
}

/**
 * Render a single sprite state using the WeChat-safe <Image> + overflow:hidden
 * + transform:translate3d() pattern. Each frame is cropped by translating the
 * full spritesheet inside a clipped circular container.
 *
 * Animation is driven by a CSS `steps()` animation on the <Image> style. This
 * avoids per-frame React setState and setInterval scheduling jitter. The
 * keyframes reference CSS custom properties set inline for the current sprite
 * geometry; the animation restarts automatically when the inline `animation`
 * value changes on state transitions.
 */
function SpriteFrame({
  meta,
  size,
  staticFrame,
  animate = false,
  loop = false,
  duration = 0,
  animationGen = 0,
  isAppVisible = true,
  onError,
  onAnimationEnd,
}: SpriteFrameProps) {
  const [src, setSrc] = useState(() => spriteSrc(meta.sheet))
  const [hasFailed, setHasFailed] = useState(false)

  useEffect(() => {
    setSrc(spriteSrc(meta.sheet))
    setHasFailed(false)
  }, [meta.sheet])

  const handleImageError = () => {
    if (!hasFailed) {
      // CDN failed — try the locally bundled copy before giving up.
      logWarn('[XiaoyueSpriteAnimator] CDN sprite failed, trying local fallback', { sheet: meta.sheet })
      setHasFailed(true)
      setSrc(spriteSrc(meta.sheet, true))
    } else {
      // Local copy also failed — surface the failure to the parent.
      onError?.()
    }
  }

  const { frameCount } = meta
  const geo = computeSpriteGeometry(meta, size, staticFrame)
  const shouldAnimate = animate && staticFrame === undefined && frameCount > 1

  const style: React.CSSProperties & Record<`--jj-sprite-${string}`, string> = {
    width: `${geo.imgW}rpx`,
    height: `${geo.imgH}rpx`,
    position: 'absolute',
    top: 0,
    left: 0,
    transform: `translate3d(${geo.staticX}rpx, ${geo.staticY}rpx, 0)`,
    '--jj-sprite-start-x': `${geo.startX}rpx`,
    '--jj-sprite-start-y': `${geo.startY}rpx`,
    '--jj-sprite-end-x': `${geo.endX}rpx`,
    '--jj-sprite-end-y': `${geo.endY}rpx`,
  }

  if (shouldAnimate) {
    // Tiny alternating delay forces the CSS animation to restart even when two
    // states share the same duration and frame count. The delay is sub-frame
    // and visually imperceptible.
    const delayMs = (animationGen % 2) * 0.01
    style.animation = `xiaoyue-sprite-play ${duration}ms steps(${frameCount}) ${delayMs}ms ${loop ? 'infinite' : 'forwards'}`
    style.animationPlayState = isAppVisible ? 'running' : 'paused'
  }

  return (
    <View className='xiaoyue-sprite__frame-inner'>
      <Image
        src={src}
        mode='aspectFill'
        style={style}
        onError={handleImageError}
        onAnimationEnd={onAnimationEnd}
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
 * Uses the WeChat-safe <Image> + overflow:hidden + transform:translate3d()
 * pattern instead of CSS background-image, which silently fails in many
 * WeChat runtime versions.
 *
 * Spec:
 * - Frame size: source frameWidth×frameHeight, scaled via transform to any display size
 * - Manifest: src/assets/mascot/xiaoyue-spritesheet-manifest.json (generated)
 * - One-shot states freeze on last frame after duration elapses and fire onComplete once
 * - State changes crossfade; the new state's CSS animation restarts from frame 0
 * - Reduced motion / degradation tier / staticFrame: first/static frame shown, no animation
 * - App hide/show: looping animations pause and resume; one-shot completion is deferred while hidden
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
  staticFrame,
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

  // App visibility state drives animation-play-state and one-shot completion timing.
  const [isAppVisible, setIsAppVisible] = useState(true)
  const isVisibleRef = useRef(true)

  // Crossfade transition state
  const [exitMeta, setExitMeta] = useState<SpriteStateMeta | null>(null)
  const [exitStaticFrame, setExitStaticFrame] = useState<number | undefined>(undefined)
  const [isFading, setIsFading] = useState(false)

  // Animation generation counter: incrementing changes the inline animation
  // shorthand value, guaranteeing a fresh CSS animation start on state change.
  const [animationGen, setAnimationGen] = useState(0)

  const prevStateRef = useRef(resolvedState)
  const prevMetaRef = useRef<SpriteStateMeta | null>(meta)
  const prevStaticFrameRef = useRef(staticFrame)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingExitCleanupRef = useRef(false)

  // One-shot completion bookkeeping
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const expectedCompleteTimeRef = useRef(0)
  const pendingCompleteRef = useRef(false)
  const completeFiredRef = useRef(false)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  // App lifecycle listeners
  useEffect(() => {
    const handleAppShow = () => {
      isVisibleRef.current = true
      setIsAppVisible(true)

      if (pendingCompleteRef.current) {
        const remaining = Math.max(0, expectedCompleteTimeRef.current - Date.now())
        if (remaining <= 0) {
          pendingCompleteRef.current = false
          if (!completeFiredRef.current) {
            completeFiredRef.current = true
            onCompleteRef.current?.()
          }
        } else {
          if (completeTimerRef.current) clearTimeout(completeTimerRef.current)
          completeTimerRef.current = setTimeout(() => {
            pendingCompleteRef.current = false
            if (!completeFiredRef.current) {
              completeFiredRef.current = true
              onCompleteRef.current?.()
            }
          }, remaining)
        }
      }

      if (pendingExitCleanupRef.current) {
        pendingExitCleanupRef.current = false
        setExitMeta(null)
        setExitStaticFrame(undefined)
        setIsFading(false)
        if (exitTimerRef.current) {
          clearTimeout(exitTimerRef.current)
          exitTimerRef.current = null
        }
      }
    }
    const handleAppHide = () => {
      isVisibleRef.current = false
      setIsAppVisible(false)
    }

    Taro.onAppShow(handleAppShow)
    Taro.onAppHide(handleAppHide)
    return () => {
      Taro.offAppShow(handleAppShow)
      Taro.offAppHide(handleAppHide)
    }
  }, [])

  // Reset error state when state changes (CDN failure for one state shouldn't block others)
  useEffect(() => {
    setSpriteError(false)
  }, [resolvedState])

  // Crossfade + animation restart on state change
  useEffect(() => {
    if (resolvedState === prevStateRef.current) return

    const oldMeta = prevMetaRef.current
    if (oldMeta) {
      // State changed — begin crossfade using the PREVIOUS meta and frame as exit.
      // Capture the previous staticFrame so a per-state frame doesn't leak onto
      // the old spritesheet during the fade-out.
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
      setExitMeta(oldMeta)
      setExitStaticFrame(prevStaticFrameRef.current)
      setIsFading(true)
      exitTimerRef.current = setTimeout(() => {
        if (!isVisibleRef.current) {
          pendingExitCleanupRef.current = true
          return
        }
        setExitMeta(null)
        setExitStaticFrame(undefined)
        setIsFading(false)
        exitTimerRef.current = null
      }, transitionMs)
    }

    setAnimationGen((g) => g + 1)

    prevStateRef.current = resolvedState
    prevMetaRef.current = meta
    prevStaticFrameRef.current = staticFrame
  }, [resolvedState, meta, transitionMs, staticFrame])

  // One-shot completion timer setup / cleanup
  useEffect(() => {
    completeFiredRef.current = false
    pendingCompleteRef.current = false
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current)

    const shouldFireComplete = autoPlay && meta && !meta.loop && staticFrame === undefined
    if (shouldFireComplete) {
      expectedCompleteTimeRef.current = Date.now() + meta.duration
      completeTimerRef.current = setTimeout(() => {
        if (isVisibleRef.current) {
          if (!completeFiredRef.current) {
            completeFiredRef.current = true
            onCompleteRef.current?.()
          }
        } else {
          pendingCompleteRef.current = true
        }
      }, meta.duration)
    }

    return () => {
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current)
    }
  }, [autoPlay, meta, staticFrame])

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current)
      pendingExitCleanupRef.current = false
    }
  }, [])

  const motionEnabled = autoPlay && !reducedMotion && !isDegradation

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

  const handleAnimationEnd = () => {
    if (!completeFiredRef.current) {
      completeFiredRef.current = true
      pendingCompleteRef.current = false
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current)
      onCompleteRef.current?.()
    }
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
          meta={meta}
          size={size}
          staticFrame={staticFrame}
          animate={motionEnabled}
          loop={meta.loop}
          duration={meta.duration}
          animationGen={animationGen}
          isAppVisible={isAppVisible}
          onError={() => {
            if (!spriteError) {
              logWarn('[XiaoyueSpriteAnimator] CDN sprite load failed — falling back', {
                state: resolvedState,
                sheet: meta.sheet,
              })
              setSpriteError(true)
            }
          }}
          onAnimationEnd={meta.loop ? undefined : handleAnimationEnd}
        />
      </View>
      {/* Exiting state — static snapshot of the previous frame, faded out */}
      {exitMeta && (
        <View className='xiaoyue-sprite__frame xiaoyue-sprite__frame--exit'>
          <SpriteFrame
            meta={exitMeta}
            size={size}
            staticFrame={exitStaticFrame}
            animate={false}
          />
        </View>
      )}
    </View>
  )
}

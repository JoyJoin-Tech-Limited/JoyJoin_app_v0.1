import { Image, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import spritesheetManifest from '../../assets/mascot/xiaoyue-spritesheet-manifest.json'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import { logWarn } from '../../lib/utils/logger'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { usePageVisibility } from '../../hooks/usePageVisibility'
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
  state: XiaoyueSpriteState
  size?: string
  className?: string
  autoPlay?: boolean
  onComplete?: () => void
  showGlow?: boolean
  isLoading?: boolean
  transitionMs?: number
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

interface SpriteFrameProps {
  meta: SpriteStateMeta
  size: string
  staticFrame?: number
  autoPlay?: boolean
  loop?: boolean
  duration?: number
  isAppVisible?: boolean
  onError?: () => void
  onComplete?: () => void
}

/**
 * Render a single sprite state using the WeChat-safe <Image> + overflow:hidden
 * + transform:translate3d() pattern. Each frame is cropped by translating the
 * full spritesheet inside a clipped circular container.
 *
 * Animation is JS-driven (setInterval) because CSS custom properties inside
 * @keyframes are unreliable in the WeChat runtime and can cause the sprite
 * sheet to slide continuously instead of stepping through frames.
 */
function SpriteFrame({
  meta,
  size,
  staticFrame,
  autoPlay = false,
  loop = false,
  duration = 0,
  isAppVisible = true,
  onError,
  onComplete,
}: SpriteFrameProps) {
  const [currentFrame, setCurrentFrame] = useState(staticFrame ?? 0)
  const [src, setSrc] = useState(() => spriteSrc(meta.sheet))
  const [hasFailed, setHasFailed] = useState(false)
  const isVisibleRef = useRef(isAppVisible)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])
  useEffect(() => { isVisibleRef.current = isAppVisible }, [isAppVisible])

  useEffect(() => {
    setSrc(spriteSrc(meta.sheet))
    setHasFailed(false)
  }, [meta.sheet])

  const handleImageError = () => {
    if (!hasFailed) {
      logWarn('[XiaoyueSpriteAnimator] CDN sprite failed, trying local fallback', { sheet: meta.sheet })
      setHasFailed(true)
      setSrc(spriteSrc(meta.sheet, true))
    } else {
      onError?.()
    }
  }

  const { frameCount, frameWidth, frameHeight, duration: metaDuration } = meta
  const playDuration = duration || metaDuration
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
    const initialFrame = Math.max(0, Math.min(staticFrame ?? 0, frameCount - 1))
    setCurrentFrame(initialFrame)

    if (staticFrame !== undefined || !autoPlay) return

    // One-shot with a single frame: hold for duration then fire onComplete.
    if (frameCount <= 1 && !loop) {
      const timer = setTimeout(() => {
        if (isVisibleRef.current) onCompleteRef.current?.()
      }, playDuration)
      return () => clearTimeout(timer)
    }

    if (frameCount <= 1) return

    const frameDuration = playDuration / frameCount
    let frame = initialFrame

    const timer = setInterval(() => {
      if (!isVisibleRef.current) return
      frame++
      if (frame >= frameCount) {
        if (loop) {
          frame = 0
        } else {
          clearInterval(timer)
          onCompleteRef.current?.()
          return
        }
      }
      setCurrentFrame(frame)
    }, frameDuration)

    return () => clearInterval(timer)
  }, [autoPlay, frameCount, playDuration, loop, staticFrame, meta.sheet])

  return (
    <View className='xiaoyue-sprite__frame-inner'>
      <Image
        src={src}
        mode='aspectFill'
        style={{
          width: `${imgW}rpx`,
          height: `${imgH}rpx`,
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translate3d(${translateX}rpx, ${translateY}rpx, 0)`,
          willChange: 'transform',
        }}
        onError={handleImageError}
      />
    </View>
  )
}

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

  // Detect reduced-motion synchronously to avoid initial motion flash.
  const [reducedMotion] = useState(() => {
    try {
      const info = Taro.getSystemInfoSync()
      return (info as any).reduceMotion === true
    } catch {
      return false
    }
  })

  const [isAppVisible, setIsAppVisible] = useState(true)
  const isVisibleRef = useRef(true)
  const { isPageVisible } = usePageVisibility()

  const [exitMeta, setExitMeta] = useState<SpriteStateMeta | null>(null)
  const [exitStaticFrame, setExitStaticFrame] = useState<number | undefined>(undefined)
  const [isFading, setIsFading] = useState(false)

  // Remount counter for the current SpriteFrame on state change.
  const [animationGen, setAnimationGen] = useState(0)

  const prevStateRef = useRef(resolvedState)
  const prevMetaRef = useRef<SpriteStateMeta | null>(meta)
  const prevStaticFrameRef = useRef(staticFrame)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingExitCleanupRef = useRef(false)

  // App lifecycle listeners. Visibility state drives isVisibleRef via the
  // combined effect below; app-show also flushes any pending exit-meta cleanup.
  useEffect(() => {
    const handleAppShow = () => {
      setIsAppVisible(true)

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
      setIsAppVisible(false)
    }

    Taro.onAppShow(handleAppShow)
    Taro.onAppHide(handleAppHide)
    return () => {
      Taro.offAppShow(handleAppShow)
      Taro.offAppHide(handleAppHide)
    }
  }, [])

  // Combined app + page visibility. Page-level matters because WeChat keeps
  // pages alive-but-hidden in the navigation stack and there is no
  // document.hidden — onAppHide alone misses tab switches and page-stack
  // navigation, so hidden sprites would keep stepping frames forever.
  useEffect(() => {
    isVisibleRef.current = isAppVisible && isPageVisible
  }, [isAppVisible, isPageVisible])

  // Page re-show may unblock an exit-meta cleanup that fired while hidden.
  useEffect(() => {
    if (!isPageVisible) return
    if (!pendingExitCleanupRef.current) return
    pendingExitCleanupRef.current = false
    setExitMeta(null)
    setExitStaticFrame(undefined)
    setIsFading(false)
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
  }, [isPageVisible])

  useEffect(() => {
    setSpriteError(false)
  }, [resolvedState])

  // Crossfade + animation restart on state change
  useEffect(() => {
    if (resolvedState === prevStateRef.current) return

    const oldMeta = prevMetaRef.current
    if (oldMeta) {
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

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
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

  return (
    <View
      className={`xiaoyue-sprite ${showGlow ? 'xiaoyue-sprite--glow' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      <View
        className={`xiaoyue-sprite__frame ${isFading ? 'xiaoyue-sprite__frame--enter' : ''}`}
      >
        <SpriteFrame
          key={animationGen}
          meta={meta}
          size={size}
          staticFrame={staticFrame}
          autoPlay={motionEnabled}
          loop={meta.loop}
          duration={meta.duration}
          isAppVisible={isAppVisible && isPageVisible}
          onError={() => {
            if (!spriteError) {
              logWarn('[XiaoyueSpriteAnimator] CDN sprite load failed — falling back', {
                state: resolvedState,
                sheet: meta.sheet,
              })
              setSpriteError(true)
            }
          }}
          onComplete={meta.loop ? undefined : onComplete}
        />
      </View>
      {exitMeta && (
        <View className='xiaoyue-sprite__frame xiaoyue-sprite__frame--exit'>
          <SpriteFrame
            meta={exitMeta}
            size={size}
            staticFrame={exitStaticFrame}
            autoPlay={false}
          />
        </View>
      )}
    </View>
  )
}

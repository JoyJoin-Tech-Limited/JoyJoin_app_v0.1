import { Image, View } from '@tarojs/components'
import { useDidHide, useDidShow } from '@tarojs/taro'
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { profileAnalytics } from '../../lib/analytics/profileAnalytics'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'
import {
  getDegradationTier,
  type DegradationTier,
} from '../../lib/utils/frameBudget'
import { logError } from '../../lib/utils/logger'
import {
  getIdentityStageLayerUrl,
  type IdentityStageLayerId,
} from '../../lib/profile/identityStageAssets'
import './IdentityStageScene.scss'

/**
 * HD-2D Identity Stage (sprint hd2d-identity-stage).
 *
 * A warm-toned multi-plane depth scene that wraps the existing
 * `PixelAvatarComposite` identity card with zero functional diff:
 *
 *   far-bg (pre-baked blur art) → mid-bg → avatar (children)
 *     → rim-light (opacity breathing) → dust particles → warm grade overlay
 *
 * Hard rules (contract AC-03..AC-07):
 * - Transform/opacity animation only. Blur is pre-baked into the far-bg art;
 *   no runtime `filter: blur`, no layout-property animation anywhere.
 * - Every art layer stays hidden (opacity 0) until its `onLoad` fires;
 *   `onError` hides that layer. Total background failure degrades to the
 *   existing static identity card (children only).
 * - The entrance reveal starts only after far-bg + mid-bg have loaded OR
 *   failed, with a hard cap so a hung layer never blocks the reveal.
 * - Reduced-motion (detected synchronously) renders fully static — no drift,
 *   no breathing, no particles, no entrance motion.
 * - `getDegradationTier()` is async: the stage renders at the static
 *   configuration (0 particles, no drift) until the promise resolves.
 * - Loops pause on `useDidHide` and resume on `useDidShow`; all timers are
 *   cleaned up on unmount.
 */

/** Single 12s transform loop on the scene container (contract AC-06). */
export const IDENTITY_STAGE_DRIFT_MS = 12000

/** Entrance reveal completes within 500ms (contract AC-06). */
export const IDENTITY_STAGE_ENTRANCE_MS = 500

/** A hung art layer may never delay the entrance reveal past this cap. */
export const IDENTITY_STAGE_REVEAL_CAP_MS = 1500

/** Rim-light opacity breathing loop (not contract-specified; kept gentle). */
const IDENTITY_STAGE_RIM_BREATHE_MS = 4200

/** Particle budget per degradation tier (contract AC-05). */
export const IDENTITY_STAGE_PARTICLE_COUNTS: Record<DegradationTier, number> = {
  full: 10,
  reduced: 4,
  minimal: 0,
  emergency: 0,
}

type LayerStatus = 'pending' | 'loaded' | 'error'

/**
 * Deterministic dust-particle placement. Static left/top/size are placement,
 * not animation — only transform/opacity animate inside the keyframes.
 */
const IDENTITY_STAGE_PARTICLE_SPECS = [
  { left: '10%', top: '70%', sizeRpx: 10, durationMs: 5200, delayMs: 0 },
  { left: '22%', top: '58%', sizeRpx: 8, durationMs: 6100, delayMs: 700 },
  { left: '34%', top: '76%', sizeRpx: 12, durationMs: 5600, delayMs: 1300 },
  { left: '46%', top: '62%', sizeRpx: 8, durationMs: 6600, delayMs: 400 },
  { left: '58%', top: '72%', sizeRpx: 10, durationMs: 5900, delayMs: 1700 },
  { left: '68%', top: '56%', sizeRpx: 8, durationMs: 6400, delayMs: 900 },
  { left: '78%', top: '70%', sizeRpx: 12, durationMs: 5400, delayMs: 2100 },
  { left: '86%', top: '60%', sizeRpx: 8, durationMs: 6900, delayMs: 300 },
  { left: '16%', top: '48%', sizeRpx: 8, durationMs: 6200, delayMs: 1500 },
  { left: '90%', top: '44%', sizeRpx: 10, durationMs: 5800, delayMs: 1100 },
] as const

export interface IdentityStageSceneProps {
  /**
   * The existing identity card (PixelAvatarComposite) when `absoluteAvatar` is
   * true (default), or arbitrary card content when false.
   */
  children: ReactNode
  className?: string
  /**
   * When true (default) children are rendered in an absolutely-positioned
   * avatar slot that fills the stage. When false, children are rendered in a
   * normal content slot so the caller controls positioning — used when the
   * stage fills a larger hero card and the avatar floats at a specific corner.
   */
  absoluteAvatar?: boolean
  /**
   * How the far/mid background art fits the stage. `scaleToFill` (default)
   * matches the identity card's original behavior; `aspectFill` crops the wide
   * art without distortion for near-square stages (e.g. the my-image stage).
   */
  layerImageMode?: 'scaleToFill' | 'aspectFill'
}

export function IdentityStageScene({
  children,
  className = '',
  absoluteAvatar = true,
  layerImageMode = 'scaleToFill',
}: IdentityStageSceneProps) {
  // Reduced-motion is read synchronously on first render so there is no
  // motion flash before the preference is known (contract AC-07).
  const [reducedMotion] = useState(() => getSystemReducedMotion())
  const [revealed, setRevealed] = useState(reducedMotion)
  // Fail-safe: tier stays null (0 particles, no drift) until the async
  // degradation-tier promise resolves (contract AC-05).
  const [tier, setTier] = useState<DegradationTier | null>(null)
  const [pageVisible, setPageVisible] = useState(true)
  const [layerStatus, setLayerStatus] = useState<Record<IdentityStageLayerId, LayerStatus>>({
    farBg: 'pending',
    midBg: 'pending',
  })

  const farBgUrl = getIdentityStageLayerUrl('farBg')
  const midBgUrl = getIdentityStageLayerUrl('midBg')

  const farBgFailed = !farBgUrl || layerStatus.farBg === 'error'
  const midBgFailed = !midBgUrl || layerStatus.midBg === 'error'
  const farBgSettled = farBgFailed || layerStatus.farBg === 'loaded'
  const midBgSettled = midBgFailed || layerStatus.midBg === 'loaded'
  const totalFallback = farBgFailed && midBgFailed

  useDidShow(() => setPageVisible(true))
  useDidHide(() => setPageVisible(false))

  // Resolve the degradation tier once. Skipped entirely under reduced-motion
  // because the stage is static either way.
  useEffect(() => {
    if (reducedMotion) return
    let cancelled = false
    getDegradationTier()
      .then((resolved) => {
        if (!cancelled) setTier(resolved)
      })
      .catch(() => {
        if (!cancelled) setTier('minimal')
      })
    return () => {
      cancelled = true
    }
  }, [reducedMotion])

  // The entrance reveal begins once far-bg + mid-bg have loaded OR failed.
  useEffect(() => {
    if (revealed) return
    if (farBgSettled && midBgSettled) setRevealed(true)
  }, [revealed, farBgSettled, midBgSettled])

  // Hard cap: a hung layer never blocks the reveal.
  useEffect(() => {
    if (revealed) return
    const timer = setTimeout(() => setRevealed(true), IDENTITY_STAGE_REVEAL_CAP_MS)
    return () => clearTimeout(timer)
  }, [revealed])

  const fallbackTrackedRef = useRef(false)
  useEffect(() => {
    if (!totalFallback || fallbackTrackedRef.current) return
    fallbackTrackedRef.current = true
    profileAnalytics.track('identity_stage_fallback_static', {
      reason: 'background_layers_unavailable',
    })
  }, [totalFallback])

  const motionEnabled = !reducedMotion && (tier === 'full' || tier === 'reduced')
  const particleCount = reducedMotion || tier === null
    ? 0
    : IDENTITY_STAGE_PARTICLE_COUNTS[tier]
  const playState = pageVisible ? 'running' : 'paused'

  const shownTrackedRef = useRef(false)
  useEffect(() => {
    if (!revealed || totalFallback || shownTrackedRef.current) return
    shownTrackedRef.current = true
    profileAnalytics.track('identity_stage_shown', {
      tier: tier ?? 'pending',
      reducedMotion,
      particleCount,
    })
  }, [revealed, totalFallback, tier, reducedMotion, particleCount])

  const handleLayerLoad = (layer: IdentityStageLayerId) => {
    setLayerStatus((current) => ({ ...current, [layer]: 'loaded' }))
  }

  const handleLayerError = (layer: IdentityStageLayerId) => {
    setLayerStatus((current) => ({ ...current, [layer]: 'error' }))
    profileAnalytics.track('identity_stage_asset_error', { layer })
    logError('identity-stage:asset-error', { layer })
  }

  if (totalFallback) {
    // Worst case is exactly the existing static identity card (REL-01).
    return (
      <View
        className={`identity-stage identity-stage--static-fallback ${className}`.trim()}
        data-testid='identity-stage-static-fallback'
      >
        {children}
      </View>
    )
  }

  const viewportStyle: CSSProperties = reducedMotion
    ? {}
    : {
      transition:
        `opacity ${IDENTITY_STAGE_ENTRANCE_MS}ms cubic-bezier(0.22, 1, 0.36, 1), ` +
        `transform ${IDENTITY_STAGE_ENTRANCE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
    }

  const sceneStyle: CSSProperties = motionEnabled
    ? {
      animation: `identity-stage-drift ${IDENTITY_STAGE_DRIFT_MS}ms ease-in-out infinite`,
      animationPlayState: playState,
    }
    : {}

  const rimLightStyle: CSSProperties = motionEnabled
    ? {
      animation: `identity-stage-breathe ${IDENTITY_STAGE_RIM_BREATHE_MS}ms ease-in-out infinite`,
      animationPlayState: playState,
    }
    : {}

  return (
    <View
      className={`identity-stage ${className}`.trim()}
      data-testid='identity-stage-scene'
      data-tier={tier ?? 'pending'}
      data-motion={motionEnabled ? 'on' : 'off'}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
    >
      <View
        className={`identity-stage__viewport${revealed ? ' identity-stage__viewport--revealed' : ''}`}
        style={viewportStyle}
      >
        <View className='identity-stage__scene' style={sceneStyle}>
          {farBgUrl && layerStatus.farBg !== 'error' && (
            <Image
              className='identity-stage__layer identity-stage__layer--far-bg'
              data-testid='identity-stage-far-bg'
              src={farBgUrl}
              mode={layerImageMode}
              lazyLoad={false}
              aria-hidden='true'
              style={{ opacity: layerStatus.farBg === 'loaded' ? 1 : 0 }}
              onLoad={() => handleLayerLoad('farBg')}
              onError={() => handleLayerError('farBg')}
            />
          )}
          {midBgUrl && layerStatus.midBg !== 'error' && (
            <Image
              className='identity-stage__layer identity-stage__layer--mid-bg'
              data-testid='identity-stage-mid-bg'
              src={midBgUrl}
              mode={layerImageMode}
              lazyLoad={false}
              aria-hidden='true'
              style={{ opacity: layerStatus.midBg === 'loaded' ? 1 : 0 }}
              onLoad={() => handleLayerLoad('midBg')}
              onError={() => handleLayerError('midBg')}
            />
          )}

          {absoluteAvatar ? (
            <View className='identity-stage__avatar'>{children}</View>
          ) : (
            <View className='identity-stage__content'>{children}</View>
          )}

          <View className='identity-stage__rim-light' style={rimLightStyle} aria-hidden='true' />

          {IDENTITY_STAGE_PARTICLE_SPECS.slice(0, particleCount).map((spec, index) => (
            <View
              key={index}
              className='identity-stage__particle'
              aria-hidden='true'
              style={{
                left: spec.left,
                top: spec.top,
                width: `${spec.sizeRpx}rpx`,
                height: `${spec.sizeRpx}rpx`,
                animation: `identity-stage-dust ${spec.durationMs}ms ease-in-out ${spec.delayMs}ms infinite`,
                animationPlayState: playState,
              }}
            />
          ))}

          <View className='identity-stage__grade' aria-hidden='true' />
        </View>
      </View>
    </View>
  )
}

export default IdentityStageScene

import { Canvas, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import {
  acquireWebGLContext,
  canQueryAvatarCanvas,
  queryAvatarCanvas,
} from '../../../../lib/profile/avatar3d/avatar3dPlatform'
import { logWarn } from '../../../../lib/utils/logger'
import { createWebGLLandStageSession, type WebGLLandStageSession } from './webglLandStageSession'

/**
 * Phase 2c (2026-08-01): WebGL land-moment overlay — K3 strategy doc B1 spike.
 *
 * Mounted ONLY when all of these hold (guards live in the results flow):
 *  - `webglRevealEnabled` feature flag is on (default OFF in production)
 *  - celebrationTier === 'full'
 *  - the platform can locate a webgl canvas
 *
 * Any init failure or context loss flips the component to `fallback`, and the
 * caller renders the proven CSS/ParticleBurst celebration instead — the WebGL
 * stage can never strand the flow.
 *
 * Rendered-truth note: the same three.js code runs in the H5 build, so the
 * Playwright pipeline can audit the spike without a device.
 */

let canvasInstanceCounter = 0

interface WebGLLandStageProps {
  /** Accent hex for particles + foil card (landed archetype visual). */
  accentColor: string
  /** Total stage duration (~2.5s per the K3 doc). */
  durationMs?: number
  /** Fired once when the timeline completes. */
  onComplete: () => void
  /** Fired when GL boot/render fails — caller swaps to CSS celebration. */
  onFallback: (reason: string) => void
}

export default function WebGLLandStage({
  accentColor,
  durationMs = 2500,
  onComplete,
  onFallback,
}: WebGLLandStageProps) {
  const canvasIdRef = useRef(`webgl-land-canvas-${++canvasInstanceCounter}`)
  const canvasId = canvasIdRef.current
  const sessionRef = useRef<WebGLLandStageSession | null>(null)
  const completedRef = useRef(false)
  const [bootFailed, setBootFailed] = useState(false)

  const onCompleteRef = useRef(onComplete)
  const onFallbackRef = useRef(onFallback)
  useEffect(() => { onCompleteRef.current = onComplete }, [onComplete])
  useEffect(() => { onFallbackRef.current = onFallback }, [onFallback])

  /* Gyro tilt — WeChat only; degrades silently where unsupported */
  useEffect(() => {
    const handler = (res: { alpha?: number; beta?: number; gamma?: number }) => {
      const session = sessionRef.current
      if (!session || session.disposed) return
      const tiltY = ((res.gamma ?? 0) / 90) * 0.45
      const tiltX = (((res.beta ?? 0) - 45) / 90) * 0.3
      session.setTilt(tiltX, tiltY)
    }
    try {
      if (typeof Taro.onDeviceMotionChange === 'function') {
        Taro.onDeviceMotionChange(handler as any)
        return () => {
          try { Taro.offDeviceMotionChange(handler as any) } catch { /* noop */ }
        }
      }
    } catch {
      // gyro unsupported — idle sway covers the motion
    }
    return undefined
  }, [])

  /* Boot the GL session once */
  useEffect(() => {
    let cancelled = false
    let startedAt = 0
    let rafHandle: number | null = null
    let rafApi: { request: (cb: (timeMs: number) => void) => number; cancel: (handle: number) => void } | null = null

    async function boot() {
      if (!canQueryAvatarCanvas()) {
        onFallbackRef.current('canvas-query-missing')
        setBootFailed(true)
        return
      }
      const handle = await queryAvatarCanvas(canvasId)
      if (cancelled) return
      if (!handle) {
        onFallbackRef.current('canvas-node-missing')
        setBootFailed(true)
        return
      }
      const gl = acquireWebGLContext(handle.node)
      if (!gl) {
        onFallbackRef.current('webgl-context-missing')
        setBootFailed(true)
        return
      }

      let session: WebGLLandStageSession
      try {
        session = createWebGLLandStageSession({
          canvas: handle.node,
          gl,
          cssWidth: handle.cssWidth,
          cssHeight: handle.cssHeight,
          accentColor,
          durationMs,
          onContextLost: () => {
            logWarn('[WebGLLandStage] GL context lost — falling back to CSS celebration')
            onFallbackRef.current('context-lost')
          },
        })
      } catch (error) {
        logWarn('[WebGLLandStage] session init failed', { error: String(error) })
        onFallbackRef.current('session-init-failed')
        setBootFailed(true)
        return
      }
      if (cancelled) {
        session.dispose()
        return
      }
      sessionRef.current = session
      startedAt = Date.now()

      const loop = () => {
        if (cancelled || !sessionRef.current || sessionRef.current.disposed) return
        const alive = sessionRef.current.tick(Date.now() - startedAt)
        if (!alive) {
          if (!completedRef.current) {
            completedRef.current = true
            onCompleteRef.current()
          }
          return
        }
        rafHandle = sessionRef.current.raf.request(loop)
      }
      rafHandle = session.raf.request(loop)
      rafApi = session.raf
    }

    void boot()

    return () => {
      cancelled = true
      try { if (rafHandle !== null) rafApi?.cancel(rafHandle) } catch { /* noop */ }
      try { sessionRef.current?.dispose() } catch { /* noop */ }
      sessionRef.current = null
    }
  }, [canvasId, accentColor, durationMs])

  /* The fallback path renders nothing — the caller swaps in the CSS
     celebration (this component never strands the flow). */
  if (bootFailed) return null

  return (
    <View className='personality-results__webgl-land' aria-hidden='true'>
      <Canvas
        type='webgl'
        id={canvasId}
        canvasId={canvasId}
        className='personality-results__webgl-land-canvas'
      />
    </View>
  )
}

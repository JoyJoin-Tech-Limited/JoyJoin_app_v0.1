import { Canvas, Text, View } from '@tarojs/components'
import { useDidHide, useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EquipmentItem, EquipmentOutfit } from '../../lib/profile/equipmentApi'
import { normalizePixelArchetypeId } from '../../lib/profile/pixelAvatarAssets'
import {
  computeDragYaw,
  computeFlickVelocity,
  computeResetLerp,
  describeAvatarFacing,
  isAvatarDoubleTap,
  isTapGesture,
  normalizeDegrees360,
  recordYawSample,
  resolveAvatarDragAxis,
  stepYawInertia,
  nearestFrontYaw,
  type AvatarDragAxis,
  type YawVelocitySample,
} from '../../lib/profile/avatar3d/avatar3dGestures'
import { computeEquipmentVisibility } from '../../lib/profile/avatar3d/equipment3dMapping'
import {
  acquireWebGLContext,
  canQueryAvatarCanvas,
  queryAvatarCanvas,
  resolvePixelRatio,
} from '../../lib/profile/avatar3d/avatar3dPlatform'
import { createAvatar3DSession, type Avatar3DSession } from '../../lib/profile/avatar3d/avatar3dSession'
import { haptics } from '../../lib/utils/haptics'
import { logWarn } from '../../lib/utils/logger'
import PixelAvatarTurntable from './PixelAvatarTurntable'
import './PixelAvatar3D.scss'

export interface PixelAvatar3DProps {
  archetypeId: string
  outfit: EquipmentOutfit
  itemsById: ReadonlyMap<string, EquipmentItem>
  variant?: 'compact' | 'full'
  className?: string
  /** Optional hook for QA tooling — reports live yaw in degrees after each render. */
  onYawChange?: (degrees: number) => void
  /**
   * Optional external yaw command (radians). When the value changes the model
   * snaps to it — used by the QA page for 正面/右侧/背面/左侧 presets.
   */
  externalYaw?: number | null
  /**
   * Optional QA/diagnostics hook — fired whenever the 3D surface changes state
   * (boot → ready, or boot → fallback with an explicit reason). Production
   * surfaces stay on the gentle notice only.
   */
  onStatusChange?: (report: Avatar3DStatusReport) => void
}

type Avatar3DStatus = 'boot' | 'ready' | 'fallback'

/** Explicit reason a 3D surface fell back — surfaced to QA/diagnostics. */
export type Avatar3DFallbackReason =
  | 'unsupported-archetype'
  | 'canvas-component-missing'
  | 'canvas-query-missing'
  | 'canvas-node-missing'
  | 'webgl-context-missing'
  | 'session-init-failed'
  | 'context-lost'

export interface Avatar3DStatusReport {
  status: Avatar3DStatus
  reason: Avatar3DFallbackReason | null
}

interface GestureTracking {
  startX: number
  startY: number
  startYaw: number
  axis: AvatarDragAxis
  samples: YawVelocitySample[]
}

const AXIS_LOCK_THRESHOLD_PX = 8
const RESET_ANIMATION_STEPS = 14
let canvasInstanceCounter = 0

function getTouchPoint(event: any): { clientX: number; clientY: number } | null {
  const touch = event?.touches?.[0] ?? event?.changedTouches?.[0]
  if (!touch || typeof touch.clientX !== 'number' || typeof touch.clientY !== 'number') {
    return null
  }
  return { clientX: touch.clientX, clientY: touch.clientY }
}

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

/**
 * Real WebGL 3D spider-persona preview. Renders a procedural three.js model on a
 * single Taro canvas — continuous 360° drag, inertial flick, double-tap/回正
 * reset, and per-slot equipment garments driven by the authoritative outfit.
 *
 * Phase 1 scope: ONLY the spider persona boots WebGL. Every other archetype
 * renders the stable V2 turntable with an honest "3D 形象正在准备" notice —
 * they must never be swapped into a spider. WebGL boot failures (canvas
 * missing, context unavailable, init throw, context lost) also fall back with
 * an explicit reason recorded for QA/diagnostics. Never a blank page.
 */
export function PixelAvatar3D({
  archetypeId,
  outfit,
  itemsById,
  variant = 'full',
  className = '',
  onYawChange,
  externalYaw = null,
  onStatusChange,
}: PixelAvatar3DProps) {
  const canvasIdRef = useRef(`avatar3d-canvas-${++canvasInstanceCounter}`)
  const canvasId = canvasIdRef.current
  // The WeChat devtools/jsdom mocks may not provide a Canvas component or any
  // canvas-node lookup path at all — treat that as "no WebGL" up front
  // (synchronously, so the stable V2 fallback paints immediately instead of
  // after a race). WeChat selector-query and the H5 DOM path both count.
  const platformSupportsCanvasQuery = canQueryAvatarCanvas()
  // Taro's weapp production compiler exports built-in components as
  // string-like host components (e.g. 'canvas'), which React treats as valid
  // element types — a typeof function/object-only check would wrongly reject
  // them and hard-code every spider into the canvas-component-missing
  // fallback. Only null/undefined means "component unavailable" (jsdom/edge
  // mocks). The declared component type hides the string form, so inspect the
  // runtime value through `unknown`.
  const canvasExport: unknown = Canvas
  const canvasComponentAvailable =
    typeof canvasExport === 'function' ||
    (typeof canvasExport === 'object' && canvasExport !== null) ||
    (typeof canvasExport === 'string' && canvasExport.length > 0)
  // Phase 1 gate: real 3D exists for the spider persona only.
  const isSpiderArchetype = normalizePixelArchetypeId(archetypeId) === 'spider'
  const [initialGate] = useState<{ status: Avatar3DStatus; reason: Avatar3DFallbackReason | null }>(() => {
    // Archetype first: for non-spider personas the honest reason is "their 3D
    // is not built yet" — platform capability is irrelevant to them.
    if (!isSpiderArchetype) return { status: 'fallback', reason: 'unsupported-archetype' }
    if (!canvasComponentAvailable) return { status: 'fallback', reason: 'canvas-component-missing' }
    if (!platformSupportsCanvasQuery) return { status: 'fallback', reason: 'canvas-query-missing' }
    return { status: 'boot', reason: null }
  })
  const [status, setStatus] = useState<Avatar3DStatus>(initialGate.status)
  const [fallbackReason, setFallbackReason] = useState<Avatar3DFallbackReason | null>(initialGate.reason)
  const [dragAxis, setDragAxis] = useState<AvatarDragAxis | 'idle'>('idle')
  const [displayDegrees, setDisplayDegrees] = useState(0)

  const sessionRef = useRef<Avatar3DSession | null>(null)
  const bootStartedRef = useRef(false)
  const gestureRef = useRef<GestureTracking | null>(null)
  const inertiaRef = useRef<{ handle: number | null; velocity: number }>({ handle: null, velocity: 0 })
  const resetAnimRef = useRef<number | null>(null)
  const lastTapAtRef = useRef<number | null>(null)
  const lastDisplayUpdateRef = useRef(0)
  const pageVisibleRef = useRef(true)

  const visibility = useMemo(
    () => computeEquipmentVisibility(outfit, itemsById),
    [outfit, itemsById],
  )

  const enterFallback = useCallback((reason: Avatar3DFallbackReason) => {
    setFallbackReason(reason)
    setStatus('fallback')
  }, [])

  // QA/diagnostics surface: explicit status + reason. Production keeps the
  // gentle notice below; this hook is how DevTools/QA sees WHY it fell back.
  useEffect(() => {
    onStatusChange?.({ status, reason: status === 'fallback' ? fallbackReason : null })
  }, [onStatusChange, status, fallbackReason])

  useEffect(() => {
    if (status === 'fallback' && fallbackReason) {
      logWarn('[PixelAvatar3D] 3D preview unavailable, showing classic V2 avatar', {
        reason: fallbackReason,
        archetypeId,
      })
    }
  }, [status, fallbackReason, archetypeId])

  const stopInertia = useCallback(() => {
    const session = sessionRef.current
    if (inertiaRef.current.handle !== null && session) {
      session.raf.cancel(inertiaRef.current.handle)
    }
    inertiaRef.current.handle = null
    inertiaRef.current.velocity = 0
  }, [])

  const stopResetAnimation = useCallback(() => {
    const session = sessionRef.current
    if (resetAnimRef.current !== null && session) {
      session.raf.cancel(resetAnimRef.current)
    }
    resetAnimRef.current = null
  }, [])

  const publishYaw = useCallback((yaw: number, force = false) => {
    const degrees = normalizeDegrees360(yaw)
    const now = nowMs()
    if (force || now - lastDisplayUpdateRef.current >= 150) {
      lastDisplayUpdateRef.current = now
      setDisplayDegrees(degrees)
    }
    onYawChange?.(degrees)
  }, [onYawChange])

  const renderYaw = useCallback((yaw: number, forcePublish = false) => {
    const session = sessionRef.current
    if (!session) return
    session.setYaw(yaw)
    session.renderNow()
    publishYaw(yaw, forcePublish)
  }, [publishYaw])

  const startResetAnimation = useCallback(() => {
    const session = sessionRef.current
    if (!session) return
    stopInertia()
    stopResetAnimation()
    const fromYaw = session.getYaw()
    const toYaw = nearestFrontYaw(fromYaw)
    if (Math.abs(toYaw - fromYaw) < 0.001) {
      renderYaw(0, true)
      return
    }
    let step = 0
    const tick = () => {
      const active = sessionRef.current
      if (!active) return
      step += 1
      const t = computeResetLerp(step, RESET_ANIMATION_STEPS)
      const yaw = fromYaw + (toYaw - fromYaw) * t
      active.setYaw(yaw)
      active.renderNow()
      publishYaw(yaw, step >= RESET_ANIMATION_STEPS)
      if (step < RESET_ANIMATION_STEPS) {
        resetAnimRef.current = active.raf.request(tick)
      } else {
        resetAnimRef.current = null
      }
    }
    resetAnimRef.current = session.raf.request(tick)
  }, [publishYaw, renderYaw, stopInertia, stopResetAnimation])

  const startInertia = useCallback((initialVelocity: number) => {
    const session = sessionRef.current
    if (!session || Math.abs(initialVelocity) <= 0.001) return
    stopResetAnimation()
    stopInertia()
    inertiaRef.current.velocity = initialVelocity
    let lastTime = nowMs()
    const tick = () => {
      const active = sessionRef.current
      if (!active || !pageVisibleRef.current) {
        inertiaRef.current.handle = null
        return
      }
      const now = nowMs()
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      const next = stepYawInertia(active.getYaw(), inertiaRef.current.velocity, dt)
      inertiaRef.current.velocity = next.velocity
      active.setYaw(next.yaw)
      active.renderNow()
      publishYaw(next.yaw, next.settled)
      if (next.settled) {
        inertiaRef.current.handle = null
        inertiaRef.current.velocity = 0
      } else {
        inertiaRef.current.handle = active.raf.request(tick)
      }
    }
    inertiaRef.current.handle = session.raf.request(tick)
  }, [publishYaw, stopInertia, stopResetAnimation])

  // -------------------------------------------------------------------------
  // Boot: query the canvas node, acquire GL, create the session.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (status !== 'boot' || bootStartedRef.current) return
    bootStartedRef.current = true
    let cancelled = false

    const bootTimer = setTimeout(() => {
      void (async () => {
        try {
          const handle = await queryAvatarCanvas(canvasId)
          if (cancelled) return
          if (!handle) {
            enterFallback('canvas-node-missing')
            return
          }
          const gl = acquireWebGLContext(handle.node)
          if (!gl) {
            enterFallback('webgl-context-missing')
            return
          }
          const session = createAvatar3DSession({
            canvas: handle.node,
            gl,
            cssWidth: handle.cssWidth,
            cssHeight: handle.cssHeight,
            pixelRatio: resolvePixelRatio(),
            onContextLost: () => {
              setStatus((current) => {
                if (current !== 'ready') return current
                setFallbackReason('context-lost')
                return 'fallback'
              })
            },
          })
          if (cancelled) {
            session.dispose()
            return
          }
          sessionRef.current = session
          session.applyEquipment(visibility)
          session.renderNow()
          setStatus('ready')
        } catch {
          if (!cancelled) enterFallback('session-init-failed')
        }
      })()
    }, 60)

    return () => {
      cancelled = true
      clearTimeout(bootTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, canvasId])

  // Equipment changes re-dress only the affected slot groups, then re-render.
  useEffect(() => {
    const session = sessionRef.current
    if (status !== 'ready' || !session) return
    session.applyEquipment(visibility)
    session.renderNow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, visibility])

  // External yaw commands (QA presets) — snap directly, cancel any motion.
  useEffect(() => {
    if (status !== 'ready' || externalYaw === null || !Number.isFinite(externalYaw)) return
    stopInertia()
    stopResetAnimation()
    renderYaw(externalYaw, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, externalYaw])

  // Unmount cleanup: stop loops, free GL resources.
  useEffect(() => {
    return () => {
      stopInertia()
      stopResetAnimation()
      sessionRef.current?.dispose()
      sessionRef.current = null
    }
  }, [stopInertia, stopResetAnimation])

  // Page visibility: freeze RAF while hidden, repaint on return. Standard Taro
  // page-lifecycle hooks, registered unconditionally (rules of hooks).
  useDidShow(() => {
    pageVisibleRef.current = true
    const session = sessionRef.current
    if (!session) return
    // Re-sync size in case the stage changed while hidden, then repaint.
    void queryAvatarCanvas(canvasId).then((handle) => {
      if (handle && sessionRef.current && !sessionRef.current.disposed) {
        sessionRef.current.resize(handle.cssWidth, handle.cssHeight, resolvePixelRatio())
      }
      sessionRef.current?.renderNow()
    })
  })
  useDidHide(() => {
    pageVisibleRef.current = false
    stopInertia()
    stopResetAnimation()
  })

  // -------------------------------------------------------------------------
  // Gesture handling: horizontal drag = yaw (with axis lock + inertia).
  // -------------------------------------------------------------------------
  const handleTouchStart = useCallback((event: any) => {
    if (status !== 'ready') return
    // The weapp WebGL Canvas is a native host. On real devices it can receive
    // the same touch before (or instead of) the semantic overlay, so keep one
    // authoritative gesture stream rather than resetting the drag origin.
    if (gestureRef.current) return
    const point = getTouchPoint(event)
    const session = sessionRef.current
    if (!point || !session) return
    stopInertia()
    stopResetAnimation()
    gestureRef.current = {
      startX: point.clientX,
      startY: point.clientY,
      startYaw: session.getYaw(),
      axis: 'pending',
      samples: recordYawSample([], nowMs(), session.getYaw()),
    }
    setDragAxis('pending')
  }, [status, stopInertia, stopResetAnimation])

  const handleTouchMove = useCallback((event: any) => {
    const gesture = gestureRef.current
    const session = sessionRef.current
    const point = getTouchPoint(event)
    if (!gesture || !session || !point) return

    const deltaX = point.clientX - gesture.startX
    const deltaY = point.clientY - gesture.startY
    if (gesture.axis === 'pending') {
      const axis = resolveAvatarDragAxis(deltaX, deltaY, AXIS_LOCK_THRESHOLD_PX)
      if (axis === 'pending') return
      gesture.axis = axis
      setDragAxis(axis)
    }
    if (gesture.axis !== 'horizontal') return

    event.stopPropagation?.()
    event.preventDefault?.()
    const yaw = computeDragYaw(gesture.startYaw, deltaX)
    gesture.samples = recordYawSample(gesture.samples, nowMs(), yaw)
    renderYaw(yaw)
  }, [renderYaw])

  const finishGesture = useCallback((event?: any) => {
    const gesture = gestureRef.current
    gestureRef.current = null
    setDragAxis('idle')
    if (!gesture) return

    const point = event ? getTouchPoint(event) : null
    const totalX = point ? point.clientX - gesture.startX : 0
    const totalY = point ? point.clientY - gesture.startY : 0

    if (gesture.axis === 'horizontal') {
      const velocity = computeFlickVelocity(gesture.samples, nowMs())
      if (Math.abs(velocity) > 0.001) startInertia(velocity)
      else publishYaw(sessionRef.current?.getYaw() ?? 0, true)
      return
    }

    // Tap / double-tap: double tap recenters the model to the front pose.
    if (gesture.axis === 'pending' && isTapGesture(totalX, totalY)) {
      const now = nowMs()
      if (isAvatarDoubleTap(now, lastTapAtRef.current)) {
        lastTapAtRef.current = null
        haptics('light')
        startResetAnimation()
      } else {
        lastTapAtRef.current = now
      }
    }
  }, [publishYaw, startInertia, startResetAnimation])

  // -------------------------------------------------------------------------
  // Fallback: stable V2 turntable + gentle notice. Never a blank page.
  // -------------------------------------------------------------------------
  if (status === 'fallback') {
    const notice = fallbackReason === 'unsupported-archetype'
      ? '该人格 3D 形象正在准备，先展示经典形象'
      : '当前设备暂不支持 3D 预览，已切换为经典形象'
    return (
      <View className={`pixel-avatar-3d pixel-avatar-3d--${variant} pixel-avatar-3d--fallback ${className}`.trim()}>
        <PixelAvatarTurntable
          archetypeId={archetypeId}
          outfit={outfit}
          itemsById={itemsById}
          variant={variant}
        />
        <View className='pixel-avatar-3d__fallback-note' role='note' aria-label={notice}>
          <Text>{notice}</Text>
        </View>
      </View>
    )
  }

  const facing = describeAvatarFacing((displayDegrees * Math.PI) / 180)
  const roundedDegrees = Math.round(displayDegrees)

  return (
    <View
      className={`pixel-avatar-3d pixel-avatar-3d--${variant} ${className}`.trim()}
      data-status={status}
    >
      {canvasComponentAvailable ? (
        <Canvas
          type='webgl'
          id={canvasId}
          canvasId={canvasId}
          className='pixel-avatar-3d__canvas'
          disableScroll={dragAxis === 'horizontal'}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={finishGesture}
          onTouchCancel={finishGesture}
        />
      ) : null}

      <View
        className={`pixel-avatar-3d__gesture-layer${dragAxis === 'horizontal' ? ' pixel-avatar-3d__gesture-layer--dragging' : ''}`}
        catchMove={dragAxis === 'horizontal'}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={finishGesture}
        onTouchCancel={finishGesture}
        role='slider'
        aria-label='左右拖动 360 度旋转 3D 形象，双击回到正面'
        aria-orientation='horizontal'
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={roundedDegrees}
        aria-valuetext={`${facing}，约 ${roundedDegrees} 度`}
      />

      <View className='pixel-avatar-3d__hint' aria-hidden='true'>
        <Text>左右拖动 360° 旋转 · 双击回正</Text>
      </View>

      <View
        className='pixel-avatar-3d__reset'
        hoverClass='pixel-avatar-3d__reset--pressed'
        onClick={() => {
          haptics('light')
          startResetAnimation()
        }}
        role='button'
        aria-label='回到正面视角'
      >
        <Text>回正</Text>
      </View>
    </View>
  )
}

export default PixelAvatar3D

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { View } from '@tarojs/components'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import {
  GYRO_PARALLAX_SPIKE_ENABLED,
  GYRO_SPIKE_CALIBRATION_SAMPLES,
  computeParallaxTilt,
  createJankMonitor,
  smoothTilt,
  type DeviceOrientationSample,
  type JankReport,
  type ParallaxTilt,
} from './gyroParallax'

/**
 * S10 gyro-parallax spike (2026-08-11) — flag-gated wrapper for ONE hero
 * surface (the warmup topic card slot). See ./gyroParallax.ts for the locked
 * floors, sensor rationale, and constants.
 *
 * When `GYRO_PARALLAX_SPIKE_ENABLED` is false (default) or reduced motion is
 * on, this renders children verbatim — zero DOM, listener, or render delta.
 *
 * Lifecycle hygiene (WeChat keeps hidden pages alive): the sensor listener
 * and the jank rAF loop start on `useDidShow`/mount and stop on
 * `useDidHide`/unmount, so a backgrounded or swiped-away page never keeps the
 * gyroscope or the frame sampler alive.
 */

interface GyroParallaxSpikeProps {
  reduceMotion?: boolean
  children: ReactNode
}

const IDENTITY_TILT: ParallaxTilt = { rotateX: 0, rotateY: 0 }

export function GyroParallaxSpike({ reduceMotion = false, children }: GyroParallaxSpikeProps) {
  const active = GYRO_PARALLAX_SPIKE_ENABLED && !reduceMotion

  const [tilt, setTilt] = useState<ParallaxTilt>(IDENTITY_TILT)
  const [sensorLive, setSensorLive] = useState(false)

  const calibrationRef = useRef<DeviceOrientationSample[]>([])
  const neutralRef = useRef<DeviceOrientationSample | null>(null)
  const smoothedRef = useRef<ParallaxTilt>(IDENTITY_TILT)
  const pendingTiltRef = useRef<ParallaxTilt>(IDENTITY_TILT)
  const rafPendingRef = useRef(false)
  const listeningRef = useRef(false)
  const jankMonitorRef = useRef<ReturnType<typeof createJankMonitor> | null>(null)

  // Stable listener identity so offDeviceMotionChange can remove exactly the
  // function that was registered.
  const listenerRef = useRef((res: { beta?: number; gamma?: number }) => {
    if (typeof res.beta !== 'number' || typeof res.gamma !== 'number') return
    const sample: DeviceOrientationSample = { beta: res.beta, gamma: res.gamma }

    // Neutral-pose calibration: average the first few readings so "no tilt"
    // is however the player is naturally holding the phone at session start.
    if (!neutralRef.current) {
      calibrationRef.current.push(sample)
      if (calibrationRef.current.length >= GYRO_SPIKE_CALIBRATION_SAMPLES) {
        const n = calibrationRef.current.length
        neutralRef.current = calibrationRef.current.reduce(
          (acc, s) => ({ beta: acc.beta + s.beta / n, gamma: acc.gamma + s.gamma / n }),
          { beta: 0, gamma: 0 },
        )
      }
      return
    }

    // Low-pass smooth toward the target; the 0.15s CSS ease-out does the rest
    // (personality-card precedent: ≤8° clamp + rAF-throttled state updates).
    smoothedRef.current = smoothTilt(
      smoothedRef.current,
      computeParallaxTilt(sample, neutralRef.current),
    )
    pendingTiltRef.current = smoothedRef.current
    if (!rafPendingRef.current) {
      rafPendingRef.current = true
      requestAnimationFrame(() => {
        rafPendingRef.current = false
        if (listeningRef.current) {
          setTilt(pendingTiltRef.current)
        }
      })
    }
  })

  const stopListening = useCallback(() => {
    if (!listeningRef.current) return
    listeningRef.current = false
    try {
      Taro.offDeviceMotionChange(listenerRef.current as any)
      Taro.stopDeviceMotionListening()
    } catch {
      // API unsupported / already stopped — degrade silently.
    }
    jankMonitorRef.current?.stop()
    calibrationRef.current = []
    neutralRef.current = null
    smoothedRef.current = IDENTITY_TILT
    pendingTiltRef.current = IDENTITY_TILT
    setSensorLive(false)
    setTilt(IDENTITY_TILT)
  }, [])

  const startListening = useCallback(() => {
    if (listeningRef.current) return
    if (typeof Taro.startDeviceMotionListening !== 'function') return
    try {
      Taro.onDeviceMotionChange(listenerRef.current as any)
      Taro.startDeviceMotionListening({
        // ~60ms cadence: smooth enough for a passive flourish, ~3x cheaper
        // than 'game' for the battery envelope check.
        interval: 'ui',
        success: () => setSensorLive(true),
        fail: () => setSensorLive(false),
      })
      listeningRef.current = true

      // Dev-only measurement harness (field protocol: see findings doc).
      if (process.env.NODE_ENV !== 'production' && !jankMonitorRef.current) {
        const monitor = createJankMonitor({
          now: () => Date.now(),
          raf: (cb) => requestAnimationFrame(cb),
          cancelRaf: (id) => cancelAnimationFrame(id),
          onReport: (report: JankReport) => {
            // eslint-disable-next-line no-console
            console.warn(
              `[GyroSpike] jank ${report.jankFrames}/${report.frames} frames ` +
                `(${(report.jankRatio * 100).toFixed(1)}%), worst ${report.worstDeltaMs.toFixed(0)}ms`,
            )
          },
        })
        jankMonitorRef.current = monitor
        ;(globalThis as any).__JOYJOIN_GYRO_SPIKE__ = {
          getReport: () => monitor.getReport(),
          reset: () => {
            monitor.stop()
            monitor.start()
          },
        }
        monitor.start()
      }
    } catch {
      listeningRef.current = false
      setSensorLive(false)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    startListening()
    return () => stopListening()
  }, [active, startListening, stopListening])

  // Page lifecycle: stop on hide/background, resume on show (POCKET / swipe-away).
  useDidHide(() => {
    if (active) stopListening()
  })
  useDidShow(() => {
    if (active) startListening()
  })

  if (!active) {
    return <>{children}</>
  }

  return (
    <View
      className={`gyro-parallax ${sensorLive ? 'gyro-parallax--tracking' : ''}`}
      style={{
        transform: `perspective(1200rpx) rotateX(${tilt.rotateX.toFixed(2)}deg) rotateY(${tilt.rotateY.toFixed(2)}deg)`,
      }}
    >
      {children}
    </View>
  )
}

export default GyroParallaxSpike

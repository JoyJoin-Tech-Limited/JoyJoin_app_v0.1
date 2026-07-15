import { useEffect, useRef, useCallback, useState } from 'react'
import Taro from '@tarojs/taro'
import { callReportGps, getCurrentPosition, startLocationChange, haversine } from './api'
import {
  ALANG_ARRIVAL_RADIUS_METERS,
  ALANG_GPS_INTERVAL_MS,
} from '@shared/alang/constants'
import type { AlangCoordinate } from '@shared/alang/missionTypes'
import type { AlangProgressTransition } from './useAlangMission'
import {
  EMPTY_ALANG_DISTANCE_SMOOTHING_STATE,
  smoothAlangDistance,
  type AlangDistanceSmoothingState,
} from './distanceSmoothing'

export interface UseAlangGpsOptions {
  slug: string
  target?: AlangCoordinate
  enabled: boolean
  onArrival?: () => void
  onProgress?: (snapshot: AlangProgressTransition) => void
  onError?: (err: unknown) => void
}

export function useAlangGps({
  slug,
  target,
  enabled,
  onArrival,
  onProgress,
  onError,
}: UseAlangGpsOptions) {
  const [distance, setDistance] = useState<number | null>(null)
  const [arrived, setArrived] = useState(false)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [nodeId, setNodeId] = useState<string | null>(null)
  const [position, setPosition] = useState<AlangCoordinate | null>(null)
  const [configurationInvalid, setConfigurationInvalid] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)
  const lastReportRef = useRef(0)
  const reportingRef = useRef(false)
  const lastErrorNoticeRef = useRef(0)
  const distanceSmoothingRef = useRef<AlangDistanceSmoothingState>({
    ...EMPTY_ALANG_DISTANCE_SMOOTHING_STATE,
  })

  const updateDisplayDistance = useCallback((sampleMeters: number, force = false) => {
    const next = smoothAlangDistance(distanceSmoothingRef.current, sampleMeters, force)
    distanceSmoothingRef.current = next
    setDistance(next.displayMeters)
  }, [])

  const reportError = useCallback((error: unknown) => {
    const now = Date.now()
    if (now - lastErrorNoticeRef.current < 10_000) return
    lastErrorNoticeRef.current = now
    onError?.(error)
  }, [onError])

  const reportGps = useCallback(
    async (latitude: number, longitude: number, acc: number) => {
      if (reportingRef.current) return
      const now = Date.now()
      if (now - lastReportRef.current < ALANG_GPS_INTERVAL_MS) return
      reportingRef.current = true
      lastReportRef.current = now
      try {
        const targetOverride: {
          latitude: number
          longitude: number
          radiusMeters: typeof ALANG_ARRIVAL_RADIUS_METERS
        } | undefined = target
          ? { ...target, radiusMeters: ALANG_ARRIVAL_RADIUS_METERS }
          : undefined
        const res = await callReportGps(slug, {
          latitude,
          longitude,
          accuracy: acc,
          timestamp: now,
          targetOverride,
        })
        if (res.configurationInvalid) {
          setConfigurationInvalid(true)
          setDistance(null)
          return
        }
        setConfigurationInvalid(false)
        updateDisplayDistance(
          res.arrived ? Math.min(res.distanceMeters, res.radiusMeters) : res.distanceMeters,
          res.arrived,
        )
        if (res.nodeId) {
          setNodeId(res.nodeId)
          onProgress?.({ stage: res.stage, currentNodeId: res.nodeId })
        }
        if (res.arrived && !arrived) {
          setArrived(true)
          onArrival?.()
        }
      } catch (err) {
        reportError(err)
      } finally {
        reportingRef.current = false
      }
    },
    [slug, target, arrived, onArrival, onProgress, reportError, updateDisplayDistance]
  )

  useEffect(() => {
    distanceSmoothingRef.current = { ...EMPTY_ALANG_DISTANCE_SMOOTHING_STATE }
    setDistance(null)
    setArrived(false)
    setNodeId(null)
    setConfigurationInvalid(false)
  }, [slug, target?.latitude, target?.longitude])

  useEffect(() => {
    let cancelled = false
    if (!enabled) {
      cleanupRef.current?.()
      cleanupRef.current = null
      return
    }

    // Initial position
    getCurrentPosition()
      .then((res) => {
        if (cancelled) return
        setPosition({ latitude: res.latitude, longitude: res.longitude })
        if (target && !arrived) {
          updateDisplayDistance(haversine(res.latitude, res.longitude, target.latitude, target.longitude))
        }
        setAccuracy(res.accuracy ?? null)
        reportGps(res.latitude, res.longitude, res.accuracy ?? 50)
      })
      .catch((error) => {
        if (!cancelled) reportError(error)
      })

    // Real-time updates
    cleanupRef.current = startLocationChange(
      (res) => {
        if (cancelled) return
        setPosition({ latitude: res.latitude, longitude: res.longitude })
        if (target && !arrived) {
          updateDisplayDistance(haversine(res.latitude, res.longitude, target.latitude, target.longitude))
        }
        setAccuracy(res.accuracy ?? null)
        reportGps(res.latitude, res.longitude, res.accuracy ?? 50)
      },
      (error) => {
        if (!cancelled) reportError(error)
      }
    )

    return () => {
      cancelled = true
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [enabled, target, arrived, reportGps, reportError, updateDisplayDistance])

  return { distance, arrived, accuracy, nodeId, position, configurationInvalid }
}

export function useAlangGpsOnce() {
  const [position, setPosition] = useState<(AlangCoordinate & { accuracy: number }) | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)

  const request = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getCurrentPosition()
      const pos = {
        latitude: res.latitude,
        longitude: res.longitude,
        accuracy: res.accuracy ?? 50,
      }
      setPosition(pos)
      setLoading(false)
      return pos
    } catch (err) {
      setError(err)
      setLoading(false)
      throw err
    }
  }, [])

  return { position, error, loading, request }
}

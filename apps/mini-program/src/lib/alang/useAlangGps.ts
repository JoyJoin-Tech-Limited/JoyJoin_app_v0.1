import { useEffect, useRef, useCallback, useState } from 'react'
import Taro from '@tarojs/taro'
import { callReportGps, getCurrentPosition, startLocationChange, haversine } from './api'
import { ALANG_GPS_INTERVAL_MS } from '@shared/alang/constants'
import type { AlangArrivalResponse } from '@shared/alang/missionTypes'

export interface UseAlangGpsOptions {
  slug: string
  targetLat?: number
  targetLng?: number
  radiusMeters?: number
  enabled: boolean
  onArrival?: () => void
  onError?: (err: unknown) => void
}

export function useAlangGps({
  slug,
  targetLat,
  targetLng,
  radiusMeters = 5,
  enabled,
  onArrival,
  onError,
}: UseAlangGpsOptions) {
  const [distance, setDistance] = useState<number | null>(null)
  const [arrived, setArrived] = useState(false)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [nodeId, setNodeId] = useState<string | null>(null)
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const lastReportRef = useRef(0)
  const reportingRef = useRef(false)
  const lastErrorNoticeRef = useRef(0)

  const reportError = useCallback((error: unknown) => {
    const now = Date.now()
    if (now - lastErrorNoticeRef.current < 10_000) return
    lastErrorNoticeRef.current = now
    onError?.(error)
  }, [onError])

  const reportGps = useCallback(
    async (lat: number, lng: number, acc: number) => {
      if (reportingRef.current) return
      const now = Date.now()
      if (now - lastReportRef.current < ALANG_GPS_INTERVAL_MS) return
      reportingRef.current = true
      lastReportRef.current = now
      try {
        const targetOverride = targetLat !== undefined && targetLng !== undefined
          ? { lat: targetLat, lng: targetLng, radiusMeters }
          : undefined
        const res = await callReportGps(slug, {
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          timestamp: now,
          targetOverride,
        })
        setDistance(res.distanceMeters)
        if (res.nodeId) {
          setNodeId(res.nodeId)
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
    [slug, targetLat, targetLng, radiusMeters, arrived, onArrival, reportError]
  )

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
        setPosition({ lat: res.latitude, lng: res.longitude })
        if (targetLat !== undefined && targetLng !== undefined) {
          setDistance(haversine(res.latitude, res.longitude, targetLat, targetLng))
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
        setPosition({ lat: res.latitude, lng: res.longitude })
        if (targetLat !== undefined && targetLng !== undefined) {
          setDistance(haversine(res.latitude, res.longitude, targetLat, targetLng))
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
  }, [enabled, targetLat, targetLng, reportGps, reportError])

  return { distance, arrived, accuracy, nodeId, position }
}

export function useAlangGpsOnce() {
  const [position, setPosition] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)

  const request = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getCurrentPosition()
      const pos = { lat: res.latitude, lng: res.longitude, accuracy: res.accuracy ?? 50 }
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

import Taro from '@tarojs/taro'
import { useMemo } from 'react'
import { getSystemReducedMotionCompat } from '../lib/utils/systemInfo'

type MotionMode = 'full' | 'reduce'
type MotionSource = 'query' | 'storage' | 'benchmark' | 'system' | 'default'

export interface MiniRevealMotionPreference {
  motionMode: MotionMode
  shouldReduceMotion: boolean
  source: MotionSource
}

const MOTION_STORAGE_KEY = 'joyjoin:mini-reveal-motion'

function normalizeMotionMode(value?: string): MotionMode | null {
  if (!value) {
    return null
  }

  const normalizedValue = value.trim().toLowerCase()

  if (['reduce', 'reduced', 'low', 'minimal', 'off'].includes(normalizedValue)) {
    return 'reduce'
  }

  if (['full', 'default', 'on'].includes(normalizedValue)) {
    return 'full'
  }

  return null
}

function readStoredMotionMode(): MotionMode | null {
  try {
    const storedValue = Taro.getStorageSync(MOTION_STORAGE_KEY)
    return typeof storedValue === 'string' ? normalizeMotionMode(storedValue) : null
  } catch {
    return null
  }
}

function shouldUseReducedMotionFallback(): boolean {
  try {
    // OS-level reduced-motion preference (iOS / Android accessibility)
    return getSystemReducedMotionCompat()
  } catch {
    return false
  }
}

export function resolveMiniRevealMotionPreference(
  params?: Record<string, string | undefined>,
): MiniRevealMotionPreference {
  const queryMode =
    normalizeMotionMode(params?.motion) ??
    normalizeMotionMode(params?.reducedMotion) ??
    normalizeMotionMode(params?.reduceMotion) ??
    normalizeMotionMode(params?.lowMotion)

  if (queryMode) {
    return {
      motionMode: queryMode,
      shouldReduceMotion: queryMode === 'reduce',
      source: 'query',
    }
  }

  const storedMode = readStoredMotionMode()

  if (storedMode) {
    return {
      motionMode: storedMode,
      shouldReduceMotion: storedMode === 'reduce',
      source: 'storage',
    }
  }

  if (shouldUseReducedMotionFallback()) {
    return {
      motionMode: 'reduce',
      shouldReduceMotion: true,
      source: 'system',
    }
  }

  return {
    motionMode: 'full',
    shouldReduceMotion: false,
    source: 'default',
  }
}

export function useMiniRevealMotion(
  params?: Record<string, string | undefined>,
): MiniRevealMotionPreference {
  const motion = params?.motion
  const reducedMotion = params?.reducedMotion
  const reduceMotion = params?.reduceMotion
  const lowMotion = params?.lowMotion

  return useMemo(
    () =>
      resolveMiniRevealMotionPreference({
        motion,
        reducedMotion,
        reduceMotion,
        lowMotion,
      }),
    [lowMotion, motion, reduceMotion, reducedMotion],
  )
}
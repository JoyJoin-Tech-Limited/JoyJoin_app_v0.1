import { View, Text } from '@tarojs/components'
import { useRef, useState, useCallback, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { BlindBoxVisual } from './BlindBoxVisual'
import { squadUnboxingAnalytics } from '../../lib/analytics/squadUnboxingAnalytics'
import './DragRevealRibbon.scss'

export interface DragRevealRibbonProps {
  shouldReduceMotion: boolean
  isDegradation: boolean
  enabled: boolean
  onReveal: () => void
}

const SNAP_THRESHOLD = 0.5

function triggerLightHaptic() {
  if (typeof Taro.vibrateShort === 'function') {
    void Taro.vibrateShort({ type: 'light' }).catch(() => undefined)
  }
}

export default function DragRevealRibbon({
  shouldReduceMotion,
  isDegradation,
  enabled,
  onReveal,
}: DragRevealRibbonProps) {
  const useTapFallback = shouldReduceMotion || isDegradation || !enabled

  const trackRef = useRef<{ width: number } | null>(null)
  const touchRef = useRef<{ startX: number; maxPx: number } | null>(null)
  const rafRef = useRef<number | null>(null)
  const pendingProgressRef = useRef<number>(0)
  const hasDraggedRef = useRef(false)
  const isRevealingRef = useRef(false)
  const snapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [dragProgress, setDragProgress] = useState(0)
  const [isRevealing, setIsRevealing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const measureMaxDrag = useCallback(() => {
    return new Promise<number>((resolve) => {
      Taro.createSelectorQuery()
        .select('#drag-reveal-track')
        .boundingClientRect()
        .exec((res) => {
          const width = (res[0] as { width?: number })?.width ?? 300
          trackRef.current = { width }
          resolve(Math.max(width * 0.5, 120))
        })
    })
  }, [])

  // Pre-measure track width on mount so first touch has immediate feedback
  useEffect(() => {
    void measureMaxDrag()
  }, [measureMaxDrag])

  const flushProgress = useCallback(() => {
    rafRef.current = null
    setDragProgress(pendingProgressRef.current)
  }, [])

  const scheduleProgress = useCallback(
    (progress: number) => {
      pendingProgressRef.current = progress
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flushProgress)
      }
    },
    [flushProgress],
  )

  const handleTouchStart = useCallback(
    async (e: any) => {
      if (useTapFallback || isRevealing) return
      const touch = e.touches[0]
      const maxPx = await measureMaxDrag()
      hasDraggedRef.current = false
      touchRef.current = { startX: touch.clientX, maxPx }
      setIsDragging(true)
    },
    [useTapFallback, isRevealing, measureMaxDrag],
  )

  const handleTouchMove = useCallback(
    (e: any) => {
      if (!touchRef.current || useTapFallback || isRevealing) return
      hasDraggedRef.current = true
      const touch = e.touches[0]
      const deltaX = touch.clientX - touchRef.current.startX
      const progress = Math.max(0, Math.min(1, deltaX / touchRef.current.maxPx))
      scheduleProgress(progress)
    },
    [useTapFallback, isRevealing, scheduleProgress],
  )

  const handleTouchEnd = useCallback(() => {
    if (useTapFallback) {
      if (!isRevealing && !hasDraggedRef.current) {
        squadUnboxingAnalytics.track('squad_unboxing_reveal_tap', {
          method: 'tap',
          fallbackReason: shouldReduceMotion ? 'reducedMotion' : isDegradation ? 'degradation' : 'featureFlag',
        })
        onReveal()
      }
      return
    }

    setIsDragging(false)

    if (!touchRef.current || isRevealing) return

    const currentProgress = pendingProgressRef.current

    if (currentProgress >= SNAP_THRESHOLD) {
      triggerLightHaptic()
      squadUnboxingAnalytics.track('squad_unboxing_reveal_drag', {
        method: 'drag',
        progress: Math.round(currentProgress * 100),
      })
      isRevealingRef.current = true
      setIsRevealing(true)
      scheduleProgress(1)
      snapTimeoutRef.current = setTimeout(() => onReveal(), 280)
    } else {
      scheduleProgress(0)
    }
    touchRef.current = null
  }, [useTapFallback, isRevealing, onReveal, scheduleProgress, shouldReduceMotion, isDegradation])

  const handleTap = useCallback(() => {
    if (useTapFallback && !isRevealingRef.current && !isRevealing) {
      squadUnboxingAnalytics.track('squad_unboxing_reveal_tap', {
        method: 'tap',
        fallbackReason: shouldReduceMotion ? 'reducedMotion' : isDegradation ? 'degradation' : 'featureFlag',
      })
      isRevealingRef.current = true
      setIsRevealing(true)
      onReveal()
    }
  }, [useTapFallback, isRevealing, onReveal, shouldReduceMotion, isDegradation])

  // Cancel any pending RAF / timeout on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
      }
      if (snapTimeoutRef.current != null) {
        clearTimeout(snapTimeoutRef.current)
      }
    }
  }, [])

  const thumbLeft = `${4 + dragProgress * 92}%`
  const fillWidth = `${dragProgress * 100}%`

  const trackLabel = useTapFallback
    ? '点击拆盒'
    : '向右滑动，拆开惊喜'

  return (
    <View className='drag-reveal-ribbon'>
      <View className='drag-reveal-ribbon__box-area'>
        <BlindBoxVisual
          state='ready'
          shouldReduceMotion={shouldReduceMotion}
          dragProgress={dragProgress}
        />
      </View>

      <View
        id='drag-reveal-track'
        className={[
          'drag-reveal-ribbon__track',
          isRevealing ? 'drag-reveal-ribbon__track--revealing' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        catchMove
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleTap}
        role='slider'
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(dragProgress * 100)}
        aria-label={trackLabel}
        aria-live='polite'
      >
        <View
          className='drag-reveal-ribbon__fill'
          style={{ width: fillWidth }}
        />
        <View
          className={[
            'drag-reveal-ribbon__thumb',
            isDragging ? 'drag-reveal-ribbon__thumb--dragging' : '',
            isRevealing ? 'drag-reveal-ribbon__thumb--revealing' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ left: thumbLeft }}
        >
          <Text className='drag-reveal-ribbon__thumb-icon'>
            {isRevealing ? '✓' : '→'}
          </Text>
        </View>
        {!isRevealing && (
          <Text className='drag-reveal-ribbon__track-label'>
            {trackLabel}
          </Text>
        )}
      </View>
    </View>
  )
}

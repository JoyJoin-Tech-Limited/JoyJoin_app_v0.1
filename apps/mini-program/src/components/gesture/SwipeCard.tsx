import { type ReactNode, useRef, useState, useCallback, useEffect } from 'react'
import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './SwipeCard.scss'

function prefersReducedMotion(): boolean {
  try {
    const info = Taro.getSystemInfoSync()
    if ((info as any).reduceMotion) return true
  } catch {
    // ignore
  }
  return false
}

const REDUCED_MOTION = prefersReducedMotion()

export interface SwipeCardProps {
  children: ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  /** Threshold as fraction of card width (default 0.5) */
  threshold?: number
  /** Override reduced-motion detection for testing */
  reducedMotion?: boolean
}

interface TouchState {
  startX: number
  startY: number
  currentX: number
  cardWidth: number
}

type SnapState = 'idle' | 'snapping-left' | 'snapping-right'

/**
 * SwipeCard — vote/answer by swiping left/right.
 *
 * Used in lie_detective, undercover_word, quip_battle.
 * Touch-driven translateX with natural tilt.
 * Reduced motion: immediate callback on threshold cross, no animation.
 */
export default function SwipeCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  threshold = 0.5,
  reducedMotion,
}: SwipeCardProps) {
  const isReduced = reducedMotion ?? REDUCED_MOTION
  const idRef = useRef(`swipe-card-${Math.random().toString(36).slice(2, 9)}`)
  const touchRef = useRef<TouchState | null>(null)
  const snapTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [deltaX, setDeltaX] = useState(0)
  const [snap, setSnap] = useState<SnapState>('idle')

  const measureCard = useCallback(() => {
    return new Promise<number>((resolve) => {
      Taro.createSelectorQuery()
        .select(`#${idRef.current}`)
        .boundingClientRect()
        .exec((res) => {
          resolve((res[0] as { width?: number })?.width ?? 350)
        })
    })
  }, [])

  const handleTouchStart = useCallback(
    async (e: any) => {
      if (snap !== 'idle') return
      const touch = e.touches[0]
      const cardWidth = await measureCard()
      touchRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        cardWidth,
      }
    },
    [snap, measureCard],
  )

  const handleTouchMove = useCallback(
    (e: any) => {
      if (!touchRef.current || snap !== 'idle') return
      const touch = e.touches[0]
      touchRef.current.currentX = touch.clientX
      const dx = touch.clientX - touchRef.current.startX
      // Only horizontal swipes — ignore if vertical dominates
      const dy = touch.clientY - touchRef.current.startY
      if (Math.abs(dx) > Math.abs(dy) || Math.abs(dx) > 16) {
        setDeltaX(dx)
      }
    },
    [snap],
  )

  const commitSwipe = useCallback(
    (direction: 'left' | 'right') => {
      if (isReduced) {
        setDeltaX(0)
        touchRef.current = null
        if (direction === 'left') onSwipeLeft?.()
        else onSwipeRight?.()
        return
      }

      setSnap(direction === 'left' ? 'snapping-left' : 'snapping-right')
      if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current)
      snapTimeoutRef.current = setTimeout(() => {
        setDeltaX(0)
        setSnap('idle')
        touchRef.current = null
        if (direction === 'left') onSwipeLeft?.()
        else onSwipeRight?.()
      }, 280)
    },
    [onSwipeLeft, onSwipeRight],
  )

  const handleTouchEnd = useCallback(() => {
    if (!touchRef.current || snap !== 'idle') return
    const { startX, currentX, cardWidth } = touchRef.current
    const dx = currentX - startX
    const thresholdPx = cardWidth * threshold

    if (dx > thresholdPx) {
      commitSwipe('right')
    } else if (dx < -thresholdPx) {
      commitSwipe('left')
    } else {
      // Spring back
      setDeltaX(0)
      touchRef.current = null
    }
  }, [snap, threshold, commitSwipe])

  useEffect(() => {
    return () => {
      if (snapTimeoutRef.current) {
        clearTimeout(snapTimeoutRef.current)
        snapTimeoutRef.current = undefined
      }
    }
  }, [])

  const getTransform = (): string => {
    if (snap === 'snapping-left') return 'translateX(-120%) rotateZ(-8deg)'
    if (snap === 'snapping-right') return 'translateX(120%) rotateZ(8deg)'
    const rotate = deltaX * 0.05
    return `translateX(${deltaX}px) rotateZ(${rotate}deg)`
  }

  const isActive = snap !== 'idle' || Math.abs(deltaX) > 0

  return (
    <View
      id={idRef.current}
      className={`gesture-swipe-card${isActive ? ' gesture-swipe-card--active' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <View
        className='gesture-swipe-card__inner'
        style={{
          transform: getTransform(),
          transition: isActive && snap === 'idle' ? 'none' : 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {children}
      </View>

      {/* Direction hints */}
      {!isReduced && (
        <>
          <View
            className='gesture-swipe-card__hint gesture-swipe-card__hint--left'
            style={{ opacity: Math.abs(deltaX) > 20 && deltaX < 0 ? Math.min(Math.abs(deltaX) / 120, 0.8) : 0 }}
          >
            <View className='gesture-swipe-card__hint-icon'>✕</View>
          </View>
          <View
            className='gesture-swipe-card__hint gesture-swipe-card__hint--right'
            style={{ opacity: Math.abs(deltaX) > 20 && deltaX > 0 ? Math.min(Math.abs(deltaX) / 120, 0.8) : 0 }}
          >
            <View className='gesture-swipe-card__hint-icon'>✓</View>
          </View>
        </>
      )}
    </View>
  )
}

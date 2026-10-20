import { type ReactNode, useRef, useState, useCallback, useEffect } from 'react'
import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getSystemReducedMotionCompat, getWindowInfoCompat } from '../../lib/utils/systemInfo'
import JoyJoinIcon from '../ui/JoyJoinIcon'
import {
  SWIPE_LEFT_EDGE_DEAD_ZONE_RPX,
  isHorizontalSwipeIntent,
  isLeftEdgeDeadZone,
  shouldStartTracking,
  swipeRpxToPx,
} from './swipeCardModel'
// No SCSS side-effect import: Taro's per-subpackage chunking would strand it
// in a page-invisible sub-common.wxss. Consuming pages must @use
// '../../components/gesture/SwipeCard.scss' in their page SCSS.

function prefersReducedMotion(): boolean {
  try {
    if (getSystemReducedMotionCompat()) return true
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
  /** False until the gesture proves horizontally dominant (direction lock). */
  tracking: boolean
}

type SnapState = 'idle' | 'snapping-left' | 'snapping-right'

/**
 * SwipeCard — vote/answer by swiping left/right.
 *
 * Used in lie_detective, undercover_word, quip_battle.
 * Touch-driven translateX with natural tilt.
 * Reduced motion: immediate callback on threshold cross, no animation.
 *
 * Craft rules (sprint icebreaker-polish-p1, contract AC-03):
 *  - Card width is measured ONCE at mount into a ref — touchstart never
 *    blocks on a bridge round-trip (the old live measure cost ~20-30ms of
 *    first-frame lag).
 *  - Direction lock: the card follows the finger only after the gesture is
 *    clearly horizontal (|dx| > 1.5×|dy|) — vertical scroll intent no longer
 *    wiggles the card.
 *  - The leftmost 40rpx is a dead zone (iOS swipe-back): touches starting
 *    there are ignored.
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
  const cardWidthRef = useRef(350)
  const [deltaX, setDeltaX] = useState(0)
  const [snap, setSnap] = useState<SnapState>('idle')

  // Mount-time width measure (contract AC-03③): one bridge call per card,
  // cached for every later gesture. A failed/raced read keeps the 350px
  // fallback — never a per-gesture bridge round-trip again.
  useEffect(() => {
    Taro.createSelectorQuery()
      .select(`#${idRef.current}`)
      .boundingClientRect()
      .exec((res) => {
        const width = (res[0] as { width?: number } | undefined)?.width
        if (typeof width === 'number' && width > 0) {
          cardWidthRef.current = width
        }
      })
  }, [])

  const handleTouchStart = useCallback(
    (e: any) => {
      if (snap !== 'idle') return
      const touch = e.touches[0]
      // Left-edge dead zone (contract AC-03②): iOS 右滑返回 owns the leftmost
      // 40rpx — a card swipe must never start there.
      const deadZonePx = swipeRpxToPx(SWIPE_LEFT_EDGE_DEAD_ZONE_RPX, getWindowInfoCompat().windowWidth)
      if (isLeftEdgeDeadZone(touch.clientX, deadZonePx)) return
      touchRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        tracking: false,
      }
    },
    [snap],
  )

  const handleTouchMove = useCallback(
    (e: any) => {
      if (!touchRef.current || snap !== 'idle') return
      const touch = e.touches[0]
      const dx = touch.clientX - touchRef.current.startX
      const dy = touch.clientY - touchRef.current.startY
      if (!touchRef.current.tracking) {
        // Direction lock (contract AC-03①): only a clearly horizontal gesture
        // starts tracking — the old `|dx|>|dy| || |dx|>16` rule let vertical
        // scrolls wiggle the card.
        if (!shouldStartTracking(dx, dy)) return
        touchRef.current.tracking = true
      } else if (!isHorizontalSwipeIntent(dx, dy)) {
        // Already tracking but the finger went vertical — hold the last
        // position instead of following into the scroll axis.
        return
      }
      touchRef.current.currentX = touch.clientX
      setDeltaX(dx)
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
    [onSwipeLeft, onSwipeRight, isReduced],
  )

  const handleTouchEnd = useCallback(() => {
    if (!touchRef.current || snap !== 'idle') return
    // Never tracked (vertical scroll / dead-zone tap) — release silently.
    if (!touchRef.current.tracking) {
      touchRef.current = null
      setDeltaX(0)
      return
    }
    const { startX, currentX } = touchRef.current
    const dx = currentX - startX
    const thresholdPx = cardWidthRef.current * threshold

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
            <JoyJoinIcon className='gesture-swipe-card__hint-icon' emoji='✕' tier='status' size={40} />
          </View>
          <View
            className='gesture-swipe-card__hint gesture-swipe-card__hint--right'
            style={{ opacity: Math.abs(deltaX) > 20 && deltaX > 0 ? Math.min(Math.abs(deltaX) / 120, 0.8) : 0 }}
          >
            <JoyJoinIcon className='gesture-swipe-card__hint-icon' emoji='✓' tier='status' size={40} />
          </View>
        </>
      )}
    </View>
  )
}

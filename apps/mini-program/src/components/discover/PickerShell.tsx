import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import CloseIcon from '../ui/CloseIcon'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import './PickerShell.scss'
import { getWindowInfoCompat } from '../../lib/utils/systemInfo'

export interface PickerShellProps {
  visible: boolean
  onClose: () => void
  mascotExpression: 'homeWelcome' | 'coachGuide' | 'matchWaiting'
  title: string
  subtitle?: string
  showClose?: boolean
  reduceMotion: boolean
  children: ReactNode
  footer?: ReactNode
  overlay?: ReactNode
  className?: string
  /**
   * Consumer-computed surface height in rpx (2026-09-30 精细化: the area
   * drawer sizes to its content). Falls back to the legacy viewport-based
   * measurement when omitted (CityPickerSheet).
   */
  heightRpx?: number
}

const DEFAULT_SHELL_HEIGHT_RPX = 1100
// Tab bar is hidden when bottom sheet is open, so no clearance needed.
// Small breathing room for safe-area bottom.
const SHELL_BOTTOM_CLEARANCE_RPX = 0

// Drag-to-close thresholds (px space = boundingClientRect space).
const DRAG_CLOSE_DISTANCE_PX = 96
const DRAG_CLOSE_VELOCITY_PX_PER_MS = 0.45
const DRAG_SETTLE_MS = 280

export default function PickerShell({
  visible,
  onClose,
  mascotExpression,
  title,
  subtitle,
  showClose = true,
  reduceMotion,
  children,
  footer,
  overlay,
  className = '',
  heightRpx,
}: PickerShellProps) {
  const shellHeightRpx = useMemo(() => {
    let windowRpx = Number.POSITIVE_INFINITY
    try {
      const { windowHeight, screenWidth } = getWindowInfoCompat()
      if (windowHeight && screenWidth) {
        windowRpx = (windowHeight * 750) / screenWidth
      }
    } catch {
      // keep the uncapped default
    }
    const cap = Math.min(
      DEFAULT_SHELL_HEIGHT_RPX,
      Math.max(400, Math.floor(windowRpx - SHELL_BOTTOM_CLEARANCE_RPX)),
    )
    if (typeof heightRpx === 'number' && heightRpx > 0) {
      return Math.min(Math.round(heightRpx), cap)
    }
    return cap
  }, [heightRpx])

  // JS-computed inline styles must be px (the Taro H5 parser silently drops
  // inline rpx — same rule the drag transform follows).
  const shellHeightPx = useMemo(() => {
    try {
      const { screenWidth } = getWindowInfoCompat()
      if (!screenWidth) return null
      return Math.round((shellHeightRpx * screenWidth) / 750)
    } catch {
      return null
    }
  }, [shellHeightRpx])

  // ── Drag-to-close (2026-09-30 精细化) ──
  // The drag handle doubles as a pan-down-to-dismiss grip. Inline styles are
  // emitted in px (JS-computed): the Taro H5 style parser drops inline rpx.
  const [dragOffsetPx, setDragOffsetPx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [dragClosing, setDragClosing] = useState(false)
  const dragRef = useRef<{ startY: number; lastY: number; lastT: number } | null>(null)

  const handleDragStart = (e: any) => {
    if (!visible || dragClosing) return
    const touch = e.touches?.[0]
    if (!touch) return
    dragRef.current = { startY: touch.clientY, lastY: touch.clientY, lastT: Date.now() }
    setDragging(true)
  }

  const handleDragMove = (e: any) => {
    const drag = dragRef.current
    if (!drag) return
    const touch = e.touches?.[0]
    if (!touch) return
    const dy = Math.max(0, touch.clientY - drag.startY)
    drag.lastY = touch.clientY
    drag.lastT = Date.now()
    setDragOffsetPx(dy)
  }

  const handleDragEnd = () => {
    const drag = dragRef.current
    if (!drag) return
    const velocity =
      Date.now() > drag.lastT ? (drag.lastY - drag.startY) / (Date.now() - drag.lastT) : 0
    const shouldClose = dragOffsetPx > DRAG_CLOSE_DISTANCE_PX || velocity > DRAG_CLOSE_VELOCITY_PX_PER_MS
    if (shouldClose) {
      setDragClosing(true)
      setDragging(false)
      setTimeout(() => {
        setDragClosing(false)
        setDragOffsetPx(0)
        onClose()
      }, DRAG_SETTLE_MS)
    } else {
      setDragging(false)
      setDragOffsetPx(0)
    }
  }

  const surfaceTransform = dragClosing
    ? 'translateY(100%)'
    : visible
      ? `translateY(${dragOffsetPx}px)`
      : 'translateY(100%)'

  const surfaceTransition = dragging
    ? 'none'
    : `transform ${reduceMotion ? 0 : 280}ms cubic-bezier(0.22, 1, 0.36, 1), height ${reduceMotion ? 0 : 200}ms ease`

  return (
    <View
      className={`picker-shell ${visible ? 'picker-shell--open' : ''} ${reduceMotion ? 'picker-shell--reduce-motion' : ''} ${className}`}
      aria-hidden={!visible}
    >
      <View
        className='picker-shell__backdrop'
        onClick={onClose}
        catchMove
        role='button'
        aria-label='关闭'
      />
      <View
        className='picker-shell__surface'
        style={{
          height: shellHeightPx ? `${shellHeightPx}px` : `${shellHeightRpx}rpx`,
          transform: surfaceTransform,
          transition: surfaceTransition,
        }}
        role='dialog'
        aria-modal='true'
        onClick={(e) => e.stopPropagation()}
        catchMove
      >
        <View
          className={`picker-shell__handle ${dragging ? 'picker-shell__handle--dragging' : ''}`}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          onTouchCancel={handleDragEnd}
          aria-hidden='true'
        />

        <View className='picker-shell__header'>
          <View className='picker-shell__title-row'>
            <Image
              className='picker-shell__mascot'
              src={getXiaoyueExpressionAsset(mascotExpression)}
              mode='aspectFit'
              aria-hidden='true'
            />
            <Text className='picker-shell__title'>{title}</Text>
          </View>
          {showClose && (
            <View
              className='picker-shell__close'
              onClick={onClose}
              hoverClass='picker-shell__close--hover'
              role='button'
              aria-label='关闭'
            >
              <CloseIcon size={28} className='picker-shell__close-icon' />
            </View>
          )}
        </View>

        {subtitle && <Text className='picker-shell__subtitle'>{subtitle}</Text>}

        <View className='picker-shell__content'>{children}</View>

        {footer && <View className='picker-shell__footer'>{footer}</View>}

        {overlay && (
          <View className='picker-shell__overlay' aria-hidden='false'>
            {overlay}
          </View>
        )}
      </View>
    </View>
  )
}

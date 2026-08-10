import Taro from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Text, View } from '@tarojs/components'
import { haptics } from '../../../lib/utils/haptics'

interface Point {
  x: number
  y: number
}

interface TouchOrigin extends Point {
  pageX: number
  pageY: number
}

export interface ShiqiOutbookInteractionProps {
  completed?: boolean
  disabled?: boolean
  mistakeAcknowledged?: boolean
  reduceMotion?: boolean
  onInteractionStart: () => void
  onFirstMistake: () => void
  onComplete: () => void
}

const INITIAL_OFFSET_RPX: Point = { x: -64, y: 40 }
const SNAP_THRESHOLD_RPX = 28

function getViewportScale(): number {
  try {
    const width = Taro.getSystemInfoSync().windowWidth
    return typeof width === 'number' && width > 0 ? width / 750 : 0.5
  } catch {
    return 0.5
  }
}

function getSystemReducedMotion(): boolean {
  try {
    return (Taro.getSystemInfoSync() as { reduceMotion?: boolean }).reduceMotion === true
  } catch {
    return false
  }
}

function getH5ReducedMotionQuery(): MediaQueryList | null {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
    return window.matchMedia('(prefers-reduced-motion: reduce)')
  } catch {
    return null
  }
}

function getInitialReducedMotion(): boolean {
  return getSystemReducedMotion() || getH5ReducedMotionQuery()?.matches === true
}

function useReducedMotionPreference(override?: boolean): boolean {
  const [reducedMotion, setReducedMotion] = useState(() => override ?? getInitialReducedMotion())

  useEffect(() => {
    if (override !== undefined) {
      setReducedMotion(override)
      return undefined
    }

    const systemReducedMotion = getSystemReducedMotion()
    const mediaQuery = getH5ReducedMotionQuery()
    setReducedMotion(systemReducedMotion || mediaQuery?.matches === true)
    if (!mediaQuery) return undefined

    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotion(systemReducedMotion || event.matches)
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [override])

  return reducedMotion
}

export function ShiqiOutbookInteraction({
  completed = false,
  disabled = false,
  mistakeAcknowledged = false,
  reduceMotion: reduceMotionProp,
  onInteractionStart,
  onFirstMistake,
  onComplete,
}: ShiqiOutbookInteractionProps) {
  const scale = useMemo(getViewportScale, [])
  const initialPosition = useMemo(() => ({
    x: INITIAL_OFFSET_RPX.x * scale,
    y: INITIAL_OFFSET_RPX.y * scale,
  }), [scale])
  const reduceMotion = useReducedMotionPreference(reduceMotionProp)
  const [position, setPosition] = useState<Point>(completed ? { x: 0, y: 0 } : initialPosition)
  const [aligned, setAligned] = useState(completed)
  const [dragging, setDragging] = useState(false)
  const positionRef = useRef(position)
  const touchOriginRef = useRef<TouchOrigin | null>(null)
  const interactionStartedRef = useRef(false)
  const mistakeNotifiedRef = useRef(mistakeAcknowledged)
  const alignedRef = useRef(completed)

  useEffect(() => {
    if (!completed || alignedRef.current) return
    alignedRef.current = true
    positionRef.current = { x: 0, y: 0 }
    setPosition({ x: 0, y: 0 })
    setAligned(true)
  }, [completed])

  const startInteraction = useCallback(() => {
    if (interactionStartedRef.current) return
    interactionStartedRef.current = true
    onInteractionStart()
  }, [onInteractionStart])

  const complete = useCallback(() => {
    if (alignedRef.current || disabled) return
    startInteraction()
    alignedRef.current = true
    positionRef.current = { x: 0, y: 0 }
    setPosition({ x: 0, y: 0 })
    setDragging(false)
    setAligned(true)
    haptics('light')
    onComplete()
  }, [disabled, onComplete, startInteraction])

  const handleTouchStart = useCallback((event: any) => {
    if (disabled || alignedRef.current) return
    const touch = event.touches?.[0]
    if (!touch) return
    startInteraction()
    touchOriginRef.current = {
      pageX: touch.clientX,
      pageY: touch.clientY,
      ...positionRef.current,
    }
    setDragging(true)
  }, [disabled, startInteraction])

  const handleTouchMove = useCallback((event: any) => {
    const origin = touchOriginRef.current
    const touch = event.touches?.[0]
    if (!origin || !touch || alignedRef.current || disabled) return
    const next = {
      x: Math.max(-96 * scale, Math.min(96 * scale, origin.x + touch.clientX - origin.pageX)),
      y: Math.max(-72 * scale, Math.min(72 * scale, origin.y + touch.clientY - origin.pageY)),
    }
    positionRef.current = next
    setPosition(next)
  }, [disabled, scale])

  const handleTouchEnd = useCallback(() => {
    if (!touchOriginRef.current || alignedRef.current || disabled) return
    touchOriginRef.current = null
    setDragging(false)
    const distance = Math.hypot(positionRef.current.x, positionRef.current.y)
    if (distance <= SNAP_THRESHOLD_RPX * scale) {
      complete()
      return
    }

    positionRef.current = initialPosition
    setPosition(initialPosition)
    if (!mistakeNotifiedRef.current) {
      mistakeNotifiedRef.current = true
      onFirstMistake()
    }
  }, [complete, disabled, initialPosition, onFirstMistake, scale])

  const transform = `translate3d(${position.x}px, ${position.y}px, 0)`

  return (
    <View
      className={`shiqi-outbook${aligned ? ' shiqi-outbook--aligned' : ''}${dragging ? ' shiqi-outbook--dragging' : ''}${reduceMotion ? ' shiqi-outbook--reduced-motion' : ''}`}
      data-testid='shiqi-outbook'
      data-aligned={String(aligned)}
      role='group'
      aria-label='拾柒的旧出门册'
    >
      <View className='shiqi-outbook__heading'>
        <Text className='shiqi-outbook__eyebrow'>旧物小试 · 出门册</Text>
        <Text className='shiqi-outbook__title'>让三条路线重新重合</Text>
        <Text className='shiqi-outbook__instruction'>拖动上层纸页，让三条紫色路线贴回下层浅线。</Text>
      </View>

      <View className='shiqi-outbook__desk'>
        <View className='shiqi-outbook__paper shiqi-outbook__paper--under' aria-hidden='true'>
          <View className='shiqi-outbook__route shiqi-outbook__route--one' />
          <View className='shiqi-outbook__route shiqi-outbook__route--two' />
          <View className='shiqi-outbook__route shiqi-outbook__route--three' />
          <Text className='shiqi-outbook__paper-note'>交换箱夹层 · 浅痕</Text>
        </View>
        <View
          className='shiqi-outbook__paper shiqi-outbook__paper--top'
          style={{
            transform,
            transition: reduceMotion || dragging ? 'none' : 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
          catchMove={!disabled && !aligned}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          role='slider'
          aria-label='拖动上层纸页，让三条路线重合'
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={aligned ? 100 : 0}
          aria-disabled={disabled || aligned}
        >
          <View className='shiqi-outbook__route shiqi-outbook__route--one' />
          <View className='shiqi-outbook__route shiqi-outbook__route--two' />
          <View className='shiqi-outbook__route shiqi-outbook__route--three' />
          <Text className='shiqi-outbook__paper-note'>空白盖章页 · 三道短线</Text>
          <View className='shiqi-outbook__grip' aria-hidden='true'>
            <Text>拖住纸角</Text>
          </View>
        </View>
        <View className='shiqi-outbook__target' aria-hidden='true' />
      </View>

      {reduceMotion && !aligned ? (
        <View
          className='shiqi-outbook__reduced-action'
          hoverClass='shiqi-outbook__reduced-action--pressed'
          onClick={complete}
          role='button'
          aria-label='将三条路线对齐'
        >
          <Text>将三条路线对齐</Text>
        </View>
      ) : null}

      <View className='shiqi-outbook__status' role='status' aria-live='polite'>
        <Text>{aligned ? '三条路线贴回去了。' : '不用猜答案，移动纸页就好。'}</Text>
      </View>
    </View>
  )
}

import { Text, View } from '@tarojs/components'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { EquipmentItem, EquipmentOutfit, EquipmentSlot } from '../../lib/profile/equipmentApi'
import {
  PIXEL_AVATAR_FRAME_IDS,
  normalizePixelAvatarFrameId,
  type PixelAvatarFrameId,
} from '../../lib/profile/pixelAvatarAssets'
import PixelAvatarComposite, { type PixelAvatarSlotHotspot } from './PixelAvatarComposite'
import './PixelAvatarTurntable.scss'

export interface PixelAvatarTurntableProps {
  archetypeId: string
  outfit: EquipmentOutfit
  itemsById: ReadonlyMap<string, EquipmentItem>
  variant?: 'compact' | 'full'
  className?: string
  initialFrameId?: PixelAvatarFrameId
  onFrameChange?: (frameId: PixelAvatarFrameId) => void
  slotHotspots?: PixelAvatarSlotHotspot[]
  onSlotTap?: (slot: EquipmentSlot) => void
}

type DragAxis = 'idle' | 'pending' | 'horizontal' | 'vertical'

interface GestureState {
  startX: number
  startY: number
  startFrameIndex: number
  axis: Exclude<DragAxis, 'idle'>
}

const AXIS_LOCK_THRESHOLD_PX = 8
const AXIS_DOMINANCE_RATIO = 1.15
const FRAME_DRAG_DISTANCE_PX = 52
const FRONT_FRAME_INDEX = PIXEL_AVATAR_FRAME_IDS.indexOf('front')

const FRAME_LABELS: Record<PixelAvatarFrameId, string> = {
  'left-far': '左转 2 档',
  'left-near': '左转 1 档',
  front: '正面',
  'right-near': '右转 1 档',
  'right-far': '右转 2 档',
}

function clampFrameIndex(index: number): number {
  return Math.min(PIXEL_AVATAR_FRAME_IDS.length - 1, Math.max(0, index))
}

export function getPixelAvatarFrameIndexAfterDrag(
  startFrameIndex: number,
  deltaX: number,
): number {
  const frameDelta = Math.round(-deltaX / FRAME_DRAG_DISTANCE_PX)
  return clampFrameIndex(startFrameIndex + frameDelta)
}

function getTouchPoint(event: any): { clientX: number; clientY: number } | null {
  const touch = event?.touches?.[0] ?? event?.changedTouches?.[0]
  if (!touch || typeof touch.clientX !== 'number' || typeof touch.clientY !== 'number') {
    return null
  }
  return { clientX: touch.clientX, clientY: touch.clientY }
}

export function PixelAvatarTurntable({
  archetypeId,
  outfit,
  itemsById,
  variant = 'full',
  className = '',
  initialFrameId = 'front',
  onFrameChange,
  slotHotspots,
  onSlotTap,
}: PixelAvatarTurntableProps) {
  const normalizedInitialFrame = normalizePixelAvatarFrameId(initialFrameId)
  const [frameIndex, setFrameIndex] = useState(
    Math.max(0, PIXEL_AVATAR_FRAME_IDS.indexOf(normalizedInitialFrame)),
  )
  const frameIndexRef = useRef(frameIndex)
  const [dragAxis, setDragAxis] = useState<DragAxis>('idle')
  const gestureRef = useRef<GestureState | null>(null)
  const frameId = PIXEL_AVATAR_FRAME_IDS[frameIndex]

  useEffect(() => {
    const nextIndex = PIXEL_AVATAR_FRAME_IDS.indexOf(normalizedInitialFrame)
    const safeIndex = Math.max(0, nextIndex)
    frameIndexRef.current = safeIndex
    setFrameIndex(safeIndex)
  }, [normalizedInitialFrame])

  const commitFrameIndex = useCallback((nextIndex: number) => {
    const safeIndex = clampFrameIndex(nextIndex)
    if (frameIndexRef.current === safeIndex) return
    frameIndexRef.current = safeIndex
    setFrameIndex(safeIndex)
    onFrameChange?.(PIXEL_AVATAR_FRAME_IDS[safeIndex])
  }, [onFrameChange])

  const handleTouchStart = useCallback((event: any) => {
    const point = getTouchPoint(event)
    if (!point) return
    gestureRef.current = {
      startX: point.clientX,
      startY: point.clientY,
      startFrameIndex: frameIndex,
      axis: 'pending',
    }
    setDragAxis('pending')
  }, [frameIndex])

  const handleTouchMove = useCallback((event: any) => {
    const gesture = gestureRef.current
    const point = getTouchPoint(event)
    if (!gesture || !point) return

    const deltaX = point.clientX - gesture.startX
    const deltaY = point.clientY - gesture.startY
    if (gesture.axis === 'pending') {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < AXIS_LOCK_THRESHOLD_PX) return
      gesture.axis = Math.abs(deltaX) > Math.abs(deltaY) * AXIS_DOMINANCE_RATIO
        ? 'horizontal'
        : 'vertical'
      setDragAxis(gesture.axis)
    }

    if (gesture.axis !== 'horizontal') return
    event.stopPropagation?.()
    event.preventDefault?.()
    commitFrameIndex(getPixelAvatarFrameIndexAfterDrag(gesture.startFrameIndex, deltaX))
  }, [commitFrameIndex])

  const finishGesture = useCallback(() => {
    gestureRef.current = null
    setDragAxis('idle')
  }, [])

  const moveBy = useCallback((delta: number) => {
    commitFrameIndex(frameIndex + delta)
  }, [commitFrameIndex, frameIndex])

  const resetToFront = useCallback(() => {
    commitFrameIndex(FRONT_FRAME_INDEX)
  }, [commitFrameIndex])

  const atStart = frameIndex === 0
  const atEnd = frameIndex === PIXEL_AVATAR_FRAME_IDS.length - 1
  const frameLabel = FRAME_LABELS[frameId]

  return (
    <View
      className={`pixel-avatar-turntable pixel-avatar-turntable--${variant} ${className}`.trim()}
      data-frame={frameId}
      data-drag-axis={dragAxis}
      role='group'
      aria-label='像素形象五档伪 3D 旋转预览'
    >
      <View
        className={`pixel-avatar-turntable__viewport${dragAxis === 'horizontal' ? ' pixel-avatar-turntable__viewport--dragging' : ''}`}
        catchMove={dragAxis === 'horizontal'}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={finishGesture}
        onTouchCancel={finishGesture}
        role='slider'
        aria-label='左右拖动旋转形象'
        aria-orientation='horizontal'
        aria-valuemin={1}
        aria-valuemax={PIXEL_AVATAR_FRAME_IDS.length}
        aria-valuenow={frameIndex + 1}
        aria-valuetext={`${frameLabel}，第 ${frameIndex + 1} 档，共 5 档`}
      >
        <PixelAvatarComposite
          archetypeId={archetypeId}
          outfit={outfit}
          itemsById={itemsById}
          frameId={frameId}
          variant={variant}
          slotHotspots={slotHotspots}
          onSlotTap={onSlotTap}
        />
      </View>

      <View className='pixel-avatar-turntable__hint' aria-hidden='true'>
        <Text>左右拖动旋转</Text>
        <Text className='pixel-avatar-turntable__hint-dot'>·</Text>
        <Text>5 档</Text>
      </View>

      <View className='pixel-avatar-turntable__controls' aria-label='旋转视角控制'>
        <View
          className={`pixel-avatar-turntable__control${atStart ? ' pixel-avatar-turntable__control--disabled' : ''}`}
          hoverClass={atStart ? 'none' : 'pixel-avatar-turntable__control--pressed'}
          onClick={() => !atStart && moveBy(-1)}
          role='button'
          aria-label='向左一档'
          aria-disabled={atStart}
        >
          <Text aria-hidden='true'>‹</Text>
        </View>

        <View
          className={`pixel-avatar-turntable__front-control${frameId === 'front' ? ' pixel-avatar-turntable__front-control--active' : ''}`}
          hoverClass='pixel-avatar-turntable__front-control--pressed'
          onClick={resetToFront}
          role='button'
          aria-label='回到正面视角'
        >
          <Text>{frameLabel}</Text>
        </View>

        <View
          className={`pixel-avatar-turntable__control${atEnd ? ' pixel-avatar-turntable__control--disabled' : ''}`}
          hoverClass={atEnd ? 'none' : 'pixel-avatar-turntable__control--pressed'}
          onClick={() => !atEnd && moveBy(1)}
          role='button'
          aria-label='向右一档'
          aria-disabled={atEnd}
        >
          <Text aria-hidden='true'>›</Text>
        </View>
      </View>
    </View>
  )
}

export default PixelAvatarTurntable

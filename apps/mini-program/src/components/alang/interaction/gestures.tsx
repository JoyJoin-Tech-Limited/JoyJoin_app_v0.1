import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { Text, View } from '@tarojs/components'

/**
 * 叙事动作层手势渲染器（AC-04）：纸物件叙事，不是游戏引擎——全部以
 * 大点击区域的轻点为主、短拖为辅；任何落点都有有效结果，无硬失败。
 * 模板组件与 JSON 配置解耦（MNT-02）：渲染器只接收 positionCount，
 * 结果文案一律由服务端回响节点承载。
 */
export interface FlashGestureProps {
  /** 落点位置数（= 有效结果数，≥1）。最后一个位置是完成态。 */
  positionCount: number
  disabled: boolean
  reducedMotion: boolean
  onGestureStart: () => void
  onProgress: (position: number | null) => void
  onMistake: () => void
}

function useTrackWidth(elementId: string) {
  const widthRef = useRef<number | null>(null)
  useEffect(() => {
    try {
      Taro.createSelectorQuery()
        .select(`#${elementId}`)
        .boundingClientRect((rect: { width?: number } | Array<{ width?: number }>) => {
          const width = Array.isArray(rect) ? rect[0]?.width : rect?.width
          if (typeof width === 'number' && width > 0) widthRef.current = width
        })
        .exec(() => undefined)
    } catch {
      // 量不到宽度时退化为纯轻点（永远可用）。
    }
  }, [elementId])
  return widthRef
}

function zoneStyle(index: number, count: number): { left: string } {
  if (count <= 1) return { left: '50%' }
  return { left: `${(index / (count - 1)) * 100}%` }
}

interface DragState {
  startX: number
  originZone: number
  offset: number
}

function useSnappingZoneDrag(options: {
  elementId: string
  zone: number
  positionCount: number
  disabled: boolean
  onGestureStart: () => void
  onZoneChange: (zone: number, moved: boolean) => void
}) {
  const { elementId, zone, positionCount, disabled, onGestureStart, onZoneChange } = options
  const widthRef = useTrackWidth(elementId)
  const [drag, setDrag] = useState<DragState | null>(null)

  const handleTouchStart = (event: any) => {
    if (disabled) return
    const clientX = event?.touches?.[0]?.clientX
    if (typeof clientX !== 'number') return
    onGestureStart()
    setDrag({ startX: clientX, originZone: zone, offset: 0 })
  }

  const handleTouchMove = (event: any) => {
    if (!drag) return
    const clientX = event?.touches?.[0]?.clientX
    const width = widthRef.current
    if (typeof clientX !== 'number' || !width) return
    const maxOffset = width * 0.6
    setDrag({ ...drag, offset: Math.min(maxOffset, Math.max(-maxOffset, clientX - drag.startX)) })
  }

  const handleTouchEnd = () => {
    if (!drag) return
    const width = widthRef.current
    const zoneWidth = width && positionCount > 1 ? width / (positionCount - 1) : null
    const steps = zoneWidth ? Math.round(drag.offset / zoneWidth) : 0
    const nextZone = Math.min(positionCount - 1, Math.max(0, drag.originZone + steps))
    setDrag(null)
    onZoneChange(nextZone, nextZone !== drag.originZone)
  }

  return { drag, handleTouchStart, handleTouchMove, handleTouchEnd }
}

/** spacing 摆放留距：右侧纸椅可拖可点，落到一个距离刻度上。 */
export function SpacingGesture({ positionCount, disabled, reducedMotion, onGestureStart, onProgress, onMistake }: FlashGestureProps) {
  const [zone, setZone] = useState(0)
  const trackId = 'flash-interaction-spacing-track'
  const single = positionCount <= 1

  const place = (nextZone: number, moved: boolean) => {
    if (single) {
      onProgress(0)
      return
    }
    if (!moved) {
      onMistake()
      return
    }
    setZone(nextZone)
    onProgress(nextZone)
  }

  const { drag, handleTouchStart, handleTouchMove, handleTouchEnd } = useSnappingZoneDrag({
    elementId: trackId,
    zone,
    positionCount,
    disabled,
    onGestureStart,
    onZoneChange: place,
  })

  return (
    <View className={`flash-interaction__gesture flash-interaction__gesture--spacing${reducedMotion ? ' flash-interaction__gesture--reduced' : ''}`} data-testid='flash-interaction-gesture-spacing'>
      <View className='flash-interaction__track' id={trackId}>
        {Array.from({ length: positionCount }, (_, index) => (
          <View
            key={index}
            className={`flash-interaction__zone${index === zone ? ' flash-interaction__zone--active' : ''}`}
            style={zoneStyle(index, positionCount)}
            data-testid={`flash-interaction-zone-${index}`}
            role='button'
            aria-label={`把椅子放到第 ${index + 1} 个位置`}
            onClick={() => {
              if (disabled) return
              onGestureStart()
              place(index, index !== zone)
            }}
          />
        ))}
        <View className='flash-interaction__chair flash-interaction__chair--fixed' aria-hidden='true'>
          <Text className='flash-interaction__chair-mark'>椅</Text>
        </View>
        <View
          className='flash-interaction__chair flash-interaction__chair--movable'
          style={{
            ...zoneStyle(zone, positionCount),
            ...(drag ? { transform: `translateX(${drag.offset}px)` } : {}),
          }}
          data-testid='flash-interaction-chair'
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <Text className='flash-interaction__chair-mark'>椅</Text>
        </View>
      </View>
    </View>
  )
}

/** path 路径：顺着纸上的点一格一格往前走，在想到的地方停下。 */
export function PathGesture({ positionCount, disabled, reducedMotion, onGestureStart, onProgress, onMistake }: FlashGestureProps) {
  const [reached, setReached] = useState(-1)

  const tapWaypoint = (index: number) => {
    if (disabled) return
    onGestureStart()
    if (index === reached + 1) {
      setReached(index)
      onProgress(index)
      return
    }
    if (index <= reached) {
      // 回看已经走过的点不算错误，静默允许。
      return
    }
    onMistake()
  }

  return (
    <View className={`flash-interaction__gesture flash-interaction__gesture--path${reducedMotion ? ' flash-interaction__gesture--reduced' : ''}`} data-testid='flash-interaction-gesture-path'>
      <View className='flash-interaction__path'>
        {Array.from({ length: positionCount }, (_, index) => (
          <View key={index} className='flash-interaction__waypoint-wrap'>
            {index > 0 ? (
              <View className={`flash-interaction__path-line${index <= reached ? ' flash-interaction__path-line--reached' : ''}`} aria-hidden='true' />
            ) : null}
            <View
              className={`flash-interaction__waypoint${index <= reached ? ' flash-interaction__waypoint--reached' : ''}${index === reached + 1 ? ' flash-interaction__waypoint--next' : ''}`}
              data-testid={`flash-interaction-waypoint-${index}`}
              role='button'
              aria-label={index <= reached ? `已经走过的第 ${index + 1} 个点` : `走到第 ${index + 1} 个点`}
              onClick={() => tapWaypoint(index)}
            />
          </View>
        ))}
      </View>
    </View>
  )
}

/** overlay 叠合：拖动上层纸页（或轻点对齐刻度），让纸页贴回浅痕。 */
export function OverlayGesture({ positionCount, disabled, reducedMotion, onGestureStart, onProgress, onMistake }: FlashGestureProps) {
  const [zone, setZone] = useState(0)
  const trackId = 'flash-interaction-overlay-track'
  const single = positionCount <= 1

  const place = (nextZone: number, moved: boolean) => {
    if (single) {
      onProgress(0)
      return
    }
    if (!moved) {
      onMistake()
      return
    }
    setZone(nextZone)
    onProgress(nextZone)
  }

  const { drag, handleTouchStart, handleTouchMove, handleTouchEnd } = useSnappingZoneDrag({
    elementId: trackId,
    zone,
    positionCount,
    disabled,
    onGestureStart,
    onZoneChange: place,
  })

  return (
    <View className={`flash-interaction__gesture flash-interaction__gesture--overlay${reducedMotion ? ' flash-interaction__gesture--reduced' : ''}`} data-testid='flash-interaction-gesture-overlay'>
      <View className='flash-interaction__layers' id={trackId}>
        <View className='flash-interaction__layer flash-interaction__layer--under' aria-hidden='true'>
          <Text className='flash-interaction__layer-mark'>痕</Text>
        </View>
        <View
          className='flash-interaction__layer flash-interaction__layer--over'
          style={{
            ...zoneStyle(zone, positionCount),
            ...(drag ? { transform: `translateX(${drag.offset}px)` } : {}),
          }}
          data-testid='flash-interaction-layer'
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <Text className='flash-interaction__layer-mark'>纸</Text>
        </View>
      </View>
      <View className='flash-interaction__marks'>
        {Array.from({ length: positionCount }, (_, index) => (
          <View
            key={index}
            className={`flash-interaction__align-mark${index === zone ? ' flash-interaction__align-mark--active' : ''}`}
            data-testid={`flash-interaction-mark-${index}`}
            role='button'
            aria-label={`对齐到第 ${index + 1} 道刻度`}
            onClick={() => {
              if (disabled) return
              onGestureStart()
              place(index, index !== zone)
            }}
          />
        ))}
      </View>
    </View>
  )
}

/** privacy 遮盖取舍：轻点纸格盖住/揭开，盖住的才是要收好的。 */
export function PrivacyGesture({ positionCount, disabled, reducedMotion, onGestureStart, onProgress, onMistake }: FlashGestureProps) {
  const regionCount = Math.min(3, Math.max(2, positionCount + 1))
  const [masked, setMasked] = useState<boolean[]>(() => Array.from({ length: regionCount }, () => false))

  const toggleRegion = (index: number, event?: { stopPropagation?: () => void }) => {
    event?.stopPropagation?.()
    if (disabled) return
    onGestureStart()
    const next = masked.map((value, regionIndex) => (regionIndex === index ? !value : value))
    setMasked(next)
    const maskedCount = next.filter(Boolean).length
    onProgress(maskedCount < 1 ? null : Math.min(maskedCount, positionCount - 1))
  }

  return (
    <View className={`flash-interaction__gesture flash-interaction__gesture--privacy${reducedMotion ? ' flash-interaction__gesture--reduced' : ''}`} data-testid='flash-interaction-gesture-privacy'>
      <View
        className='flash-interaction__privacy-board'
        onClick={() => {
          if (disabled) return
          onGestureStart()
          onMistake()
        }}
      >
        {masked.map((isMasked, index) => (
          <View
            key={index}
            className={`flash-interaction__region${isMasked ? ' flash-interaction__region--masked' : ''}`}
            data-testid={`flash-interaction-region-${index}`}
            role='button'
            aria-label={isMasked ? `揭开第 ${index + 1} 处` : `盖住第 ${index + 1} 处`}
            aria-pressed={isMasked}
            onClick={(event: { stopPropagation?: () => void }) => toggleRegion(index, event)}
          >
            <Text className='flash-interaction__region-label'>第 {index + 1} 处</Text>
            <View className='flash-interaction__region-cover' aria-hidden='true' />
          </View>
        ))}
      </View>
    </View>
  )
}

/**
 * pairing 配对（试点外，随全季 sprint 启用）：先点左边的纸片，再点右边的
 * 位置完成配对；数据驱动，与试点模板共用同一套落点语义。
 */
export function PairingGesture({ positionCount, disabled, reducedMotion, onGestureStart, onProgress, onMistake }: FlashGestureProps) {
  const pairCount = Math.min(3, Math.max(2, positionCount + 1))
  const [selected, setSelected] = useState<number | null>(null)
  const [paired, setPaired] = useState<Array<number | null>>(() => Array.from({ length: pairCount }, () => null))

  const tapLeft = (index: number) => {
    if (disabled) return
    onGestureStart()
    if (paired[index] !== null) {
      const next = paired.map((value, itemIndex) => (itemIndex === index ? null : value))
      setPaired(next)
      const pairedCount = next.filter((value) => value !== null).length
      onProgress(pairedCount < 1 ? null : Math.min(pairedCount, positionCount - 1))
      return
    }
    setSelected(index)
  }

  const tapRight = (slot: number) => {
    if (disabled) return
    onGestureStart()
    if (selected === null) {
      onMistake()
      return
    }
    if (paired.some((value) => value === slot)) return
    const next = paired.map((value, itemIndex) => (itemIndex === selected ? slot : value))
    setPaired(next)
    setSelected(null)
    const pairedCount = next.filter((value) => value !== null).length
    onProgress(Math.min(pairedCount, positionCount - 1))
  }

  return (
    <View className={`flash-interaction__gesture flash-interaction__gesture--pairing${reducedMotion ? ' flash-interaction__gesture--reduced' : ''}`} data-testid='flash-interaction-gesture-pairing'>
      <View className='flash-interaction__pairing'>
        <View className='flash-interaction__pairing-column'>
          {paired.map((slot, index) => (
            <View
              key={index}
              className={`flash-interaction__pair-item${selected === index ? ' flash-interaction__pair-item--selected' : ''}${slot !== null ? ' flash-interaction__pair-item--paired' : ''}`}
              data-testid={`flash-interaction-pair-left-${index}`}
              role='button'
              aria-label={slot !== null ? `放回第 ${index + 1} 张纸片` : `拿起第 ${index + 1} 张纸片`}
              onClick={() => tapLeft(index)}
            >
              <Text className='flash-interaction__pair-label'>纸片 {index + 1}</Text>
            </View>
          ))}
        </View>
        <View className='flash-interaction__pairing-column'>
          {Array.from({ length: pairCount }, (_, slot) => (
            <View
              key={slot}
              className={`flash-interaction__pair-slot${paired.some((value) => value === slot) ? ' flash-interaction__pair-slot--filled' : ''}`}
              data-testid={`flash-interaction-pair-right-${slot}`}
              role='button'
              aria-label={`放到第 ${slot + 1} 个位置`}
              onClick={() => tapRight(slot)}
            />
          ))}
        </View>
      </View>
    </View>
  )
}

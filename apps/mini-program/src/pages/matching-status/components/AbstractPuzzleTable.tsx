import { View, Text } from '@tarojs/components'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import { getSystemReducedMotion } from '../../../lib/utils/accessibility'
import { haptics } from '../../../lib/utils/haptics'
import './AbstractPuzzleTable.scss'

export type PuzzlePhase = 'falling' | 'complete'

export interface AbstractPuzzleTableProps {
  pieceCount: number
  onComplete?: () => void
  onSkip?: () => void
  accentColor?: string
  shouldReduceMotion?: boolean
  isDegradation?: boolean
  onPhaseChange?: (phase: PuzzlePhase) => void
}

interface PuzzlePieceSpec {
  id: number
  sizeRpx: number
  startX: number
  endX: number
  rotation: number
  delayMs: number
  colorAlpha: number
}

const CONTAINER_WIDTH_RPX = 560
const PIECE_SIZE_MIN_RPX = 56
const PIECE_SIZE_MAX_RPX = 88
const FALL_DURATION_MS = 720
const SNAP_DURATION_MS = 360
const TOTAL_MAX_MS = 2200

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function generatePieces(count: number, containerWidthRpx: number, seed: number): PuzzlePieceSpec[] {
  const pieces: PuzzlePieceSpec[] = []
  const usableWidth = Math.max(containerWidthRpx - 120, 160)
  const columnWidth = usableWidth / Math.max(count, 1)
  const rand = mulberry32(seed)

  for (let i = 0; i < count; i += 1) {
    const sizeRpx = PIECE_SIZE_MIN_RPX + rand() * (PIECE_SIZE_MAX_RPX - PIECE_SIZE_MIN_RPX)
    const jitter = (rand() - 0.5) * columnWidth * 0.6
    const endX = (containerWidthRpx - usableWidth) / 2 + i * columnWidth + columnWidth / 2 + jitter
    const startX = endX + (rand() - 0.5) * 120
    const rotation = (rand() - 0.5) * 40
    const delayMs = Math.min(i * 90, 360) + rand() * 80
    const colorAlpha = 0.34 + rand() * 0.28

    pieces.push({
      id: i,
      sizeRpx,
      startX,
      endX,
      rotation,
      delayMs,
      colorAlpha,
    })
  }

  return pieces
}

export default function AbstractPuzzleTable({
  pieceCount,
  onComplete,
  onSkip,
  accentColor = 'rgba(139, 92, 246, 0.45)',
  shouldReduceMotion: propShouldReduceMotion,
  isDegradation: propIsDegradation,
  onPhaseChange,
}: AbstractPuzzleTableProps) {
  const { isDegradation: deviceDegradation } = useDeviceTier()
  const isDegradation = propIsDegradation ?? deviceDegradation
  const shouldReduceMotion = propShouldReduceMotion ?? getSystemReducedMotion()

  const pieces = useMemo(
    () => generatePieces(pieceCount, CONTAINER_WIDTH_RPX, pieceCount * 73),
    [pieceCount]
  )
  const [phase, setPhase] = useState<PuzzlePhase>(
    shouldReduceMotion || isDegradation ? 'complete' : 'falling'
  )
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const hasCompletedRef = useRef(false)

  useEffect(() => {
    if (shouldReduceMotion || isDegradation) {
      setPhase('complete')
      onPhaseChange?.('complete')
      return undefined
    }

    hasCompletedRef.current = false
    setPhase('falling')
    onPhaseChange?.('falling')

    const completeTimer = setTimeout(() => {
      if (hasCompletedRef.current) return
      hasCompletedRef.current = true
      setPhase('complete')
      onPhaseChange?.('complete')
      haptics('medium')
      onComplete?.()
    }, TOTAL_MAX_MS)

    timersRef.current = [completeTimer]

    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
  }, [isDegradation, onComplete, onPhaseChange, shouldReduceMotion])

  const handleSkip = () => {
    if (hasCompletedRef.current) return
    hasCompletedRef.current = true
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setPhase('complete')
    onPhaseChange?.('complete')
    onSkip?.()
  }

  const isComplete = phase === 'complete'

  return (
    <View
      className='abstract-puzzle-table'
      aria-label='队伍正在成型，下页查看队友'
      onClick={handleSkip}
    >
      <View className='abstract-puzzle-table__table-surface'>
        {pieces.map((piece, index) => {
          const transform = isComplete
            ? `translate(-50%, -50%) rotate(0deg) scale(1)`
            : `translate(-50%, calc(-50% - 280rpx)) rotate(${piece.rotation}deg) scale(0.88)`

          return (
            <View
              key={piece.id}
              className='abstract-puzzle-table__piece'
              style={{
                left: `${piece.endX}rpx`,
                width: `${piece.sizeRpx}rpx`,
                height: `${piece.sizeRpx}rpx`,
                transform,
                opacity: isComplete ? piece.colorAlpha + 0.18 : piece.colorAlpha,
                backgroundColor: accentColor,
                transitionDuration: isComplete ? `${SNAP_DURATION_MS}ms` : `${FALL_DURATION_MS}ms`,
                transitionDelay: isComplete ? `${index * 40}ms` : `${piece.delayMs}ms`,
              }}
            />
          )
        })}

        {isComplete ? (
          <View
            className='abstract-puzzle-table__complete-glow'
            style={{ backgroundColor: accentColor }}
          />
        ) : null}
      </View>

      {!isComplete ? <Text className='abstract-puzzle-table__hint'>点击跳过</Text> : null}
    </View>
  )
}

import { View, Text, Image } from '@tarojs/components'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import { getSystemReducedMotion } from '../../../lib/utils/accessibility'
import { haptics } from '../../../lib/utils/haptics'
import {
  getPuzzlePieceSrc,
  PUZZLE_PIECE_COUNT,
} from '../../../lib/utils/matchingPuzzleAssets'
import './AbstractPuzzleTable.scss'

export type PuzzlePhase = 'falling' | 'complete'

export interface AbstractPuzzleTableProps {
  pieceCount?: number
  onComplete?: () => void
  onSkip?: () => void
  accentColor?: string
  shouldReduceMotion?: boolean
  isDegradation?: boolean
  onPhaseChange?: (phase: PuzzlePhase) => void
}

interface PuzzlePieceState {
  id: number
  initialX: number
  initialY: number
  initialRotation: number
  initialScale: number
  delayMs: number
}

const TOTAL_DURATION_MS = 2400
const SNAP_DURATION_MS = 760

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function generatePieceStates(seed: number): PuzzlePieceState[] {
  const rand = mulberry32(seed)
  const states: PuzzlePieceState[] = []

  for (let i = 0; i < PUZZLE_PIECE_COUNT; i += 1) {
    const angle = rand() * Math.PI * 2
    const distance = 160 + rand() * 200
    const initialX = Math.cos(angle) * distance
    const initialY = Math.sin(angle) * distance - 80
    const initialRotation = (rand() - 0.5) * 70
    const initialScale = 0.72 + rand() * 0.16
    const delayMs = Math.floor(rand() * 120)

    states.push({
      id: i + 1,
      initialX,
      initialY,
      initialRotation,
      initialScale,
      delayMs,
    })
  }

  return states
}

export default function AbstractPuzzleTable({
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

  const pieces = useMemo(() => generatePieceStates(20260702), [])
  const [phase, setPhase] = useState<PuzzlePhase>(
    shouldReduceMotion || isDegradation ? 'complete' : 'falling'
  )
  const [pieceAttempts, setPieceAttempts] = useState<Record<number, number>>({})
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
    }, TOTAL_DURATION_MS)

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
      aria-label='一桌碎片正在归位'
      onClick={handleSkip}
    >
      <View className='abstract-puzzle-table__plate'>
        <View
          className='abstract-puzzle-table__plate-glow'
          style={{ backgroundColor: accentColor }}
        />

        <View className='abstract-puzzle-table__grid'>
          {pieces.map((piece) => {
            const attempt = pieceAttempts[piece.id] ?? 0
            const src =
              attempt === 0
                ? getPuzzlePieceSrc(piece.id, 'cdn')
                : attempt === 1
                  ? getPuzzlePieceSrc(piece.id, 'png')
                  : getPuzzlePieceSrc(piece.id, 'local')
            const fallback = attempt >= 3

            const transform = isComplete
              ? `translate(0, 0) rotate(0deg) scale(1)`
              : `translate(${piece.initialX}rpx, ${piece.initialY}rpx) rotate(${piece.initialRotation}deg) scale(${piece.initialScale})`

            const transitionDelay = isComplete ? `${piece.delayMs}ms` : '0ms'
            const transitionDuration = isComplete ? `${SNAP_DURATION_MS}ms` : '0ms'

            if (fallback) {
              return (
                <View
                  key={piece.id}
                  className='abstract-puzzle-table__cell abstract-puzzle-table__cell--fallback'
                  style={{
                    transform,
                    opacity: isComplete ? 1 : 0.55,
                    transitionDelay,
                    transitionDuration,
                    backgroundColor: accentColor,
                  }}
                />
              )
            }

            return (
              <Image
                key={piece.id}
                className='abstract-puzzle-table__piece'
                src={src}
                mode='aspectFit'
                lazyLoad={false}
                style={{
                  transform,
                  opacity: isComplete ? 1 : 0.45,
                  transitionDelay,
                  transitionDuration,
                }}
                onError={() =>
                  setPieceAttempts((prev) => ({
                    ...prev,
                    [piece.id]: (prev[piece.id] ?? 0) + 1,
                  }))
                }
              />
            )
          })}
        </View>

        {isComplete ? (
          <View
            className='abstract-puzzle-table__complete-glow'
            style={{ backgroundColor: accentColor }}
          />
        ) : null}
      </View>

      {!isComplete ? (
        <Text className='abstract-puzzle-table__hint'>点击跳过动画</Text>
      ) : null}
    </View>
  )
}

import { View, Text, Image } from '@tarojs/components'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDeviceTier } from '../../../hooks/useDeviceTier'
import { getSystemReducedMotion } from '../../../lib/utils/accessibility'
import { haptics } from '../../../lib/utils/haptics'
import {
  getParticleSrc,
  getTableTextureSrc,
  type PuzzleParticleColor,
} from '../../../lib/utils/matchingPuzzleAssets'
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
  endX: number
  rotation: number
  delayMs: number
  colorAlpha: number
  color: PuzzleParticleColor
}

const CONTAINER_WIDTH_RPX = 560
const PIECE_SIZE_MIN_RPX = 56
const PIECE_SIZE_MAX_RPX = 96
const FALL_DURATION_MS = 720
const SNAP_DURATION_MS = 360
const TOTAL_MAX_MS = 2200

const PARTICLE_COLORS: PuzzleParticleColor[] = ['purple', 'coral', 'blue', 'green']

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
    const rotation = (rand() - 0.5) * 40
    const delayMs = Math.min(i * 90, 360) + rand() * 80
    const colorAlpha = 0.7 + rand() * 0.2
    const color = PARTICLE_COLORS[i % PARTICLE_COLORS.length]

    pieces.push({
      id: i,
      sizeRpx,
      endX,
      rotation,
      delayMs,
      colorAlpha,
      color,
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
    () => generatePieces(Math.max(4, Math.min(pieceCount, 6)), CONTAINER_WIDTH_RPX, pieceCount * 73),
    [pieceCount]
  )
  const [phase, setPhase] = useState<PuzzlePhase>(
    shouldReduceMotion || isDegradation ? 'complete' : 'falling'
  )
  const [pieceAttempts, setPieceAttempts] = useState<Record<number, number>>({})
  const [textureAttempt, setTextureAttempt] = useState(0)
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

  const textureSrc =
    textureAttempt === 0
      ? getTableTextureSrc('cdn')
      : textureAttempt === 1
        ? getTableTextureSrc('png')
        : getTableTextureSrc('local')

  return (
    <View
      className='abstract-puzzle-table'
      aria-label='队伍正在成型，下页查看队友'
      onClick={handleSkip}
    >
      <View className='abstract-puzzle-table__table-surface'>
        <Image
          className='abstract-puzzle-table__texture'
          src={textureSrc}
          mode='aspectFill'
          lazyLoad={false}
          onError={() => setTextureAttempt((a) => a + 1)}
        />

        {pieces.map((piece, index) => {
          const attempt = pieceAttempts[piece.id] ?? 0
          const src =
            attempt === 0
              ? getParticleSrc(piece.color, 'cdn')
              : attempt === 1
                ? getParticleSrc(piece.color, 'png')
                : getParticleSrc(piece.color, 'local')
          const fallback = attempt >= 3

          const transform = isComplete
            ? `translate(-50%, -50%) rotate(0deg) scale(1.05)`
            : `translate(-50%, calc(-50% - 280rpx)) rotate(${piece.rotation}deg) scale(0.78)`

          if (fallback) {
            return (
              <View
                key={piece.id}
                className='abstract-puzzle-table__piece abstract-puzzle-table__piece--fallback'
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
          }

          return (
            <Image
              key={piece.id}
              className='abstract-puzzle-table__piece'
              src={src}
              mode='aspectFit'
              lazyLoad={false}
              style={{
                left: `${piece.endX}rpx`,
                width: `${piece.sizeRpx}rpx`,
                height: `${piece.sizeRpx}rpx`,
                transform,
                opacity: isComplete ? piece.colorAlpha + 0.1 : piece.colorAlpha,
                transitionDuration: isComplete ? `${SNAP_DURATION_MS}ms` : `${FALL_DURATION_MS}ms`,
                transitionDelay: isComplete ? `${index * 40}ms` : `${piece.delayMs}ms`,
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

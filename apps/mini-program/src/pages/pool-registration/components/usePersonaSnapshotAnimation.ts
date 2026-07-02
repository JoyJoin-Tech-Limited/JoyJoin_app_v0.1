import { useEffect, useMemo, useRef, useState } from 'react'
import type { PoolPersonaSnapshotResponse, PoolPersonaStateBand } from '@shared/api'

export type AnimationPhase = 'idle' | 'ready'

export interface ParticleSpec {
  id: number
  colorKey: 'purple' | 'coral' | 'blue' | 'green'
  sizeRpx: number
  xPercent: number
  yPercent: number
  rotation: number
  delayMs: number
}

// CTA becomes available quickly (≤600ms) so users can act even if the
// decorative drop sequence is still finishing.
const DROP_ANIMATION_DURATION_MS = 560
const STAGGER_MS = 90
const CTA_READY_MS = 600
const MIN_PILE_PIECES = 4
const MAX_PILE_PIECES = 18

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// Deterministic pseudo-random so pile layout is stable across renders
// and does not trigger SSR/hydration mismatches or flicker.
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

function getStateBandCopy(band: PoolPersonaStateBand, totalRegistrants: number): string {
  switch (band) {
    case 'seed':
      return totalRegistrants > 0 ? `已有 ${totalRegistrants} 位伙伴报名` : '等你落下第一颗拼图'
    case 'glimmer':
      return `${totalRegistrants} 位伙伴，画像开始成形`
    case 'outline':
      return '这一桌的画像渐显轮廓'
    case 'clear':
      return '这一桌的画像越来越清晰'
    case 'full':
      return '拼图完整，一桌同频的人即将相遇'
    default:
      return '拼图正在成形'
  }
}

function getStateBandSubcopy(): string {
  return '报名伙伴越多，悦仔拼出的画像越清晰'
}

function generatePileParticles(totalRegistrants: number): ParticleSpec[] {
  // The puzzle pieces pile up like a small mountain at the bottom-right of
  // the persona zone. Count scales with real registrants but is capped so
  // the DOM/decoding cost stays bounded.
  const count = clamp(totalRegistrants, MIN_PILE_PIECES, MAX_PILE_PIECES)
  const colors: ParticleSpec['colorKey'][] = ['purple', 'coral', 'blue', 'green']
  const pieces: ParticleSpec[] = []

  // Pyramid base sits in the bottom-right, mostly behind the footer/CTA
  // so text stays readable while the pile still reads as a mound.
  const baseY = 86
  const centerX = 80
  let pieceIndex = 0
  let row = 0

  while (pieceIndex < count) {
    // Bottom rows are wider → classic堆积如山 silhouette.
    const maxInRow = Math.max(5 - row, 1)
    const remaining = count - pieceIndex
    const piecesInRow = Math.min(maxInRow, remaining)
    const rowWidth = piecesInRow * 6.5
    const startX = centerX - rowWidth / 2

    for (let i = 0; i < piecesInRow; i++) {
      const id = pieceIndex
      const rand1 = seededRandom(id)
      const rand2 = seededRandom(id + 1000)
      const progress = piecesInRow > 1 ? i / (piecesInRow - 1) : 0.5
      const x = startX + progress * rowWidth + (rand1 - 0.5) * 3.5
      const y = baseY - row * 6.5 + (rand2 - 0.5) * 2.5
      const size = 20 + Math.floor(rand1 * 14)
      const rotation = (rand2 - 0.5) * 55

      pieces.push({
        id,
        colorKey: colors[id % colors.length],
        sizeRpx: size,
        xPercent: clamp(x, 64, 96),
        yPercent: clamp(y, 58, 92),
        rotation,
        delayMs: id * STAGGER_MS,
      })
      pieceIndex++
    }
    row++
  }

  return pieces
}

interface UsePersonaSnapshotAnimationOptions {
  snapshot?: PoolPersonaSnapshotResponse | null
  reduceMotion: boolean
}

interface UsePersonaSnapshotAnimationResult {
  phase: AnimationPhase
  particles: ParticleSpec[]
  stateBandCopy: string
  stateBandSubcopy: string
  ctaReady: boolean
  dropDurationMs: number
}

export function usePersonaSnapshotAnimation({
  snapshot,
  reduceMotion,
}: UsePersonaSnapshotAnimationOptions): UsePersonaSnapshotAnimationResult {
  const [phase, setPhase] = useState<AnimationPhase>('idle')
  const ctaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [ctaReady, setCtaReady] = useState(false)

  const particles = useMemo(() => {
    if (reduceMotion || !snapshot) return []
    return generatePileParticles(snapshot.totalRegistrants)
  }, [reduceMotion, snapshot?.stateBand, snapshot?.totalRegistrants])

  const stateBandCopy = useMemo(() => {
    if (!snapshot) return '拼图正在加载…'
    return getStateBandCopy(snapshot.stateBand, snapshot.totalRegistrants)
  }, [snapshot])

  const stateBandSubcopy = useMemo(() => {
    if (!snapshot) return ''
    return getStateBandSubcopy()
  }, [snapshot])

  useEffect(() => {
    if (!snapshot) return

    if (reduceMotion) {
      setPhase('ready')
      setCtaReady(true)
      return
    }

    setPhase('idle')
    setCtaReady(false)

    ctaTimerRef.current = setTimeout(() => {
      setPhase('ready')
      setCtaReady(true)
    }, CTA_READY_MS)

    return () => {
      if (ctaTimerRef.current) clearTimeout(ctaTimerRef.current)
    }
  }, [snapshot, reduceMotion])

  useEffect(() => {
    return () => {
      if (ctaTimerRef.current) clearTimeout(ctaTimerRef.current)
    }
  }, [])

  return {
    phase,
    particles,
    stateBandCopy,
    stateBandSubcopy,
    ctaReady,
    dropDurationMs: DROP_ANIMATION_DURATION_MS,
  }
}

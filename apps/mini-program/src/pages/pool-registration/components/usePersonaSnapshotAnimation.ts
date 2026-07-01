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
const DROP_ANIMATION_DURATION_MS = 520
const STAGGER_MS = 120
const CTA_READY_MS = 600
const MAX_PARTICLES = 5

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

function generateDroppingParticles(): ParticleSpec[] {
  // Puzzle-piece decorations scattered across the persona zone.
  // Positions are percentages so they adapt to the right-column width.
  const specs: Omit<ParticleSpec, 'delayMs'>[] = [
    {
      id: 0,
      colorKey: 'purple',
      sizeRpx: 28,
      xPercent: 78,
      yPercent: 18,
      rotation: 12,
    },
    {
      id: 1,
      colorKey: 'coral',
      sizeRpx: 24,
      xPercent: 92,
      yPercent: 48,
      rotation: -18,
    },
    {
      id: 2,
      colorKey: 'blue',
      sizeRpx: 32,
      xPercent: 70,
      yPercent: 72,
      rotation: 34,
    },
    {
      id: 3,
      colorKey: 'green',
      sizeRpx: 22,
      xPercent: 58,
      yPercent: 34,
      rotation: -8,
    },
    {
      id: 4,
      colorKey: 'purple',
      sizeRpx: 20,
      xPercent: 88,
      yPercent: 12,
      rotation: 22,
    },
  ]
  return specs.slice(0, MAX_PARTICLES).map((s, i) => ({
    ...s,
    delayMs: i * STAGGER_MS,
  }))
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
    if (reduceMotion) return []
    return generateDroppingParticles()
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

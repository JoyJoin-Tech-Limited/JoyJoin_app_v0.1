import { useEffect, useMemo, useRef, useState } from 'react'
import type { PoolPersonaSnapshotResponse, PoolPersonaStateBand } from '@shared/api'
import { useDeviceTier } from '../../../hooks/useDeviceTier'

export type AnimationPhase = 'idle' | 'chaos' | 'snap' | 'resolve'

interface ParticleSpec {
  id: number
  colorKey: 'purple' | 'coral' | 'blue' | 'green'
  sizeRpx: number
  startX: number
  startY: number
  endX: number
  endY: number
  rotation: number
  delayMs: number
}

const FIRST_VIEW_TOTAL_MS = 2900
const RETURN_VIEW_TOTAL_MS = 950
const PARTICLE_COUNT_DEFAULT = 16
const PARTICLE_COUNT_DEGRADATION = 8

function getStateBandCopy(band: PoolPersonaStateBand, totalRegistrants: number): string {
  switch (band) {
    case 'seed':
      return totalRegistrants > 0 ? '第一颗拼图已经落下' : '等你落下第一颗拼图'
    case 'glimmer':
      return '拼图开始有了微光'
    case 'outline':
      return '轮廓渐显，画像在成形'
    case 'clear':
      return '这一桌的画像越来越清晰'
    case 'full':
      return '拼图完整，一桌同频的人即将相遇'
    default:
      return '拼图正在成形'
  }
}

function getStateBandSubcopy(band: PoolPersonaStateBand): string {
  switch (band) {
    case 'seed':
      return '报名伙伴越多，画像越清晰'
    case 'glimmer':
      return '再等等，更多伙伴正在加入'
    case 'outline':
      return '已有足够信号，悦仔正在归类'
    case 'clear':
      return '点击卡片查看聚合画像'
    case 'full':
      return '点击卡片查看完整画像'
    default:
      return ''
  }
}

function generateParticles(count: number, widthRpx: number, heightRpx: number): ParticleSpec[] {
  const colors: Array<ParticleSpec['colorKey']> = ['purple', 'coral', 'blue', 'green']
  const particles: ParticleSpec[] = []
  for (let i = 0; i < count; i++) {
    const sizeRpx = 28 + Math.random() * 36
    particles.push({
      id: i,
      colorKey: colors[i % colors.length],
      sizeRpx,
      startX: Math.random() * widthRpx,
      startY: Math.random() * heightRpx,
      endX: 32 + Math.random() * Math.max(0, widthRpx - 64),
      endY: 40 + Math.random() * Math.max(0, heightRpx - 80),
      rotation: Math.random() * 360,
      delayMs: Math.random() * 400,
    })
  }
  return particles
}

interface UsePersonaSnapshotAnimationOptions {
  snapshot?: PoolPersonaSnapshotResponse | null
  reduceMotion: boolean
  isReturnView: boolean
}

interface UsePersonaSnapshotAnimationResult {
  phase: AnimationPhase
  particles: ParticleSpec[]
  stateBandCopy: string
  stateBandSubcopy: string
  ctaReady: boolean
}

export function usePersonaSnapshotAnimation({
  snapshot,
  reduceMotion,
  isReturnView,
}: UsePersonaSnapshotAnimationOptions): UsePersonaSnapshotAnimationResult {
  const deviceTier = useDeviceTier()
  const [phase, setPhase] = useState<AnimationPhase>('idle')
  const ctaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [ctaReady, setCtaReady] = useState(false)

  const particleCount = deviceTier.isDegradation ? PARTICLE_COUNT_DEGRADATION : PARTICLE_COUNT_DEFAULT

  const particles = useMemo(() => {
    return generateParticles(particleCount, 686, 272)
  }, [particleCount, snapshot?.stateBand, snapshot?.totalRegistrants])

  const stateBandCopy = useMemo(() => {
    if (!snapshot) return '拼图正在加载…'
    return getStateBandCopy(snapshot.stateBand, snapshot.totalRegistrants)
  }, [snapshot])

  const stateBandSubcopy = useMemo(() => {
    if (!snapshot) return ''
    return getStateBandSubcopy(snapshot.stateBand)
  }, [snapshot])

  useEffect(() => {
    if (!snapshot) return

    if (reduceMotion) {
      setPhase('resolve')
      setCtaReady(true)
      return
    }

    setPhase('chaos')
    setCtaReady(false)

    const totalDuration = isReturnView ? RETURN_VIEW_TOTAL_MS : FIRST_VIEW_TOTAL_MS
    const snapAt = isReturnView ? 300 : 900
    const resolveAt = isReturnView ? 700 : 2300

    const snapTimer = setTimeout(() => setPhase('snap'), snapAt)
    const resolveTimer = setTimeout(() => setPhase('resolve'), resolveAt)
    ctaTimerRef.current = setTimeout(() => setCtaReady(true), Math.min(600, snapAt))

    return () => {
      clearTimeout(snapTimer)
      clearTimeout(resolveTimer)
      if (ctaTimerRef.current) clearTimeout(ctaTimerRef.current)
    }
  }, [snapshot, reduceMotion, isReturnView])

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
  }
}

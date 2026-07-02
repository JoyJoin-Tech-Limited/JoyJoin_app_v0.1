import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import type { PoolPersonaSnapshotResponse, PoolPersonaStateBand } from '@shared/api'
import { getArchetypeTokens } from '@shared/archetypeColorTokens'
import type { PoolPersonaParticleKey } from './poolPersonaAssets'

export type AnimationPhase = 'idle' | 'ready'

export interface ParticleSpec {
  id: number
  colorKey: PoolPersonaParticleKey
  sizeRpx: number
  xPercent: number
  yPercent: number
  rotation: number
  delayMs: number
}

// CTA becomes available quickly (≤600ms) so users can act even if the
// decorative drop sequence is still finishing.
export const DROP_ANIMATION_DURATION_MS = 460
const STAGGER_MS = 70
const CTA_READY_MS = 600
const MIN_PILE_PIECES = 4
const MAX_PILE_PIECES = 18
const PLAYED_KEY_PREFIX = 'jj_persona_pile_played'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// Deterministic pseudo-random so pile layout is stable across renders
// and does not trigger SSR/hydration mismatches or flicker.
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

function buildStorageKey(userId: string | null | undefined, poolId: string): string {
  // User-scoped so shared devices don't leak animation state across accounts.
  const identity = userId ?? 'guest'
  return `${PLAYED_KEY_PREFIX}_${identity}_${poolId}`
}

function readPlayedState(userId: string | null | undefined, poolId: string): boolean {
  try {
    return Taro.getStorageSync(buildStorageKey(userId, poolId)) === true
  } catch {
    return false
  }
}

function markPlayedState(userId: string | null | undefined, poolId: string): void {
  try {
    Taro.setStorageSync(buildStorageKey(userId, poolId), true)
  } catch {
    // Non-critical; fail silently.
  }
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

function getStateBandSubcopy(band: PoolPersonaStateBand): string {
  switch (band) {
    case 'seed':
      return '先来的人，会决定这一桌最初的氛围'
    case 'glimmer':
      return '报名伙伴越多，悦仔拼出的画像越清晰'
    case 'outline':
      return '几个维度已经能看出这一桌的轮廓了'
    case 'clear':
      return '画像越来越清晰，离遇见同频的人更近一步'
    case 'full':
      return '这一桌的人已经足够拼出完整的社交画像'
    default:
      return '报名伙伴越多，悦仔拼出的画像越清晰'
  }
}

function getPileCaption(totalRegistrants: number): string {
  if (totalRegistrants <= 0) return '等你落下第一颗拼图'
  return `已有 ${totalRegistrants} 位伙伴加入这张拼图`
}

// Map a hex color to the nearest colored particle asset. Avoids CSS tint
// filters that are expensive and often no-ops in WeChat runtime.
function hexToHue(hex: string): number {
  const clean = hex.replace('#', '')
  const parts = clean.match(/.{2}/g)
  const rgb = parts?.map((p) => parseInt(p, 16)) ?? [128, 128, 128]
  const [r, g, b] = rgb.map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  let h = 0
  if (max === r) h = (g - b) / (max - min) + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / (max - min) + 2
  else h = (r - g) / (max - min) + 4
  return h * 60
}

function particleKeyForColor(hex: string): PoolPersonaParticleKey {
  const hue = hexToHue(hex)
  if (hue >= 60 && hue < 150) return 'green'
  if (hue >= 150 && hue < 250) return 'blue'
  if (hue >= 250 && hue < 330) return 'purple'
  return 'coral'
}

function buildArchetypeParticlePalette(
  snapshot: PoolPersonaSnapshotResponse | null | undefined,
  userArchetype: string | null | undefined,
): PoolPersonaParticleKey[] {
  if (!snapshot) return ['purple']
  const archetypeDimension = snapshot.dimensions.find((d) => d.key === 'archetype')
  const clusters = archetypeDimension?.clusters ?? []
  const top = clusters
    .slice(0, 3)
    .map((c) => particleKeyForColor(getArchetypeTokens(c.label).primary))
    .filter(Boolean)
  if (top.length === 0 && userArchetype) {
    top.push(particleKeyForColor(getArchetypeTokens(userArchetype).primary))
  }
  return top.length > 0 ? top : ['purple']
}

function snapshotFingerprint(snapshot: PoolPersonaSnapshotResponse | null | undefined): string {
  if (!snapshot) return ''
  const dims = snapshot.dimensions
    .filter((d) => d.disclosed)
    .map(
      (d) =>
        `${d.key}:${d.total}:${d.clusters
          .slice(0, 4)
          .map((c) => `${c.label}:${c.count}`)
          .join(',')}`,
    )
    .join('|')
  return `${snapshot.stateBand}:${snapshot.totalRegistrants}|${dims}`
}

function generatePileParticles(
  totalRegistrants: number,
  palette: PoolPersonaParticleKey[],
): ParticleSpec[] {
  // The puzzle pieces pile up like a small mountain at the bottom-right of
  // the persona zone. Count scales with real registrants but is capped so
  // the DOM/decoding cost stays bounded.
  const count = clamp(totalRegistrants, MIN_PILE_PIECES, MAX_PILE_PIECES)
  const pieces: ParticleSpec[] = []

  // Pyramid base sits in the bottom-right, mostly behind the footer/CTA
  // so text stays readable while the pile still reads as a mound.
  const baseY = 86
  const centerX = 80
  let pieceIndex = 0
  let row = 0

  while (pieceIndex < count) {
    // Bottom rows are wider → classic 堆积如山 silhouette.
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
        colorKey: palette[id % palette.length],
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
  poolId: string
  userId?: string | null
  snapshot?: PoolPersonaSnapshotResponse | null
  userArchetype?: string | null
  reduceMotion: boolean
}

interface UsePersonaSnapshotAnimationResult {
  phase: AnimationPhase
  particles: ParticleSpec[]
  staticMoundParticles: ParticleSpec[]
  stateBandCopy: string
  stateBandSubcopy: string
  pileCaption: string
  ctaReady: boolean
  dropDurationMs: number
  hasPlayedBefore: boolean
}

export function usePersonaSnapshotAnimation({
  poolId,
  userId,
  snapshot,
  userArchetype,
  reduceMotion,
}: UsePersonaSnapshotAnimationOptions): UsePersonaSnapshotAnimationResult {
  const [phase, setPhase] = useState<AnimationPhase>('idle')
  const ctaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [ctaReady, setCtaReady] = useState(false)
  const [hasPlayedBefore, setHasPlayedBefore] = useState(() => readPlayedState(userId, poolId))

  // Reset played state when the identity or pool changes.
  useEffect(() => {
    setHasPlayedBefore(readPlayedState(userId, poolId))
  }, [userId, poolId])

  // Hold a stable snapshot so React Query refetches don't restart the animation
  // while the underlying persona data is unchanged.
  const [stableSnapshot, setStableSnapshot] = useState<PoolPersonaSnapshotResponse | null>(null)
  const lastFingerprintRef = useRef<string>('')
  useEffect(() => {
    if (!snapshot) {
      setStableSnapshot(null)
      lastFingerprintRef.current = ''
      return
    }
    const nextFingerprint = snapshotFingerprint(snapshot)
    if (nextFingerprint === lastFingerprintRef.current) return
    lastFingerprintRef.current = nextFingerprint
    setStableSnapshot(snapshot)
  }, [snapshot])

  const palette = useMemo(
    () => buildArchetypeParticlePalette(stableSnapshot, userArchetype),
    [stableSnapshot, userArchetype],
  )

  const allParticles = useMemo(() => {
    if (!stableSnapshot) return []
    return generatePileParticles(stableSnapshot.totalRegistrants, palette)
  }, [stableSnapshot, palette])

  // For the animated path, only show pieces whose delay is <= CTA_READY_MS
  // so new motion stops once the user can act. Already-dropping pieces finish.
  const particles = useMemo(() => {
    if (reduceMotion || hasPlayedBefore) return []
    return allParticles.filter((p) => p.delayMs <= CTA_READY_MS)
  }, [allParticles, reduceMotion, hasPlayedBefore])

  const staticMoundParticles = useMemo(() => {
    if (!reduceMotion && !hasPlayedBefore) return []
    return allParticles
  }, [allParticles, reduceMotion, hasPlayedBefore])

  const stateBandCopy = useMemo(() => {
    if (!stableSnapshot) return '拼图正在加载…'
    return getStateBandCopy(stableSnapshot.stateBand, stableSnapshot.totalRegistrants)
  }, [stableSnapshot])

  const stateBandSubcopy = useMemo(() => {
    if (!stableSnapshot) return ''
    return getStateBandSubcopy(stableSnapshot.stateBand)
  }, [stableSnapshot])

  const pileCaption = useMemo(() => {
    if (!stableSnapshot) return ''
    return getPileCaption(stableSnapshot.totalRegistrants)
  }, [stableSnapshot])

  useEffect(() => {
    if (!stableSnapshot) return

    if (reduceMotion || hasPlayedBefore) {
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
  }, [stableSnapshot, reduceMotion, hasPlayedBefore])

  const markPlayed = useCallback(() => {
    if (!hasPlayedBefore && stableSnapshot) {
      markPlayedState(userId, poolId)
      setHasPlayedBefore(true)
    }
  }, [hasPlayedBefore, userId, poolId, stableSnapshot])

  useEffect(() => {
    if (phase !== 'ready' || !stableSnapshot) return
    // Wait until the visible pieces have finished dropping before marking played.
    const visibleMaxDelay = particles.length > 0
      ? Math.max(...particles.map((p) => p.delayMs))
      : 0
    const timer = setTimeout(() => {
      markPlayed()
    }, visibleMaxDelay + DROP_ANIMATION_DURATION_MS)
    return () => clearTimeout(timer)
  }, [phase, stableSnapshot, particles, markPlayed])

  useEffect(() => {
    return () => {
      if (ctaTimerRef.current) clearTimeout(ctaTimerRef.current)
    }
  }, [])

  return {
    phase,
    particles,
    staticMoundParticles,
    stateBandCopy,
    stateBandSubcopy,
    pileCaption,
    ctaReady,
    dropDurationMs: DROP_ANIMATION_DURATION_MS,
    hasPlayedBefore,
  }
}

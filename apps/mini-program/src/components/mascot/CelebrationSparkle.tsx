import { View } from '@tarojs/components'
import { useId, useMemo } from 'react'
import './CelebrationSparkle.scss'

export interface CelebrationSparkleProps {
  count?: number
  className?: string
}

interface ParticleSpec {
  id: number
  seedX: number
  delayMs: number
  size: number
  rgba: { r: number; g: number; b: number; a: number }
  glowRgba: { r: number; g: number; b: number; a: number }
}

const PARTICLE_PALETTE: ReadonlyArray<{ h: number; s: number; l: number }> = [
  { h: 46, s: 96, l: 64 },
  { h: 33, s: 92, l: 70 },
  { h: 280, s: 78, l: 70 },
  { h: 16, s: 90, l: 70 },
]

function hslToRgba(h: number, s: number, l: number, a: number): { r: number; g: number; b: number; a: number } {
  h = h % 360
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else { r = c; b = x }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
    a,
  }
}

function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function buildParticles(count: number, seed: string): ParticleSpec[] {
  const baseHash = hashString(seed)
  return Array.from({ length: count }, (_, i) => {
    const h = (baseHash + i * 9973) >>> 0
    const seedX = ((h % 1000) / 1000) * 100
    const delayMs = (i * 80) % (count * 80)
    const size = 24 + ((h >> 4) % 9)
    const base = PARTICLE_PALETTE[i % PARTICLE_PALETTE.length]!
    const hue = base.h + (h % 8)
    const rgba = hslToRgba(hue, 90, 72, 1)
    const glowRgba = hslToRgba(hue, 96, 76, 0.72)
    return { id: i, seedX, delayMs, size, rgba, glowRgba }
  })
}

export default function CelebrationSparkle({
  count = 6,
  className = '',
}: CelebrationSparkleProps) {
  const id = useId()
  const particles = useMemo(() => buildParticles(count, id), [count, id])

  if (count <= 0) return null

  return (
    <View
      className={`celebration-sparkle ${className}`}
      aria-hidden='true'
      style={{ pointerEvents: 'none' }}
    >
      {particles.map((p) => (
        <View
          key={p.id}
          className='celebration-sparkle__particle'
          style={{
            left: `${p.seedX}%`,
            top: '60%',
            width: `${p.size}rpx`,
            height: `${p.size}rpx`,
            background: `rgba(${p.rgba.r}, ${p.rgba.g}, ${p.rgba.b}, ${p.rgba.a})`,
            boxShadow: `0 0 ${p.size * 1.2}rpx rgba(${p.glowRgba.r}, ${p.glowRgba.g}, ${p.glowRgba.b}, ${p.glowRgba.a})`,
            animationDelay: `${p.delayMs}ms`,
          }}
        />
      ))}
    </View>
  )
}

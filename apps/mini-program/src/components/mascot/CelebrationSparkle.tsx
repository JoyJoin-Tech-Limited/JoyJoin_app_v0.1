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
  hue: number
}

const PARTICLE_PALETTE: ReadonlyArray<{ h: number; s: number; l: number }> = [
  { h: 46, s: 96, l: 64 },
  { h: 33, s: 92, l: 70 },
  { h: 280, s: 78, l: 70 },
  { h: 16, s: 90, l: 70 },
]

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
    const hue = PARTICLE_PALETTE[i % PARTICLE_PALETTE.length]!
    return { id: i, seedX, delayMs, size, hue: hue.h + (h % 8) }
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
      pointer-events='none'
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
            background: `hsl(${p.hue}, 90%, 72%)`,
            boxShadow: `0 0 ${p.size * 1.2}rpx hsla(${p.hue}, 96%, 76%, 0.72)`,
            animationDelay: `${p.delayMs}ms`,
          }}
        />
      ))}
    </View>
  )
}

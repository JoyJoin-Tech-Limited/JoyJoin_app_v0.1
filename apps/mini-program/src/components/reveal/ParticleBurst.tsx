import { useEffect, useRef, useState, useCallback } from 'react'
import { View, Text, Canvas } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './ParticleBurst.scss'

function prefersReducedMotion(): boolean {
  try {
    const info = Taro.getSystemInfoSync()
    if ((info as any).reduceMotion) return true
  } catch {
    // ignore
  }
  return false
}

const REDUCED_MOTION = prefersReducedMotion()

const RAF = (Taro as any).requestAnimationFrame ?? requestAnimationFrame
const CAF = (Taro as any).cancelAnimationFrame ?? cancelAnimationFrame

// Brand-aligned palettes per burst type
const PALETTES: Record<string, string[]> = {
  confetti: [
    '#8B5CF6', // primary
    '#FF6B9D', // secondary
    '#A8C5DD', // sky blue
    '#9ACD32', // fresh green
    '#FF9B85', // warm coral
    '#FBBF24', // landed gold
  ],
  coins: [
    '#FBBF24',
    '#F59E0B',
    '#D97706',
    '#FCD34D',
    '#FDE68A',
  ],
  roses: [
    '#FF6B9D',
    '#EC4899',
    '#DB2777',
    '#F472B6',
    '#FDA4AF',
    '#FB7185',
  ],
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  rotationSpeed: number
  opacity: number
  decay: number
  gravity: number
}

function createParticles(
  type: 'confetti' | 'coins' | 'roses',
  count: number,
  originX: number,
  originY: number,
  canvasW: number,
  canvasH: number,
  spotlightColor?: string,
): Particle[] {
  const baseColors = PALETTES[type]
  const colors = spotlightColor
    ? [spotlightColor, spotlightColor, spotlightColor, ...baseColors]
    : baseColors
  const particles: Particle[] = []

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 2 + Math.random() * 6
    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3 - Math.random() * 3,
      size: 4 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
      opacity: 0.9 + Math.random() * 0.1,
      decay: 0.008 + Math.random() * 0.012,
      gravity: 0.15 + Math.random() * 0.1,
    })
  }

  return particles
}

function drawParticles(
  ctx: Taro.CanvasContext,
  particles: Particle[],
  canvasW: number,
  canvasH: number,
) {
  ctx.clearRect(0, 0, canvasW, canvasH)

  for (const p of particles) {
    if (p.opacity <= 0) continue

    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation)
    ctx.setGlobalAlpha(p.opacity)
    ctx.setFillStyle(p.color)

    // Draw confetti-like rectangle or circle based on size
    if (p.size > 7) {
      ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6)
    } else {
      ctx.beginPath()
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }

  ctx.draw()
}

function updateParticles(particles: Particle[]): boolean {
  let alive = false

  for (const p of particles) {
    if (p.opacity <= 0) continue

    p.x += p.vx
    p.y += p.vy
    p.vy += p.gravity
    p.vx *= 0.98 // air resistance
    p.rotation += p.rotationSpeed
    p.opacity -= p.decay

    if (p.opacity > 0) {
      alive = true
    }
  }

  return alive
}

export interface ParticleBurstProps {
  /** Trigger the burst (set to true to fire; re-triggers on true→true if key changes) */
  trigger: boolean
  /** Visual theme of the burst */
  type: 'confetti' | 'coins' | 'roses'
  /** Number of particles (default 40, max 60) */
  count?: number
  /** Origin point as fraction of canvas size (default center) */
  origin?: { x: number; y: number }
  /** Optional dominant colour (hex) to mix into the palette */
  spotlightColor?: string
  /** Override reduced-motion detection for testing */
  reducedMotion?: boolean
}

/**
 * ParticleBurst — celebration confetti/coin/rose burst.
 *
 * Used on completion, correct guess, auction win.
 * Canvas-based with gravity, decay, and slight rotation.
 * Reduced motion: static emoji flash.
 */
export default function ParticleBurst({
  trigger,
  type,
  count = 40,
  origin = { x: 0.5, y: 0.5 },
  spotlightColor,
  reducedMotion,
}: ParticleBurstProps) {
  const isReduced = reducedMotion ?? REDUCED_MOTION
  const canvasIdRef = useRef(`particle-burst-${Math.random().toString(36).slice(2, 9)}`)
  const rafRef = useRef<number | undefined>(undefined)
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const particlesRef = useRef<Particle[]>([])
  const [isActive, setIsActive] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const emojiTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const clampedCount = Math.min(Math.max(count, 10), 60)

  const runBurst = useCallback(() => {
    if (isReduced) {
      setShowEmoji(true)
      if (emojiTimeoutRef.current) clearTimeout(emojiTimeoutRef.current)
      emojiTimeoutRef.current = setTimeout(() => setShowEmoji(false), 1000)
      return
    }

    const canvasId = canvasIdRef.current
    const ctx = Taro.createCanvasContext(canvasId)
    if (!ctx) return
    setIsActive(true)

    // WeChat canvas dimensions are in px; use fixed logical size
    const W = 300
    const H = 300

    const finish = () => {
      ctx.clearRect(0, 0, W, H)
      ctx.draw()
      particlesRef.current = []
      rafRef.current = undefined
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current)
        safetyTimeoutRef.current = undefined
      }
      setIsActive(false)
    }

    const originX = origin.x * W
    const originY = origin.y * H

    particlesRef.current = createParticles(type, clampedCount, originX, originY, W, H, spotlightColor)

    const loop = () => {
      const alive = updateParticles(particlesRef.current)
      drawParticles(ctx, particlesRef.current, W, H)

      if (alive) {
        rafRef.current = RAF(loop)
      } else {
        finish()
      }
    }

    if (rafRef.current !== undefined) {
      CAF(rafRef.current)
    }
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current)
    }
    safetyTimeoutRef.current = setTimeout(() => {
      if (rafRef.current !== undefined) {
        CAF(rafRef.current)
      }
      finish()
    }, 2200)
    rafRef.current = RAF(loop)
  }, [type, clampedCount, origin.x, origin.y, spotlightColor, isReduced])

  useEffect(() => {
    if (trigger) {
      runBurst()
    }
    return () => {
      if (rafRef.current !== undefined) {
        CAF(rafRef.current)
        rafRef.current = undefined
      }
      if (emojiTimeoutRef.current) {
        clearTimeout(emojiTimeoutRef.current)
        emojiTimeoutRef.current = undefined
      }
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current)
        safetyTimeoutRef.current = undefined
      }
      setIsActive(false)
    }
  }, [trigger, runBurst])

  if (isReduced) {
    return (
      <View className='reveal-particle-burst reveal-particle-burst--reduced'>
        {showEmoji && (
          <Text className='reveal-particle-burst__emoji'>
            {type === 'roses' ? '🌹' : type === 'coins' ? '🎉' : '✨'}
          </Text>
        )}
      </View>
    )
  }

  return (
    <View className={`reveal-particle-burst ${isActive ? 'reveal-particle-burst--active' : 'reveal-particle-burst--idle'}`}>
      <Canvas
        canvasId={canvasIdRef.current}
        className='reveal-particle-burst__canvas'
        style={{ width: '300rpx', height: '300rpx' }}
      />
    </View>
  )
}

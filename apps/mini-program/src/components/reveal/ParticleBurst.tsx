import { useEffect, useRef, useState, useCallback } from 'react'
import { View, Canvas } from '@tarojs/components'
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

/** Hard cap on simultaneously-live particles so rapid re-triggers stay cheap. */
const MAX_LIVE_PARTICLES = 120
/** Force-clear the canvas this long after the last burst, even if a particle lingers. */
const SAFETY_TIMEOUT_MS = 2500
/** Cap the CSS pixel size of a full-bleed canvas to avoid high-DPR memory kills. */
const MAX_CANVAS_CSS_PX = 420

// Brand-aligned palettes per burst type
const PALETTES: Record<'confetti' | 'coins' | 'roses', string[]> = {
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
  /** Horizontal flutter (confetti sway) */
  sway: number
  swaySpeed: number
  phase: number
}

/**
 * Fountain-style emission: an upward cone with gravity and flutter, so the
 * burst reads as a celebration cannon instead of omnidirectional noise.
 * All coordinates are in real canvas px (measured, never assumed).
 */
function createParticles(
  type: 'confetti' | 'coins' | 'roses',
  count: number,
  originX: number,
  originY: number,
  scale: number,
  spotlightColor?: string,
): Particle[] {
  const baseColors = PALETTES[type]
  const colors = spotlightColor
    ? [spotlightColor, spotlightColor, spotlightColor, ...baseColors]
    : baseColors
  const particles: Particle[] = []

  for (let i = 0; i < count; i++) {
    // Upward cone: -90° ± 40°
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 0.45)
    const speed = (5 + Math.random() * 6.5) * scale
    particles.push({
      x: originX + (Math.random() - 0.5) * 8 * scale,
      y: originY + (Math.random() - 0.5) * 4 * scale,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: (4 + Math.random() * 7) * scale,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.35,
      opacity: 0.9 + Math.random() * 0.1,
      decay: 0.009 + Math.random() * 0.012,
      gravity: (0.16 + Math.random() * 0.08) * scale,
      sway: (Math.random() - 0.5) * 1.4 * scale,
      swaySpeed: 0.08 + Math.random() * 0.12,
      phase: Math.random() * Math.PI * 2,
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
    ctx.setGlobalAlpha(Math.min(p.opacity, 1))
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

/** Returns true while at least one particle is still alive. */
function updateParticles(particles: Particle[]): boolean {
  let alive = false

  for (const p of particles) {
    if (p.opacity <= 0) continue

    p.phase += p.swaySpeed
    p.x += p.vx + Math.sin(p.phase) * p.sway
    p.y += p.vy
    p.vy += p.gravity
    p.vx *= 0.985 // air resistance
    p.rotation += p.rotationSpeed
    p.opacity -= p.decay

    if (p.opacity > 0) {
      alive = true
    }
  }

  return alive
}

export interface ParticleBurstProps {
  /** Fire the burst on a false→true transition. Re-firing while live appends particles. */
  trigger: boolean
  /** Visual theme of the burst */
  type: 'confetti' | 'coins' | 'roses'
  /** Number of particles per burst (default 40, max 60) */
  count?: number
  /** Origin point as fraction of canvas size (default center) */
  origin?: { x: number; y: number }
  /** Optional dominant colour (hex) to mix into the palette */
  spotlightColor?: string
  /** Override reduced-motion detection for testing */
  reducedMotion?: boolean
  /**
   * Fill the wrapper with the canvas. Use only when the wrapper has an explicit
   * size (e.g. `position:absolute; inset:0`). Defaults to false, which keeps
   * the legacy 300rpx centred square for backwards compatibility.
   */
  fill?: boolean
}

/**
 * ParticleBurst — celebration confetti/coin/rose burst.
 *
 * Canvas-based fountain emission with gravity, flutter, and decay.
 * Measures the real rendered canvas size in px before drawing — the WeChat
 * canvas coordinate space equals its CSS px size, so assuming a fixed logical
 * size clips the burst. When `fill` is true the canvas fills its wrapper but
 * its CSS pixel size is capped to avoid high-DPR memory kills.
 * Reduced motion: static emoji flash.
 */
export default function ParticleBurst({
  trigger,
  type,
  count = 40,
  origin = { x: 0.5, y: 0.5 },
  spotlightColor,
  reducedMotion,
  fill = false,
}: ParticleBurstProps) {
  const isReduced = reducedMotion ?? REDUCED_MOTION
  const canvasIdRef = useRef(`particle-burst-${Math.random().toString(36).slice(2, 9)}`)
  const ctxRef = useRef<Taro.CanvasContext | null>(null)
  const lastSizeRef = useRef<{ w: number; h: number } | null>(null)
  const rafRef = useRef<number | undefined>(undefined)
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const particlesRef = useRef<Particle[]>([])
  const prevTriggerRef = useRef(false)
  const mountedRef = useRef(true)
  const [isActive, setIsActive] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [canvasStyle, setCanvasStyle] = useState<{ width: string; height: string } | undefined>(undefined)
  const emojiTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const clampedCount = Math.min(Math.max(count, 10), 60)

  /**
   * Measure the canvas element. We re-measure on every burst so layout changes
   * (keyboard, orientation, parent resize) never leave us drawing to stale dims.
   * In fill mode the returned size is capped to MAX_CANVAS_CSS_PX to avoid
   * allocating an unbounded backing store on high-DPR devices.
   */
  const measureCanvas = useCallback((): Promise<{ w: number; h: number }> => {
    const fallback = () => {
      let px = 300
      try {
        px = Math.round((Taro.getSystemInfoSync().windowWidth * 300) / 750)
      } catch {
        // keep default
      }
      return { w: px, h: px }
    }

    return new Promise((resolve) => {
      try {
        const instance = Taro.getCurrentInstance() as any
        const scope = instance?.page ?? instance
        const query = scope
          ? Taro.createSelectorQuery().in(scope)
          : Taro.createSelectorQuery()
        query
          .select(`#${canvasIdRef.current}`)
          .boundingClientRect()
          .exec((res) => {
            const rect = res?.[0]
            if (rect && rect.width > 0 && rect.height > 0) {
              let w = rect.width
              let h = rect.height
              if (fill) {
                const maxDim = Math.max(w, h)
                if (maxDim > MAX_CANVAS_CSS_PX) {
                  const ratio = MAX_CANVAS_CSS_PX / maxDim
                  w *= ratio
                  h *= ratio
                }
              }
              const size = { w: Math.round(w), h: Math.round(h) }
              resolve(size)
            } else {
              resolve(fallback())
            }
          })
      } catch {
        resolve(fallback())
      }
    })
  }, [fill])

  const finish = useCallback(() => {
    const { w, h } = lastSizeRef.current ?? { w: 0, h: 0 }
    if (ctxRef.current && w > 0 && h > 0) {
      ctxRef.current.clearRect(0, 0, w, h)
      ctxRef.current.draw()
    }
    particlesRef.current = []
    rafRef.current = undefined
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current)
      safetyTimeoutRef.current = undefined
    }
    setIsActive(false)
  }, [])

  const runBurst = useCallback(() => {
    if (isReduced) {
      setShowEmoji(true)
      if (emojiTimeoutRef.current) clearTimeout(emojiTimeoutRef.current)
      emojiTimeoutRef.current = setTimeout(() => setShowEmoji(false), 1000)
      return
    }

    void measureCanvas().then(({ w, h }) => {
      if (!mountedRef.current) return
      if (!ctxRef.current) {
        ctxRef.current = Taro.createCanvasContext(canvasIdRef.current)
      }
      const ctx = ctxRef.current
      if (!ctx) return

      lastSizeRef.current = { w, h }
      setCanvasStyle({ width: `${w}px`, height: `${h}px` })

      const scale = Math.min(Math.max(w / 320, 0.8), 2.2)
      const originX = origin.x * w
      const originY = origin.y * h

      // Append to the live set so a re-trigger never kills mid-flight particles
      const live = particlesRef.current.filter((p) => p.opacity > 0)
      particlesRef.current = [...live, ...createParticles(type, clampedCount, originX, originY, scale, spotlightColor)]
        .slice(-MAX_LIVE_PARTICLES)
      setIsActive(true)

      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current)
      safetyTimeoutRef.current = setTimeout(() => {
        if (rafRef.current !== undefined) {
          CAF(rafRef.current)
        }
        finish()
      }, SAFETY_TIMEOUT_MS)

      // Keep a single RAF loop alive across re-triggers
      if (rafRef.current !== undefined) return

      const loop = () => {
        const alive = updateParticles(particlesRef.current)
        drawParticles(ctx, particlesRef.current, w, h)

        if (alive) {
          rafRef.current = RAF(loop)
        } else {
          finish()
        }
      }
      rafRef.current = RAF(loop)
    })
  }, [type, clampedCount, origin.x, origin.y, spotlightColor, isReduced, measureCanvas, finish])

  // Fire only on a false→true transition; never tear down mid-flight on trigger→false
  useEffect(() => {
    if (trigger && !prevTriggerRef.current) {
      runBurst()
    }
    prevTriggerRef.current = trigger
  }, [trigger, runBurst])

  // Unmount-only cleanup
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
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
    }
  }, [])

  if (isReduced) {
    return (
      <View className={`reveal-particle-burst reveal-particle-burst--reduced ${fill ? 'reveal-particle-burst--fill' : ''}`}>
        {showEmoji && (
          <View className={`reveal-particle-burst__emoji reveal-particle-burst__emoji--${type}`} />
        )}
      </View>
    )
  }

  return (
    <View className={`reveal-particle-burst ${fill ? 'reveal-particle-burst--fill' : ''} ${isActive ? 'reveal-particle-burst--active' : 'reveal-particle-burst--idle'}`}>
      <Canvas
        id={canvasIdRef.current}
        canvasId={canvasIdRef.current}
        className='reveal-particle-burst__canvas'
        style={canvasStyle}
        aria-hidden='true'
      />
    </View>
  )
}

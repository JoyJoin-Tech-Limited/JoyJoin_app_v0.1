import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DirectionalLight,
  AmbientLight,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import {
  isWebGLContextLost,
  resolveAnimationFrame,
  type AvatarAnimationFrame,
} from '../../../../lib/profile/avatar3d/avatar3dPlatform'

/**
 * Phase 2c (2026-08-01): WebGL land-moment stage — K3 strategy doc B1 spike.
 *
 * Hybrid architecture: the proven CSS reel owns the spin; this stage takes
 * over ONLY the land moment (~2.5s) as a <canvas type="webgl"> overlay:
 * camera dolly-in → UnrealBloom burst → ~2k accent particles → foil card.
 *
 * Platform discipline (matches avatar3d):
 * - The raw WeChat canvas node is adapted for three r152 (addEventListener /
 *   width / height) — see adaptCanvasForThree in avatar3dSession.
 * - Any init failure, context loss, or tier < full → the caller falls back
 *   to the CSS/ParticleBurst celebration (guarded here via onContextLost).
 * - One WebGL context per stage instance; everything is disposed on unmount.
 */

export interface WebGLLandStageOptions {
  /** Raw platform canvas node (from queryAvatarCanvas). */
  canvas: any
  /** Acquired WebGL1 context (from acquireWebGLContext). */
  gl: WebGLRenderingContext
  cssWidth: number
  cssHeight: number
  /** Accent hex color for particles + foil card (from getArchetypeVisual). */
  accentColor: string
  /** Total stage duration in ms (doc: ~2.5s). */
  durationMs: number
  onContextLost?: () => void
}

export interface WebGLLandStageSession {
  /** Advance the timeline; call from the RAF loop. Returns false once done. */
  tick: (elapsedMs: number) => boolean
  /** Set card tilt from gyro (radians-ish small values, clamped internally). */
  setTilt: (x: number, y: number) => void
  /** RAF pair tied to the platform canvas. */
  raf: AvatarAnimationFrame
  dispose: () => void
  readonly disposed: boolean
}

const PARTICLE_COUNT = 2000
const CARD_WIDTH = 2.2
const CARD_HEIGHT = 3.2

/** three r152 expects DOM-style canvas APIs — see avatar3dSession.adaptCanvasForThree. */
function adaptCanvasForThree(canvasNode: any, gl: WebGLRenderingContext): any {
  const listeners: Record<string, Array<(...args: any[]) => void>> = {}
  return {
    get width() { return canvasNode.width },
    set width(value: number) { canvasNode.width = value },
    get height() { return canvasNode.height },
    set height(value: number) { canvasNode.height = value },
    style: {},
    getContext: (type: string) => (type === 'webgl' || type === 'webgl2' ? gl : null),
    addEventListener: (type: string, listener: (...args: any[]) => void) => {
      if (!listeners[type]) listeners[type] = []
      listeners[type].push(listener)
    },
    removeEventListener: (type: string, listener: (...args: any[]) => void) => {
      const list = listeners[type]
      if (!list) return
      const index = list.indexOf(listener)
      if (index >= 0) list.splice(index, 1)
    },
    dispatchEvent: () => false,
    __listeners: listeners,
    __rawCanvas: canvasNode,
  }
}

/** Guard for three r152: `context.getContextAttributes().alpha` must exist. */
function ensureContextAttributes(gl: WebGLRenderingContext): void {
  const anyGl = gl as any
  if (typeof anyGl.getContextAttributes !== 'function') {
    anyGl.getContextAttributes = () => ({
      alpha: true,
      depth: true,
      stencil: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
      failIfMajorPerformanceCaveat: false,
    })
  }
}

function buildParticleBurst(accent: Color): { points: Points; velocities: Float32Array } {
  const geometry = new BufferGeometry()
  const positions = new Float32Array(PARTICLE_COUNT * 3)
  const velocities = new Float32Array(PARTICLE_COUNT * 3)
  const colors = new Float32Array(PARTICLE_COUNT * 3)
  const white = new Color(1, 1, 1)

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Start clustered at the card center
    positions[i * 3] = (Math.random() - 0.5) * 0.3
    positions[i * 3 + 1] = (Math.random() - 0.5) * 0.3
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.3

    // Outward burst with slight upward bias + per-particle turbulence seed
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const speed = 1.6 + Math.random() * 3.4
    velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed
    velocities[i * 3 + 1] = Math.abs(Math.cos(phi)) * speed * 0.85 + 0.6
    velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed * 0.5

    // 80% accent / 20% white-hot core
    const c = Math.random() < 0.2 ? white : accent
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))

  const material = new PointsMaterial({
    size: 0.045,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })

  return { points: new Points(geometry, material), velocities }
}

export function createWebGLLandStageSession(options: WebGLLandStageOptions): WebGLLandStageSession {
  const { canvas, gl } = options
  ensureContextAttributes(gl)

  const adaptedCanvas = adaptCanvasForThree(canvas, gl)

  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({
      canvas: adaptedCanvas,
      context: gl,
      alpha: true,
      antialias: false,
      depth: true,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'low-power',
    })
  } catch (error) {
    throw new Error(`[webgl-land] WebGLRenderer init failed: ${(error as Error)?.message ?? error}`)
  }

  renderer.setClearColor(new Color(0, 0, 0), 0)
  renderer.setPixelRatio(1)
  renderer.setSize(Math.max(1, Math.round(options.cssWidth)), Math.max(1, Math.round(options.cssHeight)), false)

  const accent = new Color(options.accentColor)

  const scene = new Scene()
  const camera = new PerspectiveCamera(42, options.cssWidth / Math.max(1, options.cssHeight), 0.1, 60)
  camera.position.set(0, 0, 9.5)

  scene.add(new AmbientLight(new Color(1, 1, 1), 0.65))
  const keyLight = new DirectionalLight(new Color(1, 0.97, 0.9), 1.2)
  keyLight.position.set(2.5, 3.5, 5)
  scene.add(keyLight)
  const rimLight = new DirectionalLight(accent.clone(), 0.9)
  rimLight.position.set(-3, -1.5, 4)
  scene.add(rimLight)

  /* foil card — physical material with clearcoat for the holographic sheen */
  const cardGroup = new Group()
  const cardMaterial = new MeshPhysicalMaterial({
    color: accent.clone().lerp(new Color(1, 1, 1), 0.25),
    metalness: 0.35,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    emissive: accent.clone().multiplyScalar(0.18),
    transparent: true,
    opacity: 0,
  })
  const card = new Mesh(new PlaneGeometry(CARD_WIDTH, CARD_HEIGHT), cardMaterial)
  cardGroup.add(card)
  // thin emissive border frame to catch the bloom
  const frameMaterial = new MeshBasicMaterial({ color: accent.clone(), transparent: true, opacity: 0 })
  const frame = new Mesh(new PlaneGeometry(CARD_WIDTH + 0.08, CARD_HEIGHT + 0.08), frameMaterial)
  frame.position.z = -0.01
  cardGroup.add(frame)
  cardGroup.scale.setScalar(0.2)
  scene.add(cardGroup)

  const { points, velocities } = buildParticleBurst(accent)
  scene.add(points)

  /* UnrealBloom post chain — the cinematic light-bleed the CSS path can't do */
  const renderTarget = new WebGLRenderTarget(
    Math.max(1, Math.round(options.cssWidth)),
    Math.max(1, Math.round(options.cssHeight)),
  )
  const composer = new EffectComposer(renderer, renderTarget)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(
    new Vector2(Math.max(1, Math.round(options.cssWidth)), Math.max(1, Math.round(options.cssHeight))),
    0.0, // strength ramps with the timeline
    0.55, // radius
    0.12, // threshold
  )
  composer.addPass(bloom)

  let disposed = false
  let contextLostNotified = false
  let tiltX = 0
  let tiltY = 0

  function notifyContextLost(): void {
    if (contextLostNotified) return
    contextLostNotified = true
    try {
      options.onContextLost?.()
    } catch {
      // swallow — fallback decision belongs to the component
    }
  }

  /**
   * Timeline (~2.5s at baseline):
   *  0.00–0.55s  camera dolly-in, card scales up, frame fades in
   *  0.45–1.40s  bloom burst ramps, particle explosion outward
   *  1.40–2.50s  bloom settles, particles fade, card holds with gyro tilt
   */
  function tick(elapsedMs: number): boolean {
    if (disposed) return false
    if (isWebGLContextLost(gl)) {
      notifyContextLost()
      return false
    }
    const t = Math.min(1, elapsedMs / options.durationMs)
    const sec = elapsedMs / 1000

    // Camera dolly: 9.5 → 5.6 with ease-out cubic
    const dolly = 1 - Math.pow(1 - Math.min(1, elapsedMs / 550), 3)
    camera.position.z = 9.5 - dolly * 3.9

    // Card entrance: scale 0.2 → 1, opacity 0 → 1
    const cardIn = 1 - Math.pow(1 - Math.min(1, elapsedMs / 550), 3)
    cardGroup.scale.setScalar(0.2 + cardIn * 0.8)
    cardMaterial.opacity = cardIn
    frameMaterial.opacity = cardIn * 0.95

    // Gyro tilt with idle sway
    cardGroup.rotation.y = tiltY + Math.sin(sec * 0.8) * 0.06
    cardGroup.rotation.x = tiltX + Math.cos(sec * 0.6) * 0.045

    // Particle burst: detonate at 0.45s, expand + fade through 2.2s
    const burstStart = 450
    if (elapsedMs > burstStart) {
      const bt = (elapsedMs - burstStart) / 1000
      const decay = Math.max(0, 1 - bt / 1.75)
      const positions = points.geometry.getAttribute('position') as Float32BufferAttribute
      const posArray = positions.array as Float32Array
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const turb = Math.sin(sec * 3 + i * 0.37) * 0.22
        posArray[i * 3] += (velocities[i * 3] + turb) * 0.016 * decay
        posArray[i * 3 + 1] += (velocities[i * 3 + 1] - bt * 0.9) * 0.016 * decay
        posArray[i * 3 + 2] += velocities[i * 3 + 2] * 0.016 * decay
      }
      positions.needsUpdate = true
      ;(points.material as PointsMaterial).opacity = Math.min(1, bt * 6) * decay
    }

    // Bloom: ramp to peak at ~0.9s then settle to a gentle halo
    const bloomRamp = Math.min(1, Math.max(0, (elapsedMs - 400) / 500))
    const bloomSettle = elapsedMs < 1400 ? 1 : Math.max(0.35, 1 - (elapsedMs - 1400) / 900)
    bloom.strength = (0.4 + bloomRamp * 1.5) * bloomSettle

    try {
      composer.render()
    } catch {
      notifyContextLost()
      return false
    }
    return t < 1
  }

  return {
    tick,
    setTilt: (x: number, y: number) => {
      tiltX = Math.max(-0.5, Math.min(0.5, x))
      tiltY = Math.max(-0.6, Math.min(0.6, y))
    },
    raf: resolveAnimationFrame(canvas),
    dispose: () => {
      if (disposed) return
      disposed = true
      try {
        points.geometry.dispose()
        ;(points.material as PointsMaterial).dispose()
        card.geometry.dispose()
        cardMaterial.dispose()
        frame.geometry.dispose()
        frameMaterial.dispose()
        composer.dispose()
        renderTarget.dispose()
        renderer.dispose()
      } catch {
        // best-effort cleanup
      }
    },
    get disposed() { return disposed },
  }
}

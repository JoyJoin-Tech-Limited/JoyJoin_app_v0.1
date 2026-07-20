import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from 'three'
import type { EquipmentSlot3D, EquipmentVisibilityMap } from './avatar3dTypes'
import { buildSpiderPersonaModel, type SpiderPersonaModel } from './spiderModel'
import { getEquipmentVisibilitySignature } from './equipment3dMapping'
import {
  isWebGLContextLost,
  resolveAnimationFrame,
  type AvatarAnimationFrame,
} from './avatar3dPlatform'

/**
 * GL-side session for the spider-persona avatar. Owns the three.js renderer,
 * scene, camera and lights, plus render-on-demand scheduling and resource
 * disposal. All WeChat/H5 differences stay behind avatar3dPlatform.
 *
 * Resource ownership: the MODEL owns every mesh/geometry/material (released
 * once via model.dispose()); the SESSION owns the renderer + GL context. No
 * shared textures exist anywhere in the system — the character and garments
 * use model-owned materials, so dressing can never reference a disposed asset.
 */

export interface Avatar3DSessionOptions {
  /** Raw platform canvas node (from queryAvatarCanvas). */
  canvas: any
  /** Acquired WebGL1 context (from acquireWebGLContext). */
  gl: WebGLRenderingContext
  /** CSS-pixel canvas size. */
  cssWidth: number
  cssHeight: number
  /** Device pixel ratio (accepted for API stability; pixel art always renders at DPR 1). */
  pixelRatio: number
  /** Called once when the GL context is reported lost. */
  onContextLost?: () => void
}

export interface Avatar3DSession {
  /** Set continuous yaw (radians, unbounded) and schedule a render. */
  setYaw: (yaw: number) => void
  getYaw: () => number
  /** Apply per-slot equipment bindings; only changed slots are rebuilt. */
  applyEquipment: (visibility: EquipmentVisibilityMap) => void
  /** Render a single frame immediately (no-op when context lost/disposed). */
  renderNow: () => boolean
  /** Resize from new CSS dimensions. */
  resize: (cssWidth: number, cssHeight: number, pixelRatio: number) => void
  /** RAF pair tied to the platform canvas. */
  raf: AvatarAnimationFrame
  /** Current model (scene graph) — exposed for tests/debug tooling. */
  getModel: () => SpiderPersonaModel
  dispose: () => void
  readonly disposed: boolean
}

/**
 * Pixel-art render buffer. The canvas keeps its full CSS size for touch and
 * layout, while WebGL draws at this deliberately small resolution and the
 * compositor enlarges it with nearest-neighbour sampling.
 */
// 160px gives the 320-360px wardrobe stage a deliberate 2x-ish nearest-
// neighbour scale. At 320px the canvas was effectively native resolution, so
// the procedural model read as smooth low-poly rather than the approved sprite.
export const AVATAR_PIXEL_ART_BUFFER_WIDTH = 160

export function resolvePixelArtRenderSize(cssWidth: number, cssHeight: number): { width: number; height: number } {
  const safeWidth = Math.max(1, Math.round(cssWidth))
  const safeHeight = Math.max(1, Math.round(cssHeight))
  const scale = Math.min(1, AVATAR_PIXEL_ART_BUFFER_WIDTH / safeWidth)
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  }
}

/**
 * three r152 calls `canvas.addEventListener('webglcontextlost' …)` and reads
 * `canvas.width/height`. WeChat canvas nodes have neither, so we wrap the raw
 * node: listeners are recorded (we also poll `gl.isContextLost()`), and size
 * writes forward to the real node which owns the actual drawing buffer.
 */
export function adaptCanvasForThree(canvasNode: any, gl: WebGLRenderingContext): any {
  const listeners: Record<string, Array<(...args: any[]) => void>> = {}
  const adapter: any = {
    // three reads these to decide nothing critical, but setSize writes them.
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
  return adapter
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

export function createAvatar3DSession(options: Avatar3DSessionOptions): Avatar3DSession {
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
    throw new Error(`[avatar3d] WebGLRenderer init failed: ${(error as Error)?.message ?? error}`)
  }

  renderer.setClearColor(new Color(0, 0, 0), 0)
  const initialBufferSize = resolvePixelArtRenderSize(options.cssWidth, options.cssHeight)
  renderer.setPixelRatio(1)
  renderer.setSize(initialBufferSize.width, initialBufferSize.height, false)

  const scene = new Scene()
  const camera = new OrthographicCamera(-2, 2, 2.4, -2.4, 0.1, 60)
  const updateCameraFrustum = (cssWidth: number, cssHeight: number) => {
    const aspect = Math.max(0.5, cssWidth / Math.max(1, cssHeight))
    const halfHeight = 2.34
    camera.left = -halfHeight * aspect
    camera.right = halfHeight * aspect
    camera.top = halfHeight
    camera.bottom = -halfHeight
    camera.updateProjectionMatrix()
  }
  updateCameraFrustum(options.cssWidth, options.cssHeight)
  camera.position.set(0, 2.13, 7.4)
  camera.lookAt(0, 2.13, 0)

  // Soft four-point rig for the rounded pixel-styled model. It keeps the dark
  // purple materials readable without plastic highlights or shadow maps.
  const hemisphere = new HemisphereLight(
    new Color(1, 0.96, 0.92),
    new Color('#282431'),
    0.82,
  )
  const keyLight = new DirectionalLight(new Color(1, 0.94, 0.9), 1)
  keyLight.position.set(3.4, 5.8, 4.5)
  const rimLight = new DirectionalLight(new Color('#7752a5'), 0.45)
  rimLight.position.set(-3.2, 3.6, -4.8)
  const ambient = new AmbientLight(new Color(0.92, 0.88, 1), 0.2)
  scene.add(hemisphere, keyLight, rimLight, ambient)

  const model = buildSpiderPersonaModel()
  const stageGroup = new Group()
  stageGroup.name = 'spider-persona-stage'
  stageGroup.add(model.root)
  scene.add(stageGroup)

  let disposed = false
  let contextLostNotified = false
  let lastEquipmentSignature = ''

  function renderNow(): boolean {
    if (disposed) return false
    if (isWebGLContextLost(gl)) {
      notifyContextLost()
      return false
    }
    try {
      renderer.render(scene, camera)
      return true
    } catch {
      return false
    }
  }

  function notifyContextLost(): void {
    if (contextLostNotified) return
    contextLostNotified = true
    try {
      options.onContextLost?.()
    } catch {
      // swallow — fallback decision belongs to the component
    }
  }

  function applyEquipment(visibility: EquipmentVisibilityMap): void {
    if (disposed) return
    const signature = getEquipmentVisibilitySignature(visibility)
    if (signature === lastEquipmentSignature) return
    lastEquipmentSignature = signature

    for (const slot of Object.keys(visibility) as EquipmentSlot3D[]) {
      // Garments are pre-built in the model — this only flips visibility.
      model.applyEquipment(slot, visibility[slot].descriptor)
    }
  }

  function resize(cssWidth: number, cssHeight: number, _pixelRatio: number): void {
    if (disposed) return
    const safeWidth = Math.max(1, cssWidth)
    const safeHeight = Math.max(1, cssHeight)
    updateCameraFrustum(safeWidth, safeHeight)
    const bufferSize = resolvePixelArtRenderSize(safeWidth, safeHeight)
    renderer.setPixelRatio(1)
    renderer.setSize(bufferSize.width, bufferSize.height, false)
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    model.dispose()
    try {
      renderer.dispose()
    } catch {
      // ignore — dispose is best effort
    }
    // Some WeChat canvas adapters are not real EventTargets. Explicitly drop
    // callbacks still retained by our shim after three.js disposes so a closed
    // wardrobe page cannot keep the component/session alive.
    const retainedListeners = Object.entries(adaptedCanvas.__listeners) as Array<
      [string, Array<(...args: any[]) => void>]
    >
    for (const [type, callbacks] of retainedListeners) {
      for (const callback of [...callbacks]) adaptedCanvas.removeEventListener(type, callback)
    }
    try {
      // Free the underlying GL context so the WeChat canvas can be reused.
      const loseContext = (gl as any).getExtension?.('WEBGL_lose_context')
      loseContext?.loseContext?.()
    } catch {
      // ignore
    }
  }

  return {
    setYaw(yaw: number) {
      model.setYaw(yaw)
    },
    getYaw: () => model.getYaw(),
    applyEquipment,
    renderNow,
    resize,
    raf: resolveAnimationFrame(canvas),
    getModel: () => model,
    dispose,
    get disposed() {
      return disposed
    },
  }
}

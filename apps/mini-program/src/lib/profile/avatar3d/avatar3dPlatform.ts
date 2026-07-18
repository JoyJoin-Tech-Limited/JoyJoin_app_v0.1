import Taro from '@tarojs/taro'

/**
 * Platform adapter for WebGL inside the WeChat mini-program runtime (with an H5
 * path for the dev browser). This module is the ONLY place that touches
 * Taro canvas APIs, so renderer/session/model code stays platform-agnostic.
 *
 * WeChat differences handled here:
 * - canvas node lookup through `Taro.createSelectorQuery().fields({node,size})`,
 *   with an H5 DOM fallback (`document.getElementById` + nested-canvas descent)
 * - WebGL context acquisition (`canvas.getContext('webgl')`), attribute fallback
 * - requestAnimationFrame: WeChat canvas nodes expose their own RAF; H5 uses
 *   window RAF; last resort setTimeout so the loop never hard-crashes
 * - device pixel ratio capped (AVATAR_3D_MAX_DPR) for GPU memory safety
 *
 * No texture helpers live here: every garment is a solid-palette procedural
 * mesh, so the 3D system never creates texture images.
 */

/** Cap DPR hard — 3× on a 750px canvas allocates ~20MB of backing store. */
export const AVATAR_3D_MAX_DPR = 1.5

export interface AvatarCanvasHandle {
  /** Raw platform canvas node (WeChat canvas or HTMLCanvasElement). */
  node: any
  /** CSS-pixel size of the canvas element. */
  cssWidth: number
  cssHeight: number
}

/**
 * Capability probe: true when the runtime can locate a canvas node — either
 * through the WeChat selector-query API or, in H5, through the DOM.
 */
export function canQueryAvatarCanvas(): boolean {
  if (typeof (Taro as any)?.createSelectorQuery === 'function') return true
  try {
    return typeof document !== 'undefined' && typeof document.getElementById === 'function'
  } catch {
    return false
  }
}

/** Look up the canvas node + CSS size. Returns null when the node is missing. */
export function queryAvatarCanvas(canvasId: string): Promise<AvatarCanvasHandle | null> {
  if (typeof (Taro as any)?.createSelectorQuery === 'function') {
    return queryViaTaroSelector(canvasId)
  }
  return Promise.resolve(queryViaDom(canvasId))
}

/** WeChat path: node + size via the selector-query API. */
function queryViaTaroSelector(canvasId: string): Promise<AvatarCanvasHandle | null> {
  return new Promise((resolve) => {
    try {
      Taro.createSelectorQuery()
        .select(`#${canvasId}`)
        .fields({ node: true, size: true })
        .exec((result: any) => {
          const entry = Array.isArray(result) ? result[0] : null
          const node = entry?.node ?? null
          if (!node) {
            resolve(null)
            return
          }
          resolve({
            node,
            cssWidth: typeof entry.width === 'number' && entry.width > 0 ? entry.width : 300,
            cssHeight: typeof entry.height === 'number' && entry.height > 0 ? entry.height : 300,
          })
        })
    } catch {
      resolve(null)
    }
  })
}

/**
 * H5 fallback: locate the canvas through the DOM. The Taro `<Canvas>` H5
 * component may render a wrapper element, so accept the element itself when
 * it is canvas-like (has `getContext`) or descend into a nested `<canvas>`.
 * CSS size comes from the bounding rect, with client size as a fallback.
 */
function queryViaDom(canvasId: string): AvatarCanvasHandle | null {
  try {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') {
      return null
    }
    const element = document.getElementById(canvasId) as any
    if (!element) return null
    const node = typeof element.getContext === 'function'
      ? element
      : typeof element.querySelector === 'function'
        ? element.querySelector('canvas')
        : null
    if (!node) return null
    const rect = typeof node.getBoundingClientRect === 'function' ? node.getBoundingClientRect() : null
    const cssWidth = rect && rect.width > 0
      ? rect.width
      : typeof node.clientWidth === 'number' && node.clientWidth > 0
        ? node.clientWidth
        : 300
    const cssHeight = rect && rect.height > 0
      ? rect.height
      : typeof node.clientHeight === 'number' && node.clientHeight > 0
        ? node.clientHeight
        : 300
    return { node, cssWidth, cssHeight }
  } catch {
    return null
  }
}

/**
 * Acquire a WebGL1 rendering context. Tries with explicit attributes first,
 * then a bare call — some WeChat base libraries ignore/reject the second arg.
 * Returns null when WebGL is unavailable (caller falls back to V2).
 */
export function acquireWebGLContext(canvasNode: any): WebGLRenderingContext | null {
  if (!canvasNode || typeof canvasNode.getContext !== 'function') return null
  const attempts: Array<Record<string, unknown> | undefined> = [
    {
      alpha: true,
      depth: true,
      stencil: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
      failIfMajorPerformanceCaveat: false,
    },
    { alpha: true, antialias: false },
    undefined,
  ]
  for (const attrs of attempts) {
    try {
      const gl = attrs === undefined
        ? canvasNode.getContext('webgl')
        : canvasNode.getContext('webgl', attrs)
      if (gl) return gl as WebGLRenderingContext
    } catch {
      // try the next, simpler attribute set
    }
  }
  return null
}

export interface AvatarAnimationFrame {
  request: (callback: (timeMs: number) => void) => number
  cancel: (handle: number) => void
}

/**
 * Resolve the best available RAF pair. WeChat canvas nodes carry their own
 * `requestAnimationFrame`; H5 uses the window one; setTimeout is the last resort.
 */
export function resolveAnimationFrame(canvasNode: any): AvatarAnimationFrame {
  if (canvasNode && typeof canvasNode.requestAnimationFrame === 'function') {
    return {
      request: (callback) => canvasNode.requestAnimationFrame(callback),
      cancel: (handle) => {
        if (typeof canvasNode.cancelAnimationFrame === 'function') canvasNode.cancelAnimationFrame(handle)
      },
    }
  }
  const globalRaf = (globalThis as any).requestAnimationFrame
  if (typeof globalRaf === 'function') {
    const globalCancel = (globalThis as any).cancelAnimationFrame
    return {
      request: (callback) => globalRaf.call(globalThis, callback),
      cancel: (handle) => {
        if (typeof globalCancel === 'function') globalCancel.call(globalThis, handle)
      },
    }
  }
  return {
    request: (callback) => setTimeout(() => callback(Date.now()), 16) as unknown as number,
    cancel: (handle) => clearTimeout(handle),
  }
}

/** Device pixel ratio, capped for memory safety. */
export function resolvePixelRatio(cap: number = AVATAR_3D_MAX_DPR): number {
  try {
    const info = Taro.getSystemInfoSync()
    const ratio = typeof info?.pixelRatio === 'number' && info.pixelRatio > 0 ? info.pixelRatio : 1
    return Math.min(ratio, cap)
  } catch {
    return 1
  }
}

/** Best-effort context-lost probe polled between renders. */
export function isWebGLContextLost(gl: WebGLRenderingContext | null): boolean {
  if (!gl) return true
  try {
    return typeof gl.isContextLost === 'function' ? gl.isContextLost() : false
  } catch {
    return true
  }
}

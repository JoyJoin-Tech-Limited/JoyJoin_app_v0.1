import { describe, expect, it, vi } from 'vitest'
import { adaptCanvasForThree } from './avatar3dSession'

describe('adaptCanvasForThree', () => {
  function makeRawCanvas() {
    return {
      width: 300,
      height: 300,
      getContext: vi.fn(),
      createImage: vi.fn(),
    }
  }

  it('forwards size reads/writes to the real canvas node (drawing buffer owner)', () => {
    const raw = makeRawCanvas()
    const gl = {} as WebGLRenderingContext
    const adapter = adaptCanvasForThree(raw, gl)

    adapter.width = 450
    adapter.height = 600
    expect(raw.width).toBe(450)
    expect(raw.height).toBe(600)
    expect(adapter.width).toBe(450)
    expect(adapter.height).toBe(600)
  })

  it('returns the injected GL for webgl context requests', () => {
    const raw = makeRawCanvas()
    const gl = { tag: 'gl' } as unknown as WebGLRenderingContext
    const adapter = adaptCanvasForThree(raw, gl)

    expect(adapter.getContext('webgl')).toBe(gl)
    expect(adapter.getContext('webgl2')).toBe(gl)
    expect(adapter.getContext('2d')).toBeNull()
    expect(raw.getContext).not.toHaveBeenCalled()
  })

  it('records webglcontextlost listeners instead of crashing (WeChat canvas has no EventTarget)', () => {
    const raw = makeRawCanvas()
    const adapter = adaptCanvasForThree(raw, {} as WebGLRenderingContext)
    const onLost = vi.fn()

    expect(() => adapter.addEventListener('webglcontextlost', onLost)).not.toThrow()
    expect(adapter.__listeners.webglcontextlost).toContain(onLost)

    adapter.removeEventListener('webglcontextlost', onLost)
    expect(adapter.__listeners.webglcontextlost).not.toContain(onLost)
  })

  it('exposes a style object so three setSize style writes are harmless', () => {
    const adapter = adaptCanvasForThree(makeRawCanvas(), {} as WebGLRenderingContext)
    expect(adapter.style).toEqual({})
    expect(() => { adapter.style.width = '100px' }).not.toThrow()
    // …and never forwarded to the raw node
    expect((adapter.__rawCanvas as any).style).toBeUndefined()
  })
})

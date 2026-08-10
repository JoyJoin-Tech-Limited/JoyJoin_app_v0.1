import { render } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockCtx = {
  clearRect: vi.fn(),
  draw: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  setGlobalAlpha: vi.fn(),
  setFillStyle: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
}

const mockTaro = (reduceMotion: boolean) => ({
  default: {
    getSystemInfoSync: () => ({ reduceMotion, windowWidth: 375 }),
    createCanvasContext: () => mockCtx,
    createSelectorQuery: () => ({
      in: () => ({
        select: () => ({
          boundingClientRect: () => ({
            exec: (cb: (res: unknown) => void) => cb([{ width: 300, height: 300 }]),
          }),
        }),
      }),
    }),
    getCurrentInstance: () => ({}),
  },
})

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Canvas: (props: Record<string, unknown>) => <canvas {...props} />,
}))

describe('ParticleBurst', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(cb, 16))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  })

  it('renders a canvas in normal motion mode', async () => {
    vi.doMock('@tarojs/taro', () => mockTaro(false))
    const { default: ParticleBurst } = await import('./ParticleBurst')

    const { container } = render(<ParticleBurst trigger={false} type='confetti' />)
    expect(container.querySelector('canvas')).toBeTruthy()
    expect(container.querySelector('.reveal-particle-burst__canvas')).toBeTruthy()
  })

  it('renders an emoji flash in reduced motion mode', async () => {
    vi.doMock('@tarojs/taro', () => mockTaro(true))
    const { default: ParticleBurst } = await import('./ParticleBurst')

    const { container } = render(<ParticleBurst trigger type='confetti' />)
    expect(container.querySelector('.reveal-particle-burst__emoji--confetti')).toBeTruthy()
  })
})

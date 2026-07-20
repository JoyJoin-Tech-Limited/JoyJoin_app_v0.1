import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EquipmentItem, EquipmentOutfit } from '../../lib/profile/equipmentApi'
import { computeDragYaw, nearestFrontYaw } from '../../lib/profile/avatar3d/avatar3dGestures'
import PixelAvatar3D from './PixelAvatar3D'

/**
 * Component-level tests for PixelAvatar3D. The platform + GL session layers are
 * mocked so the interaction contract (drag yaw, inertia, double-tap reset,
 * equipment sync, fallback, archetype gate, page lifecycle) is verifiable in
 * jsdom. `@tarojs/taro` is mocked because the component calls the named
 * `useDidShow`/`useDidHide` page-lifecycle hooks unconditionally.
 */

const mocks = vi.hoisted(() => {
  const rafQueue: Array<{ handle: number; callback: (timeMs: number) => void }> = []
  let rafHandle = 0
  const fakeSession = {
    yaw: 0,
    disposed: false,
    setYaw: vi.fn(function (this: { yaw: number }, yaw: number) { this.yaw = yaw }),
    getYaw: vi.fn(function (this: { yaw: number }) { return this.yaw }),
    applyEquipment: vi.fn(),
    renderNow: vi.fn(() => true),
    resize: vi.fn(),
    raf: {
      request: vi.fn((callback: (timeMs: number) => void) => {
        rafHandle += 1
        rafQueue.push({ handle: rafHandle, callback })
        return rafHandle
      }),
      cancel: vi.fn((handle: number) => {
        const index = rafQueue.findIndex((entry) => entry.handle === handle)
        if (index >= 0) rafQueue.splice(index, 1)
      }),
    },
    getModel: vi.fn(),
    dispose: vi.fn(function (this: { disposed: boolean }) { this.disposed = true }),
  }
  const didShowCallbacks: Array<() => void> = []
  const didHideCallbacks: Array<() => void> = []
  return {
    rafQueue,
    fakeSession,
    queryAvatarCanvas: vi.fn(),
    canQueryAvatarCanvas: vi.fn(() => true),
    acquireWebGLContext: vi.fn(),
    resolvePixelRatio: vi.fn(() => 1),
    createAvatar3DSession: vi.fn(() => fakeSession),
    haptics: vi.fn(),
    logWarn: vi.fn(),
    getSystemReducedMotion: vi.fn(() => false),
    didShowCallbacks,
    didHideCallbacks,
    useDidShow: vi.fn((callback: () => void) => { didShowCallbacks.push(callback) }),
    useDidHide: vi.fn((callback: () => void) => { didHideCallbacks.push(callback) }),
    taroDefault: {
      createSelectorQuery: vi.fn(),
      showToast: vi.fn(),
    },
  }
})

vi.mock('@tarojs/taro', () => ({
  __esModule: true,
  default: mocks.taroDefault,
  useDidShow: mocks.useDidShow,
  useDidHide: mocks.useDidHide,
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, catchMove: _catchMove, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, userSelect: _userSelect, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, ...props }: any) => <img alt='' {...props} />,
  Canvas: ({ children: _children, ...props }: any) => <canvas {...props} />,
  ScrollView: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}))

vi.mock('../../lib/profile/avatar3d/avatar3dPlatform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/profile/avatar3d/avatar3dPlatform')>()
  return {
    ...actual,
    queryAvatarCanvas: mocks.queryAvatarCanvas,
    canQueryAvatarCanvas: mocks.canQueryAvatarCanvas,
    acquireWebGLContext: mocks.acquireWebGLContext,
    resolvePixelRatio: mocks.resolvePixelRatio,
  }
})

vi.mock('../../lib/profile/avatar3d/avatar3dSession', () => ({
  createAvatar3DSession: mocks.createAvatar3DSession,
}))

vi.mock('../../lib/utils/haptics', () => ({
  haptics: mocks.haptics,
}))

vi.mock('../../lib/utils/logger', () => ({
  logInfo: vi.fn(),
  logWarn: mocks.logWarn,
  logError: vi.fn(),
}))

vi.mock('../../lib/utils/accessibility', () => ({
  getSystemReducedMotion: mocks.getSystemReducedMotion,
}))

function makeItem(slot: EquipmentItem['slot'], id = `${slot}-item`): EquipmentItem {
  return {
    id,
    slug: `starter-${slot}`,
    name: `Starter ${slot}`,
    description: '',
    slot,
    rarity: 'common',
    assetKey: `equipment/starter/spider/${slot}/v1`,
    compatibleArchetypes: null,
  } as EquipmentItem
}

const ALL_ITEMS: EquipmentItem[] = [
  makeItem('top'),
  makeItem('bottom'),
  makeItem('shoes'),
  makeItem('accessory'),
]
const ITEMS_BY_ID = new Map(ALL_ITEMS.map((item) => [item.id, item]))

function makeOutfit(overrides: Partial<EquipmentOutfit> = {}): EquipmentOutfit {
  return {
    topItemId: 'top-item',
    bottomItemId: 'bottom-item',
    shoesItemId: 'shoes-item',
    accessoryItemId: 'accessory-item',
    version: 1,
    ...overrides,
  } as EquipmentOutfit
}

function renderAvatar(props: Partial<Parameters<typeof PixelAvatar3D>[0]> = {}) {
  return render(
    <PixelAvatar3D
      archetypeId='spider'
      outfit={makeOutfit()}
      itemsById={ITEMS_BY_ID}
      {...props}
    />,
  )
}

function mockSuccessfulBoot() {
  mocks.queryAvatarCanvas.mockResolvedValue({
    node: { tag: 'wechat-canvas' },
    cssWidth: 320,
    cssHeight: 320,
  })
  mocks.acquireWebGLContext.mockReturnValue({ tag: 'gl' })
}

function flushRaf(steps = 1): void {
  for (let i = 0; i < steps; i++) {
    const entry = mocks.rafQueue.shift()
    if (!entry) return
    entry.callback(performance.now())
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.rafQueue.length = 0
  mocks.didShowCallbacks.length = 0
  mocks.didHideCallbacks.length = 0
  mocks.fakeSession.yaw = 0
  mocks.fakeSession.disposed = false
  mocks.queryAvatarCanvas.mockReset()
  mocks.canQueryAvatarCanvas.mockReset()
  mocks.canQueryAvatarCanvas.mockReturnValue(true)
  mocks.acquireWebGLContext.mockReset()
  mocks.createAvatar3DSession.mockClear()
  mocks.createAvatar3DSession.mockImplementation(() => mocks.fakeSession)
  mocks.getSystemReducedMotion.mockReset()
  mocks.getSystemReducedMotion.mockReturnValue(false)
  // The capability-delegation test mutates this; always restore a function.
  mocks.taroDefault.createSelectorQuery = vi.fn()
})

describe('PixelAvatar3D — archetype gate (spider only)', () => {
  it('never boots WebGL for a non-spider archetype: V2 turntable + honest notice, synchronously', () => {
    const onStatusChange = vi.fn()
    const { container } = renderAvatar({ archetypeId: 'cat', onStatusChange })

    // Synchronous — the gate short-circuits before any async canvas query.
    expect(container.querySelector('.pixel-avatar-composite__body')).toBeTruthy()
    expect(screen.getByText('该人格 3D 形象正在准备，先展示经典形象')).toBeInTheDocument()
    expect(mocks.queryAvatarCanvas).not.toHaveBeenCalled()
    expect(mocks.createAvatar3DSession).not.toHaveBeenCalled()
    expect(onStatusChange).toHaveBeenCalledWith({ status: 'fallback', reason: 'unsupported-archetype' })
    expect(mocks.logWarn).toHaveBeenCalledWith(
      expect.stringContaining('3D preview unavailable'),
      expect.objectContaining({ reason: 'unsupported-archetype', archetypeId: 'cat' }),
    )
  })

  it.each(['corgi', 'owl', 'dolphin_calm', 'fox'] as const)(
    'keeps %s on the V2 turntable without touching WebGL',
    (archetypeId) => {
      const { container } = renderAvatar({ archetypeId })
      expect(container.querySelector('.pixel-avatar-composite__body')).toBeTruthy()
      expect(screen.getByText('该人格 3D 形象正在准备，先展示经典形象')).toBeInTheDocument()
      expect(mocks.queryAvatarCanvas).not.toHaveBeenCalled()
    },
  )

  it('normalizes unknown archetype ids away from spider (never swaps in a spider)', () => {
    const { container } = renderAvatar({ archetypeId: 'mystery-box' })
    expect(container.querySelector('.pixel-avatar-composite__body')).toBeTruthy()
    expect(mocks.queryAvatarCanvas).not.toHaveBeenCalled()
    expect(mocks.createAvatar3DSession).not.toHaveBeenCalled()
  })
})

describe('PixelAvatar3D — WebGL fallback (spider on incapable environment)', () => {
  it('falls back to the stable V2 turntable with a gentle notice when the canvas node is missing', async () => {
    mocks.queryAvatarCanvas.mockResolvedValue(null)
    const { container } = renderAvatar()

    await waitFor(() => {
      expect(container.querySelector('.pixel-avatar-composite__body')).toBeTruthy()
    })
    expect(screen.getByText('当前设备暂不支持 3D 预览，已切换为经典形象')).toBeInTheDocument()
    expect(container.querySelector('canvas')).toBeNull()
    expect(mocks.createAvatar3DSession).not.toHaveBeenCalled()
  })

  it('falls back when the WebGL context cannot be created', async () => {
    mocks.queryAvatarCanvas.mockResolvedValue({ node: {}, cssWidth: 320, cssHeight: 320 })
    mocks.acquireWebGLContext.mockReturnValue(null)
    const { container } = renderAvatar()

    await waitFor(() => {
      expect(container.querySelector('.pixel-avatar-composite__body')).toBeTruthy()
    })
    expect(mocks.createAvatar3DSession).not.toHaveBeenCalled()
  })

  it('falls back when session construction throws', async () => {
    mockSuccessfulBoot()
    mocks.createAvatar3DSession.mockImplementationOnce(() => {
      throw new Error('shader compile failed')
    })
    const { container } = renderAvatar()

    await waitFor(() => {
      expect(container.querySelector('.pixel-avatar-composite__body')).toBeTruthy()
    })
  })
})

describe('PixelAvatar3D — status reporting for QA/diagnostics', () => {
  it('reports ready after a successful boot', async () => {
    const onStatusChange = vi.fn()
    mockSuccessfulBoot()
    renderAvatar({ onStatusChange })

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({ status: 'ready', reason: null })
    })
  })

  it('reports canvas-node-missing when the canvas node cannot be found', async () => {
    const onStatusChange = vi.fn()
    mocks.queryAvatarCanvas.mockResolvedValue(null)
    renderAvatar({ onStatusChange })

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({ status: 'fallback', reason: 'canvas-node-missing' })
    })
  })

  it('reports webgl-context-missing when no GL context can be acquired', async () => {
    const onStatusChange = vi.fn()
    mocks.queryAvatarCanvas.mockResolvedValue({ node: {}, cssWidth: 320, cssHeight: 320 })
    mocks.acquireWebGLContext.mockReturnValue(null)
    renderAvatar({ onStatusChange })

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({ status: 'fallback', reason: 'webgl-context-missing' })
    })
  })

  it('reports session-init-failed when renderer construction throws', async () => {
    const onStatusChange = vi.fn()
    mockSuccessfulBoot()
    mocks.createAvatar3DSession.mockImplementationOnce(() => {
      throw new Error('shader compile failed')
    })
    renderAvatar({ onStatusChange })

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({ status: 'fallback', reason: 'session-init-failed' })
    })
  })

  it('reports canvas-query-missing when the platform has no canvas lookup path at all', () => {
    const onStatusChange = vi.fn()
    mocks.canQueryAvatarCanvas.mockReturnValue(false)
    renderAvatar({ onStatusChange })
    expect(onStatusChange).toHaveBeenCalledWith({ status: 'fallback', reason: 'canvas-query-missing' })
    expect(mocks.queryAvatarCanvas).not.toHaveBeenCalled()
    expect(mocks.logWarn).toHaveBeenCalledWith(
      expect.stringContaining('3D preview unavailable'),
      expect.objectContaining({ reason: 'canvas-query-missing' }),
    )
  })

  it('delegates the capability decision to canQueryAvatarCanvas (H5 DOM fallback can boot)', async () => {
    // No WeChat selector API, but the platform helper reports a DOM lookup
    // path — the component must trust the helper and boot.
    const onStatusChange = vi.fn()
    ;(mocks.taroDefault as any).createSelectorQuery = undefined
    mockSuccessfulBoot()
    try {
      renderAvatar({ onStatusChange })
      await waitFor(() => {
        expect(onStatusChange).toHaveBeenCalledWith({ status: 'ready', reason: null })
      })
    } finally {
      mocks.taroDefault.createSelectorQuery = vi.fn()
    }
    expect(mocks.canQueryAvatarCanvas).toHaveBeenCalled()
    expect(mocks.queryAvatarCanvas).toHaveBeenCalled()
  })
})

describe('PixelAvatar3D — ready session', () => {
  it('creates the session, applies the authoritative outfit and renders', async () => {
    mockSuccessfulBoot()
    renderAvatar()

    await waitFor(() => {
      expect(mocks.fakeSession.applyEquipment).toHaveBeenCalled()
    })
    const visibility = mocks.fakeSession.applyEquipment.mock.calls[0][0]
    expect(Object.keys(visibility).sort()).toEqual(['accessory', 'bottom', 'shoes', 'top'])
    expect(visibility.top.itemId).toBe('top-item')
    expect(visibility.top.descriptor.assetKey).toBe('equipment/starter/spider/top/v1')
    expect(mocks.fakeSession.renderNow).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '回到正面视角' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: /360 度旋转/ })).toBeInTheDocument()
  })

  it('re-applies equipment when the outfit changes (slot groups only)', async () => {
    mockSuccessfulBoot()
    const { rerender } = renderAvatar()
    await waitFor(() => expect(mocks.fakeSession.applyEquipment).toHaveBeenCalled())
    const callsAfterBoot = mocks.fakeSession.applyEquipment.mock.calls.length

    rerender(
      <PixelAvatar3D
        archetypeId='spider'
        outfit={makeOutfit({ topItemId: null })}
        itemsById={ITEMS_BY_ID}
      />,
    )
    await waitFor(() => expect(mocks.fakeSession.applyEquipment.mock.calls.length).toBeGreaterThan(callsAfterBoot))
    const calls = mocks.fakeSession.applyEquipment.mock.calls
    const nextVisibility = calls[calls.length - 1][0]
    expect(nextVisibility.top.itemId).toBeNull()
    expect(nextVisibility.bottom.itemId).toBe('bottom-item')
  })

  it('drag horizontally updates yaw continuously (no snap stops)', async () => {
    mockSuccessfulBoot()
    renderAvatar()
    await waitFor(() => expect(mocks.fakeSession.renderNow).toHaveBeenCalled())

    const slider = screen.getByRole('slider', { name: /360 度旋转/ })
    fireEvent.touchStart(slider, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchMove(slider, { touches: [{ clientX: 205, clientY: 104 }] })

    const expected = computeDragYaw(0, 105)
    expect(mocks.fakeSession.yaw).toBeCloseTo(expected, 5)
    // keep dragging past a full turn — yaw keeps accumulating
    fireEvent.touchMove(slider, { touches: [{ clientX: 100 + 420 * 1.5, clientY: 100 }] })
    expect(mocks.fakeSession.yaw).toBeCloseTo(computeDragYaw(0, 420 * 1.5), 5)
    fireEvent.touchEnd(slider, { changedTouches: [{ clientX: 100 + 420 * 1.5, clientY: 100 }] })
  })

  it('handles the real weapp touch stream directly on the native WebGL canvas', async () => {
    mockSuccessfulBoot()
    const { container } = renderAvatar()
    await waitFor(() => expect(mocks.fakeSession.renderNow).toHaveBeenCalled())

    const canvas = container.querySelector('canvas')
    expect(canvas).toBeTruthy()
    fireEvent.touchStart(canvas!, { touches: [{ clientX: 80, clientY: 120 }] })
    fireEvent.touchMove(canvas!, { touches: [{ clientX: 200, clientY: 124 }] })

    expect(mocks.fakeSession.yaw).toBeCloseTo(computeDragYaw(0, 120), 5)
    fireEvent.touchEnd(canvas!, { changedTouches: [{ clientX: 200, clientY: 124 }] })
  })

  it('keeps the first drag origin if the native canvas and overlay both report touch-start', async () => {
    mockSuccessfulBoot()
    const { container } = renderAvatar()
    await waitFor(() => expect(mocks.fakeSession.renderNow).toHaveBeenCalled())

    const canvas = container.querySelector('canvas')
    const slider = screen.getByRole('slider', { name: /360/ })
    fireEvent.touchStart(canvas!, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchStart(slider, { touches: [{ clientX: 180, clientY: 100 }] })
    fireEvent.touchMove(canvas!, { touches: [{ clientX: 205, clientY: 102 }] })

    expect(mocks.fakeSession.yaw).toBeCloseTo(computeDragYaw(0, 105), 5)
    fireEvent.touchEnd(canvas!, { changedTouches: [{ clientX: 205, clientY: 102 }] })
  })

  it('ignores vertical gestures so page scrolling is not hijacked', async () => {
    mockSuccessfulBoot()
    renderAvatar()
    await waitFor(() => expect(mocks.fakeSession.renderNow).toHaveBeenCalled())

    const slider = screen.getByRole('slider', { name: /360 度旋转/ })
    fireEvent.touchStart(slider, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchMove(slider, { touches: [{ clientX: 104, clientY: 180 }] })

    expect(mocks.fakeSession.yaw).toBe(0)
  })

  it('double-tap recenters to the front pose with haptics', async () => {
    mockSuccessfulBoot()
    renderAvatar()
    await waitFor(() => expect(mocks.fakeSession.renderNow).toHaveBeenCalled())

    mocks.fakeSession.yaw = 2.5
    const slider = screen.getByRole('slider', { name: /360 度旋转/ })
    fireEvent.touchStart(slider, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchEnd(slider, { changedTouches: [{ clientX: 101, clientY: 100 }] })
    fireEvent.touchStart(slider, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchEnd(slider, { changedTouches: [{ clientX: 100, clientY: 100 }] })

    expect(mocks.haptics).toHaveBeenCalledWith('light')
    expect(mocks.rafQueue.length).toBeGreaterThan(0)
    flushRaf(20)
    expect(mocks.fakeSession.yaw).toBeCloseTo(nearestFrontYaw(2.5), 5)
    expect(nearestFrontYaw(2.5)).toBe(0)
  })

  it('回正 button resets the view', async () => {
    mockSuccessfulBoot()
    renderAvatar()
    await waitFor(() => expect(mocks.fakeSession.renderNow).toHaveBeenCalled())

    mocks.fakeSession.yaw = Math.PI
    fireEvent.click(screen.getByRole('button', { name: '回到正面视角' }))
    expect(mocks.haptics).toHaveBeenCalledWith('light')
    flushRaf(20)
    // Math.round(0.5) rounds up, so π settles on 2π — the same front pose.
    expect(mocks.fakeSession.yaw).toBeCloseTo(Math.PI * 2, 5)
  })

  it('snaps back without RAF animation when reduced motion is enabled', async () => {
    mocks.getSystemReducedMotion.mockReturnValue(true)
    mockSuccessfulBoot()
    renderAvatar()
    await waitFor(() => expect(mocks.fakeSession.renderNow).toHaveBeenCalled())

    mocks.fakeSession.yaw = 2.5
    fireEvent.click(screen.getByRole('button', { name: '回到正面视角' }))

    expect(mocks.rafQueue).toHaveLength(0)
    expect(mocks.fakeSession.yaw).toBeCloseTo(nearestFrontYaw(2.5), 5)
  })

  it('honors externalYaw commands (QA presets)', async () => {
    mockSuccessfulBoot()
    const { rerender } = renderAvatar()
    await waitFor(() => expect(mocks.fakeSession.renderNow).toHaveBeenCalled())

    rerender(
      <PixelAvatar3D
        archetypeId='spider'
        outfit={makeOutfit()}
        itemsById={ITEMS_BY_ID}
        externalYaw={Math.PI}
      />,
    )
    await waitFor(() => expect(mocks.fakeSession.yaw).toBeCloseTo(Math.PI, 5))
  })

  it('disposes the session on unmount', async () => {
    mockSuccessfulBoot()
    const { unmount } = renderAvatar()
    await waitFor(() => expect(mocks.fakeSession.renderNow).toHaveBeenCalled())

    unmount()
    expect(mocks.fakeSession.dispose).toHaveBeenCalledTimes(1)
  })
})

describe('PixelAvatar3D — page lifecycle hooks', () => {
  it('registers useDidShow/useDidHide unconditionally; show repaints, hide pauses', async () => {
    mockSuccessfulBoot()
    renderAvatar()
    await waitFor(() => expect(mocks.fakeSession.renderNow).toHaveBeenCalled())

    // The hooks are called unconditionally on every render (rules of hooks) —
    // the contract is that registration never skips a render, not that it
    // fires exactly once (status boot → ready re-renders).
    expect(mocks.useDidShow).toHaveBeenCalled()
    expect(mocks.useDidHide).toHaveBeenCalled()
    expect(mocks.didShowCallbacks.length).toBeGreaterThan(0)
    expect(mocks.didHideCallbacks.length).toBeGreaterThan(0)

    // Page hide: pauses loops without throwing.
    act(() => {
      mocks.didHideCallbacks[0]()
    })

    // Page show: re-queries canvas size, resizes the session and repaints.
    mocks.fakeSession.renderNow.mockClear()
    mocks.fakeSession.resize.mockClear()
    await act(async () => {
      mocks.didShowCallbacks[0]()
    })
    await waitFor(() => {
      expect(mocks.fakeSession.resize).toHaveBeenCalledWith(320, 320, 1)
    })
    expect(mocks.fakeSession.renderNow).toHaveBeenCalled()
  })
})

describe('PixelAvatar3D — no fake-3D styling allowed', () => {
  const sources = [
    'PixelAvatar3D.tsx',
    'PixelAvatar3D.scss',
  ]

  for (const file of sources) {
    it(`${file} contains no rotateY/scaleX/perspective/mirror tricks`, () => {
      const source = readFileSync(path.resolve(__dirname, file), 'utf8')
      expect(source).not.toMatch(/rotateY/i)
      expect(source).not.toMatch(/scaleX/i)
      expect(source).not.toMatch(/perspective\s*\(/i)
      expect(source).not.toMatch(/matrix3d/i)
      expect(source).not.toContain('transform-style: preserve-3d')
    })
  }
})

import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EquipmentItem, EquipmentOutfit } from '../../lib/profile/equipmentApi'
import PixelAvatar3D from './PixelAvatar3D'

/**
 * Regression test for the weapp production availability gate.
 *
 * Taro's weapp compiler exports built-in components as string-like host
 * components (e.g. `Canvas === 'canvas'`), not function/class components.
 * The old `typeof Canvas === 'function' || typeof Canvas === 'object'` gate
 * rejected the string form, so the compiled
 * subpackages/profile-linked/three-avatar.js hard-coded every spider into the
 * `canvas-component-missing` fallback and tree-shook the real Canvas JSX to
 * null. This file models Canvas as a string host component (via a getter so
 * each test can swap the exported value before mounting) and proves the
 * spider enters boot, while null/undefined still falls back with the reason.
 */

const mocks = vi.hoisted(() => {
  const fakeSession = {
    yaw: 0,
    disposed: false,
    setYaw: vi.fn(),
    getYaw: vi.fn(() => 0),
    applyEquipment: vi.fn(),
    renderNow: vi.fn(() => true),
    resize: vi.fn(),
    raf: { request: vi.fn(() => 1), cancel: vi.fn() },
    getModel: vi.fn(),
    dispose: vi.fn(),
  }
  return {
    // Exactly what the weapp production compiler emits for built-ins.
    taroCanvas: { value: 'canvas' as unknown },
    fakeSession,
    queryAvatarCanvas: vi.fn(),
    canQueryAvatarCanvas: vi.fn(() => true),
    acquireWebGLContext: vi.fn(() => ({ tag: 'gl' })),
    resolvePixelRatio: vi.fn(() => 1),
    createAvatar3DSession: vi.fn(() => fakeSession),
  }
})

vi.mock('@tarojs/taro', () => ({
  __esModule: true,
  default: { createSelectorQuery: vi.fn() },
  useDidShow: vi.fn(),
  useDidHide: vi.fn(),
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, catchMove: _catchMove, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, userSelect: _userSelect, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, ...props }: any) => <img alt='' {...props} />,
  ScrollView: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  // Live getter: the component reads `typeof Canvas` at render time, so each
  // test can mount against a different exported value.
  get Canvas() {
    return mocks.taroCanvas.value
  },
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
  haptics: vi.fn(),
}))

vi.mock('../../lib/utils/logger', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
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

function makeOutfit(): EquipmentOutfit {
  return {
    topItemId: 'top-item',
    bottomItemId: 'bottom-item',
    shoesItemId: 'shoes-item',
    accessoryItemId: 'accessory-item',
    version: 1,
  } as EquipmentOutfit
}

function renderSpider(onStatusChange?: (report: { status: string; reason: string | null }) => void) {
  return render(
    <PixelAvatar3D
      archetypeId='spider'
      outfit={makeOutfit()}
      itemsById={ITEMS_BY_ID}
      onStatusChange={onStatusChange}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.taroCanvas.value = 'canvas'
  mocks.fakeSession.disposed = false
  mocks.canQueryAvatarCanvas.mockReturnValue(true)
  mocks.acquireWebGLContext.mockReturnValue({ tag: 'gl' })
  mocks.createAvatar3DSession.mockImplementation(() => mocks.fakeSession)
  mocks.queryAvatarCanvas.mockResolvedValue({
    node: { tag: 'wechat-canvas' },
    cssWidth: 320,
    cssHeight: 320,
  })
})

describe('PixelAvatar3D — weapp string-like host component Canvas (production regression)', () => {
  it("spider enters boot when Canvas is the weapp string host component 'canvas'", async () => {
    const onStatusChange = vi.fn()
    const { container } = renderSpider(onStatusChange)

    // The gate must accept the string form: the real Canvas JSX renders
    // (not tree-shaken to null) and the async boot path actually runs.
    expect(container.querySelector('canvas')).toBeTruthy()
    await waitFor(() => {
      expect(mocks.queryAvatarCanvas).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith({ status: 'ready', reason: null })
    })
    expect(onStatusChange).not.toHaveBeenCalledWith({ status: 'fallback', reason: 'canvas-component-missing' })
    expect(mocks.createAvatar3DSession).toHaveBeenCalled()
  })

  it.each([undefined, null])('still falls back with canvas-component-missing when Canvas is %s', (value) => {
    mocks.taroCanvas.value = value
    const onStatusChange = vi.fn()
    renderSpider(onStatusChange)

    // Synchronous gate — never reaches the async canvas query.
    expect(onStatusChange).toHaveBeenCalledWith({ status: 'fallback', reason: 'canvas-component-missing' })
    expect(mocks.queryAvatarCanvas).not.toHaveBeenCalled()
    expect(mocks.createAvatar3DSession).not.toHaveBeenCalled()
  })
})

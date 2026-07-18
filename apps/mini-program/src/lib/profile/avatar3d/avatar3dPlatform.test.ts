import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Unit tests for the avatar3d platform adapter. `@tarojs/taro` is mocked with
 * a mutable default export so each test can toggle the WeChat selector-query
 * API on/off; the DOM side runs against the real jsdom document.
 */

const mocks = vi.hoisted(() => ({
  taroDefault: {} as Record<string, any>,
}))

vi.mock('@tarojs/taro', () => ({
  __esModule: true,
  default: mocks.taroDefault,
}))

import { canQueryAvatarCanvas, queryAvatarCanvas } from './avatar3dPlatform'

function makeSelectorQuery(result: any) {
  const query: any = {
    select: vi.fn(),
    fields: vi.fn(),
    exec: vi.fn((callback: (value: any) => void) => callback(result)),
  }
  query.select.mockReturnValue(query)
  query.fields.mockReturnValue(query)
  return query
}

function makeRect(width: number, height: number): DOMRect {
  return { width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
}

beforeEach(() => {
  for (const key of Object.keys(mocks.taroDefault)) delete mocks.taroDefault[key]
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('canQueryAvatarCanvas', () => {
  it('is true when the WeChat selector-query API is available', () => {
    mocks.taroDefault.createSelectorQuery = vi.fn()
    expect(canQueryAvatarCanvas()).toBe(true)
  })

  it('is true in an H5 DOM environment even without the selector API', () => {
    // jsdom provides document.getElementById — no Taro selector API needed.
    expect(canQueryAvatarCanvas()).toBe(true)
  })

  it('is false when neither the selector API nor the DOM exists', () => {
    vi.stubGlobal('document', undefined)
    expect(canQueryAvatarCanvas()).toBe(false)
  })
})

describe('queryAvatarCanvas — WeChat selector path (preferred)', () => {
  it('resolves node + CSS size from the selector result and never touches the DOM', async () => {
    const node = { tag: 'wechat-canvas' }
    const query = makeSelectorQuery([{ node, width: 320, height: 240 }])
    mocks.taroDefault.createSelectorQuery = vi.fn(() => query)
    const getById = vi.spyOn(document, 'getElementById')

    const handle = await queryAvatarCanvas('avatar3d-canvas-1')

    expect(mocks.taroDefault.createSelectorQuery).toHaveBeenCalledTimes(1)
    expect(query.select).toHaveBeenCalledWith('#avatar3d-canvas-1')
    expect(getById).not.toHaveBeenCalled()
    expect(handle).toEqual({ node, cssWidth: 320, cssHeight: 240 })
  })

  it('resolves null when the selector finds no node', async () => {
    mocks.taroDefault.createSelectorQuery = vi.fn(() => makeSelectorQuery([null]))
    await expect(queryAvatarCanvas('missing-node')).resolves.toBeNull()
  })

  it('resolves null when the selector API throws', async () => {
    mocks.taroDefault.createSelectorQuery = vi.fn(() => {
      throw new Error('base library too old')
    })
    await expect(queryAvatarCanvas('boom')).resolves.toBeNull()
  })

  it('falls back to 300×300 when the reported size is invalid', async () => {
    const node = { tag: 'wechat-canvas' }
    mocks.taroDefault.createSelectorQuery = vi.fn(() => makeSelectorQuery([{ node, width: 0, height: -4 }]))
    const handle = await queryAvatarCanvas('odd-size')
    expect(handle).toEqual({ node, cssWidth: 300, cssHeight: 300 })
  })
})

describe('queryAvatarCanvas — H5 DOM fallback', () => {
  it('uses the element itself when it is canvas-like, sized by its bounding rect', async () => {
    const canvas = document.createElement('canvas')
    canvas.id = 'avatar3d-h5'
    canvas.getBoundingClientRect = () => makeRect(360, 540)
    document.body.appendChild(canvas)

    const handle = await queryAvatarCanvas('avatar3d-h5')

    expect(handle).toEqual({ node: canvas, cssWidth: 360, cssHeight: 540 })
  })

  it('descends into a nested canvas when the element is a wrapper', async () => {
    const wrapper = document.createElement('div')
    wrapper.id = 'avatar3d-wrapper'
    const inner = document.createElement('canvas')
    inner.getBoundingClientRect = () => makeRect(300, 320)
    wrapper.appendChild(inner)
    document.body.appendChild(wrapper)

    const handle = await queryAvatarCanvas('avatar3d-wrapper')

    expect(handle).toEqual({ node: inner, cssWidth: 300, cssHeight: 320 })
  })

  it('falls back to client size when the bounding rect is empty', async () => {
    const canvas = document.createElement('canvas')
    canvas.id = 'avatar3d-client'
    Object.defineProperty(canvas, 'clientWidth', { value: 280, configurable: true })
    Object.defineProperty(canvas, 'clientHeight', { value: 260, configurable: true })
    document.body.appendChild(canvas)
    // jsdom's getBoundingClientRect returns all zeros → client size takes over.
    const handle = await queryAvatarCanvas('avatar3d-client')

    expect(handle).toEqual({ node: canvas, cssWidth: 280, cssHeight: 260 })
  })

  it('defaults to 300×300 when no measurement is available', async () => {
    const canvas = document.createElement('canvas')
    canvas.id = 'avatar3d-unmeasured'
    document.body.appendChild(canvas)

    const handle = await queryAvatarCanvas('avatar3d-unmeasured')

    expect(handle).toEqual({ node: canvas, cssWidth: 300, cssHeight: 300 })
  })

  it('returns null when no element carries the id', async () => {
    await expect(queryAvatarCanvas('does-not-exist')).resolves.toBeNull()
  })

  it('returns null when the element has no canvas surface', async () => {
    const div = document.createElement('div')
    div.id = 'avatar3d-plain'
    document.body.appendChild(div)

    await expect(queryAvatarCanvas('avatar3d-plain')).resolves.toBeNull()
  })

  it('returns null safely when the DOM is unavailable', async () => {
    vi.stubGlobal('document', undefined)
    await expect(queryAvatarCanvas('anywhere')).resolves.toBeNull()
  })
})

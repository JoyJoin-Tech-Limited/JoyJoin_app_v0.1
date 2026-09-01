import { beforeEach, describe, expect, it, vi } from 'vitest'

const taroRuntime = vi.hoisted(() => ({
  onWindowResize: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: taroRuntime,
}))

async function importFreshHub() {
  vi.resetModules()
  return import('./windowResizeHub')
}

describe('subscribeWindowResize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers exactly one native listener no matter how many subscribers', async () => {
    const { subscribeWindowResize } = await importFreshHub()
    const unsubA = subscribeWindowResize(vi.fn())
    const unsubB = subscribeWindowResize(vi.fn())
    expect(taroRuntime.onWindowResize).toHaveBeenCalledTimes(1)
    unsubA()
    unsubB()
  })

  it('fans out a native resize event to all active subscribers', async () => {
    const { subscribeWindowResize } = await importFreshHub()
    const a = vi.fn()
    const b = vi.fn()
    const unsubA = subscribeWindowResize(a)
    const unsubB = subscribeWindowResize(b)
    const emit = taroRuntime.onWindowResize.mock.calls[0][0] as () => void
    emit()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    unsubA()
    emit()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(2)
    unsubB()
  })

  it('keeps sibling subscribers alive when one listener throws', async () => {
    const { subscribeWindowResize } = await importFreshHub()
    const bad = vi.fn(() => {
      throw new Error('boom')
    })
    const good = vi.fn()
    const unsubBad = subscribeWindowResize(bad)
    const unsubGood = subscribeWindowResize(good)
    const emit = taroRuntime.onWindowResize.mock.calls[0][0] as () => void
    expect(() => emit()).not.toThrow()
    expect(good).toHaveBeenCalledTimes(1)
    unsubBad()
    unsubGood()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { createCredentialScreenController, type CredentialScreenApi } from './useCredentialScreen'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

async function flush() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function api(overrides: Partial<CredentialScreenApi> = {}): CredentialScreenApi {
  return {
    getScreenBrightness: vi.fn().mockResolvedValue({ value: 0.4 }),
    setScreenBrightness: vi.fn().mockResolvedValue({}),
    setKeepScreenOn: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

describe('credential screen controller', () => {
  it('出示时读取原亮度、提亮到 0.9 并常亮；退出恢复', async () => {
    const a = api()
    const status = vi.fn()
    const c = createCredentialScreenController(a, status)
    await c.activate()
    expect(a.setScreenBrightness).toHaveBeenCalledWith({ value: 0.9 })
    expect(a.setKeepScreenOn).toHaveBeenCalledWith({ keepScreenOn: true })
    expect(status).toHaveBeenLastCalledWith('出示时已自动提亮 · 屏幕常亮')
    c.deactivate()
    await flush()
    expect(a.setScreenBrightness).toHaveBeenLastCalledWith({ value: 0.4 })
    expect(a.setKeepScreenOn).toHaveBeenLastCalledWith({ keepScreenOn: false })
    expect(status).toHaveBeenLastCalledWith('')
  })

  it('show → hide → show → hide 每次重读且恢复幂等', async () => {
    const a = api()
    const c = createCredentialScreenController(a, vi.fn())
    await c.activate()
    c.deactivate()
    await c.activate()
    c.deactivate()
    c.deactivate()
    await flush()
    expect(a.getScreenBrightness).toHaveBeenCalledTimes(2)
    expect(a.setKeepScreenOn).toHaveBeenCalledTimes(4)
    expect(a.setScreenBrightness).toHaveBeenLastCalledWith({ value: 0.4 })
  })

  it('hide 后 unload 不重复恢复', async () => {
    const a = api()
    const c = createCredentialScreenController(a, vi.fn())
    await c.activate()
    c.deactivate()
    c.destroy()
    await flush()
    expect(a.setScreenBrightness).toHaveBeenCalledTimes(2)
    expect(a.setKeepScreenOn).toHaveBeenCalledTimes(2)
  })

  it('H5/API 不存在时不显示提亮或常亮状态', async () => {
    const status = vi.fn()
    const c = createCredentialScreenController({}, status)
    await c.activate()
    c.deactivate()
    expect(status).toHaveBeenLastCalledWith('')
  })

  it('读取或设置 Promise rejection 都 fail-open 且不误报成功', async () => {
    const status = vi.fn()
    const c = createCredentialScreenController(api({
      getScreenBrightness: vi.fn().mockRejectedValue(new Error('denied')),
      setKeepScreenOn: vi.fn().mockRejectedValue(new Error('denied')),
    }), status)
    await c.activate()
    c.deactivate()
    expect(status).toHaveBeenLastCalledWith('')
  })

  it('setScreenBrightness rejection 也 fail-open，且常亮仍可独立恢复', async () => {
    const status = vi.fn()
    const a = api({ setScreenBrightness: vi.fn().mockRejectedValue(new Error('denied')) })
    const c = createCredentialScreenController(a, status)
    await c.activate()
    expect(status).toHaveBeenLastCalledWith('屏幕常亮')
    c.deactivate()
    await flush()
    expect(a.setKeepScreenOn).toHaveBeenLastCalledWith({ keepScreenOn: false })
  })

  it('deferred 读取未返回就隐藏：迟到回调不得再提亮或常亮', async () => {
    const pending = deferred<{ value: number }>()
    const a = api({ getScreenBrightness: vi.fn(() => pending.promise) })
    const c = createCredentialScreenController(a, vi.fn())
    const activating = c.activate()
    c.deactivate()
    pending.resolve({ value: 0.3 })
    await activating
    expect(a.setScreenBrightness).not.toHaveBeenCalled()
    expect(a.setKeepScreenOn).not.toHaveBeenCalled()
  })

  it('deferred 常亮未返回就隐藏：迟到成功后立即撤销', async () => {
    const pending = deferred<unknown>()
    const a = api({ setKeepScreenOn: vi.fn(() => pending.promise) })
    const c = createCredentialScreenController(a, vi.fn())
    const activating = c.activate()
    await flush()
    c.deactivate()
    pending.resolve({})
    await activating
    expect(a.setKeepScreenOn).toHaveBeenCalledWith({ keepScreenOn: false })
  })

  it('没有取得有效原亮度时不提亮也不擅自恢复', async () => {
    const a = api({ getScreenBrightness: vi.fn().mockResolvedValue({ value: 2 }) })
    const c = createCredentialScreenController(a, vi.fn())
    await c.activate()
    expect(a.setScreenBrightness).not.toHaveBeenCalled()
    c.deactivate()
    expect(a.setScreenBrightness).not.toHaveBeenCalled()
  })

  it('只有常亮成功时才显示常亮，不声称已提亮', async () => {
    const status = vi.fn()
    const c = createCredentialScreenController(api({
      getScreenBrightness: vi.fn().mockRejectedValue(new Error('no')),
    }), status)
    await c.activate()
    expect(status).toHaveBeenLastCalledWith('屏幕常亮')
  })
})

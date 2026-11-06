import Taro from '@tarojs/taro'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { showAppToast } from '../toast'

vi.mock('@tarojs/taro', () => ({
  default: {
    showToast: vi.fn(),
  },
}))

const mockShowToast = vi.mocked(Taro.showToast)

describe('showAppToast', () => {
  beforeEach(() => {
    mockShowToast.mockReset()
    mockShowToast.mockReturnValue(Promise.resolve({}) as never)
  })

  it('uses neutral defaults and returns the native Promise unchanged', () => {
    const nativePromise = Promise.resolve({ errMsg: 'showToast:ok' })
    mockShowToast.mockReturnValue(nativePromise as never)

    const result = showAppToast({ title: '已收到' })

    expect(result).toBe(nativePromise)
    expect(mockShowToast).toHaveBeenCalledWith({
      title: '已收到',
      icon: 'none',
      duration: 2000,
    })
  })

  it('provides success and error semantics from shared TOAST_* constants', () => {
    showAppToast({ title: '成功', tone: 'success' })
    showAppToast({ title: '失败', tone: 'error' })

    expect(mockShowToast).toHaveBeenNthCalledWith(1, {
      title: '成功',
      icon: 'success',
      duration: 1800,
    })
    expect(mockShowToast).toHaveBeenNthCalledWith(2, {
      title: '失败',
      icon: 'error',
      duration: 2600,
    })
  })

  it('forwards native options and lets explicit values override tone defaults', () => {
    showAppToast({
      title: '跳转失败，请重试',
      tone: 'error',
      icon: 'none',
      duration: 2000,
      mask: true,
      image: '/assets/example.png',
    })

    expect(mockShowToast).toHaveBeenCalledWith({
      title: '跳转失败，请重试',
      icon: 'none',
      duration: 2000,
      mask: true,
      image: '/assets/example.png',
    })
  })

  it('propagates native rejection without swallowing or rewriting it', async () => {
    mockShowToast.mockReturnValue(Promise.reject(new Error('native failed')) as never)

    await expect(showAppToast({ title: '失败' })).rejects.toThrow('native failed')
  })

  it('preserves rapid consecutive native calls without timers or queueing', () => {
    showAppToast({ title: '第一条' })
    showAppToast({ title: '第二条' })

    expect(mockShowToast).toHaveBeenCalledTimes(2)
    expect(mockShowToast.mock.calls.map((call) => call[0]?.title)).toEqual(['第一条', '第二条'])
  })

  it('passes long CJK copy through unchanged', () => {
    const title = '这是一段用于确认长中文提示在原生 Toast 中保持完整不变的测试文案'
    showAppToast({ title })

    expect(mockShowToast).toHaveBeenCalledWith({
      title,
      icon: 'none',
      duration: 2000,
    })
  })
})

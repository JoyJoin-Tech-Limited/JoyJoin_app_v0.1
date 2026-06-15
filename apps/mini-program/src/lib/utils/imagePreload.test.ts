import { describe, it, expect, vi, beforeEach } from 'vitest'
import Taro from '@tarojs/taro'
import { preloadImage, preloadImages } from './imagePreload'

describe('imagePreload', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(Taro, 'getImageInfo').mockImplementation((({ src, success }: any) => {
      success?.({ width: 100, height: 100, path: `tmp://${src}` })
      return Promise.resolve({ width: 100, height: 100, path: `tmp://${src}` })
    }) as any)
  })

  it('resolves true when getImageInfo succeeds', async () => {
    const result = await preloadImage('https://example.com/ok.webp')

    expect(result).toBe(true)
    expect(Taro.getImageInfo).toHaveBeenCalledWith(expect.objectContaining({ src: 'https://example.com/ok.webp' }))
  })

  it('resolves false when getImageInfo fails with 404', async () => {
    // WeChat/Taro may either invoke the fail callback or reject the promise.
    // Both paths must be handled without surfacing an unhandled rejection.
    vi.spyOn(Taro, 'getImageInfo').mockImplementation(({ fail }: any) => {
      fail?.({ errMsg: 'getImageInfo:fail image not found (404)' })
      return Promise.reject(new Error('getImageInfo:fail image not found (404)'))
    })

    const result = await preloadImage('https://example.com/missing.png')

    expect(result).toBe(false)
  })

  it('resolves false when getImageInfo rejects without calling fail', async () => {
    vi.spyOn(Taro, 'getImageInfo').mockRejectedValue(new Error('network offline'))

    const result = await preloadImage('https://example.com/reject.webp')

    expect(result).toBe(false)
  })

  it('resolves false for empty src without calling getImageInfo', async () => {
    vi.clearAllMocks()

    const result = await preloadImage('')

    expect(result).toBe(false)
    expect(Taro.getImageInfo).not.toHaveBeenCalled()
  })

  it('preloads a batch and reports individual failures', async () => {
    vi.spyOn(Taro, 'getImageInfo').mockImplementation((({ src, success, fail }: any) => {
      if (src.includes('bad')) {
        fail?.({ errMsg: 'not found' })
        return Promise.reject(new Error('not found'))
      }
      success?.({})
      return Promise.resolve({})
    }) as any)

    const results = await preloadImages(['good1.webp', 'bad.webp', 'good2.webp'])

    expect(results).toEqual([true, false, true])
  })
})

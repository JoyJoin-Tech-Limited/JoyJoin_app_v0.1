import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import Taro from '@tarojs/taro'
import { preloadOnboardingAssets, __resetOnboardingPreloadGuard } from './onboardingPreload'
import * as imagePreload from './imagePreload'

vi.mock('@tarojs/taro', () => ({
  default: {
    getNetworkType: vi.fn(),
    getSystemInfoSync: vi.fn(),
  },
}))

describe('onboardingPreload', () => {
  let preloadSpy: MockInstance<typeof imagePreload.preloadImagesWithDiagnostics>

  beforeEach(() => {
    vi.restoreAllMocks()
    preloadSpy = vi.spyOn(imagePreload, 'preloadImagesWithDiagnostics').mockResolvedValue(undefined)
    __resetOnboardingPreloadGuard()
    vi.useFakeTimers({ shouldAdvanceTime: false })
  })

  afterEach(() => {
    __resetOnboardingPreloadGuard()
    vi.useRealTimers()
  })

  it('is a one-shot operation', async () => {
    vi.spyOn(Taro, 'getNetworkType').mockResolvedValue({ networkType: 'wifi', signalStrength: 100 } as any)
    vi.spyOn(Taro, 'getSystemInfoSync').mockReturnValue({ benchmarkLevel: 30 } as any)

    await preloadOnboardingAssets()
    await preloadOnboardingAssets()
    vi.runAllTimers()

    // Three tiers should fire exactly once across both calls.
    const contexts = preloadSpy.mock.calls.map((call) => call[1] as string)
    expect(contexts.filter((c) => c === 'onboarding:critical').length).toBe(1)
    expect(contexts.filter((c) => c === 'onboarding:test-phase').length).toBe(1)
    expect(contexts.filter((c) => c === 'onboarding:heavy').length).toBe(1)
  })

  it('skips entirely on 2g network', async () => {
    vi.spyOn(Taro, 'getNetworkType').mockResolvedValue({ networkType: '2g' } as any)

    await preloadOnboardingAssets()
    vi.runAllTimers()

    expect(preloadSpy).not.toHaveBeenCalled()
  })

  it('skips heavy tier on low-end devices', async () => {
    vi.spyOn(Taro, 'getNetworkType').mockResolvedValue({ networkType: 'wifi' } as any)
    vi.spyOn(Taro, 'getSystemInfoSync').mockReturnValue({ benchmarkLevel: 10 } as any)

    await preloadOnboardingAssets()
    vi.runAllTimers()

    const contexts = preloadSpy.mock.calls.map((call) => call[1] as string)
    expect(contexts).toContain('onboarding:critical')
    expect(contexts).toContain('onboarding:test-phase')
    expect(contexts).not.toContain('onboarding:heavy')
  })

  it('runs heavy tier on capable devices with good network', async () => {
    vi.spyOn(Taro, 'getNetworkType').mockResolvedValue({ networkType: 'wifi' } as any)
    vi.spyOn(Taro, 'getSystemInfoSync').mockReturnValue({ benchmarkLevel: 30 } as any)

    await preloadOnboardingAssets()
    vi.runAllTimers()

    const contexts = preloadSpy.mock.calls.map((call) => call[1] as string)
    expect(contexts).toContain('onboarding:critical')
    expect(contexts).toContain('onboarding:test-phase')
    expect(contexts).toContain('onboarding:heavy')
  })

  it('clears pending timers when reset', async () => {
    vi.spyOn(Taro, 'getNetworkType').mockResolvedValue({ networkType: 'wifi' } as any)
    vi.spyOn(Taro, 'getSystemInfoSync').mockReturnValue({ benchmarkLevel: 30 } as any)

    await preloadOnboardingAssets()
    __resetOnboardingPreloadGuard()
    vi.runAllTimers()

    // Reset should cancel all pending timers so no preloads fire.
    expect(preloadSpy).not.toHaveBeenCalled()
  })
})

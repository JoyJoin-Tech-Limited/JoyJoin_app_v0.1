import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { preloadOnboardingAssets, __resetOnboardingPreloadGuard } from './onboardingPreload'

const { preloadMock, networkMock, systemInfoMock } = vi.hoisted(() => ({
  preloadMock: vi.fn(),
  networkMock: vi.fn(),
  systemInfoMock: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getNetworkType: networkMock,
    getSystemInfoSync: systemInfoMock,
  },
}))

vi.mock('./cdnAssets', () => ({
  CDN_BASE_URL: 'https://cdn.test',
  cdnAsset: (path: string) => `https://cdn.test${path}`,
  localAsset: (path: string) => path,
}))

vi.mock('./imagePreload', () => ({
  preloadImagesWithDiagnostics: preloadMock,
}))

describe('onboardingPreload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    preloadMock.mockResolvedValue(undefined)
    networkMock.mockResolvedValue({ networkType: 'wifi' })
    systemInfoMock.mockReturnValue({ benchmarkLevel: 30 })
    __resetOnboardingPreloadGuard()
    vi.useFakeTimers()
  })

  afterEach(() => {
    __resetOnboardingPreloadGuard()
    vi.useRealTimers()
  })

  it('schedules CDN tiers only once', async () => {
    await preloadOnboardingAssets()
    await preloadOnboardingAssets()
    await vi.runAllTimersAsync()

    const contexts = preloadMock.mock.calls.map((call) => call[1] as string)
    expect(contexts.filter((context) => context === 'onboarding:critical')).toHaveLength(1)
    expect(contexts.filter((context) => context === 'onboarding:test-phase')).toHaveLength(1)
    expect(contexts).not.toContain('onboarding:heavy')
    expect(networkMock).toHaveBeenCalledTimes(1)
  })

  it('skips entirely on 2g network', async () => {
    networkMock.mockResolvedValue({ networkType: '2g' })

    await preloadOnboardingAssets()
    await vi.runAllTimersAsync()

    expect(preloadMock).not.toHaveBeenCalled()
  })

  it('never sends bundled local heavy assets to the CDN image preloader', async () => {
    systemInfoMock.mockReturnValue({ benchmarkLevel: 30 })

    await preloadOnboardingAssets()
    await vi.runAllTimersAsync()

    const contexts = preloadMock.mock.calls.map((call) => call[1] as string)
    expect(contexts).toContain('onboarding:critical')
    expect(contexts).toContain('onboarding:test-phase')
    expect(contexts).not.toContain('onboarding:heavy')
  })

  it('clears pending timers when reset', async () => {
    await preloadOnboardingAssets()
    __resetOnboardingPreloadGuard()
    await vi.runAllTimersAsync()

    expect(preloadMock).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRecapSharePoster } from '../hooks/useRecapSharePoster'
import { generateRecapSharePoster } from '../recapSharePoster'
import { fetchShareQrCodeImage } from '../../../lib/referral/shareQrCode'
import { emitMomentCardAction } from '../momentCardTelemetry'
import { haptics } from '../../../lib/utils/haptics'

const h = vi.hoisted(() => {
  const lifecycle = {
    shows: [] as Array<() => void>,
    hides: [] as Array<() => void>,
  }
  const spies = {
    showToast: vi.fn(() => Promise.resolve({})),
    showModal: vi.fn(),
    showActionSheet: vi.fn(),
    getSetting: vi.fn(),
    openSetting: vi.fn(() => Promise.resolve({})),
    saveImageToPhotosAlbum: vi.fn(() => Promise.resolve({})),
    showShareImageMenu: vi.fn(),
    previewImage: vi.fn(() => Promise.resolve({})),
    getNetworkType: vi.fn(),
    unlinkSync: vi.fn(),
    useDidShow: vi.fn((cb: () => void) => {
      lifecycle.shows.push(cb)
    }),
    useDidHide: vi.fn((cb: () => void) => {
      lifecycle.hides.push(cb)
    }),
  }
  return { lifecycle, spies }
})

vi.mock('@tarojs/taro', () => {
  const taro = {
    showToast: h.spies.showToast,
    showModal: h.spies.showModal,
    showActionSheet: h.spies.showActionSheet,
    getSetting: h.spies.getSetting,
    openSetting: h.spies.openSetting,
    saveImageToPhotosAlbum: h.spies.saveImageToPhotosAlbum,
    showShareImageMenu: h.spies.showShareImageMenu,
    previewImage: h.spies.previewImage,
    getNetworkType: h.spies.getNetworkType,
    getFileSystemManager: () => ({ unlinkSync: h.spies.unlinkSync }),
  }
  return {
    default: taro,
    ...taro,
    useDidShow: h.spies.useDidShow,
    useDidHide: h.spies.useDidHide,
  }
})

vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))

vi.mock('../../../lib/referral/shareQrCode', () => ({
  fetchShareQrCodeImage: vi.fn(),
}))

vi.mock('../momentCardTelemetry', () => ({
  emitMomentCardAction: vi.fn(),
}))

vi.mock('../recapSharePoster', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../recapSharePoster')>()
  return { ...actual, generateRecapSharePoster: vi.fn() }
})

function buildInput(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    socialSessionId: 'social-1',
    tierName: '畅聊局',
    dateLabel: '2026.10.20',
    ownMedalTitle: '接梗王',
    highlightQuote: '今晚每个人都把最真的一面留在了桌上',
    tablemateArchetypeAssets: ['https://cdn.example.com/archetype-corgi.webp'],
    tablemateCount: 6,
    aigcLabelsEnabled: true,
    quoteAigc: true,
    ...overrides,
  }
}

const mockedGenerate = vi.mocked(generateRecapSharePoster)
const mockedQr = vi.mocked(fetchShareQrCodeImage)
const mockedEmit = vi.mocked(emitMomentCardAction)

describe('useRecapSharePoster — spec 规格一 AC-3/AC-6', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.lifecycle.shows.length = 0
    h.lifecycle.hides.length = 0
    h.spies.getNetworkType.mockResolvedValue({ networkType: 'wifi' })
    h.spies.getSetting.mockResolvedValue({ authSetting: { 'scope.writePhotosAlbum': true } })
    h.spies.showActionSheet.mockResolvedValue({ tapIndex: 0 })
    h.spies.showModal.mockResolvedValue({ confirm: true })
    h.spies.showShareImageMenu.mockResolvedValue({})
    mockedGenerate.mockResolvedValue('tmp://poster.png')
    mockedQr.mockResolvedValue('tmp://qr.png')
  })

  it('happy path (album): generates with privacy-shaped input, emits save, unlinks the QR temp file', async () => {
    const input = buildInput()
    const { result } = renderHook(() => useRecapSharePoster(input))

    await act(async () => {
      await result.current.handleShare()
    })

    expect(haptics).toHaveBeenCalledWith('light')
    expect(mockedGenerate).toHaveBeenCalledTimes(1)
    const genInput = mockedGenerate.mock.calls[0][0]
    expect(genInput.qrCodeImagePath).toBe('tmp://qr.png')
    expect(genInput.hasAigcLabel).toBe(true)
    // Structural privacy: only sanctioned keys cross the builder — no
    // displayName / userId / participants anywhere.
    expect(Object.keys(genInput).sort()).toEqual(
      [
        'dateLabel',
        'hasAigcLabel',
        'highlightQuote',
        'ownMedalTitle',
        'qrCodeImagePath',
        'tablemateArchetypeAssets',
        'tablemateCount',
        'tierName',
      ].sort(),
    )
    expect(h.spies.saveImageToPhotosAlbum).toHaveBeenCalledWith({ filePath: 'tmp://poster.png' })
    expect(mockedEmit).toHaveBeenCalledWith('social-1', 'save')
    expect(h.spies.unlinkSync).toHaveBeenCalledWith('tmp://qr.png')
    expect(result.current.isGenerating).toBe(false)
  })

  it('menu path emits share (menu invocation = shared; dismissal is not failure)', async () => {
    h.spies.showActionSheet.mockResolvedValue({ tapIndex: 1 })
    const { result } = renderHook(() => useRecapSharePoster(buildInput()))

    await act(async () => {
      await result.current.handleShare()
    })

    expect(h.spies.showShareImageMenu).toHaveBeenCalledWith({ path: 'tmp://poster.png' })
    expect(mockedEmit).toHaveBeenCalledWith('social-1', 'share')
    expect(mockedEmit).not.toHaveBeenCalledWith('social-1', 'save')
  })

  it('preview path presents the image without save/share telemetry', async () => {
    h.spies.showActionSheet.mockResolvedValue({ tapIndex: 2 })
    const { result } = renderHook(() => useRecapSharePoster(buildInput()))

    await act(async () => {
      await result.current.handleShare()
    })

    expect(h.spies.previewImage).toHaveBeenCalledWith({
      current: 'tmp://poster.png',
      urls: ['tmp://poster.png'],
    })
    expect(mockedEmit).not.toHaveBeenCalled()
  })

  it('offline pre-check blocks generation with a toast (AC-3)', async () => {
    h.spies.getNetworkType.mockResolvedValue({ networkType: 'none' })
    const { result } = renderHook(() => useRecapSharePoster(buildInput()))

    await act(async () => {
      await result.current.handleShare()
    })

    expect(mockedGenerate).not.toHaveBeenCalled()
    expect(h.spies.showToast).toHaveBeenCalled()
    expect(mockedEmit).not.toHaveBeenCalled()
  })

  it('album permission denial opens settings and skips the save (AC-3)', async () => {
    h.spies.getSetting.mockResolvedValue({ authSetting: { 'scope.writePhotosAlbum': false } })
    const { result } = renderHook(() => useRecapSharePoster(buildInput()))

    await act(async () => {
      await result.current.handleShare()
    })

    expect(h.spies.showModal).toHaveBeenCalled()
    expect(h.spies.openSetting).toHaveBeenCalledTimes(1)
    expect(h.spies.saveImageToPhotosAlbum).not.toHaveBeenCalled()
    expect(mockedEmit).not.toHaveBeenCalled()
  })

  it('ignores taps while disabled (flag off) — zero side effects', async () => {
    const { result } = renderHook(() => useRecapSharePoster(buildInput({ enabled: false })))

    await act(async () => {
      await result.current.handleShare()
    })

    expect(mockedGenerate).not.toHaveBeenCalled()
    expect(haptics).not.toHaveBeenCalled()
    expect(mockedEmit).not.toHaveBeenCalled()
  })

  it('double tap is guarded — one generation per burst', async () => {
    const { result } = renderHook(() => useRecapSharePoster(buildInput()))

    await act(async () => {
      const first = result.current.handleShare()
      const second = result.current.handleShare()
      await Promise.all([first, second])
    })

    expect(mockedGenerate).toHaveBeenCalledTimes(1)
  })

  it('generation failure toasts without telemetry; retry regenerates from scratch', async () => {
    mockedGenerate.mockRejectedValueOnce(new Error('canvas unavailable'))
    const { result } = renderHook(() => useRecapSharePoster(buildInput()))

    await act(async () => {
      await result.current.handleShare()
    })

    expect(h.spies.showToast).toHaveBeenCalled()
    expect(mockedEmit).not.toHaveBeenCalled()
    // The failure path shares the same finally — QR temp file is unlinked.
    expect(h.spies.unlinkSync).toHaveBeenCalledWith('tmp://qr.png')

    await act(async () => {
      await result.current.handleShare()
    })
    expect(mockedGenerate).toHaveBeenCalledTimes(2)
  })

  it('AIGC bake is fail-closed: quoteAigc=false → hasAigcLabel=false even with the label flag on', async () => {
    const { result } = renderHook(() =>
      useRecapSharePoster(buildInput({ aigcLabelsEnabled: true, quoteAigc: false })),
    )

    await act(async () => {
      await result.current.handleShare()
    })

    expect(mockedGenerate.mock.calls[0][0].hasAigcLabel).toBe(false)
  })
})

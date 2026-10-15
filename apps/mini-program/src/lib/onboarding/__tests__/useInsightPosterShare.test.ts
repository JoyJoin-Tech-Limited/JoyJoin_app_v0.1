import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ProfileTaglineEvidence, ProfileTaglineLine } from '@shared/ai/onboarding'
import { useInsightPosterShare, type InsightPosterAnalytics } from '../useInsightPosterShare'
import { generateInsightPoster } from '../insightPoster'
import { fetchShareQrCodeImage } from '../../referral/shareQrCode'
import { haptics } from '../../utils/haptics'

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

vi.mock('../../utils/haptics', () => ({ haptics: vi.fn() }))

vi.mock('../../referral/shareQrCode', () => ({
  fetchShareQrCodeImage: vi.fn(),
}))

vi.mock('../insightPoster', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../insightPoster')>()
  return { ...actual, generateInsightPoster: vi.fn() }
})

const LINES: ProfileTaglineLine[] = [
  { role: 'observation', text: '你把最多的热量给了探店和私厨', aigc: false },
  { role: 'inference', text: '你身上有种让人放松下来的节奏', aigc: true },
  { role: 'reveal', text: '慢热的人，其实是把认真留给了对的局', aigc: true },
]

const EVIDENCE: ProfileTaglineEvidence[] = [
  { text: '你选了「探店」', sourceRef: 'interest:tan-dian' },
]

function buildInput(overrides: Record<string, unknown> = {}) {
  const analytics: InsightPosterAnalytics = {
    interaction: vi.fn(),
    errorOccurred: vi.fn(),
  }
  return {
    enabled: true,
    analytics,
    displayName: '小悦',
    archetypeName: '社牛柯基',
    archetypeAsset: 'https://cdn.example.com/asset.webp',
    accentText: '#8B5CF6',
    lines: LINES,
    evidence: EVIDENCE,
    aigcLabelsEnabled: true,
    ...overrides,
  }
}

const mockedGenerate = vi.mocked(generateInsightPoster)
const mockedQr = vi.mocked(fetchShareQrCodeImage)

describe('useInsightPosterShare — AC-03 share flow + AC-04 telemetry', () => {
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

  it('happy path: generates, reports created + shared(album), unlinks the QR temp file', async () => {
    const input = buildInput()
    const { result } = renderHook(() => useInsightPosterShare(input))

    await act(async () => {
      await result.current.handleShare()
    })

    expect(haptics).toHaveBeenCalledWith('light')
    expect(mockedGenerate).toHaveBeenCalledTimes(1)
    const genInput = mockedGenerate.mock.calls[0][0]
    expect(genInput.displayName).toBe('小悦')
    expect(genInput.qrCodeImagePath).toBe('tmp://qr.png')
    expect(genInput.hasAigcLabel).toBe(true)
    // Structural + runtime privacy: only sanctioned keys cross the builder.
    expect(Object.keys(genInput).sort()).toEqual(
      [
        'accentText',
        'archetypeAsset',
        'archetypeName',
        'displayName',
        'evidence',
        'hasAigcLabel',
        'lines',
        'qrCodeImagePath',
      ].sort(),
    )

    expect(input.analytics.interaction).toHaveBeenCalledWith('insight_poster_created', {
      shape: 'v2',
      lineCount: 3,
      hasReveal: true,
      hasQr: true,
      aigcLabel: true,
    })
    expect(input.analytics.interaction).toHaveBeenCalledWith('insight_poster_shared', {
      shape: 'v2',
      lineCount: 3,
      hasReveal: true,
      hasQr: true,
      aigcLabel: true,
      option: 'album',
    })
    expect(h.spies.saveImageToPhotosAlbum).toHaveBeenCalledWith({ filePath: 'tmp://poster.png' })
    // QR temp file cleanup runs in the same finally as success (per-tap regen).
    expect(h.spies.unlinkSync).toHaveBeenCalledWith('tmp://qr.png')
    expect(result.current.isGenerating).toBe(false)
  })

  it('menu path reports shared with option menu', async () => {
    h.spies.showActionSheet.mockResolvedValue({ tapIndex: 1 })
    const input = buildInput()
    const { result } = renderHook(() => useInsightPosterShare(input))

    await act(async () => {
      await result.current.handleShare()
    })

    expect(h.spies.showShareImageMenu).toHaveBeenCalledWith({ path: 'tmp://poster.png' })
    expect(input.analytics.interaction).toHaveBeenCalledWith(
      'insight_poster_shared',
      expect.objectContaining({ option: 'menu', hasQr: true }),
    )
    expect(h.spies.saveImageToPhotosAlbum).not.toHaveBeenCalled()
  })

  it('preview path presents the image without shared telemetry', async () => {
    h.spies.showActionSheet.mockResolvedValue({ tapIndex: 2 })
    const input = buildInput()
    const { result } = renderHook(() => useInsightPosterShare(input))

    await act(async () => {
      await result.current.handleShare()
    })

    expect(h.spies.previewImage).toHaveBeenCalledWith({
      current: 'tmp://poster.png',
      urls: ['tmp://poster.png'],
    })
    expect(input.analytics.interaction).not.toHaveBeenCalledWith(
      'insight_poster_shared',
      expect.anything(),
    )
  })

  it('menu dismissal is not a failure (no shared event, no error)', async () => {
    h.spies.showActionSheet.mockResolvedValue({ tapIndex: 1 })
    h.spies.showShareImageMenu.mockRejectedValue(new Error('cancel'))
    const input = buildInput()
    const { result } = renderHook(() => useInsightPosterShare(input))

    await act(async () => {
      await result.current.handleShare()
    })

    expect(input.analytics.interaction).toHaveBeenCalledWith(
      'insight_poster_created',
      expect.anything(),
    )
    expect(input.analytics.interaction).not.toHaveBeenCalledWith(
      'insight_poster_shared',
      expect.anything(),
    )
    expect(input.analytics.errorOccurred).not.toHaveBeenCalled()
  })

  it('action-sheet dismissal is not a failure either', async () => {
    h.spies.showActionSheet.mockRejectedValue(new Error('cancel'))
    const input = buildInput()
    const { result } = renderHook(() => useInsightPosterShare(input))

    await act(async () => {
      await result.current.handleShare()
    })

    expect(input.analytics.errorOccurred).not.toHaveBeenCalled()
    expect(input.analytics.interaction).not.toHaveBeenCalledWith(
      'insight_poster_shared',
      expect.anything(),
    )
  })

  it('generation failure reports via errorOccurred and allows a retry', async () => {
    mockedGenerate.mockRejectedValueOnce(new Error('canvas unavailable'))
    const input = buildInput()
    const { result } = renderHook(() => useInsightPosterShare(input))

    await act(async () => {
      await result.current.handleShare()
    })

    expect(input.analytics.errorOccurred).toHaveBeenCalledWith(
      'insight_poster_failed',
      'canvas unavailable',
    )
    expect(h.spies.showToast).toHaveBeenCalled()
    expect(h.spies.showActionSheet).not.toHaveBeenCalled()
    // G1: the failure path shares the same finally — QR temp file is unlinked
    // even when generation itself failed.
    expect(h.spies.unlinkSync).toHaveBeenCalledWith('tmp://qr.png')
    // Retry: a second tap regenerates from scratch (no temp-file reuse).
    await act(async () => {
      await result.current.handleShare()
    })
    expect(mockedGenerate).toHaveBeenCalledTimes(2)
    // Both attempts cleaned up their own QR temp file.
    expect(h.spies.unlinkSync).toHaveBeenCalledTimes(2)
  })

  it('album permission denial opens settings and skips the save', async () => {
    h.spies.getSetting.mockResolvedValue({ authSetting: { 'scope.writePhotosAlbum': false } })
    const input = buildInput()
    const { result } = renderHook(() => useInsightPosterShare(input))

    await act(async () => {
      await result.current.handleShare()
    })

    expect(h.spies.showModal).toHaveBeenCalled()
    expect(h.spies.openSetting).toHaveBeenCalledTimes(1)
    expect(h.spies.saveImageToPhotosAlbum).not.toHaveBeenCalled()
    expect(input.analytics.interaction).not.toHaveBeenCalledWith(
      'insight_poster_shared',
      expect.anything(),
    )
  })

  it('album permission denial with cancel does not open settings', async () => {
    h.spies.getSetting.mockResolvedValue({ authSetting: { 'scope.writePhotosAlbum': false } })
    h.spies.showModal.mockResolvedValue({ confirm: false })
    const input = buildInput()
    const { result } = renderHook(() => useInsightPosterShare(input))

    await act(async () => {
      await result.current.handleShare()
    })

    expect(h.spies.openSetting).not.toHaveBeenCalled()
  })

  it('double tap is guarded — one generation per burst', async () => {
    const input = buildInput()
    const { result } = renderHook(() => useInsightPosterShare(input))

    await act(async () => {
      const first = result.current.handleShare()
      const second = result.current.handleShare()
      await Promise.all([first, second])
    })

    expect(mockedGenerate).toHaveBeenCalledTimes(1)
  })

  it('offline pre-check blocks generation with a toast', async () => {
    h.spies.getNetworkType.mockResolvedValue({ networkType: 'none' })
    const input = buildInput()
    const { result } = renderHook(() => useInsightPosterShare(input))

    await act(async () => {
      await result.current.handleShare()
    })

    expect(mockedGenerate).not.toHaveBeenCalled()
    expect(h.spies.showToast).toHaveBeenCalled()
    expect(input.analytics.interaction).not.toHaveBeenCalled()
  })

  it('leave-page race: settles silently, still unlinks the QR temp file', async () => {
    let resolveGenerate: (value: string) => void = () => {}
    mockedGenerate.mockImplementation(
      () => new Promise<string>((resolve) => {
        resolveGenerate = resolve
      }),
    )
    const input = buildInput()
    const { result } = renderHook(() => useInsightPosterShare(input))

    let sharePromise: Promise<void> = Promise.resolve()
    await act(async () => {
      sharePromise = result.current.handleShare()
      // Flush the QR fetch chain so the builder call is in flight.
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(mockedGenerate).toHaveBeenCalledTimes(1)
    expect(result.current.isGenerating).toBe(true)

    // Page hides mid-generation.
    act(() => {
      h.lifecycle.hides.forEach((cb) => cb())
    })

    await act(async () => {
      resolveGenerate('tmp://poster.png')
      await sharePromise
    })

    // No post-hide UI surfaced, but cleanup still ran.
    expect(h.spies.showActionSheet).not.toHaveBeenCalled()
    expect(h.spies.unlinkSync).toHaveBeenCalledWith('tmp://qr.png')
  })

  it('telemetry metadata is anonymous — no identity keys or values', async () => {
    const input = buildInput()
    const { result } = renderHook(() => useInsightPosterShare(input))

    await act(async () => {
      await result.current.handleShare()
    })

    const allowedKeys = new Set(['shape', 'lineCount', 'hasReveal', 'hasQr', 'aigcLabel', 'option'])
    const interactionMock = vi.mocked(input.analytics.interaction)
    expect(interactionMock).toHaveBeenCalled()
    for (const call of interactionMock.mock.calls) {
      const meta = (call[1] ?? {}) as Record<string, unknown>
      for (const key of Object.keys(meta)) {
        expect(allowedKeys.has(key)).toBe(true)
      }
      const serialized = JSON.stringify(meta)
      expect(serialized).not.toContain('小悦')
      expect(serialized).not.toContain('userId')
      expect(serialized).not.toContain('openId')
    }
  })

  it('QR failure still produces the poster with hasQr=false', async () => {
    mockedQr.mockResolvedValue(undefined)
    const input = buildInput()
    const { result } = renderHook(() => useInsightPosterShare(input))

    await act(async () => {
      await result.current.handleShare()
    })

    expect(mockedGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ qrCodeImagePath: undefined }),
    )
    expect(input.analytics.interaction).toHaveBeenCalledWith(
      'insight_poster_created',
      expect.objectContaining({ hasQr: false }),
    )
    expect(h.spies.unlinkSync).not.toHaveBeenCalled()
    expect(h.spies.showActionSheet).toHaveBeenCalled()
  })

  it('ignores taps while the entry is not enabled', async () => {
    const input = buildInput({ enabled: false })
    const { result } = renderHook(() => useInsightPosterShare(input))

    await act(async () => {
      await result.current.handleShare()
    })

    expect(mockedGenerate).not.toHaveBeenCalled()
    expect(haptics).not.toHaveBeenCalled()
  })

  it('falls back to the 2-item sheet when the native share menu is unavailable', async () => {
    const taroModule = (await import('@tarojs/taro')).default as { showShareImageMenu?: unknown }
    const original = taroModule.showShareImageMenu
    taroModule.showShareImageMenu = undefined
    try {
      h.spies.showActionSheet.mockResolvedValue({ tapIndex: 1 })
      const input = buildInput()
      const { result } = renderHook(() => useInsightPosterShare(input))

      await act(async () => {
        await result.current.handleShare()
      })

      expect(h.spies.showActionSheet).toHaveBeenCalledWith({
        itemList: ['保存到相册', '预览'],
      })
      expect(h.spies.previewImage).toHaveBeenCalled()
    } finally {
      taroModule.showShareImageMenu = original
    }
  })
})

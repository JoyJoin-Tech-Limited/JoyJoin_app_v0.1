import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArchetypeCardVariant } from '../archetypeVariants'
import type { ArchetypeVisual } from '../visuals'
import { fetchShareQrCodeImage } from '../../../../lib/referral/shareQrCode'
import { generatePersonalitySquarePoster } from '../../../../lib/utils/momentsPosterFactory'
import { generatePersonalitySharePoster } from './sharePoster'
import { resolveCurrentCanvasImage } from './resultHelpers'
import {
  useResultShareActions,
  type ResultShareActionsDeps,
} from './useResultShareActions'

vi.mock('../../../../lib/referral/shareQrCode', () => ({
  fetchShareQrCodeImage: vi.fn(),
}))
vi.mock('../../../../lib/utils/momentsPosterFactory', () => ({
  generatePersonalitySquarePoster: vi.fn(),
}))
vi.mock('./sharePoster', () => ({
  generatePersonalitySharePoster: vi.fn(),
}))
vi.mock('./resultHelpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./resultHelpers')>()),
  resolveCurrentCanvasImage: vi.fn(),
}))
vi.mock('../../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))
vi.mock('../../../../lib/utils/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

type MockTaro = {
  getNetworkType: ReturnType<typeof vi.fn>
  getSetting: ReturnType<typeof vi.fn>
  openSetting: ReturnType<typeof vi.fn>
  saveImageToPhotosAlbum: ReturnType<typeof vi.fn>
  showActionSheet: ReturnType<typeof vi.fn>
  previewImage: ReturnType<typeof vi.fn>
  showShareImageMenu?: ReturnType<typeof vi.fn>
  getFileSystemManager: ReturnType<typeof vi.fn>
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function createDeps(overrides: Partial<ResultShareActionsDeps> = {}): ResultShareActionsDeps {
  const visual = {
    asset: 'https://cdn.test/corgi.webp',
    assetPng: 'https://cdn.test/corgi.png',
    tagline: '把快乐带到每一桌',
    description: '温暖又真诚',
    summary: '开心柯基 summary',
    accent: '#8B5CF6',
    accentSoft: '#EDE9FE',
    rarityPercentage: 8,
  } as unknown as ArchetypeVisual
  const variants = [{
    name: '经典',
    accentColor: '#8B5CF6',
    accentSoft: '#EDE9FE',
  }] as unknown as ArchetypeCardVariant[]

  return {
    displayArchetype: 'corgi',
    displayArchetypeName: '开心柯基',
    displayAsset: '/pages/onboarding/assets/archetype-corgi.webp',
    visual,
    variants,
    shareLine: '快乐会传染',
    summary: '开心柯基 summary',
    traitEntries: [{ key: 'P', label: '快乐值', value: 88 }],
    skillSet: undefined,
    typicalityLabel: undefined,
    energyLevel: 4,
    archetypeRank: 1,
    serialNumber: '#10001',
    deviceTier: { isDegradation: false },
    shareAnimatedClipEnabled: false,
    analytics: {
      interaction: vi.fn(),
      errorOccurred: vi.fn(),
    } as unknown as ResultShareActionsDeps['analytics'],
    user: { id: 'user-a' } as unknown as ResultShareActionsDeps['user'],
    preResolvedImageRef: { current: null },
    ...overrides,
  }
}

function toastTitles() {
  return vi.mocked(Taro.showToast).mock.calls.map(([options]) => String(options?.title ?? ''))
}

function expectNoGenerationFailure(deps: ResultShareActionsDeps) {
  expect(deps.analytics.errorOccurred).not.toHaveBeenCalled()
  expect(toastTitles()).not.toContain('卡片生成遇到小状况，再试试~')
  expect(toastTitles()).not.toContain('正在重试...')
}

async function flushMicrotasks() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve()
}

describe('useResultShareActions poster sharing', () => {
  let hide: () => void
  let show: () => void
  let taro: MockTaro
  let accessSync: ReturnType<typeof vi.fn>
  let unlinkSync: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetAllMocks()
    hide = () => {}
    show = () => {}
    vi.mocked(useDidHide).mockImplementation((callback) => { hide = callback })
    vi.mocked(useDidShow).mockImplementation((callback) => { show = callback })

    accessSync = vi.fn()
    unlinkSync = vi.fn()
    taro = Taro as unknown as MockTaro
    taro.getNetworkType = vi.fn().mockResolvedValue({ networkType: 'wifi' })
    taro.getSetting = vi.fn().mockResolvedValue({
      authSetting: { 'scope.writePhotosAlbum': true },
    })
    taro.openSetting = vi.fn().mockResolvedValue({})
    taro.saveImageToPhotosAlbum = vi.fn().mockResolvedValue({})
    taro.showActionSheet = vi.fn().mockRejectedValue({ errMsg: 'showActionSheet:fail cancel' })
    taro.previewImage = vi.fn().mockResolvedValue({})
    delete taro.showShareImageMenu
    taro.getFileSystemManager = vi.fn().mockReturnValue({ accessSync, unlinkSync })
    vi.mocked(Taro.showToast).mockResolvedValue({ errMsg: 'showToast:ok' })
    vi.mocked(Taro.showModal).mockResolvedValue({ confirm: true, cancel: false, errMsg: 'showModal:ok' })

    vi.mocked(resolveCurrentCanvasImage).mockImplementation(async (asset) => ({
      asset,
      path: 'tmp://resolved-corgi',
      width: 100,
      height: 100,
    }))
    vi.mocked(fetchShareQrCodeImage).mockResolvedValue('tmp://qr')
    vi.mocked(generatePersonalitySharePoster).mockResolvedValue('tmp://portrait-a')
    vi.mocked(generatePersonalitySquarePoster).mockResolvedValue('tmp://square-a')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('treats ActionSheet dismissal as neutral', async () => {
    const deps = createDeps({ deviceTier: { isDegradation: true } })
    const { result } = renderHook(() => useResultShareActions(deps))

    await act(async () => { await result.current.handleGeneratePoster() })

    expect(result.current.sharePosterPath).toBe('tmp://portrait-a')
    expect(result.current.posterError).toBe(false)
    expect(deps.analytics.interaction).toHaveBeenCalledWith('share_action_dismissed', {
      primaryArchetype: '开心柯基',
    })
    expectNoGenerationFailure(deps)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('treats native share cancellation as neutral and does not retry generation', async () => {
    const deps = createDeps({ deviceTier: { isDegradation: true } })
    taro.showShareImageMenu = vi.fn().mockRejectedValue({ errMsg: 'showShareImageMenu:fail cancel' })
    taro.showActionSheet.mockResolvedValue({ tapIndex: 1 })
    const { result } = renderHook(() => useResultShareActions(deps))

    await act(async () => { await result.current.handleGeneratePoster() })
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000) })

    expect(result.current.posterError).toBe(false)
    expect(generatePersonalitySharePoster).toHaveBeenCalledTimes(1)
    expectNoGenerationFailure(deps)
  })

  it('treats preview cancellation as neutral', async () => {
    const deps = createDeps({ deviceTier: { isDegradation: true } })
    taro.showActionSheet.mockResolvedValue({ tapIndex: 1 })
    taro.previewImage.mockRejectedValue({ errMsg: 'previewImage:fail cancel' })
    const { result } = renderHook(() => useResultShareActions(deps))

    await act(async () => { await result.current.handleGeneratePoster() })

    expect(result.current.posterError).toBe(false)
    expect(taro.previewImage).toHaveBeenCalledTimes(1)
    expectNoGenerationFailure(deps)
    expect(generatePersonalitySharePoster).toHaveBeenCalledTimes(1)
  })

  it('resumes the same pending save after settings grant without another tap', async () => {
    const deps = createDeps({ deviceTier: { isDegradation: true } })
    taro.showActionSheet.mockResolvedValue({ tapIndex: 0 })
    taro.getSetting
      .mockResolvedValueOnce({ authSetting: { 'scope.writePhotosAlbum': false } })
      .mockResolvedValueOnce({ authSetting: { 'scope.writePhotosAlbum': true } })
    const { result } = renderHook(() => useResultShareActions(deps))

    await act(async () => { await result.current.handleGeneratePoster() })

    expect(taro.openSetting).toHaveBeenCalledTimes(1)
    expect(taro.getSetting).toHaveBeenCalledTimes(2)
    expect(taro.saveImageToPhotosAlbum).toHaveBeenCalledTimes(1)
    expect(taro.saveImageToPhotosAlbum).toHaveBeenCalledWith({ filePath: 'tmp://portrait-a' })
    expect(unlinkSync).not.toHaveBeenCalledWith('tmp://portrait-a')
    expect(result.current.posterError).toBe(false)
  })

  it('rechecks and resumes after the save API itself reports album denial', async () => {
    const deps = createDeps({ deviceTier: { isDegradation: true } })
    taro.showActionSheet.mockResolvedValue({ tapIndex: 0 })
    taro.saveImageToPhotosAlbum
      .mockRejectedValueOnce({ errMsg: 'saveImageToPhotosAlbum:fail auth deny' })
      .mockResolvedValueOnce({})
    taro.getSetting.mockResolvedValue({
      authSetting: { 'scope.writePhotosAlbum': true },
    })
    const { result } = renderHook(() => useResultShareActions(deps))

    await act(async () => { await result.current.handleGeneratePoster() })

    expect(taro.openSetting).toHaveBeenCalledTimes(1)
    expect(taro.saveImageToPhotosAlbum).toHaveBeenCalledTimes(2)
    expect(taro.saveImageToPhotosAlbum).toHaveBeenNthCalledWith(2, { filePath: 'tmp://portrait-a' })
    expectNoGenerationFailure(deps)
  })

  it('keeps permission cancellation retryable without regenerating or showing failure UI', async () => {
    const deps = createDeps({ deviceTier: { isDegradation: true } })
    taro.showActionSheet.mockResolvedValue({ tapIndex: 0 })
    taro.getSetting.mockResolvedValue({ authSetting: { 'scope.writePhotosAlbum': false } })
    vi.mocked(Taro.showModal).mockResolvedValueOnce({
      confirm: false,
      cancel: true,
      errMsg: 'showModal:cancel',
    })
    const { result } = renderHook(() => useResultShareActions(deps))

    await act(async () => { await result.current.handleGeneratePoster() })
    expect(taro.saveImageToPhotosAlbum).not.toHaveBeenCalled()
    expect(result.current.posterError).toBe(false)
    expectNoGenerationFailure(deps)

    taro.getSetting.mockResolvedValue({ authSetting: { 'scope.writePhotosAlbum': true } })
    await act(async () => { await result.current.handleGeneratePoster() })

    expect(generatePersonalitySharePoster).toHaveBeenCalledTimes(1)
    expect(fetchShareQrCodeImage).toHaveBeenCalledTimes(1)
    expect(taro.saveImageToPhotosAlbum).toHaveBeenCalledWith({ filePath: 'tmp://portrait-a' })
  })

  it('reuses live cached posters without QR fetch or redraw and rebuilds only a missing portrait', async () => {
    const deps = createDeps()
    const { result } = renderHook(() => useResultShareActions(deps))

    await act(async () => { await result.current.handleGeneratePoster() })
    await act(async () => { await result.current.handleGeneratePoster() })
    expect(generatePersonalitySharePoster).toHaveBeenCalledTimes(1)
    expect(generatePersonalitySquarePoster).toHaveBeenCalledTimes(1)
    expect(fetchShareQrCodeImage).toHaveBeenCalledTimes(1)

    accessSync.mockImplementation((path: string) => {
      if (path === 'tmp://portrait-a') throw new Error('missing')
    })
    await act(async () => { await result.current.handleGeneratePoster() })

    expect(generatePersonalitySharePoster).toHaveBeenCalledTimes(2)
    expect(generatePersonalitySquarePoster).toHaveBeenCalledTimes(1)
    expect(result.current.squarePosterPath).toBe('tmp://square-a')
  })

  it('keeps portrait success independent from square failure', async () => {
    const deps = createDeps()
    vi.mocked(generatePersonalitySquarePoster).mockRejectedValue(new Error('square render failed'))
    const { result } = renderHook(() => useResultShareActions(deps))

    await act(async () => { await result.current.handleGeneratePoster() })

    expect(result.current.sharePosterPath).toBe('tmp://portrait-a')
    expect(result.current.squarePosterPath).toBe('')
    expect(result.current.posterError).toBe(false)
    expect(taro.showActionSheet.mock.calls[0][0].itemList).not.toContain('保存朋友圈卡片')
    expectNoGenerationFailure(deps)
  })

  it('generates without QR offline when pre-resolved art is usable', async () => {
    const preResolvedImageRef: ResultShareActionsDeps['preResolvedImageRef'] = {
      current: { asset: 'corgi', path: 'tmp://offline-art' },
    }
    const deps = createDeps({ preResolvedImageRef, deviceTier: { isDegradation: true } })
    taro.getNetworkType.mockResolvedValue({ networkType: 'none' })
    vi.mocked(resolveCurrentCanvasImage).mockResolvedValue(preResolvedImageRef.current!)
    const { result } = renderHook(() => useResultShareActions(deps))

    await act(async () => { await result.current.handleGeneratePoster() })

    expect(fetchShareQrCodeImage).not.toHaveBeenCalled()
    expect(generatePersonalitySharePoster).toHaveBeenCalledWith(expect.objectContaining({
      preResolvedImagePath: 'tmp://offline-art',
      qrCodeImagePath: undefined,
    }))
    expect(result.current.sharePosterPath).toBe('tmp://portrait-a')
    expect(result.current.posterError).toBe(false)
  })

  it('fails honestly offline when no usable art can be resolved', async () => {
    const deps = createDeps({ deviceTier: { isDegradation: true } })
    taro.getNetworkType.mockResolvedValue({ networkType: 'none' })
    vi.mocked(resolveCurrentCanvasImage).mockRejectedValue(new Error('Unable to resolve canvas image'))
    const { result } = renderHook(() => useResultShareActions(deps))

    await act(async () => { await result.current.handleGeneratePoster() })

    expect(fetchShareQrCodeImage).not.toHaveBeenCalled()
    expect(generatePersonalitySharePoster).not.toHaveBeenCalled()
    expect(taro.showActionSheet).not.toHaveBeenCalled()
    expect(result.current.posterError).toBe(true)
    expect(toastTitles()).toContain('卡片生成遇到小状况，再试试~')
  })

  it('does not let an older generation replace a newer result and cleans its late file', async () => {
    const first = deferred<string>()
    vi.mocked(generatePersonalitySharePoster)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce('tmp://portrait-b')
    const initial = createDeps({ deviceTier: { isDegradation: true } })
    const { result, rerender } = renderHook(
      (props: ResultShareActionsDeps) => useResultShareActions(props),
      { initialProps: initial },
    )

    let firstRun!: Promise<void>
    act(() => { firstRun = result.current.handleGeneratePoster() })
    await act(flushMicrotasks)
    expect(generatePersonalitySharePoster).toHaveBeenCalledTimes(1)

    act(() => { hide() })
    act(() => { show() })
    rerender(createDeps({ displayArchetypeName: '太阳鸡', shareLine: '新的结果', deviceTier: { isDegradation: true } }))
    await act(async () => { await result.current.handleGeneratePoster() })
    expect(result.current.sharePosterPath).toBe('tmp://portrait-b')

    await act(async () => {
      first.resolve('tmp://portrait-late-a')
      await firstRun
    })
    expect(result.current.sharePosterPath).toBe('tmp://portrait-b')
    expect(unlinkSync).toHaveBeenCalledWith('tmp://portrait-late-a')
    expect(taro.showActionSheet).toHaveBeenCalledTimes(1)
  })

  it('cleans a late file without UI after unmount', async () => {
    const pending = deferred<string>()
    vi.mocked(generatePersonalitySharePoster).mockReturnValue(pending.promise)
    const deps = createDeps({ deviceTier: { isDegradation: true } })
    const { result, unmount } = renderHook(() => useResultShareActions(deps))

    let run!: Promise<void>
    act(() => { run = result.current.handleGeneratePoster() })
    await act(flushMicrotasks)
    unmount()
    await act(async () => {
      pending.resolve('tmp://portrait-after-unmount')
      await run
    })

    expect(unlinkSync).toHaveBeenCalledWith('tmp://portrait-after-unmount')
    expect(taro.showActionSheet).not.toHaveBeenCalled()
    expect(toastTitles()).not.toContain('氛围卡已生成')
  })

  it.each(['hide', 'unmount'] as const)('cancels a pending retry on %s', async (lifecycle) => {
    vi.mocked(generatePersonalitySharePoster)
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce('tmp://portrait-retry')
    const deps = createDeps({ deviceTier: { isDegradation: true } })
    const { result, unmount } = renderHook(() => useResultShareActions(deps))

    let run!: Promise<void>
    act(() => { run = result.current.handleGeneratePoster() })
    await act(flushMicrotasks)
    expect(generatePersonalitySharePoster).toHaveBeenCalledTimes(1)

    if (lifecycle === 'hide') act(() => { hide() })
    else unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
      await run
    })

    expect(generatePersonalitySharePoster).toHaveBeenCalledTimes(1)
    expect(taro.showActionSheet).not.toHaveBeenCalled()
    expect(deps.analytics.errorOccurred).not.toHaveBeenCalled()
  })

  it('retries transient generation once only', async () => {
    vi.mocked(generatePersonalitySharePoster).mockRejectedValue(new Error('network timeout'))
    const deps = createDeps({ deviceTier: { isDegradation: true } })
    const { result } = renderHook(() => useResultShareActions(deps))

    let run!: Promise<void>
    act(() => { run = result.current.handleGeneratePoster() })
    await act(flushMicrotasks)
    await act(async () => { await vi.advanceTimersByTimeAsync(1_500) })
    await act(async () => { await run })

    expect(generatePersonalitySharePoster).toHaveBeenCalledTimes(2)
    expect(deps.analytics.errorOccurred).toHaveBeenCalledTimes(1)
    expect(result.current.posterError).toBe(true)
  })

  it('keeps a pending settings save file alive across invalidation until the action settles', async () => {
    const settings = deferred<Record<string, never>>()
    const deps = createDeps({ deviceTier: { isDegradation: true } })
    taro.showActionSheet.mockResolvedValue({ tapIndex: 0 })
    taro.getSetting
      .mockResolvedValueOnce({ authSetting: { 'scope.writePhotosAlbum': false } })
      .mockResolvedValueOnce({ authSetting: { 'scope.writePhotosAlbum': true } })
    taro.openSetting.mockReturnValue(settings.promise)
    const { result, rerender } = renderHook(
      (props: ResultShareActionsDeps) => useResultShareActions(props),
      { initialProps: deps },
    )

    let run!: Promise<void>
    act(() => { run = result.current.handleGeneratePoster() })
    await act(flushMicrotasks)
    expect(taro.openSetting).toHaveBeenCalledTimes(1)

    rerender(createDeps({ shareLine: '替换海报', deviceTier: { isDegradation: true } }))
    expect(unlinkSync).not.toHaveBeenCalledWith('tmp://portrait-a')

    await act(async () => {
      settings.resolve({})
      await run
    })
    expect(taro.saveImageToPhotosAlbum).toHaveBeenCalledWith({ filePath: 'tmp://portrait-a' })
    expect(unlinkSync).toHaveBeenCalledWith('tmp://portrait-a')
  })

  it('passes absent skills and optional content to both generators without invented copy', async () => {
    const base = createDeps()
    const deps = createDeps({
      visual: { ...base.visual, rarityPercentage: null },
      skillSet: undefined,
      typicalityLabel: undefined,
      energyLevel: undefined,
      traitEntries: [],
    })
    const { result } = renderHook(() => useResultShareActions(deps))

    await act(async () => { await result.current.handleGeneratePoster() })

    const portraitInput = vi.mocked(generatePersonalitySharePoster).mock.calls[0][0]
    expect(portraitInput).toMatchObject({
      activeSkillTitle: '',
      activeSkillEffect: '',
      passiveSkillTitle: '',
      passiveSkillEffect: '',
      confidenceLabel: undefined,
      rarityLabel: undefined,
      energyLevel: undefined,
    })

    const squareInput = vi.mocked(generatePersonalitySquarePoster).mock.calls[0][0]
    expect(squareInput).toMatchObject({
      skillSet: undefined,
      typicalityChip: undefined,
      energyLevel: undefined,
      traitEntries: [],
    })
  })

  it('keeps cached files beyond 60 seconds and cleans both on unmount', async () => {
    const deps = createDeps()
    const { result, unmount } = renderHook(() => useResultShareActions(deps))
    await act(async () => { await result.current.handleGeneratePoster() })
    unlinkSync.mockClear()

    await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
    expect(unlinkSync).not.toHaveBeenCalledWith('tmp://portrait-a')
    expect(unlinkSync).not.toHaveBeenCalledWith('tmp://square-a')

    unmount()
    expect(unlinkSync).toHaveBeenCalledWith('tmp://portrait-a')
    expect(unlinkSync).toHaveBeenCalledWith('tmp://square-a')
  })

  it('invalidates and regenerates only the square when square-only traits change', async () => {
    const initial = createDeps()
    const { result, rerender } = renderHook(
      (props: ResultShareActionsDeps) => useResultShareActions(props),
      { initialProps: initial },
    )
    await act(async () => { await result.current.handleGeneratePoster() })

    rerender(createDeps({
      traitEntries: [{ key: 'P', label: '快乐值', value: 99 }],
      preResolvedImageRef: initial.preResolvedImageRef,
    }))
    expect(unlinkSync).not.toHaveBeenCalledWith('tmp://portrait-a')
    expect(unlinkSync).toHaveBeenCalledWith('tmp://square-a')

    await act(async () => { await result.current.handleGeneratePoster() })
    expect(generatePersonalitySharePoster).toHaveBeenCalledTimes(1)
    expect(generatePersonalitySquarePoster).toHaveBeenCalledTimes(2)
    expect(result.current.sharePosterPath).toBe('tmp://portrait-a')
  })

  it('keeps a valid portrait actionable when square-only art resolution fails', async () => {
    const deps = createDeps()
    const { result } = renderHook(() => useResultShareActions(deps))
    await act(async () => { await result.current.handleGeneratePoster() })
    accessSync.mockImplementation((path: string) => {
      if (path === 'tmp://square-a') throw new Error('missing')
    })
    vi.mocked(resolveCurrentCanvasImage).mockRejectedValueOnce(new Error('art unavailable'))

    await act(async () => { await result.current.handleGeneratePoster() })

    expect(result.current.sharePosterPath).toBe('tmp://portrait-a')
    expect(result.current.squarePosterPath).toBe('')
    expect(result.current.posterError).toBe(false)
    expect(taro.showActionSheet).toHaveBeenCalledTimes(2)
    expectNoGenerationFailure(deps)
  })

  it('cleans a QR file that resolves after art resolution has already failed', async () => {
    const qr = deferred<string>()
    vi.mocked(fetchShareQrCodeImage).mockReturnValue(qr.promise)
    vi.mocked(resolveCurrentCanvasImage).mockRejectedValue(new Error('art unavailable'))
    const deps = createDeps({ deviceTier: { isDegradation: true } })
    const { result } = renderHook(() => useResultShareActions(deps))

    await act(async () => { await result.current.handleGeneratePoster() })
    expect(result.current.posterError).toBe(true)
    await act(async () => {
      qr.resolve('tmp://late-qr')
      await qr.promise
      await flushMicrotasks()
    })

    expect(unlinkSync).toHaveBeenCalledWith('tmp://late-qr')
  })
})

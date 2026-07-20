import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AlangConfigPage, {
  getAlangConfigRecoveryUrl,
  getAlangStartErrorMessage,
  getTestPointValidationError,
} from './index'

const mocks = vi.hoisted(() => ({
  navigateBack: vi.fn(),
  useAuth: vi.fn(),
  useAlangMissionDetail: vi.fn(),
  refetchMission: vi.fn(),
  useAlangGpsOnce: vi.fn(),
  requestLocation: vi.fn(),
  reverseGeocode: vi.fn(),
  suggestGeoPlaces: vi.fn(),
  searchNearbyGeoPlaces: vi.fn(),
  getWalkingRoute: vi.fn(),
  callReportProgress: vi.fn(),
  startMission: vi.fn(),
  useStartMission: vi.fn(),
  useResetAlangMission: vi.fn(),
  resetMission: vi.fn(),
  syncMissionProgress: vi.fn(),
  showToast: vi.fn(),
  showModal: vi.fn(),
  haptics: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  redirectTo: vi.fn(),
  reLaunch: vi.fn(),
  nativeRedirectTo: vi.fn(),
  nativeReLaunch: vi.fn(),
  getCurrentPages: vi.fn(),
  didShowCallback: { current: null as null | (() => void) },
  setStorageSync: vi.fn(),
  distanceMeters: { current: 150 },
  currentRoute: { current: 'pages/alang/config/index' },
}))

type NativeNavigationOptions = {
  url: string
  success?: (result: unknown) => void
  fail?: (error: unknown) => void
}

const resolveNativeNavigation = (options: NativeNavigationOptions) => {
  mocks.currentRoute.current = options.url.split('?')[0].replace(/^\/+/, '')
  options.success?.({ errMsg: 'ok' })
}

beforeEach(() => {
  vi.stubGlobal('wx', {
    redirectTo: mocks.nativeRedirectTo,
    reLaunch: mocks.nativeReLaunch,
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

vi.mock('@tarojs/taro', () => {
  const taro = {
    getCurrentInstance: () => ({
      router: { params: { slug: 'meet-alang' } },
    }),
    navigateBack: mocks.navigateBack,
    showToast: mocks.showToast,
    showModal: mocks.showModal,
    setStorageSync: mocks.setStorageSync,
    redirectTo: mocks.redirectTo,
    reLaunch: mocks.reLaunch,
    getCurrentPages: mocks.getCurrentPages,
  }
  return {
    default: taro,
    useDidShow: (callback: () => void) => {
      mocks.didShowCallback.current = callback
    },
  }
})

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Map: (props: any) => <div data-testid='map' {...props} />,
  Button: ({ children, loading = false, hoverClass: _hoverClass, ...props }: any) => (
    <button data-loading={String(Boolean(loading))} {...props}>{children}</button>
  ),
  Input: (props: any) => <input {...props} />,
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: mocks.useAuth,
}))

vi.mock('../../../lib/alang/useAlangMission', () => ({
  useAlangMissionDetail: mocks.useAlangMissionDetail,
  useStartMission: mocks.useStartMission,
  useResetAlangMission: mocks.useResetAlangMission,
  useSyncAlangMissionProgress: () => mocks.syncMissionProgress,
}))

vi.mock('../../../lib/alang/useAlangGps', () => ({
  useAlangGpsOnce: mocks.useAlangGpsOnce,
}))

vi.mock('../../../lib/alang/api', () => ({
  haversine: vi.fn(() => mocks.distanceMeters.current),
  callReportProgress: mocks.callReportProgress,
}))

vi.mock('@shared/api', () => ({
  reverseGeocode: mocks.reverseGeocode,
  suggestGeoPlaces: mocks.suggestGeoPlaces,
  searchNearbyGeoPlaces: mocks.searchNearbyGeoPlaces,
  getWalkingRoute: mocks.getWalkingRoute,
}))

vi.mock('../../../lib/api/api', () => ({
  apiRequest: vi.fn(),
}))

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: mocks.haptics,
}))

vi.mock('../../../lib/utils/logger', () => ({
  logInfo: mocks.logInfo,
  logWarn: mocks.logWarn,
}))

vi.mock('../../../components/ui/StatusCard', () => ({
  default: ({ title, description, action }: any) => (
    <section data-testid='permission-gate'>
      <h1>{title}</h1>
      <p>{description}</p>
      <button onClick={action?.onClick}>{action?.label}</button>
    </section>
  ),
}))

describe('AlangConfigPage production access gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.didShowCallback.current = null
    mocks.useAuth.mockReturnValue({
      user: {
        appMode: 'production',
        features: { alangEnabled: true },
      },
      isLoading: false,
    })
    mocks.useAlangMissionDetail.mockReturnValue({
      // A stale query cache must not leak its internal locations through the gate.
      data: {
        content: {
          meta: {
            defaultTargetLocation: { latitude: 22.5431, longitude: 114.0579 },
            defaultCompanionEndLocation: { latitude: 22.5444, longitude: 114.0579 },
          },
          nodes: [],
        },
      },
      refetch: mocks.refetchMission,
    })
    mocks.useAlangGpsOnce.mockReturnValue({
      position: null,
      loading: false,
      error: null,
      request: mocks.requestLocation,
    })
    mocks.useStartMission.mockReturnValue({
      isPending: false,
      mutateAsync: mocks.startMission,
    })
    mocks.useResetAlangMission.mockReturnValue({
      isPending: false,
      mutateAsync: mocks.resetMission,
    })
    mocks.redirectTo.mockResolvedValue({})
    mocks.reLaunch.mockResolvedValue({})
    mocks.nativeRedirectTo.mockImplementation(resolveNativeNavigation)
    mocks.nativeReLaunch.mockImplementation(resolveNativeNavigation)
    mocks.getCurrentPages.mockReturnValue([])
    mocks.reverseGeocode.mockResolvedValue({ name: '测试地点', address: '深圳' })
    mocks.requestLocation.mockResolvedValue({ latitude: 22.5431, longitude: 114.0579, accuracy: 8 })
    mocks.startMission.mockResolvedValue({
      stage: 'searching',
      currentNodeId: 'search-gate',
      nodeHistory: ['event-card', 'event-detail', 'search-gate'],
      choicesMade: [],
    })
    mocks.callReportProgress.mockResolvedValue({
      ok: true,
      stage: 'searching',
      currentNodeId: 'search-gate',
    })
  })

  it('renders only the test-permission gate and disables mission loading', () => {
    const { container, getByTestId, queryByTestId } = render(<AlangConfigPage />)

    expect(getByTestId('permission-gate')).toBeInTheDocument()
    expect(container.querySelector('.alang-config__gate')).toBeInTheDocument()
    expect(container.querySelector('.alang-config')).not.toBeInTheDocument()
    expect(queryByTestId('map')).not.toBeInTheDocument()
    expect(mocks.useAlangMissionDetail).toHaveBeenCalledWith('meet-alang', false)
  })

  it('does not request location, POIs, routes, or expose cached coordinates', () => {
    const { container } = render(<AlangConfigPage />)

    expect(container.textContent).not.toContain('22.5431')
    expect(container.textContent).not.toContain('114.0579')
    expect(mocks.requestLocation).not.toHaveBeenCalled()
    expect(mocks.reverseGeocode).not.toHaveBeenCalled()
    expect(mocks.suggestGeoPlaces).not.toHaveBeenCalled()
    expect(mocks.searchNearbyGeoPlaces).not.toHaveBeenCalled()
    expect(mocks.getWalkingRoute).not.toHaveBeenCalled()
    expect(mocks.callReportProgress).not.toHaveBeenCalled()
  })
})

describe('AlangConfigPage test-point start flow', () => {
  const defaultMission = () => ({
    id: 'mission-alang',
    slug: 'meet-alang',
    title: '阿浪测试',
    description: '测试任务',
    content: {
      nodes: [
        { id: 'event-detail', type: 'event_detail', nextNodeId: 'search-gate', content: { body: '' } },
        { id: 'search-gate', type: 'search_gate', content: { body: '' } },
      ],
    },
    myProgress: null,
  })

  const setDefaultTestPoints = async () => {
    fireEvent.click(screen.getByRole('button', { name: '使用当前位置' }))
    await screen.findByText('直线 150 米')
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.didShowCallback.current = null
    mocks.distanceMeters.current = 150
    mocks.currentRoute.current = 'pages/alang/config/index'
    mocks.useAuth.mockReturnValue({
      user: { appMode: 'test', singleTestMode: true, features: { alangEnabled: true } },
      isLoading: false,
    })
    const mission = defaultMission()
    mocks.useAlangMissionDetail.mockReturnValue({
      data: mission,
      isLoading: false,
      isError: false,
      refetch: mocks.refetchMission,
    })
    mocks.useAlangGpsOnce.mockReturnValue({
      position: null,
      loading: false,
      error: null,
      request: mocks.requestLocation,
    })
    mocks.useStartMission.mockReturnValue({
      isPending: false,
      mutateAsync: mocks.startMission,
    })
    mocks.useResetAlangMission.mockReturnValue({
      isPending: false,
      mutateAsync: mocks.resetMission,
    })
    mocks.requestLocation.mockResolvedValue({ latitude: 22.5431, longitude: 114.0579, accuracy: 8 })
    mocks.reverseGeocode.mockResolvedValue({ name: '测试地点', address: '深圳' })
    mocks.startMission.mockResolvedValue({
      progressId: 'progress-started',
      stage: 'searching',
      currentNodeId: 'search-gate',
      nodeHistory: ['event-detail', 'search-gate'],
      choicesMade: [],
    })
    mocks.callReportProgress.mockResolvedValue({
      ok: true,
      stage: 'searching',
      currentNodeId: 'search-gate',
    })
    mocks.redirectTo.mockResolvedValue({})
    mocks.reLaunch.mockResolvedValue({})
    mocks.nativeRedirectTo.mockImplementation(resolveNativeNavigation)
    mocks.nativeReLaunch.mockImplementation(resolveNativeNavigation)
    mocks.getCurrentPages.mockImplementation(() => [{ route: mocks.currentRoute.current }])
    mocks.showModal.mockResolvedValue({ confirm: true, cancel: false })
    mocks.resetMission.mockResolvedValue({
      reset: true,
      deletedProgressCount: 1,
      deletedArchiveCount: 0,
    })
    mocks.refetchMission.mockResolvedValue({ isError: false, data: mission })
  })

  it('keeps the View CTA observable before points are ready without starting a run', async () => {
    render(<AlangConfigPage />)

    const startButton = screen.getByRole('button', { name: '开始测试' })
    expect(startButton.tagName).toBe('DIV')
    expect(startButton).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(startButton)

    expect(await screen.findByRole('alert')).toHaveTextContent('请先设置阿浪出现点和陪伴终点')
    expect(mocks.startMission).not.toHaveBeenCalled()
  })

  it('starts the run with this round’s GCJ-02 points and does not rely on local storage', async () => {
    render(<AlangConfigPage />)

    await setDefaultTestPoints()
    fireEvent.click(screen.getByRole('button', { name: '开始测试' }))

    await waitFor(() => {
      expect(mocks.startMission).toHaveBeenCalledWith(expect.objectContaining({
        slug: 'meet-alang',
        targetLocation: { latitude: 22.5431, longitude: 114.0579 },
        coordinateSystem: 'gcj02',
      }))
    })
    const startPayload = mocks.startMission.mock.calls[0]?.[0]
    expect(startPayload.companionEndLocation.latitude).toBeCloseTo(22.54445, 8)
    expect(startPayload.companionEndLocation.longitude).toBe(114.0579)
    expect(mocks.callReportProgress).not.toHaveBeenCalled()
    expect(mocks.syncMissionProgress).toHaveBeenCalledWith('meet-alang', {
      progressId: 'progress-started',
      status: 'in_progress',
      isDebugSession: true,
      stage: 'searching',
      currentNodeId: 'search-gate',
    })
    expect(mocks.syncMissionProgress.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.nativeRedirectTo.mock.invocationCallOrder[0],
    )
    expect(mocks.setStorageSync).not.toHaveBeenCalled()
    expect(mocks.nativeRedirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/alang/search/index?slug=meet-alang',
    }))
  })

  it('accepts a center-label tap and blocks a repeated tap while starting', async () => {
    let resolveStart!: (value: {
      stage: string
      currentNodeId: string
      nodeHistory: string[]
      choicesMade: never[]
    }) => void
    mocks.startMission.mockImplementationOnce(() => new Promise((resolve) => {
      resolveStart = resolve
    }))

    render(<AlangConfigPage />)
    await setDefaultTestPoints()

    const startButton = screen.getByRole('button', { name: '开始测试' })
    expect(startButton.tagName).toBe('DIV')
    expect(startButton).not.toHaveAttribute('disabled')
    expect(screen.getByRole('status')).toHaveTextContent('启动反馈已开启 · 点击后会立即显示进度')

    // Exercise the visible Text label that receives a center tap in desktop
    // WeChat, not only the surrounding View hit area.
    fireEvent.click(screen.getByText('开始测试'))
    await waitFor(() => expect(mocks.startMission).toHaveBeenCalledTimes(1))

    // The synchronous lock keeps rapid repeated taps to one request.
    fireEvent.click(startButton)

    expect(mocks.haptics).toHaveBeenCalledTimes(1)
    expect(mocks.haptics).toHaveBeenCalledWith('light')
    expect(mocks.startMission).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('已收到点击，正在启动阿浪…')
    expect(screen.getByRole('button', { name: '正在准备测试' })).not.toHaveAttribute('disabled')
    expect(screen.getByRole('button', { name: '正在准备测试' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: '正在准备测试' })).toHaveAttribute('aria-busy', 'true')

    await act(async () => {
      resolveStart({
        stage: 'searching',
        currentNodeId: 'search-gate',
        nodeHistory: ['event-detail', 'search-gate'],
        choicesMade: [],
      })
    })

    await waitFor(() => {
      expect(mocks.nativeRedirectTo).toHaveBeenCalledTimes(1)
    })
  })

  it('uses the proven native WeChat redirect first without waiting for Taro', async () => {
    render(<AlangConfigPage />)
    await setDefaultTestPoints()
    let currentRoute = 'pages/alang/config/index'
    mocks.getCurrentPages.mockImplementation(() => [{ route: currentRoute }])
    mocks.nativeRedirectTo.mockImplementation(({
      url,
      success,
    }: NativeNavigationOptions) => {
      currentRoute = url.split('?')[0].replace(/^\/+/, '')
      success?.({ errMsg: 'redirectTo:ok' })
    })

    fireEvent.click(screen.getByRole('button', { name: '开始测试' }))

    await waitFor(() => expect(mocks.nativeRedirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/alang/search/index?slug=meet-alang',
    })))
    expect(mocks.redirectTo).not.toHaveBeenCalled()
    expect(mocks.nativeReLaunch).not.toHaveBeenCalled()
    expect(mocks.reLaunch).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('uses native reLaunch when redirect reports success without changing pages', async () => {
    render(<AlangConfigPage />)
    await setDefaultTestPoints()
    vi.useFakeTimers()
    try {
      let currentRoute = 'pages/alang/config/index'
      mocks.getCurrentPages.mockImplementation(() => [{ route: currentRoute }])
      mocks.nativeReLaunch.mockImplementation(({
        url,
        success,
      }: NativeNavigationOptions) => {
        currentRoute = url.split('?')[0].replace(/^\/+/, '')
        success?.({ errMsg: 'reLaunch:ok' })
      })

      fireEvent.click(screen.getByRole('button', { name: '开始测试' }))
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
        await vi.advanceTimersByTimeAsync(3_001)
      })
      expect(mocks.nativeRedirectTo).toHaveBeenCalledTimes(1)
      expect(mocks.nativeReLaunch).toHaveBeenCalledWith(expect.objectContaining({
        url: '/pages/alang/search/index?slug=meet-alang',
      }))
      expect(mocks.redirectTo).not.toHaveBeenCalled()
      expect(mocks.reLaunch).not.toHaveBeenCalled()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the next-step retry visible only after every navigation path fails', async () => {
    mocks.getCurrentPages.mockReturnValue([{ route: 'pages/alang/config/index' }])
    mocks.redirectTo.mockRejectedValue(new Error('taro redirect failed'))
    mocks.nativeRedirectTo.mockImplementation(({ fail }: NativeNavigationOptions) => {
      fail?.(new Error('native redirect failed'))
    })
    mocks.nativeReLaunch.mockImplementation(({ fail }: NativeNavigationOptions) => {
      fail?.(new Error('native relaunch failed'))
    })
    mocks.reLaunch.mockRejectedValue(new Error('taro relaunch failed'))

    render(<AlangConfigPage />)
    await setDefaultTestPoints()
    fireEvent.click(screen.getByRole('button', { name: '开始测试' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('下一步没有打开')
    expect(mocks.redirectTo).toHaveBeenCalledTimes(1)
    expect(mocks.nativeRedirectTo).toHaveBeenCalledTimes(1)
    expect(mocks.nativeReLaunch).toHaveBeenCalledTimes(1)
    expect(mocks.reLaunch).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /开始测试|继续当前测试/ }))
      .toHaveAttribute('aria-disabled', 'false')
  })

  it('does not trust native success while the page stack is unavailable', async () => {
    render(<AlangConfigPage />)
    await setDefaultTestPoints()
    vi.useFakeTimers()
    try {
      let currentRoute = 'pages/alang/config/index'
      let stackVisible = true
      mocks.getCurrentPages.mockImplementation(() => stackVisible ? [{ route: currentRoute }] : [])
      mocks.nativeRedirectTo.mockImplementation(({ success }: NativeNavigationOptions) => {
        stackVisible = false
        success?.({ errMsg: 'redirectTo:ok' })
      })
      mocks.nativeReLaunch.mockImplementation(({ url, success }: NativeNavigationOptions) => {
        currentRoute = url.split('?')[0].replace(/^\/+/, '')
        stackVisible = true
        success?.({ errMsg: 'reLaunch:ok' })
      })
      fireEvent.click(screen.getByRole('button', { name: '开始测试' }))
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
        await vi.advanceTimersByTimeAsync(3_001)
      })

      expect(mocks.nativeRedirectTo).toHaveBeenCalledTimes(1)
      expect(mocks.nativeReLaunch).toHaveBeenCalledTimes(1)
      expect(mocks.redirectTo).not.toHaveBeenCalled()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not relaunch when redirect reaches the target within the commit window', async () => {
    render(<AlangConfigPage />)
    await setDefaultTestPoints()
    vi.useFakeTimers()
    try {
      let currentRoute = 'pages/alang/config/index'
      mocks.getCurrentPages.mockImplementation(() => [{ route: currentRoute }])
      mocks.nativeRedirectTo.mockImplementation(({ success }: NativeNavigationOptions) => {
        success?.({ errMsg: 'redirectTo:ok' })
      })

      fireEvent.click(screen.getByRole('button', { name: '开始测试' }))
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
        setTimeout(() => {
          currentRoute = 'pages/alang/search/index'
        }, 500)
        await vi.advanceTimersByTimeAsync(700)
      })

      expect(mocks.nativeRedirectTo).toHaveBeenCalledTimes(1)
      expect(mocks.nativeReLaunch).not.toHaveBeenCalled()
      expect(mocks.redirectTo).not.toHaveBeenCalled()
      expect(mocks.reLaunch).not.toHaveBeenCalled()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not overwrite an advanced route when the source stack was initially unknown', async () => {
    render(<AlangConfigPage />)
    await setDefaultTestPoints()
    let currentRoute: string | null = null
    mocks.getCurrentPages.mockImplementation(() => currentRoute ? [{ route: currentRoute }] : [])
    mocks.nativeRedirectTo.mockImplementation(({ success }: NativeNavigationOptions) => {
      currentRoute = 'pages/alang/dialogue/index'
      success?.({ errMsg: 'redirectTo:ok' })
    })

    fireEvent.click(screen.getByRole('button', { name: '开始测试' }))

    await waitFor(() => expect(mocks.nativeRedirectTo).toHaveBeenCalledTimes(1))
    expect(mocks.nativeReLaunch).not.toHaveBeenCalled()
    expect(mocks.redirectTo).not.toHaveBeenCalled()
    expect(mocks.reLaunch).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not relaunch after the source page unmounts', async () => {
    const { unmount } = render(<AlangConfigPage />)
    await setDefaultTestPoints()
    vi.useFakeTimers()
    try {
      mocks.getCurrentPages.mockReturnValue([{ route: 'pages/alang/config/index' }])

      fireEvent.click(screen.getByRole('button', { name: '开始测试' }))
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      unmount()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_001)
      })

      expect(mocks.redirectTo).not.toHaveBeenCalled()
      expect(mocks.nativeRedirectTo).toHaveBeenCalledTimes(1)
      expect(mocks.nativeReLaunch).not.toHaveBeenCalled()
      expect(mocks.reLaunch).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('recovers a server-owned searching stage without configuring points or starting again', async () => {
    const existingMission = {
      ...defaultMission(),
      myProgress: {
        progressId: 'progress-existing',
        status: 'in_progress',
        stage: 'searching',
        currentNodeId: 'search-gate',
        nodeHistory: ['event-detail', 'search-gate'],
        choicesMade: [],
        isDebugSession: true,
      },
    }
    mocks.useAlangMissionDetail.mockReturnValue({
      data: existingMission,
      refetch: mocks.refetchMission,
    })
    mocks.refetchMission.mockResolvedValue({ isError: false, data: existingMission })

    render(<AlangConfigPage />)

    await waitFor(() => {
      expect(mocks.nativeRedirectTo).toHaveBeenCalledWith(expect.objectContaining({
        url: '/pages/alang/search/index?slug=meet-alang',
      }))
    })
    expect(mocks.startMission).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '继续当前测试' })).toHaveAttribute('aria-disabled', 'false')
  })

  it('falls back to Taro navigation when both native navigation paths reject', async () => {
    let currentRoute = 'pages/alang/config/index'
    mocks.getCurrentPages.mockImplementation(() => [{ route: currentRoute }])
    mocks.nativeRedirectTo.mockImplementation(({ fail }: NativeNavigationOptions) => {
      fail?.(new Error('native redirect failed'))
    })
    mocks.nativeReLaunch.mockImplementation(({ fail }: NativeNavigationOptions) => {
      fail?.(new Error('native relaunch failed'))
    })
    mocks.redirectTo.mockImplementation(async ({ url }: { url: string }) => {
      currentRoute = url.split('?')[0].replace(/^\/+/, '')
      return {}
    })
    const existingMission = {
      ...defaultMission(),
      myProgress: {
        progressId: 'progress-existing',
        status: 'in_progress',
        stage: 'searching',
        currentNodeId: 'search-gate',
        nodeHistory: ['event-detail', 'search-gate'],
        choicesMade: [],
        isDebugSession: true,
      },
    }
    mocks.useAlangMissionDetail.mockReturnValue({
      data: existingMission,
      refetch: mocks.refetchMission,
    })
    mocks.refetchMission.mockResolvedValue({ isError: false, data: existingMission })

    render(<AlangConfigPage />)

    await waitFor(() => expect(mocks.redirectTo).toHaveBeenCalledTimes(1))
    expect(mocks.nativeRedirectTo).toHaveBeenCalledTimes(1)
    expect(mocks.nativeReLaunch).toHaveBeenCalledTimes(1)
    expect(mocks.reLaunch).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mocks.startMission).not.toHaveBeenCalled()
    expect(mocks.resetMission).not.toHaveBeenCalled()
  })

  it('recovers from the authoritative stage when the first start response is lost', async () => {
    mocks.startMission.mockRejectedValueOnce(new Error('response lost after commit'))
    const committedMission = {
      ...defaultMission(),
      myProgress: {
        progressId: 'progress-committed',
        status: 'in_progress',
        stage: 'searching',
        currentNodeId: 'search-gate',
        nodeHistory: ['event-detail', 'search-gate'],
        choicesMade: [],
        isDebugSession: true,
      },
    }

    render(<AlangConfigPage />)
    await waitFor(() => expect(mocks.refetchMission).toHaveBeenCalled())
    mocks.refetchMission.mockClear()
    mocks.refetchMission
      .mockResolvedValueOnce({ isError: false, data: defaultMission() })
      .mockResolvedValueOnce({ isError: false, data: committedMission })
    await setDefaultTestPoints()
    fireEvent.click(screen.getByRole('button', { name: '开始测试' }))

    await waitFor(() => {
      expect(mocks.nativeRedirectTo).toHaveBeenCalledWith(expect.objectContaining({
        url: '/pages/alang/search/index?slug=meet-alang',
      }))
    })
    expect(mocks.startMission).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('refetches and retries the same authoritative stage whenever the config page returns to foreground', async () => {
    const existingMission = {
      ...defaultMission(),
      myProgress: {
        progressId: 'progress-existing',
        status: 'in_progress',
        stage: 'searching',
        currentNodeId: 'search-gate',
        nodeHistory: ['event-detail', 'search-gate'],
        choicesMade: [],
        isDebugSession: true,
      },
    }
    mocks.useAlangMissionDetail.mockReturnValue({
      data: existingMission,
      refetch: mocks.refetchMission,
    })
    mocks.refetchMission.mockResolvedValue({ isError: false, data: existingMission })
    render(<AlangConfigPage />)
    await waitFor(() => expect(mocks.nativeRedirectTo).toHaveBeenCalledTimes(1))
    mocks.nativeRedirectTo.mockClear()
    mocks.refetchMission.mockClear()

    expect(mocks.didShowCallback.current).not.toBeNull()
    await act(async () => {
      await mocks.didShowCallback.current?.()
    })

    expect(mocks.refetchMission).toHaveBeenCalled()
    await waitFor(() => {
      expect(mocks.nativeRedirectTo).toHaveBeenCalledWith(expect.objectContaining({
        url: '/pages/alang/search/index?slug=meet-alang',
      }))
    })
  })

  it('waits for the fresh GET and never routes from a stale cached stage', async () => {
    const staleSearchingMission = {
      ...defaultMission(),
      myProgress: {
        progressId: 'progress-stale',
        status: 'in_progress',
        stage: 'searching',
        currentNodeId: 'search-gate',
        nodeHistory: ['search-gate'],
        choicesMade: [],
        isDebugSession: true,
      },
    }
    const freshConfiguringMission = {
      ...defaultMission(),
      myProgress: {
        progressId: 'progress-stale',
        status: 'in_progress',
        stage: 'configuring',
        currentNodeId: 'event-detail',
        nodeHistory: ['event-detail'],
        choicesMade: [],
        isDebugSession: true,
      },
    }
    mocks.useAlangMissionDetail.mockReturnValue({
      data: staleSearchingMission,
      refetch: mocks.refetchMission,
    })
    mocks.refetchMission.mockResolvedValue({ isError: false, data: freshConfiguringMission })

    render(<AlangConfigPage />)
    await waitFor(() => expect(mocks.refetchMission).toHaveBeenCalled())

    expect(mocks.nativeRedirectTo).not.toHaveBeenCalled()
    expect(mocks.startMission).not.toHaveBeenCalled()
  })

  it('fails closed and offers reset for an invalid or unknown server stage', async () => {
    const invalidMission = {
      ...defaultMission(),
      testConfigurationInvalid: true,
      myProgress: {
        progressId: 'progress-invalid',
        status: 'in_progress',
        stage: 'future-stage',
        currentNodeId: 'future-node',
        nodeHistory: ['future-node'],
        choicesMade: [],
        isDebugSession: true,
      },
    }
    mocks.useAlangMissionDetail.mockReturnValue({
      data: invalidMission,
      refetch: mocks.refetchMission,
    })
    mocks.refetchMission.mockResolvedValue({ isError: false, data: invalidMission })

    render(<AlangConfigPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('测试点位已经失效')
    expect(screen.getByRole('button', { name: '清除旧进度' })).toBeInTheDocument()
    expect(mocks.nativeRedirectTo).not.toHaveBeenCalled()
    expect(mocks.startMission).not.toHaveBeenCalled()
  })

  it('routes a completed server run to its result instead of starting again', async () => {
    const completedMission = {
      ...defaultMission(),
      myProgress: {
        progressId: 'progress-complete',
        status: 'completed',
        stage: 'completed',
        currentNodeId: 'result-card',
        nodeHistory: ['result-card'],
        choicesMade: [],
        isDebugSession: true,
      },
    }
    mocks.useAlangMissionDetail.mockReturnValue({
      data: completedMission,
      refetch: mocks.refetchMission,
    })
    mocks.refetchMission.mockResolvedValue({ isError: false, data: completedMission })

    render(<AlangConfigPage />)

    await waitFor(() => {
      expect(mocks.nativeRedirectTo).toHaveBeenCalledWith(expect.objectContaining({
        url: '/pages/alang/result/index?slug=meet-alang',
      }))
    })
    expect(mocks.startMission).not.toHaveBeenCalled()
  })

  it('falls back to Taro navigation when native WeChat redirect never settles', async () => {
    vi.useFakeTimers()
    try {
      const existingMission = {
        ...defaultMission(),
        myProgress: {
          progressId: 'progress-timeout',
          status: 'in_progress',
          stage: 'searching',
          currentNodeId: 'search-gate',
          nodeHistory: ['search-gate'],
          choicesMade: [],
          isDebugSession: true,
        },
      }
      mocks.useAlangMissionDetail.mockReturnValue({
        data: existingMission,
        refetch: mocks.refetchMission,
      })
      mocks.refetchMission.mockResolvedValue({ isError: false, data: existingMission })
      let currentRoute = 'pages/alang/config/index'
      mocks.getCurrentPages.mockImplementation(() => [{ route: currentRoute }])
      mocks.nativeRedirectTo.mockImplementationOnce(() => undefined)
      mocks.nativeReLaunch.mockImplementationOnce(({ fail }: NativeNavigationOptions) => {
        fail?.(new Error('native relaunch failed'))
      })
      mocks.redirectTo.mockImplementationOnce(async ({ url }: { url: string }) => {
        currentRoute = url.split('?')[0].replace(/^\/+/, '')
        return {}
      })

      render(<AlangConfigPage />)
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(mocks.nativeRedirectTo).toHaveBeenCalledTimes(1)
      expect(mocks.redirectTo).not.toHaveBeenCalled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_001)
      })

      expect(mocks.redirectTo).toHaveBeenCalledTimes(1)
      expect(mocks.nativeReLaunch).toHaveBeenCalledTimes(1)
      expect(mocks.reLaunch).not.toHaveBeenCalled()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(mocks.startMission).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps a failed start actionable with a persistent reason and allows retry', async () => {
    mocks.startMission.mockRejectedValueOnce(new Error('network unavailable'))

    render(<AlangConfigPage />)
    await setDefaultTestPoints()

    fireEvent.click(screen.getByRole('button', { name: '开始测试' }))

    const errorMessage = await screen.findByRole('alert')
    expect(errorMessage).toHaveTextContent('没有准备好，请检查网络后再试')
    expect(mocks.showToast).toHaveBeenCalledWith({
      title: '没有准备好，请检查网络后再试',
      icon: 'none',
    })
    expect(mocks.nativeRedirectTo).not.toHaveBeenCalled()
    expect(mocks.haptics).toHaveBeenCalledTimes(1)

    const retryButton = screen.getByRole('button', { name: '开始测试' })
    expect(retryButton).toBeEnabled()
    fireEvent.click(retryButton)

    await waitFor(() => {
      expect(mocks.startMission).toHaveBeenCalledTimes(2)
      expect(mocks.haptics).toHaveBeenCalledTimes(2)
      expect(mocks.nativeRedirectTo).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  it('still starts when haptic feedback is unavailable', async () => {
    mocks.haptics.mockImplementationOnce(() => {
      throw new Error('haptics unavailable')
    })

    render(<AlangConfigPage />)
    await setDefaultTestPoints()

    fireEvent.click(screen.getByRole('button', { name: '开始测试' }))

    await waitFor(() => {
      expect(mocks.startMission).toHaveBeenCalledTimes(1)
      expect(mocks.nativeRedirectTo).toHaveBeenCalledTimes(1)
    })
  })

  it('still starts and unlocks retry when optional realtime logging throws', async () => {
    mocks.logInfo.mockImplementationOnce(() => {
      throw new Error('realtime logger unavailable')
    })

    render(<AlangConfigPage />)
    await setDefaultTestPoints()

    fireEvent.click(screen.getByRole('button', { name: '开始测试' }))

    await waitFor(() => {
      expect(mocks.startMission).toHaveBeenCalledTimes(1)
      expect(mocks.nativeRedirectTo).toHaveBeenCalledTimes(1)
    })
  })

  it('still shows the server failure when optional warning logging throws', async () => {
    mocks.startMission.mockRejectedValueOnce(new Error('network unavailable'))
    mocks.logWarn.mockImplementationOnce(() => {
      throw new Error('realtime warning logger unavailable')
    })

    render(<AlangConfigPage />)
    await setDefaultTestPoints()

    fireEvent.click(screen.getByRole('button', { name: '开始测试' }))

    const errorMessage = await screen.findByRole('alert')
    expect(errorMessage).toHaveTextContent('没有准备好，请检查网络后再试')
    expect(screen.getByRole('button', { name: '开始测试' })).toBeEnabled()
  })

  it('tells stale-progress testers to reset before configuring again', () => {
    expect(getAlangStartErrorMessage({
      statusCode: 409,
      data: { error: 'ALANG_RECONFIG_REQUIRES_RESET' },
    })).toBe('检测到上一轮测试进度，请先重置阿浪测试，再开始新一轮')
  })

  it('maps every resumable server stage away from the stale config page', () => {
    expect(getAlangConfigRecoveryUrl('meet-alang', {
      progressId: 'p1',
      status: 'in_progress',
      isDebugSession: true,
      stage: 'dialogue',
      currentNodeId: 'dialogue-2',
    })).toBe('/pages/alang/dialogue/index?slug=meet-alang')
    expect(getAlangConfigRecoveryUrl('meet-alang', {
      progressId: 'p1',
      status: 'in_progress',
      isDebugSession: true,
      stage: 'companion',
      currentNodeId: 'companion-move',
    })).toBe('/pages/alang/companion/index?slug=meet-alang')
    expect(getAlangConfigRecoveryUrl('meet-alang', {
      progressId: 'p1',
      status: 'completed',
      isDebugSession: true,
      stage: 'completed',
      currentNodeId: 'result-card',
    })).toBe('/pages/alang/result/index?slug=meet-alang')
    expect(getAlangConfigRecoveryUrl('meet-alang', {
      progressId: 'p1',
      status: 'in_progress',
      isDebugSession: true,
      stage: 'configuring',
      currentNodeId: 'event-detail',
    })).toBeNull()
  })

  it('offers an in-page reset when an older run blocks the new test', async () => {
    mocks.startMission.mockRejectedValueOnce({
      statusCode: 409,
      data: { error: 'ALANG_RECONFIG_REQUIRES_RESET' },
    })
    render(<AlangConfigPage />)
    await setDefaultTestPoints()

    fireEvent.click(screen.getByRole('button', { name: '开始测试' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('请先重置阿浪测试')

    fireEvent.click(screen.getByRole('button', { name: '清除旧进度' }))
    await waitFor(() => expect(mocks.resetMission).toHaveBeenCalledWith('meet-alang'))
    expect(mocks.showModal).toHaveBeenCalledWith(expect.objectContaining({
      title: '清除上一轮阿浪测试',
      confirmText: '清除旧进度',
    }))
    expect(mocks.showToast).toHaveBeenCalledWith({
      title: '旧进度已清除，可以开始新一轮',
      icon: 'none',
    })
    expect(screen.getByRole('button', { name: '开始测试' })).toBeEnabled()
  })

  it('rejects zero, invalid, too-near and cross-city test coordinates', () => {
    expect(getTestPointValidationError(
      { latitude: 0, longitude: 0 },
      { latitude: 22.5431, longitude: 114.0579 },
    )).toMatch(/无效/)
    expect(getTestPointValidationError(
      { latitude: 114.0579, longitude: 22.5431 },
      { latitude: 22.5431, longitude: 114.0579 },
    )).toMatch(/无效/)
    expect(getTestPointValidationError(
      { latitude: 22.5431, longitude: 114.0579 },
      { latitude: 22.5431, longitude: 114.05791 },
    )).toMatch(/10–2000/)
    expect(getTestPointValidationError(
      { latitude: 22.5431, longitude: 114.0579 },
      { latitude: 25.5431, longitude: 114.0579 },
    )).toMatch(/10–2000/)
  })
})

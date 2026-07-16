import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AlangConfigPage, {
  getAlangStartErrorMessage,
  getTestPointValidationError,
} from './index'

const mocks = vi.hoisted(() => ({
  navigateBack: vi.fn(),
  useAuth: vi.fn(),
  useAlangMissionDetail: vi.fn(),
  useAlangGpsOnce: vi.fn(),
  requestLocation: vi.fn(),
  reverseGeocode: vi.fn(),
  suggestGeoPlaces: vi.fn(),
  searchNearbyGeoPlaces: vi.fn(),
  getWalkingRoute: vi.fn(),
  callReportProgress: vi.fn(),
  startMission: vi.fn(),
  useStartMission: vi.fn(),
  syncMissionProgress: vi.fn(),
  showToast: vi.fn(),
  haptics: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  redirectTo: vi.fn(),
  setStorageSync: vi.fn(),
  distanceMeters: { current: 150 },
}))

vi.mock('@tarojs/taro', () => {
  const taro = {
    getCurrentInstance: () => ({
      router: { params: { slug: 'meet-alang' } },
    }),
    navigateBack: mocks.navigateBack,
    showToast: mocks.showToast,
    setStorageSync: mocks.setStorageSync,
    redirectTo: mocks.redirectTo,
  }
  return { default: taro }
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
    mocks.redirectTo.mockResolvedValue({})
    mocks.reverseGeocode.mockResolvedValue({ name: '测试地点', address: '深圳' })
    mocks.requestLocation.mockResolvedValue({ latitude: 22.5431, longitude: 114.0579, accuracy: 8 })
    mocks.startMission.mockResolvedValue({
      stage: 'configuring',
      currentNodeId: 'event-detail',
      nodeHistory: ['event-card', 'event-detail'],
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
  const setDefaultTestPoints = async () => {
    fireEvent.click(screen.getByRole('button', { name: '使用当前位置' }))
    await screen.findByText('直线 150 米')
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.distanceMeters.current = 150
    mocks.useAuth.mockReturnValue({
      user: { appMode: 'test', singleTestMode: true, features: { alangEnabled: true } },
      isLoading: false,
    })
    mocks.useAlangMissionDetail.mockReturnValue({
      data: {
        content: {
          nodes: [
            { id: 'event-detail', type: 'event_detail', nextNodeId: 'search-gate', content: { body: '' } },
            { id: 'search-gate', type: 'search_gate', content: { body: '' } },
          ],
        },
        myProgress: null,
      },
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
    mocks.requestLocation.mockResolvedValue({ latitude: 22.5431, longitude: 114.0579, accuracy: 8 })
    mocks.reverseGeocode.mockResolvedValue({ name: '测试地点', address: '深圳' })
    mocks.startMission.mockResolvedValue({
      stage: 'configuring',
      currentNodeId: 'event-detail',
      nodeHistory: ['event-detail'],
      choicesMade: [],
    })
    mocks.callReportProgress.mockResolvedValue({
      ok: true,
      stage: 'searching',
      currentNodeId: 'search-gate',
    })
    mocks.redirectTo.mockResolvedValue({})
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
    expect(mocks.callReportProgress).toHaveBeenCalledWith('meet-alang', 'search-gate')
    expect(mocks.syncMissionProgress).toHaveBeenCalledWith('meet-alang', {
      ok: true,
      stage: 'searching',
      currentNodeId: 'search-gate',
    })
    expect(mocks.syncMissionProgress.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.redirectTo.mock.invocationCallOrder[0],
    )
    expect(mocks.setStorageSync).not.toHaveBeenCalled()
    expect(mocks.redirectTo).toHaveBeenCalledWith({
      url: '/pages/alang/search/index?slug=meet-alang&nodeId=search-gate',
    })
  })

  it('uses a native button, shows loading on the first tap, and blocks duplicate starts', async () => {
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
    expect(startButton.tagName).toBe('BUTTON')
    expect(screen.getByRole('status')).toHaveTextContent('启动反馈已开启 · 点击后会立即显示进度')

    fireEvent.click(startButton)
    fireEvent.click(startButton)

    expect(mocks.haptics).toHaveBeenCalledTimes(1)
    expect(mocks.haptics).toHaveBeenCalledWith('light')
    expect(mocks.startMission).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('已收到点击，正在启动阿浪…')
    expect(screen.getByRole('button', { name: '正在准备测试' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '正在准备测试' })).toHaveAttribute('data-loading', 'true')
    expect(screen.getByRole('button', { name: '正在准备测试' })).toHaveAttribute('aria-busy', 'true')

    await act(async () => {
      resolveStart({
        stage: 'configuring',
        currentNodeId: 'event-detail',
        nodeHistory: ['event-detail'],
        choicesMade: [],
      })
    })

    await waitFor(() => {
      expect(mocks.redirectTo).toHaveBeenCalledTimes(1)
    })
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
    expect(mocks.redirectTo).not.toHaveBeenCalled()
    expect(mocks.haptics).toHaveBeenCalledTimes(1)

    const retryButton = screen.getByRole('button', { name: '开始测试' })
    expect(retryButton).toBeEnabled()
    fireEvent.click(retryButton)

    await waitFor(() => {
      expect(mocks.startMission).toHaveBeenCalledTimes(2)
      expect(mocks.haptics).toHaveBeenCalledTimes(2)
      expect(mocks.redirectTo).toHaveBeenCalledTimes(1)
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

    expect(mocks.startMission).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(mocks.redirectTo).toHaveBeenCalledTimes(1)
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
      expect(mocks.redirectTo).toHaveBeenCalledTimes(1)
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
    })).toBe('检测到上一轮测试进度，请返回测试工具重置后再配置点位')
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

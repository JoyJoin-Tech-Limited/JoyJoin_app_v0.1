import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AlangCompanionPage from './index'

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  callReportProgress: vi.fn(),
  getCurrentPosition: vi.fn(),
  getSetting: vi.fn(),
  getStorageSync: vi.fn(),
  getWalkingRoute: vi.fn(),
  mapProps: vi.fn(),
  navigateTo: vi.fn(),
  openSetting: vi.fn(),
  reLaunch: vi.fn(),
  redirectTo: vi.fn(),
  refetch: vi.fn(),
  resetMission: vi.fn(),
  showModal: vi.fn(),
  showToast: vi.fn(),
  callDebugMockArrival: vi.fn(),
  authUser: { current: { appMode: 'production', features: { alangEnabled: true } } as any },
  useAlangGps: vi.fn(),
  useAlangMissionDetail: vi.fn(),
  useResetAlangMission: vi.fn(),
  syncMissionProgress: vi.fn(),
}))

vi.mock('@tarojs/taro', () => {
  const taro = {
    getCurrentInstance: () => ({
      router: { params: { slug: 'meet-alang', nodeId: 'companion-walk' } },
    }),
    getSetting: mocks.getSetting,
    getStorageSync: mocks.getStorageSync,
    navigateTo: mocks.navigateTo,
    openSetting: mocks.openSetting,
    reLaunch: mocks.reLaunch,
    redirectTo: mocks.redirectTo,
    showModal: mocks.showModal,
    showToast: mocks.showToast,
  }

  return {
    default: taro,
    useDidShow: vi.fn(),
  }
})

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
  Image: ({ mode: _mode, ...props }: any) => <img {...props} />,
  Map: (props: any) => {
    mocks.mapProps(props)
    return <div data-testid='companion-route-map' />
  },
}))

vi.mock('@shared/api', () => ({
  getWalkingRoute: mocks.getWalkingRoute,
}))

vi.mock('../../../lib/api/api', () => ({
  apiRequest: mocks.apiRequest,
}))

vi.mock('../../../lib/alang/api', () => ({
  callDebugMockArrival: mocks.callDebugMockArrival,
  callReportProgress: mocks.callReportProgress,
  getCurrentPosition: mocks.getCurrentPosition,
}))

vi.mock('../../../lib/alang/useAlangGps', () => ({
  useAlangGps: mocks.useAlangGps,
}))

vi.mock('../../../lib/alang/useAlangMission', () => ({
  useAlangMissionDetail: mocks.useAlangMissionDetail,
  useResetAlangMission: mocks.useResetAlangMission,
  useSyncAlangMissionProgress: () => mocks.syncMissionProgress,
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.authUser.current }),
}))

vi.mock('../../../lib/alang/alangAssets', () => ({
  useAlangAssetSource: () => ({
    src: 'mock-alang-companion.webp',
    usingFallback: false,
    onError: vi.fn(),
  }),
}))

vi.mock('../../../lib/alang/alangAnalytics', () => ({
  alangEvents: {
    arrivalReached: vi.fn(),
    confirmArrivalTap: vi.fn(),
    mapViewTap: vi.fn(),
  },
}))

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
}))

vi.mock('../../../components/ui/StatusCard', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}))

const serverDestination = {
  latitude: 22.54321,
  longitude: 114.05789,
}

const userPosition = {
  latitude: 22.54111,
  longitude: 114.05555,
}

const mission = {
  routeDestination: serverDestination,
  content: {
    version: '1.0',
    title: 'Alang night walk',
    description: 'Companion scene',
    startNodeId: 'companion-walk',
    nodes: [
      {
        id: 'companion-walk',
        type: 'companion_move',
        content: {
          body: 'Walk together for a while.',
          companionLines: ['The night breeze is gentle.'],
        },
        nextNodeId: 'result-card',
      },
      {
        id: 'result-card',
        type: 'result_card',
        content: { body: 'A shared memory.' },
      },
    ],
  },
  myProgress: {
    progressId: 'progress-1',
    stage: 'companion',
    currentNodeId: 'companion-walk',
    nodeHistory: ['companion-walk'],
    choicesMade: [],
    status: 'in_progress',
    isDebugSession: false,
  },
}

describe('AlangCompanionPage walking route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getStorageSync.mockReturnValue({
      // A debug cache must never override the destination released by server progress.
      endPoint: { latitude: 1, longitude: 2 },
    })
    mocks.getSetting.mockResolvedValue({ authSetting: { 'scope.userLocation': true } })
    mocks.openSetting.mockResolvedValue({ authSetting: { 'scope.userLocation': true } })
    mocks.showModal.mockResolvedValue({ confirm: true, cancel: false })
    mocks.redirectTo.mockResolvedValue({})
    mocks.navigateTo.mockResolvedValue({})
    mocks.reLaunch.mockResolvedValue({})
    mocks.resetMission.mockResolvedValue({
      reset: true,
      deletedProgressCount: 1,
      deletedArchiveCount: 0,
    })
    mocks.callDebugMockArrival.mockResolvedValue({
      arrived: true,
      distanceMeters: 0,
      radiusMeters: 5,
      stableCount: 3,
      nodeId: 'arrival-gate',
      stage: 'arrived',
      debug: true,
    })
    mocks.authUser.current = { appMode: 'production', features: { alangEnabled: true } }
    mocks.refetch.mockResolvedValue({ data: mission })
    mocks.useAlangMissionDetail.mockReturnValue({
      data: mission,
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    mocks.useResetAlangMission.mockReturnValue({
      isPending: false,
      mutateAsync: mocks.resetMission,
    })
    mocks.useAlangGps.mockReturnValue({
      distance: 280,
      accuracy: 12,
      nodeId: 'companion-walk',
      position: userPosition,
      configurationInvalid: false,
    })
  })

  it('requests Tencent walking directions only after a tap and uses canonical GCJ-02 coordinates', async () => {
    mocks.getWalkingRoute.mockResolvedValue({
      success: true,
      distanceMeters: 520,
      durationSeconds: 420,
      polyline: [
        userPosition,
        { latitude: 22.5422, longitude: 114.0567 },
        serverDestination,
      ],
    })

    const { container, queryByTestId } = render(<AlangCompanionPage />)

    expect(mocks.getWalkingRoute).not.toHaveBeenCalled()
    expect(queryByTestId('companion-route-map')).not.toBeInTheDocument()

    const routeButton = container.querySelector('.alang-companion__map-btn')
    expect(routeButton).toBeInTheDocument()
    fireEvent.click(routeButton!)

    await waitFor(() => {
      expect(mocks.getWalkingRoute).toHaveBeenCalledTimes(1)
      expect(mocks.getWalkingRoute).toHaveBeenCalledWith(mocks.apiRequest, {
        from: userPosition,
        to: serverDestination,
      })
    })

    await waitFor(() => {
      const latestMapCall = mocks.mapProps.mock.calls[mocks.mapProps.mock.calls.length - 1]
      const latestMapProps = latestMapCall?.[0]
      expect(latestMapProps.markers).toEqual([
        expect.objectContaining({
          latitude: serverDestination.latitude,
          longitude: serverDestination.longitude,
        }),
      ])
      expect(latestMapProps.polyline).toEqual([
        expect.objectContaining({
          points: [
            userPosition,
            { latitude: 22.5422, longitude: 114.0567 },
            serverDestination,
          ],
        }),
      ])
    })
  })

  it('keeps GPS and the story usable when Tencent walking directions fail', async () => {
    mocks.getWalkingRoute.mockRejectedValue(new Error('TENCENT_ROUTE_TIMEOUT'))

    const { container } = render(<AlangCompanionPage />)

    expect(mocks.useAlangGps).toHaveBeenCalledWith(expect.objectContaining({
      slug: 'meet-alang',
      target: serverDestination,
      enabled: true,
    }))

    fireEvent.click(container.querySelector('.alang-companion__map-btn')!)

    await waitFor(() => {
      const warning = container.querySelector('.alang-companion__map-warning')
      expect(warning).toBeInTheDocument()
      expect(warning?.textContent).not.toHaveLength(0)
    })

    expect(mocks.callReportProgress).not.toHaveBeenCalled()
    expect(mocks.redirectTo).not.toHaveBeenCalled()
    expect(document.querySelector('.alang-companion__debug-tools')).not.toBeInTheDocument()

    fireEvent.click(container.querySelector('.alang-companion__map-back')!)
    expect(container.querySelector('.alang-companion__atmosphere')).toBeInTheDocument()
    expect(mocks.useAlangGps).toHaveBeenLastCalledWith(expect.objectContaining({
      target: serverDestination,
      enabled: true,
    }))
  })

  it('blocks an abnormal distance instead of rendering a hundreds-of-kilometres companion state', () => {
    mocks.useAlangGps.mockReturnValue({
      distance: 242_037,
      accuracy: 12,
      nodeId: 'companion-walk',
      position: userPosition,
      configurationInvalid: false,
    })

    const { container } = render(<AlangCompanionPage />)

    expect(container.textContent).toContain('陪伴终点配置异常，请重新设置测试点位')
    expect(container.textContent).not.toContain('242037')
    expect(container.querySelector('.alang-companion__distance')).not.toBeInTheDocument()
    expect(container.querySelector('.alang-companion__map-btn')).not.toBeInTheDocument()
  })

  it('treats a cache without the newly disclosed endpoint as restoring, not invalid', () => {
    mocks.refetch.mockReturnValue(new Promise(() => undefined))
    mocks.useAlangMissionDetail.mockReturnValue({
      data: { ...mission, routeDestination: undefined },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })

    const { container } = render(<AlangCompanionPage />)

    expect(container.textContent).toContain('正在恢复本轮陪伴终点')
    expect(container.textContent).not.toContain('陪伴终点配置异常')
    expect(container.querySelector('[aria-label="重新配置点位"]')).not.toBeInTheDocument()
  })

  it('shows a retry state instead of reset when endpoint recovery fails', async () => {
    mocks.refetch.mockResolvedValue({ isError: true, data: undefined })
    mocks.useAlangMissionDetail.mockReturnValue({
      data: { ...mission, routeDestination: undefined },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })

    const { container } = render(<AlangCompanionPage />)

    await waitFor(() => expect(container.textContent).toContain('陪伴终点暂时没有恢复'))
    expect(container.textContent).not.toContain('陪伴终点配置异常')
    expect(container.querySelector('[aria-label="重新配置点位"]')).not.toBeInTheDocument()
  })

  it('shows configuration recovery only after a successful authoritative response still has no endpoint', async () => {
    mocks.authUser.current = { appMode: 'test', features: { alangEnabled: true } }
    const missingDestinationMission = { ...mission, routeDestination: undefined }
    mocks.refetch.mockResolvedValue({ isError: false, data: missingDestinationMission })
    mocks.useAlangMissionDetail.mockReturnValue({
      data: missingDestinationMission,
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })

    const { container } = render(<AlangCompanionPage />)

    await waitFor(() => expect(container.textContent).toContain('陪伴终点配置异常，请重新设置测试点位'))
    expect(container.querySelector('[aria-label="重新配置点位"]')).toBeInTheDocument()
  })

  it('uses the server GPS validation signal when an invalid distance is withheld', () => {
    mocks.useAlangGps.mockReturnValue({
      distance: null,
      accuracy: 12,
      nodeId: 'companion-walk',
      position: userPosition,
      configurationInvalid: true,
    })

    const { container } = render(<AlangCompanionPage />)

    expect(container.textContent).toContain('陪伴终点配置异常，请重新设置测试点位')
    expect(container.querySelector('.alang-companion__distance')).not.toBeInTheDocument()
    expect(container.querySelector('.alang-companion__map-btn')).not.toBeInTheDocument()
  })

  it('shows coordinates and internal actions only in strict single-test mode', () => {
    mocks.authUser.current = { appMode: 'test', features: { alangEnabled: true } }

    const { container } = render(<AlangCompanionPage />)

    expect(container.textContent).toContain('内部测试工具')
    fireEvent.click(container.querySelector('[aria-label="查看测试坐标"]')!)
    expect(container.textContent).toContain('22.541110, 114.055550')
    expect(container.textContent).toContain('22.543210, 114.057890')
    expect(container.textContent).toContain('计算距离：280 米')
  })

  it('uses the debug arrival API and immediately exposes the normal arrival continuation', async () => {
    mocks.authUser.current = { appMode: 'test', features: { alangEnabled: true } }
    mocks.callReportProgress.mockResolvedValue({
      stage: 'result',
      currentNodeId: 'result-card',
    })

    const { container } = render(<AlangCompanionPage />)
    fireEvent.click(container.querySelector('[aria-label="模拟到达终点"]')!)

    await waitFor(() => expect(mocks.callDebugMockArrival).toHaveBeenCalledWith('meet-alang'))
    await waitFor(() => expect(container.textContent).toContain('我们到了'))
    expect(mocks.syncMissionProgress).toHaveBeenCalledWith('meet-alang', {
      stage: 'arrived',
      currentNodeId: 'arrival-gate',
    })
    expect(mocks.refetch).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '确认到达' }))
    await waitFor(() => expect(mocks.callReportProgress).toHaveBeenCalledWith('meet-alang', 'result-card'))
    expect(mocks.syncMissionProgress).toHaveBeenLastCalledWith('meet-alang', {
      stage: 'result',
      currentNodeId: 'result-card',
    })
    expect(mocks.redirectTo).toHaveBeenCalledWith({
      url: '/pages/alang/result/index?slug=meet-alang&nodeId=result-card',
    })
  })

  it('resets server progress before relaunching the point configuration page', async () => {
    mocks.authUser.current = { appMode: 'test', features: { alangEnabled: true } }
    mocks.useAlangGps.mockReturnValue({
      distance: 242_037,
      accuracy: 12,
      nodeId: 'companion-walk',
      position: userPosition,
      configurationInvalid: false,
    })

    const { container } = render(<AlangCompanionPage />)
    fireEvent.click(container.querySelector('[aria-label="查看测试坐标"]')!)
    expect(container.textContent).toContain('计算距离：242037 米')
    fireEvent.click(container.querySelector('[aria-label="打开测试工具"]')!)
    expect(mocks.navigateTo).toHaveBeenCalledWith({
      url: '/pages/alang/debug/index?slug=meet-alang',
    })
    fireEvent.click(container.querySelector('[aria-label="重新配置点位"]')!)

    await waitFor(() => expect(mocks.resetMission).toHaveBeenCalledWith('meet-alang'))
    expect(mocks.reLaunch).toHaveBeenCalledWith({
      url: '/pages/alang/config/index?slug=meet-alang',
    })
  })
})

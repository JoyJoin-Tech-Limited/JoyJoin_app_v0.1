import { fireEvent, render, waitFor } from '@testing-library/react'
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
  openSetting: vi.fn(),
  redirectTo: vi.fn(),
  refetch: vi.fn(),
  showToast: vi.fn(),
  useAlangGps: vi.fn(),
  useAlangMissionDetail: vi.fn(),
}))

vi.mock('@tarojs/taro', () => {
  const taro = {
    getCurrentInstance: () => ({
      router: { params: { slug: 'meet-alang', nodeId: 'companion-walk' } },
    }),
    getSetting: mocks.getSetting,
    getStorageSync: mocks.getStorageSync,
    openSetting: mocks.openSetting,
    redirectTo: mocks.redirectTo,
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
  callReportProgress: mocks.callReportProgress,
  getCurrentPosition: mocks.getCurrentPosition,
}))

vi.mock('../../../lib/alang/useAlangGps', () => ({
  useAlangGps: mocks.useAlangGps,
}))

vi.mock('../../../lib/alang/useAlangMission', () => ({
  useAlangMissionDetail: mocks.useAlangMissionDetail,
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { features: { alangEnabled: true } } }),
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
    mocks.redirectTo.mockResolvedValue({})
    mocks.refetch.mockResolvedValue({ data: mission })
    mocks.useAlangMissionDetail.mockReturnValue({
      data: mission,
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    mocks.useAlangGps.mockReturnValue({
      distance: 280,
      accuracy: 12,
      nodeId: 'companion-walk',
      position: userPosition,
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

    fireEvent.click(container.querySelector('.alang-companion__map-back')!)
    expect(container.querySelector('.alang-companion__atmosphere')).toBeInTheDocument()
    expect(mocks.useAlangGps).toHaveBeenLastCalledWith(expect.objectContaining({
      target: serverDestination,
      enabled: true,
    }))
  })
})

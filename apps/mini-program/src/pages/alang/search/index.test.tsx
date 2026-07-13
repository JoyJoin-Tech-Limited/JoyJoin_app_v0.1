import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AlangSearchPage from './index'

const mocks = vi.hoisted(() => ({
  getSetting: vi.fn(),
  openSetting: vi.fn(),
  redirectTo: vi.fn(),
  showToast: vi.fn(),
  getStorageSync: vi.fn(),
  useAlangGps: vi.fn(),
  useAuth: vi.fn(),
  useAlangMissionDetail: vi.fn(),
  refetch: vi.fn(),
  mapProps: vi.fn(),
}))

vi.mock('@tarojs/taro', () => {
  const taro = {
    getCurrentInstance: () => ({ router: { params: { slug: 'meet-alang' } } }),
    getStorageSync: mocks.getStorageSync,
    getSetting: mocks.getSetting,
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
  Map: (props: any) => {
    mocks.mapProps(props)
    return <div data-testid='auxiliary-map' />
  },
}))

vi.mock('../../../lib/alang/useAlangGps', () => ({
  useAlangGps: mocks.useAlangGps,
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: mocks.useAuth,
}))

vi.mock('../../../lib/alang/useAlangMission', () => ({
  useAlangMissionDetail: mocks.useAlangMissionDetail,
}))

vi.mock('../../../lib/alang/alangAnalytics', () => ({
  alangEvents: {
    searchPageView: vi.fn(),
    mapViewTap: vi.fn(),
    foundAuto: vi.fn(),
  },
}))

describe('AlangSearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getStorageSync.mockReturnValue({
      target: { latitude: 22.999, longitude: 114.999 },
      radius: 5,
    })
    mocks.getSetting.mockResolvedValue({ authSetting: { 'scope.userLocation': true } })
    mocks.openSetting.mockResolvedValue({ authSetting: { 'scope.userLocation': true } })
    mocks.redirectTo.mockResolvedValue({})
    mocks.useAuth.mockReturnValue({
      user: { features: { alangEnabled: true } },
    })
    mocks.useAlangMissionDetail.mockReturnValue({
      data: {
        myProgress: {
          progressId: 'progress-1',
          stage: 'searching',
          currentNodeId: 'search-gate',
        },
      },
      refetch: mocks.refetch,
    })
    mocks.useAlangGps.mockReturnValue({
      distance: 84,
      accuracy: 18,
      nodeId: null,
      position: { latitude: 22.5431, longitude: 114.0579 },
    })
  })

  it('keeps distance primary and never passes the hidden target to the auxiliary map', async () => {
    render(<AlangSearchPage />)

    expect(screen.getByText('84')).toBeInTheDocument()
    expect(screen.getByText('定位信号稳定')).toBeInTheDocument()
    expect(screen.getByText('只确认你在哪里，不显示阿浪坐标或路线')).toBeInTheDocument()

    fireEvent.click(screen.getByText('打开'))
    expect(await screen.findByTestId('auxiliary-map')).toBeInTheDocument()

    const mapCalls = mocks.mapProps.mock.calls
    const mapProps = mapCalls[mapCalls.length - 1]?.[0]
    expect(mapProps.latitude).toBe(22.5431)
    expect(mapProps.longitude).toBe(114.0579)
    expect(mapProps.markers).toBeUndefined()
    expect(mapProps.circles).toBeUndefined()
    expect(mapProps.polyline).toBeUndefined()
  })

  it('shows explicit retry and settings actions after location permission is denied', async () => {
    mocks.getSetting.mockResolvedValue({ authSetting: { 'scope.userLocation': false } })
    mocks.useAlangGps.mockReturnValue({
      distance: null,
      accuracy: null,
      nodeId: null,
      position: null,
    })

    render(<AlangSearchPage />)

    expect(await screen.findByText('定位权限未开启')).toBeInTheDocument()
    expect(screen.getByText('重新定位')).toBeInTheDocument()
    const openSetting = screen.getByText('打开定位设置')
    expect(openSetting).toBeInTheDocument()

    fireEvent.click(openSetting)
    await waitFor(() => expect(mocks.openSetting).toHaveBeenCalledTimes(1))
  })

  it('replaces a stale search page using the server progress after arrival', async () => {
    mocks.useAlangMissionDetail.mockReturnValue({
      data: {
        myProgress: {
          progressId: 'progress-1',
          stage: 'dialogue',
          currentNodeId: 'dialogue-1',
        },
      },
      refetch: mocks.refetch,
    })

    render(<AlangSearchPage />)

    await waitFor(() => {
      expect(mocks.redirectTo).toHaveBeenCalledWith({
        url: '/pages/alang/dialogue/index?slug=meet-alang&nodeId=dialogue-1',
      })
    })
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AlangSearchPage from './index'

const mocks = vi.hoisted(() => ({
  getSetting: vi.fn(),
  openSetting: vi.fn(),
  navigateTo: vi.fn(),
  reLaunch: vi.fn(),
  redirectTo: vi.fn(),
  showModal: vi.fn(),
  showToast: vi.fn(),
  getStorageSync: vi.fn(),
  useAlangGps: vi.fn(),
  useAuth: vi.fn(),
  useAlangMissionDetail: vi.fn(),
  useResetAlangMission: vi.fn(),
  syncMissionProgress: vi.fn(),
  resetMission: vi.fn(),
  refetch: vi.fn(),
  mapProps: vi.fn(),
}))

vi.mock('@tarojs/taro', () => {
  const taro = {
    getCurrentInstance: () => ({ router: { params: { slug: 'meet-alang' } } }),
    getStorageSync: mocks.getStorageSync,
    getSetting: mocks.getSetting,
    openSetting: mocks.openSetting,
    navigateTo: mocks.navigateTo,
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
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, ...props }: any) => <img {...props} />,
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
  useResetAlangMission: mocks.useResetAlangMission,
  useSyncAlangMissionProgress: () => mocks.syncMissionProgress,
}))

vi.mock('../../../lib/alang/alangAnalytics', () => ({
  alangEvents: {
    searchPageView: vi.fn(),
    mapViewTap: vi.fn(),
    foundAuto: vi.fn(),
  },
}))

vi.mock('../../../lib/alang/alangAssets', () => ({
  useAlangAssetSource: (assetId: string) => ({
    src: `/mock-${assetId}.webp`,
    onError: vi.fn(),
    usingFallback: true,
  }),
}))

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
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
    mocks.showModal.mockResolvedValue({ confirm: true, cancel: false })
    mocks.navigateTo.mockResolvedValue({})
    mocks.reLaunch.mockResolvedValue({})
    mocks.redirectTo.mockResolvedValue({})
    mocks.resetMission.mockResolvedValue({
      reset: true,
      deletedProgressCount: 1,
      deletedArchiveCount: 0,
    })
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
    mocks.useResetAlangMission.mockReturnValue({
      isPending: false,
      mutateAsync: mocks.resetMission,
    })
    mocks.useAlangGps.mockReturnValue({
      distance: 84,
      accuracy: 18,
      nodeId: null,
      position: { latitude: 22.5431, longitude: 114.0579 },
      configurationInvalid: false,
    })
  })

  it('uses server-owned distance and never restores or exposes a hidden local target', async () => {
    const { container } = render(<AlangSearchPage />)

    expect(screen.getByText('84')).toBeInTheDocument()
    expect(screen.getByText('定位信号稳定')).toBeInTheDocument()
    expect(screen.getByText('你已进入阿浪可能出现的范围')).toBeInTheDocument()
    expect(screen.queryByText('跟着距离，去见一个人')).not.toBeInTheDocument()
    expect(screen.getByText('区域场景示意')).toBeInTheDocument()
    expect(screen.getByText('找到后场景示意')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '继续寻找' })).toBeInTheDocument()
    expect(container.querySelectorAll('.alang-search__signal-bar')).toHaveLength(4)
    expect(container.querySelector('.alang-search__radar-sweep')).not.toBeInTheDocument()
    expect(screen.getByText('只确认你在哪里，不显示阿浪坐标或路线')).toBeInTheDocument()
    expect(mocks.getStorageSync).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(mocks.useAlangGps).toHaveBeenCalledWith(expect.objectContaining({
        slug: 'meet-alang',
        target: undefined,
        enabled: true,
      }))
    })
    const gpsCalls = mocks.useAlangGps.mock.calls
    const gpsOptions = gpsCalls[gpsCalls.length - 1]?.[0]
    gpsOptions.onProgress({ stage: 'found', currentNodeId: 'found-scene' })
    expect(mocks.syncMissionProgress).toHaveBeenCalledWith('meet-alang', {
      stage: 'found',
      currentNodeId: 'found-scene',
    })

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
    expect(screen.getByRole('button', { name: '打开定位并继续' })).toBeInTheDocument()
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

  it('resets a legacy searching run with invalid server points before reopening config', async () => {
    mocks.useAuth.mockReturnValue({
      user: { appMode: 'test', singleTestMode: true, features: { alangEnabled: true } },
    })
    mocks.useAlangMissionDetail.mockReturnValue({
      data: {
        testConfigurationInvalid: true,
        myProgress: {
          progressId: 'legacy-progress',
          stage: 'searching',
          currentNodeId: 'search-gate',
        },
      },
      refetch: mocks.refetch,
    })

    render(<AlangSearchPage />)

    expect(screen.getByText('测试点位配置异常，请重新设置测试点位')).toBeInTheDocument()
    expect(mocks.useAlangGps).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
    fireEvent.click(screen.getByRole('button', { name: '打开测试工具' }))
    expect(mocks.navigateTo).toHaveBeenCalledWith({
      url: '/pages/alang/debug/index?slug=meet-alang',
    })
    fireEvent.click(screen.getByRole('button', { name: '重新配置点位' }))

    await waitFor(() => expect(mocks.resetMission).toHaveBeenCalledWith('meet-alang'))
    expect(mocks.reLaunch).toHaveBeenCalledWith({
      url: '/pages/alang/config/index?slug=meet-alang',
    })
  })
})

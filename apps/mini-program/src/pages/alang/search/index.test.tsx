import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlashMapPage from './index'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  mutateAsync: vi.fn(),
  getWalkingRoute: vi.fn(),
  permission: vi.fn(),
  getOneShotLocation: vi.fn(),
  redirectTo: vi.fn(),
  openSetting: vi.fn(),
  openLocation: vi.fn(),
  showToast: vi.fn(),
  canonicalRedirect: vi.fn(),
  startLocationUpdate: vi.fn(),
  stopLocationUpdate: vi.fn(),
  onLocationChange: vi.fn(),
  offLocationChange: vi.fn(),
  trackFlashSearchStarted: vi.fn(),
  locationChange: { current: null as null | ((value: any) => void) },
  didHide: { current: null as null | (() => void) },
}))

vi.mock('@tarojs/taro', () => ({
  useDidHide: (callback: () => void) => { mocks.didHide.current = callback },
  default: {
    getCurrentInstance: () => ({ router: { params: {
      appearanceId: 'appearance-1',
      npcName: '%E9%BB%98%E9%BB%98',
      npcSlug: 'momo',
      districtName: '%E5%AE%9D%E5%AE%89%E5%8C%BA',
      locationAddress: '%E5%AE%9D%E5%AE%89%E5%A3%B9%E6%96%B9%E5%9F%8E%E5%BC%80%E6%94%BE%E5%85%AC%E5%85%B1%E5%8C%BA%E5%9F%9F',
      endsAt: '2026-07-29T20%3A30%3A00%2B08%3A00',
    } } }),
    setNavigationBarTitle: vi.fn(),
    redirectTo: mocks.redirectTo,
    openSetting: mocks.openSetting,
    openLocation: mocks.openLocation,
    showToast: mocks.showToast,
    startLocationUpdate: mocks.startLocationUpdate,
    stopLocationUpdate: mocks.stopLocationUpdate,
    onLocationChange: mocks.onLocationChange,
    offLocationChange: mocks.offLocationChange,
  },
}))
vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
  Image: ({ mode: _mode, onError: _onError, ...props }: any) => <img {...props} />,
  Map: (props: any) => <div data-testid='native-map' data-markers={JSON.stringify(props.markers)} data-polyline={JSON.stringify(props.polyline)} />,
}))
vi.mock('@shared/api', () => ({ getWalkingRoute: mocks.getWalkingRoute }))
vi.mock('../../../lib/api/api', () => ({ apiRequest: vi.fn() }))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../../lib/alang/useFlash', () => ({
  useLocateFlashAppearance: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}))
vi.mock('../../../lib/alang/flashApi', () => ({
  getFlashLocationPermission: mocks.permission,
  getOneShotFlashLocation: mocks.getOneShotLocation,
  getFlashApiErrorCode: (error: any) => error?.data?.code ?? null,
}))
vi.mock('../../../lib/alang/flashNavigation', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../lib/alang/flashNavigation')>(),
  redirectToFlashCanonical: mocks.canonicalRedirect,
}))
vi.mock('../../../lib/analytics/flashSearchAnalytics', () => ({
  trackFlashSearchStarted: mocks.trackFlashSearchStarted,
}))
vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))

async function startNavigation() {
  const allowButton = screen.queryByRole('button', { name: '允许定位并打开地图' })
  if (allowButton) fireEvent.click(allowButton)
  await waitFor(() => expect(mocks.startLocationUpdate).toHaveBeenCalled())
}

function emitLocation() {
  mocks.locationChange.current?.({ latitude: 22.54, longitude: 114.05, accuracy: 8 })
}

describe('formal Flash map navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.locationChange.current = null
    mocks.didHide.current = null
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: true } } })
    mocks.permission.mockResolvedValue('granted')
    mocks.openSetting.mockResolvedValue({ authSetting: { 'scope.userLocation': true } })
    mocks.openLocation.mockResolvedValue({ errMsg: 'openLocation:ok' })
    mocks.getOneShotLocation.mockResolvedValue({ latitude: 22.54, longitude: 114.05, accuracy: 8 })
    mocks.startLocationUpdate.mockImplementation(({ success }: any) => success?.({ errMsg: 'ok' }))
    mocks.onLocationChange.mockImplementation((callback) => { mocks.locationChange.current = callback })
    mocks.mutateAsync.mockResolvedValue({
      canonicalScreen: 'map',
      withinRange: false,
      destination: { latitude: 22.541, longitude: 114.052, coordinateSystem: 'gcj02' },
      distanceMeters: 83,
      targetBearingDegrees: 90,
      proximityBand: 'near',
    })
    mocks.getWalkingRoute.mockResolvedValue({
      success: true,
      distanceMeters: 820,
      durationSeconds: 600,
      polyline: [
        { latitude: 22.54, longitude: 114.05 },
        { latitude: 22.541, longitude: 114.052 },
      ],
      source: 'tencent',
    })
    mocks.canonicalRedirect.mockResolvedValue(false)
  })

  it('renders decoded metadata and asks before starting foreground GPS', async () => {
    render(<FlashMapPage />)
    expect(await screen.findByText('打开前台定位，开始找默默？')).toBeInTheDocument()
    expect(mocks.startLocationUpdate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '允许定位并打开地图' }))
    expect(screen.getByText('默默')).toBeInTheDocument()
    expect(screen.getByText(/在宝安区/)).toBeInTheDocument()
    expect(screen.getByText('宝安壹方城开放公共区域')).toBeInTheDocument()
    expect(screen.getByText(/地图只在此页前台更新/)).toBeInTheDocument()
    await waitFor(() => expect(mocks.startLocationUpdate).toHaveBeenCalled())
  })

  it('returns home without touching GPS when the user declines', async () => {
    render(<FlashMapPage />)

    fireEvent.click(await screen.findByRole('button', { name: '暂不开启' }))
    expect(mocks.startLocationUpdate).not.toHaveBeenCalled()
    expect(mocks.redirectTo).toHaveBeenCalledWith({ url: expect.stringContaining('/pages/alang/event/index') })
  })

  it('submits an initial frame so a stationary device cannot stay on the loading map', async () => {
    render(<FlashMapPage />)
    await startNavigation()

    await waitFor(() => expect(mocks.getOneShotLocation).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith({
      appearanceId: 'appearance-1',
      location: { latitude: 22.54, longitude: 114.05, accuracy: 8 },
    }))
    expect(await screen.findByText('83 米')).toBeInTheDocument()
  })

  it('fires the search funnel head event once tracking actually starts', async () => {
    render(<FlashMapPage />)
    await startNavigation()

    await waitFor(() => expect(mocks.trackFlashSearchStarted).toHaveBeenCalledTimes(1))
    expect(mocks.trackFlashSearchStarted).toHaveBeenCalledWith('appearance-1')
  })

  it('does not fire the search funnel event when the user declines', async () => {
    render(<FlashMapPage />)

    fireEvent.click(await screen.findByRole('button', { name: '暂不开启' }))
    expect(mocks.trackFlashSearchStarted).not.toHaveBeenCalled()
  })

  it('shows the fixed NPC marker and walking route from the current location', async () => {
    render(<FlashMapPage />)
    await startNavigation()
    expect(mocks.onLocationChange).toHaveBeenCalled()
    emitLocation()

    expect(await screen.findByText('83 米')).toBeInTheDocument()
    expect(await screen.findByText('步行约 10 分钟 · 820 米')).toBeInTheDocument()
    expect(screen.getByTestId('native-map').getAttribute('data-markers')).toContain('22.541')
    expect(screen.getByTestId('native-map').getAttribute('data-polyline')).toContain('114.052')
  })

  it('opens the fixed destination in the WeChat native Tencent map page', async () => {
    render(<FlashMapPage />)
    await startNavigation()

    fireEvent.click(await screen.findByRole('button', { name: '打开腾讯地图导航' }))

    expect(mocks.openLocation).toHaveBeenCalledWith({
      latitude: 22.541,
      longitude: 114.052,
      name: '默默出现点',
      address: '宝安壹方城开放公共区域',
      scale: 16,
    })
  })

  it('keeps in-page guidance running and explains when the native map cannot open', async () => {
    mocks.openLocation.mockRejectedValueOnce(new Error('openLocation failed'))
    render(<FlashMapPage />)
    await startNavigation()

    fireEvent.click(await screen.findByRole('button', { name: '打开腾讯地图导航' }))

    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith({
      title: '地图没有打开，请稍后再试',
      icon: 'none',
    }))
    expect(screen.getByRole('button', { name: '打开腾讯地图导航' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '地图引导中' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '停止地图引导' })).not.toBeInTheDocument()
    expect(mocks.stopLocationUpdate).not.toHaveBeenCalled()
  })

  it('keeps the destination marker available when the walking route provider is unavailable', async () => {
    mocks.getWalkingRoute.mockResolvedValue({ success: false, code: 'MAP_NO_ROUTE' })
    render(<FlashMapPage />)
    await startNavigation()
    emitLocation()

    expect(await screen.findByText('步行路线暂时没有加载，可先按地图终点方向前往。')).toBeInTheDocument()
    expect(screen.getByTestId('native-map').getAttribute('data-markers')).toContain('22.541')
  })

  it('stops location when the page enters the background', async () => {
    render(<FlashMapPage />)
    await startNavigation()
    act(() => { mocks.didHide.current?.() })
    expect(mocks.stopLocationUpdate).toHaveBeenCalled()
    expect(mocks.offLocationChange).toHaveBeenCalled()
  })

  it('recovers through WeChat settings after location was denied', async () => {
    mocks.permission.mockResolvedValue('denied')
    mocks.startLocationUpdate.mockImplementationOnce(({ fail }: any) => fail?.({ errMsg: 'auth deny' }))
    render(<FlashMapPage />)
    await startNavigation()

    expect(await screen.findByText('定位权限没有打开')).toBeInTheDocument()
    mocks.startLocationUpdate.mockImplementation(({ success }: any) => success?.({ errMsg: 'ok' }))
    fireEvent.click(screen.getByRole('button', { name: '打开定位设置' }))

    await waitFor(() => expect(mocks.openSetting).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mocks.startLocationUpdate).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalled())
  })

  it('stops cleanly when the initial location frame fails', async () => {
    mocks.getOneShotLocation.mockRejectedValueOnce(new Error('location timeout'))
    render(<FlashMapPage />)
    await startNavigation()

    expect(await screen.findByText('地图定位中断')).toBeInTheDocument()
    expect(mocks.stopLocationUpdate).toHaveBeenCalled()
    expect(mocks.offLocationChange).toHaveBeenCalled()
  })

  it('explains locate rate limits without continuing to track', async () => {
    mocks.mutateAsync.mockRejectedValueOnce({ data: { code: 'FLASH_LOCATE_RATE_LIMITED' } })
    render(<FlashMapPage />)
    await startNavigation()

    expect(await screen.findByText('位置更新太频繁了')).toBeInTheDocument()
    expect(mocks.stopLocationUpdate).toHaveBeenCalled()
  })

  it('keeps only the exit action when the destination is not available', async () => {
    mocks.mutateAsync.mockRejectedValueOnce(new Error('network unavailable'))
    render(<FlashMapPage />)
    await startNavigation()

    expect(await screen.findByText('地图定位中断')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '先不去了' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '重新打开地图' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '停止地图引导' })).not.toBeInTheDocument()
  })

  it('shows a found signal, stops tracking, then enters dialogue', async () => {
    mocks.mutateAsync.mockResolvedValue({
      canonicalScreen: 'dialogue',
      withinRange: true,
      destination: { latitude: 22.541, longitude: 114.052, coordinateSystem: 'gcj02' },
      distanceMeters: 7,
      targetBearingDegrees: 15,
      proximityBand: 'arrived',
      encounterId: 'encounter-1',
    })
    mocks.canonicalRedirect.mockResolvedValue(true)
    render(<FlashMapPage />)
    await startNavigation()
    emitLocation()

    // 相遇庆祝拍：先亮起「遇见了」仪式感界面，随后才进入对话。
    expect(await screen.findByText('遇见了')).toBeInTheDocument()
    await waitFor(() => expect(mocks.canonicalRedirect).toHaveBeenCalled(), { timeout: 2500 })
    expect(mocks.stopLocationUpdate).toHaveBeenCalled()
  })

  it('seeds the encounter celebration copy from the server encounter ordinal', async () => {
    mocks.mutateAsync.mockResolvedValue({
      canonicalScreen: 'dialogue',
      withinRange: true,
      destination: { latitude: 22.541, longitude: 114.052, coordinateSystem: 'gcj02' },
      distanceMeters: 7,
      targetBearingDegrees: 15,
      proximityBand: 'arrived',
      encounterId: 'encounter-2',
      encounterOrdinal: 2,
    })
    mocks.canonicalRedirect.mockResolvedValue(true)
    render(<FlashMapPage />)
    await startNavigation()
    emitLocation()

    expect(await screen.findByText('又碰上了')).toBeInTheDocument()
    expect(screen.getByText('上一次还留在回声里。')).toBeInTheDocument()
    await waitFor(() => expect(mocks.canonicalRedirect).toHaveBeenCalled(), { timeout: 2500 })
  })

  it('clamps the celebration copy to the third variant for later encounters', async () => {
    mocks.mutateAsync.mockResolvedValue({
      canonicalScreen: 'dialogue',
      withinRange: true,
      destination: { latitude: 22.541, longitude: 114.052, coordinateSystem: 'gcj02' },
      distanceMeters: 7,
      targetBearingDegrees: 15,
      proximityBand: 'arrived',
      encounterId: 'encounter-5',
      encounterOrdinal: 5,
    })
    mocks.canonicalRedirect.mockResolvedValue(true)
    render(<FlashMapPage />)
    await startNavigation()
    emitLocation()

    expect(await screen.findByText('老位置，又见面了')).toBeInTheDocument()
    await waitFor(() => expect(mocks.canonicalRedirect).toHaveBeenCalled(), { timeout: 2500 })
  })

  it('stops and explains when the appearance ends during tracking', async () => {
    mocks.mutateAsync.mockRejectedValue({ data: { code: 'FLASH_APPEARANCE_ENDED' } })
    render(<FlashMapPage />)
    await startNavigation()
    emitLocation()
    expect(await screen.findByText('刚好散场了')).toBeInTheDocument()
    expect(await screen.findByText('下次见面，也许是另一条街。')).toBeInTheDocument()
    expect(mocks.stopLocationUpdate).toHaveBeenCalled()
  })

  it('eases the distance readout toward new frames instead of jumping', async () => {
    mocks.mutateAsync
      .mockResolvedValueOnce({
        canonicalScreen: 'map',
        withinRange: false,
        destination: { latitude: 22.541, longitude: 114.052, coordinateSystem: 'gcj02' },
        distanceMeters: 83,
        targetBearingDegrees: 90,
        proximityBand: 'near',
      })
      .mockResolvedValueOnce({
        canonicalScreen: 'map',
        withinRange: false,
        destination: { latitude: 22.541, longitude: 114.052, coordinateSystem: 'gcj02' },
        distanceMeters: 60,
        targetBearingDegrees: 90,
        proximityBand: 'near',
      })
    render(<FlashMapPage />)
    await startNavigation()
    expect(await screen.findByText('83 米')).toBeInTheDocument()

    // 位置帧 2s 节流：第二帧要等节流窗口过去才会发出。
    await new Promise((resolve) => { setTimeout(resolve, 2_100) })
    emitLocation()

    // EMA 0.35：83 → 60 的新帧不直接落 60，而是缓动到约 75 米。
    expect(await screen.findByText('75 米')).toBeInTheDocument()
    expect(screen.queryByText('60 米')).not.toBeInTheDocument()
  })

  it('still requires explicit GPS consent when the legacy Alang flag is disabled', async () => {
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: false } } })
    render(<FlashMapPage />)
    expect(await screen.findByText('打开前台定位，开始找默默？')).toBeInTheDocument()
    expect(mocks.startLocationUpdate).not.toHaveBeenCalled()
  })
})

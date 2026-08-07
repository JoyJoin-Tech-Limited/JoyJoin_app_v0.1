import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlashMapPage from './index'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  mutateAsync: vi.fn(),
  getWalkingRoute: vi.fn(),
  permission: vi.fn(),
  redirectTo: vi.fn(),
  canonicalRedirect: vi.fn(),
  startLocationUpdate: vi.fn(),
  stopLocationUpdate: vi.fn(),
  onLocationChange: vi.fn(),
  offLocationChange: vi.fn(),
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
    openSetting: vi.fn(),
    showToast: vi.fn(),
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
  getFlashApiErrorCode: (error: any) => error?.data?.code ?? null,
}))
vi.mock('../../../lib/alang/flashNavigation', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../lib/alang/flashNavigation')>(),
  redirectToFlashCanonical: mocks.canonicalRedirect,
}))
vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))

async function startNavigation() {
  await waitFor(() => expect(mocks.startLocationUpdate).toHaveBeenCalled())
  await waitFor(() => expect(screen.getByText('地图引导中')).toBeInTheDocument())
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

  it('renders decoded public-area metadata and starts map navigation immediately', async () => {
    render(<FlashMapPage />)
    expect(screen.getByText('默默')).toBeInTheDocument()
    expect(screen.getByText(/在宝安区/)).toBeInTheDocument()
    expect(screen.getByText('宝安壹方城开放公共区域')).toBeInTheDocument()
    expect(screen.getByText(/地图只在此页前台更新/)).toBeInTheDocument()
    await waitFor(() => expect(mocks.startLocationUpdate).toHaveBeenCalled())
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
    mocks.didHide.current?.()
    expect(mocks.stopLocationUpdate).toHaveBeenCalled()
    expect(mocks.offLocationChange).toHaveBeenCalled()
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

    await waitFor(() => expect(mocks.canonicalRedirect).toHaveBeenCalled(), { timeout: 1200 })
    expect(mocks.stopLocationUpdate).toHaveBeenCalled()
  })

  it('stops and explains when the appearance ends during tracking', async () => {
    mocks.mutateAsync.mockRejectedValue({ data: { code: 'FLASH_APPEARANCE_ENDED' } })
    render(<FlashMapPage />)
    await startNavigation()
    emitLocation()
    expect(await screen.findByText('刚好散场了')).toBeInTheDocument()
    expect(mocks.stopLocationUpdate).toHaveBeenCalled()
  })

  it('starts the formal map through a deep link when the legacy Alang flag is disabled', async () => {
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: false } } })
    render(<FlashMapPage />)
    expect(screen.getByText('正在获取前往出现点的路线')).toBeInTheDocument()
    await waitFor(() => expect(mocks.startLocationUpdate).toHaveBeenCalled())
  })
})

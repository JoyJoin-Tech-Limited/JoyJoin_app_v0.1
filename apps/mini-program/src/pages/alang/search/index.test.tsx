import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlashRadarPage from './index'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  mutateAsync: vi.fn(),
  permission: vi.fn(),
  redirectTo: vi.fn(),
  canonicalRedirect: vi.fn(),
  startLocationUpdate: vi.fn(),
  stopLocationUpdate: vi.fn(),
  startCompass: vi.fn(),
  stopCompass: vi.fn(),
  onLocationChange: vi.fn(),
  offLocationChange: vi.fn(),
  onCompassChange: vi.fn(),
  offCompassChange: vi.fn(),
  locationChange: { current: null as null | ((value: any) => void) },
  compassChange: { current: null as null | ((value: any) => void) },
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
    startCompass: mocks.startCompass,
    stopCompass: mocks.stopCompass,
    onLocationChange: mocks.onLocationChange,
    offLocationChange: mocks.offLocationChange,
    onCompassChange: mocks.onCompassChange,
    offCompassChange: mocks.offCompassChange,
  },
}))
vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
  Image: ({ mode: _mode, onError: _onError, ...props }: any) => <img {...props} />,
}))
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

async function startRadar() {
  fireEvent.click(screen.getByText('开启雷达'))
  await waitFor(() => expect(mocks.startLocationUpdate).toHaveBeenCalled())
  await waitFor(() => expect(screen.getAllByText('追踪中').length).toBeGreaterThan(0))
}

function emitLocation() {
  mocks.locationChange.current?.({ latitude: 22.54, longitude: 114.05, accuracy: 8 })
}

describe('formal Flash live radar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.locationChange.current = null
    mocks.compassChange.current = null
    mocks.didHide.current = null
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: true } } })
    mocks.permission.mockResolvedValue('granted')
    mocks.startLocationUpdate.mockImplementation(({ success }: any) => success?.({ errMsg: 'ok' }))
    mocks.startCompass.mockResolvedValue({ errMsg: 'ok' })
    mocks.onLocationChange.mockImplementation((callback) => { mocks.locationChange.current = callback })
    mocks.onCompassChange.mockImplementation((callback) => { mocks.compassChange.current = callback })
    mocks.mutateAsync.mockResolvedValue({
      canonicalScreen: 'radar',
      withinRange: false,
      distanceMeters: 83,
      targetBearingDegrees: 90,
      proximityBand: 'near',
    })
    mocks.canonicalRedirect.mockResolvedValue(false)
  })

  it('renders decoded public-area metadata without starting location', () => {
    render(<FlashRadarPage />)
    expect(screen.getByText('默默')).toBeInTheDocument()
    expect(screen.getByText(/在宝安区/)).toBeInTheDocument()
    expect(screen.getByText('宝安壹方城开放公共区域')).toBeInTheDocument()
    expect(screen.getByText('开启雷达')).toBeInTheDocument()
    expect(mocks.startLocationUpdate).not.toHaveBeenCalled()
  })

  it('streams foreground frames and rotates the pointer relative to device heading', async () => {
    render(<FlashRadarPage />)
    await startRadar()
    expect(mocks.onLocationChange).toHaveBeenCalled()
    expect(mocks.onCompassChange).toHaveBeenCalled()

    mocks.compassChange.current?.({ direction: 30, accuracy: 'high' })
    emitLocation()

    expect(await screen.findByText('83 米')).toBeInTheDocument()
    expect(screen.getByTestId('flash-radar-pointer')).toHaveStyle({ transform: 'rotate(60deg)' })
    expect(screen.getByTestId('flash-radar-target')).toHaveStyle({ transform: 'rotate(60deg)' })
    expect(screen.getByTestId('flash-range-radar')).toHaveClass('flash-radar__instrument--near')
  })

  it('stops location and compass when the page enters the background', async () => {
    render(<FlashRadarPage />)
    await startRadar()
    mocks.didHide.current?.()
    expect(mocks.stopLocationUpdate).toHaveBeenCalled()
    expect(mocks.stopCompass).toHaveBeenCalled()
    expect(mocks.offLocationChange).toHaveBeenCalled()
    expect(mocks.offCompassChange).toHaveBeenCalled()
  })

  it('shows a found signal, stops tracking, then enters dialogue', async () => {
    mocks.mutateAsync.mockResolvedValue({
      canonicalScreen: 'dialogue',
      withinRange: true,
      distanceMeters: 7,
      targetBearingDegrees: 15,
      proximityBand: 'arrived',
      encounterId: 'encounter-1',
    })
    mocks.canonicalRedirect.mockResolvedValue(true)
    render(<FlashRadarPage />)
    await startRadar()
    emitLocation()

    expect(await screen.findByText('找到了')).toBeInTheDocument()
    expect(mocks.stopLocationUpdate).toHaveBeenCalled()
    await waitFor(() => expect(mocks.canonicalRedirect).toHaveBeenCalled(), { timeout: 1200 })
  })

  it('stops and explains when the appearance ends during tracking', async () => {
    mocks.mutateAsync.mockRejectedValue({ data: { code: 'FLASH_APPEARANCE_ENDED' } })
    render(<FlashRadarPage />)
    await startRadar()
    emitLocation()
    expect(await screen.findByText('刚好散场了')).toBeInTheDocument()
    expect(mocks.stopLocationUpdate).toHaveBeenCalled()
  })

  it('does not start tracking through a disabled deep link', () => {
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: false } } })
    render(<FlashRadarPage />)
    expect(screen.getByText('街头盲盒正在准备下一次见面')).toBeInTheDocument()
    expect(mocks.startLocationUpdate).not.toHaveBeenCalled()
  })
})

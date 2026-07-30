import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlashRadarPage from './index'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  mutateAsync: vi.fn(),
  location: vi.fn(),
  permission: vi.fn(),
  redirectTo: vi.fn(),
  canonicalRedirect: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
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
  getOneShotFlashLocation: mocks.location,
  getFlashLocationPermission: mocks.permission,
  getFlashApiErrorCode: (error: any) => error?.data?.code ?? null,
}))
vi.mock('../../../lib/alang/flashNavigation', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../lib/alang/flashNavigation')>(),
  redirectToFlashCanonical: mocks.canonicalRedirect,
}))
vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))

describe('formal Flash radar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: true } } })
    mocks.location.mockResolvedValue({ latitude: 22.54, longitude: 114.05, accuracy: 10 })
    mocks.permission.mockResolvedValue('granted')
    mocks.mutateAsync.mockResolvedValue({ canonicalScreen: 'radar', withinRange: false, distanceMeters: 83 })
    mocks.canonicalRedirect.mockResolvedValue(false)
  })

  it('renders decoded route metadata instead of URL-encoded text', () => {
    render(<FlashRadarPage />)

    expect(screen.getByText((_, element) => (
      element !== null
      && element.classList.contains('flash-radar__clue-meta')
      && element.textContent?.startsWith('默默在宝安区') === true
    ))).toBeInTheDocument()
    expect(screen.getByText('宝安壹方城开放公共区域')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/%E[0-9A-F]{2}/i)
  })

  it('never locates until the user explicitly taps and sends one snapshot', async () => {
    render(<FlashRadarPage />)
    expect(mocks.location).not.toHaveBeenCalled()
    expect(screen.getByText('只读取一次你的位置，用来判断是否进入 100 米范围。', { exact: false })).toBeInTheDocument()

    fireEvent.click(screen.getByText('我到附近了'))
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith({
      appearanceId: 'appearance-1',
      location: { latitude: 22.54, longitude: 114.05, accuracy: 10 },
    }))
    expect(await screen.findByText(/不会显示角色的距离或方向/)).toBeInTheDocument()
    expect(screen.queryByText(/83 米/)).not.toBeInTheDocument()
  })

  it('treats an ended appearance as a normal dispersal, not a location failure', async () => {
    mocks.mutateAsync.mockRejectedValue({ data: { code: 'FLASH_APPEARANCE_ENDED' } })
    render(<FlashRadarPage />)
    fireEvent.click(screen.getByText('我到附近了'))

    expect(await screen.findByText('刚好散场了')).toBeInTheDocument()
    expect(screen.getByText(/不接受预约/)).toBeInTheDocument()
  })

  it('explains the shared hidden-location budget without requesting permissions again', async () => {
    mocks.mutateAsync.mockRejectedValue({ data: { code: 'FLASH_LOCATE_RATE_LIMITED' } })
    render(<FlashRadarPage />)
    fireEvent.click(screen.getByText('我到附近了'))

    expect(await screen.findByText('先歇一会儿再确认')).toBeInTheDocument()
    expect(screen.getByText(/10 分钟内最多确认 6 次/)).toBeInTheDocument()
    expect(mocks.permission).not.toHaveBeenCalled()
  })

  it('does not request location through a disabled deep link', () => {
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: false } } })
    render(<FlashRadarPage />)
    expect(screen.getByText('街头盲盒正在准备下一次见面')).toBeInTheDocument()
    expect(mocks.location).not.toHaveBeenCalled()
  })
})

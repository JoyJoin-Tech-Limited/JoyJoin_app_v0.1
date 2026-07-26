import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Taro from '@tarojs/taro'
import AlangDiscoverCard from './AlangDiscoverCard'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  haptics: vi.fn(),
  cardTap: vi.fn(),
}))

vi.mock('../../hooks/useAuth', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../lib/alang/alangAnalytics', () => ({
  alangEvents: { discoverCardTap: mocks.cardTap },
}))
vi.mock('../../lib/utils/haptics', () => ({ haptics: mocks.haptics }))
vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, onError: _onError, ...props }: any) => <img {...props} />,
}))

describe('AlangDiscoverCard formal entry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: true } } })
  })

  it('renders a static Shenzhen entry without reading mission or location data', () => {
    render(<AlangDiscoverCard />)

    expect(screen.getByText('街头盲盒')).toBeInTheDocument()
    expect(screen.getByText('深圳限定')).toBeInTheDocument()
    expect(screen.getByText('城市里的数字角色，偶尔会出来聊两句')).toBeInTheDocument()
    expect(screen.queryByText('Beta')).not.toBeInTheDocument()
  })

  it('opens only the Flash home after an explicit tap', () => {
    render(<AlangDiscoverCard />)

    fireEvent.click(screen.getByRole('button', { name: '进入街头盲盒，查看深圳当前在线的数字角色' }))

    expect(mocks.haptics).toHaveBeenCalledWith('light')
    expect(mocks.cardTap).toHaveBeenCalledTimes(1)
    expect(Taro.navigateTo).toHaveBeenCalledWith({ url: '/pages/alang/event/index' })
  })

  it('surfaces a visible recovery message when the Flash subpackage cannot open', async () => {
    vi.mocked(Taro.navigateTo).mockRejectedValueOnce(new Error('page is not found'))
    render(<AlangDiscoverCard />)

    fireEvent.click(screen.getByRole('button', { name: '进入街头盲盒，查看深圳当前在线的数字角色' }))

    await waitFor(() => {
      expect(Taro.showToast).toHaveBeenCalledWith({
        title: '街头盲盒打开失败，请更新小程序后重试',
        icon: 'none',
      })
    })
  })

  it('fails closed when the server flag is disabled', () => {
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: false } } })
    render(<AlangDiscoverCard />)

    expect(screen.queryByText('街头盲盒')).not.toBeInTheDocument()
  })
})

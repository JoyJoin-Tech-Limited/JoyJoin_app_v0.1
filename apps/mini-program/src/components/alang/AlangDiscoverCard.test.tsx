import { fireEvent, render, screen } from '@testing-library/react'
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

    expect(screen.getByText('闪现')).toBeInTheDocument()
    expect(screen.getByText('深圳限定')).toBeInTheDocument()
    expect(screen.getByText('城市里的数字角色，偶尔会出来聊两句')).toBeInTheDocument()
    expect(screen.queryByText('Beta')).not.toBeInTheDocument()
  })

  it('opens only the Flash home after an explicit tap', () => {
    render(<AlangDiscoverCard />)

    fireEvent.click(screen.getByRole('button', { name: '进入闪现，查看深圳当前在线的数字角色' }))

    expect(mocks.haptics).toHaveBeenCalledWith('light')
    expect(mocks.cardTap).toHaveBeenCalledTimes(1)
    expect(Taro.navigateTo).toHaveBeenCalledWith({ url: '/pages/alang/event/index' })
  })

  it('fails closed when the server flag is disabled', () => {
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: false } } })
    render(<AlangDiscoverCard />)

    expect(screen.queryByText('闪现')).not.toBeInTheDocument()
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Taro from '@tarojs/taro'
import AlangDiscoverCard from './AlangDiscoverCard'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  haptics: vi.fn(),
  cardTap: vi.fn(),
  track: vi.fn(),
}))

vi.mock('../../hooks/useAuth', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../hooks/useMiniRevealMotion', () => ({
  useMiniRevealMotion: () => ({ shouldReduceMotion: false }),
}))
vi.mock('../../hooks/useDeviceTier', () => ({
  useDeviceTier: () => ({ isDegradation: false }),
}))
vi.mock('../../lib/analytics/discoverAnalytics', () => ({
  discoverAnalytics: { track: mocks.track },
}))
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

  it('remains visible when the legacy Alang flag is disabled', () => {
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: false } } })
    render(<AlangDiscoverCard />)

    expect(screen.getByText('街头盲盒')).toBeInTheDocument()
  })
})

describe('AlangDiscoverCard teaser mode (alangEnabled=false)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: false } } })
  })

  it('renders the 内测中 teaser variant instead of the live entry copy', () => {
    render(<AlangDiscoverCard />)

    expect(screen.getByText('街头盲盒')).toBeInTheDocument()
    expect(screen.getByText('内测中')).toBeInTheDocument()
    expect(screen.getByText('这座城市还藏着几个朋友，正在路上')).toBeInTheDocument()
    expect(screen.queryByText('深圳限定')).not.toBeInTheDocument()
  })

  it('fires the teaser impression exactly once per mount', () => {
    const { rerender } = render(<AlangDiscoverCard />)
    rerender(<AlangDiscoverCard />)

    const impressions = mocks.track.mock.calls.filter(([event]) => event === 'flash_teaser_impression')
    expect(impressions).toHaveLength(1)
    expect(impressions[0][2]).toEqual({ surface: 'card' })
  })

  it('routes to the static teaser page and tracks the teaser tap', () => {
    render(<AlangDiscoverCard />)

    fireEvent.click(screen.getByRole('button', { name: '街头盲盒内测预告，点击查看' }))

    expect(mocks.haptics).toHaveBeenCalledWith('light')
    expect(Taro.navigateTo).toHaveBeenCalledWith({ url: '/pages/alang/teaser/index' })
    expect(mocks.track).toHaveBeenCalledWith('flash_teaser_tap', undefined, { surface: 'card' })
    expect(mocks.cardTap).not.toHaveBeenCalled()
  })

  it('fails closed to teaser mode when the features map is missing', () => {
    mocks.useAuth.mockReturnValue({ user: null })
    render(<AlangDiscoverCard />)

    expect(screen.getByText('内测中')).toBeInTheDocument()
  })

  it('surfaces a visible recovery message when the teaser page cannot open', async () => {
    vi.mocked(Taro.navigateTo).mockRejectedValueOnce(new Error('page is not found'))
    render(<AlangDiscoverCard />)

    fireEvent.click(screen.getByRole('button', { name: '街头盲盒内测预告，点击查看' }))

    await waitFor(() => {
      expect(Taro.showToast).toHaveBeenCalledWith({
        title: '预告页打开失败，请更新小程序后重试',
        icon: 'none',
      })
    })
  })
})

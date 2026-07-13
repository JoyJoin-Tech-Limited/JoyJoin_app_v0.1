import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Taro from '@tarojs/taro'
import AlangDiscoverCard from './AlangDiscoverCard'

const { mockUseAuth, mockUseAlangMissions } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseAlangMissions: vi.fn(),
}))

const { mockHaptics } = vi.hoisted(() => ({
  mockHaptics: vi.fn(),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('../../lib/alang/useAlangMission', () => ({
  useAlangMissions: mockUseAlangMissions,
}))

vi.mock('../../lib/alang/alangAnalytics', () => ({
  alangEvents: { discoverCardTap: vi.fn() },
}))

vi.mock('../../lib/utils/haptics', () => ({
  haptics: mockHaptics,
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, ...props }: any) => <img {...props} />,
}))

describe('AlangDiscoverCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { appMode: 'production', features: { alangEnabled: true } },
    })
    mockUseAlangMissions.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    })
  })

  it('stays visible in staging while mission data is loading', () => {
    render(<AlangDiscoverCard />)

    expect(screen.getByText('闪现 NPC｜阿浪')).toBeInTheDocument()
    expect(screen.getByText('正在准备阿浪的线索…')).toBeInTheDocument()
    expect(mockUseAlangMissions).toHaveBeenCalledWith(true)
  })

  it('stays visible when the enabled mission query is empty', () => {
    mockUseAlangMissions.mockReturnValue({ data: [], isLoading: false, isError: false })
    render(<AlangDiscoverCard />)

    expect(screen.getByText('闪现 NPC｜阿浪')).toBeInTheDocument()
    expect(screen.getByText('进入阿浪故事 →')).toBeInTheDocument()
  })

  it('stays visible when the enabled mission query fails', () => {
    mockUseAlangMissions.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    render(<AlangDiscoverCard />)

    expect(screen.getByText('阿浪暂时没回消息，点进来再试一次。')).toBeInTheDocument()
  })

  it('hides when alangEnabled is false', () => {
    mockUseAuth.mockReturnValue({
      user: { appMode: 'test', features: { alangEnabled: false } },
    })
    render(<AlangDiscoverCard />)

    expect(screen.queryByText('闪现 NPC｜阿浪')).not.toBeInTheDocument()
    expect(mockUseAlangMissions).toHaveBeenCalledWith(false)
  })

  it('opens the Alang list fallback before mission data is available', () => {
    render(<AlangDiscoverCard />)

    fireEvent.click(screen.getByText('闪现 NPC｜阿浪'))
    expect(mockHaptics).toHaveBeenCalledWith('light')
    expect(Taro.navigateTo).toHaveBeenCalledWith({ url: '/pages/alang/event/index' })
  })
})

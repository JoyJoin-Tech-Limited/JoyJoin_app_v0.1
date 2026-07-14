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

const mission = (overrides: Record<string, unknown> = {}) => ({
  id: 'mission-1',
  slug: 'alang-demo',
  title: '阿浪今晚想去吹吹风',
  description: '他在城市里留了一段没有说完的话。',
  status: 'not_started',
  stage: 'not_started',
  progressPercent: 0,
  isDebugSession: false,
  ...overrides,
})

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

  it('keeps the Reference 03 entry visible while mission data is loading', () => {
    const { container } = render(<AlangDiscoverCard />)

    expect(screen.getByText('闪现')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('附近有个角色，正等你出发')).toBeInTheDocument()
    expect(screen.getByText('正在看看谁出现了…')).toBeInTheDocument()
    expect(screen.getByText('附近角色')).toBeInTheDocument()
    expect(screen.getByText('位置保持神秘')).toBeInTheDocument()
    expect(screen.getByText('到达后触发故事')).toBeInTheDocument()
    expect(container.querySelectorAll('.alang-discover-card__chip')).toHaveLength(3)
    expect(mockUseAlangMissions).toHaveBeenCalledWith(true)
  })

  it('keeps a single usable CTA when the enabled mission query is empty', () => {
    mockUseAlangMissions.mockReturnValue({ data: [], isLoading: false, isError: false })
    render(<AlangDiscoverCard />)

    expect(screen.getByRole('button', { name: '进入闪现' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('uses warm recovery copy when the enabled mission query fails', () => {
    mockUseAlangMissions.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    render(<AlangDiscoverCard />)

    expect(screen.getByText('今晚的角色还没回信')).toBeInTheDocument()
    expect(screen.getByText('先逛逛别处，稍后再回来看看。')).toBeInTheDocument()
  })

  it('hides when alangEnabled is false', () => {
    mockUseAuth.mockReturnValue({
      user: { appMode: 'test', features: { alangEnabled: false } },
    })
    render(<AlangDiscoverCard />)

    expect(screen.queryByText('闪现')).not.toBeInTheDocument()
    expect(mockUseAlangMissions).toHaveBeenCalledWith(false)
  })

  it('opens the Alang list fallback when no mission is available', () => {
    mockUseAlangMissions.mockReturnValue({ data: [], isLoading: false, isError: false })
    render(<AlangDiscoverCard />)

    fireEvent.click(screen.getByRole('button', { name: '进入闪现' }))
    expect(mockHaptics).toHaveBeenCalledWith('light')
    expect(Taro.navigateTo).toHaveBeenCalledWith({ url: '/pages/alang/event/index' })
  })

  it('prioritizes an in-progress story over the first mission', () => {
    mockUseAlangMissions.mockReturnValue({
      data: [
        mission({ id: 'new', slug: 'new-story', title: '一段新故事' }),
        mission({
          id: 'active',
          slug: 'active-story',
          title: '还没说完的那一晚',
          status: 'in_progress',
          stage: 'searching',
          progressPercent: 35,
        }),
      ],
      isLoading: false,
      isError: false,
    })
    render(<AlangDiscoverCard />)

    expect(screen.getByText('还没说完的那一晚')).toBeInTheDocument()
    expect(screen.getByText('可继续上次进度')).toBeInTheDocument()
    expect(screen.queryByText('一段新故事')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '继续这段故事' }))
    expect(Taro.navigateTo).toHaveBeenCalledWith({
      url: '/pages/alang/event-detail/index?slug=active-story',
    })
  })
})

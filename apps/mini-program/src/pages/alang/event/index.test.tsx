import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AlangEventPage from './index'

const mocks = vi.hoisted(() => ({
  view: 'stories',
  navigateTo: vi.fn(),
  redirectTo: vi.fn(),
  setNavigationBarTitle: vi.fn(),
  useAuth: vi.fn(),
  useAlangMissions: vi.fn(),
  useStoryArchives: vi.fn(),
  refetchMissions: vi.fn(),
  refetchArchives: vi.fn(),
  haptics: vi.fn(),
}))

vi.mock('@tarojs/taro', () => {
  const taro = {
    getCurrentInstance: () => ({
      router: { params: { view: mocks.view } },
    }),
    navigateTo: mocks.navigateTo,
    redirectTo: mocks.redirectTo,
    setNavigationBarTitle: mocks.setNavigationBarTitle,
  }
  return { default: taro }
})

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, onError: _onError, ...props }: any) => <img {...props} />,
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: mocks.useAuth,
}))

vi.mock('../../../lib/alang/useAlangMission', () => ({
  useAlangMissions: mocks.useAlangMissions,
  useStoryArchives: mocks.useStoryArchives,
}))

vi.mock('../../../lib/alang/alangAnalytics', () => ({
  alangEvents: {
    discoverCardImpression: vi.fn(),
    discoverCardTap: vi.fn(),
  },
}))

vi.mock('../../../lib/alang/alangAssets', () => ({
  useAlangAssetSource: vi.fn(() => ({
    src: '/assets/lovart/alang-result-placeholder.webp',
    onError: vi.fn(),
    usingFallback: true,
  })),
}))

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: mocks.haptics,
}))

vi.mock('../../../components/ui/StatusCard', () => ({
  default: ({ title, description, action }: any) => (
    <div>
      <span>{title}</span>
      <span>{description}</span>
      {action ? <button onClick={action.onClick}>{action.label}</button> : null}
    </div>
  ),
}))

const archives = [
  {
    id: 'archive-1',
    missionId: 'mission-1',
    title: '夜跑遇见的桥上',
    locationName: '南头古城',
    completedAt: '2026-07-12T23:15:00+08:00',
    finalMood: '思考',
    summaryLine: '风把没说完的话留在桥边。',
    isDebugSession: false,
  },
  {
    id: 'archive-2',
    missionId: 'mission-2',
    title: '雨后的偶遇',
    locationName: '南头古城',
    completedAt: '2026-07-04T18:40:00+08:00',
    finalMood: '温暖',
    summaryLine: '雨停后，城市亮了一点。',
    isDebugSession: false,
  },
]

const missions = [
  {
    id: 'mission-3',
    slug: 'meet-alang',
    title: '阿浪还有一段路想一起走',
    description: '从上次停下的地方继续。',
    status: 'in_progress',
    stage: 'searching',
    progressPercent: 42,
    isDebugSession: false,
  },
  {
    id: 'mission-4',
    slug: 'another-story',
    title: '今晚的新故事',
    description: '一段新的城市片段。',
    status: 'not_started',
    stage: 'not_started',
    progressPercent: 0,
    isDebugSession: false,
  },
]

describe('AlangEventPage story archive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.view = 'stories'
    mocks.navigateTo.mockResolvedValue({})
    mocks.redirectTo.mockResolvedValue({})
    mocks.setNavigationBarTitle.mockResolvedValue({})
    mocks.useAuth.mockReturnValue({
      user: { features: { alangEnabled: true } },
    })
    mocks.useAlangMissions.mockReturnValue({
      data: missions,
      isLoading: false,
      error: null,
      refetch: mocks.refetchMissions,
    })
    mocks.useStoryArchives.mockReturnValue({
      data: archives,
      isLoading: false,
      error: null,
      refetch: mocks.refetchArchives,
    })
  })

  it('builds the summary from real archives, active missions, and unique locations', async () => {
    render(<AlangEventPage />)

    expect(screen.getByRole('region', {
      name: '2 段故事收藏，1 条仍在继续，1 个故事地点',
    })).toBeInTheDocument()
    expect(screen.getByText('夜跑遇见的桥上')).toBeInTheDocument()
    expect(screen.getAllByText('地点 · 南头古城')).toHaveLength(2)
    expect(screen.getByText('故事总览场景示意')).toBeInTheDocument()
    expect(mocks.useAlangMissions).toHaveBeenCalledWith(true)
    expect(mocks.useStoryArchives).toHaveBeenCalledWith(true)

    await waitFor(() => {
      expect(mocks.setNavigationBarTitle).toHaveBeenCalledWith({ title: '我的故事' })
    })
  })

  it('opens an archive with haptic feedback', () => {
    render(<AlangEventPage />)

    fireEvent.click(screen.getByRole('button', { name: /打开故事：夜跑遇见的桥上/ }))

    expect(mocks.haptics).toHaveBeenCalledWith('light')
    expect(mocks.navigateTo).toHaveBeenCalledWith({
      url: '/pages/alang/story-detail/index?archiveId=archive-1',
    })
  })

  it('filters to real in-progress missions and continues through the existing detail route', () => {
    render(<AlangEventPage />)

    fireEvent.click(screen.getByRole('tab', { name: '查看继续中的故事' }))

    expect(screen.getByText('阿浪还有一段路想一起走')).toBeInTheDocument()
    expect(screen.getByText('进度 · 已走完 42%')).toBeInTheDocument()
    expect(screen.getByText('寻找中')).toBeInTheDocument()
    expect(screen.queryByText('今晚的新故事')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /继续故事：阿浪还有一段路想一起走/ }))
    expect(mocks.navigateTo).toHaveBeenCalledWith({
      url: '/pages/alang/event-detail/index?slug=meet-alang',
    })
  })

  it('keeps a warm, actionable empty state without fabricated counts', () => {
    mocks.useAlangMissions.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: mocks.refetchMissions,
    })
    mocks.useStoryArchives.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: mocks.refetchArchives,
    })

    render(<AlangEventPage />)

    expect(screen.getByRole('region', {
      name: '0 段故事收藏，0 条仍在继续，0 个故事地点',
    })).toBeInTheDocument()
    expect(screen.getByText('故事页还在等第一章')).toBeInTheDocument()
    expect(screen.queryByText('12')).not.toBeInTheDocument()
    expect(screen.queryByText('680')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '去看看当前可开始的闪现故事' }))
    expect(mocks.redirectTo).toHaveBeenCalledWith({ url: '/pages/alang/event/index' })
  })

  it('preserves the ordinary mission-list mode', async () => {
    mocks.view = ''
    mocks.useStoryArchives.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: mocks.refetchArchives,
    })

    render(<AlangEventPage />)

    expect(screen.getByText('闪现')).toBeInTheDocument()
    expect(screen.getByText('今晚的新故事')).toBeInTheDocument()
    expect(mocks.useStoryArchives).toHaveBeenCalledWith(false)
    await waitFor(() => {
      expect(mocks.setNavigationBarTitle).toHaveBeenCalledWith({ title: '闪现' })
    })
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AlangEventDetailPage from './index'

const mocks = vi.hoisted(() => ({
  redirectTo: vi.fn(),
  showToast: vi.fn(),
  useAuth: vi.fn(),
  useAlangMissionDetail: vi.fn(),
  useStartMission: vi.fn(),
  useRecoverMission: vi.fn(),
  startMission: vi.fn(),
  recoverMission: vi.fn(),
  callReportProgress: vi.fn(),
  refetch: vi.fn(),
}))

vi.mock('@tarojs/taro', () => {
  const taro = {
    getCurrentInstance: () => ({
      router: { params: { slug: 'meet-alang' } },
    }),
    redirectTo: mocks.redirectTo,
    showToast: mocks.showToast,
  }
  return { default: taro }
})

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, ...props }: any) => <img {...props} />,
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: mocks.useAuth,
}))

vi.mock('../../../lib/alang/useAlangMission', () => ({
  useAlangMissionDetail: mocks.useAlangMissionDetail,
  useStartMission: mocks.useStartMission,
  useRecoverMission: mocks.useRecoverMission,
}))

vi.mock('../../../lib/alang/api', () => ({
  callReportProgress: mocks.callReportProgress,
}))

vi.mock('../../../lib/alang/alangAnalytics', () => ({
  alangEvents: {
    eventDetailView: vi.fn(),
    startSearchTap: vi.fn(),
  },
}))

vi.mock('../../../components/ui/StatusCard', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}))

function createMission(myProgress: Record<string, unknown> | null = null) {
  return {
    id: 'mission-1',
    slug: 'meet-alang',
    title: '阿浪今晚想去吹吹风',
    description: '他在城市里留了一段没有说完的话。',
    content: {
      version: '1.0',
      title: '阿浪的晚上',
      description: '一次真实相遇',
      startNodeId: 'event-card',
      meta: { npcName: '阿浪', estimatedDurationMinutes: 25 },
      nodes: [
        {
          id: 'event-card',
          type: 'event_card',
          content: { body: '今晚，有人正在等你。' },
          nextNodeId: 'event-detail',
        },
        {
          id: 'event-detail',
          type: 'event_detail',
          content: { body: '阿浪没说发生了什么，只问你愿不愿意出来走走。' },
          nextNodeId: 'search-gate',
        },
        {
          id: 'search-gate',
          type: 'search_gate',
          content: { body: '跟着接近提示去找他。' },
        },
      ],
    },
    myProgress,
  }
}

describe('AlangEventDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.redirectTo.mockResolvedValue({})
    mocks.useAuth.mockReturnValue({
      user: { appMode: 'production', features: { alangEnabled: true } },
    })
    mocks.useAlangMissionDetail.mockReturnValue({
      data: createMission(),
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    mocks.useStartMission.mockReturnValue({
      isPending: false,
      mutateAsync: mocks.startMission,
    })
    mocks.useRecoverMission.mockReturnValue({
      isPending: false,
      mutateAsync: mocks.recoverMission,
    })
    mocks.startMission.mockResolvedValue({
      stage: 'configuring',
      currentNodeId: 'event-detail',
      nodeHistory: ['event-card', 'event-detail'],
      choicesMade: [],
    })
    mocks.callReportProgress.mockResolvedValue({
      ok: true,
      stage: 'searching',
      currentNodeId: 'search-gate',
    })
  })

  it('shows the character event, Beta status, and distance promise', () => {
    render(<AlangEventDetailPage />)

    expect(screen.getByText('阿浪今晚想去吹吹风')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('阿浪没说发生了什么，只问你愿不愿意出来走走。')).toBeInTheDocument()
    expect(screen.getByText('定位只用于这段寻找')).toBeInTheDocument()
    expect(screen.getByText(/不会提前显示角色的精确位置/)).toBeInTheDocument()
  })

  it('advances an ordinary user one legal server edge before redirecting to search', async () => {
    render(<AlangEventDetailPage />)

    fireEvent.click(screen.getByRole('button', { name: '出发去找阿浪' }))

    await waitFor(() => {
      expect(mocks.callReportProgress).toHaveBeenCalledWith('meet-alang', 'search-gate')
    })
    expect(mocks.redirectTo).toHaveBeenCalledWith({
      url: '/pages/alang/search/index?slug=meet-alang&nodeId=search-gate',
    })
    expect(mocks.redirectTo).not.toHaveBeenCalledWith({
      url: '/pages/alang/config/index?slug=meet-alang',
    })
  })

  it('never skips a server edge when recovering from not_started', async () => {
    mocks.startMission.mockResolvedValue({
      stage: 'not_started',
      currentNodeId: 'event-card',
      nodeHistory: ['event-card'],
      choicesMade: [],
    })
    mocks.callReportProgress
      .mockResolvedValueOnce({
        ok: true,
        stage: 'configuring',
        currentNodeId: 'event-detail',
      })
      .mockResolvedValueOnce({
        ok: true,
        stage: 'searching',
        currentNodeId: 'search-gate',
      })

    render(<AlangEventDetailPage />)
    fireEvent.click(screen.getByRole('button', { name: '出发去找阿浪' }))

    await waitFor(() => expect(mocks.callReportProgress).toHaveBeenCalledTimes(2))
    expect(mocks.callReportProgress.mock.calls).toEqual([
      ['meet-alang', 'event-detail'],
      ['meet-alang', 'search-gate'],
    ])
    expect(mocks.redirectTo).toHaveBeenCalledWith({
      url: '/pages/alang/search/index?slug=meet-alang&nodeId=search-gate',
    })
  })

  it('allows a strict test-mode user to enter the configuration page', async () => {
    mocks.useAuth.mockReturnValue({
      user: { appMode: 'test', features: { alangEnabled: true } },
    })

    render(<AlangEventDetailPage />)
    fireEvent.click(screen.getByRole('button', { name: '出发去找阿浪' }))

    await waitFor(() => {
      expect(mocks.redirectTo).toHaveBeenCalledWith({
        url: '/pages/alang/config/index?slug=meet-alang',
      })
    })
    expect(mocks.callReportProgress).not.toHaveBeenCalled()
  })

  it('recovers an in-progress search with an accurate CTA and replaces detail in the stack', async () => {
    mocks.useAlangMissionDetail.mockReturnValue({
      data: createMission({
        progressId: 'progress-1',
        status: 'in_progress',
        stage: 'searching',
        currentNodeId: 'search-gate',
        nodeHistory: ['event-card', 'event-detail', 'search-gate'],
        choicesMade: [],
        isDebugSession: false,
      }),
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    mocks.recoverMission.mockResolvedValue({
      stage: 'searching',
      currentNodeId: 'search-gate',
      nodeHistory: ['event-card', 'event-detail', 'search-gate'],
      choicesMade: [],
    })

    render(<AlangEventDetailPage />)
    fireEvent.click(screen.getByRole('button', { name: '继续寻找阿浪' }))

    await waitFor(() => expect(mocks.recoverMission).toHaveBeenCalledWith('meet-alang'))
    expect(mocks.startMission).not.toHaveBeenCalled()
    expect(mocks.callReportProgress).not.toHaveBeenCalled()
    expect(mocks.redirectTo).toHaveBeenCalledWith({
      url: '/pages/alang/search/index?slug=meet-alang&nodeId=search-gate',
    })
  })

  it('sends a completed story straight to its result', () => {
    mocks.useAlangMissionDetail.mockReturnValue({
      data: createMission({
        progressId: 'progress-1',
        status: 'completed',
        stage: 'completed',
        currentNodeId: 'result',
        nodeHistory: [],
        choicesMade: [],
        isDebugSession: false,
      }),
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })

    render(<AlangEventDetailPage />)
    fireEvent.click(screen.getByRole('button', { name: '查看这段故事' }))

    expect(mocks.redirectTo).toHaveBeenCalledWith({
      url: '/pages/alang/result/index?slug=meet-alang',
    })
    expect(mocks.startMission).not.toHaveBeenCalled()
    expect(mocks.recoverMission).not.toHaveBeenCalled()
  })
})

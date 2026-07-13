import { fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AlangResultPage from './index'

const mocks = vi.hoisted(() => ({
  navigateTo: vi.fn(),
  redirectTo: vi.fn(),
  switchTab: vi.fn(),
  showToast: vi.fn(),
  useDidShow: vi.fn(),
  useAlangMissionDetail: vi.fn(),
  useStoryArchives: vi.fn(),
  useCompleteMission: vi.fn(),
  completeMission: vi.fn(),
  refetchMission: vi.fn(),
  refetchArchives: vi.fn(),
  callReportProgress: vi.fn(),
}))

vi.mock('@tarojs/taro', () => {
  const taro = {
    getCurrentInstance: () => ({
      router: { params: { slug: 'meet-alang' } },
    }),
    navigateTo: mocks.navigateTo,
    redirectTo: mocks.redirectTo,
    switchTab: mocks.switchTab,
    showToast: mocks.showToast,
  }
  return {
    default: taro,
    useDidShow: mocks.useDidShow,
  }
})

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, ...props }: any) => <img {...props} />,
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { features: { alangEnabled: true } } }),
}))

vi.mock('../../../lib/alang/useAlangMission', () => ({
  useAlangMissionDetail: mocks.useAlangMissionDetail,
  useStoryArchives: mocks.useStoryArchives,
  useCompleteMission: mocks.useCompleteMission,
}))

vi.mock('../../../lib/alang/api', () => ({
  callReportProgress: mocks.callReportProgress,
}))

vi.mock('../../../lib/alang/alangAnalytics', () => ({
  alangEvents: {
    resultPageView: vi.fn(),
    resultConfirmTap: vi.fn(),
  },
}))

vi.mock('../../../lib/alang/alangAssets', () => ({
  useAlangAssetSource: () => ({
    src: 'mock-alang-result.webp',
    usingFallback: false,
    onError: vi.fn(),
  }),
}))

vi.mock('../../../components/ui/StatusCard', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}))

function createMission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mission-1',
    slug: 'meet-alang',
    content: {
      version: '1.0',
      title: 'Alang story',
      description: 'A city encounter',
      startNodeId: 'result-card',
      nodes: [
        {
          id: 'result-card',
          type: 'result_card',
          content: {
            locationLabel: 'Shenzhen',
            finalMood: 'calm',
            summaryLine: 'A finished walk',
          },
        },
      ],
    },
    myProgress: {
      progressId: 'progress-1',
      status: 'in_progress',
      stage: 'result',
      currentNodeId: 'result-card',
      nodeHistory: ['result-card'],
      choicesMade: [],
      isDebugSession: false,
      ...overrides,
    },
  }
}

describe('AlangResultPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.navigateTo.mockResolvedValue({})
    mocks.redirectTo.mockResolvedValue({})
    mocks.switchTab.mockResolvedValue({})
    mocks.refetchMission.mockResolvedValue({ data: createMission() })
    mocks.refetchArchives.mockResolvedValue({ data: [] })
    mocks.completeMission.mockResolvedValue({ archiveId: 'archive-new' })
    mocks.useAlangMissionDetail.mockReturnValue({
      data: createMission(),
      isLoading: false,
      isError: false,
      refetch: mocks.refetchMission,
    })
    mocks.useStoryArchives.mockReturnValue({
      data: [],
      refetch: mocks.refetchArchives,
    })
    mocks.useCompleteMission.mockReturnValue({
      isPending: false,
      mutateAsync: mocks.completeMission,
    })
  })

  it('shows the unarchived result card without completing or advancing automatically', () => {
    const { container } = render(<AlangResultPage />)

    expect(container.querySelector('.alang-result__card')).toBeInTheDocument()
    expect(container.querySelector('.alang-result__cta')).toBeInTheDocument()
    expect(mocks.completeMission).not.toHaveBeenCalled()
    expect(mocks.callReportProgress).not.toHaveBeenCalled()
    expect(mocks.redirectTo).not.toHaveBeenCalled()
  })

  it('restores the same unarchived result card after a page refresh breakpoint', () => {
    const firstRender = render(<AlangResultPage />)
    expect(firstRender.container.querySelector('.alang-result__card')).toBeInTheDocument()
    firstRender.unmount()

    const refreshedRender = render(<AlangResultPage />)
    expect(refreshedRender.container.querySelector('.alang-result__card')).toBeInTheDocument()
    expect(refreshedRender.container.querySelector('.alang-result__completed')).not.toBeInTheDocument()
    expect(mocks.completeMission).not.toHaveBeenCalled()
    expect(mocks.callReportProgress).not.toHaveBeenCalled()
  })

  it('completes only after the user explicitly collects the story', async () => {
    const { container } = render(<AlangResultPage />)

    fireEvent.click(container.querySelector('.alang-result__cta') as Element)

    await waitFor(() => {
      expect(mocks.completeMission).toHaveBeenCalledWith('meet-alang')
    })
    expect(mocks.completeMission).toHaveBeenCalledTimes(1)
    expect(mocks.callReportProgress).not.toHaveBeenCalled()
    expect(container.querySelector('.alang-result__completed')).toBeInTheDocument()
  })

  it('recovers the story entry directly from myProgress.archiveId after completion', async () => {
    mocks.useAlangMissionDetail.mockReturnValue({
      data: createMission({
        status: 'completed',
        stage: 'completed',
        archiveId: 'archive-from-progress',
      }),
      isLoading: false,
      isError: false,
      refetch: mocks.refetchMission,
    })

    const { container } = render(<AlangResultPage />)

    await waitFor(() => {
      expect(container.querySelector('.alang-result__completed')).toBeInTheDocument()
    })
    expect(mocks.completeMission).not.toHaveBeenCalled()

    const storyEntry = container.querySelector('.alang-result__completed-btn')
    expect(storyEntry).toBeInTheDocument()
    fireEvent.click(storyEntry as Element)

    expect(mocks.navigateTo).toHaveBeenCalledWith({
      url: '/pages/alang/story-detail/index?archiveId=archive-from-progress',
    })
    expect(mocks.refetchArchives).not.toHaveBeenCalled()
  })
})

import { fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AlangResultPage from './index'

const mocks = vi.hoisted(() => ({
  navigateTo: vi.fn(),
  redirectTo: vi.fn(),
  switchTab: vi.fn(),
  reLaunch: vi.fn(),
  showToast: vi.fn(),
  showModal: vi.fn(),
  useDidShow: vi.fn(),
  useAlangMissionDetail: vi.fn(),
  useStoryArchives: vi.fn(),
  useCompleteMission: vi.fn(),
  completeMission: vi.fn(),
  resetMission: vi.fn(),
  refetchMission: vi.fn(),
  refetchArchives: vi.fn(),
  callReportProgress: vi.fn(),
  authUser: {
    current: { appMode: 'production', features: { alangEnabled: true, personalStoryEnabled: true } } as any,
  },
}))

vi.mock('@tarojs/taro', () => {
  const taro = {
    getCurrentInstance: () => ({
      router: { params: { slug: 'meet-alang' } },
    }),
    navigateTo: mocks.navigateTo,
    redirectTo: mocks.redirectTo,
    switchTab: mocks.switchTab,
    reLaunch: mocks.reLaunch,
    showToast: mocks.showToast,
    showModal: mocks.showModal,
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
  useAuth: () => ({ user: mocks.authUser.current }),
}))

vi.mock('../../../lib/alang/useAlangMission', () => ({
  useAlangMissionDetail: mocks.useAlangMissionDetail,
  useStoryArchives: mocks.useStoryArchives,
  useCompleteMission: mocks.useCompleteMission,
  useResetAlangMission: () => ({
    isPending: false,
    mutateAsync: mocks.resetMission,
  }),
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

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
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
    mocks.reLaunch.mockResolvedValue({})
    mocks.showModal.mockResolvedValue({ confirm: true, cancel: false })
    mocks.refetchMission.mockResolvedValue({ data: createMission() })
    mocks.refetchArchives.mockResolvedValue({ data: [] })
    mocks.completeMission.mockResolvedValue({ archiveId: 'archive-new' })
    mocks.resetMission.mockResolvedValue({
      reset: true,
      deletedProgressCount: 1,
      deletedArchiveCount: 1,
    })
    mocks.authUser.current = {
      appMode: 'production',
      features: { alangEnabled: true, personalStoryEnabled: true },
    }
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
      url: '/pages/profile-linked/personal-story/index',
    })
    expect(mocks.refetchArchives).not.toHaveBeenCalled()
  })

  it('falls back to the archived Alang story while personal story rollout is disabled', async () => {
    mocks.authUser.current = {
      appMode: 'production',
      features: { alangEnabled: true, personalStoryEnabled: false },
    }
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
    await waitFor(() => expect(container.querySelector('.alang-result__completed')).toBeInTheDocument())
    fireEvent.click(container.querySelector('.alang-result__completed-btn') as Element)

    expect(mocks.navigateTo).toHaveBeenCalledWith({
      url: '/pages/alang/story-detail/index?archiveId=archive-from-progress',
    })
  })

  it('does not show the retest entry outside single-test mode', async () => {
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

    const { queryByText } = render(<AlangResultPage />)

    await waitFor(() => {
      expect(queryByText('故事已收录')).toBeInTheDocument()
    })
    expect(queryByText('重新测试阿浪')).not.toBeInTheDocument()
  })

  it('shows the retest entry only for an archived result in single-test mode', async () => {
    mocks.authUser.current = {
      appMode: 'test',
      singleTestMode: true,
      features: { alangEnabled: true },
    }
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

    const { findByText } = render(<AlangResultPage />)

    expect(await findByText('重新测试阿浪')).toBeInTheDocument()
  })

  it('asks for confirmation and cancellation does not reset', async () => {
    mocks.authUser.current = {
      appMode: 'test',
      singleTestMode: true,
      features: { alangEnabled: true },
    }
    mocks.showModal.mockResolvedValue({ confirm: false, cancel: true })
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

    const { findByText } = render(<AlangResultPage />)
    fireEvent.click(await findByText('重新测试阿浪'))

    await waitFor(() => {
      expect(mocks.showModal).toHaveBeenCalledWith(expect.objectContaining({
        content: '将清除当前账号本次阿浪测试的进度与测试故事，是否重新开始？',
      }))
    })
    expect(mocks.resetMission).not.toHaveBeenCalled()
    expect(mocks.reLaunch).not.toHaveBeenCalled()
  })

  it('relaunches the fresh point configuration after a successful reset', async () => {
    mocks.authUser.current = {
      appMode: 'test',
      singleTestMode: true,
      features: { alangEnabled: true },
    }
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

    const { findByText } = render(<AlangResultPage />)
    fireEvent.click(await findByText('重新测试阿浪'))

    await waitFor(() => {
      expect(mocks.resetMission).toHaveBeenCalledWith('meet-alang')
      expect(mocks.showToast).toHaveBeenCalledWith({
        title: '已重置，可以重新测试',
        icon: 'success',
      })
      expect(mocks.reLaunch).toHaveBeenCalledWith({
        url: '/pages/alang/config/index?slug=meet-alang',
      })
    })
  })

  it('keeps the result page open when reset fails', async () => {
    mocks.authUser.current = {
      appMode: 'test',
      singleTestMode: true,
      features: { alangEnabled: true },
    }
    mocks.resetMission.mockRejectedValue(new Error('RESET_FAILED'))
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

    const { findByText } = render(<AlangResultPage />)
    fireEvent.click(await findByText('重新测试阿浪'))

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith({
        title: '重置没成功，请稍后再试',
        icon: 'none',
      })
    })
    expect(mocks.reLaunch).not.toHaveBeenCalled()
  })

  it('sends only one reset request when the retest entry is tapped repeatedly', async () => {
    mocks.authUser.current = {
      appMode: 'test',
      singleTestMode: true,
      features: { alangEnabled: true },
    }
    let resolveReset: ((value: unknown) => void) | undefined
    mocks.resetMission.mockImplementation(() => new Promise((resolve) => {
      resolveReset = resolve
    }))
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

    const { findByText } = render(<AlangResultPage />)
    const button = await findByText('重新测试阿浪')
    fireEvent.click(button)
    fireEvent.click(button)

    await waitFor(() => {
      expect(mocks.resetMission).toHaveBeenCalledTimes(1)
    })
    resolveReset?.({ reset: true, deletedProgressCount: 1, deletedArchiveCount: 1 })
    await waitFor(() => {
      expect(mocks.reLaunch).toHaveBeenCalledTimes(1)
    })
  })
})

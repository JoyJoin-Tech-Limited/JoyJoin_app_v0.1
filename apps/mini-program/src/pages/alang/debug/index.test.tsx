import { fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AlangDebugPage from './index'

const mocks = vi.hoisted(() => ({
  navigateTo: vi.fn(),
  reLaunch: vi.fn(),
  showModal: vi.fn(),
  showToast: vi.fn(),
  resetMission: vi.fn(),
  refetchMission: vi.fn(),
  refetchArchives: vi.fn(),
  callDebugMockGps: vi.fn(),
  callDebugForceNode: vi.fn(),
  authUser: {
    current: { appMode: 'production', features: { alangEnabled: true } },
  },
  mission: {
    current: null as any,
  },
  archives: {
    current: [] as any[],
  },
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getCurrentInstance: () => ({
      router: { params: { slug: 'meet-alang' } },
    }),
    navigateTo: mocks.navigateTo,
    reLaunch: mocks.reLaunch,
    showModal: mocks.showModal,
    showToast: mocks.showToast,
  },
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Input: ({ onInput, ...props }: any) => (
    <input
      {...props}
      onInput={(event) => onInput?.({ detail: { value: event.currentTarget.value } })}
    />
  ),
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.authUser.current }),
}))

vi.mock('../../../lib/alang/useAlangMission', () => ({
  useAlangMissionDetail: () => ({
    data: mocks.mission.current,
    isLoading: false,
    refetch: mocks.refetchMission,
  }),
  useStoryArchives: () => ({
    data: mocks.archives.current,
    isLoading: false,
    refetch: mocks.refetchArchives,
  }),
  useResetAlangMission: () => ({
    isPending: false,
    mutateAsync: mocks.resetMission,
  }),
}))

vi.mock('../../../lib/alang/api', () => ({
  callDebugMockGps: mocks.callDebugMockGps,
  callDebugForceNode: mocks.callDebugForceNode,
}))

vi.mock('../../../lib/alang/alangAnalytics', () => ({
  alangEvents: {
    debugResetTap: vi.fn(),
    debugMockGpsTap: vi.fn(),
    debugForceNodeTap: vi.fn(),
  },
}))

function completedMission() {
  return {
    id: 'mission-1',
    slug: 'meet-alang',
    content: { version: '1.0', nodes: [] },
    myProgress: {
      progressId: 'progress-1',
      status: 'completed',
      stage: 'completed',
      currentNodeId: 'result-card',
      nodeHistory: ['result-card'],
      choicesMade: [],
      isDebugSession: true,
      archiveId: 'archive-1',
    },
  }
}

describe('AlangDebugPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authUser.current = {
      appMode: 'production',
      features: { alangEnabled: true },
    }
    mocks.mission.current = completedMission()
    mocks.archives.current = [{ id: 'archive-1', missionId: 'mission-1' }]
    mocks.showModal.mockResolvedValue({ confirm: true, cancel: false })
    mocks.resetMission.mockResolvedValue({
      reset: true,
      deletedProgressCount: 1,
      deletedArchiveCount: 1,
    })
    mocks.reLaunch.mockResolvedValue({})
    mocks.refetchMission.mockResolvedValue({ data: { ...completedMission(), myProgress: null } })
    mocks.refetchArchives.mockResolvedValue({ data: [] })
  })

  it('does not render debug or reset controls outside single-test mode', () => {
    const { container, queryByText } = render(<AlangDebugPage />)

    expect(container).toBeEmptyDOMElement()
    expect(queryByText('重置当前阿浪测试')).not.toBeInTheDocument()
  })

  it('shows progress, archive presence and story version in single-test mode', () => {
    mocks.authUser.current = {
      appMode: 'test',
      features: { alangEnabled: true },
    }

    const { getByText, queryByText } = render(<AlangDebugPage />)

    expect(getByText('completed / completed')).toBeInTheDocument()
    expect(getByText('是')).toBeInTheDocument()
    expect(getByText('1.0')).toBeInTheDocument()
  })

  it('resets the current run, shows fresh state and relaunches point configuration', async () => {
    mocks.authUser.current = {
      appMode: 'test',
      features: { alangEnabled: true },
    }
    mocks.resetMission.mockResolvedValue({
      reset: true,
      deletedProgressCount: 0,
      deletedArchiveCount: 0,
    })

    const { findByText, getByText } = render(<AlangDebugPage />)
    fireEvent.click(getByText('重置当前阿浪测试'))

    expect(await findByText('开始新一轮测试')).toBeInTheDocument()
    expect(mocks.resetMission).toHaveBeenCalledWith('meet-alang')
    expect(mocks.showToast).toHaveBeenCalledWith({
      title: '已重置，可以重新测试',
      icon: 'success',
    })
    expect(getByText('not_started / not_started')).toBeInTheDocument()
    expect(getByText('否')).toBeInTheDocument()
    expect(await findByText(/progress=0, archive=0/)).toBeInTheDocument()

    fireEvent.click(getByText('开始新一轮测试'))
    expect(mocks.reLaunch).toHaveBeenCalledWith({
      url: '/pages/alang/config/index?slug=meet-alang',
    })
  })

  it('cancels without resetting', async () => {
    mocks.authUser.current = {
      appMode: 'test',
      features: { alangEnabled: true },
    }
    mocks.showModal.mockResolvedValue({ confirm: false, cancel: true })

    const { getByText, queryByText } = render(<AlangDebugPage />)
    fireEvent.click(getByText('重置当前阿浪测试'))

    await waitFor(() => {
      expect(mocks.showModal).toHaveBeenCalled()
    })
    expect(mocks.resetMission).not.toHaveBeenCalled()
    expect(mocks.reLaunch).not.toHaveBeenCalled()
  })

  it('keeps the debug page open when reset fails', async () => {
    mocks.authUser.current = {
      appMode: 'test',
      features: { alangEnabled: true },
    }
    mocks.resetMission.mockRejectedValue(new Error('RESET_FAILED'))

    const { getByText, queryByText } = render(<AlangDebugPage />)
    fireEvent.click(getByText('重置当前阿浪测试'))

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith({
        title: '重置没成功，请稍后再试',
        icon: 'none',
      })
    })
    expect(mocks.reLaunch).not.toHaveBeenCalled()
    expect(getByText('completed / completed')).toBeInTheDocument()
    expect(getByText('重置当前阿浪测试')).toBeInTheDocument()
    expect(queryByText('开始新一轮测试')).not.toBeInTheDocument()
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AlangDialoguePage from './index'

const mocks = vi.hoisted(() => ({
  redirectTo: vi.fn(),
  showToast: vi.fn(),
  useAlangMissionDetail: vi.fn(),
  callReportProgress: vi.fn(),
  callSubmitChoice: vi.fn(),
  refetch: vi.fn(),
  syncMissionProgress: vi.fn(),
}))

vi.mock('@tarojs/taro', () => {
  const taro = {
    getCurrentInstance: () => ({
      router: { params: { slug: 'meet-alang', nodeId: 'dialogue-1' } },
    }),
    redirectTo: mocks.redirectTo,
    showToast: mocks.showToast,
  }
  return {
    default: taro,
    useDidShow: vi.fn(),
  }
})

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, ...props }: any) => <img {...props} />,
  ScrollView: ({ children, scrollY: _scrollY, enhanced: _enhanced, showScrollbar: _showScrollbar, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
}))

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { features: { alangEnabled: true } } }),
}))

vi.mock('../../../lib/alang/useAlangMission', () => ({
  useAlangMissionDetail: mocks.useAlangMissionDetail,
  useSyncAlangMissionProgress: () => mocks.syncMissionProgress,
}))

vi.mock('../../../lib/alang/api', () => ({
  callReportProgress: mocks.callReportProgress,
  callSubmitChoice: mocks.callSubmitChoice,
}))

vi.mock('../../../lib/alang/alangAnalytics', () => ({
  alangEvents: {
    dialoguePageView: vi.fn(),
    choiceMade: vi.fn(),
  },
}))

vi.mock('../../../components/ui/StatusCard', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}))

const mission = {
  content: {
    version: '1.0',
    title: '阿浪的晚上',
    description: '一次真实相遇',
    startNodeId: 'found',
    nodes: [
      {
        id: 'found',
        type: 'found_scene',
        content: { body: '你看见阿浪靠在墙边。', narration: '阿浪抬头看了你一眼。' },
        nextNodeId: 'dialogue-1',
      },
      {
        id: 'dialogue-1',
        type: 'dialogue',
        content: { body: '第一段', speaker: '阿浪' },
        choices: [
          { label: '先听听', response: '他慢慢开口。', nextNodeId: 'dialogue-2' },
          { label: '问问看', response: '他想了想。', nextNodeId: 'dialogue-2' },
        ],
      },
      {
        id: 'dialogue-2',
        type: 'dialogue',
        content: { body: '第二段', speaker: '阿浪' },
        choices: [
          { label: '不催他', response: '夜风安静了一会儿。', nextNodeId: 'dialogue-3' },
          { label: '递瓶水', response: '他接了过去。', nextNodeId: 'dialogue-3' },
        ],
      },
      {
        id: 'dialogue-3',
        type: 'dialogue',
        content: { body: '“我想走一走，你有空吗？”', speaker: '阿浪', moodTag: '有点犹豫' },
        choices: [
          { label: '陪你走走', response: '“那就一起吧。”', nextNodeId: 'companion' },
          { label: '先坐一会儿', response: '“也好。”', nextNodeId: 'companion' },
        ],
      },
      {
        id: 'companion',
        type: 'companion_start',
        content: { body: '阿浪站了起来。' },
      },
    ],
  },
  myProgress: {
    progressId: 'progress-1',
    stage: 'dialogue',
    currentNodeId: 'dialogue-3',
    nodeHistory: ['found', 'dialogue-1', 'dialogue-2', 'dialogue-3'],
    choicesMade: [
      { nodeId: 'dialogue-1', choiceIndex: 0, label: '先听听' },
      { nodeId: 'dialogue-2', choiceIndex: 0, label: '不催他' },
    ],
    status: 'in_progress',
    isDebugSession: false,
  },
}

describe('AlangDialoguePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.redirectTo.mockResolvedValue({})
    mocks.refetch.mockResolvedValue({ data: mission })
    mocks.useAlangMissionDetail.mockReturnValue({
      data: mission,
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    mocks.callSubmitChoice.mockResolvedValue({
      nextNodeId: 'companion',
      response: '“那就一起吧。”',
      stage: 'companion',
    })
  })

  it('uses server progress and replays completed rounds as a story log instead of chat bubbles', async () => {
    const { container } = render(<AlangDialoguePage />)

    expect(screen.getByText('“我想走一走，你有空吗？”')).toBeInTheDocument()
    expect(screen.queryByText('第一段')).not.toBeInTheDocument()
    expect(await screen.findByText('你选择：先听听')).toBeInTheDocument()
    expect(screen.getByText('他慢慢开口。')).toBeInTheDocument()
    expect(container.querySelectorAll('.alang-dialogue__recap-item')).toHaveLength(2)
    expect(container.querySelector('.alang-dialogue__history-item')).not.toBeInTheDocument()
    expect(container.querySelector('.alang-dialogue__choices-dock')).toBeInTheDocument()
    expect(screen.getAllByRole('img')[0]).toHaveAttribute('src', '/assets/lovart/alang-found-scene-placeholder.webp')
  })

  it('submits the selected server choice and replaces dialogue with companion in the return stack', async () => {
    render(<AlangDialoguePage />)

    const choice = await screen.findByText('陪你走走')
    fireEvent.click(choice)

    await waitFor(() => {
      expect(mocks.callSubmitChoice).toHaveBeenCalledWith('meet-alang', {
        nodeId: 'dialogue-3',
        choiceIndex: 0,
      })
    })
    expect(mocks.syncMissionProgress).toHaveBeenCalledWith('meet-alang', {
      stage: 'companion',
      currentNodeId: 'companion',
    })
    expect(await screen.findByText('阿浪站起身了')).toBeInTheDocument()
    await waitFor(() => {
      expect(mocks.redirectTo).toHaveBeenCalledWith({
        url: '/pages/alang/companion/index?slug=meet-alang&nodeId=companion',
      })
    }, { timeout: 1600 })
    expect(mocks.syncMissionProgress.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.redirectTo.mock.invocationCallOrder[0],
    )
  })

  it('uses the server stage to leave a stale dialogue page after the story reached its result', async () => {
    mocks.useAlangMissionDetail.mockReturnValue({
      data: {
        ...mission,
        myProgress: {
          ...mission.myProgress,
          stage: 'result',
          currentNodeId: 'result-card',
        },
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })

    render(<AlangDialoguePage />)

    await waitFor(() => {
      expect(mocks.redirectTo).toHaveBeenCalledWith({
        url: '/pages/alang/result/index?slug=meet-alang',
      })
    })
  })
})

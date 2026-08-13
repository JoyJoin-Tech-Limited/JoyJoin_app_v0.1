import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlashDialoguePage from './index'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useEncounter: vi.fn(),
  answer: vi.fn(),
  advance: vi.fn(),
  deliver: vi.fn(),
  reroll: vi.fn(),
  offer: vi.fn(),
  refetch: vi.fn(),
  canonicalRedirect: vi.fn(),
  redirectTo: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  useDidShow: vi.fn(),
  default: {
    getCurrentInstance: () => ({ router: { params: { encounterId: 'encounter-1' } } }),
    setNavigationBarTitle: vi.fn(),
    redirectTo: mocks.redirectTo,
  },
}))
vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
  Image: ({ mode: _mode, onError: _onError, ...props }: any) => <img {...props} />,
}))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../../lib/alang/useFlash', () => ({
   useFlashEncounter: mocks.useEncounter,
   useAnswerFlashEncounter: () => ({ mutateAsync: mocks.answer, isPending: false }),
   useAdvanceFlashStoryNode: () => ({ mutateAsync: mocks.advance, isPending: false }),
   useDeliverFlashTask: () => ({ mutateAsync: mocks.deliver, isPending: false }),
   useRerollFlashEncounter: () => ({ mutateAsync: mocks.reroll, isPending: false }),
   useRespondToFlashTaskOffer: () => ({ mutateAsync: mocks.offer, isPending: false }),
}))
vi.mock('../../../lib/alang/flashNavigation', () => ({ redirectToFlashCanonical: mocks.canonicalRedirect }))
vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))

const questionEncounter = {
  canonicalScreen: 'dialogue',
  encounterId: 'encounter-1',
  npc: { id: 'npc-1', slug: 'lizi', name: '栗子', animal: '水獭' },
  openingLine: '我刚刚想到一个问题欸。',
  currentQuestion: {
    id: 'q1', text: '如果现在能随便逛逛，你更想去哪种地方？', position: 1, total: 2,
    options: [{ id: 'quiet', label: '安静一点的' }, { id: 'lively', label: '热闹一点的' }],
  },
  pendingDelivery: null,
  taskOffer: null,
}

const storyEncounter = {
  ...questionEncounter,
  npc: { id: 'npc-shiqi', slug: 'shiqi', name: '拾柒', animal: '乌鸦' },
  currentQuestion: {
    id: 's1-p1-shiqi-response-v2',
    text: '你愿意怎么和我开始？',
    position: 1,
    total: 1,
    options: [
      { id: 's1-p1-shiqi-cooperate-a', label: '我和你一起对齐纸页，不替主人删选项。' },
      { id: 's1-p1-shiqi-cooperate-b', label: '我先看三条短线，不猜它们代表谁。' },
    ],
  },
  storyEpisode: {
    id: 'episode-shiqi-1',
    code: 's1-p1-shiqi',
    seasonTitle: '没有名字的旧物',
    phase: 1,
    title: '一本一次也没用过的出门册',
    objectCode: 'outing-book',
    opening: '我们应该没见过。我叫拾柒。这本出门册一次也没用过，却留下三道重叠的短线。陪我对齐？',
    action: '她统计重复圈选的项目，但没有替主人删掉任何一项。',
    discovery: '主人不是没有计划，而是每次快出发时又增加一个新选择。',
    response: null,
    closing: null,
    motion: { ambient: 'none' as const },
    fragment: null,
    progress: { completedInPhase: 0, totalInPhase: 5, completedTotal: 3, total: 15 },
  },
}

const answeredStoryEncounter = {
  ...storyEncounter,
  currentQuestion: null,
  storyEpisode: {
    ...storyEncounter.storyEpisode,
    response: '拾柒把灯挪近：这样更稳妥。先确认痕迹，再决定能不能继续往下推。',
    closing: '拾柒把出门册合上，像是替那次迟到的出发留了一盏灯。',
    fragment: {
      category: 'object' as const,
      title: '迟到的出发',
      fact: '这本册子不是没被想起，只是每次出发前都多了一个舍不得删掉的选择。',
    },
    progress: { completedInPhase: 1, totalInPhase: 5, completedTotal: 4, total: 15 },
  },
}

describe('formal Flash dialogue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: true } } })
    mocks.useEncounter.mockReturnValue({ data: questionEncounter, isLoading: false, isError: false, refetch: mocks.refetch })
    mocks.answer.mockResolvedValue(questionEncounter)
    mocks.reroll.mockResolvedValue(questionEncounter)
    mocks.offer.mockResolvedValue(questionEncounter)
    mocks.canonicalRedirect.mockResolvedValue(false)
  })

  it('uses structured natural choices and never presents free text for matching', async () => {
    render(<FlashDialoguePage />)
    expect(screen.getByText('如果现在能随便逛逛，你更想去哪种地方？')).toBeInTheDocument()
    expect(screen.getByText('慢慢选，没有标准答案 ( ´ ▽ ` )')).toBeInTheDocument()
    expect(document.querySelector('textarea')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '安静一点的' }))
    await waitFor(() => expect(mocks.answer).toHaveBeenCalledWith({
      encounterId: 'encounter-1', questionId: 'q1', optionId: 'quiet',
    }))
  })

  it('keeps story choices inside one animated scene and naturalizes already-seeded copy', async () => {
    mocks.useEncounter.mockReturnValue({
      data: storyEncounter,
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    mocks.answer.mockResolvedValue(storyEncounter)

    render(<FlashDialoguePage />)

    const stage = screen.getByTestId('flash-story-stage')
    const choicePanel = screen.getByTestId('flash-story-choice-panel')
    expect(stage).toContainElement(choicePanel)
    expect(stage.querySelector('.flash-page__scroll')).not.toBeInTheDocument()
    expect(screen.getByLabelText('拾柒正在和你说话')).toHaveClass('flash-dialogue-scene--breathe')

    expect(screen.getByLabelText('你愿意怎么和我开始？')).toBeInTheDocument()
    expect(screen.getByText('我和你一起对齐纸页，不替主人删选项。')).toBeInTheDocument()
    expect(screen.getByText('我先看三条短线，不猜它们代表谁。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '我先看三条短线，不猜它们代表谁。' }))
    await waitFor(() => expect(mocks.answer).toHaveBeenCalledWith({
      encounterId: 'encounter-1',
      questionId: 's1-p1-shiqi-response-v2',
      optionId: 's1-p1-shiqi-cooperate-b',
    }))
  })

  it('keeps the answer and fragment reveal inside the same story stage', () => {
    mocks.useEncounter.mockReturnValue({
      data: answeredStoryEncounter,
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })

    render(<FlashDialoguePage />)

    const stage = screen.getByTestId('flash-story-stage')
    expect(stage.querySelector('.flash-page__scroll')).not.toBeInTheDocument()
    expect(screen.getByText('拾柒把灯挪近：这样更稳妥。先确认痕迹，再决定能不能继续往下推。')).toBeInTheDocument()
    expect(stage).toContainElement(screen.getByText('迟到的出发'))
    expect(stage).toContainElement(screen.getByText('这本册子不是没被想起，只是每次出发前都多了一个舍不得删掉的选择。'))
    expect(stage).toContainElement(screen.getByRole('button', { name: '收好碎片，继续寻找' }))
  })

  it('shows the fifteenth fragment before the user explicitly enters the finale', async () => {
    mocks.useEncounter.mockReturnValue({
      data: {
        ...answeredStoryEncounter,
        storyEpisode: {
          ...answeredStoryEncounter.storyEpisode,
          progress: { completedInPhase: 5, totalInPhase: 5, completedTotal: 15, total: 15 },
        },
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })

    render(<FlashDialoguePage />)

    fireEvent.click(screen.getByRole('button', { name: '收好这一季' }))
    await waitFor(() => expect(mocks.redirectTo).toHaveBeenCalledWith({
      url: '/pages/alang/finale/index?encounterId=encounter-1',
    }))
  })

  it('shows an in-scene retry message when a story answer cannot be sent', async () => {
    mocks.useEncounter.mockReturnValue({
      data: storyEncounter,
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    mocks.answer.mockRejectedValueOnce(new Error('offline'))

    render(<FlashDialoguePage />)
    fireEvent.click(screen.getByRole('button', { name: '我和你一起对齐纸页，不替主人删选项。' }))

    const alert = await screen.findByRole('alert')
    expect(screen.getByTestId('flash-story-stage')).toContainElement(alert)
    expect(alert).toHaveTextContent('这句话没有送出去，再试一次就好。')
    expect(screen.getByRole('button', { name: '重新送出' })).toBeInTheDocument()
  })

  it('prioritizes delivery from the same NPC before a new conversation', async () => {
    mocks.useEncounter.mockReturnValue({
      data: {
        ...questionEncounter,
        currentQuestion: null,
        pendingDelivery: { assignmentId: 'assignment-1', taskTitle: '替我看看那家小店' },
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    mocks.deliver.mockResolvedValue(questionEncounter)
    render(<FlashDialoguePage />)

    expect(screen.getByText('上次托你的事')).toBeInTheDocument()
    fireEvent.click(screen.getByText('交给栗子'))
    await waitFor(() => expect(mocks.deliver).toHaveBeenCalledWith({
      encounterId: 'encounter-1', assignmentId: 'assignment-1',
    }))
  })

  it('reveals the task as a paper note with two decisions and a separate one-time swap', async () => {
    mocks.useEncounter.mockReturnValue({
      data: {
        ...questionEncounter,
        currentQuestion: null,
        taskOffer: {
          templateId: 'task-1',
          category: '文化娱乐',
          title: '打开一直想看的那部电影',
          invitation: '别再把它留给某个更合适的晚上。',
          invitationType: 'life_invitation',
        },
        canReroll: true,
        rerollsRemaining: 1,
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    render(<FlashDialoguePage />)

    expect(screen.getByText('好，我想试试看')).toBeInTheDocument()
    expect(screen.getByText('今天先不了')).toBeInTheDocument()
    expect(screen.getByText('换一个')).toBeInTheDocument()
    expect(screen.queryByText('好，我接住了')).not.toBeInTheDocument()
    expect(screen.queryByText('换一件事')).not.toBeInTheDocument()

    const note = screen.getByTestId('flash-task-reveal')
    expect(note).toHaveClass('flash-dialogue__offer-paper')
    expect(note).toHaveAttribute('aria-live', 'polite')
    const reroll = screen.getByRole('button', { name: '换一个小邀请' })
    expect(reroll).toHaveClass('flash-dialogue__reroll')

    fireEvent.click(reroll)
    await waitFor(() => expect(mocks.reroll).toHaveBeenCalledWith('encounter-1'))

    fireEvent.click(screen.getByText('好，我想试试看'))
    await waitFor(() => expect(mocks.offer).toHaveBeenCalledWith({
      encounterId: 'encounter-1',
      accepted: true,
    }))
  })

  it('loads a formal deep link when the legacy Alang flag is disabled', () => {
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: false } } })
    render(<FlashDialoguePage />)
    expect(screen.getByText('如果现在能随便逛逛，你更想去哪种地方？')).toBeInTheDocument()
    expect(mocks.useEncounter).toHaveBeenCalledWith('encounter-1', true, false)
  })

  it('redirects a completed season into the dedicated finale ceremony', async () => {
    mocks.useEncounter.mockReturnValue({
      data: {
        ...questionEncounter,
        status: 'completed',
        currentQuestion: null,
        storyEpisode: { code: 'season-finale', title: '守桥的人' },
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    render(<FlashDialoguePage />)
    await waitFor(() => expect(mocks.redirectTo).toHaveBeenCalledWith({
      url: '/pages/alang/finale/index?encounterId=encounter-1',
    }))
  })

  it('renders the v2 node stage when storyV2 is present on a non-dedicated unit', () => {
    mocks.useEncounter.mockReturnValue({
      data: {
        ...questionEncounter,
        npc: { id: 'npc-alang', slug: 'alang', name: '阿浪', animal: '灰狼' },
        currentQuestion: null,
        storyEpisode: {
          id: 'episode-alang-1',
          code: 's1-p1-alang',
          seasonTitle: '没有名字的旧物',
          phase: 1,
          title: '一张画了两把椅子的图',
          objectCode: 'seat-plan',
          opening: '',
          action: '',
          discovery: '',
          response: null,
          closing: null,
          motion: { ambient: 'none' as const },
          fragment: null,
          progress: { completedInPhase: 0, totalInPhase: 5, completedTotal: 0, total: 15 },
          storyV2: {
            nodeId: 'n3_choice',
            type: 'choice',
            segments: [{ text: '你想先注意哪一件事？' }],
            choices: [
              { id: 'ask-changes', text: '这张图改了不止一次。' },
              { id: 'flip-paper', text: '把纸翻过来' },
            ],
            next: null,
            unlockFragment: null,
          },
        },
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    render(<FlashDialoguePage />)
    const stage = document.querySelector('[data-testid="flash-story-v2-stage"]')
    expect(stage).toBeTruthy()
    expect(screen.getByText('这张图改了不止一次。')).toBeInTheDocument()
    fireEvent.click(screen.getByText('这张图改了不止一次。'))
    expect(mocks.answer).toHaveBeenCalledWith({
      encounterId: 'encounter-1',
      questionId: 'n3_choice',
      optionId: 'ask-changes',
    })
  })

  it('keeps non-pilot units (with dedicated interactions) on the v1 path even when storyV2 is present', () => {
    mocks.useEncounter.mockReturnValue({
      data: {
        ...questionEncounter,
        npc: { id: 'npc-lizi', slug: 'lizi', name: '栗子', animal: '水獭' },
        currentQuestion: null,
        storyEpisode: {
          id: 'episode-lizi-1',
          code: 's1-p1-lizi',
          seasonTitle: '没有名字的旧物',
          phase: 1,
          title: '五支已经写不出的彩笔',
          objectCode: 'dry-markers',
          opening: '栗子把五支彩笔按颜色排开。',
          action: '她逐支试写，又检查了笔帽与笔身不一致的地方。',
          discovery: '这些笔不是用来画画的。',
          response: null,
          closing: null,
          motion: { ambient: 'none' as const },
          fragment: null,
          progress: { completedInPhase: 0, totalInPhase: 5, completedTotal: 0, total: 15 },
          storyV2: {
            nodeId: 'n3_choice',
            type: 'choice',
            segments: [{ text: '你想先注意哪一件事？' }],
            choices: [{ id: 'ask-caps', text: '笔帽怎么不配对？' }],
            next: null,
            unlockFragment: null,
          },
        },
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    render(<FlashDialoguePage />)
    expect(document.querySelector('[data-testid="flash-story-v2-stage"]')).toBeNull()
    expect(screen.getByText('栗子把五支彩笔按颜色排开。')).toBeInTheDocument()
  })
})

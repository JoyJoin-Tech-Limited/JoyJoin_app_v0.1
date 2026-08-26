import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlashDialoguePage, { FlashDialoguePage as FlashDialoguePageWithAssets } from './index'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useEncounter: vi.fn(),
  answer: vi.fn(),
  advance: vi.fn(),
  interaction: vi.fn(),
  track: vi.fn(),
  deliver: vi.fn(),
  reroll: vi.fn(),
  offer: vi.fn(),
  refetch: vi.fn(),
  canonicalRedirect: vi.fn(),
  redirectTo: vi.fn(),
  getStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  navigateTo: vi.fn(),
  routerParams: { encounterId: 'encounter-1' } as Record<string, string>,
  didShow: null as null | (() => void),
  didHide: null as null | (() => void),
  didUnload: null as null | (() => void),
}))

vi.mock('@tarojs/taro', () => ({
  useDidShow: (callback: () => void) => { mocks.didShow = callback },
  useDidHide: (callback: () => void) => { mocks.didHide = callback },
  useUnload: (callback: () => void) => { mocks.didUnload = callback },
  default: {
    getCurrentInstance: () => ({ router: { params: mocks.routerParams } }),
    setNavigationBarTitle: vi.fn(),
    redirectTo: mocks.redirectTo,
    getStorageSync: mocks.getStorageSync,
    setStorageSync: mocks.setStorageSync,
    removeStorageSync: mocks.removeStorageSync,
    navigateTo: mocks.navigateTo,
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
   useSubmitFlashStoryInteraction: () => ({ mutateAsync: mocks.interaction, isPending: false }),
   useDeliverFlashTask: () => ({ mutateAsync: mocks.deliver, isPending: false }),
   useRerollFlashEncounter: () => ({ mutateAsync: mocks.reroll, isPending: false }),
   useRespondToFlashTaskOffer: () => ({ mutateAsync: mocks.offer, isPending: false }),
}))
vi.mock('../../../lib/analytics/flashStoryAnalytics', () => ({
  flashStoryAnalytics: { track: mocks.track },
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
    mocks.routerParams = { encounterId: 'encounter-1' }
    mocks.didShow = null
    mocks.didHide = null
    mocks.didUnload = null
    mocks.getStorageSync.mockReturnValue(undefined)
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: true } } })
    mocks.useEncounter.mockReturnValue({ data: questionEncounter, isLoading: false, isError: false, refetch: mocks.refetch })
    mocks.answer.mockResolvedValue(questionEncounter)
    mocks.advance.mockResolvedValue(questionEncounter)
    mocks.reroll.mockResolvedValue(questionEncounter)
    mocks.offer.mockResolvedValue(questionEncounter)
    mocks.canonicalRedirect.mockResolvedValue(false)
  })

  it('uses structured natural choices and never presents free text for matching', async () => {
    render(<FlashDialoguePage />)
    expect(screen.getByText('如果现在能随便逛逛，你更想去哪种地方？')).toBeInTheDocument()
    expect(screen.getByText('慢慢选，没有标准答案')).toBeInTheDocument()
    expect(document.querySelector('textarea')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '安静一点的' }))
    await waitFor(() => expect(mocks.answer).toHaveBeenCalledWith({
      encounterId: 'encounter-1', questionId: 'q1', optionId: 'quiet',
    }))
  })

  it('does not navigate when an in-flight dialogue response arrives after page unload', async () => {
    let resolveAnswer!: (value: any) => void
    mocks.answer.mockReturnValue(new Promise((resolve) => { resolveAnswer = resolve }))
    const view = render(<FlashDialoguePage />)

    fireEvent.click(screen.getByRole('button', { name: '安静一点的' }))
    await waitFor(() => expect(mocks.answer).toHaveBeenCalledTimes(1))
    mocks.canonicalRedirect.mockClear()
    act(() => { mocks.didUnload?.() })
    view.unmount()
    await act(async () => {
      resolveAnswer({
        ...questionEncounter,
        storyEpisode: { id: 'episode-2', code: 's1-p2-alang', response: null },
      })
      await Promise.resolve()
    })

    expect(mocks.canonicalRedirect).not.toHaveBeenCalled()
  })

  it('routes the first Shiqi unit directly into the Atuan-style three-clue scene', () => {
    mocks.useEncounter.mockReturnValue({
      data: storyEncounter,
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    mocks.answer.mockResolvedValue(storyEncounter)

    render(<FlashDialoguePage />)

    const stage = screen.getByTestId('flash-story-stage')
    const experience = screen.getByTestId('shiqi-first-act-experience')
    expect(stage).toContainElement(experience)
    expect(stage.querySelector('.flash-page__scroll')).not.toBeInTheDocument()
    expect(screen.queryByTestId('flash-story-choice-panel')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('shiqi-first-act-hotspot')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: '观察拾柒本人' }))
    expect(screen.getByTestId('shiqi-scene-clue')).toHaveTextContent('只让三张纸都留下的压线露出来')
    expect(screen.queryByText('你先确认共同的浅痕？')).not.toBeInTheDocument()
    expect(screen.queryByTestId('shiqi-first-act-dialogue-panel')).not.toBeInTheDocument()
  })

  it('keeps a settled fragment visible until the user explicitly stores it', async () => {
    mocks.useEncounter.mockReturnValue({
      data: { ...answeredStoryEncounter, canonicalScreen: 'completed', status: 'completed' },
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
    expect(mocks.redirectTo).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /收好/ }))
    await waitFor(() => expect(mocks.redirectTo).toHaveBeenCalledWith({ url: '/pages/alang/event/index' }))
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

    expect(mocks.redirectTo).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /收好/ }))
    await waitFor(() => expect(mocks.redirectTo).toHaveBeenCalledWith({
      url: '/pages/alang/finale/index?encounterId=encounter-1',
    }))
  })

  it('returns a completed-season replay to the collection instead of replaying the finale', async () => {
    mocks.routerParams = { encounterId: 'encounter-1', replay: '1', replaySession: 'session-a' }
    mocks.useEncounter.mockReturnValue({
      data: {
        ...answeredStoryEncounter,
        isReplay: true,
        storyEpisode: {
          ...answeredStoryEncounter.storyEpisode,
          fragment: null,
          progress: { completedInPhase: 5, totalInPhase: 5, completedTotal: 15, total: 15 },
        },
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })

    render(<FlashDialoguePage />)

    fireEvent.click(screen.getByRole('button', { name: /收好/ }))
    await waitFor(() => expect(mocks.redirectTo).toHaveBeenCalledWith({ url: '/pages/alang/event/index' }))
  })

  it('passes replay context into canonical routing when a replay moves to the later-act subpackage', async () => {
    mocks.routerParams = { encounterId: 'encounter-1', replay: '1', replaySession: 'session-route' }
    const laterActReplay = {
      ...storyEncounter,
      storyEpisode: {
        ...storyEncounter.storyEpisode,
        code: 's1-p2-shiqi',
      },
    }
    mocks.useEncounter.mockReturnValue({
      data: laterActReplay,
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })

    render(<FlashDialoguePage />)

    await waitFor(() => expect(mocks.canonicalRedirect).toHaveBeenCalledWith(
      laterActReplay,
      '/pages/alang/dialogue/index',
      { replay: true, replaySession: 'session-route' },
    ))
  })

  it('does not bounce a later-act page back to the main dialogue from stale data while refreshing', () => {
    mocks.useEncounter.mockReturnValue({
      data: storyEncounter,
      isLoading: false,
      isFetching: true,
      isError: false,
      refetch: mocks.refetch,
    })

    render(<FlashDialoguePageWithAssets canonicalPath='/pages/alang-story/dialogue/index' />)

    expect(mocks.canonicalRedirect).not.toHaveBeenCalled()
  })

  it('does not redirect a hidden dialogue webview while a child game owns the page stack', async () => {
    const view = render(<FlashDialoguePage />)
    await waitFor(() => expect(mocks.canonicalRedirect).toHaveBeenCalled())
    mocks.canonicalRedirect.mockClear()

    expect(mocks.didHide).toEqual(expect.any(Function))
    act(() => { mocks.didHide?.() })
    mocks.useEncounter.mockReturnValue({
      data: { ...questionEncounter, canonicalScreen: 'completed', status: 'completed' },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    view.rerender(<FlashDialoguePage />)

    expect(mocks.canonicalRedirect).not.toHaveBeenCalled()
  })

  it('keeps the original completion action usable when a story answer cannot be sent', async () => {
    mocks.useEncounter.mockReturnValue({
      data: storyEncounter,
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    mocks.answer.mockRejectedValueOnce(new Error('offline'))
    mocks.getStorageSync.mockImplementation((key: string) => key === 'joyjoin:flash:shiqi-first-act:v2:encounter-1'
      ? {
          version: 'atuan-template-v1',
          stage: 'success',
          seenIds: ['shiqi', 'outing-book', 'exchange-box', 'inspection-light'],
          activeId: null,
          approachIndex: 0,
        }
      : undefined)

    render(<FlashDialoguePage />)
    fireEvent.click(screen.getByRole('button', { name: '完成拾柒第一幕' }))

    const alert = await screen.findByRole('alert')
    expect(screen.getByTestId('flash-story-stage')).toContainElement(alert)
    expect(alert).toHaveTextContent('刚才没有收好，再点一次下方按钮就能继续。')
    expect(screen.queryByRole('button', { name: '重新送出' })).not.toBeInTheDocument()
    expect(mocks.answer).toHaveBeenCalledTimes(1)
    expect(mocks.refetch).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '完成拾柒第一幕' }))
    await waitFor(() => expect(mocks.answer).toHaveBeenCalledTimes(2))
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

  it('routes Alang second act through the same local-submit template instead of the v2 advance chain', () => {
    mocks.useEncounter.mockReturnValue({
      data: {
        ...questionEncounter,
        npc: { id: 'npc-alang', slug: 'alang', name: '阿浪', animal: '灰狼' },
        currentQuestion: null,
        storyEpisode: {
          id: 'episode-alang-2',
          code: 's1-p2-alang',
          seasonTitle: '没有名字的旧物',
          phase: 2,
          title: '一本停在半程的路线册',
          objectCode: 'route-book',
          opening: '', action: '', discovery: '', response: null, closing: null,
          motion: { ambient: 'none' as const }, fragment: null,
          progress: { completedInPhase: 0, totalInPhase: 5, completedTotal: 5, total: 15 },
          storyV2: {
            nodeId: 'n1_setup',
            type: 'prose',
            segments: [{ text: '旧的服务端开场不会直接露出。' }],
            choices: [],
            next: 'n2_object',
            unlockFragment: null,
          },
        },
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })

    render(<FlashDialoguePageWithAssets customLaterActAssets={{
      alangSecond: 'flash-alang-second-act-return-shelter-v2.jpg',
      alangThird: 'alang-third.jpg',
      alangCharacter: 'alang-official.png',
      momoSecond: 'momo-second.jpg',
      momoThird: 'momo-third.jpg',
      momoCharacter: 'momo-official.png',
      liziSecond: 'lizi-second.jpg', liziThird: 'lizi-third.jpg', liziCharacter: 'lizi-official.png',
      shiqiSecond: 'shiqi-second.jpg', shiqiThird: 'shiqi-third.jpg', shiqiCharacter: 'shiqi-official.png',
    }} />)

    expect(document.querySelector('[data-testid="flash-story-v2-stage"]')).toBeNull()
    expect(screen.getByTestId('later-act-background')).toHaveAttribute('src', expect.stringContaining('flash-alang-second-act-return-shelter-v2'))
    expect(screen.getByTestId('later-act-character')).toHaveAttribute('src', 'alang-official.png')
    expect(document.querySelector('.later-act-experience__chapter')).toBeNull()
    const approach = screen.getByRole('button', { name: '先看本子被雨打湿的地方' })
    act(() => {
      approach.click()
      approach.click()
    })
    expect(mocks.advance).not.toHaveBeenCalled()
  })

  it('routes Shiqi third act through the same local-submit template instead of the v2 advance chain', () => {
    mocks.useEncounter.mockReturnValue({
      data: {
        ...questionEncounter,
        npc: { id: 'npc-shiqi', slug: 'shiqi', name: '拾柒', animal: '乌鸦' },
        currentQuestion: null,
        storyEpisode: {
          id: 'episode-shiqi-3', code: 's1-p3-shiqi', seasonTitle: '没有名字的旧物', phase: 3,
          title: '被退回来的记录', objectCode: 'observation-cards',
          opening: '', action: '', discovery: '', response: null, closing: null,
          motion: { ambient: 'none' as const }, fragment: null,
          progress: { completedInPhase: 0, totalInPhase: 5, completedTotal: 10, total: 15 },
          storyV2: {
            nodeId: 'n1_setup', type: 'prose', segments: [{ text: '旧的通用卡片不会露出。' }],
            choices: [], next: 'n2_object', unlockFragment: null,
          },
        },
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })

    render(<FlashDialoguePageWithAssets customLaterActAssets={{
      alangSecond: 'alang-second.jpg', alangThird: 'alang-third.jpg', alangCharacter: 'alang-official.png',
      momoSecond: 'momo-second.jpg', momoThird: 'momo-third.jpg', momoCharacter: 'momo-official.png',
      liziSecond: 'lizi-second.jpg', liziThird: 'lizi-third.jpg', liziCharacter: 'lizi-official.png',
      shiqiSecond: 'shiqi-second.jpg', shiqiThird: 'shiqi-third.jpg', shiqiCharacter: 'shiqi-official.png',
    }} />)

    expect(document.querySelector('[data-testid="flash-story-v2-stage"]')).toBeNull()
    expect(screen.getByTestId('later-act-background')).toHaveAttribute('src', 'shiqi-third.jpg')
    expect(screen.getByTestId('later-act-character')).toHaveAttribute('src', 'shiqi-official.png')
    expect(document.querySelector('.later-act-experience__chapter')).toBeNull()
    const approach = screen.getByRole('button', { name: '先确认其余四张卡还能留下什么' })
    act(() => {
      approach.click()
      approach.click()
    })
    expect(mocks.advance).not.toHaveBeenCalled()
  })

  it('settles a restored Alang ending through the same story answer path', async () => {
    mocks.routerParams = { encounterId: 'encounter-1', replay: '1', replaySession: 'session-alang' }
    const storyEpisode = {
      id: 'episode-alang-3',
      code: 's1-p3-alang',
      seasonTitle: '没有名字的旧物',
      phase: 3,
      title: '被拆开的后半本',
      objectCode: 'route-book',
      opening: '', action: '', discovery: '', response: null, closing: null,
      motion: { ambient: 'none' as const }, fragment: null,
      progress: { completedInPhase: 0, totalInPhase: 5, completedTotal: 10, total: 15 },
      storyV2: null,
    }
    const encounter = {
      ...questionEncounter,
      npc: { id: 'npc-alang', slug: 'alang', name: '阿浪', animal: '灰狼' },
      currentQuestion: {
        id: 's1-p3-alang-template-response-v1',
        text: 'template settlement question',
        options: [
          { id: 's1-p3-alang-template-a', label: 'template option a' },
          { id: 's1-p3-alang-template-b', label: 'template option b' },
        ],
      },
      storyEpisode,
    }
    const settled = { ...encounter, canonicalScreen: 'completed', status: 'completed', storyEpisode: { ...storyEpisode, response: '已经归还。', storyV2: null } }
    mocks.useEncounter.mockReturnValue({ data: encounter, isLoading: false, isError: false, refetch: mocks.refetch })
    const laterProgress = {
      version: 'npc-later-act-v2', unitId: 's1-p3-alang', stage: 'ending',
      approachId: 'inspect-binding',
      seenHighlightIds: ['opened-rings', 'written-route', 'return-envelope'], objectOpened: true,
      seenDetailIds: ['clean-edges', 'removable-thread', 'outside-invite'], followupId: 'write-date',
      gameStarted: true, gameStep: 3, gameComplete: true, mistakes: 0, stepMistakes: [0, 0, 0], selectedEvidenceId: null, wrongChoiceId: null,
    }
    const storyUnitState = {
      unitId: 's1-p3-alang',
      version: 2,
      stage: 'OBJECT_SUCCESS',
      choice: { questionId: 's1-p3-alang-template-response-v1', optionId: 's1-p3-alang-template-a', label: 'template option a' },
      companionEvent: 'SUCCESS',
      divergenceCopy: null,
      atuanFirstAct: null,
      atuanLaterAct: null,
      analyticsSent: [],
    }
    mocks.getStorageSync.mockImplementation((key: string) => key.includes('flash_story_unit') ? storyUnitState : key.includes('later-act') ? laterProgress : undefined)
    mocks.answer.mockResolvedValueOnce(settled)

    render(<FlashDialoguePageWithAssets customLaterActAssets={{
      alangSecond: 'alang-second.jpg', alangThird: 'alang-third.jpg', alangCharacter: 'alang-official.png',
      momoSecond: 'momo-second.jpg', momoThird: 'momo-third.jpg', momoCharacter: 'momo-official.png',
      liziSecond: 'lizi-second.jpg', liziThird: 'lizi-third.jpg', liziCharacter: 'lizi-official.png',
      shiqiSecond: 'shiqi-second.jpg', shiqiThird: 'shiqi-third.jpg', shiqiCharacter: 'shiqi-official.png',
    }} />)

    fireEvent.click(screen.getByRole('button', { name: '收好阿浪归还的空白页' }))
    await waitFor(() => expect(mocks.answer).toHaveBeenCalledTimes(1))
    expect(mocks.advance).not.toHaveBeenCalled()
    expect(mocks.canonicalRedirect).not.toHaveBeenCalledWith(
      expect.objectContaining({ canonicalScreen: 'completed' }),
      expect.anything(),
    )
    expect(mocks.answer).toHaveBeenCalledWith({
      encounterId: 'encounter-1',
      questionId: 's1-p3-alang-template-response-v1',
      optionId: 's1-p3-alang-template-a',
      replay: true,
    })
  })

  it('keeps Lizi on the dedicated first-act path and submits the completed approach', async () => {
    mocks.useEncounter.mockReturnValue({
      data: {
        ...questionEncounter,
        npc: { id: 'npc-lizi', slug: 'lizi', name: '栗子', animal: '水獭' },
        currentQuestion: {
          id: 's1-p1-lizi-response-v1',
          text: '你想先相信什么？',
          position: 1,
          total: 1,
          options: [
            { id: 's1-p1-lizi-cooperate-a', label: '先相信纸上留下的痕迹。' },
            { id: 's1-p1-lizi-cooperate-b', label: '先把三种手感排成顺序。' },
          ],
        },
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
    expect(screen.getByTestId('lizi-first-act')).toBeInTheDocument()
    expect(screen.getAllByTestId('lizi-first-act-hotspot')).toHaveLength(3)
    for (const target of ['栗子', '左侧色板', '悬挂色片'] as const) {
      fireEvent.click(screen.getByRole('button', { name: `观察${target}` }))
      fireEvent.click(screen.getByRole('button', { name: `收下${target}的线索，回到现场` }))
    }
    fireEvent.click(screen.getByRole('button', { name: '观察右侧工具车' }))
    fireEvent.click(screen.getByRole('button', { name: '收下右侧工具车的线索，回到现场' }))
    fireEvent.click(screen.getByRole('button', { name: '接住滚向桌沿的三支彩笔' }))
    fireEvent.click(screen.getByRole('button', { name: '先相信纸上留下的痕迹。' }))

    for (const detail of ['暖开的软弧边', '安静的双细线', '醒目的短断点'] as const) {
      fireEvent.click(screen.getByRole('button', { name: `观察${detail}` }))
      fireEvent.click(screen.getByRole('button', { name: `收下${detail}的线索，继续查看试写纸` }))
    }
    fireEvent.click(screen.getByRole('button', { name: '名字都没了，你为什么还认得它们？' }))
    fireEvent.click(screen.getByRole('button', { name: '和栗子一起配回三顶笔帽' }))
    expect(mocks.navigateTo).toHaveBeenCalledWith({ url: expect.stringContaining('mode=lizi') })

    mocks.getStorageSync.mockImplementation((key: string) => key === 'joyjoin_flash_lizi_first_act_v2_encounter-1:game'
      ? [
          { cardId: 'warm', destinationId: 'soft-arc' },
          { cardId: 'quiet', destinationId: 'fine-pair' },
          { cardId: 'awake', destinationId: 'quick-notch' },
        ]
      : undefined)
    act(() => mocks.didShow?.())
    fireEvent.click(screen.getByRole('button', { name: '完成栗子第一幕' }))

    await waitFor(() => expect(mocks.answer).toHaveBeenCalledWith({
      encounterId: 'encounter-1',
      questionId: 's1-p1-lizi-response-v1',
      optionId: 's1-p1-lizi-cooperate-a',
    }))
  })
})

const interactionEncounter = {
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
      echo: 5,
      echoTier: '轻' as const,
      nodeId: 'n2_action',
      type: 'interaction' as const,
      segments: [{ text: '阿浪把一张折得很薄的图摊在膝盖上。' }],
      choices: [],
      next: null,
      unlockFragment: null,
      interaction: {
        template: 'spacing' as const,
        goal: '移动两把椅子，留出图上刚好的并肩距离。',
        hints: ['不用挤在一起。'],
        results: [
          { id: 'aligned', next: 'n3_callback_a' },
          { id: 'crowded', next: 'n3_callback_b' },
        ],
        defaultResultId: 'aligned',
        fallbackNext: 'n4_fallback',
      },
    },
  },
}

const interactionCallbackEncounter = {
  ...interactionEncounter,
  storyEpisode: {
    ...interactionEncounter.storyEpisode,
    storyV2: {
      echo: 20,
      echoTier: '深' as const,
      nodeId: 'n3_callback_a',
      type: 'callback' as const,
      segments: [{ text: '座位之间的空隙和折痕对上了。' }],
      choices: [],
      next: 'n5_close',
      unlockFragment: null,
      interaction: null,
    },
  },
}

describe('formal Flash dialogue — 叙事动作层 interaction 节点', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.routerParams = { encounterId: 'encounter-1' }
    mocks.didShow = null
    mocks.didHide = null
    mocks.didUnload = null
    mocks.getStorageSync.mockReturnValue(undefined)
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: true } } })
    mocks.useEncounter.mockReturnValue({ data: interactionEncounter, isLoading: false, isError: false, refetch: mocks.refetch })
    mocks.interaction.mockResolvedValue(interactionCallbackEncounter)
    mocks.canonicalRedirect.mockResolvedValue(false)
  })

  it('renders the interaction stage from the server-owned current node and submits only { nodeId, resultId }', async () => {
    render(<FlashDialoguePage />)

    const stage = screen.getByTestId('flash-interaction-stage')
    expect(stage).toHaveTextContent('移动两把椅子，留出图上刚好的并肩距离。')
    expect(mocks.track).toHaveBeenCalledWith('s1-p1-alang', 'action_shown', { template: 'spacing' })

    fireEvent.click(screen.getByTestId('flash-interaction-zone-1'))
    fireEvent.click(screen.getByRole('button', { name: '就这样收好' }))

    await waitFor(() => expect(mocks.interaction).toHaveBeenCalledWith({
      encounterId: 'encounter-1',
      nodeId: 'n2_action',
      resultId: 'aligned',
    }))
    // 提交体不携带触摸轨迹/坐标/自由文本。
    expect(mocks.interaction.mock.calls[0][0]).not.toHaveProperty('trace')
    expect(mocks.interaction.mock.calls[0][0]).not.toHaveProperty('coordinates')
    await waitFor(() => expect(mocks.track).toHaveBeenCalledWith('s1-p1-alang', 'imprint_revealed', { resultId: 'aligned' }))
  })

  it('renders the returned 即时回响 view when the settled response arrives', async () => {
    const view = render(<FlashDialoguePage />)
    fireEvent.click(screen.getByTestId('flash-interaction-zone-1'))
    fireEvent.click(screen.getByRole('button', { name: '就这样收好' }))
    await waitFor(() => expect(mocks.interaction).toHaveBeenCalledTimes(1))

    // 与真实链路一致：mutation 成功 → setQueryData → encounter 查询返回回响节点。
    mocks.useEncounter.mockReturnValue({ data: interactionCallbackEncounter, isLoading: false, isError: false, refetch: mocks.refetch })
    view.rerender(<FlashDialoguePage />)

    expect(screen.getByText('座位之间的空隙和折痕对上了。')).toBeInTheDocument()
    expect(screen.queryByTestId('flash-interaction-stage')).not.toBeInTheDocument()
  })

  it('re-entering mid-action restores the same interaction node with reset local gesture progress (AC-03)', () => {
    const first = render(<FlashDialoguePage />)
    fireEvent.click(screen.getByTestId('flash-interaction-zone-1'))
    expect(screen.getByRole('button', { name: '就这样收好' })).toBeInTheDocument()
    first.unmount()

    // 未提交的手势进度只存在本地；重新进入由服务端 encounter 状态恢复到同一节点。
    render(<FlashDialoguePage />)
    expect(screen.getByTestId('flash-interaction-stage')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '就这样收好' })).not.toBeInTheDocument()
    expect(mocks.interaction).not.toHaveBeenCalled()
  })

  it('shows a refresh surface and refetches when the submitted result is stale', async () => {
    mocks.interaction.mockRejectedValueOnce(Object.assign(new Error('FLASH_V2_UNKNOWN_RESULT'), {
      statusCode: 400,
      data: { code: 'FLASH_V2_UNKNOWN_RESULT' },
    }))
    render(<FlashDialoguePage />)
    fireEvent.click(screen.getByTestId('flash-interaction-zone-1'))
    fireEvent.click(screen.getByRole('button', { name: '就这样收好' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('故事状态刚刚变化，正在重新接上。')
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalled())
  })

  it('falls back to the reading stage in replay mode (debug-only surface never submits actions)', () => {
    mocks.routerParams = { encounterId: 'encounter-1', replay: '1', replaySession: 'session-action' }
    render(<FlashDialoguePage />)

    expect(screen.queryByTestId('flash-interaction-stage')).not.toBeInTheDocument()
    expect(screen.getByTestId('flash-story-v2-stage')).toBeInTheDocument()
    expect(screen.getByText('阿浪把一张折得很薄的图摊在膝盖上。')).toBeInTheDocument()
  })
})

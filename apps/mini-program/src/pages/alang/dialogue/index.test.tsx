import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlashDialoguePage from './index'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useEncounter: vi.fn(),
  answer: vi.fn(),
  deliver: vi.fn(),
  reroll: vi.fn(),
  offer: vi.fn(),
  refetch: vi.fn(),
  canonicalRedirect: vi.fn(),
  redirectTo: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
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

  it('does not fetch a disabled deep link', () => {
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: false } } })
    render(<FlashDialoguePage />)
    expect(screen.getByText('街头盲盒正在准备下一次见面')).toBeInTheDocument()
    expect(mocks.useEncounter).toHaveBeenCalledWith('encounter-1', false)
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
})

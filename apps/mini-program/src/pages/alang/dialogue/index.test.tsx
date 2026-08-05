import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  haptics: vi.fn(),
  reducedMotion: false,
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getCurrentInstance: () => ({ router: { params: { encounterId: 'encounter-1' } } }),
    setNavigationBarTitle: vi.fn(),
    redirectTo: vi.fn(),
    getSystemInfoSync: vi.fn(() => ({ reduceMotion: mocks.reducedMotion })),
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
vi.mock('../../../lib/utils/haptics', () => ({ haptics: mocks.haptics }))

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

const offerEncounter = {
  ...questionEncounter,
  npc: { id: 'npc-alang', slug: 'alang', name: '阿浪', animal: '柯基' },
  currentQuestion: null,
  taskOffer: {
    templateId: 'task-movie-1',
    title: '看一部一直想看的电影',
    category: '文化娱乐',
    invitation: '别再把它留给某个更合适的晚上。电影还没开始，但今晚已经有了一件值得期待的事。',
    invitationType: 'life_invitation',
    expiresInDays: 7,
  },
  canReroll: true,
  rerollsRemaining: 1,
}

describe('formal Flash dialogue', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    mocks.reducedMotion = false
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: true } } })
    mocks.useEncounter.mockReturnValue({ data: questionEncounter, isLoading: false, isError: false, refetch: mocks.refetch })
    mocks.answer.mockResolvedValue(questionEncounter)
    mocks.canonicalRedirect.mockResolvedValue(false)
  })

  it('keeps the server-selected task sealed until the blind box is opened', async () => {
    vi.useFakeTimers()
    mocks.useEncounter.mockReturnValue({
      data: offerEncounter,
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })

    render(<FlashDialoguePage />)

    expect(screen.getByText('这次不让你选')).toBeInTheDocument()
    expect(screen.getByText('你今天像是把同一天过了很多遍。给我一下，你不用选，我替你换个今晚。')).toBeInTheDocument()
    expect(screen.queryByText('看一部一直想看的电影')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '让阿浪替我抽' }))

    expect(screen.getByText('阿浪正在替你换个今晚')).toBeInTheDocument()
    expect(screen.queryByText('看一部一直想看的电影')).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(480)
    })

    expect(screen.getByText('阿浪替你抽到了')).toBeInTheDocument()
    expect(screen.getByText('看一部一直想看的电影')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '收下这个今晚' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '再信你一次' })).toBeInTheDocument()
    expect(mocks.haptics).toHaveBeenNthCalledWith(1, 'light')
    expect(mocks.haptics).toHaveBeenNthCalledWith(2, 'success')
  })

  it('submits only after reveal and preserves the existing offer API contract', async () => {
    vi.useFakeTimers()
    mocks.useEncounter.mockReturnValue({
      data: offerEncounter,
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    mocks.offer.mockResolvedValue({
      canonicalScreen: 'task',
      assignmentId: 'assignment-1',
    })

    render(<FlashDialoguePage />)
    expect(mocks.offer).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '让阿浪替我抽' }))
    await act(async () => {
      vi.advanceTimersByTime(480)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '收下这个今晚' }))
      await Promise.resolve()
    })

    expect(mocks.offer).toHaveBeenCalledWith({
      encounterId: 'encounter-1',
      accepted: true,
    })
  })

  it('uses the existing one-time reroll only after the first task is revealed', async () => {
    vi.useFakeTimers()
    mocks.useEncounter.mockReturnValue({
      data: offerEncounter,
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    mocks.reroll.mockResolvedValue({
      ...offerEncounter,
      taskOffer: {
        ...offerEncounter.taskOffer,
        templateId: 'task-walk-2',
        title: '今天换一小段路',
      },
      rerollsRemaining: 0,
    })

    render(<FlashDialoguePage />)
    expect(screen.queryByRole('button', { name: '再信你一次' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '让阿浪替我抽' }))
    await act(async () => {
      vi.advanceTimersByTime(480)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '再信你一次' }))
      await Promise.resolve()
    })

    expect(mocks.reroll).toHaveBeenCalledWith('encounter-1')
  })

  it('reveals immediately when the device requests reduced motion', () => {
    mocks.reducedMotion = true
    mocks.useEncounter.mockReturnValue({
      data: offerEncounter,
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })

    render(<FlashDialoguePage />)
    fireEvent.click(screen.getByRole('button', { name: '让阿浪替我抽' }))

    expect(screen.getByText('阿浪替你抽到了')).toBeInTheDocument()
    expect(screen.getByText('看一部一直想看的电影')).toBeInTheDocument()
    expect(screen.queryByText('阿浪正在替你换个今晚')).not.toBeInTheDocument()
  })

  it('cancels a stale reveal when the server replaces the offered task', async () => {
    vi.useFakeTimers()
    const encounterState = {
      data: offerEncounter,
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    }
    mocks.useEncounter.mockImplementation(() => encounterState)

    const view = render(<FlashDialoguePage />)
    fireEvent.click(screen.getByRole('button', { name: '让阿浪替我抽' }))

    encounterState.data = {
      ...offerEncounter,
      taskOffer: {
        ...offerEncounter.taskOffer,
        templateId: 'task-walk-2',
        title: '今天换一小段路',
      },
    }
    view.rerender(<FlashDialoguePage />)

    await act(async () => {
      vi.advanceTimersByTime(480)
    })

    expect(screen.getByText('这次不让你选')).toBeInTheDocument()
    expect(screen.queryByText('看一部一直想看的电影')).not.toBeInTheDocument()
    expect(screen.queryByText('今天换一小段路')).not.toBeInTheDocument()
    expect(mocks.haptics).not.toHaveBeenCalledWith('success')
  })

  it('uses structured natural choices and never presents free text for matching', async () => {
    render(<FlashDialoguePage />)
    expect(screen.getByText('如果现在能随便逛逛，你更想去哪种地方？')).toBeInTheDocument()
    expect(screen.getByText('选择你的回应')).toBeInTheDocument()
    expect(screen.queryByText('慢慢选，没有标准答案 ( ´ ▽ ` )')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '安静一点的' })).toHaveClass('flash-dialogue__choice')
    expect(screen.getByText('安静一点的')).toHaveClass('flash-dialogue__choice-label')
    expect(document.querySelector('textarea')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '安静一点的' }))
    await waitFor(() => expect(mocks.answer).toHaveBeenCalledWith({
      encounterId: 'encounter-1', questionId: 'q1', optionId: 'quiet',
    }))
  })

  it.each([
    ['alang', 'flash-alang-dialogue-paper-v1.jpg'],
    ['lizi', 'flash-lizi-dialogue-paper-v1.jpg'],
    ['momo', 'flash-momo-dialogue-paper-v1.jpg'],
    ['shiqi', 'flash-shiqi-dialogue-paper-v1.jpg'],
    ['atuan', 'flash-atuan-dialogue-paper-v1.jpg'],
  ])('uses the approved paper master for %s', (slug, expectedAsset) => {
    mocks.useEncounter.mockReturnValue({
      data: { ...questionEncounter, npc: { ...questionEncounter.npc, slug } },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })

    const { container } = render(<FlashDialoguePage />)
    const scene = container.querySelector('.flash-dialogue__scene-art')
    expect(scene).toHaveAttribute('src', expect.stringContaining(expectedAsset))
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
    mocks.deliver.mockResolvedValue({
      ...questionEncounter,
      deliveryMessage: '你真的去了呀，谢谢你替我看见那一小块地方。',
    })
    render(<FlashDialoguePage />)

    expect(screen.getByText('上次托你的事')).toBeInTheDocument()
    fireEvent.click(screen.getByText('交给栗子'))
    await waitFor(() => expect(mocks.deliver).toHaveBeenCalledWith({
      encounterId: 'encounter-1', assignmentId: 'assignment-1',
    }))
    expect(await screen.findByText('你真的去了呀，谢谢你替我看见那一小块地方。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '再聊两句' })).toBeInTheDocument()
  })

  it('closes the meeting after delivery when the response has no next question', async () => {
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
    mocks.deliver.mockResolvedValue({
      ...questionEncounter,
      currentQuestion: null,
      deliveryMessage: '有你的回话，这件事就圆满了。',
    })

    render(<FlashDialoguePage />)
    fireEvent.click(screen.getByText('交给栗子'))

    expect(await screen.findByText('有你的回话，这件事就圆满了。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '收好这次见面' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '再聊两句' })).not.toBeInTheDocument()
  })

  it('does not fetch a disabled deep link', () => {
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: false } } })
    render(<FlashDialoguePage />)
    expect(screen.getByText('街头盲盒正在准备下一次见面')).toBeInTheDocument()
    expect(mocks.useEncounter).toHaveBeenCalledWith('encounter-1', false)
  })
})

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
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getCurrentInstance: () => ({ router: { params: { encounterId: 'encounter-1' } } }),
    setNavigationBarTitle: vi.fn(),
    redirectTo: vi.fn(),
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

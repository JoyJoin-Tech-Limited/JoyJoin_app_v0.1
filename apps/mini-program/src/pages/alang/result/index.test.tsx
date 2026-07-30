import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlashFeedbackPage from './index'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useAssignment: vi.fn(),
  submit: vi.fn(),
  retryTask: vi.fn(),
  refetch: vi.fn(),
  canonicalRedirect: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getCurrentInstance: () => ({ router: { params: { assignmentId: 'assignment-1' } } }),
    setNavigationBarTitle: vi.fn(),
    redirectTo: vi.fn(),
    showToast: vi.fn(),
    showModal: vi.fn().mockResolvedValue({ confirm: true }),
  },
}))
vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
  Image: ({ mode: _mode, onError: _onError, ...props }: any) => <img {...props} />,
  Textarea: ({ onInput, maxlength, ...props }: any) => (
    <textarea
      {...props}
      maxLength={maxlength}
      onChange={(event) => onInput({ detail: { value: event.target.value } })}
    />
  ),
}))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../../lib/alang/useFlash', () => ({
  useFlashAssignment: mocks.useAssignment,
  useSubmitFlashFeedback: () => ({ mutateAsync: mocks.submit, isPending: false }),
  useRetryFlashAssignment: () => ({ mutateAsync: mocks.retryTask, isPending: false }),
}))
vi.mock('../../../lib/alang/flashNavigation', () => ({ redirectToFlashCanonical: mocks.canonicalRedirect }))
vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))

const assignment = {
  id: 'assignment-1', assignmentId: 'assignment-1', canonicalScreen: 'feedback',
  npc: { id: 'npc-1', slug: 'shiqi', name: '拾柒' },
  title: '看看旧街的招牌', category: '城市观察', status: 'feedback_pending',
  feedbackQuestions: [
    { id: 'legacy-1', promptId: 'prompt-1', prompt: '那里给你的第一感觉是？', options: [
      { id: 'quiet', label: '安静' }, { id: 'alive', label: '有生命力' },
    ] },
    { id: 'legacy-2', promptId: 'prompt-2', prompt: '你还会想再去吗？', options: [
      { id: 'yes', label: '会' }, { id: 'maybe', label: '看心情' },
    ] },
  ],
}

describe('formal Flash feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: true } } })
    mocks.useAssignment.mockReturnValue({ data: assignment, isLoading: false, isError: false, refetch: mocks.refetch })
    mocks.submit.mockResolvedValue({ canonicalScreen: 'delivery', assignmentId: 'assignment-1' })
    mocks.canonicalRedirect.mockResolvedValue(false)
  })

  it('submits 1–2 structured answers plus an optional 100-char private reply', async () => {
    render(<FlashFeedbackPage />)
    fireEvent.click(screen.getByRole('button', { name: '有生命力' }))
    fireEvent.click(screen.getByRole('button', { name: '会' }))
    fireEvent.change(screen.getByRole('textbox', { name: '给角色的私密回信，最多100字' }), {
      target: { value: '我注意到一块很旧的蓝色招牌。' },
    })
    fireEvent.click(screen.getByText('保存，等下次交付'))

    await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith({
      assignmentId: 'assignment-1',
      answers: [
        { promptId: 'prompt-1', optionId: 'alive' },
        { promptId: 'prompt-2', optionId: 'yes' },
      ],
      privateReply: '我注意到一块很旧的蓝色招牌。',
    }))
    expect(await screen.findByText('这件事，先替你收好了')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('explains the private-reply retention and profiling boundary', () => {
    render(<FlashFeedbackPage />)
    expect(screen.getByText(/不用于用户画像、数据分析、个人故事或模型训练/)).toBeInTheDocument()
    expect(screen.getByText(/交付后 30 天删除/)).toBeInTheDocument()
  })

  it('does not fetch a disabled deep link', () => {
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: false } } })
    render(<FlashFeedbackPage />)
    expect(mocks.useAssignment).toHaveBeenCalledWith('assignment-1', false)
    expect(screen.getByText('街头盲盒正在准备下一次见面')).toBeInTheDocument()
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PersonalStoryResponse } from './api'
import PersonalStoryPage from './index'

const mocks = vi.hoisted(() => ({
  fetchPersonalStory: vi.fn(),
  requestPersonalStoryUpdate: vi.fn(),
  showToast: vi.fn(),
  haptics: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    showToast: mocks.showToast,
  },
  useDidShow: vi.fn(),
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, userSelect: _userSelect, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode: _mode, onError: _onError, ...props }: any) => <img {...props} />,
  ScrollView: ({ children, scrollY: _scrollY, enhanced: _enhanced, showScrollbar: _showScrollbar, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return {
    ...actual,
    fetchPersonalStory: mocks.fetchPersonalStory,
    requestPersonalStoryUpdate: mocks.requestPersonalStoryUpdate,
  }
})

vi.mock('../../../hooks/useAuthGuard', () => ({
  useAuthGuard: () => ({
    isLoading: false,
    isAuthenticated: true,
    user: { id: 'current-user' },
  }),
}))

vi.mock('../../../hooks/usePageTTI', () => ({
  usePageTTI: vi.fn(),
}))

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: mocks.haptics,
}))

vi.mock('../../../components/loading/LoadingScreen', () => ({
  default: ({ message }: { message: string }) => <div>{message}</div>,
}))

vi.mock('../../../components/ui/StatusCard', () => ({
  default: ({ title, description, action }: any) => (
    <div>
      <span>{title}</span>
      <span>{description}</span>
      {action ? <button onClick={action.onClick}>{action.label}</button> : null}
    </div>
  ),
}))

vi.mock('../../../components/ai-content/AIGCLabel', () => ({
  default: ({ meta }: any) => meta?.aiGenerated
    ? <span aria-label='AI 生成内容'>AI 生成内容</span>
    : null,
}))

const baseResponse: PersonalStoryResponse = {
  story: {
    title: '沿着真实生活写下去',
    subtitle: '你经历的每一次相遇，都属于同一本故事。',
    updatedAt: '2026-07-15T16:20:00+08:00',
    chapters: [
      {
        id: 'chapter-new',
        occurredAt: '2026-07-12T20:00:00+08:00',
        activityType: '闪现同行',
        title: '2026.07.12 · 闪现',
        preview: '故事发生在2026年7月12日。这次真实经历属于闪现。',
        body: '故事发生在2026年7月12日。这次真实经历属于闪现。\n\n这一段发生在深圳湾公园。这次经历中出现了阿浪。',
        aigc: { aiGenerated: true, labelType: 'ai-generated' },
      },
      {
        id: 'chapter-old',
        occurredAt: '2026-06-03T19:00:00+08:00',
        activityType: 'Blind Box',
        title: '2026.06.03 · 盲盒活动',
        preview: '故事发生在2026年6月3日。这次真实经历属于盲盒活动。',
        body: '故事发生在2026年6月3日。这次真实经历属于盲盒活动。',
        aigc: { aiGenerated: true, labelType: 'ai-generated' },
      },
    ],
  },
  updateJob: null,
  aiEnabled: true,
  canUpdate: true,
}

function renderPage(response: PersonalStoryResponse = baseResponse) {
  mocks.fetchPersonalStory.mockResolvedValue(response)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { ...render(<PersonalStoryPage />, { wrapper: Wrapper }), queryClient }
}

describe('PersonalStoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requestPersonalStoryUpdate.mockResolvedValue({
      accepted: true,
      noNewExperiences: false,
      updateJob: { status: 'queued' },
    })
  })

  it('renders only the current user story and orders chapters oldest to newest', async () => {
    renderPage()

    expect(await screen.findByText('沿着真实生活写下去')).toBeInTheDocument()
    const chapterTitles = document.querySelectorAll('.personal-story__chapter-title')
    expect([...chapterTitles].map((node) => node.textContent)).toEqual([
      '2026.06.03 · 盲盒活动',
      '2026.07.12 · 闪现',
    ])
    expect(mocks.fetchPersonalStory).toHaveBeenCalledWith()
    expect(screen.queryByText(/统计|已生成|待续写/)).not.toBeInTheDocument()
    expect(screen.getAllByLabelText('AI 生成内容')).toHaveLength(2)
  })

  it('expands and collapses the complete chapter body in place', async () => {
    renderPage()
    const openButton = await screen.findByRole('button', {
      name: '阅读完整章节：2026.07.12 · 闪现',
    })

    fireEvent.click(openButton)

    expect(screen.getByText('这一段发生在深圳湾公园。这次经历中出现了阿浪。')).toBeInTheDocument()
    expect(screen.getByRole('button', {
      name: '收起章节：2026.07.12 · 闪现',
    })).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('button', {
      name: '收起章节：2026.07.12 · 闪现',
    }))
    expect(screen.queryByText('这一段发生在深圳湾公园。这次经历中出现了阿浪。')).not.toBeInTheDocument()
  })

  it('recovers a running background update while keeping every old chapter readable', async () => {
    renderPage({
      ...baseResponse,
      updateJob: { id: 'job-1', status: 'running' },
    })

    expect(await screen.findByText('2026.06.03 · 盲盒活动')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '故事正在更新' })).toBeDisabled()
    expect(screen.getByText('你可以继续读旧章节，新的经历整理好后会自然出现在最后。')).toBeInTheDocument()
    expect(screen.queryByText(/已生成|待续写/)).not.toBeInTheDocument()
  })

  it('keeps the story readable when AI updates are disabled', async () => {
    renderPage({
      ...baseResponse,
      aiEnabled: false,
      canUpdate: false,
      updateJob: { status: 'disabled' },
    })

    expect(await screen.findByText('2026.07.12 · 闪现')).toBeInTheDocument()
    const updateButton = screen.getByRole('button', { name: '故事更新暂不可用' })
    expect(updateButton).toBeDisabled()
    fireEvent.click(updateButton)
    expect(mocks.requestPersonalStoryUpdate).not.toHaveBeenCalled()
    expect(screen.queryByText(/活动列表|活动记录/)).not.toBeInTheDocument()
  })

  it('requests an update without a client-supplied user id and refreshes the story', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: '更新故事' }))

    await waitFor(() => expect(mocks.requestPersonalStoryUpdate).toHaveBeenCalledWith())
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: '新的经历会写进这本故事',
    })))
    expect(mocks.haptics).toHaveBeenCalledWith('light')
  })

  it('keeps old chapters visible when an update request fails', async () => {
    mocks.requestPersonalStoryUpdate.mockRejectedValueOnce(new Error('offline'))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: '更新故事' }))

    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: '这次没更新成功，旧章节都还在',
    })))
    expect(screen.getByText('2026.06.03 · 盲盒活动')).toBeInTheDocument()
    expect(screen.getByText('旧章节都好好留着。准备好时，可以再试一次更新。')).toBeInTheDocument()
  })

  it('explains that nothing changed when there are no new verified experiences', async () => {
    mocks.requestPersonalStoryUpdate.mockResolvedValueOnce({
      accepted: false,
      noNewExperiences: true,
      story: baseResponse.story,
      updateJob: null,
    })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: '更新故事' }))

    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: '还没有新的真实经历，旧章节都在这里',
    })))
    expect(screen.getByText('2026.06.03 · 盲盒活动')).toBeInTheDocument()
  })
})

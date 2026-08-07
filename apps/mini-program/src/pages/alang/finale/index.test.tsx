import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlashFinalePage from './index'

const mocks = vi.hoisted(() => ({ useAuth: vi.fn(), useEncounter: vi.fn(), redirectTo: vi.fn() }))

vi.mock('@tarojs/taro', () => ({
  default: {
    getCurrentInstance: () => ({ router: { params: { encounterId: 'encounter-1' } } }),
    redirectTo: mocks.redirectTo,
  },
}))
vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
}))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../../lib/alang/useFlash', () => ({ useFlashEncounter: mocks.useEncounter }))
vi.mock('../../../components/alang/FlashUi', () => ({
  FlashButton: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  FlashPageState: ({ title, description }: any) => <div>{title}{description}</div>,
}))

describe('Flash parallel-universe finale', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useAuth.mockReturnValue({ user: { features: { alangEnabled: true } } })
    mocks.useEncounter.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        storyEpisode: {
          code: 'season-finale',
          seasonTitle: '没有名字的旧物',
          title: '守桥的人',
          response: '你没有替谁决定去留，而是让两岸都保留了抵达彼此的可能。',
          ending: {
            code: 'bridge_keeper',
            vector: { trust: 4, attachment: 2, intervention: -1, truth: 3 },
            highlights: [
              { episodeTitle: '旧车票', optionLabel: '先听完它的故事' },
              { episodeTitle: '双人座位图', optionLabel: '把位置留在原处' },
              { episodeTitle: '没有锁孔的钥匙', optionLabel: '继续追问来源' },
            ],
          },
        },
      },
    })
  })

  it('reveals the ending, three decisive choices and the full trajectory', () => {
    render(<FlashFinalePage />)
    expect(screen.getByText('守桥的人')).toBeInTheDocument()
    expect(screen.getByText('三次关键转向')).toBeInTheDocument()
    expect(screen.getByText('先听完它的故事')).toBeInTheDocument()
    expect(screen.getByText('相信')).toBeInTheDocument()
    expect(screen.getByText('+4')).toBeInTheDocument()
    expect(screen.getByText('另一条时间线仍然存在')).toBeInTheDocument()
  })
})

import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FlashStoryArchivePage from './index'

const mocks = vi.hoisted(() => ({
  useArchive: vi.fn(),
  track: vi.fn(),
  haptics: vi.fn(),
  setNavigationBarTitle: vi.fn(),
  navigateBack: vi.fn().mockResolvedValue({}),
  redirectTo: vi.fn().mockResolvedValue({}),
  getStorageSync: vi.fn().mockReturnValue(null),
  setStorageSync: vi.fn(),
  didShow: null as null | (() => void),
  refetch: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  useDidShow: (callback: () => void) => { mocks.didShow = callback },
  default: {
    setNavigationBarTitle: mocks.setNavigationBarTitle,
    navigateBack: mocks.navigateBack,
    redirectTo: mocks.redirectTo,
    getStorageSync: mocks.getStorageSync,
    setStorageSync: mocks.setStorageSync,
  },
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
  Image: ({ mode: _mode, onError: _onError, ...props }: any) => <img {...props} />,
}))

vi.mock('../../../lib/alang/useFlash', () => ({
  useFlashStoryArchive: mocks.useArchive,
}))

vi.mock('../../../lib/analytics/flashStoryAnalytics', () => ({
  flashStoryAnalytics: { track: mocks.track },
}))

vi.mock('../../../lib/utils/haptics', () => ({ haptics: mocks.haptics }))

vi.mock('../../../hooks/useMiniRevealMotion', () => ({
  useMiniRevealMotion: () => ({ motionMode: 'full', shouldReduceMotion: false, source: 'default' }),
}))

const emptyArchive = {
  season: { id: 'season-1', code: 's1', title: '没有名字的旧物' },
  fragments: [],
  imprints: [],
  hookHint: null,
  completedUnitIds: [],
}

const populatedArchive = {
  ...emptyArchive,
  fragments: [
    {
      id: 'frag-1',
      code: 's1-p1-alang-fragment',
      category: 'object' as const,
      title: '迟到的出发',
      fact: '这本册子不是没被想起。',
      assetUrl: null,
      unlockedAt: '2026-08-20T10:00:00.000Z',
      episodeTitle: '一张画了两把椅子的图',
      npcName: '阿浪',
    },
  ],
  imprints: [
    { unitId: 's1-p1-alang', template: 'spacing' as const, resultId: 'aligned', settledAt: '2026-08-20T10:00:00.000Z' },
    { unitId: 's1-p2-alang', template: 'path' as const, resultId: 'joined', settledAt: '2026-08-21T10:00:00.000Z' },
    { unitId: 's1-p3-alang', template: 'path' as const, resultId: 'returned', settledAt: '2026-08-22T10:00:00.000Z' },
    { unitId: 's1-p1-shiqi', template: 'overlay' as const, resultId: 'aligned', settledAt: '2026-08-23T10:00:00.000Z' },
    { unitId: 's1-p3-shiqi', template: 'privacy' as const, resultId: 'masked', settledAt: '2026-08-24T10:00:00.000Z' },
  ],
  hookHint: '阿浪听到过金属碰过木板的声音。箱子里的那个东西，也许还在。',
  completedUnitIds: ['s1-p1-alang', 's1-p2-alang', 's1-p3-alang', 's1-p1-shiqi', 's1-p3-shiqi'],
}

describe('FlashStoryArchivePage (谜案档案台)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mocks.didShow = null
    mocks.getStorageSync.mockReturnValue(null)
    mocks.useArchive.mockReturnValue({ data: emptyArchive, isLoading: false, isError: false, refetch: mocks.refetch })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the loading state while the archive is being fetched', () => {
    mocks.useArchive.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: mocks.refetch })
    render(<FlashStoryArchivePage />)
    expect(screen.getByText('正在翻开档案台…')).toBeInTheDocument()
  })

  it('shows an error state with retry and never loses progress copy', () => {
    mocks.useArchive.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: mocks.refetch })
    render(<FlashStoryArchivePage />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重新打开' }))
    expect(mocks.refetch).toHaveBeenCalledTimes(1)
  })

  it('renders the empty archive with warm empty copy and fires archive_opened once', () => {
    render(<FlashStoryArchivePage />)
    expect(screen.getByText('谜案档案台')).toBeInTheDocument()
    expect(screen.getByText('还没有一起留下的印记')).toBeInTheDocument()
    expect(screen.getByText('故事还没有翻开')).toBeInTheDocument()

    act(() => { mocks.didShow?.() })
    act(() => { mocks.didShow?.() })
    expect(mocks.track).toHaveBeenCalledTimes(1)
    expect(mocks.track).toHaveBeenCalledWith('s1-p1-alang', 'archive_opened')
  })

  it('renders fragments, imprints and the unresolved hook hint from DTO fields only', () => {
    mocks.useArchive.mockReturnValue({ data: populatedArchive, isLoading: false, isError: false, refetch: mocks.refetch })
    render(<FlashStoryArchivePage />)

    expect(screen.getByText('迟到的出发')).toBeInTheDocument()
    expect(screen.getByText('阿浪 · 一张画了两把椅子的图')).toBeInTheDocument()
    expect(screen.getAllByTestId('flash-archive-imprint')).toHaveLength(5)
    expect(screen.getByText('一起摆好了距离')).toBeInTheDocument()
    expect(screen.getByText('一起守住了边界')).toBeInTheDocument()
    expect(screen.getByText('还有一件事没有答案')).toBeInTheDocument()
    expect(screen.getByText(/金属碰过木板的声音/)).toBeInTheDocument()
    // 结果枚举 id 不直接露出给用户。
    expect(screen.queryByText('aligned')).not.toBeInTheDocument()
  })

  it('offers the zero-fail synthesis ceremony only when both pilot lines are complete', () => {
    mocks.useArchive.mockReturnValue({
      data: { ...populatedArchive, imprints: populatedArchive.imprints.slice(0, 3) },
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    })
    render(<FlashStoryArchivePage />)
    expect(screen.queryByTestId('flash-archive-ceremony')).not.toBeInTheDocument()
  })

  it('runs the calm ceremony to completion and fires phase_synthesis_completed exactly once', () => {
    mocks.useArchive.mockReturnValue({ data: populatedArchive, isLoading: false, isError: false, refetch: mocks.refetch })
    render(<FlashStoryArchivePage />)

    const ceremony = screen.getByTestId('flash-archive-ceremony')
    expect(ceremony).toHaveTextContent('两条线的印记都到齐了')
    fireEvent.click(screen.getByRole('button', { name: '收好这一阶段的线索' }))
    expect(screen.getByText('正在把这一阶段的线索收进档案…')).toBeInTheDocument()
    expect(mocks.track.mock.calls.filter((call) => call[1] === 'phase_synthesis_completed')).toHaveLength(0)

    act(() => { vi.advanceTimersByTime(24_000) })
    expect(screen.getByTestId('flash-archive-ceremony-done')).toHaveTextContent('这一阶段的线索已经收进档案')
    expect(mocks.track.mock.calls.filter((call) => call[1] === 'phase_synthesis_completed')).toHaveLength(1)
    expect(mocks.track).toHaveBeenCalledWith('s1-p3-shiqi', 'phase_synthesis_completed')
    expect(mocks.setStorageSync).toHaveBeenCalledWith('joyjoin:flash:archive-synthesis:s1', 'done')
  })

  it('restores the settled ceremony state from the local archive marker', () => {
    mocks.getStorageSync.mockReturnValue('done')
    mocks.useArchive.mockReturnValue({ data: populatedArchive, isLoading: false, isError: false, refetch: mocks.refetch })
    render(<FlashStoryArchivePage />)
    expect(screen.queryByRole('button', { name: '收好这一阶段的线索' })).not.toBeInTheDocument()
    expect(screen.getByTestId('flash-archive-ceremony-done')).toBeInTheDocument()
  })

  it('offers a skip after 8 seconds that settles the ceremony on the same path exactly once', () => {
    mocks.useArchive.mockReturnValue({ data: populatedArchive, isLoading: false, isError: false, refetch: mocks.refetch })
    render(<FlashStoryArchivePage />)

    fireEvent.click(screen.getByRole('button', { name: '收好这一阶段的线索' }))
    expect(screen.queryByRole('button', { name: '不用等了，直接收好这一阶段的线索' })).not.toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(8_000) })
    fireEvent.click(screen.getByRole('button', { name: '不用等了，直接收好这一阶段的线索' }))

    expect(screen.getByTestId('flash-archive-ceremony-done')).toHaveTextContent('这一阶段的线索已经收进档案')
    expect(mocks.track.mock.calls.filter((call) => call[1] === 'phase_synthesis_completed')).toHaveLength(1)
    expect(mocks.setStorageSync).toHaveBeenCalledWith('joyjoin:flash:archive-synthesis:s1', 'done')

    // 仪式已收尾，残留的计时器不得再触发第二次合成。
    act(() => { vi.advanceTimersByTime(60_000) })
    expect(mocks.track.mock.calls.filter((call) => call[1] === 'phase_synthesis_completed')).toHaveLength(1)
  })
})

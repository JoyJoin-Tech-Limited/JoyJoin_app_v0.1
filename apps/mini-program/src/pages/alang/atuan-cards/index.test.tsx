import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AtuanCardsPage from './index'

const mocks = vi.hoisted(() => ({
  params: { mode: 'alang', key: 'game-key', approach: '0', unitId: 's1-p1-alang', phase: '1' } as Record<string, string>,
  storage: new Map<string, unknown>(),
  setStorageSync: vi.fn((key: string, value: unknown) => mocks.storage.set(key, value)),
  navigateBack: vi.fn(),
  reLaunch: vi.fn(),
  getCurrentPages: vi.fn(() => [{ route: 'pages/alang/dialogue/index' }, { route: 'pages/alang/atuan-cards/index' }]),
}))
vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: (key: string) => mocks.storage.get(key),
    setStorageSync: mocks.setStorageSync,
    navigateBack: mocks.navigateBack,
    reLaunch: mocks.reLaunch,
    getCurrentPages: mocks.getCurrentPages,
  },
  useRouter: () => ({ params: mocks.params }),
}))
vi.mock('@tarojs/components', () => ({ View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>, Text: ({ children, ...props }: any) => <span {...props}>{children}</span> }))

afterEach(cleanup)
beforeEach(() => {
  mocks.storage.clear()
  mocks.setStorageSync.mockClear()
  mocks.navigateBack.mockReset()
  mocks.navigateBack.mockResolvedValue(undefined)
  mocks.reLaunch.mockReset()
  mocks.reLaunch.mockResolvedValue(undefined)
  mocks.getCurrentPages.mockReturnValue([{ route: 'pages/alang/dialogue/index' }, { route: 'pages/alang/atuan-cards/index' }])
})

describe('shared first-act game page', () => {
  it.each([
    ['alang', '阿浪的窗边双椅', '阿浪', '留出半步距离'],
    ['lizi', '栗子的试色桌', '栗子', '配圆弧缺口帽'],
    ['momo', '默默的路线册', '默默', '听完三次间隔'],
    ['shiqi', '拾柒的检视灯箱', '拾柒', '对齐三张纸共同的位置'],
  ])('keeps %s on the Atuan one-item / feedback / continue rhythm', (mode, heading, speaker, correctLabel) => {
    mocks.params = { mode, key: 'game-key', approach: '0' }
    render(<AtuanCardsPage />)
    expect(screen.getByText(heading)).toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '翻开并观察这一项' }))
    const choices = screen.getAllByRole('button')
    expect(choices).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: correctLabel }))
    expect(screen.getByRole('status')).toHaveTextContent(speaker)
    expect(screen.getByRole('button', { name: '继续整理' })).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '继续整理' }))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('keeps Lizi on the current trace until the matching cap is chosen', () => {
    mocks.params = { mode: 'lizi', key: 'lizi-game', approach: '0' }
    render(<AtuanCardsPage />)

    fireEvent.click(screen.getByRole('button', { name: '翻开并观察这一项' }))
    fireEvent.click(screen.getByRole('button', { name: '配双细纹帽' }))
    expect(screen.getByRole('status')).toHaveTextContent('接不上软弧')
    fireEvent.click(screen.getByRole('button', { name: '再看一次' }))
    expect(screen.getByText('1 / 3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '配圆弧缺口帽' }))
    fireEvent.click(screen.getByRole('button', { name: '继续整理' }))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('makes Atuan apply the privacy boundary instead of accepting every card destination', () => {
    mocks.params = { mode: 'atuan', key: 'atuan-game', approach: 'notice_wait', unitId: 's1-p1-atuan', phase: '1' }
    render(<AtuanCardsPage />)
    fireEvent.click(screen.getByRole('button', { name: '翻开并观察这一项' }))
    expect(screen.getByText('每周固定出现的时间')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '可以一起记住' }))
    fireEvent.click(screen.getByRole('button', { name: '再看一次' }))
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '先替他遮住' }))
    fireEvent.click(screen.getByRole('button', { name: '继续整理' }))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('stores three choices and navigates back only after the last feedback', async () => {
    mocks.params = { mode: 'momo', key: 'momo-game', approach: '0', unitId: 's1-p1-momo', phase: '1' }
    render(<AtuanCardsPage />)
    for (const [index, choiceLabel] of ['听完三次间隔', '只沿三处折点核对', '在页边主动收笔'].entries()) {
      fireEvent.click(screen.getByRole('button', { name: '翻开并观察这一项' }))
      fireEvent.click(screen.getByRole('button', { name: choiceLabel }))
      fireEvent.click(screen.getByRole('button', { name: index === 2 ? '收好最后一项' : '继续整理' }))
    }
    expect(mocks.setStorageSync).toHaveBeenCalledWith('momo-game', expect.objectContaining({
      version: 'flash-act-game-v2',
      unitId: 's1-p1-momo',
      phase: 1,
      status: 'completed',
      placements: expect.arrayContaining([
        expect.objectContaining({ cardId: 'rain' }),
        expect.objectContaining({ cardId: 'turn' }),
        expect.objectContaining({ cardId: 'blank' }),
      ]),
    }))
    await waitFor(() => expect(mocks.navigateBack).toHaveBeenCalledTimes(1))
  })

  it('does not auto-navigate from a restored completion before the page stack is ready', () => {
    mocks.params = { mode: 'momo', key: 'momo-game', approach: '0', unitId: 's1-p1-momo', phase: '1' }
    mocks.storage.set('momo-game', {
      version: 'flash-act-game-v1',
      unitId: 's1-p1-momo',
      phase: 1,
      mode: 'momo',
      status: 'completed',
      placements: [
        { cardId: 'rain', destinationId: 'listen' },
        { cardId: 'turn', destinationId: 'trace' },
        { cardId: 'blank', destinationId: 'stop' },
      ],
      pending: null,
    })

    render(<AtuanCardsPage />)

    expect(mocks.navigateBack).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '回到角色故事' })).toBeInTheDocument()
  })

  it('relaunches the Flash home when the parent webview no longer exists', async () => {
    mocks.params = { mode: 'momo', key: 'momo-game', approach: '0', unitId: 's1-p1-momo', phase: '1' }
    mocks.navigateBack.mockRejectedValueOnce(new Error('navigateBack with an unexist webviewId'))
    render(<AtuanCardsPage />)

    for (const [index, choiceLabel] of ['听完三次间隔', '只沿三处折点核对', '在页边主动收笔'].entries()) {
      fireEvent.click(screen.getByRole('button', { name: '翻开并观察这一项' }))
      fireEvent.click(screen.getByRole('button', { name: choiceLabel }))
      fireEvent.click(screen.getByRole('button', { name: index === 2 ? '收好最后一项' : '继续整理' }))
    }

    await waitFor(() => expect(mocks.reLaunch).toHaveBeenCalledWith({ url: '/pages/alang/event/index' }))
  })

  it('binds partial game progress to its story act and resumes without trapping the player', () => {
    mocks.params = { mode: 'momo', key: 'momo-act-1-game', approach: '0', unitId: 's1-p1-momo', phase: '1' }
    const firstRender = render(<AtuanCardsPage />)

    fireEvent.click(screen.getByRole('button', { name: '翻开并观察这一项' }))
    fireEvent.click(screen.getByRole('button', { name: '听完三次间隔' }))
    fireEvent.click(screen.getByRole('button', { name: '继续整理' }))

    expect(mocks.storage.get('momo-act-1-game')).toMatchObject({
      version: 'flash-act-game-v2',
      unitId: 's1-p1-momo',
      phase: 1,
      status: 'playing',
      placements: [expect.objectContaining({ cardId: 'rain' })],
    })

    firstRender.unmount()
    render(<AtuanCardsPage />)
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '翻开并观察这一项' }))
    expect(screen.getByText('第二段：竖牌在中段向里折')).toBeInTheDocument()
  })

  it('does not restore game progress that belongs to another story act', () => {
    mocks.params = { mode: 'momo', key: 'momo-game', approach: '0', unitId: 's1-p1-momo', phase: '1' }
    mocks.storage.set('momo-game', {
      version: 'flash-act-game-v1',
      unitId: 's1-p2-momo',
      phase: 2,
      mode: 'momo',
      status: 'playing',
      placements: [{ cardId: 'rain', destinationId: 'listen' }],
      pending: null,
    })

    render(<AtuanCardsPage />)

    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.queryByText('2 / 3')).not.toBeInTheDocument()
  })

  it('escalates repeated mistakes into a clue and an explicit assist without skipping the item', () => {
    mocks.params = { mode: 'lizi', key: 'lizi-assist', approach: '0', unitId: 's1-p1-lizi', phase: '1' }
    render(<AtuanCardsPage />)
    fireEvent.click(screen.getByRole('button', { name: '翻开并观察这一项' }))

    for (let attempt = 0; attempt < 3; attempt += 1) {
      fireEvent.click(screen.getByRole('button', { name: '配双细纹帽' }))
      if (attempt >= 1) expect(screen.getByText(/线索：/)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '再看一次' }))
    }

    expect(screen.getByRole('button', { name: '请角色标出关键线索' })).toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })
})

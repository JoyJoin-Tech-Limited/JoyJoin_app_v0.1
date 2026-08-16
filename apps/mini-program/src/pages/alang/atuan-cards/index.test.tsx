import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AtuanCardsPage from './index'

const mocks = vi.hoisted(() => ({ params: { mode: 'alang', key: 'game-key', approach: '0' } as Record<string, string>, setStorageSync: vi.fn(), navigateBack: vi.fn() }))
vi.mock('@tarojs/taro', () => ({
  default: { setStorageSync: mocks.setStorageSync, navigateBack: mocks.navigateBack },
  useRouter: () => ({ params: mocks.params }),
}))
vi.mock('@tarojs/components', () => ({ View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>, Text: ({ children, ...props }: any) => <span {...props}>{children}</span> }))

afterEach(cleanup)
beforeEach(() => { mocks.setStorageSync.mockClear(); mocks.navigateBack.mockClear() })

describe('shared first-act game page', () => {
  it.each([
    ['alang', '阿浪的窗边双椅', '阿浪'],
    ['lizi', '栗子的试色桌', '栗子'],
    ['momo', '默默的路线册', '默默'],
    ['shiqi', '拾柒的检视灯箱', '拾柒'],
  ])('keeps %s on the Atuan one-item / feedback / continue rhythm', (mode, heading, speaker) => {
    mocks.params = { mode, key: 'game-key', approach: '0' }
    render(<AtuanCardsPage />)
    expect(screen.getByText(heading)).toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    const choices = screen.getAllByRole('button')
    expect(choices).toHaveLength(3)
    fireEvent.click(choices[1])
    expect(screen.getByRole('status')).toHaveTextContent(speaker)
    expect(screen.getByRole('button', { name: '继续整理' })).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '继续整理' }))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('keeps Lizi on the current trace until the matching cap is chosen', () => {
    mocks.params = { mode: 'lizi', key: 'lizi-game', approach: '0' }
    render(<AtuanCardsPage />)

    fireEvent.click(screen.getByRole('button', { name: '配双细纹帽' }))
    expect(screen.getByRole('status')).toHaveTextContent('接不上软弧')
    fireEvent.click(screen.getByRole('button', { name: '再看一次' }))
    expect(screen.getByText('1 / 3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '配圆弧缺口帽' }))
    fireEvent.click(screen.getByRole('button', { name: '继续整理' }))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('stores three choices and navigates back only after the last feedback', () => {
    mocks.params = { mode: 'momo', key: 'momo-game', approach: '0' }
    render(<AtuanCardsPage />)
    for (let index = 0; index < 3; index += 1) {
      fireEvent.click(screen.getAllByRole('button')[1])
      fireEvent.click(screen.getByRole('button', { name: index === 2 ? '收好最后一项' : '继续整理' }))
    }
    expect(mocks.setStorageSync).toHaveBeenCalledWith('momo-game', expect.arrayContaining([
      expect.objectContaining({ cardId: 'rain' }),
      expect.objectContaining({ cardId: 'turn' }),
      expect.objectContaining({ cardId: 'blank' }),
    ]))
    expect(mocks.navigateBack).toHaveBeenCalledTimes(1)
  })
})

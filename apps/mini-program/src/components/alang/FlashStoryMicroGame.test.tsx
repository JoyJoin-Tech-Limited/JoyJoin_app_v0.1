import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FlashStoryMicroGame } from './FlashStoryMicroGame'

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

afterEach(cleanup)

function renderGame(episodeCode: string, objectCode: string) {
  const onSolved = vi.fn(); const onFirstMistake = vi.fn(); const onInteractionStart = vi.fn()
  render(<FlashStoryMicroGame episodeCode={episodeCode} objectCode={objectCode} onSolved={onSolved} onFirstMistake={onFirstMistake} onInteractionStart={onInteractionStart} />)
  return { onSolved, onFirstMistake, onInteractionStart }
}

describe('FlashStoryMicroGame strategies', () => {
  it('uses five perceptibly different interaction structures', () => {
    const cases = [
      ['s1-p1-alang', 'seat-plan', '.flash-story-game__chairs'],
      ['s1-p1-lizi', 'dry-markers', '.flash-story-game__swatches'],
      ['s1-p1-momo', 'route-book', '.flash-story-game__pathline'],
      ['s1-p2-lizi', 'outing-book', '.flash-story-game__paper-stack'],
      ['s1-p2-shiqi', 'observation-cards', '.flash-story-game__privacy-grid'],
    ]
    for (const [episodeCode, objectCode, selector] of cases) {
      const view = render(<FlashStoryMicroGame episodeCode={episodeCode} objectCode={objectCode} onSolved={vi.fn()} />)
      expect(view.container.querySelector(selector)).toBeInTheDocument()
      view.unmount()
    }
  })

  it('solves the seat spacing by adjusting the actual distance', () => {
    const { onSolved } = renderGame('s1-p1-alang', 'seat-plan')
    fireEvent.click(screen.getByRole('button', { name: '拉开一点' }))
    fireEvent.click(screen.getByRole('button', { name: '确认距离' }))
    expect(onSolved).toHaveBeenCalledTimes(1)
  })

  it('pairs caps from visible trial marks', () => {
    const { onSolved } = renderGame('s1-p1-lizi', 'dry-markers')
    for (const label of ['蓝帽', '紫帽', '橙帽']) fireEvent.click(screen.getByRole('button', { name: label }))
    expect(onSolved).toHaveBeenCalledTimes(1)
  })

  it('turns Momo phase three into finding a writable pen and completing the invitation', () => {
    const { onSolved } = renderGame('s1-p3-momo', 'dry-markers')
    expect(screen.getByText('找到能写的笔，再补完邀请')).toBeInTheDocument()
    for (const label of ['能写的笔', '补上时间', '补上方向']) {
      fireEvent.click(screen.getByRole('button', { name: label }))
    }
    expect(onSolved).toHaveBeenCalledTimes(1)
  })

  it('walks route checkpoints in the episode-specific order', () => {
    const { onSolved } = renderGame('s1-p1-momo', 'route-book')
    for (const label of ['旧路口', '两声轻响', '空白页']) fireEvent.click(screen.getByRole('button', { name: label }))
    expect(onSolved).toHaveBeenCalledTimes(1)
  })

  it('aligns a paper stack without using the Shiqi drag slice', () => {
    const { onSolved } = renderGame('s1-p2-lizi', 'outing-book')
    fireEvent.click(screen.getByRole('button', { name: '向右移一格' }))
    fireEvent.click(screen.getByRole('button', { name: '确认纸痕' }))
    expect(onSolved).toHaveBeenCalledTimes(1)
  })

  it('covers private fields while leaving city detail visible', () => {
    const { onSolved } = renderGame('s1-p2-shiqi', 'observation-cards')
    fireEvent.click(screen.getByRole('button', { name: '遮住具体时间' }))
    fireEvent.click(screen.getByRole('button', { name: '遮住活动规律' }))
    fireEvent.click(screen.getByRole('button', { name: '确认保留范围' }))
    expect(onSolved).toHaveBeenCalledTimes(1)
  })

  it('does not submit a wrong move and only asks for help once', () => {
    const { onSolved, onFirstMistake } = renderGame('s1-p1-alang', 'seat-plan')
    fireEvent.click(screen.getByRole('button', { name: '确认距离' }))
    fireEvent.click(screen.getByRole('button', { name: '确认距离' }))
    expect(onSolved).not.toHaveBeenCalled()
    expect(onFirstMistake).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/失败|错误|答错/)).not.toBeInTheDocument()
  })
})

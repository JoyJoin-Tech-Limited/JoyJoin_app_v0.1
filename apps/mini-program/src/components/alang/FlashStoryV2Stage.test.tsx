import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FlashStoryV2Stage } from './FlashStoryV2Stage'

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  ScrollView: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock('./FlashUi', () => ({
  FlashButton: ({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) => (
    <button type='button' onClick={onClick} disabled={disabled}>{children}</button>
  ),
  FlashNpcPortrait: () => <div data-testid='flash-npc-portrait' />,
}))

const npc = { id: 'n1', slug: 'alang', name: '阿浪', animal: '灰狼', themeKey: 'alang' }

describe('FlashStoryV2Stage', () => {
  it('renders prose segments and a continue button for non-choice nodes', () => {
    const onContinue = vi.fn()
    const { getByText, getByRole } = render(
      <FlashStoryV2Stage
        npc={npc}
        segments={[{ text: '阿浪把图按原来的折痕收好。' }]}
        choices={[]}
        isChoice={false}
        isTerminal={false}
        isClosure={false}
        echo={0}
        seasonTitle='没有名字的旧物'
        phase={1}
        busy={false}
        onChoice={vi.fn()}
        onContinue={onContinue}
      />,
    )
    expect(getByText('阿浪把图按原来的折痕收好。')).toBeTruthy()
    fireEvent.click(getByRole('button'))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('renders choice options and calls onChoice for choice nodes', () => {
    const onChoice = vi.fn()
    const { getByText } = render(
      <FlashStoryV2Stage
        npc={npc}
        segments={[{ text: '你想问哪一句？' }]}
        choices={[
          { id: 'a', text: '这图画的是两个人吧。' },
          { id: 'b', text: '把纸翻过来' },
        ]}
        isChoice
        isTerminal={false}
        isClosure={false}
        echo={0}
        seasonTitle='没有名字的旧物'
        phase={1}
        busy={false}
        onChoice={onChoice}
        onContinue={vi.fn()}
      />,
    )
    fireEvent.click(getByText('这图画的是两个人吧。'))
    expect(onChoice).toHaveBeenCalledWith('a')
    fireEvent.click(getByText('把纸翻过来'))
    expect(onChoice).toHaveBeenCalledWith('b')
  })

  it('marks dialogue segments with a speaker class and hides continue on ending nodes', () => {
    const { container, queryByRole } = render(
      <FlashStoryV2Stage
        npc={npc}
        segments={[{ speaker: '阿浪', text: '“想过。每天。”' }]}
        choices={[]}
        isChoice={false}
        isTerminal
        isClosure={false}
        echo={60}
        seasonTitle='没有名字的旧物'
        phase={3}
        busy={false}
        onChoice={vi.fn()}
        onContinue={vi.fn()}
      />,
    )
    expect(container.querySelector('.flash-story-v2__segment--dialogue')).toBeTruthy()
    expect(queryByRole('button')).toBeNull()
  })

  it('shows a continue button on closure nodes so the user can finish the unit', () => {
    const onContinue = vi.fn()
    const { getByRole } = render(
      <FlashStoryV2Stage
        npc={npc}
        segments={[{ text: '他把图按原来的折痕收好，准备放回交换箱。' }]}
        choices={[]}
        isChoice={false}
        isTerminal={false}
        isClosure={false}
        echo={0}
        seasonTitle='没有名字的旧物'
        phase={1}
        busy={false}
        onChoice={vi.fn()}
        onContinue={onContinue}
      />,
    )
    const button = getByRole('button')
    expect(button).toBeTruthy()
    fireEvent.click(button)
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('disables interactions while busy', () => {
    const onChoice = vi.fn()
    const { getByText } = render(
      <FlashStoryV2Stage
        npc={npc}
        segments={[{ text: '你想问哪一句？' }]}
        choices={[{ id: 'a', text: '这图画的是两个人吧。' }]}
        isChoice
        isTerminal={false}
        isClosure={false}
        echo={0}
        seasonTitle='没有名字的旧物'
        phase={1}
        busy
        onChoice={onChoice}
        onContinue={vi.fn()}
      />,
    )
    fireEvent.click(getByText('这图画的是两个人吧。'))
    expect(onChoice).not.toHaveBeenCalled()
  })
})

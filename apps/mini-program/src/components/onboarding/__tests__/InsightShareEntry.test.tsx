import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InsightShareEntry from '../InsightShareEntry'

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}))

const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u
const INCENTIVE_WORDS = ['奖励', '权益', '优惠', '券', '免费', '福利', '返现', '红包']

const hasHoverClass = (el: Element) => el.hasAttribute('hoverClass') || el.hasAttribute('hoverclass')

describe('InsightShareEntry — AC-01 rendering + AC-05 reduced-motion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when not visible (fail-closed)', () => {
    const { container } = render(
      <InsightShareEntry visible={false} isGenerating={false} onPress={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the quiet 存下这张卡 entry with hover feedback', () => {
    const onPress = vi.fn()
    render(<InsightShareEntry visible isGenerating={false} onPress={onPress} />)

    const label = screen.getByText('存下这张卡')
    expect(label).toBeTruthy()

    const button = screen.getByRole('button', { name: '存下这张卡' })
    expect(hasHoverClass(button)).toBe(true)

    fireEvent.click(button)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('shows the busy state and swallows taps while generating', () => {
    const onPress = vi.fn()
    render(<InsightShareEntry visible isGenerating onPress={onPress} />)

    expect(screen.getByText('正在生成…')).toBeTruthy()
    const button = screen.getByRole('button', { name: '正在生成卡片' })
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(hasHoverClass(button)).toBe(false)

    fireEvent.click(button)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('carries the reduced-motion modifier for a static busy indicator', () => {
    const { container } = render(
      <InsightShareEntry visible isGenerating reduceMotion onPress={() => {}} />,
    )
    expect(container.querySelector('.insight-share-entry--reduced-motion')).not.toBeNull()
  })

  it('keeps the entry copy free of emoji and incentive wording', () => {
    const { container } = render(
      <InsightShareEntry visible isGenerating onPress={() => {}} />,
    )
    const text = container.textContent ?? ''
    expect(EMOJI_PATTERN.test(text)).toBe(false)
    for (const word of INCENTIVE_WORDS) {
      expect(text).not.toContain(word)
    }
  })
})

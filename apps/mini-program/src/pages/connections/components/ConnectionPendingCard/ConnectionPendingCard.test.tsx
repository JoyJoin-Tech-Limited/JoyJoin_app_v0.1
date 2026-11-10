import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ConnectionPendingCard, {
  buildConnectionPendingCountLabel,
  formatConnectionRevealLabel,
} from './index'

// G0 prototype contract (2026-11-10): the 24h mutual-selection pending card is
// count + reveal moment ONLY — never names, never selected targets, no fake
// countdown, no emoji. It also must not occupy space when there is nothing to
// reveal (count <= 0 renders nothing).

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

describe('ConnectionPendingCard', () => {
  it('renders the count and the pre-formatted reveal moment', () => {
    const { container } = render(<ConnectionPendingCard count={3} revealAtLabel='明晚 21:00 揭晓' />)

    expect(screen.getByText('有 3 个选择等待揭晓')).toBeTruthy()
    expect(screen.getByText('明晚 21:00 揭晓')).toBeTruthy()
    expect(container.querySelector('.connection-pending-card')).toBeTruthy()
    expect(container.querySelector('.connection-pending-card__count')).toBeTruthy()
    expect(container.querySelector('.connection-pending-card__reveal')).toBeTruthy()
  })

  it('runs the count through the shared copy template', () => {
    expect(buildConnectionPendingCountLabel(1)).toBe('有 1 个选择等待揭晓')
    expect(buildConnectionPendingCountLabel(12)).toBe('有 12 个选择等待揭晓')
  })

  it('formats the server reveal instant in Asia/Shanghai without device timezone', () => {
    expect(formatConnectionRevealLabel('2026-11-11T13:00:00.000Z')).toBe('11月11日 21:00 揭晓')
    expect(formatConnectionRevealLabel(null)).toBe('')
    expect(formatConnectionRevealLabel('not-a-date')).toBe('')
  })

  it('renders nothing for zero, negative, or non-finite counts (no empty card)', () => {
    const { container: zero } = render(<ConnectionPendingCard count={0} revealAtLabel='明晚 21:00 揭晓' />)
    expect(zero.querySelector('.connection-pending-card')).toBeNull()

    const { container: negative } = render(<ConnectionPendingCard count={-2} />)
    expect(negative.querySelector('.connection-pending-card')).toBeNull()

    const { container: broken } = render(<ConnectionPendingCard count={Number.NaN} />)
    expect(broken.querySelector('.connection-pending-card')).toBeNull()
  })

  it('stays a static surface unless a tap handler is supplied', () => {
    const onTap = vi.fn()
    const { container: staticView } = render(<ConnectionPendingCard count={2} revealAtLabel='明晚 21:00 揭晓' />)
    const staticCard = staticView.querySelector('.connection-pending-card') as HTMLElement
    expect(staticCard.getAttribute('role')).toBeNull()
    expect(staticCard.className).not.toContain('connection-pending-card--tappable')

    const { container: tappableView } = render(
      <ConnectionPendingCard count={2} revealAtLabel='明晚 21:00 揭晓' onTap={onTap} />,
    )
    const tappableCard = tappableView.querySelector('.connection-pending-card') as HTMLElement
    expect(tappableCard.getAttribute('role')).toBe('button')
    expect(tappableCard.getAttribute('aria-label')).toBe('有 2 个选择等待揭晓，明晚 21:00 揭晓')
    fireEvent.click(tappableCard)
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('keeps the reveal line even when the moment is unknown (reserved line box)', () => {
    const { container } = render(<ConnectionPendingCard count={4} />)
    expect(screen.getByText('有 4 个选择等待揭晓')).toBeTruthy()
    expect(container.querySelector('.connection-pending-card__reveal')?.textContent).toBe('')
  })
})

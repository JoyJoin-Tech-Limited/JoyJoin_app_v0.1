import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ProfessionOverlayStatusHints from './ProfessionOverlayStatusHints'

vi.mock('@tarojs/components', () => ({
  View: ({
    children,
    hoverClass: _hoverClass,
    hoverStartTime: _hoverStartTime,
    hoverStayTime: _hoverStayTime,
    ...props
  }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

vi.mock('../../lib/utils/haptics', () => ({ haptics: vi.fn() }))

const BASE_PROPS = {
  isOnline: true,
  showShortHint: false,
  isSubmitting: false,
  retryMessageId: null as string | null,
  showRevealCard: false,
  onRetry: vi.fn(),
}

describe('ProfessionOverlayStatusHints · R6 dead-end banner', () => {
  it('swaps to the skip copy and executes skip on tap when skippable', () => {
    const onMaxSendSkip = vi.fn()
    render(
      <ProfessionOverlayStatusHints
        {...BASE_PROPS}
        showMaxSendHint
        maxSendSkippable
        onMaxSendSkip={onMaxSendSkip}
      />,
    )

    const banner = screen.getByLabelText('跳过职业输入')
    expect(banner.className).toContain('profession-overlay__max-send-hint--action')
    expect(banner.textContent).toContain('悦仔暂时没读懂这题～先跳过，之后随时能在个人主页补充')

    fireEvent.click(banner)
    expect(onMaxSendSkip).toHaveBeenCalledTimes(1)
  })

  it('keeps the neutral non-tappable copy when a usable classification exists', () => {
    render(<ProfessionOverlayStatusHints {...BASE_PROPS} showMaxSendHint />)

    expect(screen.getByText('已达到最大重试次数，先继续吧～')).toBeTruthy()
    expect(screen.queryByText(/悦仔暂时没读懂这题/)).toBeNull()
    // no skip affordance rendered
    expect(screen.queryByLabelText('跳过职业输入')).toBeNull()
  })

  it('stays non-tappable when skippable but no handler is wired', () => {
    render(
      <ProfessionOverlayStatusHints {...BASE_PROPS} showMaxSendHint maxSendSkippable />,
    )
    expect(screen.getByText('已达到最大重试次数，先继续吧～')).toBeTruthy()
  })
})

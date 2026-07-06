import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TestModeDisclosure from '../TestModeDisclosure'

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
}))

vi.mock('../../../hooks/useDeviceTier', () => ({
  useDeviceTier: vi.fn(() => ({ isDegradation: false })),
}))

vi.mock('../../../lib/utils/accessibility', () => ({
  getSystemReducedMotion: vi.fn(() => false),
}))

vi.mock('../../../lib/analytics/socialIcebreakerAnalytics', () => ({
  socialIcebreakerAnalytics: { track: vi.fn() },
}))

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Button: (props: Record<string, unknown>) => <button {...props} />,
}))

describe('TestModeDisclosure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the test-mode title and explanation', () => {
    render(<TestModeDisclosure onContinue={() => {}} />)

    expect(screen.getByText('测试模式：多人环节已跳过')).toBeInTheDocument()
    expect(
      screen.getByText(/在单人调试局中，只有热身话题卡可以预览/),
    ).toBeInTheDocument()
  })

  it('renders the bot roster when bots are provided', () => {
    render(
      <TestModeDisclosure
        onContinue={() => {}}
        bots={[
          { botId: 'bot-1', displayName: 'Bot One', archetype: '社牛柯基' },
          { botId: 'bot-2', displayName: 'Bot Two', archetype: '小太阳鸡' },
        ]}
      />,
    )

    expect(screen.getByText('本场调试伙伴')).toBeInTheDocument()
    expect(screen.getByText('Bot One')).toBeInTheDocument()
    expect(screen.getByText('Bot Two')).toBeInTheDocument()
    expect(screen.getByText('社牛柯基')).toBeInTheDocument()
    expect(screen.getByText('小太阳鸡')).toBeInTheDocument()
  })

  it('does not render the roster section when bots are empty', () => {
    render(<TestModeDisclosure onContinue={() => {}} bots={[]} />)

    expect(screen.queryByText('本场调试伙伴')).not.toBeInTheDocument()
  })

  it('fires onContinue when the primary CTA is tapped', () => {
    const onContinue = vi.fn()
    render(<TestModeDisclosure onContinue={onContinue} />)

    fireEvent.click(screen.getByText('查看总结'))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('shows loading state when isLoading is true', () => {
    render(<TestModeDisclosure onContinue={() => {}} isLoading />)

    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('exposes dialog accessibility attributes', () => {
    render(<TestModeDisclosure onContinue={() => {}} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', '测试模式说明')
  })
})

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
  Image: ({ lazyLoad: _lazyLoad, ...rest }: Record<string, unknown>) => <img {...rest} />,
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

  it('fires onDismiss when the close button is tapped', () => {
    const onDismiss = vi.fn()
    render(<TestModeDisclosure onContinue={() => {}} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByLabelText('关闭测试模式说明'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders the JoyJoin-native test-mode badge', () => {
    render(<TestModeDisclosure onContinue={() => {}} />)

    expect(screen.getByText('测试模式')).toBeInTheDocument()
  })

  it('renders bot-simulation copy and CTA when runBots is true', () => {
    const onContinue = vi.fn()
    render(
      <TestModeDisclosure
        onContinue={onContinue}
        runBots
        bots={[
          { botId: 'bot-1', displayName: 'Bot One', archetype: '社牛柯基' },
        ]}
      />,
    )

    expect(screen.getByText('测试模式：虚拟伙伴一起玩')).toBeInTheDocument()
    expect(
      screen.getByText(/虚拟伙伴会陪你完整体验多人游戏环节/),
    ).toBeInTheDocument()
    expect(screen.getByText('开始多人环节')).toBeInTheDocument()
  })

  it('shows loading state when isLoading is true', () => {
    render(<TestModeDisclosure onContinue={() => {}} isLoading />)

    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('renders a mascot image for brand warmth', () => {
    render(<TestModeDisclosure onContinue={() => {}} />)

    const mascot = screen.getByRole('img', { name: '小悦' })
    expect(mascot).toBeInTheDocument()
    const img = mascot.querySelector('img')
    expect(img).toHaveAttribute('src', expect.stringContaining('xiaoyue-coach-guide'))
  })

  it('renders an inline error message and retry CTA when error is provided', () => {
    render(
      <TestModeDisclosure
        onContinue={() => {}}
        error='网络开小差了'
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('网络开小差了')
    expect(screen.getByText('重试')).toBeInTheDocument()
  })

  it('fires onRetry when error is shown and CTA is tapped', () => {
    const onRetry = vi.fn()
    const onContinue = vi.fn()
    render(
      <TestModeDisclosure
        onContinue={onContinue}
        onRetry={onRetry}
        error='继续失败'
      />,
    )

    fireEvent.click(screen.getByText('重试'))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onContinue).not.toHaveBeenCalled()
  })

  it('falls back to onContinue for retry when onRetry is omitted', () => {
    const onContinue = vi.fn()
    render(
      <TestModeDisclosure
        onContinue={onContinue}
        error='继续失败'
      />,
    )

    fireEvent.click(screen.getByText('重试'))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })
})

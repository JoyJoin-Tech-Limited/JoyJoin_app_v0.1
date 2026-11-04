import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import Taro from '@tarojs/taro'
import { PoolRegistrationAlreadyJoined } from '../PoolRegistrationTerminalStates'
import { haptics } from '../../../../lib/utils/haptics'
import { discoverAnalytics } from '../../../../lib/analytics/discoverAnalytics'

vi.mock('@tarojs/taro', () => ({
  default: { switchTab: vi.fn() },
}))

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Image: (props: Record<string, unknown>) => <img {...props} />,
  ScrollView: (props: Record<string, unknown>) => <div {...props} />,
}))

vi.mock('../../../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
}))

vi.mock('../../../../lib/analytics/discoverAnalytics', () => ({
  discoverAnalytics: { track: vi.fn() },
}))

vi.mock('../../../../lib/mascot/xiaoyueExpressions', () => ({
  getXiaoyueExpressionAsset: () => '/mascot.webp',
}))

vi.mock('../../../../components/ui/Button', () => ({
  default: ({ children, className, onClick }: {
    children: React.ReactNode
    className?: string
    onClick: () => void
  }) => <button className={className} onClick={onClick}>{children}</button>,
}))

// Keep this component test focused on the terminal's data/CTA contract. The real
// EventSummaryCard rendering and geometry are covered by the screenshot gate.
vi.mock('../../../../components/events/EventSummaryCard', () => ({
  default: ({ title, district, status }: {
    title?: string
    district: string
    status: string
  }) => (
    <div
      data-testid='event-summary-card'
      data-title={title}
      data-district={district}
      data-status={status}
    >
      {title}
    </div>
  ),
}))

describe('PoolRegistrationAlreadyJoined', () => {
  const baseProps = {
    poolId: 'pool-1',
    poolTitle: '周末松弛感饭局 · 南山',
    eventType: '饭局' as const,
    poolArea: '南山',
    poolDateTime: '2026-11-07T18:30:00+08:00',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('strips only the exact duplicated area suffix and keeps the terminal contract', () => {
    const { container } = render(<PoolRegistrationAlreadyJoined {...baseProps} />)

    expect(screen.getByText('这一局，有你的位置了')).toBeInTheDocument()
    expect(screen.getByTestId('event-summary-card')).toHaveAttribute('data-title', '周末松弛感饭局')
    expect(screen.getByTestId('event-summary-card')).toHaveAttribute('data-district', '南山')
    expect(screen.getByTestId('event-summary-card')).toHaveAttribute('data-status', 'registered')
    expect(screen.queryByText(/你的预算和期待已经收到/)).not.toBeInTheDocument()
    expect(container.querySelector('.pool-reg__already-text')).toBeNull()
    expect(container.querySelector('.pool-reg__already-mascot')).toHaveAttribute('mode', 'scaleToFill')
  })

  it.each([
    { poolTitle: '周末松弛感饭局 · 南山 加场', poolArea: '南山' },
    { poolTitle: '周末松弛感饭局', poolArea: '' },
  ])('preserves a title without an exact duplicated suffix: $poolTitle', ({ poolTitle, poolArea }) => {
    render(<PoolRegistrationAlreadyJoined {...baseProps} poolTitle={poolTitle} poolArea={poolArea} />)

    expect(screen.getByTestId('event-summary-card')).toHaveAttribute('data-title', poolTitle)
  })

  it('keeps the full duo partner name in the semantic node used for visual ellipsis', () => {
    const duoPartnerName = '小鹿小鹿小鹿小鹿小鹿'
    const { container } = render(
      <PoolRegistrationAlreadyJoined {...baseProps} duoPartnerName={duoPartnerName} />,
    )

    expect(container.querySelector('.pool-reg__already-partner')).toHaveTextContent(duoPartnerName)
    expect(container.querySelector('.pool-reg__already-text')).toHaveTextContent(
      `你和 ${duoPartnerName} 的双人成行已生效`,
    )
  })

  it('tracks and navigates to the events tab through the sole primary CTA', () => {
    render(<PoolRegistrationAlreadyJoined {...baseProps} />)

    fireEvent.click(screen.getByRole('button', { name: '查看我的局' }))

    expect(haptics).toHaveBeenCalledWith('medium')
    expect(discoverAnalytics.track).toHaveBeenCalledWith('registration_terminal_cta_tap', 'pool-1', {
      variant: 'already-joined',
      target: 'footprint',
    })
    expect(Taro.switchTab).toHaveBeenCalledWith({ url: '/pages/events/index' })
  })
})

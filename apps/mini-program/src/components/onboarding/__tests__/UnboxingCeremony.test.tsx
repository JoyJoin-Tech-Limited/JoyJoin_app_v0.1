import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UnboxingCeremony from '../UnboxingCeremony'

vi.mock('../../../lib/utils/accessibility', () => ({
  getSystemReducedMotion: () => true,
}))

vi.mock('../../../hooks/useDeviceTier', () => ({
  useDeviceTier: () => ({ isDegradation: false }),
}))

vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))

vi.mock('../../../lib/mascot/blindBoxAssets', () => ({
  BLIND_BOX_BODY_ASSET: '/assets/blind-box/body.webp',
  BLIND_BOX_INTERIOR_ASSET: '/assets/blind-box/interior.webp',
  BLIND_BOX_LID_ASSET: '/assets/blind-box/lid.webp',
  BLIND_BOX_ALT: { body: '盒身', lid: '盒盖' },
}))

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Image: (props: Record<string, unknown>) => <img {...props} alt='' />,
}))

describe('UnboxingCeremony gift row (拆盒即得礼)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the welcome coupon inside the rising entry card', () => {
    render(
      <UnboxingCeremony
        visible
        displayName='小悦'
        archetypeName='社牛柯基'
        giftDiscountValue={50}
        onComplete={() => {}}
      />,
    )

    expect(screen.getByText('拆盒即得礼')).toBeInTheDocument()
    expect(screen.getByText('5折')).toBeInTheDocument()
    expect(screen.getByText(/报名可用/)).toBeInTheDocument()
  })

  it('shows a quiet shimmer while the coupon claim is in flight', () => {
    const { container } = render(
      <UnboxingCeremony
        visible
        displayName='小悦'
        giftLoading
        onComplete={() => {}}
      />,
    )

    expect(screen.queryByText('拆盒即得礼')).not.toBeInTheDocument()
    expect(container.querySelector('.unboxing-ceremony__gift--loading')).not.toBeNull()
    expect(container.querySelector('.unboxing-ceremony__gift-shimmer')).not.toBeNull()
  })

  it('renders the card without any gift row when the claim failed', () => {
    const { container } = render(
      <UnboxingCeremony
        visible
        displayName='小悦'
        giftDiscountValue={null}
        giftLoading={false}
        onComplete={() => {}}
      />,
    )

    expect(screen.queryByText('拆盒即得礼')).not.toBeInTheDocument()
    expect(container.querySelector('.unboxing-ceremony__gift')).toBeNull()
    // The entry card itself still renders.
    expect(screen.getByText('小悦 · 入场卡已生效')).toBeInTheDocument()
  })

  it('still completes on tap when no coupon is present', () => {
    const onComplete = vi.fn()
    render(
      <UnboxingCeremony
        visible
        displayName='小悦'
        giftDiscountValue={null}
        onComplete={onComplete}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '开盒完成，轻触继续' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('renders nothing at all when not visible', () => {
    const { container } = render(
      <UnboxingCeremony
        visible={false}
        displayName='小悦'
        giftDiscountValue={50}
        onComplete={() => {}}
      />,
    )

    expect(container.querySelector('.unboxing-ceremony')).toBeNull()
  })
})

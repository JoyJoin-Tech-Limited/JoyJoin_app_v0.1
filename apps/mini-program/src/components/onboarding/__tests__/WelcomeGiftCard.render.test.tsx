import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WelcomeGiftCard from '../WelcomeGiftCard'

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Image: (props: Record<string, unknown>) => <img {...props} />,
}))

vi.mock('../../../lib/utils/cdnAssets', () => ({
  useCdnFirstSrc: (path: string) => ({ src: path, onError: vi.fn() }),
}))

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
}))

describe('WelcomeGiftCard expiry caption (audit F5)', () => {
  it('renders 有效期至 M月D日 when validUntil is present', () => {
    render(<WelcomeGiftCard discountValue={50} validUntil='2026-12-25T15:59:59.000Z' />)

    const d = new Date('2026-12-25T15:59:59.000Z')
    expect(
      screen.getByText(`有效期至 ${d.getMonth() + 1}月${d.getDate()}日`),
    ).toBeInTheDocument()
  })

  it('renders nothing when validUntil is absent (fail-closed)', () => {
    const { container } = render(<WelcomeGiftCard discountValue={50} />)

    expect(screen.queryByText(/有效期至/)).not.toBeInTheDocument()
    expect(container.querySelector('.welcome-gift-card__expiry')).toBeNull()
  })

  it('renders nothing when validUntil is null or unparseable', () => {
    const { rerender, container } = render(
      <WelcomeGiftCard discountValue={50} validUntil={null} />,
    )
    expect(screen.queryByText(/有效期至/)).not.toBeInTheDocument()

    rerender(<WelcomeGiftCard discountValue={50} validUntil='not-a-date' />)
    expect(screen.queryByText(/有效期至/)).not.toBeInTheDocument()
    expect(container.querySelector('.welcome-gift-card__expiry')).toBeNull()
  })

  it('keeps the expiry caption out of the loading skeleton', () => {
    render(<WelcomeGiftCard isLoading validUntil='2026-12-25T15:59:59.000Z' />)
    expect(screen.queryByText(/有效期至/)).not.toBeInTheDocument()
  })
})

describe('WelcomeGiftCard fixed-amount 见面礼 (WELCOME20)', () => {
  it('renders the canonical fixed ¥20 coupon as 20元', () => {
    render(<WelcomeGiftCard discountValue={2000} discountType='fixed_amount' />)

    expect(screen.getByRole('button', { name: /20元/ })).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('元')).toBeInTheDocument()
  })

  it('keeps the legacy 折 rendering when discountType is absent', () => {
    render(<WelcomeGiftCard discountValue={50} />)

    expect(screen.getByRole('button', { name: /5折/ })).toBeInTheDocument()
  })
})

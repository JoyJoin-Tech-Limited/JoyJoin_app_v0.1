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

describe('WelcomeGiftCard compact grant status', () => {
  it('is read-only and leads with the coupon face value', () => {
    const { container } = render(
      <WelcomeGiftCard
        compact
        discountValue={2000}
        discountType='fixed_amount'
        validUntil='2026-12-25T15:59:59.000Z'
      />,
    )

    // Still a status row — no tap target, no button, no fake urgency.
    expect(screen.getByRole('status', { name: /见面礼已放入权益，20元/ })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()

    // 20元 is its own prominent line, no longer buried inside the caption.
    const amount = container.querySelector('.welcome-gift-card__compact-amount')
    expect(amount).not.toBeNull()
    expect(amount?.textContent).toBe('20')
    expect(container.querySelector('.welcome-gift-card__compact-amount-unit')?.textContent).toBe('元')

    // The title steps back beside the amount instead of above it.
    expect(container.querySelector('.welcome-gift-card__compact-title')?.textContent).toBe(
      '见面礼已放入权益',
    )

    // Availability + expiry move to the secondary line, which no longer repeats the award.
    const body = container.querySelector('.welcome-gift-card__compact-body')
    expect(body?.textContent).toContain('首场报名可用')
    expect(body?.textContent).toMatch(/有效期至/)
    expect(body?.textContent).not.toContain('20元')

    // One quiet physical-reward cue closes the row.
    expect(container.querySelector('.welcome-gift-card__compact-stamp')?.textContent).toBe('已入账')

    // The old status-row shape (amount + terms as one caption) is gone.
    expect(screen.queryByText(/20元 · 首场报名可用/)).not.toBeInTheDocument()
  })

  it('keeps compact loading honest without claiming a grant', () => {
    render(<WelcomeGiftCard compact isLoading />)

    expect(screen.getByRole('status', { name: '悦仔见面礼确认中' })).toBeInTheDocument()
    expect(screen.queryByText('见面礼已放入权益')).not.toBeInTheDocument()
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

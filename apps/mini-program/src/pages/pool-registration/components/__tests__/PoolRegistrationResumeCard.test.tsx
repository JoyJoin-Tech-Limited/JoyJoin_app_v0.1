import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PoolRegistrationResumeCard from '../PoolRegistrationResumeCard'
import { buildPoolRegistrationPaymentReturnContext } from '../../../../lib/payment/paymentPendingOrder'
import { BUDGET_TIERS } from '@shared/budgetTiers'

// Fixture tier derived from the canonical registry so the test cannot drift
// from tier ids/labels (check-budget-tiers ratchet).
function resolveDiningMidTier() {
  const tier = BUDGET_TIERS.find(
    (t) => t.eventType === '饭局' && t.min === 150 && t.max === 200,
  )
  if (!tier) throw new Error('registry must contain the mid dining tier')
  return tier
}
// Narrowed inside a helper so hoisted function bodies referencing it type-check.
const DINING_MID_TIER = resolveDiningMidTier()
const BUDGET_COPY = `${DINING_MID_TIER.label}/人`

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
}))

vi.mock('../../../components/ui/Card', () => ({
  default: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <section className={className}>{children}</section>
  ),
}))

function createContext(paymentStatus: 'paid' | 'payment-required') {
  return buildPoolRegistrationPaymentReturnContext({
    userId: 'user-1',
    poolId: 'pool-1',
    poolTitle: '周末晚餐局',
    poolEventType: '饭局',
    draft: { budgetRange: [DINING_MID_TIER.id], eventIntent: ['friends'] },
    resumeStep: 2,
    paymentStatus,
  })
}

describe('PoolRegistrationResumeCard — truthful two-state recovery', () => {
  it('marks paid as server-confirmed and makes the no-repayment next step explicit', () => {
    render(
      <PoolRegistrationResumeCard
        context={createContext('paid')}
        selectedBudget={BUDGET_COPY}
        intentCount={1}
        eventType='饭局'
      />,
    )

    expect(screen.getByText('支付已确认')).toBeInTheDocument()
    expect(screen.getByText('接着完成报名，不会重复扣款')).toBeInTheDocument()
    expect(screen.getByText(/继续只完成报名/)).toBeInTheDocument()
    expect(screen.getByText(BUDGET_COPY)).toBeInTheDocument()
    expect(screen.getByText('1 个期待')).toBeInTheDocument()
  })

  it('restores a payment-required draft without calling it a failed charge', () => {
    render(
      <PoolRegistrationResumeCard
        context={createContext('payment-required')}
        selectedBudget={BUDGET_COPY}
        intentCount={1}
        eventType='饭局'
      />,
    )

    expect(screen.getByText('支付待完成')).toBeInTheDocument()
    expect(screen.getByText('报名选择已替你保留')).toBeInTheDocument()
    expect(screen.getByText(/还未确认支付/)).toBeInTheDocument()
    expect(screen.queryByText(/扣款失败|支付失败/)).not.toBeInTheDocument()
    expect(screen.queryByText('接着完成报名，不会重复扣款')).not.toBeInTheDocument()
  })

  it('omits unavailable draft pills', () => {
    const { container } = render(
      <PoolRegistrationResumeCard
        context={createContext('payment-required')}
        selectedBudget=''
        intentCount={0}
        eventType='饭局'
      />,
    )

    expect(container.querySelectorAll('.pool-reg__resume-pill')).toHaveLength(1)
    expect(screen.getByText('饭局')).toBeInTheDocument()
  })
})

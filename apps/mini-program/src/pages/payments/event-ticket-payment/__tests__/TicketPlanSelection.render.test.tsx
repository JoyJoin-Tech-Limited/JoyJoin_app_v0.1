import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TicketPlanSelection, { type VipMonthlyPlanView } from '../components/TicketPlanSelection'
import type { SelectedPlan } from '../ticketHelpers'

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
}))

vi.mock('../../../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
}))

const trackMock = vi.fn()
vi.mock('../../../../lib/analytics/discoverAnalytics', () => ({
  discoverAnalytics: { track: (...args: unknown[]) => trackMock(...args) },
}))

const VIP_MONTHLY_PLAN: VipMonthlyPlanView = {
  displayName: '悦聚月卡',
  description: '每月 6 场局，说走就走',
  priceInCents: 9800,
  anchorLabel: '每次约 ¥16',
}

interface RenderOptions {
  selectedPlan?: SelectedPlan
  vipMonthlyPlan?: VipMonthlyPlanView | null
  showWelcomeCouponHint?: boolean
  onSelectPlan?: (plan: SelectedPlan) => void
}

function renderSelection({
  selectedPlan = 'single',
  vipMonthlyPlan = null,
  showWelcomeCouponHint = false,
  onSelectPlan = vi.fn(),
}: RenderOptions = {}) {
  const currentPrice =
    selectedPlan === 'vip_monthly'
      ? (vipMonthlyPlan?.priceInCents ?? 8800)
      : selectedPlan === 'pack_3'
        ? 21100
        : selectedPlan === 'pack_6'
          ? 37000
          : 8800
  return render(
    <TicketPlanSelection
      selectedPlan={selectedPlan}
      onSelectPlan={onSelectPlan}
      singlePrice={8800}
      pack3Price={21100}
      pack6Price={37000}
      currentPrice={currentPrice}
      discountAmount={0}
      finalPrice={currentPrice}
      bestCoupon={null}
      poolId='pool-1'
      showWelcomeCouponHint={showWelcomeCouponHint}
      vipMonthlyPlan={vipMonthlyPlan}
    />,
  )
}

describe('TicketPlanSelection — legacy layout (D2 flag off / offer absent)', () => {
  it('renders exactly the three legacy plans in canonical order', () => {
    const { container } = renderSelection()

    expect(container.querySelectorAll('.ticket-plan-card')).toHaveLength(3)
    expect(screen.queryByText('悦聚月卡')).not.toBeInTheDocument()

    const text = container.textContent ?? ''
    const singleIdx = text.indexOf('单场局票')
    const pack3Idx = text.indexOf('三连局包')
    const pack6Idx = text.indexOf('六连局包')
    expect(singleIdx).toBeGreaterThanOrEqual(0)
    expect(pack3Idx).toBeGreaterThan(singleIdx)
    expect(pack6Idx).toBeGreaterThan(pack3Idx)

    // Existing badges and per-event anchors stay untouched.
    expect(screen.getByText('先试试看')).toBeInTheDocument()
    expect(screen.getByText('更灵活')).toBeInTheDocument()
    expect(screen.getByText(/3 场局名额.*每次约 ¥70/)).toBeInTheDocument()
  })

  it('defaults to the anchor 单场局票 selection', () => {
    const { container } = renderSelection({ selectedPlan: 'single' })
    const selected = container.querySelectorAll('.ticket-plan-card--selected')
    expect(selected).toHaveLength(1)
    expect(selected[0].textContent).toContain('单场局票')
  })
})

describe('TicketPlanSelection — 悦聚月卡 upsell (D2 flag on + plan present)', () => {
  it('renders four plans with the monthly card FIRST and a 推荐 badge', () => {
    const { container } = renderSelection({ vipMonthlyPlan: VIP_MONTHLY_PLAN })

    expect(container.querySelectorAll('.ticket-plan-card')).toHaveLength(4)
    expect(screen.getByText('悦聚月卡')).toBeInTheDocument()
    expect(screen.getByText('推荐')).toBeInTheDocument()
    expect(screen.getByText('¥98')).toBeInTheDocument()

    const text = container.textContent ?? ''
    expect(text.indexOf('悦聚月卡')).toBeLessThan(text.indexOf('单场局票'))
  })

  it('renders the derived per-event anchor line alongside the server copy', () => {
    renderSelection({ vipMonthlyPlan: VIP_MONTHLY_PLAN })
    expect(screen.getByText(/每月 6 场局，说走就走 · 每次约 ¥16/)).toBeInTheDocument()
  })

  it('omits the anchor when quota is not derivable (derived or omitted, never hardcoded)', () => {
    const { container } = renderSelection({
      vipMonthlyPlan: { ...VIP_MONTHLY_PLAN, description: null, anchorLabel: null },
    })
    // The monthly card renders title + price only — no desc line at all.
    // (Pack cards legitimately carry their own 每次约 anchors, so scope the
    // assertion to the first card rather than the whole tree.)
    const monthlyCard = container.querySelector('.ticket-plan-card')
    expect(monthlyCard?.textContent).toContain('悦聚月卡')
    expect(monthlyCard?.querySelector('.ticket-plan-card__desc')).toBeNull()
  })

  it('selects vip_monthly on tap and reports plan_switch with metadata', () => {
    const onSelectPlan = vi.fn()
    renderSelection({ vipMonthlyPlan: VIP_MONTHLY_PLAN, onSelectPlan })

    fireEvent.click(screen.getByText('悦聚月卡'))
    expect(onSelectPlan).toHaveBeenCalledWith('vip_monthly')
    expect(trackMock).toHaveBeenCalledWith(
      'plan_switch',
      undefined,
      expect.objectContaining({ fromPlan: 'single', toPlan: 'vip_monthly', poolId: 'pool-1' }),
    )
  })
})

describe('TicketPlanSelection — 见面礼 hint truthfulness (D2 item g)', () => {
  it('keeps the canonical 连局包与悦聚卡 hint when the welcome coupon cannot auto-apply', () => {
    renderSelection({ vipMonthlyPlan: VIP_MONTHLY_PLAN, showWelcomeCouponHint: true })
    expect(screen.getByText('见面礼可用于连局包与悦聚卡')).toBeInTheDocument()
  })

  it('renders no hint when the coupon is eligible for the selected plan', () => {
    renderSelection({ vipMonthlyPlan: VIP_MONTHLY_PLAN, showWelcomeCouponHint: false })
    expect(screen.queryByText(/见面礼可用于/)).not.toBeInTheDocument()
  })
})

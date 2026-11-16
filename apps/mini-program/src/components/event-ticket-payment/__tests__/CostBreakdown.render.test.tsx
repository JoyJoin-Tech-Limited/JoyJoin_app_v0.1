import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  COST_INCLUDED_IN_PLAN,
  COST_ONSITE_MENU_NOTE,
  COST_ROW_ONSITE_HINT,
  COST_ROW_ONSITE_HINT_DINING,
  COST_TOTAL_SUFFIX_PLAN,
  formatOnSiteBudget,
  formatTonightTotal,
} from '@shared/copy/eventCostCopy'
import { getTiersForEventType, type BudgetEventType } from '@shared/budgetTiers'
import CostBreakdown, { type CostBreakdownProps } from '../CostBreakdown'

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
}))

const tierIdAt = (eventType: BudgetEventType, order: number): string => {
  const tier = getTiersForEventType(eventType).find((candidate) => candidate.order === order)
  if (!tier) throw new Error(`Missing canonical ${eventType} tier at order ${order}`)
  return tier.id
}

const DRINKS_RANGE = [tierIdAt('酒局', 1)]
const DRINKS_BELOW = [tierIdAt('酒局', 0)]
const DINING_MULTI_RANGE = [tierIdAt('饭局', 1), tierIdAt('饭局', 2)]
const DRINKS_RANGE_TEXT = `¥${80}–${150}`
const DRINKS_TOTAL_TEXT = `¥${168}–${238}`
const WELCOME_TOTAL_TEXT = `¥${148}–${218}`
const DRINKS_BELOW_TEXT = `¥${80} 以内`
const DRINKS_BELOW_TOTAL_TEXT = `¥${168} 以内`
const DINING_MULTI_TEXT = `¥${150}–${300}`
const DINING_TOTAL_TEXT = `¥${238}–${388}`

function renderCost(options: Partial<CostBreakdownProps> = {}) {
  const tierIds = options.onSiteBudgetLabel === null ? [] : DRINKS_RANGE
  const paidCents = options.paidCents ?? 8800
  return render(
    <CostBreakdown
      paidCents={paidCents}
      onSiteBudgetLabel={formatOnSiteBudget(tierIds)}
      tonightTotalLabel={formatTonightTotal(paidCents, tierIds)}
      onSiteHint={COST_ROW_ONSITE_HINT}
      {...options}
    />,
  )
}

describe('CostBreakdown — approved eight-state matrix', () => {
  it('1. standard single shows paid ticket, selected budget and inclusive total', () => {
    const { container } = renderCost()

    expect(screen.getByText('今晚的费用')).toBeInTheDocument()
    expect(screen.getByText('报名费')).toBeInTheDocument()
    expect(screen.getByText('¥88')).toBeInTheDocument()
    expect(screen.getByText(DRINKS_RANGE_TEXT)).toBeInTheDocument()
    expect(screen.getByText(DRINKS_TOTAL_TEXT)).toBeInTheDocument()
    expect(screen.getByText('报名费已在内')).toBeInTheDocument()
    expect(container.querySelectorAll('.cost-breakdown__divider')).toHaveLength(1)
  })

  it('2. WELCOME20 uses the discounted paid amount without another struck price', () => {
    renderCost({ paidCents: 6800 })

    expect(screen.getByText('¥68')).toBeInTheDocument()
    expect(screen.getByText(WELCOME_TOTAL_TEXT)).toBeInTheDocument()
    expect(screen.queryByText('¥88')).not.toBeInTheDocument()
    expect(document.querySelectorAll('[style*="line-through"]')).toHaveLength(0)
  })

  it('3. positive multi-event purchase never turns the package price into tonight total', () => {
    const { container } = renderCost({
      paidCents: 21100,
      isMultiEventPurchase: true,
      purchaseHint: '三连局包 · 3 场局名额',
      tonightTotalLabel: null,
    })

    expect(screen.getByText('本次购买')).toBeInTheDocument()
    expect(screen.getByText('¥211')).toBeInTheDocument()
    expect(screen.getByText('三连局包 · 3 场局名额')).toBeInTheDocument()
    expect(screen.getByText(DRINKS_RANGE_TEXT)).toBeInTheDocument()
    expect(screen.queryByText('今晚大约')).not.toBeInTheDocument()
    expect(container.querySelector('.cost-breakdown__total')).toBeNull()
    expect(container.querySelector('.cost-breakdown__divider')).toBeNull()
  })

  it('3b. multi-event purchase omits missing product/session copy instead of filling it', () => {
    const { container } = renderCost({
      paidCents: 37000,
      isMultiEventPurchase: true,
      purchaseHint: null,
      tonightTotalLabel: null,
    })

    expect(screen.getByText('本次购买')).toBeInTheDocument()
    expect(screen.getByText('¥370')).toBeInTheDocument()
    expect(container.querySelector('.cost-breakdown__hint--purchase')).toBeNull()
    expect(screen.queryByText('今晚大约')).not.toBeInTheDocument()
    expect(container.querySelector('.cost-breakdown__divider')).toBeNull()
  })

  it('4. null minimum renders an upper bound, never a zero starting price', () => {
    renderCost({
      onSiteBudgetLabel: formatOnSiteBudget(DRINKS_BELOW),
      tonightTotalLabel: formatTonightTotal(8800, DRINKS_BELOW),
    })

    expect(screen.getByText(DRINKS_BELOW_TEXT)).toBeInTheDocument()
    expect(screen.getByText(DRINKS_BELOW_TOTAL_TEXT)).toBeInTheDocument()
    expect(screen.queryByText(/0 元起/)).not.toBeInTheDocument()
  })

  it('5. dining multi-select aggregates bounds and uses dining hint', () => {
    renderCost({
      onSiteBudgetLabel: formatOnSiteBudget(DINING_MULTI_RANGE),
      tonightTotalLabel: formatTonightTotal(8800, DINING_MULTI_RANGE),
      onSiteHint: COST_ROW_ONSITE_HINT_DINING,
    })

    expect(screen.getByText(DINING_MULTI_TEXT)).toBeInTheDocument()
    expect(screen.getByText(DINING_TOTAL_TEXT)).toBeInTheDocument()
    expect(screen.getByText(COST_ROW_ONSITE_HINT_DINING)).toBeInTheDocument()
    expect(screen.queryByText(COST_ROW_ONSITE_HINT)).not.toBeInTheDocument()
  })

  it('6. entitlement/zero-pay order shows plan inclusion and on-site-only total', () => {
    renderCost({ paidCents: 0 })

    expect(screen.getByText(COST_INCLUDED_IN_PLAN)).toBeInTheDocument()
    expect(screen.queryByText('¥0')).not.toBeInTheDocument()
    expect(screen.getAllByText(DRINKS_RANGE_TEXT)).toHaveLength(2)
    expect(screen.getByText(COST_TOTAL_SUFFIX_PLAN)).toBeInTheDocument()
    expect(screen.queryByText('报名费已在内')).not.toBeInTheDocument()
  })

  it.each([
    { name: 'missing draft', onSiteBudgetLabel: null },
    { name: 'unmappable label', onSiteBudgetLabel: null },
  ])('7/8 shared fallback — $name has no amount, total or divider', ({ onSiteBudgetLabel }) => {
    const { container } = renderCost({
      onSiteBudgetLabel,
      tonightTotalLabel: null,
    })

    expect(screen.getByText('¥88')).toBeInTheDocument()
    expect(screen.getByText('现场 AA')).toBeInTheDocument()
    expect(screen.getByText(COST_ONSITE_MENU_NOTE)).toBeInTheDocument()
    expect(screen.queryByText(/¥80/)).not.toBeInTheDocument()
    expect(screen.queryByText('今晚大约')).not.toBeInTheDocument()
    expect(screen.queryByText('按你选的预算')).not.toBeInTheDocument()
    expect(container.querySelector('.cost-breakdown__budget-attribution')).toBeNull()
    expect(container.querySelector('.cost-breakdown__divider')).toBeNull()
  })
})

describe('CostBreakdown — structure and interaction discipline', () => {
  it('keeps both responsive labels only when a real budget exists', () => {
    const { container } = renderCost()

    expect(container.querySelector('.cost-breakdown__label-full')?.textContent).toBe('到店自付 · 按你选的预算')
    expect(container.querySelector('.cost-breakdown__label-compact')?.textContent).toBe('到店自付')
    expect(container.querySelector('.cost-breakdown__budget-attribution')?.textContent).toBe('按你选的预算')
  })

  it('is a static non-clickable block with at most one conditional hairline', () => {
    const { container } = renderCost()
    const root = container.querySelector('.cost-breakdown')

    expect(root).not.toBeNull()
    expect(root?.getAttribute('role')).not.toBe('button')
    expect(root?.getAttribute('hoverclass')).toBeNull()
    expect(container.querySelectorAll('.cost-breakdown__divider')).toHaveLength(1)
  })
})

import { describe, expect, it } from 'vitest'
import {
  getTiersForEventType,
  UNMAPPABLE_BLIND_BOX_BUDGET_LABEL,
  type BudgetEventType,
} from '../../budgetTiers'
import {
  COST_ACTION_PURCHASE,
  COST_INCLUDED_IN_PLAN,
  COST_ONSITE_MENU_NOTE,
  COST_ROW_PURCHASE,
  COST_ROW_ONSITE_HINT,
  COST_ROW_ONSITE_HINT_DINING,
  COST_TOTAL_SUFFIX_PLAN,
  formatOnSiteBudget,
  formatTonightTotal,
} from '../eventCostCopy'

const tierIdAt = (eventType: BudgetEventType, order: number): string => {
  const tier = getTiersForEventType(eventType).find((candidate) => candidate.order === order)
  if (!tier) throw new Error(`Missing canonical ${eventType} tier at order ${order}`)
  return tier.id
}

const DRINKS_RANGE_ID = tierIdAt('酒局', 1)
const DRINKS_BELOW_ID = tierIdAt('酒局', 0)
const DINING_LOWER_ID = tierIdAt('饭局', 1)
const DINING_UPPER_ID = tierIdAt('饭局', 2)
const rangeLabel = (min: number, max: number) => `¥${min}–${max} / 人`
const upperBoundLabel = (max: number) => `¥${max} 以内 / 人`

describe('eventCostCopy — locked checkout copy', () => {
  it('keeps multi-event purchase and fallback copy centralized', () => {
    expect(COST_ROW_PURCHASE).toBe('本次购买')
    expect(COST_ACTION_PURCHASE).toBe('本次实付')
    expect(COST_INCLUDED_IN_PLAN).toBe('已含在权益里')
    expect(COST_TOTAL_SUFFIX_PLAN).toBe('本场无需再付报名费')
    expect(COST_ONSITE_MENU_NOTE).toBe('具体金额以门店菜单为准')
    expect(COST_ROW_ONSITE_HINT).toBe('现场酒水，同桌 AA，含无酒精特调')
    expect(COST_ROW_ONSITE_HINT_DINING).toBe('现场餐食，同桌 AA')
  })
})

describe('formatOnSiteBudget', () => {
  it.each([
    {
      name: 'standard drinks range',
      tierIds: [DRINKS_RANGE_ID],
      expected: rangeLabel(80, 150),
    },
    {
      name: 'unknown lower bound',
      tierIds: [DRINKS_BELOW_ID],
      expected: upperBoundLabel(80),
    },
    {
      name: 'multi-select takes minimum lower and maximum upper',
      tierIds: [DINING_LOWER_ID, DINING_UPPER_ID],
      expected: rangeLabel(150, 300),
    },
    {
      name: 'duplicates do not change the range',
      tierIds: [DRINKS_RANGE_ID, DRINKS_RANGE_ID],
      expected: rangeLabel(80, 150),
    },
  ])('$name', ({ tierIds, expected }) => {
    expect(formatOnSiteBudget(tierIds)).toBe(expected)
  })

  it.each([
    { name: 'empty', tierIds: [] },
    { name: 'unmappable blind-box label', tierIds: [UNMAPPABLE_BLIND_BOX_BUDGET_LABEL] },
    { name: 'unknown id', tierIds: ['not-a-tier'] },
    { name: 'mixed known and unknown fails closed', tierIds: [DRINKS_RANGE_ID, UNMAPPABLE_BLIND_BOX_BUDGET_LABEL] },
    { name: 'cross-event tiers fail closed', tierIds: [DRINKS_RANGE_ID, DINING_LOWER_ID] },
  ])('$name returns null', ({ tierIds }) => {
    expect(formatOnSiteBudget(tierIds)).toBeNull()
  })
})

describe('formatTonightTotal — integer-cent arithmetic', () => {
  it.each([
    {
      name: '88 + 80 = 168 and 88 + 150 = 238',
      paidCents: 8800,
      tierIds: [DRINKS_RANGE_ID],
      expected: rangeLabel(168, 238),
    },
    {
      name: '68 + 80 = 148 and 68 + 150 = 218',
      paidCents: 6800,
      tierIds: [DRINKS_RANGE_ID],
      expected: rangeLabel(148, 218),
    },
    {
      name: 'unknown lower bound stays an upper bound',
      paidCents: 8800,
      tierIds: [DRINKS_BELOW_ID],
      expected: upperBoundLabel(168),
    },
    {
      name: 'multi-select dining range',
      paidCents: 8800,
      tierIds: [DINING_LOWER_ID, DINING_UPPER_ID],
      expected: rangeLabel(238, 388),
    },
    {
      name: 'zero payable includes only the on-site portion',
      paidCents: 0,
      tierIds: [DRINKS_RANGE_ID],
      expected: rangeLabel(80, 150),
    },
  ])('$name', ({ paidCents, tierIds, expected }) => {
    expect(formatTonightTotal(paidCents, tierIds)).toBe(expected)
  })

  it.each([
    { paidCents: 8800, tierIds: [] },
    { paidCents: 8800, tierIds: [UNMAPPABLE_BLIND_BOX_BUDGET_LABEL] },
    { paidCents: 8800, tierIds: [DRINKS_RANGE_ID, 'unknown'] },
  ])('returns null instead of inventing a total: %j', ({ paidCents, tierIds }) => {
    expect(formatTonightTotal(paidCents, tierIds)).toBeNull()
  })
})

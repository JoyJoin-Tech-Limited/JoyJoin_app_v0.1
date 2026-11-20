import { describe, expect, it } from 'vitest'
import {
  MAX_VISIBLE_TAB_INDICATORS,
  arbitrateTabIndicators,
  type TabIndicatorInputs,
  type TabIndicatorPlan,
} from '../tabIndicatorArbitration'

function plan(overrides: Partial<TabIndicatorInputs>): TabIndicatorPlan {
  return arbitrateTabIndicators({
    chat: 0,
    center: false,
    activities: false,
    profile: false,
    ...overrides,
  })
}

function visibleCount(result: TabIndicatorPlan): number {
  return (result.chat > 0 ? 1 : 0) + Number(result.center) + Number(result.activities) + Number(result.profile)
}

describe('arbitrateTabIndicators', () => {
  it('shows nothing when nothing wants attention', () => {
    expect(plan({})).toEqual({
      discover: 0,
      chat: 0,
      center: false,
      activities: false,
      profile: false,
    })
  })

  it('never badges 发现 even though the bell count exists', () => {
    // The input type has no discover field on purpose; assert the output anyway
    // so a future refactor cannot quietly start lighting it.
    expect(plan({ chat: 1, center: true, activities: true, profile: true }).discover).toBe(0)
  })

  // Directional table: (chat, center, activities, profile) → visible indicators.
  // Locked row by row because "how many light up" is exactly the bug class this
  // module exists to prevent.
  it.each([
    { name: 'chat only', input: { chat: 3 }, expected: { chat: 3, center: false, activities: false, profile: false } },
    { name: 'one dot only', input: { activities: true }, expected: { chat: 0, center: false, activities: true, profile: false } },
    { name: 'two dots, chat silent', input: { center: true, activities: true }, expected: { chat: 0, center: true, activities: true, profile: false } },
    { name: 'three dots, chat silent', input: { center: true, activities: true, profile: true }, expected: { chat: 0, center: true, activities: true, profile: false } },
    { name: 'chat suppresses all but one dot', input: { chat: 9, center: true, activities: true, profile: true }, expected: { chat: 9, center: true, activities: false, profile: false } },
    { name: 'chat + lower-priority dot only', input: { chat: 1, activities: true, profile: true }, expected: { chat: 1, center: false, activities: true, profile: false } },
    { name: 'chat + profile dot when higher dots are quiet', input: { chat: 1, profile: true }, expected: { chat: 1, center: false, activities: false, profile: true } },
  ])('$name', ({ input, expected }) => {
    expect(plan(input)).toEqual({ discover: 0, ...expected })
  })

  it('never exceeds the visible budget', () => {
    const worstCase = plan({ chat: 2, center: true, activities: true, profile: true })
    expect(visibleCount(worstCase)).toBeLessThanOrEqual(MAX_VISIBLE_TAB_INDICATORS)
    expect(MAX_VISIBLE_TAB_INDICATORS).toBe(2)
  })

  it('never shows more than one number', () => {
    const result = plan({ chat: 2, center: true, activities: true, profile: true })
    const numbers = [result.chat].filter((value) => value > 0)
    expect(numbers).toHaveLength(1)
  })

  it('treats junk chat counts as silent', () => {
    expect(plan({ chat: Number.NaN }).chat).toBe(0)
    expect(plan({ chat: -4 }).chat).toBe(0)
    expect(plan({ chat: 2.7 }).chat).toBe(2)
  })
})

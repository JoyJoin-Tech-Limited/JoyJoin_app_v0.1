import { describe, expect, it } from 'vitest'
import {
  buildBudgetSelectionEcho,
  buildIntentSelectionEcho,
  buildRegistrationDecisionNote,
  shouldShowFirstSelectionEcho,
} from './registrationGuidance'
import { BUDGET_TIERS } from '@shared/budgetTiers'

// Derived from the canonical registry so the fixture cannot drift from tier
// ids/labels (check-budget-tiers ratchet).
function resolveDiningMidTier() {
  const tier = BUDGET_TIERS.find(
    (t) => t.eventType === '饭局' && t.min === 150 && t.max === 200,
  )
  if (!tier) throw new Error('registry must contain the mid dining tier')
  return tier
}
const DINING_MID_TIER = resolveDiningMidTier()

describe('registration Step-0 decision guidance', () => {
  it('uses one factual benefit statement and the two available event facts', () => {
    const note = buildRegistrationDecisionNote({
      dateTimeLabel: '10月31日 周六 19:30',
      area: '南山区',
    })

    expect(note.benefit).toBe('先看时间、地点和费用是否合适，再决定是否留座。')
    expect(note.facts).toEqual(['时间：10月31日 周六 19:30', '地点：南山区'])
  })

  it('omits missing or blank facts instead of fabricating them', () => {
    expect(buildRegistrationDecisionNote({ dateTimeLabel: '', area: '  ' }).facts).toEqual([])
    expect(
      buildRegistrationDecisionNote({ dateTimeLabel: '时间待定', area: '南山区' }).facts,
    ).toEqual(['地点：南山区'])
    expect(
      buildRegistrationDecisionNote({ dateTimeLabel: '时间待定', area: undefined }).facts,
    ).toEqual([])
  })
})

describe('first-selection echoes', () => {
  it('echoes the explicit budget label', () => {
    const budgetLabel = `${DINING_MID_TIER.label}/人`
    expect(buildBudgetSelectionEcho(budgetLabel)).toBe(`已记下你的预算：${budgetLabel}。`)
    expect(buildBudgetSelectionEcho('  ')).toBe('')
  })

  it('echoes explicit intent labels with bounded copy', () => {
    expect(buildIntentSelectionEcho(['认识新朋友'])).toBe('已记下你的期待：认识新朋友。')
    expect(buildIntentSelectionEcho(['认识新朋友', '轻松玩乐', '深度交流'])).toBe(
      '已记下 3 个期待：认识新朋友、轻松玩乐等。',
    )
    expect(buildIntentSelectionEcho(['', '  '])).toBe('')
  })

  it('allows only the first valid explicit selection and never replays', () => {
    expect(shouldShowFirstSelectionEcho({ hasShown: false, selectionCount: 1 })).toBe(true)
    expect(shouldShowFirstSelectionEcho({ hasShown: true, selectionCount: 1 })).toBe(false)
    expect(shouldShowFirstSelectionEcho({ hasShown: false, selectionCount: 0 })).toBe(false)
    expect(shouldShowFirstSelectionEcho({ hasShown: false, selectionCount: -1 })).toBe(false)
    expect(shouldShowFirstSelectionEcho({ hasShown: false, selectionCount: Number.NaN })).toBe(false)
  })
})

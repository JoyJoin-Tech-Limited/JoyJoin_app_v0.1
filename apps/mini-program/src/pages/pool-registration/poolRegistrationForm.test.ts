import { describe, expect, it } from 'vitest'
import { getBudgetOptions } from './flowConfig'
import {
  buildFormStateFromDraft,
  buildRegistrationPayload,
  getPoolRegistrationAdvanceBlocker,
  getPoolRegistrationSubmitBlocker,
  hasAnyDetailSelection,
  resolveRegistrationStep,
} from './poolRegistrationForm'

describe('poolRegistrationForm', () => {
  it('resolveRegistrationStep clamps legacy/unknown steps to the final step 2', () => {
    // Phase 2: stored payment-return drafts may still carry resumeStep = 3
    // (the removed details step) — they must land on the merged step 2.
    expect(resolveRegistrationStep(3)).toBe(2)
    expect(resolveRegistrationStep(99)).toBe(2)
    expect(resolveRegistrationStep(2)).toBe(2)
    expect(resolveRegistrationStep(1)).toBe(1)
  })

  it('getPoolRegistrationAdvanceBlocker gates budget and intent', () => {
    expect(
      getPoolRegistrationAdvanceBlocker(1, { hasBudgetSelection: false, hasIntentSelection: false }),
    ).toBe('先选一个预算区间')
    expect(
      getPoolRegistrationAdvanceBlocker(1, { hasBudgetSelection: true, hasIntentSelection: false }),
    ).toBeNull()
    expect(
      getPoolRegistrationAdvanceBlocker(2, { hasBudgetSelection: true, hasIntentSelection: false }),
    ).toBe('至少选一个这次想收获的方向')
    expect(
      getPoolRegistrationAdvanceBlocker(0, { hasBudgetSelection: false, hasIntentSelection: false }),
    ).toBeNull()
  })

  it('getPoolRegistrationSubmitBlocker requires budget and intent', () => {
    expect(
      getPoolRegistrationSubmitBlocker({ hasBudgetSelection: true, hasIntentSelection: false }),
    ).toBeTruthy()
    expect(
      getPoolRegistrationSubmitBlocker({ hasBudgetSelection: true, hasIntentSelection: true }),
    ).toBeNull()
  })

  it('buildRegistrationPayload emits canonical registry tier ids', () => {
    const base = {
      eventIntent: ['a'],
      preferredLanguages: ['粤语'],
      barThemes: [],
    }
    // Legacy labels in form state are canonicalized to registry ids on the way out.
    expect(buildRegistrationPayload({ ...base, budgetRange: ['150-200'] }, '饭局')).toMatchObject({
      budgetRange: ['dining_150_200'],
    })
    expect(buildRegistrationPayload({ ...base, budgetRange: ['150-200'] }, '饭局').dietaryRestrictions).toBeUndefined()
    // Canonical ids pass through untouched.
    expect(buildRegistrationPayload({ ...base, budgetRange: ['dining_300_500'] }, '饭局')).toMatchObject({
      budgetRange: ['dining_300_500'],
    })
    expect(
      buildRegistrationPayload(
        {
          ...base,
          barBudgetRange: ['80-150'],
          alcoholComfort: '微醺就好',
          barThemes: ['清吧'],
        },
        '酒局',
      ),
    ).toMatchObject({
      barBudgetRange: ['drinks_80_150'],
      alcoholComfort: ['微醺就好'],
    })
  })

  it('budget options are sourced from the canonical registry ids', () => {
    expect(getBudgetOptions('饭局').map((option) => option.value)).toEqual([
      'dining_150_below',
      'dining_150_200',
      'dining_200_300',
      'dining_300_500',
    ])
    expect(getBudgetOptions('酒局').map((option) => option.value)).toEqual([
      'drinks_80_below',
      'drinks_80_150',
    ])
  })

  it('buildFormStateFromDraft canonicalizes legacy draft budgets to registry ids', () => {
    expect(buildFormStateFromDraft({ budgetRange: ['200-300'] }).budgetRange).toEqual(['dining_200_300'])
    expect(buildFormStateFromDraft({ barBudgetRange: ['80以下'] }).barBudgetRange).toEqual(['drinks_80_below'])
    // Unmapped values are preserved verbatim, never silently dropped.
    expect(buildFormStateFromDraft({ budgetRange: ['100-200'] }).budgetRange).toEqual(['100-200'])
  })

  it('hasAnyDetailSelection is false when nothing is selected', () => {
    const empty = {
      eventIntent: [],
      preferredLanguages: [],
      barThemes: [],
    }
    expect(hasAnyDetailSelection(empty, '饭局')).toBe(false)
    expect(hasAnyDetailSelection(empty, '酒局')).toBe(false)
    expect(hasAnyDetailSelection({ ...empty, alcoholComfort: undefined }, '酒局')).toBe(false)
  })

  it('hasAnyDetailSelection detects dinner details', () => {
    const base = {
      eventIntent: [],
      preferredLanguages: [],
      barThemes: [],
    }
    expect(hasAnyDetailSelection({ ...base, preferredLanguages: ['粤语'] }, '饭局')).toBe(true)
  })

  it('hasAnyDetailSelection detects drinks details and handles deselect', () => {
    const base = {
      eventIntent: [],
      preferredLanguages: [],
      barThemes: [],
    }
    expect(hasAnyDetailSelection({ ...base, preferredLanguages: ['粤语'] }, '酒局')).toBe(true)
    expect(hasAnyDetailSelection({ ...base, barThemes: ['清吧'] }, '酒局')).toBe(true)
    expect(hasAnyDetailSelection({ ...base, alcoholComfort: '微醺就好' }, '酒局')).toBe(true)
    // Deselecting alcohol comfort returns undefined, not empty string
    expect(hasAnyDetailSelection({ ...base, alcoholComfort: undefined }, '酒局')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
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

  it('buildRegistrationPayload branches on 饭局 vs 酒局', () => {
    const base = {
      eventIntent: ['a'],
      preferredLanguages: ['粤语'],
      barThemes: [],
    }
    expect(buildRegistrationPayload({ ...base, budgetRange: ['150-200'] }, '饭局')).toMatchObject({
      budgetRange: ['150-200'],
    })
    expect(buildRegistrationPayload({ ...base, budgetRange: ['150-200'] }, '饭局').dietaryRestrictions).toBeUndefined()
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
      barBudgetRange: ['80-150'],
      alcoholComfort: ['微醺就好'],
    })
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

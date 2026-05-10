import { describe, expect, it } from 'vitest'
import {
  buildRegistrationPayload,
  getPoolRegistrationAdvanceBlocker,
  getPoolRegistrationSubmitBlocker,
  resolveRegistrationStep,
} from './poolRegistrationForm'

describe('poolRegistrationForm', () => {
  it('resolveRegistrationStep clamps unknown steps to 3', () => {
    expect(resolveRegistrationStep(99)).toBe(3)
    expect(resolveRegistrationStep(2)).toBe(2)
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
      dietaryRestrictions: [],
      barThemes: [],
    }
    expect(buildRegistrationPayload({ ...base, budgetRange: ['150-200'], dietaryRestrictions: ['vegetarian'] }, '饭局')).toMatchObject({
      budgetRange: ['150-200'],
      dietaryRestrictions: ['vegetarian'],
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
      barBudgetRange: ['80-150'],
      alcoholComfort: ['微醺就好'],
    })
  })
})

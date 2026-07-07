import { describe, expect, it } from 'vitest'
import {
  buildRegistrationPayload,
  buildSummaryItems,
  getPoolRegistrationAdvanceBlocker,
  getPoolRegistrationSubmitBlocker,
  hasAnyDetailSelection,
  resolveRegistrationStep,
} from './poolRegistrationForm'
import { INTENT_FLOW_OPTIONS } from './flowConfig'

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

  it('hasAnyDetailSelection is false when nothing is selected', () => {
    const empty = {
      eventIntent: [],
      preferredLanguages: [],
      dietaryRestrictions: [],
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
      dietaryRestrictions: [],
      barThemes: [],
    }
    expect(hasAnyDetailSelection({ ...base, preferredLanguages: ['粤语'] }, '饭局')).toBe(true)
    expect(hasAnyDetailSelection({ ...base, dietaryRestrictions: ['vegetarian'] }, '饭局')).toBe(true)
  })

  it('hasAnyDetailSelection detects drinks details and handles deselect', () => {
    const base = {
      eventIntent: [],
      preferredLanguages: [],
      dietaryRestrictions: [],
      barThemes: [],
    }
    expect(hasAnyDetailSelection({ ...base, preferredLanguages: ['粤语'] }, '酒局')).toBe(true)
    expect(hasAnyDetailSelection({ ...base, barThemes: ['清吧'] }, '酒局')).toBe(true)
    expect(hasAnyDetailSelection({ ...base, alcoholComfort: '微醺就好' }, '酒局')).toBe(true)
    // Deselecting alcohol comfort returns undefined, not empty string
    expect(hasAnyDetailSelection({ ...base, alcoholComfort: undefined }, '酒局')).toBe(false)
  })

  it('buildSummaryItems reflects meal budget and intent labels', () => {
    const base = {
      eventIntent: [],
      preferredLanguages: [],
      dietaryRestrictions: [],
      barThemes: [],
    }
    const friendsLabel = INTENT_FLOW_OPTIONS.find((option) => option.value === 'friends')?.label ?? '交朋友'
    const funLabel = INTENT_FLOW_OPTIONS.find((option) => option.value === 'fun')?.label ?? '轻松娱乐'

    expect(buildSummaryItems({ ...base, budgetRange: ['150-200'], eventIntent: ['friends', 'fun'] }, '饭局')).toEqual([
      { label: '你的预算', value: '150-200', icon: '👑', tier: 'ui', intentLabels: [] },
      {
        label: '这次想收获',
        value: `${friendsLabel}、${funLabel}`,
        icon: '🎯',
        tier: 'semantic',
        intentLabels: [friendsLabel, funLabel],
      },
    ])
  })

  it('buildSummaryItems reflects bar budget and falls back for empty selections', () => {
    const base = {
      eventIntent: [],
      preferredLanguages: [],
      dietaryRestrictions: [],
      barThemes: [],
    }

    expect(buildSummaryItems({ ...base, barBudgetRange: ['80-150'] }, '酒局')).toEqual([
      { label: '你的预算', value: '80-150', icon: '👑', tier: 'ui', intentLabels: [] },
      { label: '这次想收获', value: '未选择', icon: '🎯', tier: 'semantic', intentLabels: [] },
    ])

    expect(buildSummaryItems({ ...base }, '饭局')).toEqual([
      { label: '你的预算', value: '未选择', icon: '👑', tier: 'ui', intentLabels: [] },
      { label: '这次想收获', value: '未选择', icon: '🎯', tier: 'semantic', intentLabels: [] },
    ])
  })
})

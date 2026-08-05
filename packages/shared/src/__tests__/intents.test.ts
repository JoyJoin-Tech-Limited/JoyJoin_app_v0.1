import { describe, expect, it } from 'vitest'
import { toggleIntentValue, INTENT_OPTIONS, INTENT_FLEXIBLE_OPTION } from '../constants'

describe('toggleIntentValue', () => {
  const flexible = INTENT_FLEXIBLE_OPTION.value

  it('adds an explicit intent', () => {
    expect(toggleIntentValue([], 'friends')).toEqual(['friends'])
  })

  it('removes an already-selected explicit intent', () => {
    expect(toggleIntentValue(['friends', 'fun'], 'friends')).toEqual(['fun'])
  })

  it('allows selecting beyond the old cap by default (no cap)', () => {
    const fiveOfSix = INTENT_OPTIONS.slice(0, -1).map((option) => option.value)
    expect(fiveOfSix).toHaveLength(5)
    const next = toggleIntentValue(fiveOfSix.slice(0, 4), fiveOfSix[4])
    expect(next).toEqual(fiveOfSix)
  })

  it('collapses to flexible when every explicit intent is selected', () => {
    const allExplicit = INTENT_OPTIONS.map((option) => option.value)
    const current = allExplicit.slice(0, -1)
    expect(toggleIntentValue(current, allExplicit[allExplicit.length - 1])).toEqual([flexible])
  })

  it('blocks adding an explicit intent when a custom cap is reached and returns null', () => {
    const current = ['friends', 'networking', 'discussion']
    expect(toggleIntentValue(current, 'fun', { maxExplicit: 3 })).toBeNull()
  })

  it('treats flexible as mutually exclusive with explicit intents', () => {
    const current = ['friends', 'networking', 'discussion']
    expect(toggleIntentValue(current, flexible)).toEqual([flexible])
  })

  it('allows removing flexible', () => {
    expect(toggleIntentValue([flexible], flexible)).toEqual([])
  })

  it('selecting an explicit intent clears flexible', () => {
    expect(toggleIntentValue([flexible], 'friends')).toEqual(['friends'])
  })

  it('respects a custom cap', () => {
    expect(toggleIntentValue(['friends'], 'networking', { maxExplicit: 1 })).toBeNull()
    expect(toggleIntentValue(['friends'], 'networking', { maxExplicit: 2 })).toEqual([
      'friends',
      'networking',
    ])
  })

  it('keeps custom flexible values mutually exclusive', () => {
    expect(
      toggleIntentValue(['a', 'b', 'c'], 'flex', { maxExplicit: 3, flexibleValue: 'flex' }),
    ).toEqual(['flex'])
  })

  it('does not mutate the input array', () => {
    const current = ['friends']
    const next = toggleIntentValue(current, 'networking')
    expect(current).toEqual(['friends'])
    expect(next).toEqual(['friends', 'networking'])
  })
})

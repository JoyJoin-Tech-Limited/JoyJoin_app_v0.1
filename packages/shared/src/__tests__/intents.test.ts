import { describe, expect, it } from 'vitest'
import { toggleIntentValue, INTENT_FLEXIBLE_OPTION } from '../constants'

describe('toggleIntentValue', () => {
  const flexible = INTENT_FLEXIBLE_OPTION.value

  it('adds an explicit intent when under the cap', () => {
    expect(toggleIntentValue([], 'friends')).toEqual(['friends'])
  })

  it('removes an already-selected explicit intent', () => {
    expect(toggleIntentValue(['friends', 'fun'], 'friends')).toEqual(['fun'])
  })

  it('blocks adding an explicit intent when the cap is reached and returns null', () => {
    const current = ['friends', 'networking', 'discussion']
    expect(toggleIntentValue(current, 'fun')).toBeNull()
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

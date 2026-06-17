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

  it('allows adding flexible regardless of the explicit cap', () => {
    const current = ['friends', 'networking', 'discussion']
    expect(toggleIntentValue(current, flexible)).toEqual([...current, flexible])
  })

  it('allows removing flexible even when explicit cap is reached', () => {
    const current = ['friends', 'networking', 'discussion', flexible]
    expect(toggleIntentValue(current, flexible)).toEqual(['friends', 'networking', 'discussion'])
  })

  it('respects a custom cap', () => {
    expect(toggleIntentValue(['friends'], 'networking', { maxExplicit: 1 })).toBeNull()
    expect(toggleIntentValue(['friends'], 'networking', { maxExplicit: 2 })).toEqual([
      'friends',
      'networking',
    ])
  })

  it('ignores the cap when the flexible value is customized', () => {
    expect(
      toggleIntentValue(['a', 'b', 'c'], 'flex', { maxExplicit: 3, flexibleValue: 'flex' }),
    ).toEqual(['a', 'b', 'c', 'flex'])
  })

  it('does not mutate the input array', () => {
    const current = ['friends']
    const next = toggleIntentValue(current, 'networking')
    expect(current).toEqual(['friends'])
    expect(next).toEqual(['friends', 'networking'])
  })
})

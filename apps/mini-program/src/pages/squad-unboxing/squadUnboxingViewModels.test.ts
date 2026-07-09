import { describe, expect, it } from 'vitest'
import { buildPairKeyMemberMap, computeActionDockState, getSquadChemistryTokens } from './squadUnboxingViewModels'

describe('squadUnboxingViewModels', () => {
  it('computeActionDockState follows reveal state only', () => {
    expect(computeActionDockState('ready')).toBe('hidden')
    expect(computeActionDockState('shaking')).toBe('hidden')
    expect(computeActionDockState('revealed')).toBe('ready')
  })

  it('buildPairKeyMemberMap creates sorted keys for every pair', () => {
    const members = [
      { userId: 'u3' },
      { userId: 'u1' },
      { userId: 'u2' },
    ]

    const map = buildPairKeyMemberMap(members)

    expect(map.size).toBe(3)
    expect(map.get('u1-u2')).toEqual([{ userId: 'u1' }, { userId: 'u2' }])
    expect(map.get('u1-u3')).toEqual([{ userId: 'u3' }, { userId: 'u1' }])
    expect(map.get('u2-u3')).toEqual([{ userId: 'u3' }, { userId: 'u2' }])
  })

  it('getSquadChemistryTokens maps overall chemistry', () => {
    expect(getSquadChemistryTokens('fire', null).chipClassName).toContain('fire')
    expect(getSquadChemistryTokens('warm', null).iconRef).toBe('warm')
    expect(getSquadChemistryTokens('cold', null).iconRef).toBe('cold')
    expect(getSquadChemistryTokens('mild', null).iconRef).toBe('mild')
    expect(getSquadChemistryTokens(undefined, 88).title).toContain('88')
    expect(getSquadChemistryTokens(undefined, 88).iconRef).toBe('mild')
  })
})

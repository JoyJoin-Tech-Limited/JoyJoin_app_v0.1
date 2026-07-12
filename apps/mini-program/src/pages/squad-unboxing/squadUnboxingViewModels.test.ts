import { describe, expect, it } from 'vitest'
import { buildPairKeyMemberMap, computeActionDockState, getChemistryWord, getPairChemistryWord, getSquadChemistryTokens } from './squadUnboxingViewModels'

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
    expect(getSquadChemistryTokens('fire').chipClassName).toContain('fire')
    expect(getSquadChemistryTokens('warm').iconRef).toBe('warm')
    expect(getSquadChemistryTokens('cold').iconRef).toBe('cold')
    expect(getSquadChemistryTokens('mild').iconRef).toBe('mild')
    expect(getSquadChemistryTokens(undefined).title).toBe('今晚有戏')
    expect(getSquadChemistryTokens(undefined).iconRef).toBe('mild')
  })

  it('getChemistryWord returns a temperature word and never a number', () => {
    expect(getChemistryWord('fire')).toBe('超级火花')
    expect(getChemistryWord('warm')).toBe('暖意融融')
    expect(getChemistryWord('mild')).toBe('相聊甚欢')
    expect(getChemistryWord('cold')).toBe('慢慢发现')
    expect(getChemistryWord(undefined)).toBe('今晚有戏')
    expect(getChemistryWord(null)).toBe('今晚有戏')
  })

  it('getPairChemistryWord maps numeric scores to temperature words (no naked integer)', () => {
    expect(getPairChemistryWord(92)).toBe('超级火花')
    expect(getPairChemistryWord(85)).toBe('超级火花')
    expect(getPairChemistryWord(70)).toBe('暖意融融')
    expect(getPairChemistryWord(55)).toBe('相聊甚欢')
    expect(getPairChemistryWord(40)).toBe('慢慢发现')
    expect(getPairChemistryWord(null)).toBe('今晚有戏')
    expect(getPairChemistryWord(undefined)).toBe('今晚有戏')
  })
})

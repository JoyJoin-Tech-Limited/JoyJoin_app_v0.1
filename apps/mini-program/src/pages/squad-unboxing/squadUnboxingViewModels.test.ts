import { describe, expect, it } from 'vitest'
import { computeActionDockState, getSquadChemistryTokens } from './squadUnboxingViewModels'

describe('squadUnboxingViewModels', () => {
  it('computeActionDockState follows reveal + stage ladder', () => {
    expect(computeActionDockState('ready', 0)).toBe('hidden')
    expect(computeActionDockState('revealed', 2)).toBe('hidden')
    expect(computeActionDockState('revealed', 3)).toBe('tease')
    expect(computeActionDockState('revealed', 4)).toBe('ready')
  })

  it('getSquadChemistryTokens maps overall chemistry', () => {
    expect(getSquadChemistryTokens('fire', null).iconRef).toBe('fire')
    expect(getSquadChemistryTokens('fire', null).chipClassName).toContain('fire')
    expect(getSquadChemistryTokens('warm', null).iconRef).toBe('warm')
    expect(getSquadChemistryTokens('cold', null).iconRef).toBe('cold')
    expect(getSquadChemistryTokens('mild', null).iconRef).toBe('mild')
    expect(getSquadChemistryTokens(undefined, 88).title).toContain('88')
    expect(getSquadChemistryTokens(undefined, 88).iconRef).toBe('mild')
  })
})

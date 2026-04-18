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
    expect(getSquadChemistryTokens('fire', null).chipClassName).toContain('fire')
    expect(getSquadChemistryTokens(undefined, 88).title).toContain('88')
  })
})

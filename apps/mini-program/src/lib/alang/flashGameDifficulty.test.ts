import { describe, expect, it } from 'vitest'
import {
  FLASH_GAMEPLAY_VERSION,
  deterministicGameOrder,
  getFailureAssistance,
} from './flashGameDifficulty'

describe('flash gameplay v2 difficulty helpers', () => {
  it('escalates from consequence to clue and then assisted completion', () => {
    expect(getFailureAssistance(1)).toEqual({ tier: 'consequence', showClue: false, assist: false })
    expect(getFailureAssistance(2)).toEqual({ tier: 'clue', showClue: true, assist: false })
    expect(getFailureAssistance(3)).toEqual({ tier: 'assist', showClue: true, assist: true })
    expect(getFailureAssistance(20).tier).toBe('assist')
  })

  it('keeps deterministic variants stable without dropping pieces', () => {
    const pieces = ['a', 'b', 'c'] as const
    const first = deterministicGameOrder(pieces, 's1-p2-alang:replay-2')
    const second = deterministicGameOrder(pieces, 's1-p2-alang:replay-2')
    expect(first).toEqual(second)
    expect([...first].sort()).toEqual([...pieces].sort())
    expect(FLASH_GAMEPLAY_VERSION).toBe('flash-gameplay-v2')
    expect(deterministicGameOrder(pieces, 'replay-a')).not.toEqual(deterministicGameOrder(pieces, 'replay-b'))
  })
})

import { describe, expect, it } from 'vitest'
import {
  hasCompletedPriorNpcPhases,
  isFlashStorySeasonComplete,
  selectNextNpcStoryEpisode,
} from '../lib/flashStoryProgression'

const episodes = [
  { id: 'atuan-p1', phase: 1 },
  { id: 'atuan-p2', phase: 2 },
  { id: 'atuan-p3', phase: 3 },
]

describe('per-NPC Flash story progression', () => {
  it('unlocks one NPC phase two without waiting for the other NPCs', () => {
    expect(selectNextNpcStoryEpisode(episodes, new Set(['atuan-p1']))).toEqual(episodes[1])
  })

  it('keeps each NPC sequential and never skips an unfinished phase', () => {
    expect(selectNextNpcStoryEpisode(episodes, new Set(['atuan-p2']))).toEqual(episodes[0])
    expect(hasCompletedPriorNpcPhases(3, [1])).toBe(false)
    expect(hasCompletedPriorNpcPhases(3, [1, 2])).toBe(true)
  })

  it('returns no episode after that NPC completes all three phases', () => {
    expect(selectNextNpcStoryEpisode(episodes, new Set(episodes.map((episode) => episode.id)))).toBeNull()
  })

  it('finishes the season only after all fifteen NPC episodes settle', () => {
    expect(isFlashStorySeasonComplete(14)).toBe(false)
    expect(isFlashStorySeasonComplete(15)).toBe(true)
  })
})

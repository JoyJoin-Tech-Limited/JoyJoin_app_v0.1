import { describe, expect, it } from 'vitest'
import {
  completedFlashActGamePlacements,
  createFlashActGameProgress,
  restoreFlashActGameProgress,
} from './flashActGameProgress'

const expected = { unitId: 's1-p1-momo', phase: 1 as const, mode: 'momo', itemIds: ['rain', 'turn', 'blank'] }

describe('flash act game v2 progress', () => {
  it('restores the exact reveal, attempt and placement state for the same act', () => {
    const restored = restoreFlashActGameProgress({
      ...createFlashActGameProgress(expected),
      placements: [{ cardId: 'rain', destinationId: 'listen' }],
      revealedItemIds: ['rain', 'turn', 'foreign'],
      attemptsByItem: { rain: 1, turn: 3, foreign: 20 },
    }, expected)
    expect(restored).toMatchObject({
      version: 'flash-act-game-v2',
      placements: [{ cardId: 'rain', destinationId: 'listen' }],
      revealedItemIds: ['rain', 'turn'],
      attemptsByItem: { rain: 1, turn: 3, blank: 0 },
    })
  })

  it('rejects another act and migrates a valid v1 completion without replaying it', () => {
    const otherAct = restoreFlashActGameProgress({
      version: 'flash-act-game-v2', unitId: 's1-p2-momo', phase: 2, mode: 'momo', status: 'playing', placements: [], pending: null,
    }, expected)
    expect(otherAct).toEqual(createFlashActGameProgress(expected))

    const legacyComplete = {
      version: 'flash-act-game-v1', unitId: expected.unitId, phase: expected.phase, mode: expected.mode, status: 'completed',
      placements: expected.itemIds.map((cardId) => ({ cardId, destinationId: 'legacy-valid' })), pending: null,
    }
    expect(completedFlashActGamePlacements(legacyComplete, expected)).toHaveLength(3)
  })
})

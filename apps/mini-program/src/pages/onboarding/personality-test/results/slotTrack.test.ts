import { describe, expect, it } from 'vitest'
import { ARCHETYPE_SEQUENCE } from './resultHelpers'
import type { SlotPhase } from './resultHelpers'
import {
  applySlotTrackStep,
  isSlotTrackAdvancingPhase,
  SLOT_TRACK_EXTENDED_COUNT,
  slotTrackDiff,
} from './slotTrack'

const SLOW_STEP_COUNT = 10

function buildHookReelSequence(
  target: number,
  spinSteps: number,
  holdTicks: number,
  nearMiss: number | null,
): Array<{ reelIndex: number; phase: SlotPhase }> {
  const sequence: Array<{ reelIndex: number; phase: SlotPhase }> = []
  let reel = 0
  for (let step = 0; step < spinSteps; step += 1) {
    reel = (reel + 1) % 12
    sequence.push({ reelIndex: reel, phase: 'spinning' })
  }
  for (let tick = 0; tick < holdTicks; tick += 1) {
    reel = (reel + 1) % 12
    sequence.push({ reelIndex: reel, phase: 'holding' })
  }
  const approachPositions = Array.from(
    { length: SLOW_STEP_COUNT },
    (_, index) => (target - SLOW_STEP_COUNT + index + 12) % 12,
  )
  for (const position of approachPositions) {
    sequence.push({ reelIndex: position, phase: 'slowing' })
  }
  if (nearMiss !== null) {
    sequence.push({ reelIndex: nearMiss, phase: 'nearMiss' })
  }
  sequence.push({ reelIndex: target, phase: 'landed' })
  return sequence
}

function runTrack(sequence: Array<{ reelIndex: number; phase: SlotPhase }>): number {
  let displayIndex = 0
  let prevReel = 0
  for (const { reelIndex, phase } of sequence) {
    if (!isSlotTrackAdvancingPhase(phase)) continue
    const diff = slotTrackDiff(prevReel, reelIndex)
    if (diff === 0) continue
    displayIndex = applySlotTrackStep(displayIndex, diff).next
    prevReel = reelIndex
  }
  return displayIndex
}

describe('slotTrack landing invariant', () => {
  it('landed phase advances the track (regression: slot must not stop one card early)', () => {
    expect(isSlotTrackAdvancingPhase('landed')).toBe(true)
  })

  it('normalizes wrap-around diffs to the shortest signed path', () => {
    expect(slotTrackDiff(10, 0)).toBe(2)
    expect(slotTrackDiff(0, 10)).toBe(-2)
    expect(slotTrackDiff(6, 0)).toBe(-6)
    expect(slotTrackDiff(5, 11)).toBe(6)
    expect(slotTrackDiff(3, 3)).toBe(0)
  })

  it('snaps forward when a backward step would drive the track negative', () => {
    const step = applySlotTrackStep(2, -6)
    expect(step.next).toBe(8)
    expect(step.snapped).toBe(true)
  })

  it('the track lands exactly on the target archetype for every hook reel sequence', () => {
    const nearMissVariants: Array<number | null> = [null, 1, 2, 5, 11]
    let checked = 0
    for (let target = 0; target < ARCHETYPE_SEQUENCE.length; target += 1) {
      for (const spinSteps of [15, 20]) {
        for (const holdTicks of [0, 3, 9]) {
          for (const nearMissOffset of nearMissVariants) {
            const nearMiss = nearMissOffset === null ? null : (target + nearMissOffset) % 12
            const displayIndex = runTrack(buildHookReelSequence(target, spinSteps, holdTicks, nearMiss))
            checked += 1
            expect(displayIndex % 12).toBe(target)
            expect(displayIndex).toBeGreaterThanOrEqual(0)
            expect(displayIndex).toBeLessThan(SLOT_TRACK_EXTENDED_COUNT)
          }
        }
      }
    }
    expect(checked).toBe(360)
  })
})

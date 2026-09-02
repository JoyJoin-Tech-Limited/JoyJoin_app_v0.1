import { ARCHETYPE_SEQUENCE } from './resultHelpers'
import type { SlotPhase } from './resultHelpers'

export const SLOT_TRACK_EXTENDED_COUNT = 24
export const SLOT_TRACK_SNAP_THRESHOLD = SLOT_TRACK_EXTENDED_COUNT - 8
export const SLOT_TRACK_SNAP_BACK = ARCHETYPE_SEQUENCE.length

export interface SlotTrackStep {
  next: number
  snapped: boolean
}

export function isSlotTrackAdvancingPhase(phase: SlotPhase): boolean {
  return (
    phase === 'spinning' ||
    phase === 'holding' ||
    phase === 'slowing' ||
    phase === 'nearMiss' ||
    phase === 'landed'
  )
}

export function slotTrackDiff(prevReel: number, reelIndex: number): number {
  let diff = reelIndex - prevReel
  if (diff < -6) diff += SLOT_TRACK_SNAP_BACK
  if (diff > 6) diff -= SLOT_TRACK_SNAP_BACK
  return diff
}

export function applySlotTrackStep(current: number, diff: number): SlotTrackStep {
  const raw = current + diff
  if (raw >= SLOT_TRACK_SNAP_THRESHOLD) {
    return { next: raw - SLOT_TRACK_SNAP_BACK, snapped: true }
  }
  if (raw < 0) {
    return { next: raw + SLOT_TRACK_SNAP_BACK, snapped: true }
  }
  return { next: raw, snapped: false }
}

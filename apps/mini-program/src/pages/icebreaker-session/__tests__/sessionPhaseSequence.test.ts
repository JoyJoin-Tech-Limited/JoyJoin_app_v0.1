import { describe, expect, it } from 'vitest'
import {
  resolvePhaseChipPayload,
  resolvePhaseMapPayload,
  resolveSessionPhaseSequence,
} from '../viewModels/sessionPhaseSequence'

/**
 * Session phase sequence model (sprint icebreaker-uiux-wave2, AC-01/AC-02).
 * Locks the single data source behind the shell's resident progress chip and
 * the entry phase map: runPlan order first, enabledPhases+recap fallback,
 * custom sessions degrade to a loose (total-less) chip — and the chip/map
 * division of labour (map on waiting/warmup, chip from first game phase).
 */
describe('resolveSessionPhaseSequence', () => {
  it('prefers runPlan segment order (recap included), marks current + done', () => {
    const sequence = resolveSessionPhaseSequence({
      phase: 'lie_detective',
      completedPhases: ['warmup', 'micro_challenge'],
      runPlan: {
        segments: [
          { phase: 'warmup' },
          { phase: 'micro_challenge' },
          { phase: 'lie_detective' },
          { phase: 'recap' },
        ],
      },
    })
    expect(sequence.items.map((item) => item.phase)).toEqual([
      'warmup',
      'micro_challenge',
      'lie_detective',
      'recap',
    ])
    expect(sequence.currentIndex).toBe(2)
    expect(sequence.total).toBe(4)
    expect(sequence.hasTotal).toBe(true)
    expect(sequence.items[0].done).toBe(true)
    expect(sequence.items[2].current).toBe(true)
    expect(sequence.items[3].done).toBe(false)
  })

  it('falls back to enabledPhases with a trailing recap', () => {
    const sequence = resolveSessionPhaseSequence({
      phase: 'micro_challenge',
      completedPhases: ['warmup'],
      enabledPhases: ['warmup', 'micro_challenge', 'lie_detective'],
    })
    expect(sequence.items.map((item) => item.phase)).toEqual([
      'warmup',
      'micro_challenge',
      'lie_detective',
      'recap',
    ])
    expect(sequence.total).toBe(4)
    expect(sequence.hasTotal).toBe(true)
  })

  it('custom sessions (no plan, no enabled list) expose no total', () => {
    const sequence = resolveSessionPhaseSequence({
      phase: 'quip_battle',
      completedPhases: ['warmup', 'phase_selection', 'lie_detective'],
    })
    expect(sequence.hasTotal).toBe(false)
    // phase_selection (meta) is filtered out of the walked path
    expect(sequence.items.map((item) => item.phase)).toEqual(['warmup', 'lie_detective', 'quip_battle'])
  })
})

describe('resolvePhaseChipPayload', () => {
  it('hides on waiting/warmup/ended/phase_selection (map owns those frames)', () => {
    for (const phase of ['waiting', 'warmup', 'ended', 'phase_selection']) {
      expect(resolvePhaseChipPayload({ phase, enabledPhases: ['warmup', 'micro_challenge'] })).toBeNull()
    }
  })

  it('returns 1-based index + total for a planned game phase', () => {
    const payload = resolvePhaseChipPayload({
      phase: 'personality_dice',
      enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'personality_dice'],
    })
    expect(payload).toEqual({ index1Based: 4, total: 5, phase: 'personality_dice' })
  })

  it('covers recap as the final planned phase', () => {
    const payload = resolvePhaseChipPayload({
      phase: 'recap',
      enabledPhases: ['warmup', 'micro_challenge'],
    })
    expect(payload).toEqual({ index1Based: 3, total: 3, phase: 'recap' })
  })

  it('degrades to the loose variant on custom sessions (never a fabricated M)', () => {
    const payload = resolvePhaseChipPayload({
      phase: 'quip_battle',
      completedPhases: ['warmup'],
    })
    expect(payload).toEqual({ loose: true, phase: 'quip_battle' })
  })
})

describe('resolvePhaseMapPayload', () => {
  it('renders on waiting and warmup only', () => {
    const session = {
      enabledPhases: ['warmup', 'micro_challenge', 'lie_detective'] as ('warmup' | 'micro_challenge' | 'lie_detective')[],
      completedPhases: [] as ('warmup')[],
    }
    expect(resolvePhaseMapPayload({ ...session, phase: 'waiting' })).not.toBeNull()
    expect(resolvePhaseMapPayload({ ...session, phase: 'warmup' })).not.toBeNull()
    expect(resolvePhaseMapPayload({ ...session, phase: 'micro_challenge' })).toBeNull()
    expect(resolvePhaseMapPayload({ ...session, phase: 'recap' })).toBeNull()
  })

  it('marks the warmup item current during warmup', () => {
    const payload = resolvePhaseMapPayload({
      phase: 'warmup',
      enabledPhases: ['warmup', 'micro_challenge'],
    })
    expect(payload?.items[0].current).toBe(true)
    expect(payload?.items[1].current).toBe(false)
  })

  it('hides a degenerate (<2 item) map', () => {
    expect(resolvePhaseMapPayload({ phase: 'waiting', enabledPhases: ['recap'] })).toBeNull()
    expect(resolvePhaseMapPayload({ phase: 'waiting' })).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import type { FlashStoryV2Interaction } from '@shared/schema/flash'
import {
  interactionPositionCount,
  interactionRegionCount,
  mistakeGuidance,
  positionFromCompletedCount,
  resultIdAtPosition,
} from './interactionOutcome'

function makeInteraction(overrides: Partial<FlashStoryV2Interaction> = {}): FlashStoryV2Interaction {
  return {
    template: 'spacing',
    goal: '移动两把椅子，留出图上刚好的并肩距离。',
    hints: ['不用挤在一起。', '给它们留一点能呼吸的距离。'],
    results: [
      { id: 'aligned', next: 'n3_a' },
      { id: 'crowded', next: 'n3_b' },
      { id: 'settle-now', next: 'n5' },
    ],
    defaultResultId: 'aligned',
    fallbackNext: 'n4',
    ...overrides,
  }
}

describe('interactionOutcome', () => {
  it('maps the final (completed) position to the reviewed defaultResultId', () => {
    const interaction = makeInteraction()
    expect(interactionPositionCount(interaction)).toBe(3)
    expect(resultIdAtPosition(interaction, 2)).toBe('aligned')
  })

  it('maps earlier positions to the remaining declared results in order', () => {
    const interaction = makeInteraction()
    expect(resultIdAtPosition(interaction, 0)).toBe('crowded')
    expect(resultIdAtPosition(interaction, 1)).toBe('settle-now')
  })

  it('clamps out-of-range positions instead of failing', () => {
    const interaction = makeInteraction()
    expect(resultIdAtPosition(interaction, -4)).toBe('crowded')
    expect(resultIdAtPosition(interaction, 99)).toBe('aligned')
  })

  it('treats completion as the result for single-result configs', () => {
    const interaction = makeInteraction({
      results: [{ id: 'aligned', next: 'n3_a' }],
    })
    expect(interactionPositionCount(interaction)).toBe(1)
    expect(resultIdAtPosition(interaction, 0)).toBe('aligned')
  })

  it('still resolves when defaultResultId is declared mid-order', () => {
    const interaction = makeInteraction({
      results: [
        { id: 'crowded', next: 'n3_b' },
        { id: 'aligned', next: 'n3_a' },
        { id: 'settle-now', next: 'n5' },
      ],
    })
    expect(resultIdAtPosition(interaction, 2)).toBe('aligned')
    expect(resultIdAtPosition(interaction, 0)).toBe('crowded')
    expect(resultIdAtPosition(interaction, 1)).toBe('settle-now')
  })

  it('counts regions for privacy/pairing templates within 2..3', () => {
    expect(interactionRegionCount(makeInteraction({ results: [{ id: 'a', next: 'n' }] }))).toBe(2)
    expect(interactionRegionCount(makeInteraction())).toBe(3)
  })

  it('requires at least one completed region before a position exists', () => {
    const interaction = makeInteraction()
    expect(positionFromCompletedCount(0, interaction)).toBeNull()
    expect(positionFromCompletedCount(1, interaction)).toBe(1)
    expect(positionFromCompletedCount(3, interaction)).toBe(2)
  })

  it('surfaces the first hint as mistake guidance when no mistake copy exists', () => {
    expect(mistakeGuidance(makeInteraction())).toBe('不用挤在一起。')
    expect(mistakeGuidance(makeInteraction({ hints: undefined }))).toBe('没关系，慢一点再来一次就好。')
  })
})

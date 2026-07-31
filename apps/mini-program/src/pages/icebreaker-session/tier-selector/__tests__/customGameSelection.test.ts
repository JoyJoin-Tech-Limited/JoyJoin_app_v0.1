import { describe, expect, it } from 'vitest'
import {
  CUSTOM_GAME_OPTIONS,
  getCustomSelectionSummary,
  toggleCustomGameSelection,
} from '../customGameSelection'

describe('custom game selection', () => {
  it('offers the nine playable icebreaker games with durations and icons', () => {
    expect(CUSTOM_GAME_OPTIONS).toHaveLength(9)
    expect(CUSTOM_GAME_OPTIONS.every((game) => game.minutes > 0 && game.iconPhase === game.phase)).toBe(true)
  })

  it('preserves tap order and removes a selected game when tapped again', () => {
    expect(toggleCustomGameSelection([], 'auction')).toEqual(['auction'])
    expect(toggleCustomGameSelection(['auction'], 'lie_detective')).toEqual([
      'auction',
      'lie_detective',
    ])
    expect(toggleCustomGameSelection(['auction', 'lie_detective'], 'auction')).toEqual([
      'lie_detective',
    ])
  })

  it('summarizes the selected count and estimated duration', () => {
    expect(getCustomSelectionSummary(['auction', 'lie_detective'])).toBe(
      '选择了2个游戏，预计时长35分钟',
    )
    expect(getCustomSelectionSummary([])).toBe('选择游戏，安排今晚的专属节奏')
  })
})

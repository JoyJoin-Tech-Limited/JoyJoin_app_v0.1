import { describe, expect, it } from 'vitest'
import { FLASH_STORY_SEASON_UNITS, FLASH_STORY_UNIT_IDS, getFlashStoryUnitDefinition } from './flashStorySeason'

describe('Flash story season-one catalog', () => {
  it('contains exactly five NPCs across three complete acts', () => {
    expect(FLASH_STORY_SEASON_UNITS).toHaveLength(15)
    expect(new Set(FLASH_STORY_UNIT_IDS).size).toBe(15)
    expect(new Set(FLASH_STORY_SEASON_UNITS.map((unit) => unit.npcSlug)).size).toBe(5)
    for (const phase of [1, 2, 3]) {
      const units = FLASH_STORY_SEASON_UNITS.filter((unit) => unit.phase === phase)
      expect(units).toHaveLength(5)
      expect(new Set(units.map((unit) => unit.npcSlug)).size).toBe(5)
    }
  })

  it('keeps one stable NPC/phase/object mapping per unit', () => {
    for (const unit of FLASH_STORY_SEASON_UNITS) {
      expect(getFlashStoryUnitDefinition(unit.unitId)).toEqual(unit)
      expect(unit.goal.length).toBeGreaterThan(12)
      expect(unit.success).not.toBe(unit.goal)
      expect(unit.firstMistake).not.toMatch(/失败|错误|答错/)
    }
  })
})

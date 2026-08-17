import { describe, expect, it } from 'vitest'
import { ATUAN_LATER_ACT_UNIT_IDS } from '@shared/alang/atuanLaterActs'
import { FIRST_ACT_GAME_CONFIGS } from '../../../pages/alang/atuan-cards'
import { deterministicGameOrder, getFailureAssistance } from '../../../lib/alang/flashGameDifficulty'
import { CUSTOM_LATER_ACT_CONFIGS } from './LaterActStoryConfigs'

const ALL_GAME_UNIT_IDS = [
  ...Object.keys(FIRST_ACT_GAME_CONFIGS).map((npc) => `s1-p1-${npc}`),
  ...Object.keys(CUSTOM_LATER_ACT_CONFIGS),
  ...ATUAN_LATER_ACT_UNIT_IDS,
]

function orderSignatures<T>(items: readonly T[], unitId: string): Set<string> {
  return new Set(Array.from({ length: 12 }, (_, replayIndex) => (
    deterministicGameOrder(items, `${unitId}:replay-${replayIndex}`).map((item) => JSON.stringify(item)).join('|')
  )))
}

describe('Flash gameplay v2 15-act contract', () => {
  it('covers all 15 acts with one act-bound game', () => {
    expect(new Set(ALL_GAME_UNIT_IDS).size).toBe(15)
  })

  it('requires one correct destination for every first-act operation', () => {
    for (const config of Object.values(FIRST_ACT_GAME_CONFIGS)) {
      expect(config.items).toHaveLength(3)
      for (const item of config.items) {
        expect(item.choices.filter((choice) => choice.isCorrect)).toHaveLength(1)
        expect(item.observation.length).toBeGreaterThanOrEqual(8)
        expect(item.clue.length).toBeGreaterThanOrEqual(8)
      }
    }
  })

  it('binds every later-act operation to explored evidence and a single valid action', () => {
    for (const config of Object.values(CUSTOM_LATER_ACT_CONFIGS)) {
      expect(config.game.steps).toHaveLength(3)
      for (const [index, step] of config.game.steps.entries()) {
        expect(config.objectExploration.details[index]?.clue.length).toBeGreaterThanOrEqual(8)
        expect(step.choices.length).toBeGreaterThanOrEqual(2)
        expect(step.choices.filter((choice) => choice.correct)).toHaveLength(1)
      }
    }
  })

  it.each(ALL_GAME_UNIT_IDS)('%s shares the consequence, clue, and assist failure ladder', () => {
    expect(getFailureAssistance(1)).toEqual({ tier: 'consequence', showClue: false, assist: false })
    expect(getFailureAssistance(2)).toEqual({ tier: 'clue', showClue: true, assist: false })
    expect(getFailureAssistance(3)).toEqual({ tier: 'assist', showClue: true, assist: true })
  })

  it('allows every configured first and later act to vary replay order without changing its choices', () => {
    for (const [npc, config] of Object.entries(FIRST_ACT_GAME_CONFIGS)) {
      for (const item of config.items) expect(orderSignatures(item.choices, `s1-p1-${npc}:${item.id}`).size).toBeGreaterThan(1)
    }
    for (const [unitId, config] of Object.entries(CUSTOM_LATER_ACT_CONFIGS)) {
      expect(orderSignatures(config.objectExploration.details, unitId).size).toBeGreaterThan(1)
    }
  })
})

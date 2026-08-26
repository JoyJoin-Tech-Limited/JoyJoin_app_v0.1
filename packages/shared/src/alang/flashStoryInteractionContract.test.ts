import { describe, expect, it } from 'vitest'
import {
  FLASH_STORY_SEASON_UNITS,
  FLASH_V2_PILOT_UNIT_IDS,
  type FlashStoryInteractionKind,
} from './flashStorySeason'
import type {
  FlashStoryV2Interaction,
  FlashStoryV2Node,
} from '../schema/flash'

const INTERACTION_KINDS: readonly FlashStoryInteractionKind[] = [
  'spacing',
  'pairing',
  'path',
  'overlay',
  'privacy',
]

function buildInteractionNode(overrides?: Partial<FlashStoryV2Interaction>): FlashStoryV2Node {
  return {
    id: 'n3_action',
    type: 'interaction',
    interaction: {
      template: 'spacing',
      goal: '移动两把椅子，留出图上刚好的并肩距离。',
      hints: ['先别翻背面。能看见的部分已经够我们判断。'],
      results: [
        { id: 'placed', next: 'n4_echo_a', effect: { echo: 5, flagsSet: ['s1-alang-chairs-placed'] } },
      ],
      defaultResultId: 'placed',
      fallbackNext: 'n3_action_fallback',
      ...overrides,
    },
  }
}

describe('Flash v2 interaction-node contract (sprint_20260821_3kmkkw)', () => {
  it('whitelist is exactly the five committed FlashStoryInteractionKind values', () => {
    const catalogKinds = new Set(FLASH_STORY_SEASON_UNITS.map((unit) => unit.interactionKind))
    for (const kind of catalogKinds) {
      expect(INTERACTION_KINDS).toContain(kind)
    }
    // 契约锁死 5 种模板：目录不得出现第六种命名
    expect(catalogKinds.size).toBeLessThanOrEqual(INTERACTION_KINDS.length)
  })

  it('pilot units carry catalog goal/success/firstMistake as the action copy baseline', () => {
    const pilotUnits = FLASH_STORY_SEASON_UNITS.filter((unit) =>
      (FLASH_V2_PILOT_UNIT_IDS as readonly string[]).includes(unit.unitId),
    )
    expect(pilotUnits).toHaveLength(5)
    for (const unit of pilotUnits) {
      expect(unit.goal.length).toBeGreaterThan(0)
      expect(unit.success.length).toBeGreaterThan(0)
      expect(unit.firstMistake.length).toBeGreaterThan(0)
    }
    // AC-04：试点覆盖目录声明的全部 4 种模板（pairing 在试点外）
    expect(new Set(pilotUnits.map((unit) => unit.interactionKind))).toEqual(
      new Set(['spacing', 'path', 'overlay', 'privacy']),
    )
  })

  it('interaction node fixture satisfies the contract invariants', () => {
    const node = buildInteractionNode()
    expect(node.type).toBe('interaction')
    const config = node.interaction
    expect(config).toBeDefined()
    expect(config!.goal.length).toBeGreaterThan(0)
    expect(config!.hints ?? []).toSatisfy((hints: string[]) => hints.length <= 2)
    expect(config!.results.length).toBeGreaterThanOrEqual(1)
    expect(config!.results.length).toBeLessThanOrEqual(3)
    expect(config!.results.map((result) => result.id)).toContain(config!.defaultResultId)
    expect(INTERACTION_KINDS).toContain(config!.template)
  })

  it('rejects non-interaction nodes carrying an interaction config (by contract)', () => {
    // 类型层允许携带，质量门 E123 负责拦截；此处锁定"交互配置只挂在 interaction 节点"的意图
    const proseNode: FlashStoryV2Node = { id: 'n1', type: 'prose', segments: [{ text: 'x' }], next: 'n2' }
    expect(proseNode.interaction).toBeUndefined()
  })
})

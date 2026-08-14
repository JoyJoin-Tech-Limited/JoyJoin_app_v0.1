import { describe, expect, it } from 'vitest'
import {
  FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS,
  type FlashFirstActExperienceUnitId,
} from '@joyjoin/shared/alang/flashFirstActExperience'
import { resolveFlashFirstActRuntimeContent } from '../lib/flashFirstActRuntime'

describe('Flash first-act runtime contract', () => {
  it('replaces stale flat or v2 pilot copy with each NPC-specific first act', () => {
    const optionLabels = new Set<string>()
    const responses = new Set<string>()

    for (const [unitId, contract] of Object.entries(FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS)) {
      const stored = unitId === 's1-p1-alang' || unitId === 's1-p1-shiqi'
        ? { v: 2, start: 'old-node', nodes: { 'old-node': { type: 'prose' } } }
        : { opening: 'old opening', question: { id: 'old-question', options: [] } }
      const content = resolveFlashFirstActRuntimeContent(unitId, stored)

      expect(content.v, unitId).not.toBe(2)
      expect(content.opening).toBe(contract.opening)
      expect(content.question.id).toBe(`${unitId}-first-act-response-v1`)
      expect(content.question.options.map((option: { id: string }) => option.id)).toEqual(
        contract.approaches.map((approach) => approach.id),
      )
      expect(content.question.options.map((option: { label: string }) => option.label)).toEqual(
        contract.approaches.map((approach) => approach.label),
      )
      for (const approach of contract.approaches) {
        expect(content.responseByOption[approach.id]).toBe(approach.response)
        expect(optionLabels.has(approach.label), approach.label).toBe(false)
        expect(responses.has(approach.response), approach.response).toBe(false)
        optionLabels.add(approach.label)
        responses.add(approach.response)
      }
    }
  })

  it('does not rewrite unrelated story units', () => {
    const stored = { v: 2, start: 'n1', nodes: {} }
    expect(resolveFlashFirstActRuntimeContent('s1-p2-alang', stored)).toBe(stored)
  })

  it('covers exactly the four rebuilt first acts', () => {
    expect(Object.keys(FLASH_FIRST_ACT_EXPERIENCE_CONTRACTS) as FlashFirstActExperienceUnitId[]).toEqual([
      's1-p1-alang',
      's1-p1-lizi',
      's1-p1-momo',
      's1-p1-shiqi',
    ])
  })
})

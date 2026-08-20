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

  it('rewrites local later template units away from v2 into the shared answer settlement contract', () => {
    const stored = {
      v: 2,
      start: 'n1',
      nodes: {
        n5_close: {
          id: 'n5_close',
          type: 'closure',
          segments: [{ text: '把这段结尾收好。' }],
        },
      },
    }
    const content = resolveFlashFirstActRuntimeContent('s1-p2-alang', stored)

    expect(content.v).not.toBe(2)
    expect(content.question.id).toBe('s1-p2-alang-template-response-v1')
    expect(content.question.options).toHaveLength(2)
    expect(content.responseByOption['s1-p2-alang-template-a']).toBe('把这段结尾收好。')
    expect(content.responseByOption['s1-p2-alang-template-b']).toBe('把这段结尾收好。')
  })

  it('rewrites Atuan later acts away from stale v2 content into the reviewed local-story contract', () => {
    const stored = {
      v: 2,
      start: 'n1_setup',
      nodes: {
        n5_close: {
          id: 'n5_close',
          type: 'closure',
          segments: [{ text: '旧 V2 收尾不应该成为阿团后续幕的运行时合同。' }],
        },
      },
    }

    const second = resolveFlashFirstActRuntimeContent('s1-p2-atuan', stored)
    expect(second.v).not.toBe(2)
    expect(second.opening).toContain('座位图')
    expect(second.question.id).toBe('s1-p2-atuan-template-response-v1')
    expect(second.question.options.map((option: { id: string }) => option.id)).toEqual([
      's1-p2-atuan-template-a',
      's1-p2-atuan-template-b',
    ])
    expect(second.responseByOption['s1-p2-atuan-template-a']).toContain('邀请')
    expect(second.responseByOption['s1-p2-atuan-template-a']).not.toContain('旧 V2')

    const third = resolveFlashFirstActRuntimeContent('s1-p3-atuan', stored)
    expect(third.v).not.toBe(2)
    expect(third.opening).toContain('第六张卡')
    expect(third.question.id).toBe('s1-p3-atuan-template-response-v1')
    expect(third.question.options.map((option: { id: string }) => option.id)).toEqual([
      's1-p3-atuan-template-a',
      's1-p3-atuan-template-b',
    ])
    expect(third.responseByOption['s1-p3-atuan-template-a']).toContain('答案')
    expect(third.responseByOption['s1-p3-atuan-template-a']).not.toContain('旧 V2')
  })

  it('does not rewrite unrelated story units', () => {
    const stored = { v: 2, start: 'n1', nodes: {} }
    expect(resolveFlashFirstActRuntimeContent('season-finale', stored)).toBe(stored)
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

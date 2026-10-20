import { describe, expect, it } from 'vitest'
import {
  buildQuipVotePreview,
  toggleQuipVoteInMap,
} from '../phases/QuipBattleHeroView'

/**
 * Quip pre-submit preview step (sprint icebreaker-polish-p1, contract
 * AC-03⑤): 「你投出 N 票 · 点查看」 expandable 汇总 — the correction path
 * the forward-only swipe stack never had. Locks the pure derivation +
 * toggle semantics behind the UI.
 */
const STACK = [
  {
    prompt: { id: 'p1', promptText: '题目一', category: '脑洞' },
    answer: { userId: 'u1', displayName: '小鹿', answerText: '回答一', promptId: 'p1' },
  },
  {
    prompt: { id: 'p1', promptText: '题目一', category: '脑洞' },
    answer: { userId: 'u2', displayName: '阿澈', answerText: '回答二', promptId: 'p1' },
  },
  {
    prompt: { id: 'p2', promptText: '题目二', category: '自信' },
    answer: { userId: 'u1', displayName: '小鹿', answerText: '回答三', promptId: 'p2' },
  },
]

describe('buildQuipVotePreview', () => {
  it('lists every stack card with its vote state and count', () => {
    const preview = buildQuipVotePreview(STACK, { 'u1::p1': 'p1', 'u1::p2': 'p2' })
    expect(preview.votedCount).toBe(2)
    expect(preview.items.map((i) => [i.key, i.voted])).toEqual([
      ['u1::p1', true],
      ['u2::p1', false],
      ['u1::p2', true],
    ])
    expect(preview.items[0]).toMatchObject({
      promptText: '题目一',
      displayName: '小鹿',
      answerText: '回答一',
      promptId: 'p1',
    })
  })

  it('handles an empty vote map and an empty stack honestly', () => {
    expect(buildQuipVotePreview(STACK, {}).votedCount).toBe(0)
    expect(buildQuipVotePreview([], { 'u1::p1': 'p1' })).toEqual({ votedCount: 0, items: [] })
  })
})

describe('toggleQuipVoteInMap', () => {
  it('adds a missing vote and removes an existing one (immutable)', () => {
    const original = { 'u1::p1': 'p1' }
    const added = toggleQuipVoteInMap(original, 'u2::p1', 'p1')
    expect(added).toEqual({ 'u1::p1': 'p1', 'u2::p1': 'p1' })
    const removed = toggleQuipVoteInMap(added, 'u1::p1', 'p1')
    expect(removed).toEqual({ 'u2::p1': 'p1' })
    // Immutable — the input map is never mutated
    expect(original).toEqual({ 'u1::p1': 'p1' })
  })
})

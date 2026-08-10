import { describe, expect, it } from 'vitest'
import { resolveNPCResponse } from './NPCResponseResolver'

describe('NPCResponseResolver', () => {
  it('combines reviewed server copy with centralized companionship responses', () => {
    const context = { intro: '我们应该没见过。我叫拾柒。', success: '谢谢，三条线对上了。' }
    expect(resolveNPCResponse('s1-p1-shiqi', 'INTRO', context)).toContain('我叫拾柒')
    expect(resolveNPCResponse('s1-p1-shiqi', 'FIRST_MISTAKE', context)).toBe('慢一点。纸没坏，线还在。')
    expect(resolveNPCResponse('s1-p1-shiqi', 'SUCCESS', context)).toContain('谢谢')
  })

  it('keeps all five NPCs distinct through their own mistake response', () => {
    const lines = ['s1-p1-alang', 's1-p1-lizi', 's1-p1-momo', 's1-p1-shiqi', 's1-p1-atuan']
      .map((unitId) => resolveNPCResponse(unitId as any, 'FIRST_MISTAKE', { intro: '' }))
    expect(new Set(lines).size).toBe(5)
  })
})

import { describe, expect, it } from 'vitest'
import { resolveKeepScreenOn } from '../viewModels/keepScreenOnModel'
import type { SessionPhase } from '../phaseUtils'

// P0 打磨 ⑧（2026-10-20）：keepScreenOn 挂会话生命周期，与 moodFieldEnabled
// 解耦。矩阵：waiting/warmup/recap/ended × visible/hidden。
describe('resolveKeepScreenOn (P0 ⑧ — session-lifecycle gate)', () => {
  it.each([
    ['waiting', true, true],
    ['warmup', true, true],
    ['recap', true, true],
    ['ended', true, false],
    ['waiting', false, false],
    ['warmup', false, false],
    ['recap', false, false],
    ['ended', false, false],
  ] as Array<[SessionPhase, boolean, boolean]>)(
    'phase=%s visible=%s → %s',
    (phase, isPageVisible, expected) => {
      expect(resolveKeepScreenOn({ phase, isPageVisible })).toBe(expected)
    },
  )

  it('holds through every playable phase while visible', () => {
    const playable: SessionPhase[] = [
      'micro_challenge',
      'lie_detective',
      'personality_dice',
      'auction',
      'speed_friending',
      'quip_battle',
      'undercover_word',
      'group_mirror',
      'mini_script',
      'phase_selection',
    ]
    for (const phase of playable) {
      expect(resolveKeepScreenOn({ phase, isPageVisible: true })).toBe(true)
      expect(resolveKeepScreenOn({ phase, isPageVisible: false })).toBe(false)
    }
  })

  it('recap keeps the hold (table still watching highlights); only ended releases', () => {
    expect(resolveKeepScreenOn({ phase: 'recap', isPageVisible: true })).toBe(true)
    expect(resolveKeepScreenOn({ phase: 'ended', isPageVisible: true })).toBe(false)
  })
})

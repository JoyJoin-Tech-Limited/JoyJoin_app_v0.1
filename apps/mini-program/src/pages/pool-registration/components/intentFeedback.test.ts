import { describe, expect, it } from 'vitest'
import { getIntentFeedback } from './intentFeedback'
import { INTENT_FLOW_OPTIONS } from '../flowConfig'

// WeChat review posture (🔴): 匹配/社交/灵魂/撮合 never appear in visible
// copy. intent feedback renders directly under the intent picker, so every
// reachable output is locked against the banned set (2026-10-11 purge).
const BANNED = /匹配|社交|灵魂|撮合/

describe('getIntentFeedback', () => {
  it('keeps the deep-chat line in the compliant 帮你找 register', () => {
    expect(getIntentFeedback(['discussion'])).toBe('悦仔会优先帮你找也愿意深聊的桌友。')
  })

  it('records multi-select fallbacks into the sanctioned 活动画像 vocabulary', () => {
    // romance is deliberately absent from COMBO_FEEDBACK — forces the generic fallback.
    const line = getIntentFeedback(['friends', 'romance'])
    expect(line).toContain('活动画像')
    expect(line).not.toMatch(BANNED)
  })

  it('produces banned-word-free copy for every reachable selection', () => {
    const values = INTENT_FLOW_OPTIONS.map((option) => option.value)
    const outputs = new Set<string>()

    outputs.add(getIntentFeedback([]))
    outputs.add(getIntentFeedback(['__unknown__']))
    for (const value of values) {
      outputs.add(getIntentFeedback([value]))
      outputs.add(getIntentFeedback([value, 'flexible']))
    }
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        outputs.add(getIntentFeedback([values[i], values[j]]))
      }
    }
    // A triple exercises the 3-value combo branches.
    outputs.add(getIntentFeedback(['friends', 'networking', 'discussion']))
    outputs.add(getIntentFeedback(['friends', 'fun', 'explore']))

    for (const line of outputs) {
      expect(line).not.toMatch(BANNED)
    }
  })
})

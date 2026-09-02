import { describe, expect, it } from 'vitest'
import { getQuestionMascotPose, resolveSpeechBubble } from './PersonalityTestQuestion'
import { PERSONALITY_TEST_QUESTION_EXPRESSION } from './visuals'
import {
  IDLE_WHISPERS_BY_CATEGORY,
  IDLE_WHISPER_GENERIC,
  IDLE_WHISPER_OVERRIDES,
  resolveIdleWhisper,
} from './idleWhispers'

describe('getQuestionMascotPose', () => {
  it('keeps the original compact curious pose for every question', () => {
    const poses = Array.from({ length: 20 }, (_, index) => getQuestionMascotPose(`question-${index}`))

    expect(poses).toEqual(Array(20).fill(PERSONALITY_TEST_QUESTION_EXPRESSION.choice))
  })
})

describe('resolveSpeechBubble', () => {
  it('prefers commentary over the idle whisper', () => {
    expect(resolveSpeechBubble('好选择', '凭直觉选')).toEqual({ mode: 'commentary', text: '好选择' })
  })

  it('falls back to idle mode when only the whisper is present', () => {
    expect(resolveSpeechBubble(null, '凭直觉选')).toEqual({ mode: 'idle', text: '凭直觉选' })
  })

  it('renders nothing in back-review (whisper suppressed upstream)', () => {
    expect(resolveSpeechBubble(null, null)).toEqual({ mode: 'none', text: '' })
  })
})

describe('resolveIdleWhisper', () => {
  it('uses the per-question override when present', () => {
    expect(resolveIdleWhisper({ id: 'Q_PLAYFUL_SLIDER', category: '能量感知' }))
      .toBe(IDLE_WHISPER_OVERRIDES.Q_PLAYFUL_SLIDER)
  })

  it('acknowledges the slider interaction in the slider override', () => {
    expect(IDLE_WHISPER_OVERRIDES.Q_PLAYFUL_SLIDER).toContain('拖')
  })

  it('is deterministic for the same question id', () => {
    const a = resolveIdleWhisper({ id: 'Q_L1_001', category: '社交启动' })
    const b = resolveIdleWhisper({ id: 'Q_L1_001', category: '社交启动' })
    expect(a).toBe(b)
    expect(IDLE_WHISPERS_BY_CATEGORY['社交启动']).toContain(a)
  })

  it('falls back to the generic pool for unknown categories', () => {
    const line = resolveIdleWhisper({ id: 'Q_UNKNOWN_1', category: '不存在的类目' })
    expect(IDLE_WHISPER_GENERIC).toContain(line)
  })

  it('falls back to the generic pool when category is absent', () => {
    const line = resolveIdleWhisper({ id: 'Q_UNKNOWN_2' })
    expect(IDLE_WHISPER_GENERIC).toContain(line)
  })

  it('keeps every line within copy governance (≤28 chars, no emoji, no banned vocab)', () => {
    const allLines = [
      ...Object.values(IDLE_WHISPERS_BY_CATEGORY).flat(),
      ...Object.values(IDLE_WHISPER_OVERRIDES),
      ...IDLE_WHISPER_GENERIC,
    ]
    const emojiPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u
    for (const line of allLines) {
      expect(line.length).toBeLessThanOrEqual(28)
      expect(line).not.toMatch(emojiPattern)
      expect(line).not.toMatch(/匹配|社交|灵魂|AI|！|!/)
    }
  })
})

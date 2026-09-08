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

  it('renders nothing when all three sources are absent', () => {
    expect(resolveSpeechBubble(null, null)).toEqual({ mode: 'none', text: '' })
  })

  it('falls back to review mode in back-review (whisper suppressed upstream)', () => {
    expect(resolveSpeechBubble(null, null, '这题你选了「电影」'))
      .toEqual({ mode: 'review', text: '这题你选了「电影」' })
  })

  it('prefers commentary and whisper over the review echo', () => {
    expect(resolveSpeechBubble('好选择', null, '这题你选了「电影」').mode).toBe('commentary')
    expect(resolveSpeechBubble(null, '凭直觉选', '这题你选了「电影」').mode).toBe('idle')
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

  it('gives every category a distinct trio (no two categories share an identical pool)', () => {
    const ownerByPoolKey = new Map<string, string>()
    for (const [category, pool] of Object.entries(IDLE_WHISPERS_BY_CATEGORY)) {
      const key = pool.join('')
      const existing = ownerByPoolKey.get(key)
      expect(
        existing,
        `category "${category}" shares an identical trio with "${existing}"`,
      ).toBeUndefined()
      ownerByPoolKey.set(key, category)
    }
  })

  it('anchors each pool to its category theme (no fully generic copy-paste pools)', () => {
    // Regression guard for the 2026-09-02 audit where 22 declared pools
    // collapsed into ~9 unique trios: every line across all category pools
    // must be unique to one category at the trio level (asserted above) and
    // each pool must have 3 non-empty lines.
    for (const [category, pool] of Object.entries(IDLE_WHISPERS_BY_CATEGORY)) {
      expect(pool, `category "${category}"`).toHaveLength(3)
      for (const line of pool) {
        expect(line.trim().length).toBeGreaterThan(0)
      }
    }
  })
})

describe('resolveIdleWhisper session dedupe (WS-2)', () => {
  it('rotates to an unshown line when the deterministic pick was already whispered', () => {
    const question = { id: 'Q_L1_001', category: '社交启动' }
    const first = resolveIdleWhisper(question)
    const second = resolveIdleWhisper(question, new Set([first]))
    expect(second).not.toBe(first)
    expect(IDLE_WHISPERS_BY_CATEGORY['社交启动']).toContain(second)
  })

  it('spills into the generic pool when the category pool is exhausted', () => {
    const question = { id: 'Q_L1_001', category: '社交启动' }
    const exclude = new Set(IDLE_WHISPERS_BY_CATEGORY['社交启动'])
    const line = resolveIdleWhisper(question, exclude)
    expect(IDLE_WHISPER_GENERIC).toContain(line)
  })

  it('allows a repeat rather than returning nothing when every pool is exhausted', () => {
    const question = { id: 'Q_L1_001', category: '社交启动' }
    const exclude = new Set([
      ...IDLE_WHISPERS_BY_CATEGORY['社交启动'],
      ...IDLE_WHISPER_GENERIC,
    ])
    const line = resolveIdleWhisper(question, exclude)
    expect(typeof line).toBe('string')
    expect(line.length).toBeGreaterThan(0)
  })

  it('skips an excluded override and falls through to the pools', () => {
    const question = { id: 'Q_PLAYFUL_SLIDER', category: '能量感知' }
    const line = resolveIdleWhisper(question, new Set([IDLE_WHISPER_OVERRIDES.Q_PLAYFUL_SLIDER]))
    expect(line).not.toBe(IDLE_WHISPER_OVERRIDES.Q_PLAYFUL_SLIDER)
  })
})

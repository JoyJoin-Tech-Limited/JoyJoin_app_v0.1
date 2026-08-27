import { describe, expect, it } from 'vitest'
import { GUIDANCE_TIP_COPY, getGuidanceTipCopy } from '@shared/copy/guidanceCopy'
import { TONE_MODES } from '@shared/copy/toneMap'
import { GUIDANCE_TIP_REGISTRY } from '../registry'

/**
 * Guidance copy contract test (C4 onboarding guidance iteration, 2026-08-27 —
 * sprint-contract.c4-guidance-queue, Maintainability pillar + E1).
 *
 * Locks: copy coverage for every registry copyKey, toneMode metadata,
 * zero-emoji, and the WeChat-review banned-token list
 * (匹配/社交/灵魂/撮合/AI — see AGENTS.md §2 WeChat review posture).
 */

// Broad emoji / pictograph / dingbat / variation-selector ranges. Arrows and
// CJK punctuation are intentionally excluded (they are typography, not emoji).
const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0E}\u{FE0F}\u{200D}]/u

const BANNED_TOKENS = ['匹配', '社交', '灵魂', '撮合', 'AI'] as const

function collectCopyStrings(): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = []
  for (const [key, copy] of Object.entries(GUIDANCE_TIP_COPY)) {
    out.push({ label: `${key}.kicker`, value: copy.kicker })
    out.push({ label: `${key}.dismissLabel`, value: copy.dismissLabel })
    out.push({ label: `${key}.dismissHint`, value: copy.dismissHint })
    copy.rows.forEach((row, index) => {
      out.push({ label: `${key}.rows[${index}].eyebrow`, value: row.eyebrow })
      out.push({ label: `${key}.rows[${index}].line`, value: row.line })
    })
  }
  return out
}

describe('guidance copy coverage', () => {
  it('every registry copyKey has a copy entry', () => {
    for (const tip of GUIDANCE_TIP_REGISTRY) {
      const copy = getGuidanceTipCopy(tip.copyKey)
      expect(copy, `missing copy for ${tip.copyKey}`).toBeDefined()
      expect(copy.copyKey).toBe(tip.copyKey)
    }
  })

  it('every copy entry declares a valid toneMode', () => {
    for (const copy of Object.values(GUIDANCE_TIP_COPY)) {
      expect(TONE_MODES[copy.toneMode], `unknown toneMode ${copy.toneMode}`).toBeDefined()
    }
  })

  it('no copy string is empty', () => {
    for (const { label, value } of collectCopyStrings()) {
      expect(value.trim().length, `${label} must not be empty`).toBeGreaterThan(0)
    }
  })
})

describe('guidance copy brand safety', () => {
  it('contains zero emoji', () => {
    for (const { label, value } of collectCopyStrings()) {
      expect(EMOJI_PATTERN.test(value), `${label} contains emoji: ${value}`).toBe(false)
    }
  })

  it('contains no WeChat-review banned tokens (匹配/社交/灵魂/撮合/AI)', () => {
    for (const { label, value } of collectCopyStrings()) {
      for (const token of BANNED_TOKENS) {
        expect(value.includes(token), `${label} contains banned token 「${token}」: ${value}`).toBe(false)
      }
    }
  })
})

describe('E1 — absorbed arrival coachmark copy preservation', () => {
  it('keeps the legacy kicker and dismiss label byte-for-byte', () => {
    const copy = getGuidanceTipCopy('discover_arrival')
    expect(copy.kicker).toBe('先看看怎么玩')
    expect(copy.dismissLabel).toBe('知道了')
    expect(copy.dismissHint).toBe('轻触收起')
  })

  it('keeps both play-mode explainer rows', () => {
    const copy = getGuidanceTipCopy('discover_arrival')
    expect(copy.rows).toHaveLength(2)
    expect(copy.rows[0].line).toContain('盲盒活动')
    expect(copy.rows[1].line).toContain('街头盲盒')
  })
})

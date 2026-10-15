import { describe, expect, it } from 'vitest'
import {
  INVALID_PROFESSION_MESSAGE,
  OPENING_MESSAGES_ARCHETYPE,
  OPENING_MESSAGES_GENERIC,
  PROFESSION_REACTION_ENTRIES,
  ROTATING_PLACEHOLDERS,
  SKIP_RESPONSE_GENERIC,
  SKIP_RESPONSE_MEMORY,
} from './professionOverlayCopy'

// WeChat review posture (2026-08-18, 🔴): visible copy must carry zero emoji
// and zero 匹配/社交/灵魂/撮合/AI wording. This deck renders verbatim as 悦仔
// chat bubbles inside the profession chat overlay.
const FORBIDDEN_VOCAB = /匹配|社交|灵魂|撮合|AI/
// Broad emoji / pictograph coverage (matches repo guardrail-style checks).
const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u

function expectCleanCopy(text: string) {
  expect(FORBIDDEN_VOCAB.test(text)).toBe(false)
  expect(EMOJI_PATTERN.test(text)).toBe(false)
}

describe('professionOverlayCopy — banned-vocab + emoji cleanliness', () => {
  it('keeps opening messages clean', () => {
    for (const line of OPENING_MESSAGES_GENERIC) expectCleanCopy(line)
    for (const line of OPENING_MESSAGES_ARCHETYPE('开心柯基')) expectCleanCopy(line)
  })

  it('keeps skip / invalid / placeholder copy clean', () => {
    expectCleanCopy(SKIP_RESPONSE_GENERIC)
    expectCleanCopy(SKIP_RESPONSE_MEMORY)
    expectCleanCopy(INVALID_PROFESSION_MESSAGE)
    for (const line of ROTATING_PLACEHOLDERS) expectCleanCopy(line)
  })

  it('keeps every reaction-deck entry clean (keyword + reaction)', () => {
    expect(PROFESSION_REACTION_ENTRIES.length).toBeGreaterThan(0)
    for (const [keyword, reaction] of PROFESSION_REACTION_ENTRIES) {
      expectCleanCopy(keyword)
      expectCleanCopy(reaction)
    }
  })
})

describe('professionOverlayCopy — skip honesty (PM R4)', () => {
  // Skipping the profession question has a real cost: the first 局's 同桌
  // fit gets worse. The skip response must name that cost while keeping the
  // warm exit — a zero-cost "随时补充" promise is dishonest and regresses
  // completion incentive.
  it('skip responses honestly name the first-table cost', () => {
    for (const skipText of [SKIP_RESPONSE_GENERIC, SKIP_RESPONSE_MEMORY]) {
      expect(skipText).toContain('同桌')
      expect(skipText).toContain('局')
    }
  })

  it('skip responses keep the warm 悦仔 exit (no cold refusal)', () => {
    expect(SKIP_RESPONSE_GENERIC.startsWith('好呀')).toBe(true)
    expect(SKIP_RESPONSE_MEMORY).toContain('悦仔')
  })
})

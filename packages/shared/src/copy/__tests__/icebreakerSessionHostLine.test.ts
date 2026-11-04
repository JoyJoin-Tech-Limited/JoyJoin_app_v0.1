import { describe, expect, it } from 'vitest'
import { formatIceWaitingHostLine } from '../icebreakerSession'

// A′ (2026-11-02 host-role Q1): the waiting-room line must say what the host
// identity *means* — 开始与推进由你点按 — because phase advancement is host-only
// and the role is assigned silently to whoever entered the room first.
//
// These tests exist so the two branches can never be merged back into a single
// neutral 「主持人：{name}」 sentence during a future copy pass.

describe('formatIceWaitingHostLine', () => {
  it('tells the host that advancing is theirs to do', () => {
    expect(formatIceWaitingHostLine('阿岚', true)).toBe('主持人：阿岚 · 开始与推进由你点按')
  })

  it('tells players that advancing belongs to someone else', () => {
    expect(formatIceWaitingHostLine('阿岚', false)).toBe('主持人：阿岚 · 开始与推进由主持人点按')
  })

  it('never collapses the two branches into one sentence', () => {
    expect(formatIceWaitingHostLine('阿岚', true)).not.toBe(formatIceWaitingHostLine('阿岚', false))
  })

  it('keeps the display name intact and inside the visible-copy rules', () => {
    const hostLine = formatIceWaitingHostLine('阿岚', true)
    const playerLine = formatIceWaitingHostLine('阿岚', false)

    for (const line of [hostLine, playerLine]) {
      expect(line).toContain('主持人：阿岚')
      // WeChat review posture: event-booking vocabulary only.
      expect(line).not.toMatch(/匹配|社交|灵魂|撮合|AI/)
      // Zero emoji in primary copy.
      expect(line).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
    }
  })
})

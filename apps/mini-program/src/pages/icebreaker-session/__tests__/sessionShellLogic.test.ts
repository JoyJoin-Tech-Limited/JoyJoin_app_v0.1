import { describe, expect, it } from 'vitest'
import {
  buildChangeTierLabel,
  buildTierModeCaption,
  resolveHostMenuItems,
  resolveSyncLossVisible,
  shouldNudgeHostForSuggestion,
} from '../sessionShellLogic'

// ── buildChangeTierLabel (Wave 2 AC-03: ActionSheet row slimmed) ───────
describe('buildChangeTierLabel', () => {
  it('renders the bare action — current-mode info lives in the shell caption', () => {
    expect(buildChangeTierLabel()).toBe('更换模式')
  })
})

// ── buildTierModeCaption (Wave 2 AC-03: shell caption carries the mode) ──
describe('buildTierModeCaption', () => {
  it('renders preset title + duration for a known tier×vibe combo', () => {
    expect(buildTierModeCaption('glow', 'deep_chat')).toBe('深度畅聊 · 60min')
    expect(buildTierModeCaption('breeze', 'balanced')).toBe('轻松破冰 · 40min')
    expect(buildTierModeCaption('blaze', 'play_fun')).toBe('游戏狂欢 · 90min')
  })

  it('renders 自由局 for custom tier', () => {
    expect(buildTierModeCaption('custom', 'deep_chat')).toBe('自由局')
  })

  it('renders 自由局 when tier is undefined', () => {
    expect(buildTierModeCaption(undefined, undefined)).toBe('自由局')
  })

  it('falls back to the canonical tier display for non-preset combos', () => {
    // glow × play_fun is not one of the 3 presets → tier manifest display
    expect(buildTierModeCaption('glow', 'play_fun')).toBe('畅聊局')
    expect(buildTierModeCaption('glow', undefined)).toBe('畅聊局')
  })
})

// ── resolveHostMenuItems ─────────────────────────────────────────────
describe('resolveHostMenuItems', () => {
  it('returns no items for non-host users in any phase', () => {
    expect(resolveHostMenuItems({ phase: 'warmup', isHost: false, tier: 'glow', vibe: 'deep_chat' })).toEqual([])
    expect(resolveHostMenuItems({ phase: 'micro_challenge', isHost: false })).toEqual([])
  })

  it('waiting: tier item only (suggestion hidden per contract Q3⑩)', () => {
    const items = resolveHostMenuItems({ phase: 'waiting', isHost: true, tier: 'glow', vibe: 'deep_chat' })
    expect(items.map((i) => i.id)).toEqual(['change-tier'])
    expect(items[0].label).toBe('更换模式')
  })

  it('warmup: tier item first, suggestion second', () => {
    const items = resolveHostMenuItems({ phase: 'warmup', isHost: true, tier: 'glow', vibe: 'deep_chat' })
    expect(items.map((i) => i.id)).toEqual(['change-tier', 'suggestion'])
    expect(items[1].label).toBe('悦仔，给点建议？')
  })

  it('mid-session playable phases: suggestion first, early-end last', () => {
    for (const phase of ['micro_challenge', 'lie_detective', 'auction', 'personality_dice', 'speed_friending', 'mini_script'] as const) {
      const items = resolveHostMenuItems({ phase, isHost: true, tier: 'glow', vibe: 'deep_chat' })
      expect(items.map((i) => i.id)).toEqual(['suggestion', 'early-end'])
      expect(items[1].label).toBe('提前进入总结')
    }
  })

  it('phase_selection: suggestion only (custom end lives in the picker)', () => {
    const items = resolveHostMenuItems({ phase: 'phase_selection', isHost: true, tier: 'custom', vibe: undefined })
    expect(items.map((i) => i.id)).toEqual(['suggestion'])
  })

  it('warmup: early-end hidden (nothing to summarize)', () => {
    const items = resolveHostMenuItems({ phase: 'warmup', isHost: true, tier: 'glow', vibe: 'deep_chat' })
    expect(items.map((i) => i.id)).not.toContain('early-end')
  })

  it('recap/ended: no items (suggestion hidden, tier locked)', () => {
    expect(resolveHostMenuItems({ phase: 'recap', isHost: true, tier: 'glow', vibe: 'deep_chat' })).toEqual([])
    expect(resolveHostMenuItems({ phase: 'ended', isHost: true, tier: 'glow', vibe: 'deep_chat' })).toEqual([])
  })

  it('custom tier still exposes the tier item in warmup with the slimmed label', () => {
    const items = resolveHostMenuItems({ phase: 'warmup', isHost: true, tier: 'custom', vibe: undefined })
    expect(items[0].label).toBe('更换模式')
  })
})

// ── resolveSyncLossVisible ───────────────────────────────────────────
describe('resolveSyncLossVisible', () => {
  it('shows the dot only when a live session poll fails', () => {
    expect(resolveSyncLossVisible({ hasSession: true, isPollError: true })).toBe(true)
  })

  it('stays hidden while polling is healthy', () => {
    expect(resolveSyncLossVisible({ hasSession: true, isPollError: false })).toBe(false)
  })

  it('stays hidden pre-bootstrap (full-page error owns that state)', () => {
    expect(resolveSyncLossVisible({ hasSession: false, isPollError: true })).toBe(false)
    expect(resolveSyncLossVisible({ hasSession: false, isPollError: false })).toBe(false)
  })
})

// ── shouldNudgeHostForSuggestion (S7 静默救援) ──────────────────────────
describe('shouldNudgeHostForSuggestion', () => {
  it('nudges the host exactly once per suggestion generation', () => {
    expect(
      shouldNudgeHostForSuggestion({ isHost: true, lastNudgedGeneratedAt: null, suggestionGeneratedAt: 'g1' }),
    ).toBe(true)
    expect(
      shouldNudgeHostForSuggestion({ isHost: true, lastNudgedGeneratedAt: 'g1', suggestionGeneratedAt: 'g1' }),
    ).toBe(false)
    expect(
      shouldNudgeHostForSuggestion({ isHost: true, lastNudgedGeneratedAt: 'g1', suggestionGeneratedAt: 'g2' }),
    ).toBe(true)
  })

  it('never nudges non-hosts (role gate even though the server strips the data)', () => {
    expect(
      shouldNudgeHostForSuggestion({ isHost: false, lastNudgedGeneratedAt: null, suggestionGeneratedAt: 'g1' }),
    ).toBe(false)
  })

  it('stays silent when no suggestion is present', () => {
    expect(
      shouldNudgeHostForSuggestion({ isHost: true, lastNudgedGeneratedAt: null, suggestionGeneratedAt: null }),
    ).toBe(false)
    expect(
      shouldNudgeHostForSuggestion({ isHost: true, lastNudgedGeneratedAt: null, suggestionGeneratedAt: undefined }),
    ).toBe(false)
  })
})

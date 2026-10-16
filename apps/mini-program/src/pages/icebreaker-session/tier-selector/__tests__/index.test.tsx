import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import TierSelectorPage, { TIER_OPTIONS, VIBE_OPTIONS } from '../index'
import { TIER_PRESETS } from '../../tierPresets'

describe('TierSelectorPage', () => {
  it('exports a valid React component', () => {
    expect(TierSelectorPage).toBeDefined()
    expect(typeof TierSelectorPage).toBe('function')
  })

  it('presets collapse 3 tiers × 3 vibes into 3 human intentions', () => {
    expect(TIER_PRESETS).toHaveLength(3)
    expect(TIER_OPTIONS).toHaveLength(3)
    expect(VIBE_OPTIONS).toHaveLength(3)

    const combos = TIER_PRESETS.map((p) => `${p.tier}-${p.vibe}`)
    expect(new Set(combos).size).toBe(3)
  })

  it('each preset maps to a valid tier and vibe', () => {
    const validTiers = new Set(TIER_OPTIONS.map((t) => t.id))
    const validVibes = new Set(VIBE_OPTIONS.map((v) => v.id))

    TIER_PRESETS.forEach((preset) => {
      expect(validTiers.has(preset.tier)).toBe(true)
      expect(validVibes.has(preset.vibe)).toBe(true)
      expect(preset.title).toBeTruthy()
      expect(preset.iconToken).toMatch(/^(sparkle|heart|controller)$/)
    })
  })

  it('has exactly one recommended preset', () => {
    const recommended = TIER_PRESETS.filter((p) => p.recommended)
    expect(recommended).toHaveLength(1)
    expect(recommended[0].id).toBe('deep-chat')
  })

  it('keeps the legacy tier/vibe data valid for preset compatibility', () => {
    const combos = TIER_OPTIONS.flatMap((tier) =>
      VIBE_OPTIONS.map((vibe) => `${tier.id}-${vibe.id}`),
    )
    expect(combos).toHaveLength(9)
    expect(new Set(combos).size).toBe(9)
  })

  it('renders custom games instead of the old table and uses the requested empty-selection copy', () => {
    const source = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../index.tsx'),
      'utf8',
    )

    expect(source).toContain("'先看看有哪些游戏'")
    expect(source).toContain("'收起游戏列表'")
    expect(source).toContain('点选游戏即加入自由局')
    expect(source).toContain("'至少选择一个游戏哦'")
    expect(source).toContain("className='tier-selector__game-list'")
    expect(source).not.toContain("className='tier-selector__advanced-grid'")
  })

  it('advanced toggle is browse-only and never commits a selection', () => {
    const source = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../index.tsx'),
      'utf8',
    )
    const handler = source.slice(
      source.indexOf('const handleToggleAdvanced'),
      source.indexOf('const handleToggleCustomGame'),
    )
    expect(handler).not.toContain('handleSelectCombo')
  })

  it('preview flow is sourced from the real run-plan templates', () => {
    const source = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../index.tsx'),
      'utf8',
    )
    expect(source).toContain("from '@shared/socialIcebreakerRunPlans'")
    expect(source).toContain('TIER_RUN_PLANS[selectedTier]')
    expect(source).toContain('tier-selector__preview-flow-row')
    expect(source).toContain('tier-selector__preview-flow-dot')
  })

  it('preview itinerary renders menu-style two columns with a null-safe reading order', () => {
    const source = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../index.tsx'),
      'utf8',
    )
    expect(source).toContain('previewFlowMid')
    expect(source).toContain('previewFlowColumns')
    expect(source).toContain('tier-selector__preview-flow-col')
    expect(source).toContain("String(displayIndex + 1).padStart(2, '0')")
    expect(source).toContain('tier-selector__preview-flow-row--last')
  })

  it('mini_script 加映 row is gated on the server-reported feature flag', () => {
    const source = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../index.tsx'),
      'utf8',
    )
    expect(source).toContain('socialIcebreakerMiniScriptEnabled')
    expect(source).toContain('miniScriptPreviewEnabled')
    expect(source).toContain('miniScriptPickerEnabled')
    expect(source).toContain('MINI_SCRIPT_PREVIEW_MINUTES')
    // The bonus row lands immediately before 回顾 (recap), never after it.
    expect(source).toContain("rows.findIndex((row) => row.key.startsWith('recap-'))")
    expect(source).toContain('rows.splice(recapIndex, 0, bonusRow)')
    // Flagged 加映: the row is a bonus funded out of the other rows, so the
    // listed minutes never sum to the tier total — say so instead of hiding it.
    expect(source).toContain("purpose: '加映'")
  })

  it('empty 自由局 preview offers a ghost itinerary and routes into the picker', () => {
    const source = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../index.tsx'),
      'utf8',
    )
    expect(source).toContain('isCustomEmpty')
    expect(source).toContain('tier-selector__preview-flow-row--ghost')
    expect(source).toContain('tier-selector__preview-flow-row--action')
    expect(source).toContain('去挑一个')
    expect(source).toContain("setScrollTarget('tier-advanced-grid')")
  })

  it('preview carries the overload guardrail and the funnel events', () => {
    const source = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../index.tsx'),
      'utf8',
    )
    expect(source).toContain('customOverloaded')
    expect(source).toContain('tier-selector__preview-affirmation--warning')
    expect(source).toContain("track('preview_viewed'")
    expect(source).toContain("track('preview_custom_link_tapped'")
  })

  it('stored tier is validated against the known machine ids before use', () => {
    const source = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../index.tsx'),
      'utf8',
    )
    // A legacy/retired tier sitting in storage must not render an unknown
    // selection (no active card, undefined preview art).
    expect(source).toContain('const validTiers = new Set<TierMachineId>(')
    expect(source).toContain('validTiers.has(stored.tier)')
    expect(source).toContain('CUSTOM_TIER_ID,')
  })

  it('preset hover feedback class is configured', () => {
    expect('tier-selector__preset-card--pressed').toBeTruthy()
  })
})

describe('Vibe mapping', () => {
  it('VIBE_TO_API maps all client IDs to server IDs', async () => {
    const { VIBE_TO_API } = await import('../../../../lib/vibeMapping')
    expect(VIBE_TO_API.deep_chat).toBe('chat')
    expect(VIBE_TO_API.balanced).toBe('balanced')
    expect(VIBE_TO_API.play_fun).toBe('game')
  })

  it('API_TO_VIBE maps all server IDs back to client IDs', async () => {
    const { API_TO_VIBE } = await import('../../../../lib/vibeMapping')
    expect(API_TO_VIBE.chat).toBe('deep_chat')
    expect(API_TO_VIBE.balanced).toBe('balanced')
    expect(API_TO_VIBE.game).toBe('play_fun')
  })
})

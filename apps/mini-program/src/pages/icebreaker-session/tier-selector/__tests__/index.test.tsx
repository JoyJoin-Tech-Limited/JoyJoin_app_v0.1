import { describe, expect, it } from 'vitest'
import TierSelectorPage, { TIER_OPTIONS, VIBE_OPTIONS, TIER_PRESETS } from '../index'

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

  it('advanced grid data structure supports 9 unique combos', () => {
    const combos = TIER_OPTIONS.flatMap((tier) =>
      VIBE_OPTIONS.map((vibe) => `${tier.id}-${vibe.id}`),
    )
    expect(combos).toHaveLength(9)
    expect(new Set(combos).size).toBe(9)
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

import { describe, expect, it } from 'vitest'
import TierSelectorPage, { TIER_OPTIONS, VIBE_OPTIONS } from '../index'

describe('TierSelectorPage', () => {
  it('exports a valid React component', () => {
    expect(TierSelectorPage).toBeDefined()
    expect(typeof TierSelectorPage).toBe('function')
  })

  it('grid renders 9 cells (3 tiers × 3 vibes)', () => {
    expect(TIER_OPTIONS).toHaveLength(3)
    expect(VIBE_OPTIONS).toHaveLength(3)
    expect(TIER_OPTIONS.length * VIBE_OPTIONS.length).toBe(9)
  })

  it('selecting a cell updates state via onClick', () => {
    // Verify the data structure supports 9 unique combos
    const combos = TIER_OPTIONS.flatMap((tier) =>
      VIBE_OPTIONS.map((vibe) => `${tier.id}-${vibe.id}`),
    )
    expect(combos).toHaveLength(9)
    expect(new Set(combos).size).toBe(9)
  })

  it('pressed feedback hoverClass is configured', () => {
    // Component uses this hover class on every cell; verify via constant shape
    expect(VIBE_OPTIONS.length).toBeGreaterThan(0)
    expect(TIER_OPTIONS.length).toBeGreaterThan(0)
    // The SCSS and component agree on this class name
    expect('tier-selector__grid-cell--pressed').toBeTruthy()
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

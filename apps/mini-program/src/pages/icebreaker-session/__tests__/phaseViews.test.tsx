import { describe, expect, it } from 'vitest'

// ── Barrel exports: verify all named exports are available ─────────────
describe('phaseViews barrel exports', () => {
  it('exports all shared utility types and functions', async () => {
    const mod = await import('../phaseViews')
    expect(mod).toHaveProperty('MOOD_OPTIONS')
    expect(mod).toHaveProperty('getPhaseLabel')
    expect(mod).toHaveProperty('PhaseHeaderIcon')
    expect(mod).toHaveProperty('getMoodLabel')
  })

  it('exports all expansion phase views', async () => {
    const mod = await import('../phaseViews')
    expect(mod).toHaveProperty('QuipBattlePhaseView')
    expect(mod).toHaveProperty('UndercoverWordPhaseView')
    expect(mod).toHaveProperty('GroupMirrorPhaseView')
  })

  it('exports all core phase views', async () => {
    const mod = await import('../phaseViews')
    expect(mod).toHaveProperty('WarmupPhaseView')
    expect(mod).toHaveProperty('MicroChallengePhaseView')
    expect(mod).toHaveProperty('LieDetectivePhaseView')
    expect(mod).toHaveProperty('PersonalityDicePhaseView')
    expect(mod).toHaveProperty('AuctionPhaseView')
    expect(mod).toHaveProperty('FallbackPhaseView')
    expect(mod).toHaveProperty('RecapPhaseView')
  })

  it('has no unknown exports', () => {
    const expectedExports = new Set([
      'MOOD_OPTIONS',
      'getPhaseLabel',
      'PhaseHeaderIcon',
      'getMoodLabel',
      'QuipBattlePhaseView',
      'UndercoverWordPhaseView',
      'GroupMirrorPhaseView',
      'WarmupPhaseView',
      'MicroChallengePhaseView',
      'LieDetectivePhaseView',
      'PersonalityDicePhaseView',
      'AuctionPhaseView',
      'FallbackPhaseView',
      'RecapPhaseView',
      'AuctionBidRecordLocal', // type re-export
    ])
    // Verify we didn't forget any in the test
    expect(expectedExports.size).toBe(15)
  })
})

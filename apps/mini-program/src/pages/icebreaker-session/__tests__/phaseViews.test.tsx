import { describe, expect, it } from 'vitest'
import * as mod from '../phaseViews'

// ── Barrel exports: verify all named exports are available ─────────────
describe('phaseViews barrel exports', () => {
  it('exports all shared utility types and functions', () => {
    expect(mod).toHaveProperty('MOOD_OPTIONS')
    expect(mod).toHaveProperty('getPhaseLabel')
    expect(mod).toHaveProperty('PhaseHeaderIcon')
    expect(mod).toHaveProperty('getMoodLabel')
  })

  it('exports all phase views (PhaseHeroCard visual system)', () => {
    expect(mod).toHaveProperty('WarmupPhaseView')
    expect(mod).toHaveProperty('MicroChallengeHeroView')
    expect(mod).toHaveProperty('LieDetectiveHeroView')
    expect(mod).toHaveProperty('PersonalityDiceHeroView')
    expect(mod).toHaveProperty('SpeedFriendingHeroView')
    expect(mod).toHaveProperty('QuipBattleHeroView')
    expect(mod).toHaveProperty('UndercoverWordHeroView')
    expect(mod).toHaveProperty('GroupMirrorHeroView')
    expect(mod).toHaveProperty('AuctionHeroView')
    expect(mod).toHaveProperty('MiniScriptHeroView')
    expect(mod).toHaveProperty('FallbackPhaseView')
    expect(mod).toHaveProperty('RecapPhaseView')
  })

  it('has no unknown exports', () => {
    const expectedExports = new Set([
      'MOOD_OPTIONS',
      'getPhaseLabel',
      'PhaseHeaderIcon',
      'getMoodLabel',
      'WarmupPhaseView',
      'MicroChallengeHeroView',
      'LieDetectiveHeroView',
      'PersonalityDiceHeroView',
      'SpeedFriendingHeroView',
      'QuipBattleHeroView',
      'UndercoverWordHeroView',
      'GroupMirrorHeroView',
      'AuctionHeroView',
      'MiniScriptHeroView',
      'FallbackPhaseView',
      'RecapPhaseView',
    ])
    expect(expectedExports.size).toBe(16)
  })
})

import { beforeAll, describe, expect, it } from 'vitest'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import type { SessionParticipant } from '../phaseUtils'
import type { SocialIcebreakerPhase } from '@shared/socialIcebreaker'

/**
 * Pure-logic extraction of buildArchetypeMixText from WarmupPhaseView.tsx
 * Tests the archetype-counting and label-generation logic without React render.
 */
function buildArchetypeMixText(participants: SessionParticipant[]): string {
  const counts = new Map<string, number>()
  for (const p of participants) {
    if (p.archetype) {
      counts.set(p.archetype, (counts.get(p.archetype) ?? 0) + 1)
    }
  }
  if (counts.size === 0) return ''

  const segments: string[] = []
  for (const [id, count] of counts) {
    const def = ARCHETYPE_BY_ID[id]
    const name = def?.nameCn ?? id
    segments.push(count > 1 ? `${name}×${count}` : name)
  }
  return segments.join('、')
}

// ── buildArchetypeMixText ──────────────────────────────────────────────
describe('buildArchetypeMixText (WarmupPhaseView logic)', () => {
  it('returns empty string for empty participants', () => {
    expect(buildArchetypeMixText([])).toBe('')
  })

  it('returns empty string when no participant has archetype', () => {
    const participants: SessionParticipant[] = [
      { userId: 'u1', displayName: '小明' },
      { userId: 'u2', displayName: '小红' },
    ]
    expect(buildArchetypeMixText(participants)).toBe('')
  })

  it('returns archetype name for single participant', () => {
    // corgi = 社牛柯基 in the archetype registry
    const participants: SessionParticipant[] = [
      { userId: 'u1', archetype: 'corgi' },
    ]
    const result = buildArchetypeMixText(participants)
    expect(result).toBe('社牛柯基')
  })

  it('shows count for repeated archetypes', () => {
    const participants: SessionParticipant[] = [
      { userId: 'u1', archetype: 'corgi' },
      { userId: 'u2', archetype: 'corgi' },
      { userId: 'u3', archetype: 'corgi' },
    ]
    const result = buildArchetypeMixText(participants)
    expect(result).toBe('社牛柯基×3')
  })

  it('joins multiple archetypes with Chinese enumeration comma', () => {
    const participants: SessionParticipant[] = [
      { userId: 'u1', archetype: 'corgi' },
      { userId: 'u2', archetype: 'fox' },
    ]
    const result = buildArchetypeMixText(participants)
    expect(result).toContain('、')
    expect(result).toContain('社牛柯基')
    expect(result).toContain('寻宝狐')
  })

  it('falls back to archetype ID when name not found in registry', () => {
    const participants: SessionParticipant[] = [
      { userId: 'u1', archetype: 'unknown_12345' },
    ]
    const result = buildArchetypeMixText(participants)
    expect(result).toBe('unknown_12345')
  })

  it('skips participants without archetype', () => {
    const participants: SessionParticipant[] = [
      { userId: 'u1', archetype: 'corgi' },
      { userId: 'u2' }, // no archetype
      { userId: 'u3', archetype: 'owl' },
    ]
    const result = buildArchetypeMixText(participants)
    expect(result).toContain('社牛柯基')
    expect(result).toContain('好奇猫头鹰')
    expect(result.split('、')).toHaveLength(2)
  })
})

// ── getNextPhase (from shared) ─────────────────────────────────────────
describe('getNextPhase (shared socialIcebreaker)', () => {
  // Import dynamically to verify shared alias works
  let getNextPhase: (current: SocialIcebreakerPhase, enabledPhases: SocialIcebreakerPhase[]) => SocialIcebreakerPhase

  beforeAll(async () => {
    const mod = await import('@shared/socialIcebreaker')
    getNextPhase = mod.getNextPhase
  })

  it('returns next phase in enabled list', () => {
    const phases: SocialIcebreakerPhase[] = ['warmup', 'micro_challenge', 'recap']
    expect(getNextPhase('warmup', phases)).toBe('micro_challenge')
  })

  it('returns recap when at end of list', () => {
    const phases: SocialIcebreakerPhase[] = ['warmup', 'micro_challenge', 'recap']
    expect(getNextPhase('micro_challenge', phases)).toBe('recap')
  })

  it('returns recap when current phase is last', () => {
    const phases: SocialIcebreakerPhase[] = ['warmup', 'recap']
    expect(getNextPhase('recap', phases)).toBe('recap')
  })

  it('returns recap when current phase not in list', () => {
    const phases: SocialIcebreakerPhase[] = ['warmup']
    expect(getNextPhase('unknown' as SocialIcebreakerPhase, phases)).toBe('recap')
  })

  it('works with empty enabled phases', () => {
    expect(getNextPhase('warmup', [])).toBe('recap')
  })
})

// ── getNextEligiblePhase (from shared) ─────────────────────────────────
describe('getNextEligiblePhase (shared socialIcebreaker)', () => {
  let getNextEligiblePhase: (...args: any[]) => SocialIcebreakerPhase

  beforeAll(async () => {
    const mod = await import('@shared/socialIcebreaker')
    getNextEligiblePhase = mod.getNextEligiblePhase
  })

  it('skips phases that require more players (legacy overload)', () => {
    const phases: SocialIcebreakerPhase[] = ['warmup', 'lie_detective', 'personality_dice', 'recap']
    // lie_detective requires 3 players, personality_dice requires 2
    // with 2 players, should skip lie_detective
    expect(getNextEligiblePhase('warmup', phases, 2)).toBe('personality_dice')
  })

  it('includes phases when enough players (legacy overload)', () => {
    const phases: SocialIcebreakerPhase[] = ['warmup', 'lie_detective', 'recap']
    // lie_detective requires 3 players
    expect(getNextEligiblePhase('warmup', phases, 4)).toBe('lie_detective')
  })

  it('returns recap when no later phase is eligible', () => {
    const phases: SocialIcebreakerPhase[] = ['lie_detective', 'recap']
    // lie_detective requires 3 players, with only 1 player no phase eligible
    expect(getNextEligiblePhase('warmup', phases, 1)).toBe('recap')
  })

  it('state overload skips phases with insufficient players', () => {
    const state = {
      enabledPhases: ['warmup', 'lie_detective', 'personality_dice', 'recap'] as SocialIcebreakerPhase[],
      playerCount: 2,
    }
    expect(getNextEligiblePhase('warmup', state)).toBe('personality_dice')
  })

  it('state overload works with default enabled phases', () => {
    const state = {
      playerCount: 4,
    }
    // Default enabled phases include warmup → micro_challenge → lie_detective → personality_dice
    const result = getNextEligiblePhase('warmup', state)
    expect(result).toBe('micro_challenge')
  })

  it('state overload with runPlan uses plan order', () => {
    const state = {
      playerCount: 4,
      runPlan: {
        segments: [
          { phase: 'lie_detective' },
          { phase: 'personality_dice' },
          { phase: 'recap' },
        ],
      },
    }
    // All phases in runPlan allow 4 players, so should return next one
    const result = getNextEligiblePhase('lie_detective', state)
    expect(result).toBe('personality_dice')
  })
})

import { beforeAll, describe, expect, it } from 'vitest'
import type { SocialIcebreakerPhase } from '@shared/socialIcebreaker'
import type { SessionParticipant } from '../phaseUtils'
import {
  buildArchetypeMixText,
  buildWelcomeLine,
  buildWelcomeSegments,
  buildCelebrationLine,
  buildCTAState,
  buildWarmupCaption,
  getWarmupCardState,
  countArchetypes,
} from '../viewModels/warmupViewModels'

// ── getWarmupCardState ─────────────────────────────────────────────
describe('getWarmupCardState', () => {
  const base = {
    topics: [],
    currentIndex: 0,
    isHost: true,
    isGeneratingTopics: false,
    topicsError: false,
  }

  it('returns host_no_topics for empty topics when host', () => {
    expect(getWarmupCardState(base)).toBe('host_no_topics')
  })

  it('returns player_no_topics for empty topics when player', () => {
    expect(getWarmupCardState({ ...base, isHost: false })).toBe('player_no_topics')
  })

  it('returns generating when generating flag is true', () => {
    expect(getWarmupCardState({ ...base, isGeneratingTopics: true })).toBe('generating')
  })

  it('returns error when topicsError is true', () => {
    expect(
      getWarmupCardState({
        ...base,
        topics: [{ question: 'q' } as any],
        topicsError: true,
      }),
    ).toBe('error')
  })

  it('returns topic_card when topics exist and index is in range', () => {
    expect(
      getWarmupCardState({
        ...base,
        topics: [{ question: 'q' } as any],
      }),
    ).toBe('topic_card')
  })

  it('returns topic_card when topics exist even if index is beyond range', () => {
    expect(
      getWarmupCardState({
        ...base,
        topics: [{ question: 'q' } as any],
        currentIndex: 1,
      }),
    ).toBe('topic_card')
  })
})

// ── buildArchetypeMixText ──────────────────────────────────────────
describe('buildArchetypeMixText', () => {
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
    const participants: SessionParticipant[] = [{ userId: 'u1', archetype: 'corgi' }]
    expect(buildArchetypeMixText(participants)).toBe('社牛柯基')
  })

  it('shows count for repeated archetypes', () => {
    const participants: SessionParticipant[] = [
      { userId: 'u1', archetype: 'corgi' },
      { userId: 'u2', archetype: 'corgi' },
      { userId: 'u3', archetype: 'corgi' },
    ]
    expect(buildArchetypeMixText(participants)).toBe('社牛柯基×3')
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
})

// ── countArchetypes ────────────────────────────────────────────────
describe('countArchetypes', () => {
  it('orders by count descending, then join order', () => {
    const participants: SessionParticipant[] = [
      { userId: 'u1', archetype: 'fox' },
      { userId: 'u2', archetype: 'corgi' },
      { userId: 'u3', archetype: 'corgi' },
    ]
    const result = countArchetypes(participants)
    expect(result.map((r) => r.id)).toEqual(['corgi', 'fox'])
    expect(result[0].count).toBe(2)
    expect(result[1].count).toBe(1)
  })
})

// ── buildWelcomeLine / buildWelcomeSegments ────────────────────────
describe('buildWelcomeLine', () => {
  it('fallback when no participants or no archetypes', () => {
    expect(buildWelcomeLine([])).toBe('先到先聊，抽张话题卡暖暖场')
  })

  it('1-person variant', () => {
    const participants: SessionParticipant[] = [{ userId: 'u1', archetype: 'corgi' }]
    expect(buildWelcomeLine(participants)).toBe('今晚是社牛柯基的试玩时间')
  })

  it('all-same variant', () => {
    const participants: SessionParticipant[] = [
      { userId: 'u1', archetype: 'corgi' },
      { userId: 'u2', archetype: 'corgi' },
    ]
    expect(buildWelcomeLine(participants)).toBe('一桌子社牛柯基，先抽张卡暖暖场')
  })

  it('two-archetype variant', () => {
    const participants: SessionParticipant[] = [
      { userId: 'u1', archetype: 'corgi' },
      { userId: 'u2', archetype: 'fox' },
    ]
    expect(buildWelcomeLine(participants)).toBe('社牛柯基和寻宝狐的小桌，先抽张卡暖暖场')
  })

  it('three-plus-archetype variant', () => {
    const participants: SessionParticipant[] = [
      { userId: 'u1', archetype: 'corgi' },
      { userId: 'u2', archetype: 'fox' },
      { userId: 'u3', archetype: 'owl' },
    ]
    expect(buildWelcomeLine(participants)).toBe('社牛柯基、寻宝狐和伙伴们的小桌，先抽张卡暖暖场')
  })
})

describe('buildWelcomeSegments', () => {
  it('tags accent archetype for colored rendering', () => {
    const segments = buildWelcomeSegments([{ userId: 'u1', archetype: 'corgi' }])
    expect(segments).toEqual([
      { text: '今晚是' },
      { text: '社牛柯基', accentArchetype: 'corgi' },
      { text: '的试玩时间' },
    ])
  })
})

// ── buildCelebrationLine ─────────────────────────────────────────────
describe('buildCelebrationLine', () => {
  it('includes archetype mix when available', () => {
    expect(buildCelebrationLine('社牛柯基×2、寻宝狐')).toBe(
      '气氛组集结完毕：社牛柯基×2、寻宝狐',
    )
  })

  it('falls back to plain celebration when mix is empty', () => {
    expect(buildCelebrationLine()).toBe('气氛组集结完毕')
  })
})

// ── buildCTAState ────────────────────────────────────────────────────
describe('buildCTAState', () => {
  it('not ready: primary = 我准备好了', () => {
    const state = buildCTAState(false, false, false, false)
    expect(state.primary).toBe('我准备好了')
    expect(state.secondaryVisible).toBe(false)
    expect(state.showCancel).toBe(false)
  })

  it('ready but not everyone: primary = 已准备 with cancel', () => {
    const state = buildCTAState(true, false, false, false)
    expect(state.primary).toBe('已准备')
    expect(state.showCancel).toBe(true)
  })

  it('host, everyone ready, not last: primary = 已准备, secondary visible', () => {
    const state = buildCTAState(true, true, true, false)
    expect(state.primary).toBe('已准备')
    expect(state.secondaryVisible).toBe(true)
  })

  it('host, everyone ready, last: primary = 本轮结束', () => {
    const state = buildCTAState(true, true, true, true)
    expect(state.primary).toBe('本轮结束')
    expect(state.secondaryVisible).toBe(false)
    expect(state.showCancel).toBe(false)
  })
})

// ── buildWarmupCaption ─────────────────────────────────────────────
describe('buildWarmupCaption', () => {
  it('custom mode returns 自由局', () => {
    expect(buildWarmupCaption(undefined, 'custom', true)).toBe('自由局')
  })

  it('deep_chat glow preset', () => {
    expect(buildWarmupCaption('deep_chat', 'glow', false)).toBe('深度畅聊 · 约60分钟')
  })

  it('balanced breeze preset', () => {
    expect(buildWarmupCaption('balanced', 'breeze', false)).toBe('轻松破冰 · 约40分钟')
  })

  it('play_fun blaze preset', () => {
    expect(buildWarmupCaption('play_fun', 'blaze', false)).toBe('游戏狂欢 · 约90分钟')
  })
})

// ── getNextPhase (from shared) ─────────────────────────────────────────
describe('getNextPhase (shared socialIcebreaker)', () => {
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

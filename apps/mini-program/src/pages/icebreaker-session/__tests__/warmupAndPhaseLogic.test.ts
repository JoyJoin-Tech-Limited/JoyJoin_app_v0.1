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
  shouldRetryWarmupTopics,
  classifyTopicsFailure,
  getTopicsServerRetryDelayMs,
  TOPICS_SERVER_RETRY_BACKOFF_MS,
  countArchetypes,
  getDepthSealColors,
  shouldShowPermissionLine,
  computeEmberSeats,
  diffReadyUserIds,
  buildEmberIgnitionQueue,
  seedLitUserIds,
  computeEmberAccent,
  resolveEmberHalo,
  isBraveTopic,
  getDepthCornerText,
  EMBER_MAX_SEATS,
  EMBER_IGNITION_STAGGER_MS,
  EMBER_IGNITION_BATCH_THRESHOLD,
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

  it('does not let a stale request error hide topics that arrived through polling', () => {
    expect(
      getWarmupCardState({
        ...base,
        topics: [{ question: 'q' } as any],
        topicsError: true,
      }),
    ).toBe('topic_card')
  })

  it('returns error when generation failed and no topics are available', () => {
    expect(getWarmupCardState({ ...base, topicsError: true })).toBe('error')
  })

  it('returns recovering while a transient-failure auto-retry is in flight', () => {
    expect(
      getWarmupCardState({
        ...base,
        topicsRecovery: { attempt: 1, maxAttempts: 3 },
      }),
    ).toBe('recovering')
  })

  it('generating wins over recovering while the retry request is executing', () => {
    expect(
      getWarmupCardState({
        ...base,
        isGeneratingTopics: true,
        topicsRecovery: { attempt: 2, maxAttempts: 3 },
      }),
    ).toBe('generating')
  })

  it('recovering wins over the terminal error flag but never over real topics', () => {
    expect(
      getWarmupCardState({
        ...base,
        topicsError: true,
        topicsRecovery: { attempt: 3, maxAttempts: 3 },
      }),
    ).toBe('recovering')
    expect(
      getWarmupCardState({
        ...base,
        topics: [{ question: 'q' } as any],
        topicsRecovery: { attempt: 1, maxAttempts: 3 },
      }),
    ).toBe('topic_card')
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

describe('classifyTopicsFailure (2026-07-28 502 incident)', () => {
  it('treats 5xx as transient server failures (gateway/restart)', () => {
    expect(classifyTopicsFailure(Object.assign(new Error('Request failed with status 502'), { statusCode: 502 }))).toBe('server')
    expect(classifyTopicsFailure(Object.assign(new Error('Request failed with status 500'), { statusCode: 500 }))).toBe('server')
    expect(classifyTopicsFailure(Object.assign(new Error('Request failed with status 503'), { statusCode: 503 }))).toBe('server')
  })

  it('treats bare network/timeout failures (no statusCode) as transient', () => {
    expect(classifyTopicsFailure(new Error('request:fail timeout'))).toBe('server')
    expect(classifyTopicsFailure({})).toBe('server')
    expect(classifyTopicsFailure(null)).toBe('server')
  })

  it('treats 4xx as a real rejection — terminal error card, no patient retry', () => {
    expect(classifyTopicsFailure(Object.assign(new Error('Request failed with status 400'), { statusCode: 400 }))).toBe('generic')
    expect(classifyTopicsFailure(Object.assign(new Error('Request failed with status 403'), { statusCode: 403 }))).toBe('generic')
  })
})

describe('getTopicsServerRetryDelayMs', () => {
  it('walks the backoff ladder by 1-based attempt and clamps at the top rung', () => {
    expect(getTopicsServerRetryDelayMs(1)).toBe(2000)
    expect(getTopicsServerRetryDelayMs(2)).toBe(5000)
    expect(getTopicsServerRetryDelayMs(3)).toBe(10000)
    expect(getTopicsServerRetryDelayMs(4)).toBe(10000)
    expect(getTopicsServerRetryDelayMs(0)).toBe(2000)
    expect(TOPICS_SERVER_RETRY_BACKOFF_MS).toHaveLength(3)
  })
})

describe('shouldRetryWarmupTopics', () => {
  it('retries a failed host topic request after polling connectivity recovers', () => {
    expect(shouldRetryWarmupTopics({
      isHost: true,
      topicsError: true,
      syncLost: false,
      topicCount: 0,
      selectedMood: 'relaxed',
      pendingAction: null,
      retryCount: 0,
    })).toBe(true)
  })

  it('does not retry while disconnected or after the bounded retry budget', () => {
    const base = {
      isHost: true,
      topicsError: true,
      topicCount: 0,
      selectedMood: 'relaxed' as const,
      pendingAction: null,
    }
    expect(shouldRetryWarmupTopics({ ...base, syncLost: true, retryCount: 0 })).toBe(false)
    expect(shouldRetryWarmupTopics({ ...base, syncLost: false, retryCount: 2 })).toBe(false)
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
    expect(state.primaryAction).toBe('toggle_ready')
    expect(state.secondaryVisible).toBe(false)
    expect(state.showCancel).toBe(false)
  })

  it('ready but not everyone: highlighted primary toggles ready off', () => {
    const state = buildCTAState(true, false, false, false)
    expect(state.primary).toBe('已准备 · 点按取消')
    expect(state.primaryAction).toBe('toggle_ready')
    expect(state.showCancel).toBe(false)
  })

  it('host, everyone ready, not last: primary advances to the next topic', () => {
    const state = buildCTAState(true, true, true, false)
    expect(state.primary).toBe('进入下一题')
    expect(state.primaryAction).toBe('next_topic')
    expect(state.secondaryVisible).toBe(false)
    expect(state.showCancel).toBe(true)
  })

  it('host, everyone ready, last: primary = 本轮结束', () => {
    const state = buildCTAState(true, true, true, true)
    expect(state.primary).toBe('本轮结束')
    expect(state.primaryAction).toBe('advance_phase')
    expect(state.secondaryVisible).toBe(false)
    expect(state.showCancel).toBe(true)
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

// ── getDepthSealColors (Campfire Vault Card PR1, contract B2) ───────────────
describe('getDepthSealColors', () => {
  it('returns null for missing depth level', () => {
    expect(getDepthSealColors(undefined)).toBeNull()
    expect(getDepthSealColors(null)).toBeNull()
  })

  it('returns null for out-of-range depth level', () => {
    expect(getDepthSealColors(0)).toBeNull()
    expect(getDepthSealColors(4)).toBeNull()
  })

  it('L1 seal is blue with deep variant and rgba border/fill', () => {
    expect(getDepthSealColors(1)).toEqual({
      accent: '#5B8DB8',
      deep: '#3D6E9C',
      borderColor: 'rgba(91, 141, 184, 0.3)',
      backgroundColor: 'rgba(91, 141, 184, 0.1)',
    })
  })

  it('L2 seal is purple', () => {
    expect(getDepthSealColors(2)).toEqual({
      accent: '#8B5CF6',
      deep: '#7C3AED',
      borderColor: 'rgba(139, 92, 246, 0.3)',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
    })
  })

  it('L3 seal is gold', () => {
    expect(getDepthSealColors(3)).toEqual({
      accent: '#C99A3C',
      deep: '#8A651A',
      borderColor: 'rgba(201, 154, 60, 0.3)',
      backgroundColor: 'rgba(201, 154, 60, 0.1)',
    })
  })
})

// ── shouldShowPermissionLine (Campfire Vault Card PR1, contract C6) ─────────
describe('shouldShowPermissionLine', () => {
  const line = '这题没有标准答案，说一半也算数'

  it('hidden when topic or line is missing', () => {
    expect(shouldShowPermissionLine(null, 0)).toBe(false)
    expect(shouldShowPermissionLine(undefined, 0)).toBe(false)
    expect(shouldShowPermissionLine({ depthLevel: 3, permissionLine: null }, 0)).toBe(false)
    expect(shouldShowPermissionLine({ depthLevel: 3, permissionLine: '   ' }, 0)).toBe(false)
  })

  it('visible on the first card regardless of depth', () => {
    expect(shouldShowPermissionLine({ depthLevel: 1, permissionLine: line }, 0)).toBe(true)
    expect(shouldShowPermissionLine({ permissionLine: line }, 0)).toBe(true)
  })

  it('visible for depthLevel >= 2 beyond the first card', () => {
    expect(shouldShowPermissionLine({ depthLevel: 2, permissionLine: line }, 1)).toBe(true)
    expect(shouldShowPermissionLine({ depthLevel: 3, permissionLine: line }, 2)).toBe(true)
  })

  it('hidden for depthLevel 1 beyond the first card', () => {
    expect(shouldShowPermissionLine({ depthLevel: 1, permissionLine: line }, 1)).toBe(false)
    expect(shouldShowPermissionLine({ permissionLine: line }, 3)).toBe(false)
  })
})

// ─── Campfire Vault Card PR2 — Ember Rim (contract E1 / E2 / S2 / S3) ───────
describe('computeEmberSeats', () => {
  it('returns no seats for 0 members', () => {
    expect(computeEmberSeats(0)).toEqual([])
  })

  it('1 member → a single centered top seat', () => {
    expect(computeEmberSeats(1)).toEqual([{ edge: 'top', leftPercent: 50 }])
  })

  it('2 members → one centered seat per edge', () => {
    expect(computeEmberSeats(2)).toEqual([
      { edge: 'top', leftPercent: 50 },
      { edge: 'bottom', leftPercent: 50 },
    ])
  })

  it('4 members → 2 top + 2 bottom seats at the insets', () => {
    const seats = computeEmberSeats(4)
    expect(seats).toHaveLength(4)
    expect(seats.filter((s) => s.edge === 'top')).toHaveLength(2)
    expect(seats.filter((s) => s.edge === 'bottom')).toHaveLength(2)
    expect(seats.map((s) => s.leftPercent)).toEqual([12, 88, 12, 88])
  })

  it('6 members → 3 top + 3 bottom seats, centered middle seat', () => {
    const seats = computeEmberSeats(6)
    expect(seats).toHaveLength(6)
    expect(seats.filter((s) => s.edge === 'top')).toHaveLength(3)
    expect(seats.filter((s) => s.edge === 'bottom')).toHaveLength(3)
    expect(seats.map((s) => s.leftPercent)).toEqual([12, 50, 88, 12, 50, 88])
  })

  it('8 members → 4 top + 4 bottom seats', () => {
    const seats = computeEmberSeats(8)
    expect(seats).toHaveLength(8)
    expect(seats.filter((s) => s.edge === 'top')).toHaveLength(4)
    expect(seats.filter((s) => s.edge === 'bottom')).toHaveLength(4)
  })

  it('is deterministic — identical output across calls', () => {
    for (const count of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(computeEmberSeats(count)).toEqual(computeEmberSeats(count))
    }
  })

  it('all seats sit on the border band within the corner insets', () => {
    for (const count of [1, 2, 4, 6, 8]) {
      for (const seat of computeEmberSeats(count)) {
        expect(['top', 'bottom']).toContain(seat.edge)
        expect(seat.leftPercent).toBeGreaterThanOrEqual(12)
        expect(seat.leftPercent).toBeLessThanOrEqual(88)
      }
    }
  })

  it('no duplicate positions on the same edge', () => {
    for (const count of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const seats = computeEmberSeats(count)
      for (const edge of ['top', 'bottom'] as const) {
        const positions = seats.filter((s) => s.edge === edge).map((s) => s.leftPercent)
        expect(new Set(positions).size).toBe(positions.length)
      }
    }
  })

  it('caps at EMBER_MAX_SEATS for oversized rosters', () => {
    expect(computeEmberSeats(12)).toHaveLength(EMBER_MAX_SEATS)
    expect(computeEmberSeats(100)).toHaveLength(EMBER_MAX_SEATS)
  })

  it('guards negative and fractional counts', () => {
    expect(computeEmberSeats(-3)).toEqual([])
    expect(computeEmberSeats(4.9)).toHaveLength(4)
  })
})

describe('diffReadyUserIds', () => {
  it('detects newly ready ids as ignited', () => {
    expect(diffReadyUserIds(['u1'], ['u1', 'u2'])).toEqual({
      ignited: ['u2'],
      extinguished: [],
    })
  })

  it('detects un-ready ids as extinguished', () => {
    expect(diffReadyUserIds(['u1', 'u2'], ['u1'])).toEqual({
      ignited: [],
      extinguished: ['u2'],
    })
  })

  it('detects mixed changes in one cycle', () => {
    expect(diffReadyUserIds(['u1', 'u2'], ['u2', 'u3'])).toEqual({
      ignited: ['u3'],
      extinguished: ['u1'],
    })
  })

  it('dedupes across cycles — identical sets produce no work', () => {
    expect(diffReadyUserIds(['u1', 'u2'], ['u1', 'u2'])).toEqual({
      ignited: [],
      extinguished: [],
    })
  })

  it('self-heals missed cycles — diff is against the last applied set', () => {
    // Cycle missed u2; next diff against prev=[u1] surfaces both u2 and u3.
    expect(diffReadyUserIds(['u1'], ['u1', 'u2', 'u3']).ignited).toEqual(['u2', 'u3'])
  })
})

describe('buildEmberIgnitionQueue', () => {
  it('excludes the viewer (self ignites optimistically)', () => {
    const queue = buildEmberIgnitionQueue(['u1', 'u2'], { excludeUserId: 'u1' })
    expect(queue.items).toEqual([{ userId: 'u2', delayMs: 0 }])
  })

  it('dedupes repeated ids', () => {
    const queue = buildEmberIgnitionQueue(['u1', 'u1', 'u1'])
    expect(queue.items).toEqual([{ userId: 'u1', delayMs: 0 }])
  })

  it('staggers ≤2 ignitions ≥120ms apart', () => {
    const queue = buildEmberIgnitionQueue(['u1', 'u2'])
    expect(queue.mode).toBe('staggered')
    expect(queue.items).toEqual([
      { userId: 'u1', delayMs: 0 },
      { userId: 'u2', delayMs: EMBER_IGNITION_STAGGER_MS },
    ])
    expect(EMBER_IGNITION_STAGGER_MS).toBeGreaterThanOrEqual(120)
  })

  it('batch-ignites when >2 arrive in one cycle', () => {
    const queue = buildEmberIgnitionQueue(['u1', 'u2', 'u3'])
    expect(queue.mode).toBe('batch')
    expect(queue.items).toHaveLength(3)
    expect(queue.items.every((item) => item.delayMs === 0)).toBe(true)
    expect(queue.items.length).toBeGreaterThan(EMBER_IGNITION_BATCH_THRESHOLD)
  })

  it('empty input produces an empty staggered queue', () => {
    expect(buildEmberIgnitionQueue([])).toEqual({ mode: 'staggered', items: [] })
  })
})

describe('seedLitUserIds', () => {
  const participants: SessionParticipant[] = [
    { userId: 'u1', archetype: 'corgi' },
    { userId: 'u2', archetype: 'fox' },
  ]

  it('keeps only ready ids that are on the roster', () => {
    expect(seedLitUserIds(['u1', 'u2', 'ghost'], participants)).toEqual(['u1', 'u2'])
  })

  it('dedupes repeated ready ids', () => {
    expect(seedLitUserIds(['u1', 'u1'], participants)).toEqual(['u1'])
  })

  it('returns empty for empty ready list or roster', () => {
    expect(seedLitUserIds([], participants)).toEqual([])
    expect(seedLitUserIds(['u1'], [])).toEqual([])
  })
})

describe('computeEmberAccent', () => {
  it('returns rgba strings (WeChat drops hsla)', () => {
    const accent = computeEmberAccent('corgi')
    expect(accent.fill).toMatch(/^rgba\(\d+, \d+, \d+, 1\)$/)
    expect(accent.glow).toMatch(/^rgba\(\d+, \d+, \d+, 0\.45\)$/)
    expect(accent.glowFade).toMatch(/^rgba\(\d+, \d+, \d+, 0\)$/)
    expect(accent.fill.slice(0, accent.fill.lastIndexOf(','))).toBe(
      accent.glow.slice(0, accent.glow.lastIndexOf(',')),
    )
  })

  it('missing archetype falls back to the neutral brand purple', () => {
    const missing = computeEmberAccent(undefined)
    const unknown = computeEmberAccent('not_an_archetype')
    expect(missing).toEqual(unknown)
    expect(missing.fill).toMatch(/^rgba\(\d+, \d+, \d+, 1\)$/)
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

// ── resolveEmberHalo (audit B2 / C2 / C3) ──────────────────────────
describe('resolveEmberHalo', () => {
  const base = {
    isTopicCard: true,
    dataReady: true,
    indexChanged: false,
    everyoneReady: false,
    consumed: false,
    firstEval: true,
    reduceMotion: false,
  }

  it('not a topic card → off, refs untouched', () => {
    const r = resolveEmberHalo({ ...base, isTopicCard: false })
    expect(r.decision).toBe('off')
    expect(r.nextConsumed).toBe(false)
    expect(r.nextFirstEval).toBe(true)
  })

  it('C3 — no ready-state data yet → no-op, firstEval NOT consumed', () => {
    const r = resolveEmberHalo({ ...base, dataReady: false, everyoneReady: true })
    expect(r.decision).toBeNull()
    expect(r.nextConsumed).toBe(false)
    expect(r.nextFirstEval).toBe(true)
  })

  it('mount with everyone already ready → static, no swell replay (S3)', () => {
    const r = resolveEmberHalo({ ...base, everyoneReady: true })
    expect(r.decision).toBe('static')
    expect(r.nextConsumed).toBe(true)
    expect(r.nextFirstEval).toBe(false)
  })

  it('mount with not-ready → off, and firstEval IS consumed (B2)', () => {
    const r = resolveEmberHalo({ ...base, everyoneReady: false })
    expect(r.decision).toBe('off')
    expect(r.nextConsumed).toBe(false)
    expect(r.nextFirstEval).toBe(false)
  })

  it('B2 — live transition not-ready → all-ready plays the climax swell', () => {
    // First data-bearing evaluation: nobody ready.
    const first = resolveEmberHalo({ ...base, everyoneReady: false })
    expect(first.decision).toBe('off')
    // Later poll: everyone ready. Must be 'playing', never 'static'.
    const second = resolveEmberHalo({
      ...base,
      everyoneReady: true,
      consumed: first.nextConsumed,
      firstEval: first.nextFirstEval,
    })
    expect(second.decision).toBe('playing')
    expect(second.nextConsumed).toBe(true)
  })

  it('H4 — the same all-ready moment never replays (second cycle → no-op)', () => {
    const r = resolveEmberHalo({
      ...base,
      everyoneReady: true,
      consumed: true,
      firstEval: false,
    })
    expect(r.decision).toBeNull()
    expect(r.nextConsumed).toBe(true)
  })

  it('reduced motion always settles to the static glow (G1)', () => {
    const r = resolveEmberHalo({
      ...base,
      everyoneReady: true,
      firstEval: false,
      reduceMotion: true,
    })
    expect(r.decision).toBe('static')
  })

  it('C2 — topic change clears the halo AND re-arms it for the new card', () => {
    const r = resolveEmberHalo({
      ...base,
      indexChanged: true,
      everyoneReady: true,
      consumed: true,
      firstEval: false,
    })
    expect(r.decision).toBe('off')
    expect(r.nextConsumed).toBe(false)
  })

  it('C2 — after re-arm, an all-ready new topic plays the halo again', () => {
    const rearm = resolveEmberHalo({
      ...base,
      indexChanged: true,
      everyoneReady: true,
      consumed: true,
      firstEval: false,
    })
    const next = resolveEmberHalo({
      ...base,
      indexChanged: false,
      everyoneReady: true,
      consumed: rearm.nextConsumed,
      firstEval: rearm.nextFirstEval,
    })
    expect(next.decision).toBe('playing')
  })

  it('not-ready re-arms a consumed halo', () => {
    const r = resolveEmberHalo({
      ...base,
      everyoneReady: false,
      consumed: true,
      firstEval: false,
    })
    expect(r.decision).toBe('off')
    expect(r.nextConsumed).toBe(false)
  })
})

// ── isBraveTopic (audit C4, contract A1) ───────────────────────────
describe('isBraveTopic', () => {
  it('reflective safety → brave', () => {
    expect(isBraveTopic({ safety: 'reflective' })).toBe(true)
  })

  it('C4 — depth level alone does NOT make a card brave', () => {
    // The pre-fix predicate fired for every L2+ card; contract A1 limits
    // brave to server-flagged reflective safety only.
    expect(isBraveTopic({ safety: 'open' })).toBe(false)
    expect(isBraveTopic({ safety: 'gentle' })).toBe(false)
  })

  it('missing topic / missing safety → not brave', () => {
    expect(isBraveTopic(null)).toBe(false)
    expect(isBraveTopic(undefined)).toBe(false)
    expect(isBraveTopic({})).toBe(false)
  })
})

// ── getDepthCornerText (audit P1 — keepsake seal parity) ───────────
describe('getDepthCornerText', () => {
  it('deep_chat renders the unspaced keepsake form 深度·L{n}', () => {
    expect(getDepthCornerText('deep_chat', 2)).toBe('深度·L2')
    expect(getDepthCornerText('deep_chat', 1)).toBe('深度·L1')
    expect(getDepthCornerText('deep_chat', 3)).toBe('深度·L3')
  })

  it('play_fun hides the seal', () => {
    expect(getDepthCornerText('play_fun', 2)).toBeNull()
  })

  it('no vibe / no depth → null', () => {
    expect(getDepthCornerText(undefined, 2)).toBeNull()
    expect(getDepthCornerText('deep_chat', null)).toBeNull()
    expect(getDepthCornerText('deep_chat', undefined)).toBeNull()
  })
})

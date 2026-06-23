import { describe, expect, it } from 'vitest'
import type { SocialSessionState } from '@shared/socialIcebreaker'
import {
  normaliseSession,
  getUserDisplayName,
  getUserArchetype,
  getUserInterests,
  getErrorText,
  deriveParticipants,
  buildSocialPath,
  type IcebreakerSession,
} from '../icebreakerSessionModel'

function mockSession(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'ss-001',
    icebreakerSessionId: 'is-001',
    currentPhase: 'warmup',
    hostUserId: 'host-1',
    hostDisplayName: '主持人',
    playerCount: 4,
    phaseStartedAt: 1700000000000,
    sessionStartedAt: 1700000000000,
    completedPhases: [],
    ...overrides,
  }
}

// ── normaliseSession ──────────────────────────────────────────────────
describe('normaliseSession', () => {
  it('copies session state and adds id + phase alias', () => {
    const state = mockSession({ currentPhase: 'warmup' })
    const result = normaliseSession(state)

    expect(result.id).toBe('ss-001')
    expect(result.socialSessionId).toBe('ss-001')
    expect(result.phase).toBe('warmup')
    expect(result.currentPhase).toBe('warmup')
  })

  it('maps phase to currentPhase value', () => {
    const state = mockSession({ currentPhase: 'recap' })
    const result = normaliseSession(state)
    expect(result.phase).toBe('recap')
  })

  it('preserves all original state fields', () => {
    const state = mockSession({
      warmupTopics: [{ id: 't1', question: 'Q?', mood: 'funny', emoji: '😄' }],
      warmupReadyUserIds: ['u1', 'u2'],
    })
    const result = normaliseSession(state)
    expect(result.warmupTopics).toHaveLength(1)
    expect(result.warmupReadyUserIds).toEqual(['u1', 'u2'])
  })
})

// ── getUserDisplayName ────────────────────────────────────────────────
describe('getUserDisplayName', () => {
  it('returns displayName when present', () => {
    expect(getUserDisplayName({ displayName: '小明' })).toBe('小明')
  })

  it('returns nickname when displayName is empty string', () => {
    expect(getUserDisplayName({ displayName: '', nickname: '小花' })).toBe('小花')
  })

  it('returns nickname when displayName is whitespace only', () => {
    expect(getUserDisplayName({ displayName: '   ', nickname: '小花' })).toBe('小花')
  })

  it('returns nickname when displayName is missing', () => {
    expect(getUserDisplayName({ nickname: '小花' })).toBe('小花')
  })

  it('returns fallback when both displayName and nickname are empty', () => {
    expect(getUserDisplayName({ displayName: '', nickname: '' })).toBe('参与者')
  })

  it('returns fallback for undefined user', () => {
    expect(getUserDisplayName(undefined)).toBe('参与者')
  })

  it('returns fallback for empty object', () => {
    expect(getUserDisplayName({})).toBe('参与者')
  })

  it('prefers displayName over nickname when both present', () => {
    expect(getUserDisplayName({ displayName: '小红', nickname: '小花' })).toBe('小红')
  })
})

// ── getUserArchetype ───────────────────────────────────────────────────
describe('getUserArchetype', () => {
  it('returns archetype when present', () => {
    expect(getUserArchetype({ archetype: 'corgi' })).toBe('corgi')
  })

  it('returns primaryArchetype when archetype is missing', () => {
    expect(getUserArchetype({ primaryArchetype: 'fox' })).toBe('fox')
  })

  it('prefers archetype over primaryArchetype', () => {
    expect(getUserArchetype({ archetype: 'owl', primaryArchetype: 'fox' })).toBe('owl')
  })

  it('returns undefined for empty archetype', () => {
    expect(getUserArchetype({ archetype: '' })).toBeUndefined()
  })

  it('returns undefined for whitespace archetype', () => {
    expect(getUserArchetype({ archetype: '   ' })).toBeUndefined()
  })

  it('returns undefined for undefined user', () => {
    expect(getUserArchetype(undefined)).toBeUndefined()
  })

  it('returns undefined for user with no archetype fields', () => {
    expect(getUserArchetype({})).toBeUndefined()
  })
})

// ── getUserInterests ───────────────────────────────────────────────────
describe('getUserInterests', () => {
  it('returns interestsRankedTop3 when present', () => {
    expect(getUserInterests({ interestsRankedTop3: ['gaming', 'cooking'] })).toEqual([
      'gaming',
      'cooking',
    ])
  })

  it('falls back to interests when interestsRankedTop3 missing', () => {
    expect(getUserInterests({ interests: ['travel', 'music'] })).toEqual(['travel', 'music'])
  })

  it('falls back to topInterests when others missing', () => {
    expect(getUserInterests({ topInterests: ['film'] })).toEqual(['film'])
  })

  it('filters out empty strings', () => {
    expect(
      getUserInterests({ interestsRankedTop3: ['gaming', '', '  ', 'cooking'] }),
    ).toEqual(['gaming', 'cooking'])
  })

  it('filters out non-string entries', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getUserInterests({ interests: [null, 42, 'music'] } as any)).toEqual(['music'])
  })

  it('returns empty array for undefined user', () => {
    expect(getUserInterests(undefined)).toEqual([])
  })

  it('returns empty array for user with no interest fields', () => {
    expect(getUserInterests({})).toEqual([])
  })
})

// ── getErrorText ───────────────────────────────────────────────────────
describe('getErrorText', () => {
  it('returns error message for Error instance', () => {
    expect(getErrorText(new Error('网络错误'), '默认错误')).toBe('网络错误')
  })

  it('returns fallback for non-Error value', () => {
    expect(getErrorText('something went wrong', '默认错误')).toBe('默认错误')
  })

  it('returns fallback for Error with empty message', () => {
    expect(getErrorText(new Error(''), '默认错误')).toBe('默认错误')
  })

  it('returns fallback for Error with whitespace message', () => {
    expect(getErrorText(new Error('   '), '默认错误')).toBe('默认错误')
  })

  it('returns fallback for null', () => {
    expect(getErrorText(null, '默认错误')).toBe('默认错误')
  })

  it('returns fallback for undefined', () => {
    expect(getErrorText(undefined, '默认错误')).toBe('默认错误')
  })
})

// ── deriveParticipants ─────────────────────────────────────────────────
describe('deriveParticipants', () => {
  it('uses joinedParticipants when present in session', () => {
    const session: IcebreakerSession = {
      ...normaliseSession(mockSession()),
      joinedParticipants: [
        { userId: 'u1', displayName: '小明', isActive: true },
        { userId: 'u2', displayName: '小红', isActive: false },
      ],
    }
    const result = deriveParticipants(session, [], 'u1')
    expect(result).toHaveLength(2)
    expect(result[0].userId).toBe('u1')
    expect(result[0].isHost).toBe(true)
    expect(result[0].displayName).toBe('小明')
    expect(result[1].userId).toBe('u2')
    expect(result[1].isHost).toBe(false)
  })

  it('enriches joinedParticipants with roster details', () => {
    const session: IcebreakerSession = {
      ...normaliseSession(mockSession()),
      joinedParticipants: [
        { userId: 'u1', displayName: '小明' },
      ],
    }
    const roster = [{ userId: 'u1', archetype: 'corgi', interests: ['gaming', 'cooking'] }]
    const result = deriveParticipants(session, roster)
    expect(result[0].archetype).toBe('corgi')
    expect(result[0].interests).toEqual(['gaming', 'cooking'])
  })

  it('falls back to roster when no joinedParticipants', () => {
    const session: IcebreakerSession = normaliseSession(mockSession())
    const roster = [
      { userId: 'u1', displayName: '小明', archetype: 'fox' },
      { userId: 'u2', displayName: '小红' },
    ]
    const result = deriveParticipants(session, roster, 'u2')
    expect(result).toHaveLength(2)
    expect(result[1].isHost).toBe(true)
  })

  it('filters out non-string interests from roster', () => {
    const session: IcebreakerSession = normaliseSession(mockSession())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roster = [{ userId: 'u1', interests: ['gaming', null, 123, 'music'] }] as any
    const result = deriveParticipants(session, roster)
    expect(result[0].interests).toEqual(['gaming', 'music'])
  })

  it('constructs participants from phase data when no roster or joinedParticipants', () => {
    const session: IcebreakerSession = {
      ...normaliseSession(mockSession({ hostUserId: 'host-1' })),
      lieDetectivePlayers: [
        { userId: 'u1', displayName: '小明', statements: [] },
        { userId: 'u2', displayName: '小红', statements: [] },
      ],
      warmupReadyUserIds: ['u1'],
      personalityDiceChallenges: [
        {
          userId: 'u3',
          displayName: '小刚',
          dominantTrait: 'O',
          challengeTitle: '',
          challengeBody: '',
          challengeEmoji: '',
          difficulty: 'easy',
        },
      ],
    }
    const result = deriveParticipants(session, [], 'host-1')
    // u1, u2 from lieDetectivePlayers, u3 from personalityDiceChallenges, host-1 from hostId
    expect(result.map((p) => p.userId).sort()).toEqual(['host-1', 'u1', 'u2', 'u3'])
  })

  it('marks host correctly for user matching hostId', () => {
    const session: IcebreakerSession = {
      ...normaliseSession(mockSession()),
      lieDetectivePlayers: [{ userId: 'u1', displayName: '小明', statements: [] }],
    }
    const result = deriveParticipants(session, [], 'u1')
    expect(result[0].isHost).toBe(true)
  })
})

// ── buildSocialPath ────────────────────────────────────────────────────
describe('buildSocialPath', () => {
  it('returns base path when no suffix', () => {
    expect(buildSocialPath('abc-123')).toBe('/api/social-icebreaker/abc-123')
  })

  it('appends suffix to base path', () => {
    expect(buildSocialPath('abc-123', '/warmup/topics')).toBe(
      '/api/social-icebreaker/abc-123/warmup/topics',
    )
  })

  it('encodes special characters in session ID', () => {
    expect(buildSocialPath('session with spaces')).toBe(
      '/api/social-icebreaker/session%20with%20spaces',
    )
  })

  it('handles empty suffix', () => {
    expect(buildSocialPath('xyz', '')).toBe('/api/social-icebreaker/xyz')
  })
})

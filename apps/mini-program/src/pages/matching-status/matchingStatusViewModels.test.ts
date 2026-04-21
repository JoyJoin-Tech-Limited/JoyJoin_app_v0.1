import { describe, expect, it } from 'vitest'
import type { PoolGroupSummary, PoolRegistrationSummary } from '@shared/api'
import type { EventThemeTitleRevealedData } from '@shared/wsEvents'
import {
  getMatchingStatusScreenState,
  resolveMatchingStatusAuthBootstrap,
  resolvePersistedThemeSummary,
} from './matchingStatusViewModels'

function baseGroup(overrides: Partial<PoolGroupSummary> = {}): PoolGroupSummary {
  return {
    id: 'g1',
    groupNumber: 1,
    memberCount: 4,
    ...overrides,
  }
}

function baseRegistration(overrides: Partial<PoolRegistrationSummary> = {}): PoolRegistrationSummary {
  return {
    id: 'r1',
    poolId: 'p1',
    ...overrides,
  }
}

const wsReveal: EventThemeTitleRevealedData = {
  poolId: 'p1',
  groupId: 'g1',
  eventThemeTitle: 'WS 主题',
  themeTagline: 'WS 副标题',
  themeEmoji: '🎭',
  themeHighlights: ['a', 'b'],
  themeVibe: 'playful',
}

describe('resolvePersistedThemeSummary', () => {
  it('prefers WebSocket theme reveal over group and registration', () => {
    const result = resolvePersistedThemeSummary({
      themeRevealData: wsReveal,
      group: baseGroup({ theme: 'Group 主题', themeEmoji: '🍜' }),
      registration: baseRegistration({ theme: 'Reg 主题', themeEmoji: '🥟' }),
    })
    expect(result).toEqual({
      title: 'WS 主题',
      subtitle: 'WS 副标题',
      emoji: '🎭',
      vibe: 'playful',
      highlights: ['a', 'b'],
    })
  })

  it('merges group over registration when there is no WS payload', () => {
    const result = resolvePersistedThemeSummary({
      themeRevealData: null,
      group: baseGroup({
        theme: 'Group',
        subtitle: 'Sub G',
        themeEmoji: '🍜',
        vibe: 'professional',
        highlights: ['x'],
      }),
      registration: baseRegistration({
        theme: 'Reg',
        subtitle: 'Sub R',
        themeEmoji: '🥟',
        vibe: 'creative',
        highlights: ['y'],
      }),
    })
    expect(result).toMatchObject({
      title: 'Group',
      subtitle: 'Sub G',
      emoji: '🍜',
      vibe: 'professional',
      highlights: ['x'],
    })
  })

  it('falls back to registration when group has no theme fields', () => {
    const result = resolvePersistedThemeSummary({
      themeRevealData: undefined,
      group: baseGroup({ theme: null, themeEmoji: null }),
      registration: baseRegistration({
        theme: '仅报名',
        themeEmoji: '🎯',
        highlights: ['  ok  ', ''],
      }),
    })
    expect(result).toMatchObject({
      title: '仅报名',
      emoji: '🎯',
      highlights: ['  ok  '],
    })
  })

  it('returns null when there is no title or emoji from any source', () => {
    expect(
      resolvePersistedThemeSummary({
        themeRevealData: null,
        group: baseGroup({ theme: null, themeEmoji: null }),
        registration: baseRegistration({ theme: null, themeEmoji: null }),
      }),
    ).toBeNull()
  })

  it('caps and filters highlights to four non-empty strings', () => {
    const result = resolvePersistedThemeSummary({
      themeRevealData: null,
      group: baseGroup({
        theme: 'T',
        highlights: ['1', '2', '3', '4', '5', '  '],
      }),
      registration: undefined,
    })
    expect(result?.highlights).toEqual(['1', '2', '3', '4'])
  })
})

describe('getMatchingStatusScreenState', () => {
  it('keeps unresolved registration bootstrap in loading state', () => {
    expect(
      getMatchingStatusScreenState({
        hasRegistrationId: true,
        isRegistrationUnresolved: true,
        hasFetchError: false,
        registration: undefined,
        isCancelled: false,
        isNoMatchState: false,
      }),
    ).toEqual({ kind: 'loading' })
  })

  it('shows not-found only after the registration query resolves without data', () => {
    expect(
      getMatchingStatusScreenState({
        hasRegistrationId: true,
        isRegistrationUnresolved: false,
        hasFetchError: false,
        registration: undefined,
        isCancelled: false,
        isNoMatchState: false,
      }),
    ).toEqual({ kind: 'not-found' })
  })

  it('surfaces fetch errors separately from missing-registration state', () => {
    expect(
      getMatchingStatusScreenState({
        hasRegistrationId: true,
        isRegistrationUnresolved: false,
        hasFetchError: true,
        registration: undefined,
        isCancelled: false,
        isNoMatchState: false,
      }),
    ).toEqual({ kind: 'error' })
  })

  it('keeps explicit terminal registration states after a successful resolve', () => {
    expect(
      getMatchingStatusScreenState({
        hasRegistrationId: true,
        isRegistrationUnresolved: false,
        hasFetchError: false,
        registration: baseRegistration(),
        isCancelled: true,
        isNoMatchState: false,
      }),
    ).toMatchObject({ kind: 'cancelled', registration: { id: 'r1' } })

    expect(
      getMatchingStatusScreenState({
        hasRegistrationId: true,
        isRegistrationUnresolved: false,
        hasFetchError: false,
        registration: baseRegistration(),
        isCancelled: false,
        isNoMatchState: true,
      }),
    ).toMatchObject({ kind: 'no-match', registration: { id: 'r1' } })
  })
})

describe('resolveMatchingStatusAuthBootstrap', () => {
  it('falls back to cached auth user while the hook is still settling', () => {
    const authState = resolveMatchingStatusAuthBootstrap({
      authUser: undefined,
      cachedAuthUser: { id: 'cached-user' },
      authLoading: true,
    })

    expect(authState).toEqual({
      effectiveAuthUser: { id: 'cached-user' },
      isAuthBootstrapPending: false,
    })
  })

  it('keeps bootstrap pending only when no live or cached auth user exists', () => {
    expect(
      resolveMatchingStatusAuthBootstrap({
        authUser: undefined,
        cachedAuthUser: undefined,
        authLoading: true,
      }),
    ).toEqual({
      effectiveAuthUser: undefined,
      isAuthBootstrapPending: true,
    })
  })
})

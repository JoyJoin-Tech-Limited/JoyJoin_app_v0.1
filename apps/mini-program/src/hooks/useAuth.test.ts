import { describe, expect, it } from 'vitest'
import { deriveMiniProgramAuthState } from './auth/authState'
import type { AuthUser } from './useAuth'

function createAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-123',
    nextStep: 'discover',
    ...overrides,
  } as AuthUser
}

describe('deriveMiniProgramAuthState', () => {
  // Once we have a cached user (object or null), background refetch must NOT
  // gate the UI — or the page gets stuck on "悦仔正在赶来…" after foreground.
  it('does not block UI on background refetch when cached user exists', () => {
    expect(
      deriveMiniProgramAuthState({
        user: createAuthUser(),
        isLoading: false,
        isFetching: true,
      })
    ).toEqual({
      user: createAuthUser(),
      isLoading: false,
      isAuthenticated: true,
      nextStep: 'discover',
    })
  })

  it('fails closed while fetching when no data has ever arrived', () => {
    expect(
      deriveMiniProgramAuthState({
        user: undefined,
        isLoading: false,
        isFetching: true,
      })
    ).toEqual({
      user: undefined,
      isLoading: true,
      isAuthenticated: false,
      nextStep: undefined,
    })
  })

  it('returns the authenticated user once the fetch has settled', () => {
    const user = createAuthUser({ nextStep: 'discover' })

    expect(
      deriveMiniProgramAuthState({
        user,
        isLoading: false,
        isFetching: false,
      })
    ).toEqual({
      user,
      isLoading: false,
      isAuthenticated: true,
      nextStep: 'discover',
    })
  })

  it('returns a settled guest state when no authenticated user exists', () => {
    expect(
      deriveMiniProgramAuthState({
        user: null,
        isLoading: false,
        isFetching: false,
      })
    ).toEqual({
      user: undefined,
      isLoading: false,
      isAuthenticated: false,
      nextStep: undefined,
    })
  })

  it('does not block UI on background refetch when unauthenticated (null user)', () => {
    expect(
      deriveMiniProgramAuthState({
        user: null,
        isLoading: false,
        isFetching: true,
      })
    ).toEqual({
      user: undefined,
      isLoading: false,
      isAuthenticated: false,
      nextStep: undefined,
    })
  })
})
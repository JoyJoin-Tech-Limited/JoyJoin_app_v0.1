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
  // Guards against regression: foreground auth refresh still fails closed,
  // but dependent queries can keep using the cached user metadata.
  it('preserves cached user metadata while auth is being refetched', () => {
    expect(
      deriveMiniProgramAuthState({
        user: createAuthUser(),
        isLoading: false,
        isFetching: true,
      })
    ).toEqual({
      user: createAuthUser(),
      isLoading: true,
      isAuthenticated: false,
      nextStep: 'discover',
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
})
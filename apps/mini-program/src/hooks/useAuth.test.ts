import { describe, expect, it } from 'vitest'
import { deriveMiniProgramAuthState } from './authState'
import type { AuthUser } from './useAuth'

function createAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-123',
    nextStep: 'discover',
    ...overrides,
  }
}

describe('deriveMiniProgramAuthState', () => {
  // Guards against regression: foreground auth refresh must not trust stale
  // cached auth data while the session revalidation request is in flight.
  it('fails closed while an authenticated cache entry is being refetched', () => {
    expect(
      deriveMiniProgramAuthState({
        user: createAuthUser(),
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
    const user = createAuthUser({ nextStep: 'guide' })

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
      nextStep: 'guide',
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
import { describe, expect, it } from 'vitest'
import { deriveMiniProgramAuthState } from './authState'
import type { AuthUser } from './useAuth'

function createAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-123',
    nextStep: 'discover',
    ...overrides,
  } as AuthUser
}

describe('deriveMiniProgramAuthState', () => {
  it('reports a blocking load while the initial auth bootstrap is pending', () => {
    expect(
      deriveMiniProgramAuthState({
        user: undefined,
        isLoading: true,
        isFetching: true,
      })
    ).toEqual({
      user: undefined,
      isLoading: true,
      isRefreshing: false,
      isAuthenticated: false,
      nextStep: undefined,
    })
  })

  // Guards against regression: public pages should not fall back to a global
  // loading state during foreground auth refresh, but guarded pages can still
  // treat `isRefreshing` as fail-closed.
  it('preserves cached user metadata while auth is being refetched', () => {
    expect(
      deriveMiniProgramAuthState({
        user: createAuthUser(),
        isLoading: false,
        isFetching: true,
      })
    ).toEqual({
      user: createAuthUser(),
      isLoading: false,
      isRefreshing: true,
      isAuthenticated: true,
      nextStep: 'discover',
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
      isRefreshing: false,
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
      isRefreshing: false,
      isAuthenticated: false,
      nextStep: undefined,
    })
  })

  it('returns a settled guest state during guest auth refreshes', () => {
    expect(
      deriveMiniProgramAuthState({
        user: null,
        isLoading: false,
        isFetching: true,
      })
    ).toEqual({
      user: undefined,
      isLoading: false,
      isRefreshing: true,
      isAuthenticated: false,
      nextStep: undefined,
    })
  })
})
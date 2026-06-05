import type { OnboardingStep } from '../../lib/api/api'

interface MiniProgramAuthUser {
  nextStep?: OnboardingStep | null
}

export interface MiniProgramAuthStateInput<TUser extends MiniProgramAuthUser = MiniProgramAuthUser> {
  user: TUser | null | undefined
  isLoading: boolean
  isFetching: boolean
}

export interface DerivedMiniProgramAuthState<TUser extends MiniProgramAuthUser = MiniProgramAuthUser> {
  user: TUser | undefined
  isLoading: boolean
  isAuthenticated: boolean
  nextStep: OnboardingStep | undefined
}

export function deriveMiniProgramAuthState<TUser extends MiniProgramAuthUser>(
  input: MiniProgramAuthStateInput<TUser>
): DerivedMiniProgramAuthState<TUser> {
  const user = input.user ?? undefined
  // `user === null` means GET /api/auth/user settled as unauthenticated — do not treat
  // background refetch (`isFetching`) as a full-app loading gate, or the index / gates
  // stay on "悦仔正在赶来…" until refetch completes (and can hang forever on timeout).
  // Only "fail closed" while fetching when we have no data yet (`undefined`).
  // Once we have any settled value (object or null), trust the cache.
  const isAuthPending =
    input.isLoading || (input.isFetching && input.user === undefined)

  if (isAuthPending) {
    return {
      user,
      isLoading: true,
      isAuthenticated: false,
      nextStep: user?.nextStep ?? undefined,
    }
  }

  return {
    user,
    isLoading: false,
    isAuthenticated: !!user,
    nextStep: user?.nextStep ?? undefined,
  }
}

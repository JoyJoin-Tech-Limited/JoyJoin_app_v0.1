import type { OnboardingStep } from '../lib/api'

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
  isRefreshing: boolean
  isAuthenticated: boolean
  nextStep: OnboardingStep | undefined
}

export function deriveMiniProgramAuthState<TUser extends MiniProgramAuthUser>(
  input: MiniProgramAuthStateInput<TUser>
): DerivedMiniProgramAuthState<TUser> {
  const user = input.user ?? undefined
  const isInitialLoad = input.isLoading
  const isRefreshing = !isInitialLoad && input.isFetching

  if (isInitialLoad) {
    return {
      user,
      isLoading: true,
      isRefreshing: false,
      isAuthenticated: !!user,
      nextStep: user?.nextStep ?? undefined,
    }
  }

  return {
    user,
    isLoading: false,
    isRefreshing,
    isAuthenticated: !!user,
    nextStep: user?.nextStep ?? undefined,
  }
}

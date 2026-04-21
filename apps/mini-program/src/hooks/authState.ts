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
  isAuthenticated: boolean
  nextStep: OnboardingStep | undefined
}

export function deriveMiniProgramAuthState<TUser extends MiniProgramAuthUser>(
  input: MiniProgramAuthStateInput<TUser>
): DerivedMiniProgramAuthState<TUser> {
  const user = input.user ?? undefined
  const isAuthPending = input.isLoading || input.isFetching

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

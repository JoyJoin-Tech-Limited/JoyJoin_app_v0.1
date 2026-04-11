import { useMemo } from 'react'
import {
  buildOnboardingProgress,
  nextStepToOnboardingStep,
  type ActiveOnboardingStep,
} from '@shared/onboarding'
import { useAuth } from './useAuth'
import { nextStepToRoute } from './useAuthGuard'

export interface MiniProgramOnboardingFlowState {
  currentStep: ActiveOnboardingStep
  currentRoute: string
  source: 'signed-out' | 'server-next-step' | 'missing-next-step'
  totalSteps: number
  progress: number
  isComplete: boolean
  steps: {
    personalityTest: boolean
    essentialData: boolean
    extendedData: boolean
    profileReview: boolean
  }
}

export function useOnboardingOrchestrator() {
  const auth = useAuth()

  const onboarding = useMemo<MiniProgramOnboardingFlowState>(() => {
    if (!auth.user) {
      const progress = buildOnboardingProgress(undefined)
      return {
        ...progress,
        currentRoute: '/pages/login/index',
        source: 'signed-out',
      }
    }

    const progress = buildOnboardingProgress(auth.user)
    return {
      ...progress,
      currentStep: nextStepToOnboardingStep(auth.user.nextStep),
      currentRoute: nextStepToRoute(auth.user.nextStep),
      source: auth.user.nextStep ? 'server-next-step' : 'missing-next-step',
    }
  }, [auth.user])

  return {
    ...auth,
    ...onboarding,
  }
}

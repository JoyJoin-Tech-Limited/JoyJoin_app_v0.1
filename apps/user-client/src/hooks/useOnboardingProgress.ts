import { useOnboardingOrchestrator } from "@/features/onboarding/active/useOnboardingOrchestrator";
import {
  getStepLabel,
  getStepRoute as getActiveStepRoute,
  type ActiveOnboardingStep,
  type OnboardingProgress,
} from "@/features/onboarding/active/flow";

export type OnboardingStep = ActiveOnboardingStep;
export type { OnboardingProgress } from "@/features/onboarding/active/flow";

/**
 * @deprecated Prefer useOnboardingOrchestrator() for active onboarding flow state.
 */
export function useOnboardingProgress(): OnboardingProgress {
  const { currentStep, totalSteps, progress, isComplete, steps } = useOnboardingOrchestrator();

  return {
    currentStep,
    totalSteps,
    progress,
    isComplete,
    steps,
  };
}

export function getStepRoute(step: OnboardingStep): string {
  const route = getActiveStepRoute(step);
  return route === "/discover" ? "/" : route;
}

export { getStepLabel };

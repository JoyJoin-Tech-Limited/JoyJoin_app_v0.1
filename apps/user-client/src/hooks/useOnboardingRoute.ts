import type { AuthUser } from "./useAuth";
import { useOnboardingOrchestrator } from "@/features/onboarding/active/useOnboardingOrchestrator";
import {
  nextStepToRoute,
  type OnboardingRoute,
} from "@/features/onboarding/active/flow";

export { nextStepToRoute, type OnboardingRoute } from "@/features/onboarding/active/flow";

/**
 * @deprecated Prefer useOnboardingOrchestrator() for active onboarding flow state.
 */
export function calculateOnboardingRoute(user: AuthUser | undefined): OnboardingRoute {
  if (!user) {
    return "/login";
  }

  return nextStepToRoute(user.nextStep);
}

export function useOnboardingRoute() {
  const { currentRoute, user, isLoading, isAuthenticated } = useOnboardingOrchestrator();

  return {
    currentRoute: isAuthenticated ? currentRoute : "/login",
    user,
    isLoading,
    isAuthenticated,
  };
}

import type { AuthUser } from "./useAuth";
import { useOnboardingOrchestrator } from "@/features/onboarding/active/useOnboardingOrchestrator";
import {
  nextStepToRoute,
  type OnboardingRoute,
} from "@/features/onboarding/active/flow";

export { nextStepToRoute, type OnboardingRoute } from "@/features/onboarding/active/flow";

/**
 * @deprecated Prefer useOnboardingOrchestrator() for active onboarding flow state.
 * Compatibility helper for legacy call sites that still expect a pure resolver.
 */
export function calculateOnboardingRoute(user: AuthUser | null | undefined): OnboardingRoute {
  if (!user) {
    return "/login";
  }

  return nextStepToRoute(user.nextStep);
}

/**
 * @deprecated Compatibility alias for legacy call sites/tests.
 */
export const resolveOnboardingRoute = calculateOnboardingRoute;

export function useOnboardingRoute() {
  const { currentRoute, user, isLoading, isAuthenticated } = useOnboardingOrchestrator();

  return {
    currentRoute: isAuthenticated ? currentRoute : "/login",
    user,
    isLoading,
    isAuthenticated,
  };
}

/**
 * useOnboardingRoute - Thin adapter around server-driven nextStep for onboarding routing.
 *
 * The canonical onboarding routing is server-driven via `nextStep` from /api/auth/user.
 * This module translates server `nextStep` values into concrete route strings.
 *
 * Route Order (matches server nextStep sequence):
 * 1. /personality-test - personality-test / onboarding (legacy)
 * 2. /onboarding/setup - essential-data
 * 3. /onboarding/extended - extended-data
 * 4. /onboarding/review - profile-review
 * 5. /discover - guide (deprecated, maps to discover) / discover
 */

import { useMemo } from "react";
import { useAuth, type AuthUser, type NextStepType } from "./useAuth";
// NextStepType values: 'onboarding' | 'personality-test' | 'essential-data' |
//                      'extended-data' | 'profile-review' | 'guide' | 'discover'

export type OnboardingRoute = 
  | '/login'
  | '/personality-test'
  | '/onboarding/setup'
  | '/onboarding/extended'
  | '/onboarding/review'
  | '/discover';

/**
 * Convert a server-calculated nextStep value to a concrete route path.
 * This is the primary routing function and should be preferred over
 * calculateOnboardingRoute whenever nextStep is available.
 */
export function nextStepToRoute(nextStep: NextStepType | undefined): OnboardingRoute {
  switch (nextStep) {
    case 'onboarding':
    case 'personality-test':
      return '/personality-test';
    case 'essential-data':
      return '/onboarding/setup';
    case 'extended-data':
      return '/onboarding/extended';
    case 'profile-review':
      return '/onboarding/review';
    case 'guide':
    case 'discover':
    default:
      return '/discover';
  }
}

/**
 * @deprecated Prefer nextStepToRoute(user.nextStep) for all new code.
 * Kept as a fallback for contexts where nextStep is unavailable.
 * Do not extend or rely on this function for new onboarding flows.
 */
export function calculateOnboardingRoute(user: AuthUser | undefined): OnboardingRoute {
  // Not authenticated -> login
  if (!user) {
    return '/login';
  }

  // Primary: use server-computed nextStep when available.
  if (user.nextStep) {
    return nextStepToRoute(user.nextStep);
  }

  // Fallback: reconstruct from local booleans (used only when nextStep is absent).
  if (!user.hasCompletedRegistration) {
    return '/personality-test';
  }
  if (!user.hasCompletedPersonalityTest) {
    return '/personality-test';
  }
  const hasEssentialData = !!(user.displayName && user.gender && user.currentCity);
  if (!hasEssentialData) {
    return '/onboarding/setup';
  }
  if (!user.hasCompletedInterestsCarousel) {
    return '/onboarding/extended';
  }
  if (!user.hasSeenProfileReview) {
    return '/onboarding/review';
  }
  return '/discover';
}

/**
 * Hook to get the current onboarding route based on server-driven nextStep.
 */
export function useOnboardingRoute() {
  const { user, isLoading, isAuthenticated } = useAuth();

  const currentRoute = useMemo(() => {
    return calculateOnboardingRoute(user);
  }, [user]);

  return {
    currentRoute,
    user,
    isLoading,
    isAuthenticated,
  };
}

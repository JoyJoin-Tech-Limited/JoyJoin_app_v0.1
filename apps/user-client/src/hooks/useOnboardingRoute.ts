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
 *
 * Requires a known NextStepType. Handle undefined/null at the call site
 * (e.g. redirect to /login if no auth state is available).
 */
export function nextStepToRoute(nextStep: NextStepType): OnboardingRoute {
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
 * Resolve the concrete onboarding route for an auth payload.
 * Prefers server-driven `nextStep`, with a narrow compatibility fallback
 * only for cases where `nextStep` is temporarily unavailable.
 */
export function resolveOnboardingRoute(user: AuthUser | null | undefined): OnboardingRoute {
  // Not authenticated -> login
  if (!user) {
    return '/login';
  }

  // Primary: use server-computed nextStep when available.
  if (user.nextStep) {
    return nextStepToRoute(user.nextStep);
  }

  // Fallback: reconstruct from server-owned completion flags when nextStep is absent.
  if (!user.hasCompletedPersonalityTest) {
    return '/personality-test';
  }
  const hasEssentialData = user.profileEssentialComplete ?? !!(user.displayName && user.gender && user.currentCity);
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
 * @deprecated Prefer resolveOnboardingRoute(user) for all new code.
 * Kept as a compatibility wrapper for existing callers.
 */
export function calculateOnboardingRoute(user: AuthUser | undefined): OnboardingRoute {
  return resolveOnboardingRoute(user);
}

/**
 * Hook to get the current onboarding route based on server-driven nextStep.
 */
export function useOnboardingRoute() {
  const { user, isLoading, isAuthenticated } = useAuth();

  const currentRoute = useMemo(() => {
    return resolveOnboardingRoute(user);
  }, [user]);

  return {
    currentRoute,
    user,
    isLoading,
    isAuthenticated,
  };
}

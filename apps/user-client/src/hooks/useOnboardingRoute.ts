/**
 * useOnboardingRoute - Client-side routing logic for onboarding flow
 * 
 * Single source of truth for determining the correct route based on user state.
 * Eliminates race conditions by using pure function logic.
 * 
 * Route Order:
 * 1. /onboarding - Registration (AI chat)
 * 2. /personality-test - V4 adaptive assessment
 * 3. /onboarding/setup - Essential data (7 steps)
 * 4. /onboarding/extended - Interest carousel
 * 5. /onboarding/review - Profile preview
 * 6. /guide - Onboarding guide (3 steps)
 * 7. /discover - Main app
 */

import { useMemo } from "react";
import { useAuth, type AuthUser } from "./useAuth";

export type OnboardingRoute = 
  | '/login'
  | '/onboarding'
  | '/personality-test'
  | '/onboarding/setup'
  | '/onboarding/extended'
  | '/onboarding/review'
  | '/guide'
  | '/discover';

/**
 * Calculate the current route a user should be on based on their state
 */
export function calculateOnboardingRoute(user: AuthUser | undefined): OnboardingRoute {
  // Not authenticated -> login
  if (!user) {
    return '/login';
  }

  // Step 1: Registration not completed
  if (!user.hasCompletedRegistration) {
    return '/onboarding';
  }

  // Step 2: Personality test not completed
  if (!user.hasCompletedPersonalityTest) {
    return '/personality-test';
  }

  // Step 3: Essential data not completed (displayName, gender, currentCity)
  const hasEssentialData = !!(user.displayName && user.gender && user.currentCity);
  if (!hasEssentialData) {
    return '/onboarding/setup';
  }

  // Step 4: Interest carousel not completed
  if (!user.hasCompletedInterestsCarousel) {
    return '/onboarding/extended';
  }

  // Step 5: Profile review not seen (prefer server field, fallback to localStorage)
  const hasSeenProfileReview = user.hasSeenProfileReview ?? (
    typeof window !== 'undefined' 
      ? localStorage.getItem('profile_review_seen') === 'true'
      : false
  );
  
  if (!hasSeenProfileReview) {
    return '/onboarding/review';
  }

  // Step 6: Guide not seen
  if (!user.hasSeenGuide) {
    return '/guide';
  }

  // All onboarding steps complete -> main app
  return '/discover';
}

/**
 * Hook to get the current onboarding route and user data
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

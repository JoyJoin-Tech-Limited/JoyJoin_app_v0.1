/**
 * useOnboardingRoute — LEGACY ADAPTER (fallback only)
 *
 * ⚠️  This hook is NOT the active source of truth for onboarding navigation.
 *
 * Authoritative routing is handled in `App.tsx` via the server-calculated
 * `nextStep` field returned by `/api/auth/user`.  The `AuthenticatedRouter`
 * switch in `App.tsx` should be consulted for the real routing logic.
 *
 * This file is retained as a thin compatibility shim for any legacy callers.
 * New code MUST use `user.nextStep` from `useAuth()` rather than importing
 * `calculateOnboardingRoute` or `useOnboardingRoute`.
 *
 * Do NOT add new onboarding routing logic here.
 *
 * Historical note: This was previously treated as the single source of truth
 * before server-driven navigation was introduced in Feb 2026 (B1).
 */

import { useMemo } from "react";
import { useAuth, type AuthUser } from "./useAuth";

export type OnboardingRoute = 
  | '/login'
  | '/personality-test'
  | '/onboarding/setup'
  | '/onboarding/extended'
  | '/onboarding/review'
  | '/discover';

/**
 * @deprecated Prefer `user.nextStep` from `useAuth()` for all routing decisions.
 *
 * This function reconstructs the onboarding route from per-field booleans on
 * the user object.  It may diverge from the server's `nextStep` if the server
 * adds or reorders steps.  Use it only as a last-resort fallback when
 * `nextStep` is unavailable.
 */
export function calculateOnboardingRoute(user: AuthUser | undefined): OnboardingRoute {
  // Not authenticated -> login
  if (!user) {
    return '/login';
  }

  // Step 1: Registration not completed (redirects to personality test)
  if (!user.hasCompletedRegistration) {
    return '/personality-test';
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

  // Step 5: Profile review not seen (server-driven only)
  const hasSeenProfileReview = user.hasSeenProfileReview === true;
  
  if (!hasSeenProfileReview) {
    return '/onboarding/review';
  }

  // All onboarding steps complete -> main app
  return '/discover';
}

/**
 * @deprecated Use `useAuth().nextStep` for routing. This hook is a legacy
 * adapter kept only for backward compatibility.
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

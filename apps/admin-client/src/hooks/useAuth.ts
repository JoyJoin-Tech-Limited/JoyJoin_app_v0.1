import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

/**
 * Admin-client auth hook.
 *
 * NOTE: This hook still uses legacy boolean flags (`needsRegistration`,
 * `needsInterestsTopics`, `needsPersonalityTest`) to derive onboarding state.
 * The user-client has been updated to use the server-calculated `nextStep`
 * field from `/api/auth/user` instead.  This hook should be updated to follow
 * the same pattern when the admin-client is next refactored.
 *
 * Legacy field reference:
 * - `needsRegistration`  → server now uses `nextStep = 'onboarding' | 'personality-test'`
 * - `needsInterestsTopics` → replaced by `nextStep = 'extended-data'`
 * - `needsPersonalityTest` → replaced by `nextStep = 'personality-test'`
 * - `needsProfileSetup`  → always false here; replaced by `nextStep = 'essential-data'`
 */
export function useAuth() {
  const { data: user, isLoading, isError } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false;
      return failureCount < 2;
    },
    staleTime: Infinity,
  });

  // If there's an error or no user, treat as not authenticated (don't stay in loading state)
  const isAuthenticated = !!user && !isError;
  const actualIsLoading = isLoading && !isError;

  return {
    user: isError ? undefined : user,
    isLoading: actualIsLoading,
    isAuthenticated,
    needsRegistration: user && !user.hasCompletedRegistration,
    needsInterestsTopics: user && user.hasCompletedRegistration && !user.hasCompletedInterestsTopics,
    needsPersonalityTest: user && user.hasCompletedRegistration && user.hasCompletedInterestsTopics && !user.hasCompletedPersonalityTest,
    // ProfileSetup no longer needed - displayName collected during registration
    needsProfileSetup: false,
  };
}

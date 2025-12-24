import { useQuery } from "@tanstack/react-query";
import type { User } from "@joyjoin/shared/schema";

export function useAuth() {
  const { data: user, isLoading, isError } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
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

import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

// Extended user type with server-driven navigation helpers (B1)
export interface AuthUser extends User {
  nextStep?: 'onboarding' | 'personality-test' | 'essential-data' | 'guide' | 'discover';
  profileEssentialComplete?: boolean;
  profileExtendedComplete?: boolean;
  activeAssessmentSessionId?: string | null;
}

export function useAuth() {
  const { data: user, isLoading, isError } = useQuery<AuthUser>({
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
    // Legacy computed fields (prefer server-driven nextStep)
    needsRegistration: user && !user.hasCompletedRegistration,
    needsPersonalityTest: user && user.hasCompletedRegistration && !user.hasCompletedPersonalityTest,
    needsProfileSetup: user && user.hasCompletedRegistration && user.hasCompletedPersonalityTest && (!user.displayName || !user.gender || !user.currentCity),
    // Server-driven navigation (B1)
    nextStep: user?.nextStep,
    profileEssentialComplete: user?.profileEssentialComplete,
    profileExtendedComplete: user?.profileExtendedComplete,
    activeAssessmentSessionId: user?.activeAssessmentSessionId,
  };
}

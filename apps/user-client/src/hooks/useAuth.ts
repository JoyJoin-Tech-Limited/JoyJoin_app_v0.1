import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

/**
 * Navigation step constants for server-driven onboarding flow (B1)
 * Used by both server and client to ensure consistency
 */
export const NextStep = {
  ONBOARDING: 'onboarding',
  PERSONALITY_TEST: 'personality-test',
  ESSENTIAL_DATA: 'essential-data',
  EXTENDED_DATA: 'extended-data',
  PROFILE_REVIEW: 'profile-review',
  GUIDE: 'guide',
  DISCOVER: 'discover',
} as const;

export type NextStepType = typeof NextStep[keyof typeof NextStep];

// Extended user type with server-driven navigation helpers (B1)
export interface AuthUser extends User {
  nextStep?: NextStepType;
  profileEssentialComplete?: boolean;
  profileExtendedComplete?: boolean;
  activeAssessmentSessionId?: string | null;
  /** Whether the payment system is enabled (server-controlled kill switch). */
  paymentsEnabled?: boolean;
}

export interface UseAuthResult {
  user: AuthUser | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  nextStep: NextStepType | undefined;
  profileEssentialComplete: boolean | undefined;
  profileExtendedComplete: boolean | undefined;
  activeAssessmentSessionId: string | null | undefined;
  /** Whether the payment system is currently enabled (false = kill switch active). */
  paymentsEnabled: boolean;
}

export function useAuth(): UseAuthResult {
  const { data: user, isLoading, isError } = useQuery<AuthUser>({
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
    // Server-driven navigation (B1)
    nextStep: user?.nextStep,
    profileEssentialComplete: user?.profileEssentialComplete,
    profileExtendedComplete: user?.profileExtendedComplete,
    activeAssessmentSessionId: user?.activeAssessmentSessionId,
    // Feature flags — default to false (safe / disabled) while user data is loading
    // or when the user is unauthenticated. The payment page itself is only reachable
    // from authenticated routes, so a brief false during loading is acceptable.
    paymentsEnabled: user?.paymentsEnabled ?? false,
  };
}

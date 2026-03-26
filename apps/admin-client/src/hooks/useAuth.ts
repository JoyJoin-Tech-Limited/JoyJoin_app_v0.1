import { useQuery } from "@tanstack/react-query";

/**
 * Admin auth response – may be a full User row (legacy phone-based admin)
 * or a synthetic admin object returned when logged in via admin_accounts table.
 */
export interface AdminAuthUser {
  id: string;
  displayName?: string | null;
  isAdmin: boolean;
  /** RBAC role: super_admin | operator | viewer (undefined for legacy admin sessions) */
  adminRole?: string;
  nextStep?: string;
  // Legacy User fields that may be present for phone-based admins
  [key: string]: any;
}

export function useAuth() {
  const { data: user, isLoading, isError } = useQuery<AdminAuthUser>({
    queryKey: ["/api/auth/user"],
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false;
      return failureCount < 2;
    },
    staleTime: Infinity,
  });

  const isAuthenticated = !!user && !isError;
  const actualIsLoading = isLoading && !isError;

  return {
    user: isError ? undefined : user,
    isLoading: actualIsLoading,
    isAuthenticated,
  };
}

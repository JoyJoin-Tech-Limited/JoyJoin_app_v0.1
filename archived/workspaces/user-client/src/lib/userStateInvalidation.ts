import { queryClient } from "./queryClient";

const USER_DERIVED_QUERY_KEYS = [
  ["/api/auth/user"],
  ["/api/user/interests"],
  ["/api/my-pool-registrations"],
  ["/api/my-events"],
  ["/api/pool-groups"],
  ["/api/profile/stats"],
  ["/api/personality-test/results"],
] as const;

/**
 * Refresh caches that derive behavior from user profile / onboarding / personality data.
 * Matching and smart routing rely on these queries staying in sync because the app uses
 * long-lived React Query caches by default.
 */
export async function invalidateUserDerivedQueries() {
  await Promise.all(
    USER_DERIVED_QUERY_KEYS.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey: [...queryKey] }),
    ),
  );
}

export { USER_DERIVED_QUERY_KEYS };

import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Handle a 401 (session expired) response from a mutation or action.
 * Clears the React Query cache (so stale auth state is dropped) and
 * redirects the user to the landing page so they can re-authenticate
 * without being trapped in a broken or loading state.
 *
 * The redirect is intentionally deferred to the next microtask so that
 * any synchronous caller cleanup (e.g. mutation onError handlers) can
 * run first.
 */
function handleSessionExpired(): void {
  // Clear all cached queries — session is gone, all user data is stale
  queryClient.clear();

  // Redirect to landing page (non-SPA navigation to ensure full app reset)
  const target = "/";
  if (window.location.pathname !== target) {
    queueMicrotask(() => {
      window.location.replace(target);
    });
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Session expired mid-flow: clear state and redirect cleanly
  if (res.status === 401) {
    handleSessionExpired();
    throw new Error("401: Session expired. Please log in again.");
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

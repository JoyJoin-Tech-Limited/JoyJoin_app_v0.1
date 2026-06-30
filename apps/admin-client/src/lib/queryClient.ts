import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function resolveApiUrl(url: string, apiBaseUrl = API_BASE_URL): string {
  if (/^https?:\/\//.test(url)) {
    return url;
  }

  const normalizedUrl = url.startsWith("/") ? url : `/${url}`;

  // Default to same-origin `/api/*` so production can use the host Nginx proxy
  // without relying on browser CORS for credentialed requests.
  if (!apiBaseUrl) {
    return normalizedUrl;
  }

  if (apiBaseUrl === "/api" && normalizedUrl.startsWith("/api/")) {
    return normalizedUrl;
  }

  return `${apiBaseUrl}${normalizedUrl}`;
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) {
    return res.statusText || "请求失败";
  }

  try {
    const data = JSON.parse(text);
    return data?.message ?? data?.error ?? text;
  } catch {
    return text;
  }
}

function maybeRedirectExpiredAdminSession(res: Response) {
  if (typeof window === "undefined") {
    return;
  }

  const pathname = window.location.pathname;
  const isAdminPath = pathname.startsWith("/admin");
  const isLoginPath = pathname === "/admin/login" || pathname === "/login";

  if (isAdminPath && !isLoginPath && (res.status === 401 || res.status === 403)) {
    window.location.href = "/admin/login";
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    maybeRedirectExpiredAdminSession(res);
    const message = await readErrorMessage(res);
    throw new Error(`${res.status}: ${message}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(resolveApiUrl(url), {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(resolveApiUrl(queryKey.join("/") as string), {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && (res.status === 401 || res.status === 403)) {
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

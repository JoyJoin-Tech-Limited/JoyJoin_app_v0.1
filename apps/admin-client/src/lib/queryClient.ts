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

function getFallbackHttpMessage(res: Response): string {
  if (res.status === 401) {
    return "登录已过期，请重新登录";
  }

  if (res.status === 403) {
    return "没有权限执行此操作，或登录状态已失效";
  }

  if (res.status === 502 || res.status === 503 || res.status === 504) {
    return "后台服务暂时不可用，请稍后重试，或联系技术团队检查 staging API 服务";
  }

  if (res.status >= 500) {
    return "服务器内部错误，请稍后重试";
  }

  return res.statusText || "请求失败";
}

function isHtmlErrorResponse(text: string, contentType: string): boolean {
  const trimmed = text.trim().toLowerCase();

  return (
    contentType.includes("text/html")
    || trimmed.startsWith("<!doctype")
    || trimmed.startsWith("<html")
    || /<title>.*<\/title>|<body[\s>]/i.test(text)
  );
}

async function readErrorMessage(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text().catch(() => "");
  if (!text) {
    return getFallbackHttpMessage(res);
  }

  try {
    const data = JSON.parse(text);
    return data?.message ?? data?.error ?? getFallbackHttpMessage(res);
  } catch {
    if (isHtmlErrorResponse(text, contentType)) {
      return getFallbackHttpMessage(res);
    }

    if (text.length > 300) {
      return getFallbackHttpMessage(res);
    }

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

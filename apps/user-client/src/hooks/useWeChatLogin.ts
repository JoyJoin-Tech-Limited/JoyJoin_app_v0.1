/**
 * useWeChatLogin – WeChat login hook for the `apps/user-client` H5/web app.
 *
 * ⚠️  NOTE: The **active mini-program** (Taro WeChat Mini Program) lives under
 * `apps/mini-program` and uses its own `useWeChatLogin` hook that calls
 * `Taro.login()` directly — no web OAuth redirect is involved there.
 * This hook is for the H5/web client only.
 *
 * Code-acquisition strategy (see `getWeChatCode` below):
 *   1. wx.login() when the WeChat Mini Program global `wx` is available.
 *   2. WeChat OAuth2 web redirect (`/api/auth/wechat/oauth/start`) in staging/production
 *      browser environments. The page navigates away; the server callback handles session
 *      creation and redirects back to the frontend.
 *   3. Mock UUID fallback in local development (server accepts these in dev mode).
 *
 * On success:
 *   - New users  → redirected to `/personality-test` (onboarding flow).
 *   - Existing users → navigated to the server-calculated `nextStep`.
 *
 * Returns `{ handleWeChatLogin, isLoggingIn }`.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AuthUser } from "@/hooks/useAuth";
import { nextStepToRoute } from "@/hooks/useOnboardingRoute";

/** Subset of the wx.login() success callback result we actually use. */
interface WxLoginResult {
  code: string;
  errMsg?: string;
}

/**
 * Obtains a WeChat login code for the `/api/auth/wechat/login-with-test` endpoint,
 * or initiates the WeChat OAuth2 web redirect flow.
 *
 * Priority order:
 *   1. wx.login() — WeChat Mini Program runtime (wx global is present).
 *   2. Development mode — returns a mock `wechat_test_<uuid>` code so the server's
 *      development mock path (`NODE_ENV === 'development'`) can process it without
 *      hitting the real WeChat API.
 *   3. Staging / Production browser (no wx global) — redirects the browser to
 *      `/api/auth/wechat/oauth/start`, which begins the WeChat OAuth2 web flow.
 *      The returned Promise intentionally never resolves because the page navigates away;
 *      the server-side callback at `/api/auth/wechat/oauth/callback` takes over.
 *
 * This is an H5/web-only function. The Taro mini-program auth is handled separately
 * in `apps/mini-program/src/hooks/useWeChatLogin.ts` via `Taro.login()`.
 */
async function getWeChatCode(): Promise<string> {
  // 1. Mini Program runtime: use wx.login()
  if (typeof wx !== 'undefined' && typeof wx.login === 'function') {
    const result = await new Promise<WxLoginResult>((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: (err: any) => reject(new Error(err.errMsg || 'wx.login failed')),
      });
    });
    return result.code;
  }

  // 2. Local development: use a mock code (server accepts in dev mode).
  if (import.meta.env.DEV) {
    console.warn('[useWeChatLogin] Development mode: using mock WeChat code');
    return `wechat_test_${crypto.randomUUID()}`;
  }

  // 3. Web browser (staging/production): initiate WeChat OAuth2 web flow.
  // The browser is redirected to the WeChat authorization page via the server.
  // The server callback at /api/auth/wechat/oauth/callback handles session creation
  // and redirects back to the frontend — this Promise never resolves.
  //
  // NOTE: The Taro mini-program uses Taro.login() directly in
  // apps/mini-program/src/hooks/useWeChatLogin.ts — no web OAuth is involved there.
  console.log('[useWeChatLogin] Initiating WeChat OAuth2 web flow');
  window.location.href = '/api/auth/wechat/oauth/start';
  return new Promise<string>(() => {}); // page navigates away; never resolves
}

export function useWeChatLogin() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleWeChatLogin = async () => {
    setIsLoggingIn(true);
    try {
      const code = await getWeChatCode();

      const response = await apiRequest("POST", "/api/auth/wechat/login-with-test", {
        code,
        // testAnswers is empty here because this is a returning-user login path.
        // The field is required by the shared endpoint which also handles
        // post-personality-test sign-ups (where answers are non-empty).
        testAnswers: [],
      });
      const data = await response.json();

      if (data.success) {
        // B: Clear any stale pre-signup localStorage state so resume prompts
        // don't re-appear after a successful login on the same device.
        try {
          localStorage.removeItem('joyjoin_v4_presignup_answers');
          localStorage.removeItem('joyjoin_v4_assessment_session');
          localStorage.removeItem('joyjoin_synced_session_id');
          localStorage.removeItem('joyjoin_synced_answer_count');
        } catch {
          // localStorage may be unavailable in some embedded environments
        }

        // E: Use a single authoritative nextStep → route mapper for all outcomes
        // (new users, returning users, partially-onboarded users) so that any
        // future server-side step changes are automatically reflected here.
        await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
        const updatedUser = await queryClient.fetchQuery({
          queryKey: ["/api/auth/user"],
        }) as AuthUser;

        setLocation(nextStepToRoute(updatedUser?.nextStep ?? 'personality-test'));
      } else {
        throw new Error(data.error || '登录失败');
      }
    } catch (err) {
      toast({
        title: "登录失败",
        description: err instanceof Error ? err.message : "登录失败，请检查网络连接后重试",
        variant: "destructive",
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  return { handleWeChatLogin, isLoggingIn };
}

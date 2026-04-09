/**
 * useWeChatLogin – shared hook for triggering WeChat Mini Program login.
 *
 * Code-acquisition strategy (see `getWeChatCode` below):
 *   1. wx.login() — WeChat Mini Program runtime (wx global is present).
 *   2. Mock UUID fallback in local development (server accepts these in dev mode).
 *
 * This hook is strictly for Taro WeChat Mini Program flows. There is no web
 * OAuth2 redirect fallback. Active user-facing login must always go through the
 * mini-program login path.
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
 * Obtains a WeChat login code from the WeChat Mini Program runtime for use with
 * the `/api/auth/wechat/login-with-test` endpoint.
 *
 * Priority order:
 *   1. wx.login() — WeChat Mini Program runtime (wx global is present).
 *   2. Development mode — returns a mock `wechat_test_<uuid>` code so the server's
 *      development mock path (`NODE_ENV === 'development'`) can process it without
 *      hitting the real WeChat API.
 *
 * There is intentionally no web OAuth2 fallback. Active user-facing login uses
 * the mini-program path exclusively. The legacy `/api/auth/wechat/oauth/start`
 * server route is quarantined and no longer called from active client code.
 *
 * Exported so that callers that need to supply additional body fields (e.g.
 * WeChatAuthGatePage forwarding pre-signup answers) can obtain the code directly
 * and call the API themselves, while still sharing the same acquisition logic.
 */
export async function getWeChatCode(): Promise<string> {
  // Mini Program runtime: use wx.login()
  if (typeof wx !== 'undefined' && typeof wx.login === 'function') {
    const result = await new Promise<WxLoginResult>((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: (err: any) => reject(new Error(err.errMsg || 'wx.login failed')),
      });
    });
    return result.code;
  }

  // Local development: use a mock code (server accepts in dev mode).
  if (import.meta.env.DEV) {
    console.warn('[useWeChatLogin] Development mode: using mock WeChat code');
    return `wechat_test_${crypto.randomUUID()}`;
  }

  // No wx.login available and not in dev mode — fail clearly rather than
  // silently redirecting to a web OAuth flow that is no longer supported.
  throw new Error('请在微信小程序中打开此应用以完成登录。（WeChat Mini Program runtime is required.）');
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

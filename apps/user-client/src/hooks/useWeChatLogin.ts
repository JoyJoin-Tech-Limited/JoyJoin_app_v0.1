/**
 * useWeChatLogin – shared hook for triggering WeChat OAuth login directly.
 *
 * Code-acquisition strategy (see `getWeChatCode` below):
 *   1. wx.login() when the WeChat Mini Program global `wx` is available.
 *   2. Mock UUID fallback for web / dev environments (server accepts these in
 *      development mode via the `wechat_test_` prefix convention).
 *
 * @taroMigration To migrate to Taro, update only `getWeChatCode()` — the hook
 *   itself requires no changes.
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

/** Subset of the wx.login() success callback result we actually use. */
interface WxLoginResult {
  code: string;
  errMsg?: string;
}

/**
 * Obtains a WeChat login code for the `/api/auth/wechat/login-with-test` endpoint.
 *
 * Current behaviour (pre-Taro migration):
 *   1. Uses `wx.login()` when running inside the WeChat Mini Program runtime.
 *   2. Falls back to a `wechat_test_<uuid>` mock code for web / dev — the server
 *      accepts this in development mode (NODE_ENV === 'development').
 *
 * @taroMigration Replace this function body with:
 *   ```ts
 *   import Taro from '@tarojs/taro';
 *   const result = await Taro.login();
 *   return result.code;
 *   ```
 *   No other changes are needed in this file.
 */
async function getWeChatCode(): Promise<string> {
  if (typeof wx !== 'undefined' && typeof wx.login === 'function') {
    const result = await new Promise<WxLoginResult>((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: (err: any) => reject(new Error(err.errMsg || 'wx.login failed')),
      });
    });
    return result.code;
  }

  // Web / development fallback — server mocks openid for any code in dev mode.
  console.warn('[useWeChatLogin] wx.login() not available, using mock code for dev/web');
  return `wechat_test_${crypto.randomUUID()}`;
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
        // New users are sent to the onboarding flow (personality test).
        // Existing users are navigated to the server-calculated next step.
        if (data.isNewUser) {
          setLocation('/personality-test');
          return;
        }

        await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
        const updatedUser = await queryClient.fetchQuery({
          queryKey: ["/api/auth/user"],
        }) as AuthUser;

        const step = updatedUser?.nextStep;
        let nextPath: string;
        switch (step) {
          case 'discover':
          case 'guide':
            nextPath = '/discover';
            break;
          case 'personality-test':
            nextPath = '/personality-test';
            break;
          case 'extended-data':
            nextPath = '/onboarding/extended';
            break;
          case 'profile-review':
            nextPath = '/onboarding/review';
            break;
          case 'essential-data':
          case 'onboarding':
          default:
            nextPath = '/onboarding/setup';
            break;
        }
        setLocation(nextPath);
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

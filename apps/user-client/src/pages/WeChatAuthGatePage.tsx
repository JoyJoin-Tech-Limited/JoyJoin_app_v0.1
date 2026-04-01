/**
 * WeChatAuthGatePage
 *
 * Premium minimalist WeChat auth gate shown after the user completes
 * Personality Test V4 and before they can save their results.
 *
 * Design philosophy: "One screen. One truth. One tap. Premium is restraint."
 *
 * Behaviour:
 * - Authenticated users are immediately redirected to /personality-test/results.
 * - Tapping the WeChat button logs in inline (forwarding pre-signup answers) then
 *   navigates to the server-calculated nextStep.
 * - In non-production environments a "测试快速通过" button lets testers bypass
 *   auth and jump directly to the results page without signing in.
 *
 * Route: /personality-test/auth-gate
 */

import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import type { AuthUser } from "@/hooks/useAuth";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { archetypeAvatars } from "@/lib/archetypeAvatars";
import { haptics } from "@/lib/haptics";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { nextStepToRoute } from "@/hooks/useOnboardingRoute";

// ─── Constants ───────────────────────────────────────────────────────────────

const PRESIGNUP_SESSION_KEY = "joyjoin_v4_assessment_session";
const PRESIGNUP_ANSWERS_KEY = "joyjoin_v4_presignup_answers";

/**
 * Archetype → representative hex colour used for the subtle radial glow.
 * Tailwind's JIT cannot resolve dynamically constructed class names, so we
 * use inline styles with a hardcoded hex lookup instead.
 */
const archetypeGlowHex: Record<string, string> = {
  '开心柯基': '#F59E0B',
  '太阳鸡': '#F59E0B',
  '夸夸豚': '#06B6D4',
  '机智狐': '#F97316',
  '淡定海豚': '#3B82F6',
  '织网蛛': '#A855F7',
  '暖心熊': '#F43F5E',
  '灵感章鱼': '#8B5CF6',
  '沉思猫头鹰': '#64748B',
  '定心大象': '#6B7280',
  '稳如龟': '#10B981',
  '隐身猫': '#6366F1',
};

const DEFAULT_GLOW_COLOR = '#A855F7';

// ─── WeChat Icon ──────────────────────────────────────────────────────────────

const WeChatIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="mr-2 flex-shrink-0"
    aria-hidden="true"
  >
    <path d="M8.69 4C4.74 4 1.54 6.74 1.54 10.13c0 1.89.98 3.59 2.52 4.74l-.63 1.9 2.18-1.09c.7.19 1.45.3 2.22.3.27 0 .53-.01.79-.04-.17-.5-.26-1.02-.26-1.57 0-3.04 2.87-5.5 6.41-5.5.22 0 .44.01.65.03C14.72 6.43 11.97 4 8.69 4zM6.3 7.88a.88.88 0 110-1.76.88.88 0 010 1.76zm4.78 0a.88.88 0 110-1.76.88.88 0 010 1.76zM22.46 14.57c0-2.87-2.87-5.2-6.41-5.2-3.55 0-6.41 2.33-6.41 5.2 0 2.87 2.86 5.2 6.41 5.2.75 0 1.47-.1 2.14-.29l2.1 1.05-.6-1.83c1.45-1.1 2.77-2.74 2.77-4.13zm-8.38-.44a.88.88 0 110-1.76.88.88 0 010 1.76zm3.94 0a.88.88 0 110-1.76.88.88 0 010 1.76z" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeChatAuthGatePage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const { toast } = useToast();

  const [archetype, setArchetype] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Read archetype from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESIGNUP_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const primary = parsed?.result?.primaryArchetype ?? null;
        if (primary) setArchetype(primary);
      }
    } catch {
      // Silently ignore parse errors — archetype simply remains null
    }
  }, []);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setLocation('/personality-test/results');
    }
  }, [isAuthenticated, setLocation]);

  // While redirecting authenticated users, show nothing
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#111111] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
      </div>
    );
  }

  // ── Derived values ──────────────────────────────────────────────────────────

  const glowColor = archetype ? (archetypeGlowHex[archetype] ?? DEFAULT_GLOW_COLOR) : DEFAULT_GLOW_COLOR;
  const avatarSrc = archetype ? archetypeAvatars[archetype] : null;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleLogin = useCallback(async () => {
    if (isLoggingIn) return;
    haptics.medium();
    setIsLoggingIn(true);

    try {
      // Read pre-signup answers from localStorage so they are forwarded with login
      let testAnswers: unknown[] = [];
      const answersRaw = localStorage.getItem(PRESIGNUP_ANSWERS_KEY);
      if (answersRaw) {
        try {
          const parsed = JSON.parse(answersRaw);
          testAnswers = Array.isArray(parsed) ? parsed : [];
        } catch {
          // Fall back to empty array — server handles missing answers gracefully
        }
      }

      // B: Read the server-side presignup cache session ID so the server can
      // claim/delete it after a successful import, preventing stale resume prompts.
      let presignupSessionId: string | undefined;
      try {
        const sessionRaw = localStorage.getItem(PRESIGNUP_SESSION_KEY);
        if (sessionRaw) {
          const sessionData = JSON.parse(sessionRaw);
          const sid = sessionData?.sessionId ?? sessionData?.id ?? null;
          if (sid && typeof sid === 'string') presignupSessionId = sid;
        }
      } catch {
        // Ignore parse errors — presignupSessionId stays undefined
      }

      // In WeChat Mini Program use wx.login(); fall back to mock code in web/dev
      let code: string;
      const wxGlobal = (window as any).wx;
      if (typeof wxGlobal !== 'undefined' && wxGlobal?.login) {
        const loginResult = await new Promise<any>((resolve, reject) => {
          wxGlobal.login({
            success: resolve,
            fail: (err: any) => reject(new Error(err.errMsg || 'wx.login failed')),
          });
        });
        code = loginResult.code;
      } else {
        const uuid = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
        code = `wechat_test_${uuid}`;
      }

      const response = await fetch('/api/auth/wechat/login-with-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, testAnswers, presignupSessionId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '登录失败' }));
        throw new Error(errorData.error || '登录失败');
      }

      await response.json();

      // B: Clear anonymous assessment data from localStorage now that the server
      // has claimed the session. This prevents resume prompts from reappearing.
      localStorage.removeItem(PRESIGNUP_ANSWERS_KEY);
      localStorage.removeItem(PRESIGNUP_SESSION_KEY);
      localStorage.removeItem('joyjoin_synced_session_id');
      localStorage.removeItem('joyjoin_synced_answer_count');

      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });

      toast({ title: "登录成功", description: "正在为你准备个性化匹配..." });

      // E: Use the canonical nextStep → route mapper so routing stays in sync with
      // any future server-side step changes.
      const updatedUser = await queryClient.fetchQuery({ queryKey: ['/api/auth/user'] }) as AuthUser;
      const nextPath = nextStepToRoute(updatedUser?.nextStep ?? 'essential-data');

      setTimeout(() => setLocation(nextPath), 500);
    } catch (error) {
      toast({
        title: "登录失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsLoggingIn(false);
    }
  }, [isLoggingIn, setLocation, toast]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Shimmer animation (single pass on mount) */}
      {!prefersReducedMotion && (
        <style>{`
          @keyframes shimmer-sweep {
            0%   { transform: translateX(-100%) skewX(-15deg); opacity: 0; }
            20%  { opacity: 0.4; }
            100% { transform: translateX(300%) skewX(-15deg); opacity: 0; }
          }
          .shimmer-once {
            animation: shimmer-sweep 1.2s ease-out 0.4s 1 forwards;
          }
          @keyframes ping-slow {
            75%, 100% {
              transform: scale(1.4);
              opacity: 0;
            }
          }
          .animate-ping-slow {
            animation: ping-slow 3s cubic-bezier(0, 0, 0.2, 1) infinite;
          }
        `}</style>
      )}

      <div
        className="relative h-screen w-full overflow-hidden bg-[#FAFAF8] dark:bg-[#111111] flex flex-col items-center justify-center px-6"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* ── Avatar hero block ─────────────────────────────────────────── */}
        <motion.div
          className="relative flex flex-col items-center"
          {...(prefersReducedMotion ? {} : {
            initial: { opacity: 0, scale: 0.92 },
            animate: { opacity: 1, scale: 1 },
            transition: { duration: 0.3, ease: 'easeOut' },
          })}
        >
          {/* Radial glow — archetype colour at ~8% opacity, centred behind avatar */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: 400,
              height: 400,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle 200px at center, ${glowColor}15, transparent)`,
            }}
            aria-hidden="true"
          />

          {/* Avatar card */}
          <div className="relative" style={{ width: 120, height: 120 }}>
            {/* Pulsing archetype-coloured ring */}
            {!prefersReducedMotion && (
              <span
                className="animate-ping-slow absolute inset-0 rounded-3xl"
                style={{ backgroundColor: `${glowColor}66` }}
                aria-hidden="true"
              />
            )}

            {/* Blurred avatar image (or lock icon fallback) */}
            <div className="relative w-[120px] h-[120px] rounded-3xl overflow-hidden bg-muted">
              {avatarSrc ? (
                <>
                  <img
                    src={avatarSrc}
                    alt=""
                    className="w-full h-full object-cover blur-[6px]"
                    style={{ filter: 'blur(6px) grayscale(30%)' }}
                    aria-hidden="true"
                  />
                  {/* Gradient overlay */}
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.20))' }}
                    aria-hidden="true"
                  />
                  {/* Shimmer sweep (single pass on mount) */}
                  {!prefersReducedMotion && (
                    <div
                      className="shimmer-once absolute inset-0 bg-white/30"
                      style={{ width: '50%' }}
                      aria-hidden="true"
                    />
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl select-none" aria-hidden="true">
                  🔒
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* 32px breathing space */}
        <div className="h-8" />

        {/* ── Headline + CTA block ──────────────────────────────────────── */}
        <motion.div
          className="w-full flex flex-col items-center gap-8"
          {...(prefersReducedMotion ? {} : {
            initial: { opacity: 0, y: 16 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.4, ease: 'easeOut', delay: 0.1 },
          })}
        >
          {/* Two-line headline */}
          <div className="text-center space-y-0.5">
            <p className="text-3xl font-black text-foreground leading-tight tracking-tight">
              你的另一面
            </p>
            <p className="text-3xl font-black text-foreground leading-tight tracking-tight">
              正在等你
            </p>
          </div>

          {/* WeChat login button — hero element */}
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full h-[64px] bg-[#07C160] rounded-2xl flex items-center justify-center text-lg font-bold text-white active:scale-[0.97] transition-transform duration-100 select-none disabled:opacity-70"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {isLoggingIn ? (
              <div className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin mr-2" />
            ) : (
              <WeChatIcon />
            )}
            微信登录 · 揭开结果
          </button>

          {/* Dev/admin quick pass — only visible in non-production for testing purposes */}
          {process.env.NODE_ENV !== 'production' && (
            <button
              onClick={() => setLocation('/personality-test/results')}
              className="text-sm text-muted-foreground bg-transparent border-0 cursor-pointer select-none"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              测试快速通过
            </button>
          )}
        </motion.div>

        {/* ── Legal footer ─────────────────────────────────────────────── */}
        <p className="absolute bottom-8 text-xs text-muted-foreground/50 text-center px-8">
          登录即同意《用户协议》和《隐私政策》
        </p>
      </div>
    </>
  );
}

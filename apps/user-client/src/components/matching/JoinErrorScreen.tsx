import { motion, useReducedMotion } from "framer-motion";
import { RefreshCw, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import matchingBg from "@/assets/matching/shared/matching-bg.svg";
import joinErrorHero from "@/assets/matching/join-error/join-error-hero.svg";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JoinErrorScreenProps {
  /** Called when the user taps "再试一次". */
  onRetry?: () => void;
  /** Called when the user taps "返回看看其他活动". */
  onBrowse?: () => void;
  /** Whether a retry is in progress (disables the retry button). */
  isRetrying?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Shown inside `JoinEventPoolSheet` when the registration mutation fails.
 *
 * Distinct from NoMatchScreen:
 *  - **JoinErrorScreen** = operation failure (request didn't complete)
 *  - **NoMatchScreen**   = no suitable pool available (system working normally)
 */
export default function JoinErrorScreen({
  onRetry,
  onBrowse,
  isRetrying = false,
}: JoinErrorScreenProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Shared matching background */}
      <img
        src={matchingBg}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
      />
      {/* Scrim */}
      <div className="absolute inset-0 bg-[#0D0A1A]/75" />

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-8 pt-6">
        {/* Hero */}
        <motion.img
          src={joinErrorHero}
          alt="加入失败"
          className="h-auto w-full max-w-[200px] object-contain drop-shadow-2xl"
          animate={shouldReduceMotion ? {} : { y: [0, -5, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Status chip */}
        <span className="mt-5 inline-block rounded-full bg-rose-500/20 px-3 py-0.5 text-xs font-semibold text-rose-300 ring-1 ring-rose-400/30">
          当前还没有为你保留位置
        </span>

        {/* Eyebrow */}
        <p className="mt-4 text-center text-xs font-medium uppercase tracking-widest text-white/45">
          这次还没加入成功
        </p>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 26, delay: 0.1 }}
          className="mt-3 text-center text-xl font-black leading-tight tracking-tight text-white"
        >
          系统刚刚开了个小差
        </motion.h2>

        {/* Support copy */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-3 px-4 text-center text-sm leading-relaxed text-white/55"
        >
          你的席位还没有锁定成功。可以稍后再试一次，我们会尽量接着刚才的进度继续。
        </motion.p>

        {/* CTAs */}
        <div className="mt-8 w-full max-w-sm space-y-3">
          {/* Primary */}
          <Button
            onClick={onRetry}
            disabled={isRetrying}
            size="lg"
            className="h-14 w-full rounded-2xl border-0 bg-gradient-to-r from-purple-600 to-violet-500 text-base font-semibold text-white shadow-lg shadow-purple-900/40 transition-all duration-200 hover:from-purple-700 hover:to-violet-600 active:scale-[0.98] disabled:opacity-60"
          >
            {isRetrying ? (
              <>
                <RefreshCw className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                重试中…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-5 w-5" aria-hidden="true" />
                再试一次
              </>
            )}
          </Button>

          {/* Secondary */}
          <Button
            onClick={onBrowse}
            variant="ghost"
            size="lg"
            className="h-12 w-full rounded-2xl text-sm font-medium text-white/55 hover:bg-white/10 hover:text-white/90"
          >
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
            返回看看其他活动
          </Button>
        </div>

        {/* Helper text */}
        <p className="mt-5 px-6 text-center text-[11px] leading-relaxed text-white/30">
          如果网络不太稳定，稍等片刻再试会更顺利
        </p>
      </div>
    </div>
  );
}

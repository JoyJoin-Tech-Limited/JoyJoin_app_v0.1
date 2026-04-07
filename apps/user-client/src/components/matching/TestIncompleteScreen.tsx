import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import matchingBg from "@/assets/matching/shared/matching-bg.svg";
import testIncompleteHero from "@/assets/matching/test-incomplete/test-incomplete-hero.svg";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TestIncompleteScreenProps {
  /** Called when the user taps "继续测试". */
  onContinueTest: () => void;
  /** Called when the user taps "稍后再来" / dismiss. */
  onDismiss: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Shown inside `JoinEventPoolSheet` as a fallback-only recovery surface
 * when auth state is inconsistent (personality test should be completed
 * during onboarding, before the user reaches Discover).
 *
 * This is a soft gate: the user is directed to complete the test
 * but can also choose to come back later.
 */
export default function TestIncompleteScreen({
  onContinueTest,
  onDismiss,
}: TestIncompleteScreenProps) {
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

      {/* Dismiss button */}
      <div className="relative z-20 flex justify-end p-4">
        <button
          type="button"
          onClick={onDismiss}
          aria-label="稍后再来"
          className="rounded-full p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-8">
        {/* Hero */}
        <motion.img
          src={testIncompleteHero}
          alt="性格测试未完成"
          className="h-auto w-full max-w-[200px] object-contain drop-shadow-2xl"
          animate={shouldReduceMotion ? {} : { y: [0, -5, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Status chip */}
        <span className="mt-5 inline-block rounded-full bg-amber-500/20 px-3 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-400/30">
          还剩少量题目
        </span>

        {/* Eyebrow */}
        <p className="mt-4 text-center text-xs font-medium uppercase tracking-widest text-white/45">
          差一步就能入座
        </p>

        {/* Headline */}
        <motion.h2
          initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={
            shouldReduceMotion
              ? undefined
              : { type: "spring", stiffness: 300, damping: 26, delay: 0.1 }
          }
          className="mt-3 text-center text-xl font-black leading-tight tracking-tight text-white"
        >
          补完测试，才能帮你配到最合拍的桌友
        </motion.h2>

        {/* Support copy */}
        <motion.p
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1 }}
          transition={shouldReduceMotion ? undefined : { duration: 0.4, delay: 0.2 }}
          className="mt-3 px-4 text-center text-sm leading-relaxed text-white/55"
        >
          再花一点时间完成性格测试，我们才能读懂你，把你安排到最对的那一桌。
        </motion.p>

        {/* CTAs */}
        <div className="mt-8 w-full max-w-sm space-y-3">
          {/* Primary */}
          <Button
            onClick={onContinueTest}
            size="lg"
            className="h-14 w-full rounded-2xl border-0 bg-gradient-to-r from-purple-600 to-violet-500 text-base font-semibold text-white shadow-lg shadow-purple-900/40 transition-all duration-200 hover:from-purple-700 hover:to-violet-600 active:scale-[0.98]"
          >
            继续测试
            <ChevronRight className="ml-2 h-5 w-5" aria-hidden="true" />
          </Button>

          {/* Secondary */}
          <Button
            onClick={onDismiss}
            variant="ghost"
            size="lg"
            className="h-12 w-full rounded-2xl text-sm font-medium text-white/55 hover:bg-white/10 hover:text-white/90"
          >
            稍后再来
          </Button>
        </div>

        {/* Helper text */}
        <p className="mt-5 px-6 text-center text-[11px] leading-relaxed text-white/30">
          你的进度已保存，随时可以继续
        </p>
      </div>
    </div>
  );
}

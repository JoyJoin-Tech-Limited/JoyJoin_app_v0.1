import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import matchingBg from "@/assets/matching/shared/matching-bg.svg";
import extendedDataEmptyHero from "@/assets/matching/extended-data-empty/extended-data-empty-hero.svg";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtendedDataEmptyScreenProps {
  /** Called when the user taps "去补充资料". */
  onFillProfile: () => void;
  /** Called when the user taps "先跳过" — does NOT block them. */
  onSkip: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Shown inside `JoinEventPoolSheet` as an optional interstitial when extended
 * profile data is missing.
 *
 * This is NOT a hard block — the user can skip and proceed to registration.
 * Copy and tone reflect a warm, optional encouragement.
 */
export default function ExtendedDataEmptyScreen({
  onFillProfile,
  onSkip,
}: ExtendedDataEmptyScreenProps) {
  const shouldReduceMotion = useReducedMotion();

  const benefitChips = ["匹配更精准", "组局更合拍", "只要 1 分钟"];

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
          src={extendedDataEmptyHero}
          alt="补充更多资料"
          className="h-auto w-full max-w-[200px] object-contain drop-shadow-2xl"
          animate={shouldReduceMotion ? {} : { y: [0, -5, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Eyebrow */}
        <p className="mt-5 text-center text-xs font-medium uppercase tracking-widest text-white/45">
          这一步是可选的
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
          多补充一点，匹配会更准
        </motion.h2>

        {/* Support copy */}
        <motion.p
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1 }}
          transition={shouldReduceMotion ? undefined : { duration: 0.4, delay: 0.2 }}
          className="mt-3 px-4 text-center text-sm leading-relaxed text-white/55"
        >
          这些信息不是必填，但补充之后，我们会更容易帮你找到更合拍的同桌。
        </motion.p>

        {/* Benefit chips */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {benefitChips.map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-violet-500/20 px-3 py-0.5 text-xs font-semibold text-violet-300 ring-1 ring-violet-400/30"
            >
              {chip}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div className="mt-8 w-full max-w-sm space-y-3">
          {/* Primary */}
          <Button
            onClick={onFillProfile}
            size="lg"
            className="h-14 w-full rounded-2xl border-0 bg-gradient-to-r from-purple-600 to-violet-500 text-base font-semibold text-white shadow-lg shadow-purple-900/40 transition-all duration-200 hover:from-purple-700 hover:to-violet-600 active:scale-[0.98]"
          >
            去补充资料
            <ChevronRight className="ml-2 h-5 w-5" aria-hidden="true" />
          </Button>

          {/* Secondary */}
          <Button
            onClick={onSkip}
            variant="ghost"
            size="lg"
            className="h-12 w-full rounded-2xl text-sm font-medium text-white/55 hover:bg-white/10 hover:text-white/90"
          >
            先跳过
          </Button>
        </div>

        {/* Helper text */}
        <p className="mt-5 px-6 text-center text-[11px] leading-relaxed text-white/30">
          你也可以稍后再填写
        </p>
      </div>
    </div>
  );
}

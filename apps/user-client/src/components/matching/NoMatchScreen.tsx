import { motion, useReducedMotion } from "framer-motion";
import { Bell, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import MatchingStateLayout from "./MatchingStateLayout";
import noMatchHero from "@/assets/matching/no-match/no-match-hero.svg";
import NoMatchRecommendations, {
  type NoMatchRecommendation,
} from "@/components/matching/NoMatchRecommendations";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NoMatchScreenProps {
  /** Pool title shown in the header. */
  poolTitle?: string;
  /** Called when the user taps "成局后通知我". */
  onNotify?: () => void;
  /** Called when the user taps "看看别的活动". */
  onBrowse?: () => void;
  /** Called when the user taps the back arrow. */
  onBack?: () => void;
  recommendations?: NoMatchRecommendation[];
  onJoinRecommendation?: (poolId: string) => void;
  originalBudget?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NoMatchScreen({
  poolTitle,
  onNotify,
  onBrowse,
  onBack,
  recommendations = [],
  onJoinRecommendation,
  originalBudget = null,
}: NoMatchScreenProps) {
  const shouldReduceMotion = useReducedMotion();
  const shouldShowNotifyButton = Boolean(onNotify);
  const hasRecommendations = recommendations.length > 0;

  // ── Slot: Hero ──────────────────────────────────────────────────────────────
  const heroSlot = (
    <div className="flex w-full max-w-[320px] justify-center">
      <motion.img
        src={noMatchHero}
        alt="暂无合适的局"
        className="h-auto w-full max-w-[240px] object-contain drop-shadow-2xl"
        animate={shouldReduceMotion ? {} : { y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );

  // ── Slot: Copy ───────────────────────────────────────────────────────────────
  const copySlot = (
    <>
      {/* Status chip */}
      <span className="mt-5 inline-block rounded-full bg-white/10 px-3 py-0.5 text-xs font-semibold text-white/70 ring-1 ring-white/20">
        建议 4–6 人成局
      </span>

      {/* Eyebrow */}
      <p className="mt-4 text-center text-xs font-medium uppercase tracking-widest text-white/45">
        Not this one — but we've got you
      </p>

      {/* Headline */}
      <motion.h2
        initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
        animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={
          shouldReduceMotion
            ? undefined
            : { type: "spring", stiffness: 300, damping: 26, delay: 0.1 }
        }
        className="mt-3 text-center text-[22px] font-black leading-tight tracking-tight text-white"
      >
        这次没凑齐 — 没关系，好局值得等
      </motion.h2>

      {/* Support copy */}
      <motion.p
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={shouldReduceMotion ? undefined : { opacity: 1 }}
        transition={shouldReduceMotion ? undefined : { duration: 0.4, delay: 0.25 }}
        className="mt-3 px-4 text-center text-sm leading-relaxed text-white/55"
      >
          {hasRecommendations
            ? "小悦已经记住了你的口味。下面这些新局，和你刚才选的感觉很接近。"
            : "你的偏好我们先替你收好了。与其硬凑一桌，不如把这份期待留给更对味的人。"}
      </motion.p>

      {hasRecommendations && (
        <NoMatchRecommendations
          items={recommendations}
          originalBudget={originalBudget}
          onJoin={(poolId) => onJoinRecommendation?.(poolId)}
        />
      )}
    </>
  );

  // ── Slot: CTA ────────────────────────────────────────────────────────────────
  const ctaSlot = (
    <div className="mt-8 w-full max-w-sm space-y-3">
      {shouldShowNotifyButton && (
        <Button
          onClick={onNotify}
          size="lg"
          className="h-14 w-full rounded-2xl border-0 bg-gradient-to-r from-purple-600 to-violet-500 text-base font-semibold text-white shadow-lg shadow-purple-900/40 transition-all duration-200 hover:from-purple-700 hover:to-violet-600 active:scale-[0.98]"
        >
          <Bell className="mr-2 h-5 w-5" aria-hidden="true" />
          下次有相似局先通知我
        </Button>
      )}

      {/* Secondary */}
      <Button
        onClick={onBrowse}
        variant="ghost"
        size="lg"
        className="h-12 w-full rounded-2xl text-sm font-medium text-white/55 hover:bg-white/10 hover:text-white/90"
      >
        {hasRecommendations ? "去发现更多活动" : "看看别的活动"}
        <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
      </Button>

      {/* Tertiary text link */}
      <button
        type="button"
        onClick={onBack}
        className="mx-auto block text-xs text-white/30 hover:text-white/55 transition-colors"
      >
        稍后再说
      </button>
    </div>
  );

  return (
    <MatchingStateLayout
      onBack={onBack}
      title={poolTitle}
      hero={heroSlot}
      copy={copySlot}
      cta={ctaSlot}
    />
  );
}

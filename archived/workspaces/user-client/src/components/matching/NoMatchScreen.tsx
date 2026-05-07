import { motion, useReducedMotion } from "framer-motion";
import { Bell, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import MatchingStateLayout from "./MatchingStateLayout";
import noMatchHero from "@/assets/matching/no-match/no-match-hero.svg";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimilarPool {
  id: string;
  title: string;
  eventType: string;
  city: string;
  district: string | null;
  dateTime: string;
  registrationCount: number;
}

export interface NoMatchScreenProps {
  /** Pool title shown in the header. */
  poolTitle?: string;
  /** Called when the user taps "成桌后通知我". */
  onNotify?: () => void;
  /** Called when the user taps "看看别的活动". */
  onBrowse?: () => void;
  /** Called when the user taps the back arrow. */
  onBack?: () => void;
  /** Similar open pools to show as quick rejoin cards */
  similarPools?: SimilarPool[];
  /** Called with the pool ID when user taps a quick-rejoin card */
  onRejoin?: (poolId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NoMatchScreen({
  poolTitle,
  onNotify,
  onBrowse,
  onBack,
  similarPools,
  onRejoin,
}: NoMatchScreenProps) {
  const shouldReduceMotion = useReducedMotion();
  const shouldShowNotifyButton = Boolean(onNotify);

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
        建议 4–6 人成桌
      </span>

      {/* Eyebrow */}
      <p className="mt-4 text-center text-xs font-medium uppercase tracking-widest text-white/45">
        暂时还没有合适的一桌
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
        先别急，我们在等更对味的人齐
      </motion.h2>

      {/* Support copy */}
      <motion.p
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={shouldReduceMotion ? undefined : { opacity: 1 }}
        transition={shouldReduceMotion ? undefined : { duration: 0.4, delay: 0.25 }}
        className="mt-3 px-4 text-center text-sm leading-relaxed text-white/55"
      >
        这场局我们还在慢慢凑人。与其随便把你塞进一桌，不如等一个更聊得来的组合。
      </motion.p>
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
          成桌后通知我
        </Button>
      )}

      {/* Secondary */}
      <Button
        onClick={onBrowse}
        variant="ghost"
        size="lg"
        className="h-12 w-full rounded-2xl text-sm font-medium text-white/55 hover:bg-white/10 hover:text-white/90"
      >
        看看别的活动
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

  // ── Slot: Footer (similar pools) ─────────────────────────────────────────────
  const footerSlot =
    similarPools && similarPools.length > 0 ? (
      <div className="mt-6 w-full max-w-sm">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-white/40">
          附近还有这些局
        </p>
        <div className="space-y-2">
          {similarPools.map((pool) => (
            <button
              key={pool.id}
              type="button"
              onClick={() => onRejoin?.(pool.id)}
              className="w-full rounded-2xl bg-white/8 px-4 py-3 text-left ring-1 ring-white/15 transition-colors hover:bg-white/12 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <p className="text-sm font-semibold text-white/90 line-clamp-1">{pool.title}</p>
              <p className="mt-0.5 text-xs text-white/45">
                {pool.eventType} · {pool.city}
                {pool.district ? ` ${pool.district}` : ""} · {pool.registrationCount} 人已入座
              </p>
            </button>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <MatchingStateLayout
      onBack={onBack}
      title={poolTitle}
      hero={heroSlot}
      copy={copySlot}
      cta={ctaSlot}
      footer={footerSlot}
    />
  );
}

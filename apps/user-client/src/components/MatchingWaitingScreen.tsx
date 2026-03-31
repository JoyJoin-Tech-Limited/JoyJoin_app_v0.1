import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Bell, ChevronRight, RefreshCw, ArrowLeft, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import matchingWaitingBg from "@/assets/matching-waiting/matching-waiting-bg.svg";
import matchingWaitingHero from "@/assets/matching-waiting/matching-waiting-hero.svg";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MIN_GROUP_SIZE = 4;
const DEFAULT_MAX_GROUP_SIZE = 6;
const DEFAULT_REFRESH_INTERVAL_SECONDS = 20;

// ─── Types ────────────────────────────────────────────────────────────────────

type FillState = "waiting" | "can_form" | "full";

interface StateCopy {
  headline: string;
  subtext: string;
  badge: string | null;
  badgeGradient: string;
}

export interface MatchingWaitingScreenProps {
  /** Pool title shown in the header. */
  poolTitle?: string;
  /** Number of seats currently filled. */
  filledCount: number;
  /** Minimum seats needed to form a group (default 4). */
  minGroupSize?: number;
  /** Maximum / ideal group size (default 6). */
  maxGroupSize?: number;
  /**
   * Auto-refresh interval in seconds.
   * When the countdown reaches 0, `onRefresh` is called and the timer resets.
   * Defaults to 20.
   */
  refreshIntervalSeconds?: number;
  /** Called when the auto-refresh countdown expires or the user manually refreshes. */
  onRefresh?: () => void;
  /** Primary CTA: invite friends to speed up forming a group. */
  onInvite?: () => void;
  /** @deprecated Use `onInvite` for the invite CTA. */
  onNotify?: () => void;
  /** Secondary CTA: browse while waiting. */
  onBrowse?: () => void;
  /** Called after the user confirms cancellation in the cancel dialog. */
  onCancel?: () => void;
  /** Whether the cancel mutation is pending (disables the confirm button). */
  isCancelling?: boolean;
  /** Called when the user taps the back arrow. */
  onBack?: () => void;
  /** Whether a new member just joined (triggers micro-interaction). */
  newMemberJoined?: boolean;
  /** Archetype name of the new member (optional, shown in micro-interaction). */
  newMemberArchetype?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFillState(
  filledCount: number,
  minGroupSize: number,
  maxGroupSize: number,
): FillState {
  if (filledCount >= maxGroupSize) return "full";
  if (filledCount >= minGroupSize) return "can_form";
  return "waiting";
}

function getCopy(
  fillState: FillState,
  filledCount: number,
  minGroupSize: number,
  maxGroupSize: number,
): StateCopy {
  switch (fillState) {
    case "full":
      return {
        headline: "人数已满！即将组队 🎉",
        subtext: "小悦正在精心配对，很快就能和新朋友见面啦！",
        badge: "满员",
        badgeGradient: "from-emerald-500/80 to-green-400/80",
      };
    case "can_form": {
      const remaining = maxGroupSize - filledCount;
      return {
        headline: `已可成团！再等 ${remaining} 人更完美`,
        subtext: "人数已达门槛，小悦持续寻找最佳搭配组合中。",
        badge: "可成团",
        badgeGradient: "from-amber-500/80 to-yellow-400/80",
      };
    }
    case "waiting":
    default: {
      const need = minGroupSize - filledCount;
      return {
        headline: `再来 ${need} 位伙伴就能成局`,
        subtext: "小悦正在为你寻找气场相符的伙伴，稍等片刻。",
        badge: null,
        badgeGradient: "",
      };
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchingWaitingScreen({
  poolTitle,
  filledCount,
  minGroupSize = DEFAULT_MIN_GROUP_SIZE,
  maxGroupSize = DEFAULT_MAX_GROUP_SIZE,
  refreshIntervalSeconds = DEFAULT_REFRESH_INTERVAL_SECONDS,
  onRefresh,
  onInvite,
  onNotify,
  onBrowse,
  onCancel,
  isCancelling = false,
  onBack,
  newMemberJoined = false,
  newMemberArchetype = null,
}: MatchingWaitingScreenProps) {
  const [refreshCountdown, setRefreshCountdown] = useState(refreshIntervalSeconds);
  const shouldReduceMotion = useReducedMotion();
  const normalizedMaxGroupSize = Math.max(1, Math.floor(maxGroupSize));
  const normalizedMinGroupSize = Math.min(
    normalizedMaxGroupSize,
    Math.max(1, Math.floor(minGroupSize)),
  );
  const displayFilledCount = Math.min(
    normalizedMaxGroupSize,
    Math.max(0, Math.floor(filledCount)),
  );
  const primaryInviteHandler = onInvite ?? onNotify;

  const fillState = getFillState(
    displayFilledCount,
    normalizedMinGroupSize,
    normalizedMaxGroupSize,
  );
  const copy = getCopy(
    fillState,
    displayFilledCount,
    normalizedMinGroupSize,
    normalizedMaxGroupSize,
  );

  // Reset countdown when the refresh interval prop changes.
  useEffect(() => {
    setRefreshCountdown(refreshIntervalSeconds);
  }, [refreshIntervalSeconds]);

  // Auto-refresh countdown: counts down to 0 then fires onRefresh.
  useEffect(() => {
    if (refreshCountdown <= 0) {
      onRefresh?.();
      setRefreshCountdown(refreshIntervalSeconds);
      return;
    }
    const timer = setTimeout(() => setRefreshCountdown((c) => c - 1), 1_000);
    return () => clearTimeout(timer);
  }, [refreshCountdown, refreshIntervalSeconds, onRefresh]);

  // Reset countdown when a new member joins so the user sees fresh data quickly.
  useEffect(() => {
    if (newMemberJoined) {
      setRefreshCountdown(refreshIntervalSeconds);
    }
  }, [newMemberJoined, refreshIntervalSeconds]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ── Background SVG ── */}
      <img
        src={matchingWaitingBg}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
      />
      {/* Dark scrim for readability */}
      <div className="absolute inset-0 bg-[#0D0A1A]/75" />

      {/* ── Header ── */}
      <div className="relative z-20 flex items-center h-14 px-4 pt-safe">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="text-white/70 hover:text-white hover:bg-white/10"
            aria-label="返回"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        {poolTitle && (
          <h1 className="ml-2 flex-1 text-sm font-semibold text-white/90 line-clamp-1">
            {poolTitle}
          </h1>
        )}
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 flex flex-col items-center px-5 pb-12 pt-4">
        {/* Hero illustration + new-member micro-interaction */}
        <div className="relative flex w-full max-w-[320px] justify-center">
          <AnimatePresence>
            {newMemberJoined && (
              <motion.div
                key="new-member-toast"
                initial={{ y: -50, opacity: 0, scale: 0.85 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -30, opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
                className="absolute -top-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-2xl bg-white/95 px-4 py-2 shadow-xl backdrop-blur-sm flex items-center gap-2"
              >
                <span className="text-lg" aria-hidden="true">✨</span>
                <p className="text-sm font-bold text-gray-900">
                  {newMemberArchetype ? `${newMemberArchetype} 加入了！` : "新朋友加入！"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.img
            src={matchingWaitingHero}
            alt="匹配等待中的插画"
            className="h-auto w-full max-w-[260px] object-contain drop-shadow-2xl"
            animate={shouldReduceMotion ? {} : { y: [0, -8, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* Status badge */}
        <AnimatePresence mode="wait">
          {copy.badge && (
            <motion.span
              key={copy.badge}
              initial={{ opacity: 0, scale: 0.75 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.75 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={`mt-5 inline-block rounded-full bg-gradient-to-r ${copy.badgeGradient} px-3 py-0.5 text-xs font-semibold text-white shadow-md`}
            >
              {copy.badge}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Headline */}
        <AnimatePresence mode="wait">
          <motion.h2
            key={`headline-${fillState}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="mt-4 text-center text-[22px] font-black leading-tight tracking-tight text-white"
          >
            {copy.headline}
          </motion.h2>
        </AnimatePresence>

        {/* Subtext */}
        <AnimatePresence mode="wait">
          <motion.p
            key={`sub-${fillState}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-2 px-4 text-center text-sm leading-relaxed text-white/55"
          >
            {copy.subtext}
          </motion.p>
        </AnimatePresence>

        {/* ── Segmented progress bar ── */}
        <div className="mt-8 w-full max-w-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-white/50">匹配进度</span>
            <span className="text-xs font-bold text-white/80">
              {displayFilledCount}&thinsp;/&thinsp;{normalizedMaxGroupSize} 人
            </span>
          </div>

          {/*
           * 6 segments. The segment at index (minGroupSize - 1) is the minimum-
           * threshold segment and is rendered slightly taller with an amber label.
           * Segments beyond the threshold (indices >= minGroupSize) are "bonus"
           * seats and rendered at medium height.
           */}
          <div className="flex items-end gap-1.5" role="progressbar" aria-valuenow={displayFilledCount} aria-valuemin={0} aria-valuemax={normalizedMaxGroupSize} aria-label={`已有 ${displayFilledCount} 人，共 ${normalizedMaxGroupSize} 个席位`} aria-valuetext={`${displayFilledCount} 人已加入，共 ${normalizedMaxGroupSize} 个席位${displayFilledCount < normalizedMinGroupSize ? `，还需 ${normalizedMinGroupSize - displayFilledCount} 人可成局` : displayFilledCount < normalizedMaxGroupSize ? "，已可成团" : "，人数已满"}`}>
            {Array.from({ length: normalizedMaxGroupSize }).map((_, i) => {
              const isFilled = i < displayFilledCount;
              const isThreshold = i === normalizedMinGroupSize - 1;
              const isBonus = i >= normalizedMinGroupSize;

              const barHeight = isThreshold ? "h-6" : isBonus ? "h-5" : "h-4";
              const filledGradient = isThreshold
                ? "bg-gradient-to-b from-amber-300 to-amber-500 shadow-sm shadow-amber-400/40"
                : "bg-gradient-to-b from-violet-400 to-purple-600 shadow-sm shadow-purple-500/30";
              const emptyStyle = "bg-white/15";

              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  {/* Threshold label sits above the 4th segment */}
                  <span
                    className={`text-[9px] font-semibold leading-none ${
                      isThreshold ? "text-amber-400" : "invisible"
                    }`}
                    aria-hidden="true"
                  >
                    最少成局
                  </span>

                  <motion.div
                    className={`w-full rounded-full ${barHeight} ${isFilled ? filledGradient : emptyStyle}`}
                    initial={false}
                    animate={isFilled && !shouldReduceMotion ? { scaleY: [0.6, 1.08, 1] } : { scaleY: 1 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Auto-refresh countdown */}
        <div className="mt-5 flex items-center gap-1.5 text-white/35 text-xs">
          <RefreshCw
            className={`h-3 w-3 ${shouldReduceMotion ? "" : "refresh-spin"}`}
            aria-hidden="true"
          />
          <span>{refreshCountdown} 秒后自动刷新</span>
        </div>

        {/* ── CTAs ── */}
        <div className="mt-8 w-full max-w-sm space-y-3">
          {/* Primary: invite / notify */}
          <Button
            onClick={primaryInviteHandler}
            size="lg"
            className="h-14 w-full rounded-2xl border-0 bg-gradient-to-r from-purple-600 to-violet-500 text-base font-semibold text-white shadow-lg shadow-purple-900/40 transition-all duration-200 hover:from-purple-700 hover:to-violet-600 active:scale-[0.98]"
          >
            <Bell className="mr-2 h-5 w-5" aria-hidden="true" />
            邀请好友加速成团
          </Button>

          {/* Secondary: browse */}
          <Button
            onClick={onBrowse}
            variant="ghost"
            size="lg"
            className="h-12 w-full rounded-2xl text-sm font-medium text-white/55 hover:bg-white/10 hover:text-white/90"
          >
            先去逛逛其他活动
            <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Button>

          {/* Cancel (destructive, behind confirmation dialog) */}
          {onCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full rounded-xl text-xs font-medium text-white/30 hover:bg-white/5 hover:text-white/50"
                >
                  <XCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  取消匹配
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认取消匹配？</AlertDialogTitle>
                  <AlertDialogDescription>
                    取消后需要重新报名才能参加此活动池。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>不取消</AlertDialogCancel>
                  <AlertDialogAction onClick={onCancel} disabled={isCancelling}>
                    {isCancelling ? "取消中…" : "确认取消"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Footer reassurance */}
        <p className="mt-8 px-6 text-center text-[11px] leading-relaxed text-white/30">
          你已在队列中，无需重新报名。有结果时我们会立即通知你。
        </p>
      </div>

      {/* CSS-only keyframe for the refresh icon spin */}
      <style>{`
        .refresh-spin {
          animation: mws-spin 3s linear infinite;
        }
        @keyframes mws-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .refresh-spin { animation: none; }
        }
      `}</style>
    </div>
  );
}

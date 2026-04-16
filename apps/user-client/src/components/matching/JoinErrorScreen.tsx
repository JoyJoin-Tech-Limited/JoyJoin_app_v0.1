import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import matchingBg from "@/assets/matching/shared/matching-bg.svg";
import joinErrorHero from "@/assets/matching/join-error/join-error-hero.svg";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JoinErrorScreenProps {
  /** Visual variant for the recovery state. */
  variant?: "generic" | "entitlement";
  /** Called when the user taps the primary action. */
  onPrimary?: () => void;
  /** Called when the user taps the secondary action. */
  onSecondary?: () => void;
  /** Whether the primary action is in progress. */
  isPrimaryPending?: boolean;
  /** Optional copy overrides. */
  statusLabel?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  helperText?: string;
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
  variant = "generic",
  onPrimary,
  onSecondary,
  isPrimaryPending = false,
  statusLabel,
  eyebrow,
  title,
  description,
  primaryLabel,
  secondaryLabel,
  helperText,
}: JoinErrorScreenProps) {
  const shouldReduceMotion = useReducedMotion();
  const isEntitlementVariant = variant === "entitlement";

  const resolvedStatusLabel =
    statusLabel ??
    (isEntitlementVariant ? "你的偏好已经保留" : "当前还没有为你保留位置");
  const resolvedEyebrow =
    eyebrow ?? (isEntitlementVariant ? "继续完成这场报名" : "这次还没加入成功");
  const resolvedTitle =
    title ?? (isEntitlementVariant ? "先补上权益，再回来继续" : "系统刚刚开了个小差");
  const resolvedDescription =
    description ??
    (isEntitlementVariant
      ? "你刚填写的预算和偏好不会丢。完成支付确认后，系统会把你带回这场报名继续提交。"
      : "你的席位还没有锁定成功。可以稍后再试一次，我们会尽量接着刚才的进度继续。");
  const resolvedPrimaryLabel =
    primaryLabel ?? (isEntitlementVariant ? "开通权益并继续报名" : "再试一次");
  const resolvedSecondaryLabel =
    secondaryLabel ?? (isEntitlementVariant ? "稍后再说" : "返回看看其他活动");
  const resolvedHelperText =
    helperText ??
    (isEntitlementVariant
      ? "这次继续模式只会带你回到刚才那场报名，其他支付入口不会自动接管这份草稿。"
      : "如果网络不太稳定，稍等片刻再试会更顺利");

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
          alt={isEntitlementVariant ? "继续报名" : "加入失败"}
          className="h-auto w-full max-w-[200px] object-contain drop-shadow-2xl"
          animate={shouldReduceMotion ? {} : { y: [0, -5, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Status chip */}
        <span
          className={[
            "mt-5 inline-block rounded-full px-3 py-0.5 text-xs font-semibold ring-1",
            isEntitlementVariant
              ? "bg-emerald-500/20 text-emerald-200 ring-emerald-300/30"
              : "bg-rose-500/20 text-rose-300 ring-rose-400/30",
          ].join(" ")}
        >
          {resolvedStatusLabel}
        </span>

        {/* Eyebrow */}
        <p className="mt-4 text-center text-xs font-medium uppercase tracking-widest text-white/45">
          {resolvedEyebrow}
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
          {resolvedTitle}
        </motion.h2>

        {/* Support copy */}
        <motion.p
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1 }}
          transition={shouldReduceMotion ? undefined : { duration: 0.4, delay: 0.2 }}
          className="mt-3 px-4 text-center text-sm leading-relaxed text-white/55"
        >
          {resolvedDescription}
        </motion.p>

        {/* CTAs */}
        <div className="mt-8 w-full max-w-sm space-y-3">
          {/* Primary */}
          <Button
            onClick={onPrimary}
            disabled={isPrimaryPending}
            size="lg"
            className={[
              "h-14 w-full rounded-2xl border-0 text-base font-semibold text-white shadow-lg transition-all duration-200 active:scale-[0.98] disabled:opacity-60",
              isEntitlementVariant
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-950/30 hover:from-emerald-600 hover:to-teal-600"
                : "bg-gradient-to-r from-purple-600 to-violet-500 shadow-purple-900/40 hover:from-purple-700 hover:to-violet-600",
            ].join(" ")}
          >
            {isPrimaryPending ? (
              <>
                <RefreshCw className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                {isEntitlementVariant ? "处理中…" : "重试中…"}
              </>
            ) : (
              <>
                {isEntitlementVariant ? (
                  <Sparkles className="mr-2 h-5 w-5" aria-hidden="true" />
                ) : (
                  <RefreshCw className="mr-2 h-5 w-5" aria-hidden="true" />
                )}
                {resolvedPrimaryLabel}
              </>
            )}
          </Button>

          {/* Secondary */}
          <Button
            onClick={onSecondary}
            variant="ghost"
            size="lg"
            className="h-12 w-full rounded-2xl text-sm font-medium text-white/55 hover:bg-white/10 hover:text-white/90"
          >
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
            {resolvedSecondaryLabel}
          </Button>
        </div>

        {/* Helper text */}
        <p className="mt-5 px-6 text-center text-[11px] leading-relaxed text-white/30">
          {resolvedHelperText}
        </p>
      </div>
    </div>
  );
}

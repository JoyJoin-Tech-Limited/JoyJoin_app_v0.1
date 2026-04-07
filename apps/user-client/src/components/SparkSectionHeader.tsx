/**
 * SparkSectionHeader
 *
 * Branded atmospheric header for the front-door event-card section.
 * Replaces the generic "盲盒模式" label with a more JoyJoin-distinctive
 * visual treatment: eyebrow + headline + subline, with a subtle animated
 * presence indicator.
 *
 * Design notes:
 *   - Eyebrow: small uppercase descriptor (e.g. "你的专属圈")
 *   - Headline: main brand-voice statement
 *   - Subline: one-line mechanic cue (keeps the mystery)
 *   - Presence dot: animated pulse showing live pool activity
 *   - Reduced-motion: dot pulse is suppressed
 */

import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface SparkSectionHeaderProps {
  eventCount?: number;
  city?: string;
  className?: string;
}

export default function SparkSectionHeader({
  eventCount,
  city,
  className = "",
}: SparkSectionHeaderProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="space-y-0.5">
        {/* Eyebrow */}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          <span>今晚的圈子</span>
        </p>

        {/* Headline */}
        <h2 className="text-base font-bold text-foreground leading-snug">
          {city ? `${city}·等你出现` : "有人等你，猜猜是谁"}
        </h2>

        {/* Subline — mechanic cue */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          报名后 AI 帮你找到最合拍的桌友&nbsp;🎲
        </p>
      </div>

      {/* Live activity indicator */}
      {typeof eventCount === "number" && eventCount > 0 && (
        <div className="flex items-center gap-1.5 shrink-0 pt-1">
          <span className="relative flex h-2 w-2">
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full bg-primary/70"
              animate={prefersReducedMotion ? {} : { scale: [1, 1.8, 1], opacity: [0.7, 0, 0.7] }}
              transition={prefersReducedMotion ? {} : { duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <span className="text-[11px] font-semibold text-primary/80">
            {eventCount} 场进行中
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * SparkSectionHeader
 *
 * Wave 3 front-door atmospheric header for the event discovery section.
 * Replaces the generic "盲盒模式" label with a premium, brand-aligned moment
 * that creates anticipation before users see the event cards.
 *
 * Wow element: the tagline fades in after a short delay, creating a brief pause
 * of curiosity before the card list loads. The live pulse indicator signals
 * real social activity happening right now.
 *
 * Accessibility: motion is fully gated behind prefers-reduced-motion.
 */

import { motion, useReducedMotion } from "framer-motion";

interface SparkSectionHeaderProps {
  /** Total number of people currently registered across shown pools. */
  liveCount?: number;
  className?: string;
}

export function SparkSectionHeader({
  liveCount,
  className = "",
}: SparkSectionHeaderProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={`flex items-start justify-between gap-2 ${className}`}>
      {/* Left: headline + tagline */}
      <div className="flex flex-col gap-0.5">
        <motion.div
          className="flex items-center gap-2"
          initial={reduceMotion ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <span
            className="text-sm font-bold tracking-wide text-foreground"
            aria-label="今日盲盒活动"
          >
            ✦ 今日盲盒
          </span>
        </motion.div>

        <motion.p
          className="text-xs text-muted-foreground/80 leading-snug"
          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: reduceMotion ? 0 : 0.12, ease: "easeOut" }}
        >
          你还不知道，是谁在等你
        </motion.p>
      </div>

      {/* Right: live pulse indicator */}
      {liveCount !== undefined && liveCount > 0 && (
        <motion.div
          className="flex items-center gap-1.5 shrink-0"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
          aria-label={`${liveCount} 人正在报名`}
        >
          {/* Pulsing live dot */}
          <span className="relative flex h-2 w-2" aria-hidden="true">
            {!reduceMotion && (
              <motion.span
                className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"
                animate={{ scale: [1, 1.8, 1], opacity: [0.75, 0, 0.75] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
            {liveCount} 人在场
          </span>
        </motion.div>
      )}
    </div>
  );
}

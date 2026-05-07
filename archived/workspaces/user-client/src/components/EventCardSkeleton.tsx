/**
 * EventCardSkeleton
 *
 * Launch-grade shimmer skeleton for the BlindBoxEventCard.
 * Replaces the generic spinner with a premium loading experience that
 * communicates card structure while maintaining intrigue.
 *
 * Design notes:
 *   - Mimics the card layout (title area, badges, momentum bar, CTA)
 *   - Uses framer-motion opacity pulse (consistent with QuestionSkeleton pattern)
 *   - Reduced-motion: shows static skeleton without the shimmer pulse
 *   - Aria-label makes the loading state screen-reader accessible
 */

import { motion, useReducedMotion } from "framer-motion";

interface EventCardSkeletonProps {
  className?: string;
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      className={`rounded-md bg-muted/50 ${className}`}
      animate={prefersReducedMotion ? {} : { opacity: [0.5, 1, 0.5] }}
      transition={prefersReducedMotion ? {} : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export default function EventCardSkeleton({ className = "" }: EventCardSkeletonProps) {
  return (
    <div
      className={`h-[240px] rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-3 ${className}`}
      aria-busy="true"
      aria-label="活动正在加载中"
      role="status"
    >
      {/* Title block */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <SkeletonBlock className="h-5 w-3/4" />
          <SkeletonBlock className="h-4 w-1/2" />
        </div>
        <SkeletonBlock className="h-6 w-16 rounded-full" />
      </div>

      {/* Location row */}
      <SkeletonBlock className="h-4 w-2/5" />

      {/* Momentum visual */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} className="h-8 w-8 rounded-full" />
        ))}
        <SkeletonBlock className="h-6 w-12 rounded-full ml-1" />
      </div>

      {/* Vibe badges */}
      <div className="flex items-center gap-1.5">
        <SkeletonBlock className="h-5 w-20 rounded-full" />
        <SkeletonBlock className="h-5 w-16 rounded-full" />
      </div>

      {/* CTA row */}
      <div className="flex gap-2 mt-auto">
        <SkeletonBlock className="h-10 flex-1" />
        <SkeletonBlock className="h-10 w-10" />
      </div>
    </div>
  );
}

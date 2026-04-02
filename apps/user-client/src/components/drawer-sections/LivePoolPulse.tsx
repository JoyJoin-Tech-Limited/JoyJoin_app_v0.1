/**
 * LivePoolPulse
 * Phase 2: Refined live pool activity indicator.
 *
 * Communicates that the pool is alive and current without misleading queue
 * terminology.  Designed to sit at the top of the "pool" tab in the drawer.
 *
 * Two display modes:
 *  1. "recently arrived" burst  — shown when `recentArrivals` > 0 (arrivals
 *     observed via WebSocket since the user opened the drawer).
 *  2. "pool active" baseline    — shown at all times as a subtle freshness cue.
 *
 * Constraints respected:
 *  - No per-card real-time subscription cost (data comes from the existing
 *    15 s poll + WebSocket already wired in EventPoolDetailDrawer).
 *  - No misleading "queue" or capacity language.
 *  - Reduced-motion: animations use `prefers-reduced-motion` via Framer Motion's
 *    `reducedMotion` prop which gracefully strips transforms.
 */
import { motion, useReducedMotion } from "framer-motion";

interface LivePoolPulseProps {
  /** Number of POOL_REGISTRATION_ADDED WebSocket events received since drawer opened. */
  recentArrivals: number;
  /** Total registrations in the pool. */
  totalRegistrations: number;
}

export default function LivePoolPulse({
  recentArrivals,
  totalRegistrations,
}: LivePoolPulseProps) {
  const shouldReduceMotion = useReducedMotion();

  const hasRecentActivity = recentArrivals > 0;

  // Activity intensity label derived from total pool size
  let intensityLabel: string;
  if (totalRegistrations >= 20) intensityLabel = "热度飙升";
  else if (totalRegistrations >= 10) intensityLabel = "人气旺盛";
  else if (totalRegistrations >= 4) intensityLabel = "活动中";
  else intensityLabel = "正在聚集";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="flex items-center justify-between mb-5 px-1"
    >
      {/* Left: pulse dot + activity label */}
      <div className="flex items-center gap-2">
        {/* Pulsing green dot */}
        <div className="relative flex items-center justify-center w-4 h-4">
          {!shouldReduceMotion && (
            <motion.div
              className="absolute inset-0 rounded-full bg-green-500/30"
              animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <div className="w-2 h-2 rounded-full bg-green-500 relative z-10" />
        </div>

        <span className="text-xs font-semibold text-green-600 dark:text-green-400">
          {intensityLabel}
        </span>
      </div>

      {/* Right: recent arrivals burst (shown only when activity observed) */}
      {hasRecentActivity && (
        <motion.div
          key={recentArrivals}
          initial={{ opacity: 0, scale: 0.75, x: 6 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/25"
        >
          <span className="text-[10px] leading-none" aria-hidden="true">🎉</span>
          <span className="text-[10px] font-bold text-green-600 dark:text-green-400">
            +{recentArrivals} 刚刚加入
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

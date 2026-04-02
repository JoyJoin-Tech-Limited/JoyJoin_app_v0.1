/**
 * EmergingGroupsPanel
 * Phase 2: Visualises the blind-box social circles / clusters that are actively
 * taking shape inside a pool.  Uses `estimatedGroups` to communicate "circles
 * forming" — NOT "seats filling up".  No single-group progress bar or capacity
 * metaphor is used here.
 *
 * Answers: "Are real circles actually forming in this pool?"
 */
import { motion } from "framer-motion";

interface EmergingGroupsPanelProps {
  estimatedGroups: number;
  totalRegistrations: number;
}

/** Max cluster icons rendered — keeps layout clean on mobile. */
const MAX_RENDERED_CLUSTERS = 6;

/** Mini social-circle cluster icon rendered for each estimated group. */
function ClusterIcon({ index }: { index: number }) {
  const dotAngles = [0, 90, 180, 270]; // 4 person-dots arranged in a ring

  return (
    <motion.div
      className="relative"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: index * 0.08, duration: 0.35, ease: "easeOut" }}
    >
      <div className="relative w-12 h-12 flex items-center justify-center">
        {/* Soft glow halo */}
        <motion.div
          className="absolute inset-0 rounded-full bg-violet-400/15 dark:bg-violet-400/10"
          animate={{ scale: [1, 1.18, 1] }}
          transition={{
            duration: 3.2 + index * 0.35,
            repeat: Infinity,
            ease: "easeInOut",
            delay: index * 0.55,
          }}
        />

        {/* Person dots arranged in a ring */}
        {dotAngles.map((deg, j) => {
          const rad = (deg * Math.PI) / 180;
          const r = 13;
          const x = Math.cos(rad) * r;
          const y = Math.sin(rad) * r;
          return (
            <motion.div
              key={j}
              className="absolute w-3.5 h-3.5 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 border border-white dark:border-gray-800 shadow-sm"
              style={{
                left: `calc(50% + ${x}px - 7px)`,
                top: `calc(50% + ${y}px - 7px)`,
              }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{
                duration: 2.6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: j * 0.28 + index * 0.18,
              }}
            />
          );
        })}

        {/* Centre dot — the "core" of the circle */}
        <div className="w-2 h-2 rounded-full bg-violet-600 dark:bg-violet-300 z-10 shadow-sm" />
      </div>
    </motion.div>
  );
}

export default function EmergingGroupsPanel({
  estimatedGroups,
  totalRegistrations,
}: EmergingGroupsPanelProps) {
  // Nothing meaningful to show when no one has joined yet.
  if (totalRegistrations === 0) return null;

  const groupCount = Math.max(0, estimatedGroups);
  const renderedClusters = Math.min(groupCount, MAX_RENDERED_CLUSTERS);
  const overflow = groupCount - MAX_RENDERED_CLUSTERS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm mb-5 overflow-hidden"
    >
      <div className="px-4 py-4 bg-gradient-to-br from-violet-50 via-white to-purple-50 dark:from-violet-950/30 dark:via-gray-900 dark:to-purple-950/20">
        {/* Section label */}
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-500/70 dark:text-violet-400/60 mb-3">
          圈子动态
        </p>

        {groupCount === 0 ? (
          /* Pool is active but no fully formed groups estimated yet */
          <div className="flex items-center gap-3">
            {/* Placeholder bubbles hinting at future circles */}
            <div className="flex -space-x-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-7 h-7 rounded-full bg-violet-200/80 dark:bg-violet-800/40 border-2 border-white dark:border-gray-900 flex items-center justify-center"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.7 + i * 0.1 }}
                  transition={{ delay: i * 0.1, duration: 0.3, ease: "easeOut" }}
                >
                  <span className="text-[10px]">✨</span>
                </motion.div>
              ))}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                活动池聚集中
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                已有 {totalRegistrations} 人报名，圈子正在成形
              </p>
            </div>
          </div>
        ) : (
          /* One or more estimated groups — show cluster visualisation */
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">
                  {groupCount} 个圈子正在形成
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  基于 {totalRegistrations} 人的匹配分析
                </p>
              </div>

              {/* Live active badge */}
              <motion.div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20"
                animate={{ opacity: [1, 0.65, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">
                  活跃中
                </span>
              </motion.div>
            </div>

            {/* Cluster icons */}
            <div className="flex items-center gap-2 flex-wrap">
              {Array.from({ length: renderedClusters }).map((_, i) => (
                <ClusterIcon key={`cluster-${i}`} index={i} />
              ))}

              {/* "+N more" overflow pill */}
              {overflow > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 }}
                  className="w-12 h-12 rounded-full border-2 border-dashed border-violet-300 dark:border-violet-700 flex items-center justify-center"
                >
                  <span className="text-xs font-bold text-violet-500 dark:text-violet-400">
                    +{overflow}
                  </span>
                </motion.div>
              )}
            </div>

            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2.5">
              每个圈子为 4–6 人的盲盒小局
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

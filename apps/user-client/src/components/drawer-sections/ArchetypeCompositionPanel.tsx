/**
 * ArchetypeCompositionPanel
 * Visual archetype composition breakdown for the pre-join drawer.
 * Shows who is gathering using existing archetype imagery and descriptions.
 */
import { motion } from "framer-motion";
import { getArchetypeImage } from "@/lib/archetypeImages";
import { archetypeConfig } from "@/lib/archetypes";

interface ArchetypeCompositionPanelProps {
  archetypeBreakdown: Record<string, number>;
}

export default function ArchetypeCompositionPanel({ archetypeBreakdown }: ArchetypeCompositionPanelProps) {
  const sorted = Object.entries(archetypeBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  if (sorted.length === 0) return null;

  const total = Object.values(archetypeBreakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="mb-5">
      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">
        谁在聚集
      </p>
      <div className="space-y-2.5">
        {sorted.map(([archetype, count], i) => {
          const config = archetypeConfig[archetype];
          const imgSrc = getArchetypeImage(archetype);
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <motion.div
              key={archetype}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.07, ease: "easeOut" }}
              className="flex items-center gap-3"
            >
              {/* Archetype avatar */}
              <div className="w-10 h-10 rounded-2xl border-2 border-gray-100 dark:border-gray-700 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm">
                {imgSrc ? (
                  <img src={imgSrc} alt={archetype} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl leading-none">{config?.icon ?? "✨"}</span>
                )}
              </div>

              {/* Info + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {archetype}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-2 shrink-0">{count}人</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, delay: i * 0.07 + 0.1, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-400"
                  />
                </div>
                {config?.coreContributions && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                    {config.coreContributions}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

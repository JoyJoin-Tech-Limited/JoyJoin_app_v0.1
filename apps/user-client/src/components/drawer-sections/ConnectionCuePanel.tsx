/**
 * ConnectionCuePanel
 * Shows 2–4 compact connection cues for the pre-join drawer.
 * Derives cues from archetypeBreakdown, avgMatchScore, totalRegistrations.
 */
import { motion } from "framer-motion";
import { deriveConnectionCues } from "@/lib/poolVibeUtils";

interface PoolStatsSubset {
  archetypeBreakdown: Record<string, number>;
  avgMatchScore: number;
  totalRegistrations: number;
}

interface ConnectionCuePanelProps {
  stats: PoolStatsSubset;
}

export default function ConnectionCuePanel({ stats }: ConnectionCuePanelProps) {
  const cues = deriveConnectionCues(
    stats.archetypeBreakdown,
    stats.avgMatchScore,
    stats.totalRegistrations
  );

  if (cues.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">
        契合点
      </p>
      <div className="flex flex-wrap gap-2">
        {cues.map((cue, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: i * 0.06, ease: "easeOut" }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary"
          >
            <span className="text-sm leading-none" aria-hidden="true">{cue.icon}</span>
            <span className="text-xs font-semibold">{cue.text}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

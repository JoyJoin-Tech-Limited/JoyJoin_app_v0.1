/**
 * TopicHeatStrip
 * Phase 2: Compact topic heat / conversation momentum panel for the pre-join drawer.
 *
 * Helps pre-join users answer: "What kinds of conversations are likely here?"
 *
 * Data: derives topic cues from recentThemeTitles (primary) with an archetype-based
 * fallback.  The first cue is treated as the "hottest" and gets the strongest visual
 * treatment; subsequent cues step down in visual weight.
 *
 * Future work: a dedicated pool-level topic aggregation endpoint would allow real-time
 * interest-frequency ranking instead of the archetype-fallback approach used here.
 */
import { motion, useReducedMotion } from "framer-motion";
import { deriveTopicCues } from "@/lib/topicHeatUtils";
import type { TopicHeatThemeTitle } from "@/lib/topicHeatUtils";

interface TopicHeatStripProps {
  recentThemeTitles: TopicHeatThemeTitle[];
  archetypeBreakdown?: Record<string, number>;
}

/** Visual tier applied to each chip based on its rank in the topic list. */
type ChipTier = "hot" | "warm" | "cool";

function getTier(index: number): ChipTier {
  if (index === 0) return "hot";
  if (index <= 2) return "warm";
  return "cool";
}

/** Tailwind classes per tier — granular for readability */
const TIER_CLASSES: Record<ChipTier, string> = {
  hot:  "px-3.5 py-2   text-sm  font-bold   bg-gradient-to-r from-amber-500/15 to-orange-500/10 border border-amber-500/30   text-amber-700 dark:text-amber-400   shadow-sm",
  warm: "px-3   py-1.5 text-xs  font-semibold bg-violet-500/8 border border-violet-500/20 text-violet-700 dark:text-violet-400",
  cool: "px-2.5 py-1   text-xs  font-medium   bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 opacity-80",
};

export default function TopicHeatStrip({
  recentThemeTitles,
  archetypeBreakdown = {},
}: TopicHeatStripProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const topics = deriveTopicCues(recentThemeTitles, archetypeBreakdown);

  if (topics.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">
        话题热度
      </p>

      <div className="flex flex-wrap gap-2">
        {topics.map((topic, i) => {
          const tier = getTier(i);
          return (
            <motion.div
              key={`${topic.emoji}-${topic.text}`}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.85 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, delay: i * 0.06, ease: "easeOut" }}
              className={`flex items-center gap-1.5 rounded-full ${TIER_CLASSES[tier]}`}
            >
              <span className="leading-none" aria-hidden="true">
                {topic.emoji}
              </span>
              <span>{topic.text}</span>

              {/* Pulsing "热" label on the top-ranked topic */}
              {tier === "hot" && (
                <motion.span
                  className="ml-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-500"
                  animate={shouldReduceMotion ? { opacity: 1 } : { opacity: [0.55, 1, 0.55] }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  aria-hidden="true"
                >
                  热
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

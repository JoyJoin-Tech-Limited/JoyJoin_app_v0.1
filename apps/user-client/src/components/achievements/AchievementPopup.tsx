import { memo, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAchievementContext } from "@/contexts/AchievementContext";
import { RARITY_CONFIG } from "@/data/achievements";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export const AchievementPopup = memo(function AchievementPopup() {
  const { activeAchievement, dismissActive } = useAchievementContext();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!activeAchievement) return;
    const timeout = window.setTimeout(() => {
      dismissActive();
    }, prefersReducedMotion ? 2200 : 3200);

    return () => window.clearTimeout(timeout);
  }, [activeAchievement, dismissActive, prefersReducedMotion]);

  if (!activeAchievement) return null;

  const rarity = RARITY_CONFIG[activeAchievement.rarity];

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeAchievement.id}
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20, scale: 0.98 }}
          animate={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.25 }}
          className="relative"
        >
          <div
            className={cn(
              "pointer-events-auto w-[320px] max-w-[90vw] rounded-2xl border shadow-lg bg-gradient-to-br p-4 flex gap-3 overflow-hidden",
              rarity.accent
            )}
          >
            <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center text-2xl", rarity.iconBg)}>
              <span aria-hidden>{activeAchievement.icon}</span>
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">新成就</span>
                <span className={cn("text-[11px] px-2 py-0.5 rounded-full", rarity.badgeClass)}>
                  {rarity.label}
                </span>
              </div>
              <p className="font-semibold text-base leading-snug">{activeAchievement.title}</p>
              <p className="text-sm text-muted-foreground leading-snug">{activeAchievement.description}</p>
            </div>
            {!prefersReducedMotion && rarity.sparkleCount > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: rarity.sparkleCount }).map((_, index) => (
                  <motion.span
                    key={index}
                    className="absolute text-amber-400"
                    initial={{ opacity: 0, scale: 0.6, x: 0, y: 0 }}
                    animate={{
                      opacity: [0, 1, 0],
                      scale: [0.6, 1.1, 0.8],
                      x: [0, (index - 2) * 8, (index - 2) * 12],
                      y: [0, -12 - index * 2, -18 - index * 3],
                    }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: index * 0.1 }}
                  >
                    ✨
                  </motion.span>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
});

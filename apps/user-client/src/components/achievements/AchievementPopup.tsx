/**
 * AchievementPopup - Toast-style popup for unlocked achievements
 */

import { memo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy } from "lucide-react";
import { useAchievements } from "@/contexts/AchievementContext";
import { getRarityStyles } from "@/data/achievements";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const AUTO_DISMISS_MS = 3500;

function AchievementPopupComponent() {
  const { currentAchievement, dismissCurrent } = useAchievements();
  const prefersReducedMotion = useReducedMotion();

  // Auto-dismiss after timeout
  useEffect(() => {
    if (!currentAchievement) return;
    
    const timer = setTimeout(() => {
      dismissCurrent();
    }, AUTO_DISMISS_MS);
    
    return () => clearTimeout(timer);
  }, [currentAchievement, dismissCurrent]);

  const handleDismiss = useCallback(() => {
    dismissCurrent();
  }, [dismissCurrent]);

  if (!currentAchievement) return null;

  const styles = getRarityStyles(currentAchievement.rarity);

  return (
    <AnimatePresence>
      {currentAchievement && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -50, scale: 0.9 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: prefersReducedMotion ? 0.15 : 0.4, ease: "backOut" }}
          className={cn(
            "fixed top-4 left-1/2 -translate-x-1/2 z-[100]",
            "w-[90vw] max-w-sm",
            "rounded-xl border-2 p-4",
            "backdrop-blur-sm shadow-lg",
            styles.bg,
            styles.border,
            styles.glow,
          )}
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div 
              className={cn(
                "shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-2xl",
                styles.bg,
                "border",
                styles.border,
              )}
            >
              {currentAchievement.emoji}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className={cn("w-4 h-4", styles.text)} />
                <span className={cn("text-xs font-medium uppercase tracking-wide", styles.text)}>
                  {currentAchievement.rarity === "legendary" ? "传说成就" :
                   currentAchievement.rarity === "epic" ? "史诗成就" :
                   currentAchievement.rarity === "rare" ? "稀有成就" : "成就解锁"}
                </span>
              </div>
              <h3 className="font-bold text-foreground text-lg truncate">
                {currentAchievement.title}
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                {currentAchievement.description}
              </p>
            </div>

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="shrink-0 p-1 rounded-full hover:bg-muted/50 transition-colors"
              aria-label="关闭"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Progress bar for auto-dismiss */}
          {!prefersReducedMotion && (
            <motion.div
              className={cn("absolute bottom-0 left-0 h-1 rounded-b-xl", styles.border.replace("border-", "bg-"))}
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: AUTO_DISMISS_MS / 1000, ease: "linear" }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const AchievementPopup = memo(AchievementPopupComponent);

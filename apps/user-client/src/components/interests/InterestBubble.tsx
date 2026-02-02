import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { HEAT_LEVELS, type HeatLevel, type InterestTopic, isValidHeatLevel } from "@/data/interestCarouselData";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface InterestBubbleProps {
  topic: InterestTopic;
  level: HeatLevel;
  onTap: () => void;
  className?: string;
}

export function InterestBubble({ topic, level, onTap, className }: InterestBubbleProps) {
  const prefersReducedMotion = useReducedMotion();

  const getHeatStyles = () => {
    switch (level) {
      case 0:
        return {
          background: "hsl(var(--background))",
          border: "2px solid hsl(var(--border))",
          badgeEmoji: null,
          emojiOpacity: 0.6,
          emojiScale: 1,
          textColor: "text-muted-foreground",
          textSize: "text-xs",
          fontWeight: "",
          shadow: "none",
        };
      case 1:
        return {
          background: "hsl(var(--background))",
          border: "2.5px solid hsl(262 83% 58%)",
          badgeEmoji: "💜",
          emojiOpacity: 1,
          emojiScale: 1.02,
          textColor: "text-purple-700 dark:text-purple-400",
          textSize: "text-xs",
          fontWeight: "font-medium",
          shadow: "0 2px 8px hsl(262 83% 58% / 0.25)",
        };
      case 2:
        return {
          background: "hsl(var(--background))",
          border: "3px solid hsl(330 81% 60%)",
          badgeEmoji: "💗",
          emojiOpacity: 1,
          emojiScale: 1.05,
          textColor: "text-pink-600 dark:text-pink-400",
          textSize: "text-xs",
          fontWeight: "font-semibold",
          shadow: "0 3px 12px hsl(330 81% 60% / 0.3)",
        };
      case 3:
        return {
          background: "linear-gradient(135deg, hsl(48 96% 89%) 0%, hsl(24 95% 89%) 100%)",
          border: "3.5px solid hsl(27 96% 61%)",
          badgeEmoji: "🧡",
          emojiOpacity: 1,
          emojiScale: 1.08,
          textColor: "text-orange-700 dark:text-orange-600",
          textSize: "text-xs",
          fontWeight: "font-bold",
          shadow: "0 4px 16px hsl(27 96% 61% / 0.35)",
        };
    }
  };

  const styles = getHeatStyles();

  // Haptic feedback simulation (if available)
  const triggerHaptic = (nextLevel: HeatLevel) => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      const patterns = { 0: 0, 1: 10, 2: 20, 3: 30 };
      navigator.vibrate(patterns[nextLevel] || 0);
    }
  };

  const handleTap = () => {
    const currentLevel = level;
    const nextLevel = (currentLevel + 1) % 4;
    
    // Type guard to ensure nextLevel is a valid HeatLevel
    if (!isValidHeatLevel(nextLevel)) {
      console.error(`Invalid heat level calculated: ${nextLevel}`);
      return;
    }
    
    triggerHaptic(nextLevel);
    onTap();
  };

  return (
    <motion.button
      type="button"
      onClick={handleTap}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition-all touch-manipulation min-h-[88px] min-w-[88px]",
        className
      )}
      style={{
        background: styles.background,
        border: styles.border,
        boxShadow: styles.shadow,
      }}
      animate={{ scale: styles.emojiScale }}
      whileTap={prefersReducedMotion ? {} : { scale: styles.emojiScale * 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      aria-label={`${topic.label}, ${HEAT_LEVELS[level].label}`}
      aria-pressed={level > 0}
    >
      {/* Heat level badge (accessibility) */}
      {level > 0 && styles.badgeEmoji && (
        <div className="absolute -top-1 -right-1 text-xs leading-none">
          {styles.badgeEmoji}
        </div>
      )}

      {/* Emoji - larger for better visibility */}
      <motion.div
        className="text-2xl sm:text-3xl leading-none"
        style={{ opacity: styles.emojiOpacity }}
        animate={
          level === 3 && !prefersReducedMotion
            ? {
                scale: [1, 1.1, 1],
              }
            : {}
        }
        transition={
          level === 3
            ? {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }
            : {}
        }
      >
        {topic.emoji}
      </motion.div>

      {/* Label - increased font size for better readability */}
      <div className={cn(styles.textSize, styles.fontWeight, styles.textColor, "text-center leading-tight px-0.5")}>
        {topic.label}
      </div>

      {/* Glow pulse animation for level 3 */}
      {level === 3 && !prefersReducedMotion && (
        <motion.div
          className="absolute inset-0 rounded-lg"
          style={{
            background:
              "radial-gradient(circle, rgba(251, 146, 60, 0.2) 0%, transparent 70%)",
          }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
    </motion.button>
  );
}

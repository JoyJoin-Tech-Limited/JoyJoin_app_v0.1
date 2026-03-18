import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { HEAT_LEVELS, type HeatLevel, type InterestTopic, isValidHeatLevel } from "@/data/interestCarouselData";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface InterestBubbleProps {
  topic: InterestTopic;
  level: HeatLevel;
  onTap: () => void;
  className?: string;
  isRecommended?: boolean;
}

export function InterestBubble({ topic, level, onTap, className, isRecommended }: InterestBubbleProps) {
  const prefersReducedMotion = useReducedMotion();

  const getHeatStyles = () => {
    switch (level) {
      case 0:
        return {
          background: "hsl(var(--background))",
          border: "1.5px solid hsl(var(--border))",
          badgeEmoji: null,
          emojiOpacity: 0.6,
          emojiScale: 1,
          textColor: "text-muted-foreground",
          textSize: "text-xs",
          fontWeight: "",
          shadow: "none",
          glow: "none",
        };
      case 1:
        return {
          background: "hsl(var(--background))",
          border: "2px solid #A78BFA", // Purple-400
          badgeEmoji: "💜",
          emojiOpacity: 1,
          emojiScale: 1.02,
          textColor: "text-purple-700 dark:text-purple-400",
          textSize: "text-xs",
          fontWeight: "font-medium",
          shadow: "0 2px 8px rgba(167, 139, 250, 0.25)",
          glow: "0 0 0 0 rgba(167, 139, 250, 0.4)",
        };
      case 2:
        return {
          background: "hsl(var(--background))",
          border: "2.5px solid transparent",
          borderImage: "linear-gradient(135deg, #EC4899, #F472B6) 1",
          badgeEmoji: "💗",
          emojiOpacity: 1,
          emojiScale: 1.05,
          textColor: "text-pink-600 dark:text-pink-400",
          textSize: "text-xs",
          fontWeight: "font-semibold",
          shadow: "0 3px 12px rgba(236, 72, 153, 0.3)",
          glow: "0 0 0 0 rgba(236, 72, 153, 0.5)",
        };
      case 3:
        return {
          background: "linear-gradient(135deg, hsl(48 96% 89%) 0%, hsl(24 95% 89%) 100%)",
          border: "3px solid transparent",
          borderImage: "linear-gradient(135deg, #FB923C, #F59E0B) 1",
          badgeEmoji: "🧡",
          emojiOpacity: 1,
          emojiScale: 1.08,
          textColor: "text-orange-700 dark:text-orange-600",
          textSize: "text-xs",
          fontWeight: "font-bold",
          shadow: "0 4px 16px rgba(251, 146, 60, 0.35)",
          glow: "0 0 0 0 rgba(251, 146, 60, 0.6)",
        };
    }
  };

  const styles = getHeatStyles();

  // Haptic feedback with improved patterns (P3)
  const triggerHaptic = (nextLevel: HeatLevel) => {
    // Respect reduced-motion preference
    if (prefersReducedMotion) return;
    
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      switch (nextLevel) {
        case 0:
          navigator.vibrate(5); // Very light (deselect)
          break;
        case 1:
          navigator.vibrate(10); // Light tap
          break;
        case 2:
          navigator.vibrate(15); // Medium tap
          break;
        case 3:
          navigator.vibrate([10, 20, 10]); // Double tap pattern for max level
          break;
      }
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
        "relative flex flex-col items-center justify-center gap-1 rounded-xl p-2 touch-manipulation min-h-[88px] min-w-[88px]",
        className
      )}
      style={{
        background: styles.background,
        border: styles.border,
        borderImage: styles.borderImage,
        boxShadow: styles.shadow,
        transition: "all 200ms ease-out",
      }}
      animate={{ scale: styles.emojiScale }}
      whileTap={prefersReducedMotion ? {} : { scale: styles.emojiScale * 0.95 }}
      whileHover={
        !prefersReducedMotion && level > 0
          ? { filter: "brightness(1.05)", boxShadow: styles.glow }
          : {}
      }
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      aria-label={`${topic.label}, ${HEAT_LEVELS[level].label}${isRecommended && level === 0 ? ", 推荐话题" : ""}`}
      aria-pressed={level > 0}
      role="button"
      tabIndex={0}
    >
      {/* Heat level badge (accessibility) */}
      {level > 0 && styles.badgeEmoji && (
        <div className="absolute -top-1 -right-1 text-xs leading-none">
          {styles.badgeEmoji}
        </div>
      )}

      {/* Archetype recommendation hint – only shown when topic is unselected */}
      {isRecommended && level === 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 text-[9px] bg-primary/15 text-primary rounded-full px-1.5 py-0.5 font-medium whitespace-nowrap z-10 leading-tight"
        >
          ✨ 推荐
        </span>
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

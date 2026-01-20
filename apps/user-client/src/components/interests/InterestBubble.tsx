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
          background: "#FFFFFF",
          border: "1.5px solid #E5E7EB",
          badgeEmoji: null,
          emojiOpacity: 0.5,
          emojiScale: 1,
          textColor: "text-gray-600",
          textSize: "text-[11px]",
          fontWeight: "",
          shadow: "none",
        };
      case 1:
        return {
          background: "#FFFFFF",
          border: "2px solid #A78BFA",
          badgeEmoji: "💜",
          emojiOpacity: 1,
          emojiScale: 1.05,
          textColor: "text-purple-700",
          textSize: "text-[11px]",
          fontWeight: "font-medium",
          shadow: "0 2px 6px rgba(167, 139, 250, 0.2)",
        };
      case 2:
        return {
          background: "#FFFFFF",
          border: "3px solid #EC4899",
          badgeEmoji: "💗",
          emojiOpacity: 1,
          emojiScale: 1.08,
          textColor: "text-pink-600",
          textSize: "text-[11px]",
          fontWeight: "font-semibold",
          shadow: "0 3px 10px rgba(236, 72, 153, 0.25)",
        };
      case 3:
        return {
          background: "linear-gradient(135deg, #FEF3C7 0%, #FED7AA 100%)",
          border: "4px solid #FB923C",
          badgeEmoji: "🧡",
          emojiOpacity: 1,
          emojiScale: 1.12,
          textColor: "text-orange-700",
          textSize: "text-[11px]",
          fontWeight: "font-bold",
          shadow: "0 4px 14px rgba(251, 146, 60, 0.3)",
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
        "relative flex flex-col items-center justify-center gap-0.5 rounded-lg p-1.5 transition-all touch-manipulation min-h-[68px]",
        className
      )}
      style={{
        background: styles.background,
        border: styles.border,
        boxShadow: styles.shadow,
      }}
      animate={
        prefersReducedMotion
          ? { scale: styles.emojiScale }
          : {
              scale: styles.emojiScale,
            }
      }
      whileTap={prefersReducedMotion ? {} : { scale: styles.emojiScale * 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {/* Heat level badge (accessibility) */}
      {level > 0 && styles.badgeEmoji && (
        <div className="absolute -top-1 -right-1 text-xs leading-none">
          {styles.badgeEmoji}
        </div>
      )}

      {/* Emoji - smaller */}
      <motion.div
        className="text-xl leading-none"
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

      {/* Label - compact with controlled text size */}
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

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
          background: "#FAFAFA",
          border: "2px solid #E5E7EB",
          emojiOpacity: 0.6,
          textColor: "text-gray-500",
          shadow: "none",
          scale: 1,
        };
      case 1:
        return {
          background: "linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 100%)",
          border: "2px solid #C084FC",
          emojiOpacity: 1,
          textColor: "text-purple-700",
          shadow: "0 2px 8px rgba(192, 132, 252, 0.3)",
          scale: 1.03,
        };
      case 2:
        return {
          background: "linear-gradient(135deg, #E9D5FF 0%, #FBCFE8 100%)",
          border: "2px solid #EC4899",
          emojiOpacity: 1,
          textColor: "text-pink-600",
          shadow: "0 3px 12px rgba(236, 72, 153, 0.4)",
          scale: 1.05,
        };
      case 3:
        return {
          background: "linear-gradient(135deg, #C084FC 0%, #EC4899 50%, #FB923C 100%)",
          border: "2px solid #FB923C",
          emojiOpacity: 1,
          textColor: "text-white font-bold",
          shadow: "0 4px 16px rgba(236, 72, 153, 0.5), 0 2px 8px rgba(251, 146, 60, 0.3)",
          scale: 1.08,
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
        "relative flex flex-col items-center justify-center gap-1 rounded-2xl p-3 transition-all touch-manipulation min-h-[80px]",
        className
      )}
      style={{
        background: styles.background,
        border: styles.border,
        boxShadow: styles.shadow,
      }}
      animate={
        prefersReducedMotion
          ? { scale: styles.scale }
          : {
              scale: styles.scale,
            }
      }
      whileTap={prefersReducedMotion ? {} : { scale: styles.scale * 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {/* Emoji */}
      <motion.div
        className="text-3xl"
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

      {/* Label */}
      <div className={cn("text-sm font-medium text-center", styles.textColor)}>
        {topic.label}
      </div>

      {/* Heat dots indicator */}
      <div className="flex gap-1 mt-1">
        {[1, 2, 3].map((dot) => (
          <div
            key={dot}
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-all",
              dot <= level
                ? level === 1
                  ? "bg-purple-500"
                  : level === 2
                  ? "bg-pink-500"
                  : "bg-orange-500"
                : "bg-gray-300"
            )}
          />
        ))}
      </div>

      {/* Glow pulse animation for level 3 */}
      {level === 3 && !prefersReducedMotion && (
        <motion.div
          className="absolute inset-0 rounded-2xl"
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

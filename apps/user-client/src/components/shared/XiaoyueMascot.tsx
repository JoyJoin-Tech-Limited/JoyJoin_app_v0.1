import { useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

import xiaoyueNormal from "@/assets/Xiao_Yue_Avatar-01.png";
import xiaoyueExcited from "@/assets/Xiao_Yue_Avatar-03.png";
import xiaoyuePointing from "@/assets/Xiao_Yue_Avatar-04.png";

// Preload avatars for instant display
[xiaoyueNormal, xiaoyueExcited, xiaoyuePointing].forEach((src) => {
  const img = new Image();
  img.src = src;
});

export type XiaoyueMood = "normal" | "excited" | "pointing";

const XIAOYUE_AVATARS: Record<XiaoyueMood, string> = {
  normal: xiaoyueNormal,
  excited: xiaoyueExcited,
  pointing: xiaoyuePointing,
};

interface XiaoyueMascotProps {
  /** Mood determines which avatar to display */
  mood?: XiaoyueMood;
  /** Message to display in speech bubble */
  message: string;
  /** Additional CSS classes */
  className?: string;
  /** Layout: horizontal (side by side) or vertical (stacked) */
  horizontal?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Bubble style variant */
  bubbleStyle?: "default" | "gradient";
}

const sizeClasses = {
  sm: "w-12 h-12",
  md: "w-16 h-16",
  lg: "w-20 h-20",
};

const verticalSizeClasses = {
  sm: "w-16 h-16",
  md: "w-20 h-20",
  lg: "w-28 h-28",
};

/**
 * XiaoyueMascot - Unified mascot component
 * 
 * Displays the Xiaoyue mascot with a speech bubble.
 * Supports both horizontal and vertical layouts with consistent styling.
 * Respects prefers-reduced-motion user preference.
 */
export function XiaoyueMascot({
  mood = "normal",
  message,
  className,
  horizontal = false,
  size = "md",
  bubbleStyle = "gradient",
}: XiaoyueMascotProps) {
  // Force mood to normal as per user request
  const displayMood = "normal";
  const controls = useAnimation();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;
    
    controls.start({
      x: horizontal ? [0, -5, 5, -5, 5, 0] : [0],
      y: horizontal ? [0] : [0, -8, 0],
      transition: { duration: horizontal ? 0.4 : 0.5, ease: "easeOut" },
    });
  }, [message, controls, horizontal, prefersReducedMotion]);

  const bubbleClasses =
    bubbleStyle === "gradient"
      ? "bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 border-purple-100 dark:border-purple-800"
      : "bg-card border-border";

  if (horizontal) {
    return (
      <div className={cn("flex items-start gap-3", className)}>
        <motion.div
          animate={prefersReducedMotion ? {} : {
            scale: [1, 1.05, 1],
          }}
          transition={prefersReducedMotion ? {} : {
            scale: {
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            },
          }}
          className="relative shrink-0"
        >
          <motion.div animate={controls}>
            <img
              src={XIAOYUE_AVATARS[displayMood]}
              alt="小悦"
              className={cn("object-contain drop-shadow-lg", sizeClasses[size])}
              data-testid="img-xiaoyue-avatar"
            />
          </motion.div>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.9, x: -10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={prefersReducedMotion ? {} : { duration: 0.3, delay: 0.1 }}
          className={cn(
            "relative rounded-2xl px-4 py-3 shadow-sm border flex-1",
            bubbleClasses
          )}
        >
          <p
            className="text-base leading-relaxed text-purple-800 dark:text-purple-200 font-medium"
            data-testid="text-xiaoyue-message"
          >
            {message}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <motion.div animate={controls} className="relative">
        <img
          src={XIAOYUE_AVATARS[displayMood]}
          alt="小悦"
          className={cn("object-contain drop-shadow-lg", verticalSizeClasses[size])}
          data-testid="img-xiaoyue-avatar"
        />
      </motion.div>

      <motion.div
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={prefersReducedMotion ? {} : { delay: 0.2 }}
        className={cn(
          "rounded-2xl px-4 py-3 max-w-[280px] shadow-sm border",
          bubbleClasses,
          !message && "hidden"
        )}
      >
        <p
          className="text-sm text-center text-purple-800 dark:text-purple-200 font-medium"
          data-testid="text-xiaoyue-message"
        >
          {message}
        </p>
      </motion.div>
    </div>
  );
}

export default XiaoyueMascot;

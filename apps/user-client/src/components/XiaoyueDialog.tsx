import { motion, useAnimation } from "framer-motion";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

// Consistent avatar imports - always use Xiao_Yue_Avatar-01.png as primary
import xiaoyueNormal from "@/assets/Xiao_Yue_Avatar-01.png";
import xiaoyueExcited from "@/assets/Xiao_Yue_Avatar-03.png";
import xiaoyuePointing from "@/assets/Xiao_Yue_Avatar-04.png";

export type XiaoyueMood = "normal" | "excited" | "pointing";

export const XIAOYUE_AVATARS: Record<XiaoyueMood, string> = {
  normal: xiaoyueNormal,
  excited: xiaoyueExcited,
  pointing: xiaoyuePointing,
};

interface XiaoyueDialogProps {
  mood?: XiaoyueMood;
  message: string;
  className?: string;
  /** Horizontal layout with avatar on left */
  horizontal?: boolean;
  /** Avatar size in pixels */
  avatarSize?: number;
  /** Hide speech bubble when no message */
  hideEmpty?: boolean;
}

/**
 * XiaoyueDialog - Consistent 小悦 mascot dialog component
 * 
 * Provides unified styling for the Xiaoyue avatar and speech bubble
 * across onboarding, personality test, and setup screens.
 * 
 * Always uses Xiao_Yue_Avatar-01.png as the primary (normal) avatar.
 */
export function XiaoyueDialog({
  mood = "normal",
  message,
  className,
  horizontal = false,
  avatarSize = 112,
  hideEmpty = true,
}: XiaoyueDialogProps) {
  const controls = useAnimation();

  // Gentle bounce animation when message changes
  useEffect(() => {
    controls.start({
      x: [0, -5, 5, -5, 5, 0],
      transition: { duration: 0.4 }
    });
  }, [message, controls]);

  const avatarSizeClass = horizontal 
    ? "w-16 h-16" 
    : avatarSize === 112 
      ? "w-28 h-28" 
      : `w-${avatarSize / 4} h-${avatarSize / 4}`;

  if (horizontal) {
    return (
      <div className={cn("flex items-start gap-3", className)}>
        <motion.div
          animate={{ 
            scale: [1, 1.05, 1],
          }}
          transition={{ 
            scale: {
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }
          }}
          className="relative shrink-0"
        >
          <motion.div animate={controls}>
            <img 
              src={XIAOYUE_AVATARS[mood]} 
              alt="小悦" 
              className={cn(avatarSizeClass, "object-contain drop-shadow-lg")}
              data-testid="img-xiaoyue-avatar"
            />
          </motion.div>
        </motion.div>
        
        {(!hideEmpty || message) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="relative bg-card border border-border rounded-2xl px-4 py-3 shadow-md flex-1"
          >
            <div className="absolute top-4 -left-2 w-0 h-0 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-card" />
            <div className="absolute top-4 -left-[9px] w-0 h-0 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-border" />
            <p className="text-lg leading-relaxed" data-testid="text-xiaoyue-message">
              {message}
            </p>
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <motion.div
        animate={{ 
          scale: [1, 1.05, 1],
        }}
        transition={{ 
          scale: {
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }
        }}
        className="relative"
      >
        <motion.div animate={controls}>
          <img 
            src={XIAOYUE_AVATARS[mood]} 
            alt="小悦" 
            className={cn(avatarSizeClass, "object-contain drop-shadow-lg")}
            style={avatarSize !== 112 && !horizontal ? { width: avatarSize, height: avatarSize } : undefined}
            data-testid="img-xiaoyue-avatar"
          />
        </motion.div>
      </motion.div>
      
      {(!hideEmpty || message) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className={cn(
            "relative bg-card border border-border rounded-2xl px-5 py-3 shadow-md max-w-[280px]",
            !message && hideEmpty && "hidden"
          )}
        >
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-card" />
          <div className="absolute -top-[9px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-border" />
          <p className="text-center text-base leading-relaxed" data-testid="text-xiaoyue-message">
            {message}
          </p>
        </motion.div>
      )}
    </div>
  );
}

export default XiaoyueDialog;

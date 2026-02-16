import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

interface CoachMarkTooltipProps {
  message: string;
  position?: "top" | "bottom" | "left" | "right";
  autoDismiss?: number;
  onDismiss: () => void;
}

export function CoachMarkTooltip({
  message,
  position = "top",
  autoDismiss = 5000,
  onDismiss,
}: CoachMarkTooltipProps) {
  useEffect(() => {
    if (autoDismiss) {
      const timer = setTimeout(onDismiss, autoDismiss);
      return () => clearTimeout(timer);
    }
    // Intentionally not including onDismiss in dependencies to avoid timer reset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDismiss]);

  const positionStyles = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowStyles = {
    top: "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent",
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className={`absolute ${positionStyles[position]} z-50`}
      >
        <div className="relative">
          <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg text-sm font-medium whitespace-nowrap max-w-xs">
            {message}
          </div>
          <div
            className={`absolute ${arrowStyles[position]} w-0 h-0 border-8 border-primary`}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

interface PulsingIndicatorProps {
  size?: "sm" | "md" | "lg";
}

export function PulsingIndicator({ size = "md" }: PulsingIndicatorProps) {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <div className="relative inline-flex">
      <motion.div
        className={`${sizeClasses[size]} bg-primary rounded-full`}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [1, 0.8, 1],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className={`absolute inset-0 ${sizeClasses[size]} bg-primary rounded-full opacity-75`}
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.7, 0, 0.7],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

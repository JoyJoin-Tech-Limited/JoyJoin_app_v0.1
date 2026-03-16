import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { confettiPresets } from "@/lib/confetti-utils";
import { haptics } from "@/lib/haptics";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface TransitionOverlayProps {
  isVisible: boolean;
  onComplete: () => void;
}

export default function TransitionOverlay({
  isVisible,
  onComplete,
}: TransitionOverlayProps) {
  const prefersReducedMotion = useReducedMotion();

  // Keep latest values in refs so the timer effect never needs them as deps
  const onCompleteRef = useRef(onComplete);
  const prefersReducedMotionRef = useRef(prefersReducedMotion);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    prefersReducedMotionRef.current = prefersReducedMotion;
  }, [onComplete, prefersReducedMotion]);

  // Haptic feedback + premium sparkle confetti + auto-dismiss — all driven
  // solely by `isVisible` changing to true, avoiding spurious re-runs.
  useEffect(() => {
    if (!isVisible) return;

    haptics.medium();
    if (!prefersReducedMotionRef.current) {
      confettiPresets.goldSparkle();
    }
    const timer = setTimeout(() => onCompleteRef.current(), 1800);
    return () => clearTimeout(timer);
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            backgroundColor: "hsl(var(--primary) / 0.12)",
          }}
          aria-live="polite"
          aria-atomic="true"
          role="status"
        >
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.2 }
                : {
                    type: "spring",
                    stiffness: 300,
                    damping: 22,
                    opacity: { duration: 0.25 },
                  }
            }
            className="relative mx-8 px-10 py-9 text-center"
            style={{
              borderRadius: 24,
              overflow: "hidden",
              background: "hsl(var(--card))",
              boxShadow:
                "0 24px 64px rgba(0, 0, 0, 0.12), 0 0 0 1px hsl(var(--border))",
            }}
          >
            {/* Brand gradient accent stripe at the top of the card */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: "linear-gradient(90deg, #FF6B9D, #A86BFF)",
              }}
            />
            <p className="text-3xl mb-2" aria-hidden="true">✨</p>
            <p
              className="text-4xl font-black leading-tight mb-2 text-foreground"
            >
              一半啦！
            </p>
            <p className="text-base font-medium text-muted-foreground">
              你的隐藏人格正在浮现...
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

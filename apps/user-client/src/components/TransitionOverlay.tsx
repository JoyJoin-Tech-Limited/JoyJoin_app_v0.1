import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
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
  });

  // Haptic feedback + premium sparkle confetti + auto-dismiss — all driven
  // solely by `isVisible` changing to true, avoiding spurious re-runs.
  useEffect(() => {
    if (!isVisible) return;

    haptics.medium();
    if (!prefersReducedMotionRef.current) {
      confetti({
        particleCount: 30,
        spread: 50,
        origin: { x: 0.5, y: 0.25 },
        colors: ["#FFD700", "#FFFFFF", "#FFF8DC", "#F0E68C"],
        scalar: 0.9,
        gravity: 1.0,
        ticks: 80,
      });
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
            backgroundColor: "rgba(0, 0, 0, 0.35)",
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
            className="mx-8 px-10 py-9 text-center"
            style={{
              borderRadius: 30,
              background: "rgba(255, 255, 255, 0.18)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              boxShadow:
                "0 24px 64px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(255, 255, 255, 0.12)",
            }}
          >
            <p
              className="text-4xl font-black leading-tight mb-2"
              style={{ color: "#1C1C1E" }}
            >
              一半啦！
            </p>
            <p className="text-base font-medium" style={{ color: "#8E8E93" }}>
              你的隐藏人格正在浮现...
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

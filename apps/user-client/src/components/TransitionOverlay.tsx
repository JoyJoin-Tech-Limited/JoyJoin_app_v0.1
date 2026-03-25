import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

  // Subtle haptic feedback + auto-dismiss — driven solely by `isVisible`
  // changing to true, avoiding spurious re-runs.
  useEffect(() => {
    if (!isVisible) return;

    haptics.light();
    const timer = setTimeout(() => onCompleteRef.current(), 2200);
    return () => clearTimeout(timer);
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            backgroundColor: "rgba(0, 0, 0, 0.40)",
          }}
          aria-live="polite"
          aria-atomic="true"
          role="status"
        >
          <motion.div
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 14, filter: "blur(6px)" }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 1, y: 0, filter: "blur(0px)" }
            }
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 8, filter: "blur(4px)" }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0.2 }
                : { duration: 0.38, ease: [0.22, 1, 0.36, 1] }
            }
            className="relative mx-6 w-full max-w-sm overflow-hidden px-8 py-8 text-center"
            style={{
              borderRadius: 28,
              background: "rgba(255, 255, 255, 0.07)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow:
                "0 24px 80px rgba(0, 0, 0, 0.40), 0 0 0 0.5px rgba(255,255,255,0.06) inset",
            }}
          >
            {/* Ambient glow behind content */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: "-40px",
                left: "50%",
                transform: "translateX(-50%)",
                width: 160,
                height: 120,
                borderRadius: "50%",
                background:
                  "radial-gradient(ellipse, rgba(168, 107, 255, 0.22) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />

            {/* Subtle top highlight line */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 1,
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
              }}
            />

            <div className="relative">
              {/* Eyebrow label */}
              <p
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium"
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  color: "rgba(255, 255, 255, 0.72)",
                  letterSpacing: "0.16em",
                }}
                aria-hidden="true"
              >
                精准分析进行中
              </p>

              {/* Primary headline */}
              <p
                className="mt-5 text-2xl font-semibold leading-snug tracking-tight"
                style={{ color: "rgba(255, 255, 255, 0.95)" }}
              >
                再完成几道校准题
              </p>

              {/* Supporting copy */}
              <p
                className="mt-3 text-sm leading-relaxed"
                style={{ color: "rgba(255, 255, 255, 0.58)" }}
              >
                我们正在细化你的性格画像，让分析结果更精准、更贴近真实的你。
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

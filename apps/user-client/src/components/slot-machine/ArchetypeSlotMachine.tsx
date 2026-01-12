/**
 * ArchetypeSlotMachine - Main slot machine reveal component
 * Replaces the showBlindBox loading screen with an animated reveal
 */

import { memo, useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper, Sparkles } from "lucide-react";
import { SlotReel } from "./SlotReel";
import { SlotFrame } from "./SlotFrame";
import { useSlotMachine } from "./useSlotMachine";
import { getArchetypeInfo, getArchetypeColorHSL } from "./archetypeData";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface ArchetypeSlotMachineProps {
  finalArchetype: string;
  confidence?: number;
  onComplete: () => void;
}

interface ConfettiParticle {
  id: number;
  x: number;
  color: string;
  delay: number;
  rotation: number;
}

const CONFETTI_COLORS = [
  "#a855f7", // purple
  "#ec4899", // pink
  "#f97316", // orange
  "#22c55e", // green
  "#3b82f6", // blue
  "#eab308", // yellow
];

const MAX_CONFETTI = 20;

function ArchetypeSlotMachineComponent({ 
  finalArchetype, 
  confidence, 
  onComplete 
}: ArchetypeSlotMachineProps) {
  const prefersReducedMotion = useReducedMotion();
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiParticles, setConfettiParticles] = useState<ConfettiParticle[]>([]);
  const [showResult, setShowResult] = useState(false);
  
  // Track timeouts for cleanup
  const confettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const archetypeInfo = getArchetypeInfo(finalArchetype);
  const accentColor = getArchetypeColorHSL(finalArchetype);

  // Cleanup timeouts on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
      if (completeTimeoutRef.current) {
        clearTimeout(completeTimeoutRef.current);
      }
    };
  }, []);

  const handleLand = useCallback(() => {
    if (!isMountedRef.current) return;
    
    setShowResult(true);
    
    if (!prefersReducedMotion) {
      // Generate confetti particles (max 20)
      const particles: ConfettiParticle[] = [];
      for (let i = 0; i < MAX_CONFETTI; i++) {
        particles.push({
          id: i,
          x: Math.random() * 100,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          delay: Math.random() * 0.3,
          rotation: Math.random() * 360,
        });
      }
      setConfettiParticles(particles);
      setShowConfetti(true);

      // Clean up confetti after animation
      confettiTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setShowConfetti(false);
          setConfettiParticles([]);
        }
      }, 2500);
    }

    // Navigate to results after delay
    completeTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        onComplete();
      }
    }, prefersReducedMotion ? 800 : 2000);
  }, [onComplete, prefersReducedMotion]);

  const { state, visibleItems, start, progress } = useSlotMachine({
    finalArchetype,
    onLand: handleLand,
  });

  // Auto-start the slot machine on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      start();
    }, 500); // Brief delay for dramatic effect
    
    return () => clearTimeout(timer);
  }, [start]);

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col items-center justify-center p-6 relative">
      {/* Live region for screen readers to announce slot machine status and result */}
      <div
        aria-live="polite"
        role="status"
        className="sr-only"
      >
        {state !== "landed"
          ? state === "spinning"
            ? "正在旋转..."
            : "即将揭晓..."
          : showResult
            ? `结果揭晓：你是${archetypeInfo.name}${
                confidence ? `，匹配度 ${Math.round(confidence * 100)}%` : ""
              }`
            : ""}
      </div>

      {/* Confetti overlay */}
      {showConfetti && !prefersReducedMotion && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          <AnimatePresence>
            {confettiParticles.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute w-3 h-3 rounded-sm"
                style={{
                  left: `${particle.x}%`,
                  backgroundColor: particle.color,
                }}
                initial={{ y: -20, opacity: 1, rotate: 0 }}
                animate={{ 
                  y: "100vh",
                  opacity: [1, 1, 0],
                  rotate: particle.rotation + 720,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 2.5,
                  delay: particle.delay,
                  ease: "easeOut",
                }}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">
            {state === "landed" ? "恭喜！" : "揭晓你的社交原型"}
          </h2>
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        {state !== "landed" && (
          <p className="text-sm text-muted-foreground">
            正在为你匹配最佳原型...
          </p>
        )}
      </motion.div>

      {/* Slot Machine */}
      <SlotFrame state={state} accentColor={accentColor}>
        <div className="flex flex-col items-center gap-4">
          <SlotReel 
            visibleItems={visibleItems} 
            state={state}
            highlightColor={accentColor}
          />
          
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>
      </SlotFrame>

      {/* Result display */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "backOut" }}
            className="mt-8 text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <PartyPopper className="w-6 h-6 text-primary" />
              <span className="text-lg font-medium">你是</span>
            </div>
            <p 
              className="text-3xl font-bold mb-2"
              style={{ color: accentColor }}
            >
              {archetypeInfo.emoji} {archetypeInfo.name}
            </p>
            {confidence && (
              <p className="text-sm text-muted-foreground">
                匹配度 {Math.round(confidence * 100)}%
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading text during spin */}
      {state !== "landed" && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 text-sm text-muted-foreground animate-pulse"
        >
          {state === "spinning" ? "正在旋转..." : "即将揭晓..."}
        </motion.p>
      )}
    </div>
  );
}

export const ArchetypeSlotMachine = memo(ArchetypeSlotMachineComponent);

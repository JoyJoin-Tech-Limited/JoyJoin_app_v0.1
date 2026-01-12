/**
 * SlotFrame - Decorative frame with animated lights
 * Provides visual feedback during spinning and celebration on landing
 */

import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SlotMachineState } from "./useSlotMachine";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface SlotFrameProps {
  state: SlotMachineState;
  children: React.ReactNode;
  accentColor?: string;
}

const LIGHT_COUNT = 16;

function SlotFrameComponent({ state, children, accentColor }: SlotFrameProps) {
  const prefersReducedMotion = useReducedMotion();
  const isActive = state === "spinning" || state === "slowing";
  const isLanded = state === "landed";

  // Generate light positions around the frame
  const lights = useMemo(() => {
    return Array.from({ length: LIGHT_COUNT }, (_, i) => {
      const angle = (i / LIGHT_COUNT) * 360;
      const isTop = angle < 90 || angle > 270;
      const isRight = angle > 0 && angle < 180;
      
      return {
        id: i,
        angle,
        delay: i * 0.05,
        position: isTop 
          ? { top: 0, left: `${((angle + 90) % 180) / 180 * 100}%` }
          : { bottom: 0, left: `${(180 - ((angle + 90) % 180)) / 180 * 100}%` },
      };
    });
  }, []);

  return (
    <div className="relative">
      {/* Outer glow */}
      {isLanded && !prefersReducedMotion && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ 
            opacity: [0.4, 0.7, 0.4],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -inset-4 rounded-2xl blur-xl"
          style={{
            background: accentColor 
              ? `radial-gradient(circle, ${accentColor}40 0%, transparent 70%)`
              : "radial-gradient(circle, hsl(var(--primary) / 0.3) 0%, transparent 70%)",
          }}
        />
      )}

      {/* Frame border */}
      <div 
        className={cn(
          "relative rounded-2xl p-2",
          "bg-gradient-to-b from-muted to-muted/80",
          "border-4 border-muted-foreground/20",
          isLanded && "border-primary/50",
        )}
      >
        {/* Animated lights around border - only when not reduced motion */}
        {!prefersReducedMotion && (isActive || isLanded) && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
            {lights.map((light) => (
              <motion.div
                key={light.id}
                className={cn(
                  "absolute w-2 h-2 rounded-full",
                  isLanded ? "bg-yellow-400" : "bg-primary/60",
                )}
                style={{
                  left: `${(light.id % 8) * 12.5}%`,
                  top: light.id < 8 ? "-4px" : "auto",
                  bottom: light.id >= 8 ? "-4px" : "auto",
                }}
                animate={{
                  opacity: isActive 
                    ? [0.3, 1, 0.3] 
                    : isLanded 
                      ? [0.5, 1, 0.5] 
                      : 0.3,
                  scale: isLanded ? [0.8, 1.2, 0.8] : 1,
                }}
                transition={{
                  duration: isActive ? 0.3 : 0.8,
                  repeat: Infinity,
                  delay: light.delay,
                }}
              />
            ))}
          </div>
        )}

        {/* Inner content */}
        <div className="relative bg-background rounded-lg p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

export const SlotFrame = memo(SlotFrameComponent);

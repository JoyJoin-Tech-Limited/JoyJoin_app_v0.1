/**
 * SlotFrame - ENHANCED with chasing ring lights and dramatic glow effects
 * Casino-style frame with animated perimeter lights that chase during spin
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
  intensity?: number;
}

const PERIMETER_LIGHTS = 24; // More lights for smoother chase effect

function SlotFrameComponent({ state, children, accentColor, intensity = 0 }: SlotFrameProps) {
  const prefersReducedMotion = useReducedMotion();
  const isActive = state === "spinning" || state === "slowing" || state === "nearMiss";
  const isAnticipation = state === "anticipation";
  const isLanded = state === "landed";
  
  // Generate perimeter light positions (around all 4 sides)
  const perimeterLights = useMemo(() => {
    const lights: { id: number; x: number; y: number; side: string }[] = [];
    const perSide = PERIMETER_LIGHTS / 4;
    
    // Top edge (left to right)
    for (let i = 0; i < perSide; i++) {
      lights.push({ id: i, x: (i / perSide) * 100, y: 0, side: 'top' });
    }
    // Right edge (top to bottom)
    for (let i = 0; i < perSide; i++) {
      lights.push({ id: perSide + i, x: 100, y: (i / perSide) * 100, side: 'right' });
    }
    // Bottom edge (right to left)
    for (let i = 0; i < perSide; i++) {
      lights.push({ id: perSide * 2 + i, x: 100 - (i / perSide) * 100, y: 100, side: 'bottom' });
    }
    // Left edge (bottom to top)
    for (let i = 0; i < perSide; i++) {
      lights.push({ id: perSide * 3 + i, x: 0, y: 100 - (i / perSide) * 100, side: 'left' });
    }
    
    return lights;
  }, []);

  // Chase animation timing based on state
  const getChaseDuration = () => {
    if (isAnticipation) return 2;
    if (state === "spinning") return 0.4;
    if (state === "slowing") return 0.8;
    return 1.5;
  };

  return (
    <div className="relative">
      {/* Pulsing outer glow - anticipation */}
      {isAnticipation && !prefersReducedMotion && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: [0.1, 0.3, 0.1],
            scale: [1, 1.02, 1],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -inset-6 rounded-3xl blur-2xl bg-primary/20"
        />
      )}

      {/* Spinning outer glow */}
      {isActive && !prefersReducedMotion && (
        <motion.div
          animate={{ 
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.03, 1],
          }}
          transition={{
            duration: 0.3,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute -inset-6 rounded-3xl blur-2xl"
          style={{
            background: `radial-gradient(circle, ${accentColor || 'hsl(var(--primary))'}50 0%, transparent 70%)`,
          }}
        />
      )}

      {/* Victory explosion glow */}
      {isLanded && !prefersReducedMotion && (
        <>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: [0.6, 0.9, 0.6],
              scale: [1, 1.08, 1],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -inset-8 rounded-3xl blur-3xl"
            style={{
              background: accentColor 
                ? `radial-gradient(circle, ${accentColor}60 0%, ${accentColor}20 50%, transparent 80%)`
                : "radial-gradient(circle, hsl(var(--primary) / 0.5) 0%, hsl(var(--primary) / 0.15) 50%, transparent 80%)",
            }}
          />
          {/* Secondary rainbow shimmer */}
          <motion.div
            initial={{ opacity: 0, rotate: 0 }}
            animate={{ 
              opacity: [0.3, 0.5, 0.3],
              rotate: 360,
            }}
            transition={{
              opacity: { duration: 2, repeat: Infinity },
              rotate: { duration: 8, repeat: Infinity, ease: "linear" },
            }}
            className="absolute -inset-10 rounded-full blur-2xl"
            style={{
              background: "conic-gradient(from 0deg, #a855f7, #ec4899, #f97316, #22c55e, #3b82f6, #a855f7)",
            }}
          />
        </>
      )}

      {/* Frame border with dynamic styling */}
      <div 
        className={cn(
          "relative rounded-2xl p-3",
          "bg-gradient-to-b from-muted via-muted to-muted/80",
          "border-4 transition-colors duration-300",
          isLanded 
            ? "border-yellow-400/80 shadow-[0_0_30px_rgba(250,204,21,0.4)]" 
            : isActive 
              ? "border-primary/60" 
              : "border-muted-foreground/20",
        )}
      >
        {/* Chasing perimeter lights */}
        {!prefersReducedMotion && (isAnticipation || isActive || isLanded) && (
          <div className="absolute inset-0 pointer-events-none overflow-visible rounded-xl">
            {perimeterLights.map((light, idx) => {
              const chaseDelay = (idx / PERIMETER_LIGHTS) * getChaseDuration();
              
              return (
                <motion.div
                  key={light.id}
                  className="absolute rounded-full"
                  style={{
                    left: `${light.x}%`,
                    top: `${light.y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: isLanded ? 10 : 6,
                    height: isLanded ? 10 : 6,
                  }}
                  animate={{
                    backgroundColor: isLanded 
                      ? ["#facc15", "#fff", "#facc15"]
                      : isActive
                        ? [accentColor || "hsl(var(--primary))", "#fff", accentColor || "hsl(var(--primary))"]
                        : ["hsl(var(--primary) / 0.3)", "hsl(var(--primary))", "hsl(var(--primary) / 0.3)"],
                    boxShadow: isLanded
                      ? ["0 0 8px #facc15", "0 0 20px #fff", "0 0 8px #facc15"]
                      : isActive
                        ? ["0 0 4px currentColor", "0 0 12px currentColor", "0 0 4px currentColor"]
                        : "0 0 2px currentColor",
                    scale: isLanded ? [1, 1.5, 1] : isActive ? [0.8, 1.2, 0.8] : 1,
                  }}
                  transition={{
                    duration: getChaseDuration(),
                    repeat: Infinity,
                    delay: chaseDelay,
                    ease: "easeInOut",
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Corner accent lights */}
        {(isActive || isLanded) && !prefersReducedMotion && (
          <>
            {[
              { top: -4, left: -4 },
              { top: -4, right: -4 },
              { bottom: -4, left: -4 },
              { bottom: -4, right: -4 },
            ].map((pos, i) => (
              <motion.div
                key={i}
                className="absolute w-4 h-4 rounded-full"
                style={{
                  ...pos,
                  background: isLanded ? "#facc15" : accentColor || "hsl(var(--primary))",
                }}
                animate={{
                  scale: [1, 1.4, 1],
                  boxShadow: isLanded 
                    ? ["0 0 10px #facc15", "0 0 25px #facc15", "0 0 10px #facc15"]
                    : ["0 0 5px currentColor", "0 0 15px currentColor", "0 0 5px currentColor"],
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </>
        )}

        {/* Inner content area */}
        <div 
          className={cn(
            "relative bg-background rounded-xl p-4",
            isLanded && "shadow-inner",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export const SlotFrame = memo(SlotFrameComponent);

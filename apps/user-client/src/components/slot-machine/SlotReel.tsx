/**
 * SlotReel - ENHANCED with blur effects and dramatic landing
 * Larger display with motion blur during spin and celebratory landing
 */

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getArchetypeInfo } from "./archetypeData";
import { cn } from "@/lib/utils";
import type { SlotMachineState } from "./useSlotMachine";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface SlotReelProps {
  visibleItems: string[];
  state: SlotMachineState;
  highlightColor?: string;
  intensity?: number;
}

function SlotReelComponent({ visibleItems, state, highlightColor, intensity = 0 }: SlotReelProps) {
  const prefersReducedMotion = useReducedMotion();
  const isSpinning = state === "spinning";
  const isSlowing = state === "slowing";
  const isNearMiss = state === "nearMiss";
  const isActive = isSpinning || isSlowing || isNearMiss;
  const isLanded = state === "landed";
  const isAnticipation = state === "anticipation";

  // Calculate blur based on spin speed
  const getBlurAmount = () => {
    if (isSpinning) return 3;
    if (isSlowing) return 1;
    return 0;
  };

  return (
    <div 
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-gradient-to-b from-muted/30 via-muted/50 to-muted/30",
        "transition-all duration-300",
        // Larger size for better visibility
        "w-80 h-96",
      )}
      style={{
        willChange: isActive ? "transform" : "auto",
      }}
    >
      {/* Animated ring on landing */}
      {isLanded && !prefersReducedMotion && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ 
            opacity: 1, 
            scale: 1,
            boxShadow: [
              `0 0 0 6px ${highlightColor || 'hsl(var(--primary))'}`,
              `0 0 0 12px ${highlightColor || 'hsl(var(--primary))'}40`,
              `0 0 0 6px ${highlightColor || 'hsl(var(--primary))'}`,
            ],
          }}
          transition={{
            opacity: { duration: 0.3 },
            scale: { duration: 0.4, ease: "backOut" },
            boxShadow: { duration: 1.5, repeat: Infinity },
          }}
          className="absolute inset-0 rounded-2xl pointer-events-none z-30"
        />
      )}

      {/* Anticipation pulse effect */}
      {isAnticipation && !prefersReducedMotion && (
        <motion.div
          animate={{ 
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
          }}
          className="absolute inset-0 bg-primary/10 rounded-2xl pointer-events-none"
        />
      )}

      {/* Top fade gradient */}
      <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-background via-background/80 to-transparent z-10 pointer-events-none" />
      
      {/* Bottom fade gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background via-background/80 to-transparent z-10 pointer-events-none" />

      {/* Speed lines during fast spin */}
      {isSpinning && !prefersReducedMotion && (
        <div className="absolute inset-0 pointer-events-none z-5 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute left-1/2 w-px bg-gradient-to-b from-transparent via-primary/40 to-transparent"
              style={{
                height: '100%',
                transform: `translateX(${(i - 3) * 15}px)`,
              }}
              animate={{
                y: ['-100%', '100%'],
                opacity: [0, 0.6, 0],
              }}
              transition={{
                duration: 0.15,
                repeat: Infinity,
                delay: i * 0.02,
                ease: "linear",
              }}
            />
          ))}
        </div>
      )}

      {/* Reel items */}
      <AnimatePresence mode="popLayout">
        <div 
          className="flex flex-col items-center justify-center h-full gap-1 py-3"
          style={{
            filter: prefersReducedMotion ? 'none' : `blur(${getBlurAmount()}px)`,
            transition: 'filter 0.2s ease-out',
          }}
        >
          {visibleItems.map((name, idx) => {
            const info = getArchetypeInfo(name);
            const isCenter = idx === 1;
            
            return (
              <motion.div
                key={`${name}-${idx}`}
                initial={isActive ? { y: -50, opacity: 0 } : false}
                animate={{ 
                  y: 0, 
                  opacity: isCenter ? 1 : 0.25,
                  scale: isCenter 
                    ? isLanded 
                      ? 1.15 
                      : isNearMiss 
                        ? 0.95 
                        : 1 
                    : 0.6,
                }}
                exit={{ y: 50, opacity: 0 }}
                transition={{ 
                  duration: isSpinning ? 0.04 : isSlowing ? 0.1 : 0.4,
                  ease: isLanded ? [0.34, 1.56, 0.64, 1] : "linear", // Bouncy on land
                }}
                className={cn(
                  "flex flex-col items-center justify-center",
                  isCenter && isLanded && "z-20",
                )}
                style={{
                  willChange: isActive ? "transform, opacity" : "auto",
                }}
              >
                {/* Glow behind center item on landing */}
                {isCenter && isLanded && !prefersReducedMotion && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ 
                      opacity: [0.5, 0.8, 0.5],
                      scale: [1, 1.1, 1],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                    }}
                    className="absolute w-36 h-36 rounded-full blur-xl -z-10"
                    style={{
                      background: highlightColor 
                        ? `radial-gradient(circle, ${highlightColor}60 0%, transparent 70%)`
                        : "radial-gradient(circle, hsl(var(--primary) / 0.5) 0%, transparent 70%)",
                    }}
                  />
                )}
                
                <img
                  src={info.image}
                  alt={info.name}
                  className={cn(
                    "object-contain transition-all",
                    isCenter 
                      ? isLanded 
                        ? "w-64 h-64 drop-shadow-[0_0_30px_rgba(168,85,247,0.6)]" 
                        : "w-52 h-52"
                      : "w-36 h-36 filter grayscale-[50%]",
                  )}
                  loading="eager"
                  onLoad={(e) => {
                    console.log(`Image loaded: ${info.name}`, e.currentTarget.src);
                  }}
                  onError={(e) => {
                    console.error(`Image failed to load: ${info.name}`, e.currentTarget.src);
                  }}
                />
                
                {/* Show name on landing */}
                {isCenter && isLanded && (
                  <motion.span
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                    className="mt-1 text-sm font-semibold"
                    style={{ color: highlightColor }}
                  >
                    {info.name}
                  </motion.span>
                )}
              </motion.div>
            );
          })}
        </div>
      </AnimatePresence>

      {/* Center highlight line */}
      <motion.div 
        className="absolute top-1/2 left-2 right-2 h-[3px] -translate-y-1/2 z-20 rounded-full"
        animate={{
          backgroundColor: isLanded 
            ? highlightColor || "hsl(var(--primary))"
            : "hsl(var(--primary) / 0.3)",
          boxShadow: isLanded 
            ? `0 0 10px ${highlightColor || 'hsl(var(--primary))'}` 
            : "none",
        }}
        transition={{ duration: 0.3 }}
      />
      
      {/* Secondary guide lines */}
      <div className="absolute top-[30%] left-4 right-4 h-px bg-muted-foreground/10 z-20" />
      <div className="absolute top-[70%] left-4 right-4 h-px bg-muted-foreground/10 z-20" />
    </div>
  );
}

export const SlotReel = memo(SlotReelComponent);

/**
 * SlotReel - Spinning reel component with 3 visible items
 * Uses transform-only animations for 60fps performance
 */

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getArchetypeInfo } from "./archetypeData";
import { cn } from "@/lib/utils";
import type { SlotMachineState } from "./useSlotMachine";

interface SlotReelProps {
  visibleItems: string[];
  state: SlotMachineState;
  highlightColor?: string;
}

function SlotReelComponent({ visibleItems, state, highlightColor }: SlotReelProps) {
  const isSpinning = state === "spinning" || state === "slowing";
  const isLanded = state === "landed";

  return (
    <div 
      className={cn(
        "relative w-32 h-40 overflow-hidden rounded-xl",
        "bg-gradient-to-b from-muted/50 to-muted",
        isLanded && "ring-4 ring-offset-2 ring-primary",
      )}
      style={{
        willChange: isSpinning ? "transform" : "auto",
        ...(isLanded && highlightColor ? { "--tw-ring-color": highlightColor } as React.CSSProperties : {}),
      }}
    >
      {/* Top fade gradient */}
      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
      
      {/* Bottom fade gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />

      {/* Reel items container */}
      <AnimatePresence mode="popLayout">
        <div className="flex flex-col items-center justify-center h-full gap-1 py-2">
          {visibleItems.map((name, idx) => {
            const info = getArchetypeInfo(name);
            const isCenter = idx === 1;
            
            return (
              <motion.div
                key={`${name}-${idx}`}
                initial={isSpinning ? { y: -40, opacity: 0 } : false}
                animate={{ 
                  y: 0, 
                  opacity: isCenter ? 1 : 0.4,
                  scale: isCenter ? (isLanded ? 1.1 : 1) : 0.7,
                }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ 
                  duration: isSpinning ? 0.06 : 0.3,
                  ease: isLanded ? "backOut" : "linear",
                }}
                className={cn(
                  "flex items-center justify-center",
                  isCenter && isLanded && "drop-shadow-lg",
                )}
                style={{
                  willChange: isSpinning ? "transform, opacity" : "auto",
                }}
              >
                <img
                  src={info.image}
                  alt={info.name}
                  className={cn(
                    "w-24 h-24 object-contain",
                    !isCenter && "filter blur-[1px]",
                  )}
                  loading="eager"
                />
              </motion.div>
            );
          })}
        </div>
      </AnimatePresence>

      {/* Center highlight line */}
      <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-primary/20 -translate-y-1/2 z-20" />
    </div>
  );
}

export const SlotReel = memo(SlotReelComponent);

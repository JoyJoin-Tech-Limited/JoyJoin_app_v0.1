/**
 * ArchetypePreview - Layered archetype images with confidence ring
 * Shows top 3 archetypes with leader in front and 2nd/3rd behind
 */

import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { ConfidenceRing } from "./ConfidenceRing";
import { getArchetypeInfo, getArchetypeColorHSL } from "@/components/slot-machine/archetypeData";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface ArchetypeMatch {
  archetype: string;
  score: number;
  confidence: number;
}

interface ArchetypePreviewProps {
  /** Array of archetype matches, sorted by confidence */
  matches: ArchetypeMatch[];
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

const SIZE_CONFIG = {
  sm: { main: 80, secondary: 48, ring: 96 },
  md: { main: 120, secondary: 72, ring: 144 },
  lg: { main: 160, secondary: 96, ring: 192 },
};

function ArchetypePreviewComponent({ matches, size = "md" }: ArchetypePreviewProps) {
  const prefersReducedMotion = useReducedMotion();
  const config = SIZE_CONFIG[size];
  
  // Get top 3 matches
  const topMatches = useMemo(() => matches.slice(0, 3), [matches]);
  
  if (topMatches.length === 0) return null;

  const leader = topMatches[0];
  const leaderInfo = getArchetypeInfo(leader.archetype);
  const leaderColor = getArchetypeColorHSL(leader.archetype);

  return (
    <div className="relative flex items-center justify-center">
      {/* Background secondary archetypes */}
      <div className="absolute inset-0 flex items-center justify-center">
        {topMatches.slice(1).map((match, idx) => {
          const info = getArchetypeInfo(match.archetype);
          const offsetX = idx === 0 ? -config.secondary * 0.4 : config.secondary * 0.4;
          const offsetY = -config.secondary * 0.1;
          
          return (
            <motion.div
              key={match.archetype}
              initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.5, scale: 1 }}
              transition={{ delay: 0.2 + idx * 0.1 }}
              className="absolute"
              style={{
                transform: `translate(${offsetX}px, ${offsetY}px)`,
                zIndex: 0,
              }}
            >
              <img
                src={info.image}
                alt={info.name}
                className="object-contain filter blur-[2px] opacity-60"
                style={{
                  width: config.secondary,
                  height: config.secondary,
                }}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Leader archetype with confidence ring */}
      <ConfidenceRing
        confidence={leader.confidence}
        size={config.ring}
        strokeWidth={size === "sm" ? 3 : size === "md" ? 4 : 5}
        color={leaderColor}
      >
        <motion.div
          initial={prefersReducedMotion ? {} : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 15 }}
          className="relative"
        >
          {/* Glow effect */}
          {!prefersReducedMotion && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: `radial-gradient(circle, ${leaderColor}30 0%, transparent 70%)`,
                filter: "blur(8px)",
              }}
              animate={{
                opacity: [0.5, 0.8, 0.5],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}
          
          {/* Floating animation for leader image */}
          <motion.img
            src={leaderInfo.image}
            alt={leaderInfo.name}
            className={cn(
              "object-contain relative z-10 drop-shadow-lg",
            )}
            style={{
              width: config.main,
              height: config.main,
            }}
            animate={prefersReducedMotion ? {} : {
              y: [-2, 2, -2],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>
      </ConfidenceRing>
    </div>
  );
}

export const ArchetypePreview = memo(ArchetypePreviewComponent);

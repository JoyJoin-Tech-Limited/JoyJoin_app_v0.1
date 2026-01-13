/**
 * UnlockOverlay - Pokemon-style archetype reveal component
 * Shows dramatic "unlock" animation between slot machine and results page
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Sparkles } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { getArchetypeInfo } from "./slot-machine/archetypeData";

interface UnlockOverlayProps {
  archetype: string;
  accentColor: string;
  onComplete: () => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  angle: number;
  speed: number;
}

const CELEBRATION_COLORS = [
  "#a855f7", // purple
  "#ec4899", // pink  
  "#f97316", // orange
  "#22c55e", // green
  "#3b82f6", // blue
  "#facc15", // yellow
];

const TOTAL_DURATION = 2500; // 2.5 seconds total

export function UnlockOverlay({ archetype, accentColor, onComplete }: UnlockOverlayProps) {
  const prefersReducedMotion = useReducedMotion();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showText, setShowText] = useState(false);
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const archetypeInfo = getArchetypeInfo(archetype);

  const accentWithAlpha = useCallback((alpha: number) => {
    if (accentColor.startsWith("hsl(")) {
      return accentColor.replace("hsl(", "hsla(").replace(")", `, ${alpha})`);
    }
    return accentColor;
  }, [accentColor]);

  // Generate particle burst
  const createParticleBurst = useCallback(() => {
    const newParticles: Particle[] = [];
    const particleCount = 40;
    
    for (let i = 0; i < particleCount; i++) {
      const palette = [...CELEBRATION_COLORS, accentColor];
      const color = palette[Math.floor(Math.random() * palette.length)] || "#facc15";
      newParticles.push({
        id: i,
        x: 50, // Center
        y: 40,
        color,
        size: 6 + Math.random() * 6,
        angle: (i / particleCount) * 360 + Math.random() * 20,
        speed: 150 + Math.random() * 150,
      });
    }
    
    return newParticles;
  }, [accentColor]);

  // Initialize animation sequence
  useEffect(() => {
    isMountedRef.current = true;

    // Create particle burst immediately
    if (!prefersReducedMotion) {
      setParticles(createParticleBurst());
    }

    // Show text after 300ms delay
    textTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setShowText(true);
      }
    }, 300);

    // Auto-complete after total duration
    completeTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        onComplete();
      }
    }, prefersReducedMotion ? 1000 : TOTAL_DURATION);

    return () => {
      isMountedRef.current = false;
      if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
      if (textTimeoutRef.current) clearTimeout(textTimeoutRef.current);
    };
  }, [onComplete, prefersReducedMotion, createParticleBurst]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      {/* Screen reader announcement */}
      <div aria-live="polite" role="status" className="sr-only">
        你的独特社交DNA已解锁：{archetypeInfo.name}
      </div>

      {/* Radial glow background */}
      {!prefersReducedMotion && (
        <motion.div
          initial={{ scale: 0.5, opacity: 0.8 }}
          animate={{ scale: [0.5, 2, 3], opacity: [0.8, 0.4, 0] }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div
            className="w-60 h-60 rounded-full blur-3xl"
            style={{
              background: `radial-gradient(circle, ${accentWithAlpha(0.8)} 0%, transparent 70%)`,
              boxShadow: `0 0 100px ${accentColor}`,
            }}
          />
        </motion.div>
      )}

      {/* Particle explosion */}
      {!prefersReducedMotion && particles.length > 0 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <AnimatePresence>
            {particles.map((particle) => {
              const radians = (particle.angle * Math.PI) / 180;
              const endX = particle.x + Math.cos(radians) * particle.speed;
              const endY = particle.y + Math.sin(radians) * particle.speed;
              
              return (
                <motion.div
                  key={particle.id}
                  className="absolute"
                  style={{
                    left: `${particle.x}%`,
                    top: `${particle.y}%`,
                  }}
                  initial={{ 
                    scale: 0, 
                    opacity: 1,
                    x: 0,
                    y: 0,
                  }}
                  animate={{ 
                    scale: [0, 1.5, 1, 0.3],
                    opacity: [1, 1, 0.6, 0],
                    x: `${(endX - particle.x)}vw`,
                    y: `${(endY - particle.y)}vh`,
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 1.8,
                    ease: "easeOut",
                    delay: Math.random() * 0.15,
                  }}
                >
                  <Star 
                    className="fill-current" 
                    style={{ 
                      color: particle.color, 
                      width: particle.size, 
                      height: particle.size,
                      filter: `drop-shadow(0 0 ${particle.size}px ${particle.color})`,
                    }} 
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 text-center space-y-6">
        {/* Avatar with rotation and scale animation */}
        <motion.div
          initial={{ scale: 0, rotate: -180, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: prefersReducedMotion ? 100 : 200,
            damping: prefersReducedMotion ? 20 : 15,
            duration: prefersReducedMotion ? 0.3 : 0.8,
          }}
          className="flex justify-center relative"
        >
          {/* Glow ring behind avatar */}
          {!prefersReducedMotion && (
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [0.6, 0.8, 0.6],
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity,
                ease: "easeInOut" 
              }}
              className="absolute inset-0 rounded-full blur-xl"
              style={{
                background: `radial-gradient(circle, ${accentWithAlpha(0.6)} 0%, transparent 70%)`,
              }}
            />
          )}

          {/* Avatar image */}
          <div 
            className="w-40 h-40 rounded-full p-1 relative"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentWithAlpha(0.6)})`,
              boxShadow: `0 0 40px ${accentWithAlpha(0.5)}`,
            }}
          >
            <img
              src={archetypeInfo.image}
              alt={archetypeInfo.name}
              className="w-full h-full rounded-full object-cover"
            />
          </div>

          {/* Shimmer effect */}
          {!prefersReducedMotion && (
            <motion.div
              animate={{ 
                rotate: [0, 360],
              }}
              transition={{ 
                duration: 3, 
                repeat: Infinity,
                ease: "linear" 
              }}
              className="absolute inset-0"
            >
              <div 
                className="w-full h-full rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, transparent 0%, ${accentWithAlpha(0.4)} 10%, transparent 20%, transparent 100%)`,
                }}
              />
            </motion.div>
          )}
        </motion.div>

        {/* Text reveal */}
        <AnimatePresence>
          {showText && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="space-y-3"
            >
              {/* Unlock message */}
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-500" />
                <p 
                  className="text-xl font-bold"
                  style={{ 
                    color: accentColor,
                    textShadow: `0 0 20px ${accentWithAlpha(0.5)}`,
                  }}
                >
                  你的独特社交DNA已解锁！
                </p>
                <Sparkles className="w-5 h-5 text-yellow-500" />
              </div>

              {/* Archetype name */}
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 150 }}
                className="text-3xl font-bold flex items-center justify-center gap-2"
                style={{ color: accentColor }}
              >
                <span className="text-4xl">{archetypeInfo.emoji}</span>
                <span>{archetypeInfo.name}</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

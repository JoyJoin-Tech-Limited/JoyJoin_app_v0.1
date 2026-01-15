/**
 * UnlockOverlay - Pokemon-style archetype reveal component
 * Shows dramatic "unlock" animation between slot machine and results page
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { getArchetypeInfo, getArchetypeColorHSL } from "./slot-machine/archetypeData";
import { accentWithAlpha, type Particle } from "./slot-machine/particleUtils";
import { getArchetypeGradient } from "@/lib/archetypeAdapter";

interface UnlockOverlayProps {
  archetype: string;
  accentColor?: string; // Deprecated: now using archetypeHSL internally
  onComplete: () => void;
}

const TOTAL_DURATION = 2200; // 2.2 seconds total (snappier for mobile)
const MOBILE_PARTICLE_COUNT = 40; // Capped for WeChat mini program performance

export function UnlockOverlay({ archetype, onComplete }: UnlockOverlayProps) {
  const prefersReducedMotion = useReducedMotion();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showFlash, setShowFlash] = useState(true); // Initial flash effect
  const [showText, setShowText] = useState(false);
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const archetypeInfo = getArchetypeInfo(archetype);
  const archetypeGradient = getArchetypeGradient(archetype);
  const archetypeHSL = getArchetypeColorHSL(archetype);

  // Generate particle burst - mobile optimized with archetype-coordinated colors
  const createParticleBurst = useCallback(() => {
    const newParticles: Particle[] = [];
    // Use archetype HSL color and derive complementary palette
    const archetypePalette = [
      archetypeHSL,
      accentWithAlpha(archetypeHSL, 0.8),
      "#facc15", // Gold accent
      "#f472b6", // Pink accent
    ];
    
    for (let i = 0; i < MOBILE_PARTICLE_COUNT; i++) {
      const color = archetypePalette[Math.floor(Math.random() * archetypePalette.length)] || archetypeHSL;
      newParticles.push({
        id: i,
        x: 50, // Center
        y: 40,
        color,
        size: 5 + Math.random() * 4, // Slightly smaller for mobile
        angle: (i / MOBILE_PARTICLE_COUNT) * 360 + Math.random() * 15,
        speed: 120 + Math.random() * 100, // Reduced speed for mobile
        type: 'confetti', // Simple circles only for performance
      });
    }
    
    return newParticles;
  }, [archetypeHSL]);

  // Initialize animation sequence with flash → burst → avatar → text
  useEffect(() => {
    isMountedRef.current = true;

    // Flash effect fades after 80ms
    flashTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setShowFlash(false);
      }
    }, 80);

    // Create particle burst after flash
    if (!prefersReducedMotion) {
      setTimeout(() => {
        if (isMountedRef.current) {
          setParticles(createParticleBurst());
        }
      }, 60);
    }

    // Show text after 200ms delay (staggered after avatar)
    textTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setShowText(true);
      }
    }, 200);

    // Auto-complete after total duration
    completeTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        onComplete();
      }
    }, prefersReducedMotion ? 800 : TOTAL_DURATION);

    return () => {
      isMountedRef.current = false;
      if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
      if (textTimeoutRef.current) clearTimeout(textTimeoutRef.current);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, [onComplete, prefersReducedMotion, createParticleBurst]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      {/* Screen reader announcement */}
      <div aria-live="polite" role="status" className="sr-only">
        你的独特社交DNA已解锁：{archetypeInfo.name}
      </div>

      {/* Initial flash effect - mobile optimized */}
      {!prefersReducedMotion && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: showFlash ? 1 : 0 }}
          transition={{ duration: 0.08, ease: "easeOut" }}
          className="absolute inset-0 pointer-events-none z-60"
          style={{
            background: `radial-gradient(circle at 50% 40%, ${accentWithAlpha(archetypeHSL, 0.9)} 0%, white 30%, transparent 60%)`,
          }}
        />
      )}

      {/* Radial glow background - uses archetype gradient for color alignment */}
      {!prefersReducedMotion && (
        <motion.div
          initial={{ scale: 0.5, opacity: 0.9 }}
          animate={{ scale: [0.5, 1.8, 2.5], opacity: [0.9, 0.5, 0] }}
          transition={{ duration: 1.0, ease: "easeOut" }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div
            className="w-48 h-48 rounded-full"
            style={{
              background: archetypeGradient,
              filter: 'blur(40px)',
            }}
          />
        </motion.div>
      )}

      {/* Particle explosion - mobile optimized with simple circles */}
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
                  className="absolute rounded-full"
                  style={{
                    left: `${particle.x}%`,
                    top: `${particle.y}%`,
                    backgroundColor: particle.color,
                    width: particle.size,
                    height: particle.size,
                  }}
                  initial={{ 
                    scale: 0, 
                    opacity: 1,
                    x: 0,
                    y: 0,
                  }}
                  animate={{ 
                    scale: [0, 1.2, 0.8, 0],
                    opacity: [1, 1, 0.5, 0],
                    x: `${(endX - particle.x)}vw`,
                    y: `${(endY - particle.y)}vh`,
                  }}
                  transition={{
                    duration: 1.5, // Slightly faster for mobile
                    ease: "easeOut",
                    delay: Math.random() * 0.1,
                  }}
                />
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 text-center space-y-6">
        {/* Avatar with enhanced scale overshoot animation */}
        <motion.div
          initial={{ scale: 0, rotate: -90, opacity: 0 }}
          animate={{ scale: [0, 1.15, 0.95, 1], rotate: 0, opacity: 1 }}
          transition={{
            scale: { 
              duration: prefersReducedMotion ? 0.3 : 0.5,
              times: [0, 0.5, 0.75, 1],
              ease: "easeOut"
            },
            rotate: {
              type: "spring",
              stiffness: prefersReducedMotion ? 100 : 180,
              damping: prefersReducedMotion ? 20 : 12,
            },
            opacity: { duration: 0.15 }
          }}
          className="flex justify-center relative"
        >
          {/* Glow ring behind avatar - uses archetype gradient */}
          {!prefersReducedMotion && (
            <motion.div
              animate={{ 
                scale: [1, 1.08, 1],
                opacity: [0.5, 0.7, 0.5],
              }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity,
                ease: "easeInOut" 
              }}
              className="absolute inset-0 rounded-full"
              style={{
                background: archetypeGradient,
                filter: 'blur(20px)',
              }}
            />
          )}

          {/* Avatar image with archetype-aligned gradient border */}
          <div 
            className="w-36 h-36 rounded-full p-1 relative"
            style={{
              background: archetypeGradient,
            }}
          >
            <img
              src={archetypeInfo.image}
              alt={archetypeInfo.name}
              className="w-full h-full rounded-full object-cover bg-background"
            />
          </div>

          {/* Subtle shimmer - simplified for mobile */}
          {!prefersReducedMotion && (
            <motion.div
              animate={{ 
                rotate: [0, 360],
              }}
              transition={{ 
                duration: 4, 
                repeat: Infinity,
                ease: "linear" 
              }}
              className="absolute inset-0"
            >
              <div 
                className="w-full h-full rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, transparent 0%, ${accentWithAlpha(archetypeHSL, 0.3)} 8%, transparent 16%, transparent 100%)`,
                }}
              />
            </motion.div>
          )}
        </motion.div>

        {/* Text reveal - staggered timing for impact */}
        <AnimatePresence>
          {showText && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="space-y-2"
            >
              {/* Unlock message */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-yellow-500" />
                <p 
                  className="text-lg font-bold"
                  style={{ 
                    color: archetypeHSL,
                  }}
                >
                  你的独特社交DNA已解锁！
                </p>
                <Sparkles className="w-4 h-4 text-yellow-500" />
              </motion.div>

              {/* Archetype name - staggered reveal with overshoot (no emoji per project rules) */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [0.8, 1.05, 1], opacity: 1 }}
                transition={{ 
                  delay: 0.15, 
                  duration: 0.35,
                  times: [0, 0.6, 1],
                  ease: "easeOut"
                }}
                className="text-2xl font-bold flex items-center justify-center"
                style={{ color: archetypeHSL }}
              >
                <span>{archetypeInfo.name}</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

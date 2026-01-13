/**
 * ArchetypeSlotMachine - ENHANCED main slot machine reveal component
 * Features: multi-phase pacing, particle explosion, hero card reveal
 */

import { memo, useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper, Sparkles, Crown, Star } from "lucide-react";
import { SlotReel } from "./SlotReel";
import { SlotFrame } from "./SlotFrame";
import { useSlotMachine, type SlotMachineState } from "./useSlotMachine";
import { getArchetypeInfo, getArchetypeColorHSL } from "./archetypeData";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface ArchetypeSlotMachineProps {
  finalArchetype: string;
  confidence?: number;
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
  type: 'confetti' | 'star' | 'spark';
}

const CELEBRATION_COLORS = [
  "#a855f7", // purple
  "#ec4899", // pink  
  "#f97316", // orange
  "#22c55e", // green
  "#3b82f6", // blue
  "#facc15", // yellow
  "#f43f5e", // rose
  "#06b6d4", // cyan
];

const GOLD_STAR_COLOR = "#facc15";
const MAX_PARTICLES = 60;
const MAX_SPIN_MS = 4000;

function ArchetypeSlotMachineComponent({ 
  finalArchetype, 
  confidence, 
  onComplete 
}: ArchetypeSlotMachineProps) {
  const prefersReducedMotion = useReducedMotion();
  const [showParticles, setShowParticles] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [showHeroCard, setShowHeroCard] = useState(false);
  const [phaseText, setPhaseText] = useState("准备揭晓...");
  
  const particleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heroTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const archetypeInfo = getArchetypeInfo(finalArchetype);
  const accentColor = getArchetypeColorHSL(finalArchetype);
  const accentWithAlpha = useCallback((alpha: number) => {
    if (accentColor.startsWith("hsl(")) {
      return accentColor.replace("hsl(", "hsla(").replace(")", `, ${alpha})`);
    }
    return accentColor;
  }, [accentColor]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (particleTimeoutRef.current) clearTimeout(particleTimeoutRef.current);
      if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
      if (heroTimeoutRef.current) clearTimeout(heroTimeoutRef.current);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, []);

  // Generate explosion particles
  const createParticleExplosion = useCallback(() => {
    const newParticles: Particle[] = [];
    
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const rand = Math.random();
      const type = rand < 0.5 ? 'star' : rand < 0.85 ? 'confetti' : 'spark';
      const palette = type === 'star'
        ? [GOLD_STAR_COLOR, GOLD_STAR_COLOR, accentColor]
        : [...CELEBRATION_COLORS, accentColor];
      const color = palette[Math.floor(Math.random() * palette.length)] || GOLD_STAR_COLOR;
      newParticles.push({
        id: i,
        x: 50 + (Math.random() - 0.5) * 20, // Center with spread
        y: 40 + (Math.random() - 0.5) * 10,
        color,
        size: type === 'spark' ? 4 : type === 'star' ? 14 : 8,
        angle: (i / MAX_PARTICLES) * 360 + Math.random() * 30,
        speed: 180 + Math.random() * 220,
        type,
      });
    }
    
    return newParticles;
  }, [accentColor]);

  // Handle phase changes
  const handlePhaseChange = useCallback((phase: SlotMachineState) => {
    if (!isMountedRef.current) return;
    
    switch (phase) {
      case "anticipation":
        setPhaseText("即将揭晓...");
        break;
      case "spinning":
        setPhaseText("命运转动中...");
        break;
      case "slowing":
        setPhaseText("就快了...");
        break;
      case "nearMiss":
        setPhaseText("等等...");
        break;
      case "landed":
        setPhaseText("");
        break;
    }
  }, []);

  // Handle landing
  const handleLand = useCallback(() => {
    if (!isMountedRef.current) return;
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    
    setShowResult(true);
    setShowHeroCard(true);
    
    if (!prefersReducedMotion) {
      // Particle explosion
      setParticles(createParticleExplosion());
      setShowParticles(true);
      
      // Clean up particles
      particleTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setShowParticles(false);
          setParticles([]);
        }
      }, 2400);
    }

    // Navigate to results - increased dwell time from 1.5s to 2s
    completeTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        onComplete();
      }
    }, prefersReducedMotion ? 900 : 2000);
  }, [onComplete, prefersReducedMotion, createParticleExplosion]);

  const { state, visibleItems, start, progress, intensity } = useSlotMachine({
    finalArchetype,
    onLand: handleLand,
    onPhaseChange: handlePhaseChange,
  });

  useEffect(() => {
    safetyTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      setShowResult(true);
      onComplete();
    }, MAX_SPIN_MS);

    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    };
  }, [onComplete]);

  // Auto-start with dramatic pause
  useEffect(() => {
    const timer = setTimeout(() => {
      start();
    }, 600);
    
    return () => clearTimeout(timer);
  }, [start]);

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col items-center justify-center p-4 relative">
      {/* Screen reader announcements */}
      <div aria-live="polite" role="status" className="sr-only">
        {state !== "landed"
          ? phaseText
          : showResult
            ? `结果揭晓：你是${archetypeInfo.name}${
                confidence ? `，匹配度 ${Math.round(confidence * 100)}%` : ""
              }`
            : ""}
      </div>

      {/* Accent tint overlay on reveal */}
      <motion.div
        className="fixed inset-0 pointer-events-none z-30"
        initial={{ opacity: 0 }}
        animate={{ opacity: showResult ? 0.35 : 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{
          background: `radial-gradient(circle at 50% 40%, ${accentWithAlpha(0.25)} 0%, transparent 45%), linear-gradient(180deg, ${accentWithAlpha(0.12)} 0%, transparent 60%)`,
          mixBlendMode: "screen",
        }}
      />

      {/* Particle explosion overlay */}
      {showParticles && !prefersReducedMotion && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
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
                    scale: [0, 1.5, 1, 0.5],
                    opacity: [1, 1, 0.8, 0],
                    x: `${(endX - particle.x)}vw`,
                    y: `${(endY - particle.y)}vh`,
                    rotate: particle.type === 'confetti' ? [0, 720] : 0,
                  }}
                  transition={{
                    duration: particle.type === 'spark' ? 0.8 : 2,
                    ease: "easeOut",
                    delay: Math.random() * 0.2,
                  }}
                >
                  {particle.type === 'star' ? (
                    <Star 
                      className="fill-current" 
                      style={{ color: particle.color, width: particle.size, height: particle.size }} 
                    />
                  ) : particle.type === 'spark' ? (
                    <div 
                      className="rounded-full"
                      style={{ 
                        backgroundColor: particle.color, 
                        width: particle.size, 
                        height: particle.size,
                        boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
                      }} 
                    />
                  ) : (
                    <div 
                      className="rounded-sm"
                      style={{ 
                        backgroundColor: particle.color, 
                        width: particle.size, 
                        height: particle.size * 0.6,
                      }} 
                    />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Radial burst on landing */}
      {showResult && !prefersReducedMotion && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0.9 }}
          animate={{ scale: [0.6, 1.8, 3], opacity: [0.9, 0.5, 0] }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 pointer-events-none z-40 flex items-center justify-center"
        >
          <motion.div
            className="w-40 h-40 rounded-full blur-3xl"
            style={{
              background: `radial-gradient(circle, ${accentWithAlpha(0.9)} 0%, transparent 70%)`,
              boxShadow: `0 0 60px ${accentColor}`
            }}
            animate={{ scale: [1, 1.6, 2.2], opacity: [0.7, 0.35, 0] }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        </motion.div>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          {state === "landed" ? (
            <>
              <Crown className="w-6 h-6 text-yellow-500" />
              <h2 className="text-2xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                恭喜！
              </h2>
              <Crown className="w-6 h-6 text-yellow-500" />
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              <h2 className="text-xl font-bold">揭晓你的社交原型</h2>
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            </>
          )}
        </div>
        
        {/* Phase indicator text */}
        <AnimatePresence mode="wait">
          {phaseText && state !== "landed" && (
            <motion.p
              key={phaseText}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-sm text-muted-foreground"
            >
              {phaseText}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Slot Machine */}
      <SlotFrame state={state} accentColor={accentColor} intensity={intensity}>
        <div className="flex flex-col items-center gap-4">
          <SlotReel 
            visibleItems={visibleItems} 
            state={state}
            highlightColor={accentColor}
            intensity={intensity}
          />
          
          {/* Progress bar with glow */}
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden relative">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: state === "landed" 
                  ? `linear-gradient(90deg, ${accentColor}, #facc15, ${accentColor})`
                  : accentColor || "hsl(var(--primary))",
              }}
              initial={{ width: 0 }}
              animate={{ 
                width: `${progress}%`,
                boxShadow: state === "landed" 
                  ? `0 0 12px ${accentColor}` 
                  : "none",
              }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            />
            {/* Shimmer effect during spin */}
            {(state === "spinning" || state === "slowing") && !prefersReducedMotion && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            )}
          </div>
        </div>
      </SlotFrame>

      {/* Hero result card */}
      <AnimatePresence>
        {showHeroCard && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: [0.85, 1.2, 1] }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: 0.6, 
              ease: [0.34, 1.56, 0.64, 1], // Bouncy
            }}
            className="mt-8 text-center relative"
          >
            {/* Glow behind text */}
            {!prefersReducedMotion && (
              <motion.div
                animate={{ 
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1, 1.05, 1],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 blur-2xl -z-10"
                style={{
                  background: `radial-gradient(circle, ${accentWithAlpha(0.4)} 0%, transparent 70%)`,
                }}
              />
            )}
            
            <div className="flex items-center justify-center gap-2 mb-3">
              <PartyPopper className="w-7 h-7 text-yellow-500" />
              <span className="text-lg font-medium">你是</span>
              <PartyPopper className="w-7 h-7 text-yellow-500" />
            </div>
            
            {/* Large archetype name with gradient */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.45, ease: "easeOut" }}
              className="text-4xl font-bold mb-3 flex items-center justify-center gap-2"
              style={{ 
                color: accentColor,
                textShadow: `0 0 30px ${accentWithAlpha(0.5)}`,
              }}
            >
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 18 }}
              >
                {archetypeInfo.emoji}
              </motion.span>
              <div className="flex">
                {archetypeInfo.name.split("").map((char, idx) => (
                  <motion.span
                    key={idx}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + idx * 0.05, duration: 0.3, ease: "easeOut" }}
                  >
                    {char}
                  </motion.span>
                ))}
              </div>
            </motion.div>
            
            {/* Confidence badge */}
            {confidence && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-primary/20"
              >
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-medium">
                  匹配度 {Math.round(confidence * 100)}%
                </span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating celebration elements on landing */}
      {showResult && !prefersReducedMotion && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{
                left: `${10 + i * 12}%`,
                top: '100%',
              }}
              animate={{
                y: [0, -window.innerHeight - 100],
                x: [0, (Math.random() - 0.5) * 100],
                rotate: [0, 360],
                opacity: [0.8, 0.8, 0],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                delay: Math.random() * 0.5,
                ease: "easeOut",
              }}
            >
              <Sparkles 
                className="w-6 h-6" 
                style={{ color: CELEBRATION_COLORS[i % CELEBRATION_COLORS.length] }}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export const ArchetypeSlotMachine = memo(ArchetypeSlotMachineComponent);

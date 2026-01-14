/**
 * AdaptiveProgress - Premium progress bar for dynamic assessment flows
 * 
 * Features:
 * - Glassmorphism design with gradient glow
 * - Shimmer animation for premium feel
 * - Particle trail (mobile-optimized)
 * - Pulsating glowing tip
 * - Milestone celebration particles (25%, 50%, 75%)
 * - Dynamic archetype accent colors
 * - Endowed Progress Effect (starts at 10%)
 * - Goal Gradient Effect (faster animation near 100%)
 * - Accessibility support
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export interface AdaptiveProgressProps {
  /** Progress value 0-100 */
  value: number;
  /** Context of the progress (affects starting point) */
  context?: 'onboarding' | 'assessment' | 'default';
  /**
   * Remaining questions count, used primarily for accessibility
   * (e.g. ARIA labels). The parent is responsible for any visual
   * display of the remaining count.
   */
  remaining?: number;
  /** Trigger particle burst at milestone */
  milestoneReached?: boolean;
  /** Dynamic accent color (archetype color) */
  accentColor?: string;
  /** Show encouragement text */
  showEncouragement?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AdaptiveProgress Component
 * 
 * Premium progress bar with glassmorphism, particles, and milestone celebrations
 */
export const AdaptiveProgress = React.forwardRef<
  HTMLDivElement,
  AdaptiveProgressProps
>(({ 
  value, 
  context = 'default',
  remaining,
  milestoneReached = false,
  accentColor,
  showEncouragement = false,
  className,
  ...props 
}, ref) => {
  const prefersReducedMotion = useReducedMotion();
  
  // Apply Endowed Progress Effect - never show 0%
  // Allow context to influence the minimum displayed progress
  const endowedMinByContext: Record<NonNullable<AdaptiveProgressProps["context"]>, number> = {
    onboarding: 15,
    assessment: 5,
    default: 10, // preserve existing behavior for the default case
  };
  const endowedMin = endowedMinByContext[context] ?? endowedMinByContext.default;
  const displayValue = Math.max(endowedMin, Math.min(100, value));
  
  // Goal Gradient Effect - faster animation near completion
  const animationDuration = displayValue >= 90 ? 0.3 : 0.6;
  
  // Determine accent color - use CSS variable or prop
  const progressColor = accentColor 
    ? accentColor 
    : 'hsl(280, 45%, 55%)'; // Default purple matching --primary
  
  // Calculate glow intensity based on progress
  const glowSize = displayValue < 25 ? 12 : displayValue < 75 ? 16 : 24;
  
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={Math.round(displayValue)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`测评进度 ${Math.round(displayValue)}%${remaining ? `，还剩约${remaining}题` : ''}`}
      className={cn("relative", className)}
      {...props}
    >
      {/* Glassmorphism container */}
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gradient-to-r from-muted/50 to-muted/30 backdrop-blur-sm border border-white/10">
        {/* Shimmer effect background */}
        {!prefersReducedMotion && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        )}
        
        {/* Progress fill with gradient */}
        <motion.div
          className="h-full relative overflow-hidden rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: `${displayValue}%` }}
          transition={{ 
            duration: animationDuration, 
            ease: 'easeOut' 
          }}
          style={{
            background: `linear-gradient(to right, ${progressColor}, ${progressColor})`,
            boxShadow: `0 0 ${glowSize}px hsl(280 45% 55% / 0.4)`,
          }}
        >
          {/* Inner shimmer on progress bar */}
          {!prefersReducedMotion && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          )}
          
          {/* Particle trail - mobile optimized */}
          {!prefersReducedMotion && displayValue > 10 && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2">
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 rounded-full bg-white/80"
                  initial={{ x: 0, opacity: 0.8, scale: 1 }}
                  animate={{
                    x: [-4 * i, -4 * i - 4],
                    opacity: [0.8, 0],
                    scale: [1, 0.5],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: 'easeOut',
                  }}
                  style={{ right: 4 * i }}
                />
              ))}
            </div>
          )}
          
          {/* Glowing tip */}
          {displayValue > 0 && displayValue < 100 && (
            <motion.div
              className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white"
              animate={prefersReducedMotion ? {} : {
                scale: [1, 1.4, 1],
                opacity: [0.9, 1, 0.9],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{
                boxShadow: `0 0 8px rgba(255, 255, 255, 0.8)`,
              }}
            />
          )}
        </motion.div>
      </div>
      
      {/* Milestone celebration particles */}
      <AnimatePresence>
        {milestoneReached && !prefersReducedMotion && (
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {Array.from({ length: 8 }).map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              const distance = 40;
              const x = Math.cos(angle) * distance;
              const y = Math.sin(angle) * distance;
              
              return (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-primary"
                  style={{
                    left: '50%',
                    top: '50%',
                  }}
                  initial={{ 
                    x: 0, 
                    y: 0, 
                    opacity: 1, 
                    scale: 1 
                  }}
                  animate={{
                    x,
                    y,
                    opacity: 0,
                    scale: 0,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: 0.6,
                    ease: 'easeOut',
                  }}
                />
              );
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});

AdaptiveProgress.displayName = "AdaptiveProgress";

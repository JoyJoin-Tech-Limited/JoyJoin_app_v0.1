/**
 * SegmentedProgress - Duolingo-style segmented progress bar
 * 
 * Features:
 * - Segmented bars for fixed-step flows
 * - Current segment pulses and grows
 * - Smooth animations between segments
 * - Three variants: 'duolingo', 'minimal', 'dots'
 */

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export interface SegmentedProgressProps {
  /** Current step index (0-based) */
  current: number;
  /** Total number of steps */
  total: number;
  /** Visual variant */
  variant?: 'duolingo' | 'minimal' | 'dots';
  /** Additional CSS classes */
  className?: string;
}

/**
 * SegmentedProgress Component
 * 
 * Displays progress as segmented bars (Duolingo-style) for fixed-step flows
 */
export const SegmentedProgress = React.forwardRef<
  HTMLDivElement,
  SegmentedProgressProps
>(({ 
  current, 
  total, 
  variant = 'duolingo',
  className,
  ...props 
}, ref) => {
  const prefersReducedMotion = useReducedMotion();
  
  if (variant === 'dots') {
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={current + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`第 ${current + 1} 步，共 ${total} 步`}
        className={cn("flex items-center justify-center gap-2", className)}
        {...props}
      >
        {Array.from({ length: total }).map((_, index) => {
          const isCompleted = index < current;
          const isCurrent = index === current;
          const isUpcoming = index > current;
          
          return (
            <motion.div
              key={index}
              className={cn(
                "rounded-full transition-all duration-300",
                isCompleted && "bg-primary w-2 h-2",
                isCurrent && "bg-primary w-3 h-3",
                isUpcoming && "bg-gray-300 dark:bg-gray-600 w-2 h-2"
              )}
              initial={false}
              animate={isCurrent && !prefersReducedMotion ? {
                scale: [1, 1.2, 1],
                transition: { duration: 0.4, repeat: Infinity, repeatDelay: 2 }
              } : { scale: 1 }}
            />
          );
        })}
      </div>
    );
  }
  
  if (variant === 'minimal') {
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={current + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`第 ${current + 1} 步，共 ${total} 步`}
        className={cn("flex items-center gap-1", className)}
        {...props}
      >
        {Array.from({ length: total }).map((_, index) => {
          const isCompleted = index < current;
          const isCurrent = index === current;
          const isUpcoming = index > current;
          
          return (
            <div
              key={index}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                isCompleted && "bg-primary flex-1",
                isCurrent && "bg-primary flex-1",
                isUpcoming && "bg-gray-200 dark:bg-gray-700 flex-1"
              )}
            />
          );
        })}
      </div>
    );
  }
  
  // Duolingo variant (default)
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={current + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`第 ${current + 1} 步，共 ${total} 步`}
      className={cn("flex items-center gap-1.5", className)}
      {...props}
    >
      {Array.from({ length: total }).map((_, index) => {
        const isCompleted = index < current;
        const isCurrent = index === current;
        const isUpcoming = index > current;
        
        return (
          <motion.div
            key={index}
            className={cn(
              "rounded-full transition-all duration-300",
              isCompleted && "bg-primary h-2 flex-1",
              isCurrent && "bg-primary h-3 flex-[1.5]",
              isUpcoming && "bg-gray-200 dark:bg-gray-700 h-2 flex-1"
            )}
            initial={false}
            animate={isCurrent && !prefersReducedMotion ? {
              scale: [1, 1.05, 1],
              transition: { duration: 0.4, repeat: Infinity, repeatDelay: 2 }
            } : { scale: 1 }}
            style={
              isCurrent
                ? { boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)' }
                : undefined
            }
          />
        );
      })}
    </div>
  );
});

SegmentedProgress.displayName = "SegmentedProgress";

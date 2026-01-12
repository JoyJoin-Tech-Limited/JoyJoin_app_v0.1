/**
 * Slot machine state machine hook
 * States: idle → spinning → slowing → landed
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { ARCHETYPE_NAMES } from "./archetypeData";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export type SlotMachineState = "idle" | "spinning" | "slowing" | "landed";

interface UseSlotMachineOptions {
  finalArchetype: string;
  onLand?: () => void;
  spinDuration?: number; // ms for fast spinning phase
  slowSteps?: number; // number of deceleration steps
}

interface SlotMachineReturn {
  state: SlotMachineState;
  currentIndex: number;
  visibleItems: string[];
  start: () => void;
  progress: number; // 0-100 for animation progress
}

export function useSlotMachine({
  finalArchetype,
  onLand,
  spinDuration = 1500,
  slowSteps = 10,
}: UseSlotMachineOptions): SlotMachineReturn {
  const prefersReducedMotion = useReducedMotion();
  const [state, setState] = useState<SlotMachineState>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slowStepRef = useRef(0);
  const startTimeRef = useRef(0);

  // Ensure final archetype is in the list
  const finalIndex = ARCHETYPE_NAMES.indexOf(finalArchetype);
  const targetIndex = finalIndex >= 0 ? finalIndex : 0;

  // Calculate 3 visible items centered on currentIndex
  const getVisibleItems = useCallback((idx: number): string[] => {
    const len = ARCHETYPE_NAMES.length;
    const prevIdx = (idx - 1 + len) % len;
    const nextIdx = (idx + 1) % len;
    return [
      ARCHETYPE_NAMES[prevIdx],
      ARCHETYPE_NAMES[idx],
      ARCHETYPE_NAMES[nextIdx],
    ];
  }, []);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const triggerHaptic = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([80, 40, 80, 40, 160]);
    }
  }, []);

  const startSlowing = useCallback(() => {
    setState("slowing");
    slowStepRef.current = 0;
    
    const baseDelay = 80;
    let delay = baseDelay;
    let idx = currentIndex;

    const slowDown = () => {
      slowStepRef.current++;
      setProgress(80 + (slowStepRef.current / slowSteps) * 20);
      
      // Calculate how many steps until we land on target
      const stepsRemaining = slowSteps - slowStepRef.current;
      const totalItems = ARCHETYPE_NAMES.length;
      
      // Move towards target with decreasing speed
      if (slowStepRef.current < slowSteps) {
        // Calculate distance to target
        const distToTarget = (targetIndex - idx + totalItems) % totalItems;
        
        // Move 1 or more steps based on remaining distance and steps
        if (distToTarget > stepsRemaining) {
          // Need to move faster to reach target
          idx = (idx + Math.max(1, Math.floor(distToTarget / stepsRemaining))) % totalItems;
        } else if (distToTarget > 0) {
          idx = (idx + 1) % totalItems;
        }
        
        setCurrentIndex(idx);
        
        // Exponential slowdown
        delay = baseDelay + (slowStepRef.current * slowStepRef.current * 8);
        timeoutRef.current = setTimeout(slowDown, delay);
      } else {
        // Final landing
        setCurrentIndex(targetIndex);
        setState("landed");
        setProgress(100);
        triggerHaptic();
        onLand?.();
      }
    };

    slowDown();
  }, [currentIndex, targetIndex, slowSteps, onLand, triggerHaptic]);

  const start = useCallback(() => {
    cleanup();
    
    // For reduced motion, skip to result immediately
    if (prefersReducedMotion) {
      setCurrentIndex(targetIndex);
      setState("landed");
      setProgress(100);
      triggerHaptic();
      // Small delay before calling onLand for visual feedback
      timeoutRef.current = setTimeout(() => {
        onLand?.();
      }, 500);
      return;
    }

    setState("spinning");
    setProgress(0);
    startTimeRef.current = Date.now();
    slowStepRef.current = 0;

    // Fast spinning phase (60ms interval)
    const spinInterval = 60;
    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % ARCHETYPE_NAMES.length);
      
      const elapsed = Date.now() - startTimeRef.current;
      setProgress(Math.min(80, (elapsed / spinDuration) * 80));
      
      if (elapsed >= spinDuration) {
        cleanup();
        startSlowing();
      }
    }, spinInterval);
  }, [cleanup, spinDuration, startSlowing, prefersReducedMotion, targetIndex, triggerHaptic, onLand]);

  return {
    state,
    currentIndex,
    visibleItems: getVisibleItems(currentIndex),
    start,
    progress,
  };
}

/**
 * Slot machine state machine hook - ENHANCED VERSION
 * States: idle → anticipation → spinning → slowing → nearMiss → landed
 * 
 * Multi-phase pacing for maximum dramatic impact:
 * 1. anticipation: Build tension with brief delay
 * 2. spinning: Fast, blur-speed rotation
 * 3. slowing: Dramatic deceleration with suspense
 * 4. nearMiss: Tease past the target once for extra tension
 * 5. landed: Victory moment with celebration
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { ARCHETYPE_NAMES } from "./archetypeData";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export type SlotMachineState = "idle" | "anticipation" | "spinning" | "slowing" | "nearMiss" | "landed";

interface UseSlotMachineOptions {
  finalArchetype: string;
  onLand?: () => void;
  onPhaseChange?: (phase: SlotMachineState) => void;
}

interface SlotMachineReturn {
  state: SlotMachineState;
  currentIndex: number;
  visibleItems: string[];
  start: () => void;
  progress: number;
  intensity: number; // 0-1 for visual effects intensity
}

// Haptic patterns for different phases
const HAPTIC_PATTERNS = {
  anticipation: [30],
  spinStart: [50, 30, 50],
  slowing: [20],
  nearMiss: [40, 20, 40],
  land: [100, 50, 100, 50, 200],
};

export function useSlotMachine({
  finalArchetype,
  onLand,
  onPhaseChange,
}: UseSlotMachineOptions): SlotMachineReturn {
  const prefersReducedMotion = useReducedMotion();
  const [state, setState] = useState<SlotMachineState>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [intensity, setIntensity] = useState(0);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef<number | null>(null);
  const slowStepRef = useRef(0);
  const startTimeRef = useRef(0);
  const isMountedRef = useRef(true);

  // Find target index
  const finalIndex = ARCHETYPE_NAMES.indexOf(finalArchetype);
  const targetIndex = finalIndex >= 0 ? finalIndex : 0;

  // Get 3 visible items centered on current
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
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  const triggerHaptic = useCallback((pattern: number[]) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }, []);

  const updateState = useCallback((newState: SlotMachineState) => {
    if (!isMountedRef.current) return;
    setState(newState);
    onPhaseChange?.(newState);
  }, [onPhaseChange]);

  // Phase 4: Near miss - overshoot target, then snap back
  const startNearMiss = useCallback(() => {
    updateState("nearMiss");
    triggerHaptic(HAPTIC_PATTERNS.nearMiss);
    setIntensity(1);
    
    // Overshoot by 1-2 positions
    const overshoot = (targetIndex + 1) % ARCHETYPE_NAMES.length;
    setCurrentIndex(overshoot);
    setProgress(92);
    
    // Pause for suspense
    timeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      
      // Snap back to target
      setCurrentIndex(targetIndex);
      setProgress(100);
      updateState("landed");
      triggerHaptic(HAPTIC_PATTERNS.land);
      
      // Fire callback immediately so celebration effects start right away
      onLand?.();
    }, 400);
  }, [targetIndex, updateState, triggerHaptic, onLand]);

  // Phase 3: Dramatic slowdown
  const startSlowing = useCallback(() => {
    updateState("slowing");
    slowStepRef.current = 0;
    
    const totalSlowSteps = 12;
    let idx = currentIndex;
    
    const slowDown = () => {
      if (!isMountedRef.current) return;
      
      slowStepRef.current++;
      const stepProgress = slowStepRef.current / totalSlowSteps;
      setProgress(60 + stepProgress * 30);
      setIntensity(0.5 + stepProgress * 0.3);
      
      // Light haptic on each tick during slowdown
      if (slowStepRef.current % 3 === 0) {
        triggerHaptic(HAPTIC_PATTERNS.slowing);
      }
      
      if (slowStepRef.current < totalSlowSteps) {
        const len = ARCHETYPE_NAMES.length;
        const distToTarget = (targetIndex - idx + len) % len;
        const stepsRemaining = totalSlowSteps - slowStepRef.current;
        
        // Move towards target
        if (distToTarget > stepsRemaining + 1) {
          const jump = Math.max(1, Math.floor(distToTarget / stepsRemaining));
          idx = (idx + jump) % len;
        } else if (distToTarget > 1) {
          idx = (idx + 1) % len;
        }
        
        setCurrentIndex(idx);
        
        // Exponential slowdown curve
        const baseDelay = 80;
        const delay = baseDelay + Math.pow(slowStepRef.current, 2) * 12;
        timeoutRef.current = setTimeout(slowDown, delay);
      } else {
        // Decide: go to nearMiss or land directly
        // 70% chance of near miss for extra drama
        if (Math.random() < 0.7) {
          startNearMiss();
        } else {
          setCurrentIndex(targetIndex);
          setProgress(100);
          setIntensity(1);
          updateState("landed");
          triggerHaptic(HAPTIC_PATTERNS.land);
          
          // Fire callback immediately so celebration effects start right away
          onLand?.();
        }
      }
    };
    
    slowDown();
  }, [currentIndex, targetIndex, updateState, triggerHaptic, startNearMiss, onLand]);

  // Phase 2: Fast spinning
  const startSpinning = useCallback(() => {
    updateState("spinning");
    triggerHaptic(HAPTIC_PATTERNS.spinStart);
    startTimeRef.current = Date.now();
    
    const spinDuration = 2000; // 2 seconds of fast spin
    const spinInterval = 50; // Very fast
    
    intervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      
      setCurrentIndex(prev => (prev + 1) % ARCHETYPE_NAMES.length);
      
      const elapsed = Date.now() - startTimeRef.current;
      const spinProgress = Math.min(1, elapsed / spinDuration);
      setProgress(10 + spinProgress * 50);
      
      // Intensity ramps up during spin
      setIntensity(0.3 + spinProgress * 0.4);
      
      if (elapsed >= spinDuration) {
        cleanup();
        startSlowing();
      }
    }, spinInterval);
  }, [cleanup, updateState, triggerHaptic, startSlowing]);

  // Phase 1: Anticipation build-up
  const start = useCallback(() => {
    cleanup();
    
    // Reduced motion: skip to result
    if (prefersReducedMotion) {
      setCurrentIndex(targetIndex);
      updateState("landed");
      setProgress(100);
      setIntensity(1);
      triggerHaptic(HAPTIC_PATTERNS.land);
      timeoutRef.current = setTimeout(() => {
        onLand?.();
      }, 800);
      return;
    }
    
    // Anticipation phase
    updateState("anticipation");
    setProgress(0);
    setIntensity(0.1);
    triggerHaptic(HAPTIC_PATTERNS.anticipation);
    
    // Brief anticipation build
    let anticipationStep = 0;
    const anticipationDuration = 800;
    const anticipationInterval = 100;
    
    intervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      
      anticipationStep++;
      setProgress(anticipationStep * 1.5);
      setIntensity(0.1 + anticipationStep * 0.025);
      
      if (anticipationStep * anticipationInterval >= anticipationDuration) {
        cleanup();
        startSpinning();
      }
    }, anticipationInterval);
  }, [cleanup, prefersReducedMotion, targetIndex, updateState, triggerHaptic, onLand, startSpinning]);

  return {
    state,
    currentIndex,
    visibleItems: getVisibleItems(currentIndex),
    start,
    progress,
    intensity,
  };
}

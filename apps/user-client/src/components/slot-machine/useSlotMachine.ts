/**
 * Slot machine state machine hook - DETERMINISTIC VERSION with GUARANTEED PRECISION LANDING
 * States: idle → anticipation → spinning → slowing → nearMiss → landed
 * 
 * KEY IMPROVEMENTS (2026-01-26):
 * - GUARANTEED precise landing on finalArchetype (100% accuracy)
 * - Deterministic pre-calculated position array eliminates race conditions
 * - No timing dependencies - works regardless of spinning phase position
 * - Near-miss is optional dramatic effect that ALWAYS snaps back to correct archetype
 * - No probabilistic landing issues - fully deterministic target hitting
 * 
 * Multi-phase pacing for maximum dramatic impact:
 * 1. anticipation: Build tension with brief delay
 * 2. spinning: Fast, blur-speed rotation
 * 3. slowing: Dramatic deceleration with pre-calculated positions
 * 4. nearMiss: Tease past the target once for extra tension (OPTIONAL)
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
  const hasLandedRef = useRef(false);
  const slowingStartedRef = useRef(false);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLandRef = useRef(onLand);

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
    if (spinTimeoutRef.current) {
      clearTimeout(spinTimeoutRef.current);
      spinTimeoutRef.current = null;
    }
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    slowingStartedRef.current = false;
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

  const updateProgress = useCallback((value: number) => {
    const clamped = Math.min(Math.max(value, 0), 100);
    setProgress(clamped);
    if (clamped >= 100 && !hasLandedRef.current) {
      hasLandedRef.current = true;
      onLandRef.current?.();
    }
  }, []);

  useEffect(() => {
    onLandRef.current = onLand;
  }, [onLand]);

  // Phase 4: Near miss - overshoot target, then snap back
  // GUARANTEED to end at targetIndex for precise landing
  const startNearMiss = useCallback(() => {
    updateState("nearMiss");
    triggerHaptic(HAPTIC_PATTERNS.nearMiss);
    setIntensity(1);
    
    // Overshoot by exactly 1 position for dramatic effect
    const overshoot = (targetIndex + 1) % ARCHETYPE_NAMES.length;
    setCurrentIndex(overshoot);
    updateProgress(92);
    
    // Pause for suspense, then GUARANTEE snap back to correct target
    timeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      
      // CRITICAL: Always land on targetIndex - no randomness
      setCurrentIndex(targetIndex);
      updateProgress(100);
      updateState("landed");
      triggerHaptic(HAPTIC_PATTERNS.land);
      
      // Fire callback immediately so celebration effects start right away
      if (!hasLandedRef.current) {
        hasLandedRef.current = true;
        onLand?.();
      }
    }, 400);
  }, [targetIndex, updateState, triggerHaptic, onLand, updateProgress]);

  // Phase 3: Dramatic slowdown
  // DETERMINISTIC: Pre-calculated position array for 100% accuracy
  const startSlowing = useCallback(() => {
    if (slowingStartedRef.current || hasLandedRef.current) return;
    slowingStartedRef.current = true;
    updateState("slowing");
    slowStepRef.current = 0;
    
    const len = ARCHETYPE_NAMES.length;
    const totalSlowSteps = 10;
    
    // Calculate exact positions we need to hit to reach target
    const positions: number[] = [];
    for (let i = 0; i < totalSlowSteps; i++) {
      const pos = (targetIndex - (totalSlowSteps - 1 - i) + len) % len;
      positions.push(pos);
    }
    
    const slowDown = () => {
      if (!isMountedRef.current || hasLandedRef.current) return;
      
      const step = slowStepRef.current;
      
      if (step < totalSlowSteps) {
        // Use pre-calculated position - guaranteed precision
        setCurrentIndex(positions[step]);
        
        const stepProgress = (step + 1) / totalSlowSteps;
        updateProgress(60 + stepProgress * 30);
        setIntensity(0.5 + stepProgress * 0.3);
        
        if ((step + 1) % 3 === 0) {
          triggerHaptic(HAPTIC_PATTERNS.slowing);
        }
        
        slowStepRef.current++;
        const baseDelay = 80;
        const delay = baseDelay + step * 50;
        timeoutRef.current = setTimeout(slowDown, delay);
      } else {
        // Reached end of slowing - now decide near-miss or direct land
        const shouldNearMiss = Math.random() < 0.7 && targetIndex >= 0;
        
        if (shouldNearMiss) {
          startNearMiss();
        } else {
          // Direct land on target
          setCurrentIndex(targetIndex);
          updateProgress(100);
          setIntensity(1);
          updateState("landed");
          triggerHaptic(HAPTIC_PATTERNS.land);
          
          if (!hasLandedRef.current) {
            hasLandedRef.current = true;
            onLand?.();
          }
        }
      }
    };
    
    slowDown();
  }, [targetIndex, updateState, triggerHaptic, startNearMiss, onLand, updateProgress]);

  // Phase 2: Fast spinning
  const startSpinning = useCallback(() => {
    updateState("spinning");
    triggerHaptic(HAPTIC_PATTERNS.spinStart);
    startTimeRef.current = Date.now();
    hasLandedRef.current = false;
    slowingStartedRef.current = false;
    
    const spinDuration = 3600; // 3.6 seconds of spin (increased from 2.8s for better visibility)
    const spinInterval = 120; // Slower for readability (increased from 80ms)
    
    intervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      
      setCurrentIndex(prev => (prev + 1) % ARCHETYPE_NAMES.length);
      
      const elapsed = Date.now() - startTimeRef.current;
      const spinProgress = Math.min(1, elapsed / spinDuration);
      updateProgress(10 + spinProgress * 50);
      
      // Intensity ramps up during spin
      setIntensity(0.3 + spinProgress * 0.4);
      
      if (elapsed >= spinDuration && !slowingStartedRef.current) {
        cleanup();
        startSlowing();
      }
    }, spinInterval);

    spinTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current || slowingStartedRef.current) return;
      cleanup();
      startSlowing();
    }, spinDuration + 200);
  }, [cleanup, updateState, triggerHaptic, startSlowing]);

  // Phase 1: Anticipation build-up
  const start = useCallback(() => {
    cleanup();
    hasLandedRef.current = false;
    slowingStartedRef.current = false;
    
    // Reduced motion: skip to result
    if (prefersReducedMotion) {
      setCurrentIndex(targetIndex >= 0 ? targetIndex : 0);
      updateState("landed");
      updateProgress(100);
      setIntensity(1);
      triggerHaptic(HAPTIC_PATTERNS.land);
      timeoutRef.current = setTimeout(() => {
        if (!hasLandedRef.current) {
          hasLandedRef.current = true;
          onLand?.();
        }
      }, 800);
      return;
    }
    
    // Anticipation phase
    updateState("anticipation");
    updateProgress(0);
    setIntensity(0.1);
    triggerHaptic(HAPTIC_PATTERNS.anticipation);
    
    // Brief anticipation build
    let anticipationStep = 0;
    const anticipationDuration = 900; // Slightly longer build-up for mobile
    const anticipationInterval = 100;
    
    intervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      
      anticipationStep++;
      updateProgress(anticipationStep * 1.5);
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

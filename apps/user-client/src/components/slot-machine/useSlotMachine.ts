import { useState, useEffect, useRef, useCallback } from "react";
import { ALL_ARCHETYPES, getArchetypeIndex } from "./archetypeData";

export type SlotPhase = "idle" | "spinning" | "slowing" | "landed";

interface UseSlotMachineOptions {
  targetArchetype: string;
  autoStart?: boolean;
  spinDuration?: number;
  slowDuration?: number;
  reduceMotion?: boolean;
  onComplete?: () => void;
}

export function useSlotMachine({
  targetArchetype,
  autoStart = true,
  spinDuration = 1400,
  slowDuration = 1100,
  reduceMotion = false,
  onComplete,
}: UseSlotMachineOptions) {
  const [phase, setPhase] = useState<SlotPhase>("idle");
  const [activeIndex, setActiveIndex] = useState(() => Math.floor(Math.random() * ALL_ARCHETYPES.length));
  const targetIndex = getArchetypeIndex(targetArchetype);

  const spinIntervalRef = useRef<number | null>(null);
  const slowIntervalRef = useRef<number | null>(null);
  const landTimeoutRef = useRef<number | null>(null);
  const finishTimeoutRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (spinIntervalRef.current) {
      clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = null;
    }
    if (slowIntervalRef.current) {
      clearInterval(slowIntervalRef.current);
      slowIntervalRef.current = null;
    }
    if (landTimeoutRef.current) {
      clearTimeout(landTimeoutRef.current);
      landTimeoutRef.current = null;
    }
    if (finishTimeoutRef.current) {
      clearTimeout(finishTimeoutRef.current);
      finishTimeoutRef.current = null;
    }
  }, []);

  const landOnTarget = useCallback(() => {
    clearTimers();
    setPhase("landed");
    setActiveIndex(targetIndex);
    finishTimeoutRef.current = window.setTimeout(() => {
      onComplete?.();
    }, reduceMotion ? 100 : 700);
  }, [clearTimers, onComplete, reduceMotion, targetIndex]);

  const start = useCallback(() => {
    clearTimers();

    if (reduceMotion) {
      landOnTarget();
      return;
    }

    setPhase("spinning");
    setActiveIndex((prev) => (prev + 1) % ALL_ARCHETYPES.length);

    spinIntervalRef.current = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % ALL_ARCHETYPES.length);
    }, 70);

    landTimeoutRef.current = window.setTimeout(() => {
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
      }

      setPhase("slowing");
      slowIntervalRef.current = window.setInterval(() => {
        setActiveIndex((prev) => (prev + 1) % ALL_ARCHETYPES.length);
      }, 120);

      finishTimeoutRef.current = window.setTimeout(() => {
        if (slowIntervalRef.current) {
          clearInterval(slowIntervalRef.current);
          slowIntervalRef.current = null;
        }
        landOnTarget();
      }, slowDuration);
    }, spinDuration);
  }, [clearTimers, landOnTarget, reduceMotion, slowDuration, spinDuration]);

  useEffect(() => {
    if (autoStart) {
      start();
    }
    return () => clearTimers();
  }, [autoStart, clearTimers, start]);

  return {
    phase,
    activeIndex,
    targetIndex,
    start,
  };
}

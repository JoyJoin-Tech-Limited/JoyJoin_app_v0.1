/**
 * DynamicAccentContext - Provider managing CSS variables for dynamic accent color
 * Subtly shifts UI accent color based on the user's emerging top archetype
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { 
  getArchetypeHSL, 
  DEFAULT_ACCENT, 
  MIN_CONFIDENCE_THRESHOLD,
  type ArchetypeHSL 
} from "@/data/archetypeColors";

interface DynamicAccentContextValue {
  /** Current accent HSL values */
  currentAccent: ArchetypeHSL;
  /** Whether accent is transitioning */
  isTransitioning: boolean;
  /** Set the accent based on archetype and confidence */
  setArchetype: (archetype: string | null, confidence: number) => void;
  /** Reset to default accent */
  reset: () => void;
  /** Whether dynamic accent is enabled */
  enabled: boolean;
}

const DynamicAccentContext = createContext<DynamicAccentContextValue | null>(null);

export function useDynamicAccent(): DynamicAccentContextValue {
  const context = useContext(DynamicAccentContext);
  if (!context) {
    throw new Error("useDynamicAccent must be used within DynamicAccentProvider");
  }
  return context;
}

interface DynamicAccentProviderProps {
  children: React.ReactNode;
  /** Enable/disable dynamic accent (default: true) */
  enabled?: boolean;
}

export function DynamicAccentProvider({ 
  children, 
  enabled = true 
}: DynamicAccentProviderProps) {
  const [currentAccent, setCurrentAccent] = useState<ArchetypeHSL>(DEFAULT_ACCENT);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const lastArchetypeRef = useRef<string | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Update CSS variables when accent changes - skip if disabled
  useEffect(() => {
    if (!enabled) return;

    const root = document.documentElement;
    root.style.setProperty("--accent-dynamic-h", String(currentAccent.h));
    root.style.setProperty("--accent-dynamic-s", `${currentAccent.s}%`);
    root.style.setProperty("--accent-dynamic-l", `${currentAccent.l}%`);
  }, [currentAccent, enabled]);

  // Track mounted state and cleanup all timeouts on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
    };
  }, []);

  const setArchetype = useCallback((archetype: string | null, confidence: number) => {
    if (!enabled) return;
    
    // Don't change if confidence is too low
    if (confidence < MIN_CONFIDENCE_THRESHOLD) return;
    
    // Don't change if same archetype
    if (archetype === lastArchetypeRef.current) return;

    lastArchetypeRef.current = archetype;
    const newAccent = getArchetypeHSL(archetype);
    
    // Add transitioning class to body for CSS transitions
    setIsTransitioning(true);
    document.body.classList.add("accent-transitioning");
    
    setCurrentAccent(newAccent);
    
    // Remove transitioning class after transition completes
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    transitionTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setIsTransitioning(false);
        document.body.classList.remove("accent-transitioning");
      }
    }, 400); // Match CSS transition duration
  }, [enabled]);

  const reset = useCallback(() => {
    lastArchetypeRef.current = null;
    setCurrentAccent(DEFAULT_ACCENT);
    
    // Clean up transition state
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    setIsTransitioning(false);
    document.body.classList.remove("accent-transitioning");
  }, []);

  return (
    <DynamicAccentContext.Provider
      value={{
        currentAccent,
        isTransitioning,
        setArchetype,
        reset,
        enabled,
      }}
    >
      {children}
    </DynamicAccentContext.Provider>
  );
}

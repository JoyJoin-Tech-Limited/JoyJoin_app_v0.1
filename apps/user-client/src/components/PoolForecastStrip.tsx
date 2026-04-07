/**
 * PoolForecastStrip
 *
 * A lightweight, premium strip that surfaces a deterministic pool-level
 * atmosphere forecast on the discovery card.
 *
 * Layer boundary: this strip is strictly pool-layer atmospheric guidance.
 * It describes momentum, tendency, and energy — it does NOT imply a table
 * has formed or that matching has been promised.
 *
 * Behaviour:
 *   - Renders the primary forecast line immediately
 *   - If multiple lines are available, cycles with a soft vertical fade every 4 s
 *   - Respects `prefers-reduced-motion`: animation disabled, first line only shown
 *
 * Visual intent: light, readable at a glance, non-dominant — the card's
 * micro-magic layer before the user taps in.
 */

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { getPoolForecast } from "@/lib/poolForecast";

// How long each forecast line is shown before cycling to the next (ms).
const CYCLE_INTERVAL_MS = 4000;

interface PoolForecastStripProps {
  registrationCount: number;
  sampleArchetypes: string[];
  /** Pool matching threshold; defaults to 4. */
  minGroupSize?: number;
  eventType?: "饭局" | "酒局";
  className?: string;
}

export function PoolForecastStrip({
  registrationCount,
  sampleArchetypes,
  minGroupSize,
  eventType,
  className = "",
}: PoolForecastStripProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;

  const forecast = getPoolForecast({
    registrationCount,
    sampleArchetypes,
    minGroupSize,
    eventType,
  });

  const [lineIndex, setLineIndex] = useState(0);

  // Stable key that only changes when the archetypes list actually changes
  const archetypesKey = useMemo(
    () => sampleArchetypes.join(","),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sampleArchetypes.length, ...sampleArchetypes],
  );

  useEffect(() => {
    // Reset index when inputs change (e.g. real-time count update)
    setLineIndex(0);
  }, [registrationCount, archetypesKey]);

  useEffect(() => {
    if (prefersReducedMotion || forecast.lines.length <= 1) return;
    const id = setInterval(() => {
      setLineIndex((i) => (i + 1) % forecast.lines.length);
    }, CYCLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [forecast.lines.length, prefersReducedMotion]);

  const staticLine = forecast.lines[0];
  const currentLine = forecast.lines[lineIndex];

  return (
    <div
      className={`flex items-center gap-1.5 text-[11px] text-primary/70 ${className}`}
      data-testid="pool-forecast-strip"
      aria-label={`池子预报：${staticLine}`}
    >
      <Sparkles
        className="h-3 w-3 shrink-0 text-primary/60"
        aria-hidden="true"
      />

      {prefersReducedMotion ? (
        // Reduced-motion: static first line, no animation
        <span className="truncate leading-none">{staticLine}</span>
      ) : (
        // Full motion: cycle lines with a subtle vertical fade
        <div
          className="relative min-w-0 flex-1 overflow-hidden"
          style={{ height: "1rem" /* 16px — one line of text-[11px] */ }}
          aria-live="polite"
          aria-atomic="true"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={lineIndex}
              className="absolute inset-0 truncate leading-none"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {currentLine}
            </motion.span>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

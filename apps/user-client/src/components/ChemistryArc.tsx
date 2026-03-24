/**
 * ChemistryArc
 *
 * SVG semicircular arc that visualises an AI chemistry score (0–100).
 * Replaces the flat EnergyBar when an AI-generated compatibilityScore is
 * present on a SquadMember card.
 *
 * Design notes:
 * - Arc fills left-to-right over ANIMATION_DURATION_MS with easeOut timing
 * - Score number counts up from 0 to the target value during the fill
 * - Colour derives from the member's archetype accent hex (passed in as
 *   `accentColor`); falls back to the JoyJoin brand purple
 * - Supports a loading/skeleton state via `isLoading`
 * - Respects prefers-reduced-motion via the `prefersReducedMotion` prop
 */

import { useEffect, useRef, useState } from "react";

// ── Constants ──────────────────────────────────────────────────────────────────
const ANIMATION_DURATION_MS = 700;
const ARC_SIZE = 80; // SVG viewport dimension (square)
const STROKE_WIDTH = 5;
const RADIUS = (ARC_SIZE - STROKE_WIDTH) / 2;
const CENTER = ARC_SIZE / 2;

// The arc spans 180° (left → right across the top half of the circle).
// Circumference of a full circle; we'll use dasharray to show a fraction.
const CIRCUMFERENCE = Math.PI * RADIUS; // half-circle arc length

// Compute (cx, cy) endpoints for the half-circle arc (left→right along top)
function describeArc(score: number): string {
  const fraction = Math.min(1, Math.max(0, score / 100));
  const angle = Math.PI * fraction; // 0 → π
  const startX = CENTER - RADIUS;
  const startY = CENTER;
  const endX = CENTER - RADIUS + Math.cos(angle) * RADIUS * 0;
  const endY = CENTER;
  // Simpler: use stroke-dasharray on a static half-circle path
  // The caller uses dasharray; this helper is unused but kept for documentation.
  void startX; void startY; void endX; void endY;
  return "";
}
void describeArc;

// ── ChemistryArc ──────────────────────────────────────────────────────────────
interface ChemistryArcProps {
  /** AI chemistry score 0–100 */
  score: number;
  /** Archetype accent colour in hex, e.g. "#F97316" */
  accentColor?: string;
  /** While true, renders a pulsing skeleton instead of the filled arc */
  isLoading?: boolean;
  /** When true, skips animation and renders the final state immediately */
  prefersReducedMotion?: boolean;
}

export default function ChemistryArc({
  score,
  accentColor = "#7C3AED",
  isLoading = false,
  prefersReducedMotion = false,
}: ChemistryArcProps) {
  const clampedScore = Math.min(100, Math.max(0, Math.round(score)));
  const [displayScore, setDisplayScore] = useState(prefersReducedMotion ? clampedScore : 0);
  const [progress, setProgress] = useState(prefersReducedMotion ? clampedScore / 100 : 0);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion || isLoading) {
      setDisplayScore(clampedScore);
      setProgress(clampedScore / 100);
      return;
    }

    // Reset on score change
    setDisplayScore(0);
    setProgress(0);
    startTimeRef.current = null;

    function step(timestamp: number) {
      if (startTimeRef.current === null) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const t = Math.min(1, elapsed / ANIMATION_DURATION_MS);
      // easeOut cubic
      const eased = 1 - Math.pow(1 - t, 3);

      setProgress(eased);
      setDisplayScore(Math.round(eased * clampedScore));

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      }
    }

    animFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    };
  }, [clampedScore, isLoading, prefersReducedMotion]);

  // Static half-circle path: arc from left midpoint to right midpoint (top half)
  const halfCirclePath = `M ${CENTER - RADIUS} ${CENTER} A ${RADIUS} ${RADIUS} 0 0 1 ${CENTER + RADIUS} ${CENTER}`;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <svg
          width={ARC_SIZE}
          height={ARC_SIZE / 2 + STROKE_WIDTH}
          viewBox={`0 0 ${ARC_SIZE} ${ARC_SIZE / 2 + STROKE_WIDTH}`}
          aria-hidden="true"
        >
          {/* Track */}
          <path
            d={halfCirclePath}
            fill="none"
            stroke="rgba(0,0,0,0.08)"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
          />
          {/* Pulsing fill for skeleton */}
          <path
            d={halfCirclePath}
            fill="none"
            stroke={accentColor}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * 0.5}
            opacity={0.3}
            style={{
              animation: "chemistry-arc-pulse 1.4s ease-in-out infinite",
            }}
          />
        </svg>
        <style>{`
          @keyframes chemistry-arc-pulse {
            0%, 100% { opacity: 0.2; }
            50% { opacity: 0.55; }
          }
          @media (prefers-reduced-motion: reduce) {
            .chemistry-arc-pulse { animation: none; }
          }
        `}</style>
        <span style={{ fontSize: 9, color: "rgba(0,0,0,0.30)", fontWeight: 600 }}>火花值</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{ position: "relative" }}>
        <svg
          width={ARC_SIZE}
          height={ARC_SIZE / 2 + STROKE_WIDTH}
          viewBox={`0 0 ${ARC_SIZE} ${ARC_SIZE / 2 + STROKE_WIDTH}`}
          role="img"
          aria-label={`火花值 ${clampedScore}`}
        >
          {/* Track (unfilled portion) */}
          <path
            d={halfCirclePath}
            fill="none"
            stroke="rgba(0,0,0,0.08)"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d={halfCirclePath}
            fill="none"
            stroke={accentColor}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
          />
        </svg>
        {/* Score number centred below the arc's midpoint */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: accentColor,
              lineHeight: 1,
            }}
            aria-hidden="true"
          >
            {displayScore}
          </span>
        </div>
      </div>
      <span style={{ fontSize: 9, color: "rgba(0,0,0,0.45)", fontWeight: 600 }}>火花值</span>
    </div>
  );
}

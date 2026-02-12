/**
 * TraitBarsCompact Component
 * Horizontal stat bars for personality traits (Genshin Impact / Pokemon TCG style)
 * Replacement for PersonalityRadarChart in share cards
 * 
 * Design:
 * - 6 horizontal bars for AOCEXP traits
 * - Pure DOM (no SVG) for reliable html2canvas capture
 * - Compact 2-char Chinese labels
 * - Highest trait highlighted with full opacity
 * - Optional staggered animation for preview mode
 */

import { motion } from "framer-motion";
import { useMemo } from "react";

interface TraitBarsCompactProps {
  affinityScore: number;
  opennessScore: number;
  conscientiousnessScore: number;
  emotionalStabilityScore: number;
  extraversionScore: number;
  positivityScore: number;
  primaryColor: string;
  animated?: boolean; // Enable staggered animations for preview
}

// Compact 2-char labels
const TRAIT_LABELS: Record<string, string> = {
  A: "亲和",
  O: "开放",
  C: "尽责",
  E: "稳定",
  X: "外向",
  P: "积极",
};

// Normalize scores to 0-100 range
const normalizeScore = (score: number | undefined): number => {
  if (score === undefined || score === null) return 50;
  if (score <= 1) return Math.round(score * 100);
  if (score <= 10) return Math.round(score * 10);
  return Math.round(score);
};

export default function TraitBarsCompact({
  affinityScore,
  opennessScore,
  conscientiousnessScore,
  emotionalStabilityScore,
  extraversionScore,
  positivityScore,
  primaryColor,
  animated = true,
}: TraitBarsCompactProps) {
  // Build trait data array
  const traits = useMemo(() => {
    const data = [
      { key: "A", label: TRAIT_LABELS.A, score: normalizeScore(affinityScore) },
      { key: "O", label: TRAIT_LABELS.O, score: normalizeScore(opennessScore) },
      { key: "C", label: TRAIT_LABELS.C, score: normalizeScore(conscientiousnessScore) },
      { key: "E", label: TRAIT_LABELS.E, score: normalizeScore(emotionalStabilityScore) },
      { key: "X", label: TRAIT_LABELS.X, score: normalizeScore(extraversionScore) },
      { key: "P", label: TRAIT_LABELS.P, score: normalizeScore(positivityScore) },
    ];

    // Find highest scoring trait
    const maxScore = Math.max(...data.map((t) => t.score));
    return data.map((t) => ({
      ...t,
      isTop: t.score === maxScore,
    }));
  }, [
    affinityScore,
    opennessScore,
    conscientiousnessScore,
    emotionalStabilityScore,
    extraversionScore,
    positivityScore,
  ]);

  return (
    <div className="w-full space-y-2">
      {traits.map((trait, index) => {
        const barOpacity = trait.isTop ? 1 : 0.5;
        const MotionDiv = animated ? motion.div : "div";
        const animationProps = animated
          ? {
              initial: { width: "0%" },
              animate: { width: `${trait.score}%` },
              transition: {
                duration: 0.8,
                delay: index * 0.1,
                ease: "easeOut",
              },
            }
          : {};

        return (
          <div key={trait.key} className="flex items-center gap-2">
            {/* Label - fixed width, right-aligned */}
            <span
              className="text-xs font-bold w-8 text-right"
              style={{
                color: trait.isTop ? primaryColor : "rgb(107, 114, 128)", // gray-500
              }}
            >
              {trait.label}
            </span>

            {/* Bar track */}
            <div className="flex-1 h-2.5 rounded-full bg-black/[0.06] overflow-hidden">
              {/* Bar fill */}
              <MotionDiv
                className="h-full rounded-full"
                style={{
                  width: animated ? undefined : `${trait.score}%`,
                  background: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}${
                    barOpacity === 1 ? "" : "80"
                  })`,
                  opacity: barOpacity,
                }}
                {...animationProps}
              />
            </div>

            {/* Score - fixed width, right-aligned */}
            <span className="text-xs font-black tabular-nums w-7 text-right text-gray-700">
              {trait.score}
            </span>
          </div>
        );
      })}
    </div>
  );
}

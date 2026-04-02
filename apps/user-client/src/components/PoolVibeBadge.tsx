/**
 * PoolVibeBadge
 * Compact vibe/chemistry badge for the discovery card.
 * Derives chemistry from sampleArchetypes and optionally avgMatchScore.
 */
import { getVibeTokens } from "@/lib/vibeTokens";
import { deriveChemistryFromArchetypes, deriveChemistryFromScore } from "@/lib/poolVibeUtils";
import type { OverallChemistry } from "@shared/types/groupAnalysis";

interface PoolVibeBadgeProps {
  sampleArchetypes?: string[];
  avgMatchScore?: number;
  /** Override chemistry directly (e.g. from drawer stats) */
  chemistry?: OverallChemistry;
}

export default function PoolVibeBadge({ sampleArchetypes = [], avgMatchScore, chemistry }: PoolVibeBadgeProps) {
  // Prefer explicit chemistry > avgMatchScore > archetype derivation
  const resolved: OverallChemistry = chemistry
    ?? deriveChemistryFromScore(avgMatchScore)
    ?? deriveChemistryFromArchetypes(sampleArchetypes);

  // Only show badge if we have some archetype data or explicit score
  if (!chemistry && avgMatchScore === undefined && sampleArchetypes.length === 0) return null;

  const tokens = getVibeTokens(resolved);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white select-none bg-gradient-to-r ${tokens.gradientClass}`}
      aria-label={tokens.label}
    >
      <span aria-hidden="true" className="leading-none">{tokens.emoji}</span>
      {tokens.label}
    </span>
  );
}

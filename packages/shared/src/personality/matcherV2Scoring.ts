/**
 * V4 Adaptive Assessment - MatcherV2 Scoring Helpers
 * 纯函数评分工具：z-score 转换、avoid 特质非对称惩罚、V2.4 对极冲突门
 *
 * Extracted verbatim from matcherV2.ts (2026-09-15) to keep the matcher module
 * under the harness file-size warn limit. No logic/weights/threshold changes.
 */

import { TraitKey } from './types';
import { PROTOTYPE_SOUL_TRAITS } from './matcherV2Data';

export const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];
export const TRAIT_STD = 15;
export const TRAIT_MEAN = 50;

// V2.3: Asymmetric penalty parameters
const ASYMMETRIC_PENALTY_LAMBDA = 2.0; // Penalty strength for avoid trait divergence
const ASYMMETRIC_PENALTY_THRESHOLD_SD = 0.5; // Start penalizing at 0.5 SD gap
const GAUSSIAN_SIGMA_D = 1.2; // Gaussian kernel sigma for distance→similarity

// Debug logging control
let DEBUG_MATCHER = false;
export function setMatcherDebug(enabled: boolean) {
  DEBUG_MATCHER = enabled;
}

/**
 * Internal accessor so the matcher class (in matcherV2.ts) reads the same flag.
 * Glue added during extraction — the flag itself is verbatim-moved.
 */
export function isMatcherDebugEnabled(): boolean {
  return DEBUG_MATCHER;
}

/**
 * V2.3 Helper: Convert raw trait score to z-score
 * z = (score - mean) / std = (score - 50) / 15
 */
export function toZScore(rawScore: number): number {
  return (rawScore - TRAIT_MEAN) / TRAIT_STD;
}

/**
 * V2.3 Helper: Convert trait scores to z-score vector
 */
export function toZScoreVector(traits: Record<TraitKey, number>): Record<TraitKey, number> {
  const zScores: Partial<Record<TraitKey, number>> = {};
  for (const trait of ALL_TRAITS) {
    zScores[trait] = toZScore(traits[trait] ?? TRAIT_MEAN);
  }
  return zScores as Record<TraitKey, number>;
}

/**
 * V2.3 Helper: Calculate asymmetric penalty for avoid traits
 * Heavily penalizes when user trait diverges significantly from archetype's profile
 * on traits marked as "avoid" in the soul trait config
 * 
 * Uses the avoid weight to scale the penalty - lower weight = stronger penalty needed
 */
export function calculateAsymmetricAvoidPenalty(
  userTraits: Record<TraitKey, number>,
  archetypeProfile: Record<TraitKey, number>,
  avoidTraits: Partial<Record<TraitKey, number>>
): { totalPenalty: number; penaltyDetails: Array<{ trait: TraitKey; gap: number; penalty: number; weight: number }> } {
  let totalPenalty = 0;
  const penaltyDetails: Array<{ trait: TraitKey; gap: number; penalty: number; weight: number }> = [];

  for (const [traitStr, weight] of Object.entries(avoidTraits)) {
    const trait = traitStr as TraitKey;
    const avoidWeight = weight ?? 0.7; // Default avoid weight if not specified
    const userZ = toZScore(userTraits[trait] ?? TRAIT_MEAN);
    const archetypeZ = toZScore(archetypeProfile[trait]);
    const gapSD = Math.abs(userZ - archetypeZ);

    // V2.3 FIX: Apply penalty based on gap and inverse of avoid weight
    // Lower avoid weight = stronger penalty multiplier
    // For avoid weight 0.7, penalty multiplier is ~1.43x
    // For avoid weight 0.5, penalty multiplier is 2x
    const weightMultiplier = 1 / Math.max(0.3, avoidWeight);

    // Apply penalty if gap exceeds threshold (0.5 SD)
    if (gapSD > ASYMMETRIC_PENALTY_THRESHOLD_SD) {
      const excessGap = gapSD - ASYMMETRIC_PENALTY_THRESHOLD_SD;
      // V2.3 FIX: Stronger quadratic penalty with weight multiplier
      // Use lambda=3.0 for stronger penalties (was 2.0)
      const basePenalty = 3.0 * Math.pow(excessGap, 2);
      const penalty = basePenalty * weightMultiplier;
      totalPenalty += penalty;
      penaltyDetails.push({ trait, gap: gapSD, penalty, weight: avoidWeight });
    } else if (gapSD > 0.3) {
      // V2.3: Also apply mild linear penalty for moderate gaps (0.3-0.5 SD)
      const mildPenalty = 0.5 * (gapSD - 0.3) * weightMultiplier;
      totalPenalty += mildPenalty;
      penaltyDetails.push({ trait, gap: gapSD, penalty: mildPenalty, weight: avoidWeight });
    }
  }

  return { totalPenalty, penaltyDetails };
}

/**
 * V2.4: Bidirectional Opposite-Pole Conflict Gate
 * 
 * Detects when user and archetype are on OPPOSITE sides of the 50-point midpoint.
 * This represents a qualitative personality mismatch (e.g., introvert vs extrovert).
 * 
 * Rule: If (archetype <50 AND user >55) OR (archetype >55 AND user <45) → conflict
 * 
 * Penalty scales with z-gap:
 * - ≥0.8 SD (12 pts): 0.4 multiplier
 * - ≥1.2 SD (18 pts): 0.2 multiplier  
 * - ≥1.8 SD (27 pts): 0.1 multiplier
 */
export interface OppositePoleConflict {
  trait: TraitKey;
  archetypeScore: number;
  userScore: number;
  gapSD: number;
  multiplier: number;
  traitImportance: 'primary' | 'secondary' | 'avoid' | 'neutral';
}

export function calculateOppositePoleConflictMultiplier(
  userTraits: Record<TraitKey, number>,
  archetypeProfile: Record<TraitKey, number>,
  archetypeName: string
): { finalMultiplier: number; conflicts: OppositePoleConflict[] } {
  const conflicts: OppositePoleConflict[] = [];
  let combinedMultiplier = 1.0;
  
  // Get soul trait config for importance weighting
  const soulConfig = PROTOTYPE_SOUL_TRAITS[archetypeName];
  
  for (const trait of ALL_TRAITS) {
    const archetypeScore = archetypeProfile[trait];
    const userScore = userTraits[trait] ?? TRAIT_MEAN;
    
    // Check for opposite-pole conflict
    const archetypeLow = archetypeScore < 50;
    const archetypeHigh = archetypeScore > 55;
    const userLow = userScore < 45;
    const userHigh = userScore > 55;
    
    const isConflict = (archetypeLow && userHigh) || (archetypeHigh && userLow);
    
    if (!isConflict) continue;
    
    // Calculate z-gap
    const gapSD = Math.abs(toZScore(userScore) - toZScore(archetypeScore));
    
    // Determine trait importance
    let traitImportance: 'primary' | 'secondary' | 'avoid' | 'neutral' = 'neutral';
    let importanceMultiplier = 1.0;
    
    if (soulConfig) {
      if (trait in soulConfig.primary) {
        traitImportance = 'primary';
        importanceMultiplier = 1.2; // Primary traits are more important
      } else if (trait in soulConfig.avoid) {
        traitImportance = 'avoid';
        importanceMultiplier = 1.5; // Avoid traits get strongest penalty
      } else if (trait in soulConfig.secondary) {
        traitImportance = 'secondary';
        importanceMultiplier = 1.0;
      }
    }
    
    // Calculate base multiplier based on z-gap (graduated penalty)
    let baseMultiplier = 1.0;
    if (gapSD >= 1.8) {
      baseMultiplier = 0.1; // Extreme mismatch
    } else if (gapSD >= 1.2) {
      baseMultiplier = 0.2; // Severe mismatch
    } else if (gapSD >= 0.8) {
      baseMultiplier = 0.4; // Moderate mismatch
    } else if (gapSD >= 0.5) {
      baseMultiplier = 0.6; // Mild mismatch
    } else {
      // Gap too small for conflict penalty
      continue;
    }
    
    // Calculate penalty from base multiplier and scale by importance
    // baseMultiplier 0.4 = penalty of 0.6 (1 - 0.4)
    // With importance 1.2, penalty becomes 0.72, so multiplier = 1 - 0.72 = 0.28
    const basePenalty = 1.0 - baseMultiplier;
    const scaledPenalty = basePenalty * importanceMultiplier;
    // Clamp to ensure multiplier doesn't go below 0.05
    const adjustedMultiplier = Math.max(0.05, 1.0 - scaledPenalty);
    
    conflicts.push({
      trait,
      archetypeScore,
      userScore,
      gapSD,
      multiplier: adjustedMultiplier,
      traitImportance,
    });
    
    // Combine multipliers (multiplicative)
    combinedMultiplier *= adjustedMultiplier;
  }
  
  // Log conflicts if debug enabled
  if (DEBUG_MATCHER && conflicts.length > 0) {
    console.log(`[DEBUG][OppositePole] ${archetypeName} conflicts:`, 
      conflicts.map(c => `${c.trait}(arch=${c.archetypeScore}, user=${c.userScore}, gap=${c.gapSD.toFixed(2)}SD, mult=${c.multiplier.toFixed(2)}, ${c.traitImportance})`).join('; ')
    );
    console.log(`[DEBUG][OppositePole] ${archetypeName} combined multiplier: ${combinedMultiplier.toFixed(3)}`);
  }
  
  return { finalMultiplier: combinedMultiplier, conflicts };
}

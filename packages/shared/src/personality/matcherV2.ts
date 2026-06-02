/**
 * V4 Adaptive Assessment - Enhanced Matching Algorithm V2
 * 加权惩罚式余弦相似度 + 超标惩罚 + 次要区分器决胜
 * 
 * V2.1 Updates:
 * - Integrated Z-score capping for A/O traits
 * - Added archetype-specific matching thresholds
 * 
 * V2.3 Updates (Optimized Formula):
 * - Z-score standardization for all trait scoring
 * - Asymmetric distance penalty for avoid traits (gaps > 0.5 SD)
 * - Multi-trait VETO filters for all 12 archetypes
 * - Gaussian kernel similarity conversion
 * - Comprehensive debug logging
 */

import { TraitKey } from './types';
import { archetypePrototypes, ArchetypePrototype } from './prototypes';
import { 
  applyZScoreCapping, 
  getArchetypeThreshold,
  ARCHETYPE_MATCH_THRESHOLDS 
} from './traitCorrection';

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];
const TRAIT_STD = 15;
const TRAIT_MEAN = 50;
const SIGNAL_TRAIT_WEIGHT = 1.5;
const OVERSHOOT_THRESHOLD_SD = 1.5;
const MIN_SIMILARITY_GAP = 0.15;
const MIN_CONFIDENCE_FOR_DECISIVE = 0.7;

// V2.3: Asymmetric penalty parameters
const ASYMMETRIC_PENALTY_LAMBDA = 2.0; // Penalty strength for avoid trait divergence
const ASYMMETRIC_PENALTY_THRESHOLD_SD = 0.5; // Start penalizing at 0.5 SD gap
const GAUSSIAN_SIGMA_D = 1.2; // Gaussian kernel sigma for distance→similarity

// Debug logging control
let DEBUG_MATCHER = false;
export function setMatcherDebug(enabled: boolean) {
  DEBUG_MATCHER = enabled;
}

interface MatcherDebugLog {
  userTraits: Record<TraitKey, number>;
  userZScores: Record<TraitKey, number>;
  archetypeScores: Array<{
    name: string;
    zScoreDistance: number;
    avoidPenalty: number;
    vetoResult: { passed: boolean; reason?: string };
    rawScore: number;
    finalScore: number;
  }>;
  winner: string;
  runnerUp: string;
}

const debugLogs: MatcherDebugLog[] = [];
export function getMatcherDebugLogs(): MatcherDebugLog[] {
  return debugLogs;
}
export function clearMatcherDebugLogs(): void {
  debugLogs.length = 0;
}

/**
 * 12原型灵魂特质权重矩阵
 * primary: 核心特质 (权重2.0)
 * secondary: 次要特质 (权重1.5)
 * avoid: 应避免的特质 (权重降低)
 */
export const PROTOTYPE_SOUL_TRAITS: Record<string, {
  primary: Partial<Record<TraitKey, number>>;
  secondary: Partial<Record<TraitKey, number>>;
  avoid: Partial<Record<TraitKey, number>>;
}> = {
  // Reduced weights for Manhattan distance: primary 1.6-1.8, secondary 1.2-1.3, avoid 0.6-0.8
  "elephant": {
    primary: { E: 1.8 },
    secondary: { C: 1.3, A: 1.2 },
    avoid: { X: 0.7, O: 0.7 }
  },
  "spider": {
    primary: { C: 1.8 },
    secondary: { E: 1.3, A: 1.2 },
    avoid: { P: 0.7, X: 0.8 }
  },
  "rooster": {
    primary: { P: 1.8 },
    secondary: { E: 1.3, C: 1.2, X: 1.2 },
    avoid: { O: 0.6 }
  },
  "hamster_praise": {
    primary: { A: 1.7, X: 1.6 },
    secondary: { P: 1.3 },
    avoid: { C: 0.7, O: 0.8 }
  },
  "fox": {
    primary: { O: 1.8 },
    secondary: { X: 1.3, P: 1.2 },
    avoid: { A: 0.7, C: 0.7 }
  },
  "koala": {
    primary: { A: 1.8 },
    secondary: { E: 1.3, P: 1.2 },
    // V2.3 FIX: X avoid weight lowered to 0.4 for stronger penalty on high-X users
    avoid: { O: 0.7, X: 0.4 }
  },
  "turtle": {
    primary: { E: 1.8, C: 1.7 },
    secondary: { A: 1.2 },
    avoid: { X: 0.6, O: 0.6, P: 0.7 }
  },
  "corgi": {
    primary: { X: 1.7, P: 1.6 },
    secondary: { A: 1.3, E: 1.2 },
    avoid: { C: 0.8, O: 0.8 }
  },
  "owl": {
    primary: { O: 1.8 },
    secondary: { C: 1.3, E: 1.2 },
    avoid: { X: 0.6, A: 0.7, P: 0.7 }
  },
  "dolphin_calm": {
    primary: { E: 1.7, O: 1.5 },
    secondary: { A: 1.2 },
    avoid: { X: 0.7, P: 0.6 }
  },
  "cat": {
    primary: { E: 1.6 },
    secondary: { O: 1.2 },
    avoid: { X: 0.6, A: 0.6 }
  },
  "octopus": {
    primary: { O: 1.8 },
    secondary: { P: 1.3, X: 1.2 },
    avoid: { C: 0.6, E: 0.8 }
  }
};

/**
 * 原型专属调整规则 (返回乘数 0.3-1.3)
 * 1.0 = 中性, <1.0 = 惩罚, >1.0 = 加成
 * 规则更简单，依赖灵魂特质权重做主要区分
 */
/**
 * V2.2 校准版：根据10k用户模拟的实际分数分布调整阈值
 * 实际分数范围约55-80，原阈值基于理想化的85+分数，需降低10-15点
 */
export const ARCHETYPE_VETO_RULES: Record<string, (traits: Record<TraitKey, number>) => number> = {
  "rooster": (t) => {
    // P是rooster的灵魂 - 实际P分布: 61-74-88
    // 降低阈值：85→75, 80→70
    if (t.P >= 78) return 1.25;
    if (t.P >= 72) return 1.1;
    if (t.P < 60) return 0.5;
    return 1.0;
  },
  "dolphin_calm": (t) => {
    // dolphin_calm: 高E + 低X + 适中P（实际X分布: 33-42-70）
    if (t.P >= 78) return 0.5; // 高P更像rooster
    if (t.E >= 75 && t.X < 55 && t.P < 65) return 1.25; // 强化低X信号
    if (t.E >= 72 && t.P < 68) return 1.1;
    return 1.0;
  },
  "owl": (t) => {
    // 猫头鹰核心: 高O + 低X - 实际O分布: 65-75-83
    if (t.O >= 75 && t.X < 45) return 1.35;
    if (t.O >= 70) return 1.15;
    if (t.O < 65) return 0.5;
    if (t.X > 55) return 0.6;
    return 1.0;
  },
  "turtle": (t) => {
    // 龟核心: 高E+C + 低X + 低O - 实际O分布: 45-53-65
    if (t.O > 72) return 0.4; // 高O更像猫头鹰
    if (t.O > 68) return 0.6;
    if (t.X < 38 && t.O < 60) return 1.3;
    return 1.0;
  },
  "fox": (t) => t.O >= 75 ? 1.15 : (t.O < 60 ? 0.5 : 1.0),
  "octopus": (t) => {
    // 实际O分布: 83-89-95, C分布: 40-50-60
    if (t.O >= 82 && t.C < 60) return 1.2;
    if (t.C > 65) return 0.7;
    return 1.0;
  },
  "cat": (t) => {
    // 实际X分布: 25-28-32
    if (t.X < 35 && t.A < 60) return 1.2;
    if (t.X > 50) return 0.5;
    return 1.0;
  },
  "koala": (t) => {
    // V2.3 FIX: HARD VETO for high-X users - koala has X:48
    // High-X users (X >= 65) should NEVER match koala
    if (t.X >= 75) return 0.15; // Near-VETO for very high-X users
    if (t.X >= 70) return 0.25; // Severe penalty
    if (t.X >= 65) return 0.35; // Strong penalty
    if (t.X >= 60) return 0.5; // Moderate penalty
    // Only give bonus for A if X is appropriate (low-X users)
    if (t.A >= 78 && t.X < 55) return 1.15;
    if (t.A < 65) return 0.6;
    return 1.0;
  },
  "hamster_praise": (t) => {
    // 实际A分布: 65-74-88, X分布: 73-83-88
    if (t.A >= 72 && t.X >= 78) return 1.2;
    if (t.A >= 68 && t.X >= 72) return 1.1;
    return 1.0;
  },
  "corgi": (t) => {
    // V2.3 FIX: Lower thresholds - corgi X:95, P:85
    // Users with high X should match even if P is moderate
    if (t.X >= 75 && t.P >= 70) return 1.3; // Strong match for high-X + good-P
    if (t.X >= 70 && t.P >= 65) return 1.2; // Good match
    if (t.X >= 65 && t.P >= 60) return 1.1; // Moderate match
    if (t.X >= 60) return 1.05; // Slight boost for extroverts
    if (t.X < 55) return 0.6; // Penalty for low-X users
    return 1.0;
  },
  "elephant": (t) => {
    // 实际E分布: 76-79-81, P分布: 35-35-55 (很低!)
    // 区分于turtle：大象有更高A和P, 且X不能过低
    if (t.X < 32) return 0.5; // Very low X is turtle territory
    if (t.P < 38) return 0.6; // Very low P is turtle territory
    if (t.E >= 76 && t.A >= 70 && t.P >= 40) return 1.25;
    if (t.E >= 75) return 1.1;
    if (t.E < 72) return 0.6;
    return 1.0;
  },
  "spider": (t) => {
    // 区分于dolphin_calm: spider is higher-C, lower-E
    if (t.E >= 78) return 0.5; // Very high E is dolphin_calm territory
    if (t.C >= 73) return 1.1;
    if (t.C < 60) return 0.6;
    return 1.0;
  }
};

import { CONFUSION_PAIR_GATES, SIGNATURE_THRESHOLDS } from './matcherV2Gates';
export { CONFUSION_PAIR_GATES, SIGNATURE_THRESHOLDS } from './matcherV2Gates';

export interface MatchScoreDetails {
  baseSimilarity: number;
  penaltyFactor: number;
  secondaryBonus: number;
  finalScore: number;
  exceededTraits: ExceededTrait[];
  signalTraitAlignment: number;
}

export interface ExceededTrait {
  trait: TraitKey;
  userScore: number;
  prototypeScore: number;
  excessSD: number;
  interpretation: string;
}

export interface SecondaryMatch {
  type: string;
  userValue: string | null;
  prototypeValue: string;
  isMatch: boolean;
}

export interface ExplainableMatchResult {
  archetype: string;
  score: number;
  confidence: number;
  details: MatchScoreDetails;
  explanation: {
    primaryMatch: string;
    exceededTraits: ExceededTrait[];
    secondaryDifferentiators: SecondaryMatch[];
  };
  similarPrototypes: Array<{
    name: string;
    similarity: number;
    reason: string;
  }>;
}

export interface UserSecondaryData {
  motivationDirection?: 'internal' | 'external' | 'balanced';
  conflictPosture?: 'approach' | 'avoid' | 'mediate';
  riskTolerance?: 'high' | 'medium' | 'low';
  statusOrientation?: 'leader' | 'supporter' | 'independent';
}

/**
 * V2.3 Helper: Convert raw trait score to z-score
 * z = (score - mean) / std = (score - 50) / 15
 */
function toZScore(rawScore: number): number {
  return (rawScore - TRAIT_MEAN) / TRAIT_STD;
}

/**
 * V2.3 Helper: Convert trait scores to z-score vector
 */
function toZScoreVector(traits: Record<TraitKey, number>): Record<TraitKey, number> {
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
function calculateAsymmetricAvoidPenalty(
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
interface OppositePoleConflict {
  trait: TraitKey;
  archetypeScore: number;
  userScore: number;
  gapSD: number;
  multiplier: number;
  traitImportance: 'primary' | 'secondary' | 'avoid' | 'neutral';
}

function calculateOppositePoleConflictMultiplier(
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
    console.log(`[OppositePole] ${archetypeName} conflicts:`, 
      conflicts.map(c => `${c.trait}(arch=${c.archetypeScore}, user=${c.userScore}, gap=${c.gapSD.toFixed(2)}SD, mult=${c.multiplier.toFixed(2)}, ${c.traitImportance})`).join('; ')
    );
    console.log(`[OppositePole] ${archetypeName} combined multiplier: ${combinedMultiplier.toFixed(3)}`);
  }
  
  return { finalMultiplier: combinedMultiplier, conflicts };
}

export class PrototypeMatcher {
  private algorithmVersion = 'v2.4-opposite-pole';
  private enableTraitCorrection = true;

  getAlgorithmVersion(): string {
    return this.algorithmVersion;
  }

  /**
   * Enable or disable trait correction (Z-score capping)
   * For A/B testing purposes
   */
  setTraitCorrectionEnabled(enabled: boolean): void {
    this.enableTraitCorrection = enabled;
  }

  /**
   * Apply trait corrections before matching
   * NOTE: Z-score capping disabled - it was hurting accuracy for users with legitimately high A/O
   * The bias comes from questions, not from users inflating responses
   * Better approach: Fix question scoring and use archetype-specific thresholds
   */
  private correctTraits(traits: Record<TraitKey, number>): Record<TraitKey, number> {
    // Capping disabled - returns traits unchanged
    // To re-enable: return applyZScoreCapping(traits);
    return traits;
  }

  calculateMatchScore(
    userTraits: Record<TraitKey, number>,
    prototype: ArchetypePrototype,
    userSecondaryData?: UserSecondaryData
  ): MatchScoreDetails {
    const correctedTraits = this.correctTraits(userTraits);
    const weights = this.getTraitWeights(prototype, correctedTraits);
    // Use Manhattan distance for better separation of confusable archetypes
    const baseSimilarity = this.weightedManhattanSimilarity(correctedTraits, prototype.traitProfile, weights);
    const { penaltyFactor, exceededTraits } = this.calculateOvershootPenalty(correctedTraits, prototype);
    const signalTraitAlignment = this.calculateSignalTraitAlignment(correctedTraits, prototype);
    const secondaryBonus = userSecondaryData 
      ? this.calculateSecondaryBonus(userSecondaryData, prototype) 
      : 0;

    // V2.3: Apply asymmetric penalty for avoid traits
    const soulConfig = PROTOTYPE_SOUL_TRAITS[prototype.name];
    let asymmetricPenaltyFactor = 1.0;
    let avoidPenaltyDetails: Array<{ trait: TraitKey; gap: number; penalty: number; weight: number }> = [];
    
    if (soulConfig?.avoid) {
      const { totalPenalty, penaltyDetails } = calculateAsymmetricAvoidPenalty(
        correctedTraits,
        prototype.traitProfile,
        soulConfig.avoid
      );
      avoidPenaltyDetails = penaltyDetails;
      // Convert penalty to a multiplicative factor (penalty of 0 = factor 1.0, higher = lower)
      // Use sigmoid-like decay: factor = 1 / (1 + penalty)
      asymmetricPenaltyFactor = 1 / (1 + totalPenalty);
      
      if (DEBUG_MATCHER && penaltyDetails.length > 0) {
        console.log(`[Matcher] ${prototype.name} asymmetric penalties (totalPenalty=${totalPenalty.toFixed(3)}, factor=${asymmetricPenaltyFactor.toFixed(3)}):`, 
          penaltyDetails.map(p => `${p.trait}: gap=${p.gap.toFixed(2)}SD, penalty=${p.penalty.toFixed(3)}, weight=${p.weight}`).join('; ')
        );
      }
    }

    const finalScore = (baseSimilarity * penaltyFactor * asymmetricPenaltyFactor) + secondaryBonus;

    if (DEBUG_MATCHER) {
      console.log(`[Matcher] ${prototype.name}: base=${baseSimilarity.toFixed(3)}, overshoot=${penaltyFactor.toFixed(3)}, asymm=${asymmetricPenaltyFactor.toFixed(3)}, combined=${(penaltyFactor * asymmetricPenaltyFactor).toFixed(3)}, final=${(finalScore * 100).toFixed(1)}`);
    }

    return {
      baseSimilarity,
      penaltyFactor: penaltyFactor * asymmetricPenaltyFactor, // Combined penalty
      secondaryBonus,
      finalScore: Math.max(0, Math.min(100, finalScore * 100)),
      exceededTraits,
      signalTraitAlignment,
    };
  }

  /**
   * Get trait weights for matching using Soul Trait Weight Matrix
   * 
   * Uses PROTOTYPE_SOUL_TRAITS to assign weights:
   * - primary traits: 1.8-2.0x weight (灵魂特质)
   * - secondary traits: 1.3-1.5x weight
   * - avoid traits: 0.3-0.8x weight (反向权重)
   */
  private getTraitWeights(
    prototype: ArchetypePrototype, 
    userTraits?: Record<TraitKey, number>
  ): Record<TraitKey, number> {
    const weights: Record<TraitKey, number> = { A: 1, C: 1, E: 1, O: 1, X: 1, P: 1 };
    
    // Get soul trait config for this archetype
    const soulConfig = PROTOTYPE_SOUL_TRAITS[prototype.name];
    
    if (soulConfig) {
      // Apply primary soul trait weights (highest priority)
      for (const [trait, weight] of Object.entries(soulConfig.primary)) {
        weights[trait as TraitKey] = weight;
      }
      
      // Apply secondary trait weights
      for (const [trait, weight] of Object.entries(soulConfig.secondary)) {
        if (weights[trait as TraitKey] === 1) {
          weights[trait as TraitKey] = weight;
        }
      }
      
      // Apply avoid trait weights (de-emphasize)
      for (const [trait, weight] of Object.entries(soulConfig.avoid)) {
        weights[trait as TraitKey] = weight;
      }
    } else {
      // Fallback to signal trait weights if no soul config
      for (const signalTrait of prototype.uniqueSignalTraits) {
        weights[signalTrait] = SIGNAL_TRAIT_WEIGHT;
      }
    }
    
    return weights;
  }
  
  /**
   * Apply multi-phase veto rules for improved archetype differentiation
   * Phase 0: Opposite-pole conflict gate (V2.4) - qualitative personality mismatch
   * Phase 1: Signature thresholds (trait-based pre-filtering with bonuses/penalties)
   * Phase 2: Archetype veto rules + confusion pair gates
   */
  private applyVetoRules(
    userTraits: Record<TraitKey, number>,
    scores: Array<{ archetype: string; details: MatchScoreDetails }>
  ): void {
    // Phase 0 (V2.4): Apply opposite-pole conflict gate FIRST
    // This catches qualitative mismatches where user is on opposite side of 50
    for (const result of scores) {
      const prototype = archetypePrototypes[result.archetype];
      if (prototype) {
        const { finalMultiplier, conflicts } = calculateOppositePoleConflictMultiplier(
          userTraits,
          prototype.traitProfile,
          result.archetype
        );
        if (finalMultiplier < 1.0) {
          result.details.finalScore *= finalMultiplier;
          // Clamp to 0-100 range after each modification
          result.details.finalScore = Math.max(0, Math.min(100, result.details.finalScore));
        }
      }
    }
    
    // Phase 1: Apply signature threshold multipliers
    for (const result of scores) {
      const thresholdRule = SIGNATURE_THRESHOLDS[result.archetype];
      if (thresholdRule) {
        const multiplier = thresholdRule(userTraits);
        result.details.finalScore *= multiplier;
        // Clamp to 0-100 range after each modification
        result.details.finalScore = Math.max(0, Math.min(100, result.details.finalScore));
      }
    }
    
    // Phase 2a: Apply archetype-specific veto rules
    for (const result of scores) {
      const vetoRule = ARCHETYPE_VETO_RULES[result.archetype];
      if (vetoRule) {
        const multiplier = vetoRule(userTraits);
        result.details.finalScore *= multiplier;
        // Clamp to 0-100 range after each modification
        result.details.finalScore = Math.max(0, Math.min(100, result.details.finalScore));
      }
    }
    
    // Phase 2b: Apply confusion pair gates to suppress rivals
    for (const gate of CONFUSION_PAIR_GATES) {
      const rivalResult = scores.find(s => s.archetype === gate.rivalArchetype);
      if (rivalResult) {
        const gateMultiplier = gate.gate(userTraits);
        if (gateMultiplier < 1.0) {
          rivalResult.details.finalScore *= gateMultiplier;
          // Clamp to 0-100 range after each modification
          rivalResult.details.finalScore = Math.max(0, Math.min(100, rivalResult.details.finalScore));
        }
      }
    }
  }
  
  /**
   * Phase 3: Confusion-Aware Classifier
   * When top-2 archetypes are a persistent confusion pair with close scores,
   * apply hard-coded trait thresholds to make a decisive choice.
   * 
   * This is a second-stage classifier that overrides the initial ranking
   * only when we detect a known problematic pair.
   */
  private applyConfusionAwareClassifier(
    userTraits: Record<TraitKey, number>,
    results: Array<{ archetype: string; prototype: ArchetypePrototype; details: MatchScoreDetails }>
  ): void {
    if (results.length < 2) return;
    
    const top1 = results[0];
    const top2 = results[1];
    const scoreGap = top1.details.finalScore - top2.details.finalScore;
    
    // Apply for any close match (gap < 10 points on 100-point scale)
    // This catches more edge cases where the wrong archetype barely wins
    if (scoreGap >= 10) return;
    
    const pair = [top1.archetype, top2.archetype].sort().join(',');
    
    // Apply pair-specific hard-coded classifiers
    switch (pair) {
      case 'rooster,dolphin_calm':
        this.classifySunnyChickenVsDolphin(userTraits, results, top1, top2);
        break;
      case 'owl,turtle':
        this.classifyOwlVsTurtle(userTraits, results, top1, top2);
        break;
      case 'koala,dolphin_calm':
        this.classifyBearVsDolphin(userTraits, results, top1, top2);
        break;
      case 'elephant,turtle':
        this.classifyElephantVsTurtle(userTraits, results, top1, top2);
        break;
      case 'dolphin_calm,spider':
        this.classifyDolphinVsSpider(userTraits, results, top1, top2);
        break;
    }
  }
  
  /**
   * Calculate gradual bonus based on trait distance from midpoint
   * Returns value in range [-maxBonus, +maxBonus]
   * Positive favors archetype1, negative favors archetype2
   */
  private calculateGradualBonus(
    userTrait: number,
    proto1Trait: number,
    proto2Trait: number,
    maxBonus: number = 6
  ): number {
    const midpoint = (proto1Trait + proto2Trait) / 2;
    const range = Math.abs(proto1Trait - proto2Trait) / 2;
    if (range === 0) return 0;
    
    // Calculate normalized distance from midpoint, clamped to [-1, 1]
    const normalizedDist = Math.max(-1, Math.min(1, (userTrait - midpoint) / range));
    
    // Apply sigmoid-like smoothing for gradual transition
    // tanh gives smooth transition near midpoint, decisive at extremes
    return normalizedDist * maxBonus * (1 - Math.exp(-Math.abs(normalizedDist) * 2));
  }

  /**
   * rooster vs dolphin_calm: P is the key differentiator
   * rooster P=92/X=85, dolphin_calm P=68/X=55
   * Uses gradual scoring based on trait distance
   */
  private classifySunnyChickenVsDolphin(
    t: Record<TraitKey, number>,
    results: Array<{ archetype: string; details: MatchScoreDetails }>,
    top1: { archetype: string; details: MatchScoreDetails },
    top2: { archetype: string; details: MatchScoreDetails }
  ): void {
    const sunnyChicken = results.find(r => r.archetype === 'rooster');
    const dolphin = results.find(r => r.archetype === 'dolphin_calm');
    if (!sunnyChicken || !dolphin) return;
    
    // Primary trait: P (rooster=92, dolphin_calm=68)
    const pBonus = this.calculateGradualBonus(t.P, 92, 68, 5);
    // Secondary trait: X (rooster=85, dolphin_calm=55)
    const xBonus = this.calculateGradualBonus(t.X, 85, 55, 3);
    
    // Combined bonus: primary has more weight
    const totalBonus = pBonus + xBonus * 0.5;
    
    if (totalBonus > 0) {
      sunnyChicken.details.finalScore += totalBonus;
      // Clamp to 0-100 range
      sunnyChicken.details.finalScore = Math.max(0, Math.min(100, sunnyChicken.details.finalScore));
    } else {
      dolphin.details.finalScore -= totalBonus;
      // Clamp to 0-100 range
      dolphin.details.finalScore = Math.max(0, Math.min(100, dolphin.details.finalScore));
    }
    
    // Re-sort after adjustment
    results.sort((a, b) => b.details.finalScore - a.details.finalScore);
  }
  
  /**
   * owl vs turtle: O is the key differentiator
   * 猫头鹰 O=88/X=40/E=75, turtle O=65/X=30/E=85
   * Uses gradual scoring based on trait distance
   */
  private classifyOwlVsTurtle(
    t: Record<TraitKey, number>,
    results: Array<{ archetype: string; details: MatchScoreDetails }>,
    top1: { archetype: string; details: MatchScoreDetails },
    top2: { archetype: string; details: MatchScoreDetails }
  ): void {
    const owl = results.find(r => r.archetype === 'owl');
    const turtle = results.find(r => r.archetype === 'turtle');
    if (!owl || !turtle) return;
    
    // Primary trait: O (猫头鹰=88, 龟=65)
    const oBonus = this.calculateGradualBonus(t.O, 88, 65, 5);
    // Secondary trait: E (猫头鹰=75, 龟=85) - note: turtle has higher E
    const eBonus = this.calculateGradualBonus(t.E, 75, 85, 3);
    
    // Combined bonus
    const totalBonus = oBonus + eBonus * 0.5;
    
    if (totalBonus > 0) {
      owl.details.finalScore += totalBonus;
      // Clamp to 0-100 range
      owl.details.finalScore = Math.max(0, Math.min(100, owl.details.finalScore));
    } else {
      turtle.details.finalScore -= totalBonus;
      // Clamp to 0-100 range
      turtle.details.finalScore = Math.max(0, Math.min(100, turtle.details.finalScore));
    }
    
    results.sort((a, b) => b.details.finalScore - a.details.finalScore);
  }
  
  /**
   * koala vs dolphin_calm: A is the key differentiator
   * koala A=88/E=80, dolphin_calm A=70/E=75
   * Uses gradual scoring based on trait distance
   */
  private classifyBearVsDolphin(
    t: Record<TraitKey, number>,
    results: Array<{ archetype: string; details: MatchScoreDetails }>,
    top1: { archetype: string; details: MatchScoreDetails },
    top2: { archetype: string; details: MatchScoreDetails }
  ): void {
    const bear = results.find(r => r.archetype === 'koala');
    const dolphin = results.find(r => r.archetype === 'dolphin_calm');
    if (!bear || !dolphin) return;
    
    // Primary trait: A (koala=88, dolphin_calm=70)
    const aBonus = this.calculateGradualBonus(t.A, 88, 70, 5);
    // Secondary trait: E (koala=80, dolphin_calm=75) - bear slightly higher
    const eBonus = this.calculateGradualBonus(t.E, 80, 75, 2);
    
    // Combined bonus
    const totalBonus = aBonus + eBonus * 0.5;
    
    if (totalBonus > 0) {
      bear.details.finalScore += totalBonus;
      // Clamp to 0-100 range
      bear.details.finalScore = Math.max(0, Math.min(100, bear.details.finalScore));
    } else {
      dolphin.details.finalScore -= totalBonus;
      // Clamp to 0-100 range
      dolphin.details.finalScore = Math.max(0, Math.min(100, dolphin.details.finalScore));
    }
    
    results.sort((a, b) => b.details.finalScore - a.details.finalScore);
  }

  /**
   * elephant vs turtle: A and P are the key differentiators
   * elephant A=70/P=60, turtle A=55/P=45
   * Both have high E and C, so A and P separate them.
   */
  private classifyElephantVsTurtle(
    t: Record<TraitKey, number>,
    results: Array<{ archetype: string; details: MatchScoreDetails }>,
    top1: { archetype: string; details: MatchScoreDetails },
    top2: { archetype: string; details: MatchScoreDetails }
  ): void {
    const elephant = results.find(r => r.archetype === 'elephant');
    const turtle = results.find(r => r.archetype === 'turtle');
    if (!elephant || !turtle) return;

    // Primary trait: A (elephant=70, turtle=55)
    const aBonus = this.calculateGradualBonus(t.A, 70, 55, 5);
    // Secondary trait: P (elephant=60, turtle=45)
    const pBonus = this.calculateGradualBonus(t.P, 60, 45, 4);
    // Tertiary trait: X (elephant=40, turtle=28)
    const xBonus = this.calculateGradualBonus(t.X, 40, 28, 2);

    // Combined bonus: positive favors elephant, negative favors turtle
    const totalBonus = aBonus + pBonus * 0.6 + xBonus * 0.3;

    if (totalBonus > 0) {
      elephant.details.finalScore += totalBonus;
      elephant.details.finalScore = Math.max(0, Math.min(100, elephant.details.finalScore));
    } else {
      turtle.details.finalScore -= totalBonus;
      turtle.details.finalScore = Math.max(0, Math.min(100, turtle.details.finalScore));
    }

    results.sort((a, b) => b.details.finalScore - a.details.finalScore);
  }

  /**
   * dolphin_calm vs spider: C and E are the key differentiators
   * dolphin_calm C=70/E=85, spider C=85/E=65
   * dolphin_calm is higher-E/lower-C; spider is higher-C/lower-E.
   */
  private classifyDolphinVsSpider(
    t: Record<TraitKey, number>,
    results: Array<{ archetype: string; details: MatchScoreDetails }>,
    top1: { archetype: string; details: MatchScoreDetails },
    top2: { archetype: string; details: MatchScoreDetails }
  ): void {
    const dolphin = results.find(r => r.archetype === 'dolphin_calm');
    const spider = results.find(r => r.archetype === 'spider');
    if (!dolphin || !spider) return;

    // Primary trait: E (dolphin_calm=85, spider=65)
    const eBonus = this.calculateGradualBonus(t.E, 85, 65, 5);
    // Secondary trait: C (dolphin_calm=70, spider=85)
    const cBonus = this.calculateGradualBonus(t.C, 70, 85, 4);
    // Tertiary trait: X (dolphin_calm=65, spider=60)
    const xBonus = this.calculateGradualBonus(t.X, 65, 60, 2);

    // Combined bonus: positive favors dolphin, negative favors spider
    const totalBonus = eBonus + cBonus * 0.6 + xBonus * 0.3;

    if (totalBonus > 0) {
      dolphin.details.finalScore += totalBonus;
      dolphin.details.finalScore = Math.max(0, Math.min(100, dolphin.details.finalScore));
    } else {
      spider.details.finalScore -= totalBonus;
      spider.details.finalScore = Math.max(0, Math.min(100, spider.details.finalScore));
    }

    results.sort((a, b) => b.details.finalScore - a.details.finalScore);
  }

  /**
   * Weighted Manhattan Distance with Logistic Normalization
   * Replaces cosine similarity to avoid quadratic penalties on deviations
   * 
   * Formula:
   * 1. D = Σ w_t * |u_t - p_t| (weighted distance)
   * 2. d_norm = D / (Σ w_t * 100) (normalized to 0-1)
   * 3. S_base = exp(-λ * d_norm) (convert to similarity with λ≈3)
   */
  private weightedManhattanSimilarity(
    userTraits: Record<TraitKey, number>,
    prototypeTraits: Record<TraitKey, number>,
    weights: Record<TraitKey, number>,
    lambda: number = 3.5
  ): number {
    let weightedDistance = 0;
    let totalWeight = 0;

    for (const trait of ALL_TRAITS) {
      const userScore = userTraits[trait] ?? 50;
      const protoScore = prototypeTraits[trait];
      const weight = weights[trait];

      weightedDistance += weight * Math.abs(userScore - protoScore);
      totalWeight += weight * 100; // Max possible distance per trait
    }

    if (totalWeight === 0) return 0;

    // Normalize distance to 0-1 range
    const normalizedDistance = weightedDistance / totalWeight;
    
    // Convert to similarity using exponential decay
    // λ=3.5 gives good spread: d_norm=0 → S=1.0, d_norm=0.15 → S≈0.59, d_norm=0.3 → S≈0.35
    const baseSimilarity = Math.exp(-lambda * normalizedDistance);

    return baseSimilarity;
  }

  // Keep legacy cosine for comparison/A-B testing
  private weightedCosineSimilarity(
    userTraits: Record<TraitKey, number>,
    prototypeTraits: Record<TraitKey, number>,
    weights: Record<TraitKey, number>
  ): number {
    let dotProduct = 0;
    let userMagnitude = 0;
    let prototypeMagnitude = 0;

    for (const trait of ALL_TRAITS) {
      const userScore = (userTraits[trait] || 50) / 100;
      const protoScore = prototypeTraits[trait] / 100;
      const weight = weights[trait];

      dotProduct += userScore * protoScore * weight;
      userMagnitude += Math.pow(userScore, 2) * weight;
      prototypeMagnitude += Math.pow(protoScore, 2) * weight;
    }

    if (userMagnitude === 0 || prototypeMagnitude === 0) return 0;

    return dotProduct / (Math.sqrt(userMagnitude) * Math.sqrt(prototypeMagnitude));
  }

  private calculateOvershootPenalty(
    userTraits: Record<TraitKey, number>,
    prototype: ArchetypePrototype
  ): { penaltyFactor: number; exceededTraits: ExceededTrait[] } {
    let penaltyFactor = 1.0;
    const exceededTraits: ExceededTrait[] = [];

    for (const signalTrait of prototype.uniqueSignalTraits) {
      const userScore = userTraits[signalTrait] || 50;
      const protoScore = prototype.traitProfile[signalTrait];
      const excessSD = (userScore - protoScore) / TRAIT_STD;

      if (excessSD > OVERSHOOT_THRESHOLD_SD) {
        const traitPenalty = 1.0 / (1.0 + 0.15 * (excessSD - OVERSHOOT_THRESHOLD_SD));
        penaltyFactor *= traitPenalty;

        exceededTraits.push({
          trait: signalTrait,
          userScore,
          prototypeScore: protoScore,
          excessSD: Math.round(excessSD * 100) / 100,
          interpretation: this.generateExcessInterpretation(signalTrait, userScore, protoScore, prototype.name),
        });
      }
    }

    return { penaltyFactor, exceededTraits };
  }

  private calculateSignalTraitAlignment(
    userTraits: Record<TraitKey, number>,
    prototype: ArchetypePrototype
  ): number {
    if (prototype.uniqueSignalTraits.length === 0) return 1;

    let totalAlignment = 0;
    for (const signalTrait of prototype.uniqueSignalTraits) {
      const userScore = userTraits[signalTrait] || 50;
      const protoScore = prototype.traitProfile[signalTrait];
      const diff = Math.abs(userScore - protoScore);
      const alignment = Math.max(0, 1 - diff / 50);
      totalAlignment += alignment;
    }

    return totalAlignment / prototype.uniqueSignalTraits.length;
  }

  private calculateSecondaryBonus(
    userSecondary: UserSecondaryData,
    prototype: ArchetypePrototype
  ): number {
    let bonus = 0;
    const protoSecondary = prototype.secondaryDifferentiators;

    if (userSecondary.motivationDirection === protoSecondary.motivationDirection) {
      bonus += 0.03;
    }
    if (userSecondary.conflictPosture === protoSecondary.conflictPosture) {
      bonus += 0.03;
    }
    if (userSecondary.riskTolerance === protoSecondary.riskTolerance) {
      bonus += 0.02;
    }
    if (userSecondary.statusOrientation === protoSecondary.statusOrientation) {
      bonus += 0.02;
    }

    return bonus;
  }

  private generateExcessInterpretation(
    trait: TraitKey,
    userScore: number,
    protoScore: number,
    prototypeName: string
  ): string {
    const traitNames: Record<TraitKey, string> = {
      A: '亲和力',
      C: '尽责性',
      E: '情绪稳定性',
      O: '开放性',
      X: '外向性',
      P: '正能量',
    };

    return `你的${traitNames[trait]}(${userScore}分)高于典型${prototypeName}(${protoScore}分)，这让你在某些方面表现更突出`;
  }

  findBestMatches(
    userTraits: Record<TraitKey, number>,
    userSecondaryData?: UserSecondaryData,
    topN: number = 3
  ): ExplainableMatchResult[] {
    // V2.3: Debug logging - capture z-scores
    const userZScores = toZScoreVector(userTraits);
    
    if (DEBUG_MATCHER) {
      console.log('\n[Matcher V2.3] ========== MATCHING START ==========');
      console.log('[Matcher] User raw traits:', userTraits);
      console.log('[Matcher] User z-scores:', Object.fromEntries(
        Object.entries(userZScores).map(([k, v]) => [k, v.toFixed(2)])
      ));
    }

    const results: Array<{
      archetype: string;
      prototype: ArchetypePrototype;
      details: MatchScoreDetails;
    }> = [];

    for (const [name, prototype] of Object.entries(archetypePrototypes)) {
      const details = this.calculateMatchScore(userTraits, prototype, userSecondaryData);
      results.push({ archetype: name, prototype, details });
    }

    // Apply veto rules before sorting
    this.applyVetoRules(userTraits, results);

    results.sort((a, b) => b.details.finalScore - a.details.finalScore);
    
    // PHASE 3: Confusion-aware classifier for persistent confusion pairs
    // When top-2 are a known confusion pair with close scores, apply hard-coded trait thresholds
    this.applyConfusionAwareClassifier(userTraits, results);

    // V2.3: Debug logging - final ranking
    if (DEBUG_MATCHER) {
      console.log('\n[Matcher] Final ranking after all adjustments:');
      results.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.archetype}: ${r.details.finalScore.toFixed(1)} (base=${r.details.baseSimilarity.toFixed(3)}, penalty=${r.details.penaltyFactor.toFixed(3)})`);
      });
      console.log('[Matcher] ========== MATCHING END ==========\n');
      
      // Store debug log for retrieval
      debugLogs.push({
        userTraits,
        userZScores,
        archetypeScores: results.map(r => ({
          name: r.archetype,
          zScoreDistance: 0, // Could calculate if needed
          avoidPenalty: 1 - r.details.penaltyFactor,
          vetoResult: { passed: r.details.finalScore > 0 },
          rawScore: r.details.baseSimilarity * 100,
          finalScore: r.details.finalScore,
        })),
        winner: results[0]?.archetype || 'unknown',
        runnerUp: results[1]?.archetype || 'unknown',
      });
    }

    return results.slice(0, topN).map((r, index) => {
      const similarPrototypes = this.findSimilarPrototypes(r.archetype, r.prototype, results);
      const explanation = this.generateExplanation(r.archetype, r.prototype, r.details, userSecondaryData);

      return {
        archetype: r.archetype,
        score: Math.round(r.details.finalScore),
        confidence: this.calculateMatchConfidence(r.details, results, index),
        details: r.details,
        explanation,
        similarPrototypes,
      };
    });
  }

  private calculateMatchConfidence(
    details: MatchScoreDetails,
    allResults: Array<{ archetype: string; details: MatchScoreDetails }>,
    rank: number
  ): number {
    if (rank !== 0) {
      return Math.max(0, Math.min(1, details.finalScore / 100 * 0.8));
    }

    const topScore = allResults[0]?.details.finalScore || 0;
    const secondScore = allResults[1]?.details.finalScore || 0;
    const gap = (topScore - secondScore) / 100;

    if (gap >= MIN_SIMILARITY_GAP && details.signalTraitAlignment >= MIN_CONFIDENCE_FOR_DECISIVE) {
      return Math.min(1, 0.8 + gap);
    }

    return Math.min(1, 0.5 + gap + details.signalTraitAlignment * 0.2);
  }

  private findSimilarPrototypes(
    primaryArchetype: string,
    prototype: ArchetypePrototype,
    allResults: Array<{ archetype: string; prototype: ArchetypePrototype; details: MatchScoreDetails }>
  ): Array<{ name: string; similarity: number; reason: string }> {
    const confusableNames = prototype.confusableWith;
    const similar: Array<{ name: string; similarity: number; reason: string }> = [];

    for (const result of allResults) {
      if (result.archetype === primaryArchetype) continue;

      if (confusableNames.includes(result.archetype)) {
        const sharedTraits = this.findSharedHighTraits(prototype, result.prototype);
        similar.push({
          name: result.archetype,
          similarity: Math.round(result.details.finalScore),
          reason: `共享${sharedTraits.join('、')}特质`,
        });
      }
    }

    return similar.slice(0, 2);
  }

  private findSharedHighTraits(
    proto1: ArchetypePrototype,
    proto2: ArchetypePrototype
  ): string[] {
    const traitNames: Record<TraitKey, string> = {
      A: '高亲和力',
      C: '高尽责性',
      E: '高情绪稳定性',
      O: '高开放性',
      X: '高外向性',
      P: '高耐心',
    };

    const shared: string[] = [];
    for (const trait of ALL_TRAITS) {
      if (proto1.traitProfile[trait] >= 70 && proto2.traitProfile[trait] >= 70) {
        shared.push(traitNames[trait]);
      }
    }

    return shared.length > 0 ? shared : ['相似性格模式'];
  }

  private generateExplanation(
    archetype: string,
    prototype: ArchetypePrototype,
    details: MatchScoreDetails,
    userSecondaryData?: UserSecondaryData
  ): {
    primaryMatch: string;
    exceededTraits: ExceededTrait[];
    secondaryDifferentiators: SecondaryMatch[];
  } {
    const traitNames: Record<TraitKey, string> = {
      A: '亲和力',
      C: '尽责性',
      E: '情绪稳定性',
      O: '开放性',
      X: '外向性',
      P: '耐心',
    };

    const signalTraitNames = prototype.uniqueSignalTraits.map(t => traitNames[t]).join('和');
    const alignmentPercent = Math.round(details.signalTraitAlignment * 100);

    const primaryMatch = `你与【${archetype}】的匹配度为${Math.round(details.finalScore)}%，主要是因为你在${signalTraitNames}上表现突出（对齐度${alignmentPercent}%），这与该原型的核心特质高度吻合。`;

    const secondaryDifferentiators: SecondaryMatch[] = [];
    if (userSecondaryData) {
      const protoSecondary = prototype.secondaryDifferentiators;

      if (userSecondaryData.motivationDirection) {
        secondaryDifferentiators.push({
          type: '动机方向',
          userValue: userSecondaryData.motivationDirection,
          prototypeValue: protoSecondary.motivationDirection,
          isMatch: userSecondaryData.motivationDirection === protoSecondary.motivationDirection,
        });
      }
      if (userSecondaryData.conflictPosture) {
        secondaryDifferentiators.push({
          type: '冲突处理',
          userValue: userSecondaryData.conflictPosture,
          prototypeValue: protoSecondary.conflictPosture,
          isMatch: userSecondaryData.conflictPosture === protoSecondary.conflictPosture,
        });
      }
    }

    return {
      primaryMatch,
      exceededTraits: details.exceededTraits,
      secondaryDifferentiators,
    };
  }

  breakTie(
    topCandidates: Array<{ archetype: string; details: MatchScoreDetails }>,
    userSecondaryData: UserSecondaryData
  ): { archetype: string; finalScore: number } {
    const candidateScores: Array<{ archetype: string; score: number }> = [];

    for (const candidate of topCandidates) {
      const prototype = archetypePrototypes[candidate.archetype];
      if (!prototype) continue;

      let baseScore = candidate.details.finalScore;
      let secondaryScore = 0;

      const protoSecondary = prototype.secondaryDifferentiators;

      if (userSecondaryData.motivationDirection === protoSecondary.motivationDirection) {
        secondaryScore += 3;
      }
      if (userSecondaryData.conflictPosture === protoSecondary.conflictPosture) {
        secondaryScore += 3;
      }
      if (userSecondaryData.riskTolerance === protoSecondary.riskTolerance) {
        secondaryScore += 2;
      }
      if (userSecondaryData.statusOrientation === protoSecondary.statusOrientation) {
        secondaryScore += 2;
      }

      candidateScores.push({
        archetype: candidate.archetype,
        score: baseScore + secondaryScore,
      });
    }

    candidateScores.sort((a, b) => b.score - a.score);

    return {
      archetype: candidateScores[0]?.archetype || topCandidates[0]?.archetype || '',
      finalScore: candidateScores[0]?.score || 0,
    };
  }

  isDecisiveMatch(
    topMatches: ExplainableMatchResult[]
  ): { decisive: boolean; reason: string } {
    if (topMatches.length < 2) {
      return { decisive: true, reason: 'Only one candidate' };
    }

    const top = topMatches[0];
    const second = topMatches[1];
    const gap = (top.score - second.score) / 100;
    
    const archetypeThreshold = getArchetypeThreshold(top.archetype);
    const adjustedConfidenceThreshold = Math.min(MIN_CONFIDENCE_FOR_DECISIVE, archetypeThreshold);

    if (gap >= MIN_SIMILARITY_GAP && top.confidence >= adjustedConfidenceThreshold) {
      return { decisive: true, reason: `Gap ${Math.round(gap * 100)}% with high confidence` };
    }

    if (top.details.signalTraitAlignment >= 0.85 && gap >= 0.10) {
      return { decisive: true, reason: 'Strong signal trait alignment' };
    }

    if (top.confidence >= archetypeThreshold && gap >= 0.08) {
      return { decisive: true, reason: `Meets archetype-specific threshold (${Math.round(archetypeThreshold * 100)}%)` };
    }

    return { 
      decisive: false, 
      reason: `Gap ${Math.round(gap * 100)}% is below threshold, may show blend` 
    };
  }
}

export const prototypeMatcher = new PrototypeMatcher();

export function findBestMatchingArchetypesV2(
  userTraits: Record<TraitKey, number>,
  userSecondaryData?: UserSecondaryData,
  topN: number = 3
): Array<{ archetype: string; score: number; confidence: number }> {
  const results = prototypeMatcher.findBestMatches(userTraits, userSecondaryData, topN);
  return results.map(r => ({
    archetype: r.archetype,
    score: r.score,
    confidence: r.confidence,
  }));
}

/**
 * 风格谱系结果 - Style Spectrum Result
 * 将匹配结果呈现为"主类型 + 相邻风格"的谱系形式
 */
export interface StyleSpectrumResult {
  primary: {
    archetype: string;
    score: number;
    confidence: number;
    emoji: string;
    tagline: string;
  };
  adjacentStyles: Array<{
    archetype: string;
    score: number;
    similarity: number; // 0-100, 与主类型的相似度
    blendLabel: string; // 如 "偶尔会像..."
    emoji: string;
  }>;
  spectrumPosition: {
    xAxis: { label: string; value: number }; // 如 内向↔外向
    yAxis: { label: string; value: number }; // 如 感性↔理性
  };
  isDecisive: boolean;
  decisionReason: string;
}

const ARCHETYPE_EMOJI: Record<string, string> = {
  "corgi": "🐕",
  "rooster": "🐔",
  "hamster_praise": "🐷",
  "fox": "🦊",
  "dolphin_calm": "🐬",
  "spider": "🕷️",
  "koala": "🐻",
  "octopus": "🐙",
  "owl": "🦉",
  "elephant": "🐘",
  "turtle": "🐢",
  "cat": "🐱"
};

const ARCHETYPE_TAGLINE: Record<string, string> = {
  "corgi": "快乐感染者，派对灵魂",
  "rooster": "积极阳光，热情洋溢",
  "hamster_praise": "暖场达人，社交催化剂",
  "fox": "灵动聪慧，观察敏锐",
  "dolphin_calm": "从容不迫，温和可靠",
  "spider": "细心周到，默默付出",
  "koala": "温暖陪伴，善解人意",
  "octopus": "创意无限，思维跳跃",
  "owl": "深度思考，洞察本质",
  "elephant": "稳重可靠，值得信赖",
  "turtle": "踏实内敛，专注当下",
  "cat": "独立自在，享受独处"
};

/**
 * 获取风格谱系结果 - 用于趣味化呈现
 * @param userTraits 用户特质分数
 * @param userSecondaryData 用户二级数据（可选）
 * @param savedPrimaryArchetype 数据库保存的主原型（推荐传入以保持一致性和性能）
 */
export function getStyleSpectrum(
  userTraits: Record<TraitKey, number>,
  userSecondaryData?: UserSecondaryData,
  savedPrimaryArchetype?: string
): StyleSpectrumResult {
  const matches = prototypeMatcher.findBestMatches(userTraits, userSecondaryData, 4);
  
  // 优先使用数据库保存的原型，确保与测评时的结果一致
  // Use saved archetype from database to ensure consistency with assessment result
  let orderedMatches = [...matches];
  if (savedPrimaryArchetype && matches.length > 0) {
    const overrideIndex = matches.findIndex(m => m.archetype === savedPrimaryArchetype);
    
    if (overrideIndex >= 0) {
      // Found saved archetype in top 4, move it to first position
      const savedMatch = matches[overrideIndex];
      orderedMatches = [savedMatch, ...matches.filter((_, i) => i !== overrideIndex)];
    } else {
      // Saved archetype not in top 4, fetch it from all 12
      const allMatches = prototypeMatcher.findBestMatches(userTraits, userSecondaryData, 12);
      const found = allMatches.find(m => m.archetype === savedPrimaryArchetype);
      if (found) {
        orderedMatches = [found, ...matches.slice(0, 3)];
      }
      // Otherwise, keep the natural order (fallback for legacy data)
    }
  }
  
  const top = orderedMatches[0];
  const { decisive, reason } = prototypeMatcher.isDecisiveMatch(orderedMatches);

  // 计算谱系位置（基于X和O特质）
  const xPosition = Math.round((userTraits.X || 50));
  const yPosition = Math.round((userTraits.O || 50));

  // 构建相邻风格（排除主原型，只包含分数 >= 70% 的原型）
  const ADJACENT_SCORE_THRESHOLD = 70;
  const blendLabels = [
    "有时候也会像",
    "某些场合下会变成",
    "在特定情境中可能是"
  ];
  
  const adjacentStyles = orderedMatches
    .slice(1, 4)
    .filter(m => m.score >= ADJACENT_SCORE_THRESHOLD)
    .map((m, i) => {
      return {
        archetype: m.archetype,
        score: m.score,
        similarity: m.score,
        blendLabel: blendLabels[i] || "有相似特质的",
        emoji: ARCHETYPE_EMOJI[m.archetype] || "🎭"
      };
    });

  return {
    primary: {
      archetype: top.archetype,
      score: top.score,
      confidence: top.confidence,
      emoji: ARCHETYPE_EMOJI[top.archetype] || "🎭",
      tagline: ARCHETYPE_TAGLINE[top.archetype] || "独特的你"
    },
    adjacentStyles,
    spectrumPosition: {
      xAxis: { label: "独处←→社交", value: xPosition },
      yAxis: { label: "务实←→开放", value: yPosition }
    },
    isDecisive: decisive,
    decisionReason: reason
  };
}

/**
 * 获取简化版风格谱系（用于API响应）
 */
export function getStyleSpectrumSimple(
  userTraits: Record<TraitKey, number>
): { primary: string; spectrum: string[]; confidence: number } {
  const spectrum = getStyleSpectrum(userTraits);
  return {
    primary: spectrum.primary.archetype,
    spectrum: [
      spectrum.primary.archetype,
      ...spectrum.adjacentStyles.map(s => s.archetype)
    ],
    confidence: spectrum.primary.confidence
  };
}

/**
 * 获取所有12个原型的完整分数表（用于调试）
 * Returns all 12 archetype scores for debugging purposes
 */
export function getAllArchetypeScores(
  userTraits: Record<TraitKey, number>,
  userSecondaryData?: UserSecondaryData
): Array<{ archetype: string; score: number; confidence: number; emoji: string }> {
  const results = prototypeMatcher.findBestMatches(userTraits, userSecondaryData, 12);
  return results.map(r => ({
    archetype: r.archetype,
    score: r.score,
    confidence: r.confidence,
    emoji: ARCHETYPE_EMOJI[r.archetype] || "🎭"
  }));
}

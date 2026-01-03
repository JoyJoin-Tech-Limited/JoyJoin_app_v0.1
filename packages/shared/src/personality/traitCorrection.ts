/**
 * Trait Correction Module - Z-Score Capping & SDI Correction
 * 特质校正模块 - 用于减少社会赞许性偏差
 */

import { TraitKey } from './types';

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];

/**
 * Population baseline statistics (based on simulation data)
 * 人群基线统计（基于模拟数据）
 */
export const POPULATION_BASELINE = {
  mean: { A: 62, C: 55, E: 60, O: 65, X: 58, P: 60 } as Record<TraitKey, number>,
  std: { A: 12, C: 11, E: 13, O: 14, X: 15, P: 13 } as Record<TraitKey, number>,
};

/**
 * Z-score thresholds for capping
 * 75th percentile = z-score 0.67
 */
export const Z_SCORE_CAP = 0.67;

/**
 * Trait susceptibility to social desirability bias
 * Higher values = more susceptible to inflation
 * 特质对社会赞许性偏差的敏感度
 */
export const SDI_SUSCEPTIBILITY: Record<TraitKey, number> = {
  A: 0.65,  // 亲和力最敏感
  O: 0.55,  // 开放性次之
  X: 0.45,  // 外向性
  P: 0.40,  // 正能量
  C: 0.25,  // 尽责性较低
  E: 0.20,  // 情绪稳定性
};

/**
 * Traits that should have Z-score capping applied
 */
export const TRAITS_TO_CAP: TraitKey[] = ['A', 'O'];

/**
 * Apply Z-score capping to limit trait inflation
 * Z分数封顶：限制特质膨胀
 * 
 * @param traits - Raw trait scores
 * @param capsAt - Z-score threshold (default 0.67 = 75th percentile)
 * @returns Corrected trait scores
 */
export function applyZScoreCapping(
  traits: Record<TraitKey, number>,
  capsAt: number = Z_SCORE_CAP
): Record<TraitKey, number> {
  const corrected = { ...traits };
  
  for (const trait of TRAITS_TO_CAP) {
    const mean = POPULATION_BASELINE.mean[trait];
    const std = POPULATION_BASELINE.std[trait];
    const score = traits[trait];
    
    if (score === undefined || std === 0) continue;
    
    const zScore = (score - mean) / std;
    
    if (zScore > capsAt) {
      const cappedScore = mean + (capsAt * std);
      corrected[trait] = Math.round(cappedScore);
    }
  }
  
  return corrected;
}

/**
 * Calculate Social Desirability Index from answer patterns
 * 计算社会赞许性指数
 * 
 * @param answerTraitScores - Array of trait scores from each answer
 * @returns SDI value 0-100
 */
export function calculateSdiIndex(
  answerTraitScores: Array<Record<string, number>>
): number {
  if (answerTraitScores.length === 0) return 50;
  
  let desirableCount = 0;
  
  for (const scores of answerTraitScores) {
    const aScore = scores.A || 0;
    const oScore = scores.O || 0;
    const xScore = scores.X || 0;
    const pScore = scores.P || 0;
    
    if (aScore > 10 || oScore > 10 || xScore > 10 || pScore > 10) {
      desirableCount++;
    }
  }
  
  return (desirableCount / answerTraitScores.length) * 100;
}

/**
 * Apply SDI-based correction to trait scores
 * 应用SDI校正
 * 
 * @param traits - Raw trait scores
 * @param sdiIndex - Social desirability index (0-100)
 * @returns Corrected trait scores
 */
export function applySdiCorrection(
  traits: Record<TraitKey, number>,
  sdiIndex: number
): Record<TraitKey, number> {
  const corrected = { ...traits };
  
  for (const trait of ALL_TRAITS) {
    const susceptibility = SDI_SUSCEPTIBILITY[trait];
    const score = traits[trait];
    
    if (score === undefined) continue;
    
    const adjustment = 1 - (sdiIndex * susceptibility / 100);
    const adjusted = score * adjustment;
    
    corrected[trait] = Math.max(0, Math.min(100, Math.round(adjusted)));
  }
  
  return corrected;
}

/**
 * Combined trait correction: Z-score capping + SDI correction
 * 综合特质校正
 * 
 * @param traits - Raw trait scores
 * @param sdiIndex - Optional SDI index (if not provided, only Z-score capping is applied)
 * @returns Corrected trait scores
 */
export function applyTraitCorrections(
  traits: Record<TraitKey, number>,
  sdiIndex?: number
): Record<TraitKey, number> {
  let corrected = applyZScoreCapping(traits);
  
  if (sdiIndex !== undefined && sdiIndex > 50) {
    corrected = applySdiCorrection(corrected, sdiIndex);
  }
  
  return corrected;
}

/**
 * Archetype-specific matching thresholds
 * Lower thresholds for archetypes that are harder to match precisely
 * 原型特定匹配阈值
 */
export const ARCHETYPE_MATCH_THRESHOLDS: Record<string, number> = {
  '开心柯基': 0.75,   // Lowered from implicit 0.80
  '机智狐': 0.78,     // Lowered from implicit 0.82
  '灵感章鱼': 0.78,   // Added for difficult-to-match archetype
  '织网蛛': 0.80,     // Slightly lowered
  '太阳鸡': 0.82,
  '夸夸豚': 0.82,
  '淡定海豚': 0.82,
  '暖心熊': 0.82,
  '沉思猫头鹰': 0.85,
  '定心大象': 0.83,
  '稳如龟': 0.85,
  '隐身猫': 0.85,
};

/**
 * Get match threshold for a specific archetype
 * Default to 0.82 if not specified
 */
export function getArchetypeThreshold(archetype: string): number {
  return ARCHETYPE_MATCH_THRESHOLDS[archetype] ?? 0.82;
}

/**
 * Check if a match meets the archetype-specific threshold
 */
export function meetsArchetypeThreshold(
  archetype: string,
  confidence: number
): boolean {
  const threshold = getArchetypeThreshold(archetype);
  return confidence >= threshold;
}

/**
 * Trait correction statistics for debugging
 */
export interface CorrectionStats {
  originalTraits: Record<TraitKey, number>;
  correctedTraits: Record<TraitKey, number>;
  sdiIndex?: number;
  cappedTraits: TraitKey[];
  adjustments: Record<TraitKey, number>;
}

/**
 * Apply corrections with detailed stats for debugging
 */
export function applyCorrectionsWithStats(
  traits: Record<TraitKey, number>,
  sdiIndex?: number
): CorrectionStats {
  const cappedTraits: TraitKey[] = [];
  const adjustments: Record<TraitKey, number> = {} as Record<TraitKey, number>;
  
  const zCapped = applyZScoreCapping(traits);
  
  for (const trait of TRAITS_TO_CAP) {
    if (zCapped[trait] !== traits[trait]) {
      cappedTraits.push(trait);
    }
  }
  
  let corrected = zCapped;
  if (sdiIndex !== undefined && sdiIndex > 50) {
    corrected = applySdiCorrection(zCapped, sdiIndex);
  }
  
  for (const trait of ALL_TRAITS) {
    adjustments[trait] = corrected[trait] - traits[trait];
  }
  
  return {
    originalTraits: { ...traits },
    correctedTraits: corrected,
    sdiIndex,
    cappedTraits,
    adjustments,
  };
}

/**
 * V4 Adaptive Assessment - Enhanced Matching Algorithm V2
 * 加权惩罚式余弦相似度 + 超标惩罚 + 次要区分器决胜
 * 
 * V2.1 Updates:
 * - Integrated Z-score capping for A/O traits
 * - Added archetype-specific matching thresholds
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
const SIGNAL_TRAIT_WEIGHT = 1.5;
const OVERSHOOT_THRESHOLD_SD = 1.5;
const MIN_SIMILARITY_GAP = 0.15;
const MIN_CONFIDENCE_FOR_DECISIVE = 0.7;

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
  "定心大象": {
    primary: { E: 1.8 },
    secondary: { C: 1.3, A: 1.2 },
    avoid: { X: 0.7, O: 0.7 }
  },
  "织网蛛": {
    primary: { C: 1.8 },
    secondary: { E: 1.3, A: 1.2 },
    avoid: { P: 0.7, X: 0.8 }
  },
  "太阳鸡": {
    primary: { P: 1.8 },
    secondary: { E: 1.3, C: 1.2, X: 1.2 },
    avoid: { O: 0.6 }
  },
  "夸夸豚": {
    primary: { A: 1.7, X: 1.6 },
    secondary: { P: 1.3 },
    avoid: { C: 0.7, O: 0.8 }
  },
  "机智狐": {
    primary: { O: 1.8 },
    secondary: { X: 1.3, P: 1.2 },
    avoid: { A: 0.7, C: 0.7 }
  },
  "暖心熊": {
    primary: { A: 1.8 },
    secondary: { E: 1.3, P: 1.2 },
    avoid: { O: 0.7, X: 0.8 }
  },
  "稳如龟": {
    primary: { E: 1.8, C: 1.7 },
    secondary: { A: 1.2 },
    avoid: { X: 0.6, O: 0.6, P: 0.7 }
  },
  "开心柯基": {
    primary: { X: 1.7, P: 1.6 },
    secondary: { A: 1.3, E: 1.2 },
    avoid: { C: 0.8, O: 0.8 }
  },
  "沉思猫头鹰": {
    primary: { O: 1.8 },
    secondary: { C: 1.3, E: 1.2 },
    avoid: { X: 0.6, A: 0.7, P: 0.7 }
  },
  "淡定海豚": {
    primary: { E: 1.7, O: 1.5 },
    secondary: { A: 1.2 },
    avoid: { X: 0.7, P: 0.6 }
  },
  "隐身猫": {
    primary: { E: 1.6 },
    secondary: { O: 1.2 },
    avoid: { X: 0.6, A: 0.6 }
  },
  "灵感章鱼": {
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
export const ARCHETYPE_VETO_RULES: Record<string, (traits: Record<TraitKey, number>) => number> = {
  "太阳鸡": (t) => {
    // P是太阳鸡的灵魂 - 高P加成，低P惩罚
    if (t.P >= 85) return 1.25;
    if (t.P >= 80) return 1.1;
    if (t.P < 70) return 0.5;
    return 1.0;
  },
  "淡定海豚": (t) => {
    // 淡定海豚: 高E + 适中P (不是极高P)
    if (t.P >= 85) return 0.5; // 高P更像太阳鸡
    if (t.E >= 80 && t.P < 75) return 1.15;
    return 1.0;
  },
  "沉思猫头鹰": (t) => {
    // 猫头鹰核心: 高O(88) + 低X(40) - 区别于龟的O(65)
    if (t.O >= 80 && t.X < 50) return 1.35;
    if (t.O >= 75) return 1.15;
    if (t.O < 70) return 0.5; // 低O不是猫头鹰
    if (t.X > 60) return 0.6;
    return 1.0;
  },
  "稳如龟": (t) => {
    // 龟核心: 高E+C + 低X + 低O - 区别于猫头鹰的高O
    if (t.O > 80) return 0.4; // 高O绝对更像猫头鹰
    if (t.O > 75) return 0.6;
    if (t.X < 40 && t.O < 70) return 1.3;
    return 1.0;
  },
  "机智狐": (t) => t.O >= 80 ? 1.15 : (t.O < 65 ? 0.5 : 1.0),
  "灵感章鱼": (t) => {
    if (t.O >= 85 && t.C < 50) return 1.2;
    if (t.C > 70) return 0.6;
    return 1.0;
  },
  "隐身猫": (t) => {
    if (t.X < 35 && t.A < 50) return 1.2;
    if (t.X > 55) return 0.5;
    return 1.0;
  },
  "暖心熊": (t) => t.A >= 85 ? 1.15 : (t.A < 70 ? 0.6 : 1.0),
  "夸夸豚": (t) => (t.A >= 85 && t.X >= 75) ? 1.15 : 1.0,
  "开心柯基": (t) => (t.X >= 85 && t.P >= 75) ? 1.15 : 1.0,
  "定心大象": (t) => t.E >= 85 ? 1.15 : (t.E < 75 ? 0.6 : 1.0),
  "织网蛛": (t) => t.C >= 80 ? 1.1 : (t.C < 65 ? 0.6 : 1.0)
};

/**
 * 混淆对门控规则 - 针对已知的高混淆原型对
 * 当用户特质明确属于某一原型时，大幅抑制竞争原型的分数
 */
export const CONFUSION_PAIR_GATES: Array<{
  trueArchetype: string;
  rivalArchetype: string;
  gate: (t: Record<TraitKey, number>) => number; // 返回rival的乘数
}> = [
  {
    // 太阳鸡(P=92) vs 淡定海豚(P=68): P≥82的用户明显是太阳鸡
    trueArchetype: "太阳鸡",
    rivalArchetype: "淡定海豚",
    gate: (t) => {
      if (t.P >= 85) return 0.2;
      if (t.P >= 82) return 0.4;
      if (t.P >= 78) return 0.6;
      return 1.0;
    }
  },
  {
    // 淡定海豚(P=68) vs 太阳鸡(P=92): P<75的用户明显是淡定海豚
    trueArchetype: "淡定海豚",
    rivalArchetype: "太阳鸡",
    gate: (t) => {
      if (t.P < 70) return 0.3;
      if (t.P < 75) return 0.5;
      return 1.0;
    }
  },
  {
    // 沉思猫头鹰(O=88) vs 稳如龟(O=65): O≥78的用户明显是猫头鹰
    trueArchetype: "沉思猫头鹰",
    rivalArchetype: "稳如龟",
    gate: (t) => {
      if (t.O >= 82 && t.X < 50) return 0.15;
      if (t.O >= 78) return 0.35;
      if (t.O >= 75) return 0.55;
      return 1.0;
    }
  },
  {
    // 稳如龟(O=65) vs 沉思猫头鹰(O=88): O<72的用户明显是龟
    trueArchetype: "稳如龟",
    rivalArchetype: "沉思猫头鹰",
    gate: (t) => {
      if (t.O < 68) return 0.3;
      if (t.O < 72) return 0.5;
      return 1.0;
    }
  },
  {
    // 隐身猫(X=25) vs 稳如龟(X=38): X<32的用户明显是隐身猫
    trueArchetype: "隐身猫",
    rivalArchetype: "稳如龟",
    gate: (t) => {
      if (t.X < 30 && t.A < 50) return 0.3;
      if (t.X < 35) return 0.6;
      return 1.0;
    }
  },
  {
    // 机智狐(O=85, X=70) vs 开心柯基(O=65, X=90): 高O用户更可能是狐狸
    trueArchetype: "机智狐",
    rivalArchetype: "开心柯基",
    gate: (t) => {
      if (t.O >= 80) return 0.5;
      if (t.O >= 75) return 0.7;
      return 1.0;
    }
  },
  {
    // 夸夸豚(A=90, X=85) vs 开心柯基(A=70, X=90): 高A区分
    trueArchetype: "夸夸豚",
    rivalArchetype: "开心柯基",
    gate: (t) => {
      if (t.A >= 85) return 0.5;
      if (t.A >= 80) return 0.7;
      return 1.0;
    }
  },
  {
    // 织网蛛(C=88) vs 淡定海豚(C=70): 高C用户更可能是蜘蛛
    trueArchetype: "织网蛛",
    rivalArchetype: "淡定海豚",
    gate: (t) => {
      if (t.C >= 82) return 0.5;
      if (t.C >= 78) return 0.7;
      return 1.0;
    }
  }
];

/**
 * 计算logistic形式的特质匹配分数
 * 使距离差异平滑地映射到0-1范围
 */
function logisticTraitScore(diff: number, steepness: number = 0.08): number {
  return 1 / (1 + Math.exp(steepness * diff));
}

/**
 * Phase 1: 签名特质阈值 - 用于预过滤候选原型
 * 返回一个分数乘数：1.0=保留, <1.0=降权/排除
 */
export const SIGNATURE_THRESHOLDS: Record<string, (t: Record<TraitKey, number>) => number> = {
  "太阳鸡": (t) => {
    // 太阳鸡的灵魂是P=92
    if (t.P >= 85) return 1.35;
    if (t.P >= 80) return 1.15;
    if (t.P >= 75) return 1.0;
    if (t.P >= 70) return 0.7;
    return 0.45;
  },
  "淡定海豚": (t) => {
    // 淡定海豚P=68, E=85 - 高P用户不应匹配海豚
    if (t.P >= 85) return 0.35;
    if (t.P >= 80) return 0.55;
    if (t.P < 75 && t.E >= 78) return 1.25;
    return 1.0;
  },
  "沉思猫头鹰": (t) => {
    // 猫头鹰O=88, X=40 - 高O低X是标志
    if (t.O >= 82 && t.X < 50) return 1.45;
    if (t.O >= 78 && t.X < 55) return 1.25;
    if (t.O >= 75) return 1.1;
    if (t.O < 72) return 0.5;
    return 1.0;
  },
  "稳如龟": (t) => {
    // 龟O=65 - 高O用户更像猫头鹰
    if (t.O >= 80) return 0.35;
    if (t.O >= 75) return 0.55;
    if (t.O < 70 && t.E >= 80) return 1.35;
    if (t.O < 72) return 1.15;
    return 1.0;
  },
  "隐身猫": (t) => {
    // 隐身猫X=25, A=40 - 极低社交
    if (t.X < 32 && t.A < 50) return 1.4;
    if (t.X < 38) return 1.1;
    if (t.X >= 55) return 0.4;
    return 1.0;
  },
  "暖心熊": (t) => {
    // 暖心熊A=88 - 高亲和力
    if (t.A >= 85) return 1.3;
    if (t.A >= 80) return 1.1;
    if (t.A < 72) return 0.6;
    return 1.0;
  },
  "机智狐": (t) => {
    // 机智狐O=85 - 高开放性
    if (t.O >= 82) return 1.3;
    if (t.O >= 78) return 1.15;
    if (t.O < 70) return 0.5;
    return 1.0;
  },
  "灵感章鱼": (t) => {
    // 章鱼O=90, C=38 - 高开放低条理
    if (t.O >= 85 && t.C < 50) return 1.4;
    if (t.O >= 80) return 1.15;
    if (t.C >= 70) return 0.5;
    return 1.0;
  },
  "夸夸豚": (t) => {
    // 夸夸豚A=90, X=85 - 高亲和高社交
    if (t.A >= 85 && t.X >= 80) return 1.4;
    if (t.A >= 82) return 1.1;
    return 1.0;
  },
  "开心柯基": (t) => {
    // 柯基X=90, P=80 - 高社交高正能量
    if (t.X >= 85 && t.P >= 75) return 1.3;
    if (t.X >= 80) return 1.1;
    return 1.0;
  },
  "定心大象": (t) => {
    // 大象E=92 - 极高稳定性
    if (t.E >= 88) return 1.3;
    if (t.E >= 82) return 1.1;
    if (t.E < 75) return 0.5;
    return 1.0;
  },
  "织网蛛": (t) => {
    // 蜘蛛C=88 - 高条理性
    if (t.C >= 85) return 1.25;
    if (t.C >= 78) return 1.1;
    if (t.C < 68) return 0.6;
    return 1.0;
  }
};

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

export class PrototypeMatcher {
  private algorithmVersion = 'v2.2-manhattan';
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
    const finalScore = (baseSimilarity * penaltyFactor) + secondaryBonus;

    return {
      baseSimilarity,
      penaltyFactor,
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
   * Apply two-phase veto rules for improved archetype differentiation
   * Phase 1: Signature thresholds (trait-based pre-filtering with bonuses/penalties)
   * Phase 2: Archetype veto rules + confusion pair gates
   */
  private applyVetoRules(
    userTraits: Record<TraitKey, number>,
    scores: Array<{ archetype: string; details: MatchScoreDetails }>
  ): void {
    // Phase 1: Apply signature threshold multipliers FIRST (most impactful)
    for (const result of scores) {
      const thresholdRule = SIGNATURE_THRESHOLDS[result.archetype];
      if (thresholdRule) {
        const multiplier = thresholdRule(userTraits);
        result.details.finalScore *= multiplier;
      }
    }
    
    // Phase 2a: Apply archetype-specific veto rules
    for (const result of scores) {
      const vetoRule = ARCHETYPE_VETO_RULES[result.archetype];
      if (vetoRule) {
        const multiplier = vetoRule(userTraits);
        result.details.finalScore *= multiplier;
      }
    }
    
    // Phase 2b: Apply confusion pair gates to suppress rivals
    for (const gate of CONFUSION_PAIR_GATES) {
      const rivalResult = scores.find(s => s.archetype === gate.rivalArchetype);
      if (rivalResult) {
        const gateMultiplier = gate.gate(userTraits);
        if (gateMultiplier < 1.0) {
          rivalResult.details.finalScore *= gateMultiplier;
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
      case '太阳鸡,淡定海豚':
        this.classifySunnyChickenVsDolphin(userTraits, results, top1, top2);
        break;
      case '沉思猫头鹰,稳如龟':
        this.classifyOwlVsTurtle(userTraits, results, top1, top2);
        break;
      case '暖心熊,淡定海豚':
        this.classifyBearVsDolphin(userTraits, results, top1, top2);
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
   * 太阳鸡 vs 淡定海豚: P is the key differentiator
   * 太阳鸡 P=92/X=85, 淡定海豚 P=68/X=55
   * Uses gradual scoring based on trait distance
   */
  private classifySunnyChickenVsDolphin(
    t: Record<TraitKey, number>,
    results: Array<{ archetype: string; details: MatchScoreDetails }>,
    top1: { archetype: string; details: MatchScoreDetails },
    top2: { archetype: string; details: MatchScoreDetails }
  ): void {
    const sunnyChicken = results.find(r => r.archetype === '太阳鸡');
    const dolphin = results.find(r => r.archetype === '淡定海豚');
    if (!sunnyChicken || !dolphin) return;
    
    // Primary trait: P (太阳鸡=92, 淡定海豚=68)
    const pBonus = this.calculateGradualBonus(t.P, 92, 68, 5);
    // Secondary trait: X (太阳鸡=85, 淡定海豚=55)
    const xBonus = this.calculateGradualBonus(t.X, 85, 55, 3);
    
    // Combined bonus: primary has more weight
    const totalBonus = pBonus + xBonus * 0.5;
    
    if (totalBonus > 0) {
      sunnyChicken.details.finalScore += totalBonus;
    } else {
      dolphin.details.finalScore -= totalBonus;
    }
    
    // Re-sort after adjustment
    results.sort((a, b) => b.details.finalScore - a.details.finalScore);
  }
  
  /**
   * 沉思猫头鹰 vs 稳如龟: O is the key differentiator
   * 猫头鹰 O=88/X=40/E=75, 稳如龟 O=65/X=30/E=85
   * Uses gradual scoring based on trait distance
   */
  private classifyOwlVsTurtle(
    t: Record<TraitKey, number>,
    results: Array<{ archetype: string; details: MatchScoreDetails }>,
    top1: { archetype: string; details: MatchScoreDetails },
    top2: { archetype: string; details: MatchScoreDetails }
  ): void {
    const owl = results.find(r => r.archetype === '沉思猫头鹰');
    const turtle = results.find(r => r.archetype === '稳如龟');
    if (!owl || !turtle) return;
    
    // Primary trait: O (猫头鹰=88, 龟=65)
    const oBonus = this.calculateGradualBonus(t.O, 88, 65, 5);
    // Secondary trait: E (猫头鹰=75, 龟=85) - note: turtle has higher E
    const eBonus = this.calculateGradualBonus(t.E, 75, 85, 3);
    
    // Combined bonus
    const totalBonus = oBonus + eBonus * 0.5;
    
    if (totalBonus > 0) {
      owl.details.finalScore += totalBonus;
    } else {
      turtle.details.finalScore -= totalBonus;
    }
    
    results.sort((a, b) => b.details.finalScore - a.details.finalScore);
  }
  
  /**
   * 暖心熊 vs 淡定海豚: A is the key differentiator
   * 暖心熊 A=88/E=80, 淡定海豚 A=70/E=75
   * Uses gradual scoring based on trait distance
   */
  private classifyBearVsDolphin(
    t: Record<TraitKey, number>,
    results: Array<{ archetype: string; details: MatchScoreDetails }>,
    top1: { archetype: string; details: MatchScoreDetails },
    top2: { archetype: string; details: MatchScoreDetails }
  ): void {
    const bear = results.find(r => r.archetype === '暖心熊');
    const dolphin = results.find(r => r.archetype === '淡定海豚');
    if (!bear || !dolphin) return;
    
    // Primary trait: A (暖心熊=88, 淡定海豚=70)
    const aBonus = this.calculateGradualBonus(t.A, 88, 70, 5);
    // Secondary trait: E (暖心熊=80, 淡定海豚=75) - bear slightly higher
    const eBonus = this.calculateGradualBonus(t.E, 80, 75, 2);
    
    // Combined bonus
    const totalBonus = aBonus + eBonus * 0.5;
    
    if (totalBonus > 0) {
      bear.details.finalScore += totalBonus;
    } else {
      dolphin.details.finalScore -= totalBonus;
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
      P: '耐心',
    };

    return `你的${traitNames[trait]}(${userScore}分)高于典型${prototypeName}(${protoScore}分)，这让你在某些方面表现更突出`;
  }

  findBestMatches(
    userTraits: Record<TraitKey, number>,
    userSecondaryData?: UserSecondaryData,
    topN: number = 3
  ): ExplainableMatchResult[] {
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

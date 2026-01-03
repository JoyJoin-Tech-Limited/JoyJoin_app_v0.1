/**
 * V4 Adaptive Assessment - Enhanced Matching Algorithm V2
 * 加权惩罚式余弦相似度 + 超标惩罚 + 次要区分器决胜
 */

import { TraitKey } from './types';
import { archetypePrototypes, ArchetypePrototype } from './prototypes';

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];
const TRAIT_STD = 15;
const SIGNAL_TRAIT_WEIGHT = 1.5;
const OVERSHOOT_THRESHOLD_SD = 1.5;
const MIN_SIMILARITY_GAP = 0.15;
const MIN_CONFIDENCE_FOR_DECISIVE = 0.7;

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
  private algorithmVersion = 'v2.0';

  getAlgorithmVersion(): string {
    return this.algorithmVersion;
  }

  calculateMatchScore(
    userTraits: Record<TraitKey, number>,
    prototype: ArchetypePrototype,
    userSecondaryData?: UserSecondaryData
  ): MatchScoreDetails {
    const weights = this.getTraitWeights(prototype);
    const baseSimilarity = this.weightedCosineSimilarity(userTraits, prototype.traitProfile, weights);
    const { penaltyFactor, exceededTraits } = this.calculateOvershootPenalty(userTraits, prototype);
    const signalTraitAlignment = this.calculateSignalTraitAlignment(userTraits, prototype);
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

  private getTraitWeights(prototype: ArchetypePrototype): Record<TraitKey, number> {
    const weights: Record<TraitKey, number> = { A: 1, C: 1, E: 1, O: 1, X: 1, P: 1 };
    for (const signalTrait of prototype.uniqueSignalTraits) {
      weights[signalTrait] = SIGNAL_TRAIT_WEIGHT;
    }
    return weights;
  }

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

    results.sort((a, b) => b.details.finalScore - a.details.finalScore);

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

    if (gap >= MIN_SIMILARITY_GAP && top.confidence >= MIN_CONFIDENCE_FOR_DECISIVE) {
      return { decisive: true, reason: `Gap ${Math.round(gap * 100)}% with high confidence` };
    }

    if (top.details.signalTraitAlignment >= 0.85 && gap >= 0.10) {
      return { decisive: true, reason: 'Strong signal trait alignment' };
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

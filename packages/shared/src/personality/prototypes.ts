/**
 * V4 Adaptive Assessment - Archetype Prototype Definitions
 * 12原型特质矩阵定义
 */

import { TraitKey } from './types';

export interface ArchetypePrototype {
  id: string;
  name: string;
  icon: string;
  energyLevel: number;
  traitProfile: Record<TraitKey, number>;
  secondaryDifferentiators: {
    motivationDirection: 'internal' | 'external' | 'balanced';
    conflictPosture: 'approach' | 'avoid' | 'mediate';
    riskTolerance: 'high' | 'medium' | 'low';
    statusOrientation: 'leader' | 'supporter' | 'independent';
  };
  confusableWith: string[];
  uniqueSignalTraits: TraitKey[];
}

export const archetypePrototypes: Record<string, ArchetypePrototype> = {
  "开心柯基": {
    id: "corgi",
    name: "开心柯基",
    icon: "🐕",
    energyLevel: 95,
    traitProfile: { A: 70, C: 50, E: 60, O: 65, X: 95, P: 90 },
    secondaryDifferentiators: {
      motivationDirection: 'external',
      conflictPosture: 'approach',
      riskTolerance: 'high',
      statusOrientation: 'leader'
    },
    confusableWith: ["太阳鸡"],
    uniqueSignalTraits: ["X", "P"]
  },
  "太阳鸡": {
    id: "rooster",
    name: "太阳鸡",
    icon: "🐓",
    energyLevel: 90,
    traitProfile: { A: 75, C: 65, E: 85, O: 55, X: 80, P: 90 },
    secondaryDifferentiators: {
      motivationDirection: 'external',
      conflictPosture: 'mediate',
      riskTolerance: 'medium',
      statusOrientation: 'supporter'
    },
    confusableWith: ["开心柯基", "夸夸豚"],
    uniqueSignalTraits: ["E", "P"]
  },
  "夸夸豚": {
    id: "dolphin_praise",
    name: "夸夸豚",
    icon: "🐬",
    energyLevel: 85,
    traitProfile: { A: 85, C: 55, E: 70, O: 60, X: 80, P: 90 },
    secondaryDifferentiators: {
      motivationDirection: 'external',
      conflictPosture: 'mediate',
      riskTolerance: 'medium',
      statusOrientation: 'supporter'
    },
    confusableWith: ["淡定海豚", "太阳鸡"],
    uniqueSignalTraits: ["A", "P"]
  },
  "机智狐": {
    id: "fox",
    name: "机智狐",
    icon: "🦊",
    energyLevel: 82,
    traitProfile: { A: 55, C: 50, E: 60, O: 90, X: 80, P: 65 },
    secondaryDifferentiators: {
      motivationDirection: 'external',
      conflictPosture: 'approach',
      riskTolerance: 'high',
      statusOrientation: 'independent'
    },
    confusableWith: ["灵感章鱼"],
    uniqueSignalTraits: ["O", "X"]
  },
  "淡定海豚": {
    id: "dolphin_calm",
    name: "淡定海豚",
    icon: "🐬",
    energyLevel: 75,
    traitProfile: { A: 70, C: 70, E: 85, O: 65, X: 60, P: 70 },
    secondaryDifferentiators: {
      motivationDirection: 'balanced',
      conflictPosture: 'mediate',
      riskTolerance: 'medium',
      statusOrientation: 'supporter'
    },
    confusableWith: ["夸夸豚", "暖心熊"],
    uniqueSignalTraits: ["E", "C"]
  },
  "织网蛛": {
    id: "spider",
    name: "织网蛛",
    icon: "🕷️",
    energyLevel: 72,
    traitProfile: { A: 80, C: 70, E: 65, O: 70, X: 60, P: 60 },
    secondaryDifferentiators: {
      motivationDirection: 'balanced',
      conflictPosture: 'mediate',
      riskTolerance: 'medium',
      statusOrientation: 'independent'
    },
    confusableWith: ["暖心熊"],
    uniqueSignalTraits: ["A", "C"]
  },
  "暖心熊": {
    id: "bear",
    name: "暖心熊",
    icon: "🐻",
    energyLevel: 70,
    traitProfile: { A: 90, C: 65, E: 80, O: 60, X: 55, P: 70 },
    secondaryDifferentiators: {
      motivationDirection: 'internal',
      conflictPosture: 'avoid',
      riskTolerance: 'low',
      statusOrientation: 'supporter'
    },
    confusableWith: ["定心大象", "织网蛛"],
    uniqueSignalTraits: ["A", "E"]
  },
  "灵感章鱼": {
    id: "octopus",
    name: "灵感章鱼",
    icon: "🐙",
    energyLevel: 68,
    traitProfile: { A: 50, C: 45, E: 55, O: 95, X: 60, P: 65 },
    secondaryDifferentiators: {
      motivationDirection: 'internal',
      conflictPosture: 'avoid',
      riskTolerance: 'high',
      statusOrientation: 'independent'
    },
    confusableWith: ["机智狐", "沉思猫头鹰"],
    uniqueSignalTraits: ["O"]
  },
  "沉思猫头鹰": {
    id: "owl",
    name: "沉思猫头鹰",
    icon: "🦉",
    energyLevel: 55,
    traitProfile: { A: 45, C: 80, E: 75, O: 85, X: 40, P: 50 },
    secondaryDifferentiators: {
      motivationDirection: 'internal',
      conflictPosture: 'avoid',
      riskTolerance: 'low',
      statusOrientation: 'independent'
    },
    confusableWith: ["稳如龟", "灵感章鱼"],
    uniqueSignalTraits: ["C", "O"]
  },
  "定心大象": {
    id: "elephant",
    name: "定心大象",
    icon: "🐘",
    energyLevel: 52,
    traitProfile: { A: 70, C: 90, E: 90, O: 50, X: 40, P: 60 },
    secondaryDifferentiators: {
      motivationDirection: 'internal',
      conflictPosture: 'avoid',
      riskTolerance: 'low',
      statusOrientation: 'supporter'
    },
    confusableWith: ["暖心熊", "稳如龟"],
    uniqueSignalTraits: ["C", "E"]
  },
  "稳如龟": {
    id: "turtle",
    name: "稳如龟",
    icon: "🐢",
    energyLevel: 38,
    traitProfile: { A: 45, C: 80, E: 85, O: 70, X: 30, P: 45 },
    secondaryDifferentiators: {
      motivationDirection: 'internal',
      conflictPosture: 'avoid',
      riskTolerance: 'low',
      statusOrientation: 'independent'
    },
    confusableWith: ["沉思猫头鹰", "隐身猫"],
    uniqueSignalTraits: ["E", "C"]
  },
  "隐身猫": {
    id: "cat",
    name: "隐身猫",
    icon: "🐱",
    energyLevel: 30,
    traitProfile: { A: 50, C: 55, E: 80, O: 45, X: 25, P: 50 },
    secondaryDifferentiators: {
      motivationDirection: 'internal',
      conflictPosture: 'avoid',
      riskTolerance: 'low',
      statusOrientation: 'independent'
    },
    confusableWith: ["稳如龟"],
    uniqueSignalTraits: ["X", "E"]
  }
};

export function normalizeTraitScore(rawScore: number): number {
  const normalized = 50 + (rawScore * 5);
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

export function calculateArchetypeDistance(
  userTraits: Record<TraitKey, number>,
  archetype: ArchetypePrototype
): number {
  const traits: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];
  let sumSquares = 0;
  
  for (const trait of traits) {
    const userScore = userTraits[trait] || 50;
    const archetypeScore = archetype.traitProfile[trait];
    sumSquares += Math.pow(userScore - archetypeScore, 2);
  }
  
  return Math.sqrt(sumSquares);
}

export function findBestMatchingArchetypes(
  userTraits: Record<TraitKey, number>,
  topN: number = 3
): Array<{ archetype: string; score: number; confidence: number }> {
  const results: Array<{ archetype: string; distance: number }> = [];
  
  for (const [name, prototype] of Object.entries(archetypePrototypes)) {
    const distance = calculateArchetypeDistance(userTraits, prototype);
    results.push({ archetype: name, distance });
  }
  
  results.sort((a, b) => a.distance - b.distance);
  
  const maxDistance = 150;
  return results.slice(0, topN).map(r => ({
    archetype: r.archetype,
    score: Math.max(0, Math.min(100, 100 - (r.distance / maxDistance) * 100)),
    confidence: Math.max(0, Math.min(1, 1 - (r.distance / maxDistance)))
  }));
}

export function getArchetypePrototype(name: string): ArchetypePrototype | undefined {
  return archetypePrototypes[name];
}

export const ALL_ARCHETYPE_NAMES = Object.keys(archetypePrototypes);

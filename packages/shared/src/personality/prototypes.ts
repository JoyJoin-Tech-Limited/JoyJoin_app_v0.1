/**
 * V4 Adaptive Assessment - Archetype Prototype Definitions
 * 12原型特质矩阵定义
 * 
 * Phase 2 Deduplication: traitProfile, energyLevel, secondaryDifferentiators,
 * confusableWith, and uniqueSignalTraits are now sourced from archetypeRegistry.ts
 * (the single source of truth). This file retains display metadata (icon),
 * archetypeDescriptions, and calculation functions.
 */

import { TraitKey } from './types';
import { archetypeRegistry } from './archetypeRegistry';

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

const ARCHETYPE_ICONS: Record<string, string> = {
  corgi: "🐕",
  rooster: "🐓",
  hamster_praise: "🐹",
  fox: "🦊",
  dolphin_calm: "🐬",
  spider: "🕷️",
  koala: "🐨",
  octopus: "🐙",
  owl: "🦉",
  elephant: "🐘",
  turtle: "🐢",
  cat: "🐱"
};

/**
 * Build archetypePrototypes from archetypeRegistry (single source of truth)
 * plus local display metadata (icon).
 */
export const archetypePrototypes: Record<string, ArchetypePrototype> = {};
for (const [id, record] of Object.entries(archetypeRegistry)) {
  archetypePrototypes[id] = {
    id: record.id,
    name: id,
    icon: ARCHETYPE_ICONS[id] || "🎭",
    energyLevel: record.profile.energyLevel,
    traitProfile: record.profile.traitProfile,
    secondaryDifferentiators: record.profile.secondaryDifferentiators,
    confusableWith: record.profile.confusableWith as string[],
    uniqueSignalTraits: record.profile.uniqueSignalTraits,
  };
}

export function normalizeTraitScore(rawScore: number): number {
  // Scale factor: average option trait scores are in [-3, +3] range
  // To map to archetype range [~20, ~95], use multiplier of 15
  // avg = +3 → 50 + 45 = 95
  // avg = 0 → 50
  // avg = -3 → 50 - 45 = 5
  const normalized = 50 + (rawScore * 15);
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

export interface ArchetypeDescription {
  tagline: string;
  strengths: string[];
  socialRole: string;
  idealPartners: string[];
  tips: string;
}

export const archetypeDescriptions: Record<string, ArchetypeDescription> = {
  "corgi": {
    tagline: "你是社交场合的快乐源泉，用热情感染身边的每一个人",
    strengths: ["自带氛围感，能快速活跃气氛", "真诚热情，让人感到温暖", "主动破冰，擅长开启话题", "能量充沛，带动团队活力"],
    socialRole: "气氛担当",
    idealPartners: ["dolphin_calm", "koala", "spider"],
    tips: "你的热情是宝贵的天赋。记得适时给自己充电，也留意照顾那些更安静的伙伴。"
  },
  "rooster": {
    tagline: "你是团队的稳定能量来源，用正能量温暖每个人",
    strengths: ["情绪稳定可靠", "善于鼓励他人", "认真负责有条理", "持续输出正能量"],
    socialRole: "正能量担当",
    idealPartners: ["fox", "owl", "octopus"],
    tips: "你的稳定是团队的定心丸。继续保持你的乐观态度，它能帮助他人度过低谷。"
  },
  "hamster_praise": {
    tagline: "你是真诚的赞美家，善于发现并欣赏他人的闪光点",
    strengths: ["真诚夸赞，让人如沐春风", "高度共情，理解他人感受", "善于建立深度连接", "营造安全的社交氛围"],
    socialRole: "暖心夸夸官",
    idealPartners: ["owl", "turtle", "cat"],
    tips: "你的赞美是发自内心的礼物。同时也记得接受他人对你的赞美，你值得。"
  },
  "fox": {
    tagline: "你是社交场合的点子王，总能带来新鲜有趣的视角",
    strengths: ["思维敏捷有创意", "善于发现新鲜事物", "话题转换自如", "能把无聊变有趣"],
    socialRole: "创意点子王",
    idealPartners: ["rooster", "elephant", "koala"],
    tips: "你的创意是难得的天赋。偶尔也可以放慢脚步，和大家一起享受当下的简单快乐。"
  },
  "dolphin_calm": {
    tagline: "你是从容自在的社交高手，在任何场合都能游刃有余",
    strengths: ["情绪稳定从容", "善于调和气氛", "既能独处也享受社交", "给人安心的感觉"],
    socialRole: "稳定协调者",
    idealPartners: ["corgi", "fox", "octopus"],
    tips: "你的平衡感是难得的品质。你能在热闹和安静之间自如切换，这是很多人羡慕的能力。"
  },
  "spider": {
    tagline: "你是人际关系的编织者，善于连接不同的人",
    strengths: ["记住每个人的特点", "善于介绍合适的人相识", "维护长期关系", "在后台默默付出"],
    socialRole: "人脉连接者",
    idealPartners: ["corgi", "hamster_praise", "fox"],
    tips: "你编织的人际网络是无价之宝。记得也把自己放在网络的中心，接受他人的关心。"
  },
  "koala": {
    tagline: "你是可靠的守护者，用温暖和包容拥抱身边的人",
    strengths: ["值得信赖的陪伴者", "善于倾听", "包容理解他人", "给人安全感"],
    socialRole: "温暖守护者",
    idealPartners: ["fox", "octopus", "corgi"],
    tips: "你的温暖是他人的避风港。记得也照顾好自己的情绪，你的感受同样重要。"
  },
  "octopus": {
    tagline: "你是独特的思想者，在深度对话中绽放光芒",
    strengths: ["思维深度独特", "善于深度对话", "创意源源不断", "能发现被忽视的细节"],
    socialRole: "深度思考者",
    idealPartners: ["rooster", "dolphin_calm", "koala"],
    tips: "你的独特视角是难得的礼物。小团体深度交流是你发光的舞台，大胆展现自己吧。"
  },
  "owl": {
    tagline: "你是冷静的观察者和分析家，洞察力是你的超能力",
    strengths: ["观察敏锐细致", "分析思考深入", "提供客观建议", "值得信赖的智囊"],
    socialRole: "智慧观察者",
    idealPartners: ["hamster_praise", "rooster", "elephant"],
    tips: "你的洞察力让你看透事物本质。在合适的时候分享你的观察，它们对他人很有价值。"
  },
  "elephant": {
    tagline: "你是团队的稳定基石，用责任心和可靠让大家安心",
    strengths: ["高度可靠负责", "执行力强", "情绪稳定", "善于规划安排"],
    socialRole: "稳定基石",
    idealPartners: ["fox", "owl", "octopus"],
    tips: "你的稳定是团队不可或缺的。偶尔也允许自己放松，不必事事都承担责任。"
  },
  "turtle": {
    tagline: "你是沉稳的思考者，用深度和真诚建立长久的连接",
    strengths: ["深思熟虑", "真诚可靠", "善于一对一深交", "专注力强"],
    socialRole: "深度连接者",
    idealPartners: ["hamster_praise", "koala", "dolphin_calm"],
    tips: "你的深度是稀缺的品质。虽然社交可能消耗能量，但你建立的关系都是真诚持久的。"
  },
  "cat": {
    tagline: "你是独立的灵魂，在自己的节奏中找到舒适与自在",
    strengths: ["独立自主", "自给自足", "不随波逐流", "有自己的世界"],
    socialRole: "独立探索者",
    idealPartners: ["hamster_praise", "koala", "turtle"],
    tips: "你的独立是一种力量。在舒适的节奏中社交，选择质量而非数量的人际关系。"
  }
};

export function getArchetypeDescription(name: string): ArchetypeDescription | undefined {
  return archetypeDescriptions[name];
}

// Re-export chemistry functions from the unified compatibility module
// This provides backwards compatibility while using the new 12x12 matrix as the single source of truth
export { 
  getChemistryForArchetype, 
  getArchetypeCompatibility, 
  getTopCompatibleArchetypes,
  getCompatibilityCategory,
  getCompatibilityDescription,
  compatibilityMatrix,
  ARCHETYPE_COMPATIBILITY_DESCRIPTIONS,
  type ChemistryResult as CompatibilityResult
} from './archetypeCompatibility';

/**
 * Personality Result View Model
 * 性格测试结果统一视图模型
 *
 * A pure function that transforms raw assessment API results into a unified
 * view model consumed by both web and mini-program result pages.
 *
 * Design principle: convergent data, divergent rendering.
 * This module exports data + types + pure view-model builders only.
 * No React components, no Taro components, no animation libraries.
 */

import { archetypeRegistry, type ArchetypeRecord, type ArchetypeDisplay } from './archetypeRegistry';
import { getArchetypeSkills, type ArchetypeSkillSet } from './archetypeSkills';

import { getArchetypeIndex, getArchetypeTypeNo } from './archetypeNames';
import { getStyleSpectrum, getAllArchetypeScores, type StyleSpectrumResult } from './matcherV2';
import type { TraitKey } from './types';

// ─── Input Types ───

export interface AssessmentResultInput {
  algorithmVersion: string;
  primaryArchetype: string;
  secondaryArchetype?: string | null;
  topArchetypes?: Array<{ archetype: string; score: number; confidence?: number }> | null;
  affinityScore: number;
  opennessScore: number;
  conscientiousnessScore: number;
  emotionalStabilityScore: number;
  extraversionScore: number;
  positivityScore: number;
  totalQuestions: number;
  chemistryList: Array<{ role: string; percentage: number; reason?: string }>;
  isDecisive: boolean;
  completedAt: string;
}

// ─── Output Types ───

export interface TraitEntry {
  key: TraitKey;
  label: string;
  score: number; // 0-100
}

export interface TopMatchEntry {
  archetype: string;
  score: number;
  confidence?: number;
  isPrimary: boolean;
}

export interface ChemistryEntry {
  role: string;
  percentage: number;
  reason?: string;
}

export interface ShareData {
  headline: string;
  shareLine: string;
  stateLabel: string;
  analysis: string;
  socialRole: string;
  bestScene: string;
  microAction: string;
  blendLine: string;
  whyThisFits: string;
  expressionTags: string[];
  selfIntro: string;
  friendCallout: string;
  socialInvite: string;
}

export interface PosterInputDTO {
  archetype: string;
  nickname: string;
  tagline: string;
  summary: string;
  shareLine: string;
  confidenceLabel?: string;
  rarityLabel?: string;
  skillAttribute?: string;
  activeSkillTitle?: string;
  activeSkillEffect?: string;
  passiveSkillTitle?: string;
  passiveSkillEffect?: string;
  traitEntries: TraitEntry[];
  topMatches: Array<{ archetype: string; score: number }>;
  energyLevel?: number;
  archetypeRank?: number;
  serialNumber?: string;
}

export interface PersonalityResultViewModel {
  // Core identity
  primaryArchetype: string;
  secondaryArchetype: string | null;
  archetypeRecord: ArchetypeRecord | null;
  archetypeIndex: number | null;
  typeNo: string;

  // Algorithm metadata
  algorithmVersion: string;
  totalQuestions: number;
  isDecisive: boolean;
  completedAt: string;

  // Traits
  traitEntries: TraitEntry[];
  allArchetypeScores: Array<{ archetype: string; score: number; confidence: number; emoji: string }>;

  // Style spectrum
  styleSpectrum: StyleSpectrumResult | null;

  // Matches
  topMatches: TopMatchEntry[];
  highCompatibilityPartners: ChemistryEntry[];

  // Skills (from archetypeSkills.ts)
  skillSet: ArchetypeSkillSet | undefined;

  // Display content (from archetypeRegistry.display)
  display: ArchetypeDisplay | null;

  // Share content
  share: ShareData;

  // Poster export DTO
  posterInput: PosterInputDTO;
}

// ─── Trait Labels ───

const TRAIT_LABELS: Record<TraitKey, string> = {
  A: '亲和力',
  O: '开放性',
  C: '责任心',
  E: '情绪稳定',
  X: '外向性',
  P: '正能量',
};

// ─── Builder ───

export function buildResultViewModel(result: AssessmentResultInput): PersonalityResultViewModel {
  const primaryArchetype = result.primaryArchetype;
  const archetypeRecord = archetypeRegistry[primaryArchetype] ?? null;
  const archetypeIndex = getArchetypeIndex(primaryArchetype);
  const typeNo = getArchetypeTypeNo(primaryArchetype);

  // ─ Trait scores ─
  const traitScores: Record<TraitKey, number> = {
    A: result.affinityScore,
    O: result.opennessScore,
    C: result.conscientiousnessScore,
    E: result.emotionalStabilityScore,
    X: result.extraversionScore,
    P: result.positivityScore,
  };

  const traitEntries: TraitEntry[] = [
    { key: 'A', label: TRAIT_LABELS.A, score: result.affinityScore },
    { key: 'O', label: TRAIT_LABELS.O, score: result.opennessScore },
    { key: 'C', label: TRAIT_LABELS.C, score: result.conscientiousnessScore },
    { key: 'E', label: TRAIT_LABELS.E, score: result.emotionalStabilityScore },
    { key: 'X', label: TRAIT_LABELS.X, score: result.extraversionScore },
    { key: 'P', label: TRAIT_LABELS.P, score: result.positivityScore },
  ];

  // ─ All archetype scores ─
  let allArchetypeScores: Array<{ archetype: string; score: number; confidence: number; emoji: string }> = [];
  try {
    allArchetypeScores = getAllArchetypeScores(traitScores);
  } catch {
    // Silently fail; fallback to empty array
  }

  // ─ Style spectrum ─
  let styleSpectrum: StyleSpectrumResult | null = null;
  try {
    const spectrum = getStyleSpectrum(traitScores, undefined, primaryArchetype);
    styleSpectrum = {
      primary: spectrum.primary,
      adjacentStyles: spectrum.adjacentStyles,
      spectrumPosition: spectrum.spectrumPosition,
      isDecisive: spectrum.isDecisive,
      decisionReason: spectrum.decisionReason,
    };
  } catch {
    // Silently fail
  }

  // ─ Top matches ─
  const topMatches: TopMatchEntry[] = (result.topArchetypes ?? [])
    .map((t) => ({
      archetype: t.archetype,
      score: t.score,
      confidence: t.confidence,
      isPrimary: t.archetype === primaryArchetype,
    }))
    .sort((a, b) => b.score - a.score);

  // ─ High compatibility partners (≥70%) ─
  const highCompatibilityPartners = (result.chemistryList ?? [])
    .filter((c) => c.percentage >= 70)
    .sort((a, b) => b.percentage - a.percentage);

  // ─ Skills ─
  const skillSet = archetypeRecord ? getArchetypeSkills(primaryArchetype) : undefined;

  // ─ Display content (from registry) ─
  const display = archetypeRecord?.display ?? null;

  // ─ Share data ─
  const fallback = display?.xiaoyueFallback;
  const shareVariants = display?.shareVariants;
  const share = buildShareData(result, display, topMatches);

  // ─ Poster DTO ─
  const posterInput: PosterInputDTO = {
    archetype: primaryArchetype,
    nickname: archetypeRecord?.narrative.nickname ?? primaryArchetype,
    tagline: archetypeRecord?.narrative.tagline ?? '',
    summary: archetypeRecord?.narrative.description ?? '',
    shareLine: share.shareLine,
    confidenceLabel: result.isDecisive ? '高置信匹配' : undefined,
    rarityLabel: archetypeRecord?.insights.rarityPercentage
      ? `稀有度 ${Math.round(archetypeRecord.insights.rarityPercentage)}%`
      : undefined,
    skillAttribute: skillSet?.attribute,
    activeSkillTitle: skillSet?.activeSkill.name,
    activeSkillEffect: skillSet?.activeSkill.shortEffect,
    passiveSkillTitle: skillSet?.passiveSkill.name,
    passiveSkillEffect: skillSet?.passiveSkill.shortEffect,
    traitEntries,
    topMatches: topMatches.slice(0, 3).map((t) => ({ archetype: t.archetype, score: t.score })),
    energyLevel: archetypeRecord?.profile.energyLevel,
    archetypeRank: archetypeIndex ?? undefined,
    serialNumber: typeNo,
  };

  return {
    primaryArchetype,
    secondaryArchetype: result.secondaryArchetype ?? null,
    archetypeRecord,
    archetypeIndex,
    typeNo,
    algorithmVersion: result.algorithmVersion,
    totalQuestions: result.totalQuestions,
    isDecisive: result.isDecisive,
    completedAt: result.completedAt,
    traitEntries,
    allArchetypeScores,
    styleSpectrum,
    topMatches,
    highCompatibilityPartners,
    skillSet,
    display,
    share,
    posterInput,
  };
}

// ─── Share Data Builder ───

function buildShareData(
  result: AssessmentResultInput,
  display: ArchetypeDisplay | null,
  topMatches: TopMatchEntry[],
): ShareData {
  const fallback = display?.xiaoyueFallback;
  const variants = display?.shareVariants;
  const primary = result.primaryArchetype;

  // Secondary archetype detection (same logic as derivePersonalityShareToolkit)
  const ranked = [...topMatches].sort((a, b) => b.score - a.score);
  const secondary =
    result.secondaryArchetype ??
    ranked.find((t) => t.archetype !== primary)?.archetype ??
    null;

  const isBlend =
    ranked.length >= 2
      ? ranked[0].score - ranked[1].score <= 8
      : !!secondary && secondary !== primary;

  // Fallback blend line
  let blendLine: string;
  if (!secondary || secondary === primary) {
    blendLine = `这次更清楚落在${primary}这边，你给人的第一感受会是${fallback?.stateLabel ?? ''}`;
  } else if (isBlend) {
    blendLine = `你底色更像${primary}，但熟起来或遇到对频的话题时，会露出一点${secondary}那一面`;
  } else {
    blendLine = `虽然你身上也有一点${secondary}的影子，但这次更稳定地落在${primary}这边`;
  }

  // Fallback whyThisFits
  let whyThisFits: string;
  const suffix =
    secondary && secondary !== primary
      ? isBlend
        ? `你身上也带一点${secondary}的感觉，所以不是单一一种路数。`
        : `虽然也有一点${secondary}的影子，但没有盖过主底色。`
      : '';
  whyThisFits = `这次会落到${primary}，主要因为你在真实社交里更容易呈现${fallback?.stateLabel ?? ''}这种存在感。${suffix}`.trim();

  // Expression tags
  const tagsByState: Record<string, string[]> = {
    快热带动型: ['一上桌就熟得快', '热场但不压人'],
    稳场推进型: ['不抢戏但稳全场', '靠谱感很强'],
    熟了更有火花型: ['第一眼温和型', '熟了会越来越有戏'],
    灵感破冰型: ['聊天自带新鲜感', '靠点子破冰'],
    慢热深聊型: ['慢热但不冷场', '聊到点上停不下'],
    低耗观察型: ['先观察再发力', '低耗但会看人'],
    局内升温型: ['越相处越有戏', '关系会慢慢热起来'],
  };
  const stateLabel = fallback?.stateLabel ?? '局内升温型';
  const baseTags = [...(tagsByState[stateLabel] ?? ['社交有自己的节奏', '相处久了更舒服'])];
  const sceneTag = deriveSceneTag(fallback?.bestScene ?? '');
  baseTags.push(sceneTag);
  baseTags.push(isBlend ? '有点双原型感' : `${primary}气质`);
  const expressionTags = Array.from(new Set(baseTags)).slice(0, 4);

  // Share variants
  const bestScene = (fallback?.bestScene ?? '').replace(/^更适合/, '').replace(/[。！!？?]+$/g, '').trim();
  const headline = (fallback?.headline ?? '').replace(/[。！!？?]+$/g, '').trim();

  const selfIntro = variants?.selfIntro ?? fallback?.shareLine ?? `我是${primary}型`;
  const friendCallout =
    variants?.friendCallout ??
    (secondary && secondary !== primary && isBlend
      ? `认识我的人应该会懂，我平时更像${primary}，熟起来会露出一点${secondary}那面`
      : `认识我的人应该会懂，${headline}`);
  const socialInvite =
    variants?.socialInvite ??
    (bestScene ? `如果一起组局，我更适合${bestScene}，会比较容易进入状态` : `和${primary}一起组局，氛围会慢慢热起来`);

  return {
    headline: fallback?.headline ?? `你的 JoyJoin 原型是 ${primary}`,
    shareLine: fallback?.shareLine ?? `我是${primary}型`,
    stateLabel: fallback?.stateLabel ?? '',
    analysis: fallback?.analysis ?? `${primary}，你的特质组合挺有意思。继续探索一下自己的社交风格吧。`,
    socialRole: fallback?.socialRole ?? '',
    bestScene: fallback?.bestScene ?? '',
    microAction: fallback?.microAction ?? '',
    blendLine,
    whyThisFits,
    expressionTags,
    selfIntro,
    friendCallout,
    socialInvite,
  };
}

function deriveSceneTag(bestScene: string): string {
  if (/2到4人|一对一|深聊|咖啡|散步/.test(bestScene)) return '适合小局深聊';
  if (/6到8人|热场/.test(bestScene)) return '适合多人热场';
  if (/主题|探索感|交换想法/.test(bestScene)) return '主题局更出彩';
  if (/留白|不吵/.test(bestScene)) return '低耗社交更舒服';
  return '越相处越有戏';
}

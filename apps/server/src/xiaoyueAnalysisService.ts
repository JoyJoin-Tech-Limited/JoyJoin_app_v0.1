import { z } from 'zod';
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames';
import { XIAOYUE_PERSONA, GENDER_NEUTRAL, XIAOYUE_PERSONA_PROMPT_VERSION } from './prompts';
import { getDeepseekClient, getDeepseekModel } from './ai/deepseekClient';
import { logger } from './lib/logger';

export interface ArchetypeAnalysisInput {
  archetype: string;
  secondaryArchetype?: string | null;
  topArchetypes?: Array<{
    archetype: string;
    score: number;
    confidence?: number;
  }>;
  traitScores: {
    affinity: number;
    openness: number;
    conscientiousness: number;
    emotionalStability: number;
    extraversion: number;
    positivity: number;
  };
  questionPath?: string[];
  confidence?: number;
}

export interface XiaoyueShareVariants {
  selfIntro: string;
  friendCallout: string;
  socialInvite: string;
}

export interface XiaoyueAnalysisResult {
  headline: string;
  analysis: string;
  socialRole: string;
  bestScene: string;
  microAction: string;
  shareLine: string;
  stateLabel: string;
  whyThisFits: string;
  blendLine: string;
  expressionTags: string[];
  shareVariants: XiaoyueShareVariants;
  cached: boolean;
}

type ConfidenceBand = 'high' | 'medium' | 'low';

interface DerivedSocialSnapshot {
  stateLabel: string;
  confidenceBand: ConfidenceBand;
  confidenceInstruction: string;
  sceneLens: string;
  socialRole: string;
  bestScene: string;
  microAction: string;
  headlineHint: string;
  shareLineHint: string;
}

function archetypeToCn(id: string): string {
  return ARCHETYPE_BY_ID[id]?.nameCn ?? id;
}

const HIGH_CONFIDENCE_THRESHOLD = 0.82;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.64;
const HIGH_SOCIAL_THRESHOLD = 72;
const HIGH_POSITIVITY_THRESHOLD = 70;
const HIGH_STABILITY_THRESHOLD = 72;
const HIGH_CONSCIENTIOUSNESS_THRESHOLD = 68;
const WARM_SOCIAL_THRESHOLD = 66;
const HIGH_OPENNESS_THRESHOLD = 74;
const MID_EXTRAVERSION_THRESHOLD = 58;
const LOW_EXTRAVERSION_THRESHOLD = 46;
const MID_OPENNESS_THRESHOLD = 62;
const MID_STABILITY_THRESHOLD = 62;
const HEADLINE_MIN_LENGTH = 12;
const HEADLINE_MAX_LENGTH = 24;
const ANALYSIS_MIN_LENGTH = 30;
const ANALYSIS_MAX_LENGTH = 240;
const SHORT_COPY_MIN_LENGTH = 8;
const SHORT_COPY_MAX_LENGTH = 80;
const EXTENDED_COPY_MAX_LENGTH = 140;
const TAG_MIN_LENGTH = 2;
const TAG_MAX_LENGTH = 8;

const shareVariantsSchema = z.object({
  selfIntro: z.string().min(SHORT_COPY_MIN_LENGTH).max(EXTENDED_COPY_MAX_LENGTH),
  friendCallout: z.string().min(SHORT_COPY_MIN_LENGTH).max(EXTENDED_COPY_MAX_LENGTH),
  socialInvite: z.string().min(SHORT_COPY_MIN_LENGTH).max(EXTENDED_COPY_MAX_LENGTH),
});

const analysisResponseSchema = z.object({
  headline: z.string().min(HEADLINE_MIN_LENGTH).max(HEADLINE_MAX_LENGTH),
  analysis: z.string().min(ANALYSIS_MIN_LENGTH).max(ANALYSIS_MAX_LENGTH),
  socialRole: z.string().min(SHORT_COPY_MIN_LENGTH).max(SHORT_COPY_MAX_LENGTH),
  bestScene: z.string().min(SHORT_COPY_MIN_LENGTH).max(SHORT_COPY_MAX_LENGTH),
  microAction: z.string().min(SHORT_COPY_MIN_LENGTH).max(SHORT_COPY_MAX_LENGTH),
  shareLine: z.string().min(SHORT_COPY_MIN_LENGTH).max(SHORT_COPY_MAX_LENGTH),
  whyThisFits: z.string().min(ANALYSIS_MIN_LENGTH).max(EXTENDED_COPY_MAX_LENGTH),
  blendLine: z.string().min(SHORT_COPY_MIN_LENGTH).max(EXTENDED_COPY_MAX_LENGTH),
  expressionTags: z.array(z.string().min(TAG_MIN_LENGTH).max(TAG_MAX_LENGTH)).min(3).max(4),
  shareVariants: shareVariantsSchema,
});

const analysisCache = new Map<string, { result: Omit<XiaoyueAnalysisResult, 'cached'>; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60;

const traitLabels: Record<keyof ArchetypeAnalysisInput['traitScores'], string> = {
  affinity: '亲和力',
  openness: '开放性',
  conscientiousness: '责任心',
  emotionalStability: '情绪稳定性',
  extraversion: '外向性',
  positivity: '正能量性',
};

function normalizeTraitScore(value: number): number {
  if (value <= 1) return Math.round(value * 100);
  return Math.round(value);
}

function getConfidenceBand(confidence = 1): {
  band: ConfidenceBand;
  instruction: string;
} {
  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    return {
      band: 'high',
      instruction: '语气可以笃定，直接说“你就是/你通常会”，但仍然保持不评判。',
    };
  }

  if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) {
    return {
      band: 'medium',
      instruction: '语气保持有把握，但用“你更像是/你多半会/常见表现是”这类表达，避免绝对化。',
    };
  }

  return {
    band: 'low',
    instruction: '强调这是一种交界气质，用“你身上有两种节奏交界”“这次更偏向”这样的说法，避免下定论。',
  };
}

export function deriveSocialSnapshot(input: ArchetypeAnalysisInput): DerivedSocialSnapshot {
  const scores = Object.fromEntries(
    Object.entries(input.traitScores).map(([key, value]) => [key, normalizeTraitScore(value)])
  ) as Record<keyof ArchetypeAnalysisInput['traitScores'], number>;

  const confidence = getConfidenceBand(input.confidence);

  const stateLabel = (() => {
    if (scores.extraversion >= HIGH_SOCIAL_THRESHOLD && scores.positivity >= HIGH_POSITIVITY_THRESHOLD) return '快热带动型';
    if (scores.emotionalStability >= HIGH_STABILITY_THRESHOLD && scores.conscientiousness >= HIGH_CONSCIENTIOUSNESS_THRESHOLD) return '稳场推进型';
    if (scores.affinity >= HIGH_SOCIAL_THRESHOLD && scores.positivity >= WARM_SOCIAL_THRESHOLD) return '熟了更有火花型';
    if (scores.openness >= HIGH_OPENNESS_THRESHOLD && scores.extraversion >= MID_EXTRAVERSION_THRESHOLD) return '灵感破冰型';
    if (scores.extraversion <= LOW_EXTRAVERSION_THRESHOLD && scores.openness >= MID_OPENNESS_THRESHOLD) return '慢热深聊型';
    if (scores.extraversion <= LOW_EXTRAVERSION_THRESHOLD && scores.emotionalStability >= MID_STABILITY_THRESHOLD) return '低耗观察型';
    return '局内升温型';
  })();

  const snapshotByState: Record<string, Omit<DerivedSocialSnapshot, 'confidenceBand' | 'confidenceInstruction' | 'stateLabel'>> = {
    '快热带动型': {
      sceneLens: '陌生人局里，你通常会比较快把气氛点亮，别人会先从你的能量里感到放松。',
      socialRole: '你更像开场加速器，能让一桌人更快进入同频状态。',
      bestScene: '更适合6到8人的轻松热场局，有共同话题、能快速接梗的活动氛围会更对你胃口。',
      microAction: '下次进新局，先抛一个轻松问题，再顺手接住第一个回应你的人，把热度稳住就够了。',
      headlineHint: '你不是硬撑热闹，你是自然带热的人',
      shareLineHint: `我是${archetypeToCn(input.archetype)}，属于一进场就会慢慢把气氛带起来的那种。`,
    },
    '稳场推进型': {
      sceneLens: '你在局里的存在感不一定最炸，但大家会因为你在而更容易定下来。',
      socialRole: '你更像节奏稳定器，能把场子从散乱拉回舒服的推进感。',
      bestScene: '更适合有一点主题、能边聊边推进的小局，比如晚餐局、桌游局或有明确话题的活动。',
      microAction: '下次参加活动，先认领一个小动作：带第一轮自我介绍，或把聊散的话题轻轻拉回来。',
      headlineHint: '你不抢戏，但场子会跟着你稳下来',
      shareLineHint: `我是${archetypeToCn(input.archetype)}，更像那种不吵但能把场子稳住的人。`,
    },
    '熟了更有火花型': {
      sceneLens: '你不是一上来就最满格的人，但一旦熟起来，别人会明显感受到你的温度和后劲。',
      socialRole: '你更像关系升温器，能把表面的寒暄带到真正舒服的交流。',
      bestScene: '更适合能给你一点预热空间的饭局、散步局或2到4人的深聊场景。',
      microAction: '下次别急着全场营业，先和一个你顺眼的人聊深两轮，再决定要不要把热度往外扩。',
      headlineHint: '你不是秒热型，你是越聊越有戏',
      shareLineHint: `我是${archetypeToCn(input.archetype)}，熟起来之后会比第一眼看上去更有火花。`,
    },
    '灵感破冰型': {
      sceneLens: '你在社交里最有辨识度的地方，不是会不会说，而是总能把话题拐到更有意思的角度。',
      socialRole: '你更像话题点火器，能把原本平的聊天带出灵感和新鲜感。',
      bestScene: '更适合带一点探索感的新局、主题活动或能让人交换想法的场景。',
      microAction: '下次开场先准备一个“最近看到的有趣东西”，把你的灵感用成破冰器，不用一次讲太多。',
      headlineHint: '你不靠硬聊破冰，你靠灵感把场子聊活',
      shareLineHint: `我是${archetypeToCn(input.archetype)}，属于会把普通聊天聊出新鲜感的那种。`,
    },
    '慢热深聊型': {
      sceneLens: '你不是难进入状态，只是需要先找到值得投入的人和话题。',
      socialRole: '你更像深聊引线，一旦找到对频的人，聊天会比表面热闹更有记忆点。',
      bestScene: '更适合2到4人的小局、散步局、咖啡局，或者先有一点共同话题的场景。',
      microAction: '下次进新局先别逼自己全场发力，只要提前准备一个你真想聊的问题，先和一个人聊开就够了。',
      headlineHint: '你不是社交慢，你只是只对对的人升温',
      shareLineHint: `我是${archetypeToCn(input.archetype)}，看着慢热，其实聊到点上就很能聊。`,
    },
    '低耗观察型': {
      sceneLens: '你会先看气场、看人，再决定自己要不要往前走，这让你的出手通常比别人更准。',
      socialRole: '你更像安静观察者，话不一定最多，但经常能在关键时刻说到点上。',
      bestScene: '更适合节奏不吵、允许各自留白的局，比如3到6人的轻松聚会或一对一深聊。',
      microAction: '下次别要求自己立刻融入，只要先记住一个让你感兴趣的人或话题，再顺着它接近就行。',
      headlineHint: '你不是掉线型，你是先观察再发力',
      shareLineHint: `我是${archetypeToCn(input.archetype)}，习惯先看气场，再决定什么时候出手。`,
    },
    '局内升温型': {
      sceneLens: '你在社交里不是靠某一个夸张动作被看见，而是靠自己的节奏让相处慢慢变舒服。',
      socialRole: '你更像局内升温器，能让关系在不知不觉里自然松开。',
      bestScene: '更适合有一点互动空间、能让人逐步进入状态的活动，而不是一上来就特别吵的场子。',
      microAction: '下次进新局，先锁定一个你能自然接上的话题，把第一轮存在感建立起来就够了。',
      headlineHint: '你不是硬撑社交，你是把关系慢慢聊热',
      shareLineHint: `我是${archetypeToCn(input.archetype)}，属于相处越往后越容易让人觉得舒服的那种。`,
    },
  };

  return {
    stateLabel,
    confidenceBand: confidence.band,
    confidenceInstruction: confidence.instruction,
    ...snapshotByState[stateLabel],
  };
}

function getRankedTraits(input: ArchetypeAnalysisInput): Array<{ name: string; score: number }> {
  return Object.entries(input.traitScores)
    .map(([key, value]) => ({
      name: traitLabels[key as keyof typeof traitLabels],
      score: normalizeTraitScore(value),
    }))
    .sort((a, b) => b.score - a.score);
}

function getTopArchetypeCandidates(input: ArchetypeAnalysisInput): Array<{
  archetype: string;
  score: number;
  confidence?: number;
}> {
  if (!Array.isArray(input.topArchetypes)) {
    return input.secondaryArchetype
      ? [
          { archetype: input.archetype, score: 100, confidence: input.confidence },
          { archetype: input.secondaryArchetype, score: 92 },
        ]
      : [{ archetype: input.archetype, score: 100, confidence: input.confidence }];
  }

  const normalized = input.topArchetypes
    .filter((item): item is { archetype: string; score: number; confidence?: number } =>
      !!item &&
      typeof item.archetype === 'string' &&
      item.archetype.length > 0 &&
      typeof item.score === 'number' &&
      Number.isFinite(item.score)
    )
    .sort((a, b) => b.score - a.score);

  if (normalized.length === 0) {
    return input.secondaryArchetype
      ? [
          { archetype: input.archetype, score: 100, confidence: input.confidence },
          { archetype: input.secondaryArchetype, score: 92 },
        ]
      : [{ archetype: input.archetype, score: 100, confidence: input.confidence }];
  }

  if (!normalized.some((item) => item.archetype === input.archetype)) {
    normalized.unshift({ archetype: input.archetype, score: normalized[0].score + 1, confidence: input.confidence });
  }

  return normalized;
}

function getBlendSecondaryArchetype(input: ArchetypeAnalysisInput): string | null {
  if (input.secondaryArchetype) return input.secondaryArchetype;
  return getTopArchetypeCandidates(input).find((item) => item.archetype !== input.archetype)?.archetype ?? null;
}

function getTopArchetypeGap(input: ArchetypeAnalysisInput): number | null {
  const candidates = getTopArchetypeCandidates(input);
  if (candidates.length < 2) return null;
  return Math.round((candidates[0].score - candidates[1].score) * 10) / 10;
}

function isBlendMatch(input: ArchetypeAnalysisInput): boolean {
  const scoreGap = getTopArchetypeGap(input);
  if (scoreGap !== null) {
    return scoreGap <= 8;
  }

  return !!getBlendSecondaryArchetype(input) && (input.confidence ?? 1) < HIGH_CONFIDENCE_THRESHOLD;
}

function trimSentence(text: string): string {
  return text.replace(/[。！!？?]+$/g, '').trim();
}

function formatSentence(text: string): string {
  const next = trimSentence(text);
  return next ? `${next}。` : '';
}

function deriveSceneTag(bestScene: string): string {
  if (/2到4人|一对一|深聊|咖啡|散步/.test(bestScene)) return '适合小局深聊';
  if (/6到8人|热场/.test(bestScene)) return '适合多人热场';
  if (/主题|探索感|交换想法/.test(bestScene)) return '主题局更出彩';
  if (/留白|不吵/.test(bestScene)) return '低耗社交更舒服';
  return '越相处越有戏';
}

function buildExpressionTags(input: ArchetypeAnalysisInput, snapshot: DerivedSocialSnapshot): string[] {
  const tagsByState: Record<string, string[]> = {
    '快热带动型': ['一上桌就熟得快', '热场但不压人'],
    '稳场推进型': ['不抢戏但稳全场', '靠谱感很强'],
    '熟了更有火花型': ['第一眼温和型', '熟了会越来越有戏'],
    '灵感破冰型': ['聊天自带新鲜感', '靠点子破冰'],
    '慢热深聊型': ['慢热但不冷场', '聊到点上停不下'],
    '低耗观察型': ['先观察再发力', '低耗但会看人'],
    '局内升温型': ['越相处越有戏', '关系会慢慢热起来'],
  };

  const tags = [...(tagsByState[snapshot.stateLabel] ?? ['社交有自己的节奏', '相处久了更舒服'])];
  tags.push(deriveSceneTag(snapshot.bestScene));
  tags.push(isBlendMatch(input) && getBlendSecondaryArchetype(input) ? '有点双原型感' : `${archetypeToCn(input.archetype)}气质`);

  return Array.from(new Set(tags)).slice(0, 4);
}

function buildBlendLine(input: ArchetypeAnalysisInput, snapshot: DerivedSocialSnapshot): string {
  const secondaryArchetype = getBlendSecondaryArchetype(input);
  const primary = archetypeToCn(input.archetype);
  if (!secondaryArchetype || secondaryArchetype === input.archetype) {
    return formatSentence(`这次更清楚落在${primary}这边，你给人的第一感受会是${snapshot.stateLabel}`);
  }

  const secondary = archetypeToCn(secondaryArchetype);
  if (isBlendMatch(input)) {
    return formatSentence(`你底色更像${primary}，但熟起来或遇到对频的话题时，会露出一点${secondary}那一面`);
  }

  return formatSentence(`虽然你身上也有一点${secondary}的影子，但这次更稳定地落在${primary}这边`);
}

function buildWhyThisFits(input: ArchetypeAnalysisInput, snapshot: DerivedSocialSnapshot): string {
  const rankedTraits = getRankedTraits(input);
  const topTraits = rankedTraits.slice(0, 2).map((trait) => trait.name);
  const secondaryArchetype = getBlendSecondaryArchetype(input);
  const primary = archetypeToCn(input.archetype);
  const traitSummary = topTraits.length >= 2 ? `${topTraits[0]}和${topTraits[1]}` : topTraits[0] || '社交节奏';

  const suffix =
    secondaryArchetype && secondaryArchetype !== input.archetype
      ? isBlendMatch(input)
        ? `你身上也带一点${archetypeToCn(secondaryArchetype)}的感觉，所以不是单一一种路数。`
        : `虽然也有一点${archetypeToCn(secondaryArchetype)}的影子，但没有盖过主底色。`
      : '';

  return `${formatSentence(`这次会落到${primary}，主要是因为你的${traitSummary}更突出，放进真实社交场里会变成一种${snapshot.stateLabel}的存在感`)}${suffix}`.trim();
}

function buildShareVariants(input: ArchetypeAnalysisInput, snapshot: DerivedSocialSnapshot): XiaoyueShareVariants {
  const secondaryArchetype = getBlendSecondaryArchetype(input);
  const bestScene = trimSentence(snapshot.bestScene).replace(/^更适合/, '');

  const primary = archetypeToCn(input.archetype);
  return {
    selfIntro: snapshot.shareLineHint,
    friendCallout:
      secondaryArchetype && secondaryArchetype !== input.archetype && isBlendMatch(input)
        ? formatSentence(`认识我的人应该会懂，我平时更像${primary}，熟起来会露出一点${archetypeToCn(secondaryArchetype)}那面`)
        : formatSentence(`认识我的人应该会懂，${trimSentence(snapshot.headlineHint)}`),
    socialInvite: formatSentence(`如果一起组局，我更适合${bestScene}，会比较容易进入状态`),
  };
}

function getCacheKey(input: ArchetypeAnalysisInput): string {
  const confidenceBand = getConfidenceBand(input.confidence).band;
  const topArchetypesKey = getTopArchetypeCandidates(input)
    .slice(0, 2)
    .map((item) => `${item.archetype}:${Math.round(item.score)}`)
    .join('|');
  return `${input.archetype}_${input.secondaryArchetype ?? 'none'}_${confidenceBand}_${topArchetypesKey}_${Object.values(input.traitScores).map((value) => normalizeTraitScore(value)).join('_')}_v${XIAOYUE_PERSONA_PROMPT_VERSION}`;
}

function buildAnalysisPrompt(input: ArchetypeAnalysisInput): string {
  const { archetype, traitScores } = input;
  const archetypeCn = archetypeToCn(archetype);
  const snapshot = deriveSocialSnapshot(input);
  const rankedCandidates = getTopArchetypeCandidates(input).slice(0, 2);
  const secondaryArchetype = getBlendSecondaryArchetype(input);
  const topGap = getTopArchetypeGap(input);

  const traitSummary = Object.entries(traitScores)
    .map(([key, value]) => `- ${traitLabels[key as keyof typeof traitLabels]}: ${normalizeTraitScore(value)}/100`)
    .join('\n');

  const rankedTraits = getRankedTraits(input);

  const topTraits = rankedTraits.slice(0, 2).map((trait) => trait.name);
  const lowTraits = [...rankedTraits].reverse().slice(0, 2).map((trait) => trait.name);

  return `你在为悦聚 personality result 生成"悦仔分析"文案。已有 Pokémon 风格海报承载"原型视觉感"，这次输出必须走"文字版社交表达"，不能重复海报上的原型卡、编号、限定、收藏感文案。

用户原型：${archetypeCn}
用户六维特质：
${traitSummary}

高特质：${topTraits.join('、')}
相对收着的特质：${lowTraits.join('、')}
推断的当下社交状态：${snapshot.stateLabel}
社交角色提示：${snapshot.socialRole}
适合场景提示：${snapshot.bestScene}
微动作提示：${snapshot.microAction}
分享短句参考：${snapshot.shareLineHint}
次高原型：${secondaryArchetype ? archetypeToCn(secondaryArchetype) : '无明显次高原型'}
前二原型：${rankedCandidates.map((item) => `${archetypeToCn(item.archetype)}(${Math.round(item.score)})`).join(' / ')}
是否属于边界混合：${isBlendMatch(input) ? '是' : '否'}
前二差值：${topGap ?? '未知'}

置信度层级：${snapshot.confidenceBand}
语气要求：${snapshot.confidenceInstruction}

请严格输出 JSON，不要 markdown，不要代码块，不要额外解释，字段如下：
{
  "headline": "一句可晒的身份签名，12-24字，适合结果页顶部文字，不要直接重复原型名",
  "analysis": "3-4句主分析。重点写你在陌生人社交场里怎么出现、别人如何感受到你、你更适合什么局。不要出现分数、测试、模型、AI。",
  "socialRole": "一句话说明你在局里的价值或角色",
  "bestScene": "一句话说明你更适合什么活动氛围/人数/破冰方式",
  "microAction": "一句立即可执行的社交动作建议",
  "shareLine": "一句适合复制到评论区/聊天框的分享短句，别和 headline 重复",
  "whyThisFits": "1-2句，解释为什么这次更偏这个原型，强调真实社交信号，不要提模型或分数",
  "blendLine": "1句，解释主原型和次原型之间的张力或边界感；如果没有明显次高原型，也要写成一句稳定说明",
  "expressionTags": ["3到4个适合小红书/朋友圈传播的短标签，每个2到8字，不要带#"],
  "shareVariants": {
    "selfIntro": "适合直接发评论区/聊天框的自我介绍型文案",
    "friendCallout": "适合发给朋友或朋友圈配文的互动型文案",
    "socialInvite": "适合带一点轻邀约感的社交转化型文案"
  }
}

硬性要求：
1. 全部使用第二人称“你”或第一人称分享句，不要写“该用户”
2. 保持悦仔的机智、利落、不油腻，不要鸡汤，不要感叹号，不要过度热情
3. 用“场景 + 感受 + 动作”来写，少用抽象人格词
4. headline 和 shareLine 必须与海报视觉形成互补：更像一句活人会发出去的话，不要写成海报标题
 5. analysis 结尾必须落到一个低成本的下一步，不要开放式问句
 6. expressionTags 要像人会拿去发内容平台的标签，不要写“人格分析”“MBTI感”这种空词
 7. shareVariants 三句不能互相重复，要明显对应“自我介绍 / 朋友互动 / 轻邀约”三种传播场景`;
}

function extractJsonPayload(content: string): string {
  const candidates = [
    content.trim(),
    content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim(),
  ].filter((candidate): candidate is string => !!candidate);

  for (const candidate of candidates) {
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Try next candidate.
    }
  }

  const firstBrace = content.indexOf('{');
  if (firstBrace !== -1) {
    for (let end = content.lastIndexOf('}'); end > firstBrace; end = content.lastIndexOf('}', end - 1)) {
      const candidate = content.slice(firstBrace, end + 1).trim();
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        // Keep shrinking until a valid JSON object is found.
      }
    }
  }

  return content.trim();
}

function buildFallbackAnalysisPayload(input: ArchetypeAnalysisInput): Omit<XiaoyueAnalysisResult, 'cached'> {
  const snapshot = deriveSocialSnapshot(input);
  const archetype = archetypeToCn(input.archetype);
  const openingByBand: Record<ConfidenceBand, string> = {
    high: `你身上这股${archetype}的感觉挺明确，进到人群里会自然带出自己的节奏。`,
    medium: `你这次更像${archetype}这一挂，和人相处时会慢慢显出自己的节奏。`,
    low: `你身上像是站在两种社交节奏的交界处，这次更偏向${archetype}这边。`,
  };

  return {
    headline: snapshot.headlineHint,
    analysis: [
      openingByBand[snapshot.confidenceBand],
      snapshot.sceneLens,
      snapshot.bestScene,
      snapshot.microAction,
    ].join(' '),
    socialRole: snapshot.socialRole,
    bestScene: snapshot.bestScene,
    microAction: snapshot.microAction,
    shareLine: snapshot.shareLineHint,
    stateLabel: snapshot.stateLabel,
    whyThisFits: buildWhyThisFits(input, snapshot),
    blendLine: buildBlendLine(input, snapshot),
    expressionTags: buildExpressionTags(input, snapshot),
    shareVariants: buildShareVariants(input, snapshot),
  };
}

export function parseAnalysisResponse(
  content: string,
  input: ArchetypeAnalysisInput
): Omit<XiaoyueAnalysisResult, 'cached'> {
  const fallback = buildFallbackAnalysisPayload(input);

  try {
    const parsed = JSON.parse(extractJsonPayload(content));
    const result = analysisResponseSchema.safeParse(parsed);

    if (!result.success) {
      return fallback;
    }

    return {
      ...result.data,
      stateLabel: deriveSocialSnapshot(input).stateLabel,
    };
  } catch {
    return fallback;
  }
}

export async function generateXiaoyueAnalysis(
  input: ArchetypeAnalysisInput
): Promise<XiaoyueAnalysisResult> {
  const cacheKey = getCacheKey(input);
  const cached = analysisCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.info('[XiaoyueAnalysis] Cache hit', { archetype: input.archetype });
    return { ...cached.result, cached: true };
  }

  const systemPrompt = `${XIAOYUE_PERSONA}\n\n${GENDER_NEUTRAL}`;
  const userPrompt = buildAnalysisPrompt(input);

  try {
    const response = await getDeepseekClient().chat.completions.create({
      model: getDeepseekModel('flash'),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const parsedResult = parseAnalysisResponse(
      response.choices[0]?.message?.content?.trim() || '',
      input
    );

    analysisCache.set(cacheKey, { result: parsedResult, timestamp: Date.now() });
    logger.info('[XiaoyueAnalysis] Generated', { archetype: input.archetype });

    return { ...parsedResult, cached: false };
  } catch (error) {
    if (error instanceof Error && error.message.includes('DEEPSEEK_API_KEY')) {
      logger.warn('[XiaoyueAnalysis] DeepSeek disabled, using fallback copy because API key is missing');
    }
    logger.error('[XiaoyueAnalysis] API error', { error: error instanceof Error ? error.message : String(error) });
    return { ...buildFallbackAnalysisPayload(input), cached: false };
  }
}

export function peekCachedAnalysis(
  input: ArchetypeAnalysisInput
): Omit<XiaoyueAnalysisResult, 'cached'> | null {
  const cacheKey = getCacheKey(input);
  const cached = analysisCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }
  return null;
}

export async function prefetchAnalysisIfReady(
  input: Omit<ArchetypeAnalysisInput, 'confidence'>,
  confidence: number
): Promise<void> {
  if (confidence < 0.7) {
    logger.info('[XiaoyueAnalysis] Skipping prefetch, confidence too low', { confidence });
    return;
  }

  const cacheKey = getCacheKey({ ...input, confidence });
  if (analysisCache.has(cacheKey)) {
    logger.info('[XiaoyueAnalysis] Already cached, skipping prefetch');
    return;
  }

  logger.info('[XiaoyueAnalysis] Starting background prefetch', { archetype: input.archetype });
  generateXiaoyueAnalysis({ ...input, confidence }).catch(err => {
    logger.error('[XiaoyueAnalysis] Background prefetch failed', { error: err instanceof Error ? err.message : String(err) });
  });
}

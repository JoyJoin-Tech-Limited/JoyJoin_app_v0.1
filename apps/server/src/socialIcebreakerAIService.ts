import type {
  SocialTopic,
  MicroChallenge,
  LieDetectiveStatement,
  AtmosphereMood,
  PersonalityDiceChallenge,
  PersonalityDiceChallengeGroup,
  SocialTopicDepthLevel,
  SocialTopicPromptStyle,
  SocialTopicSafety,
  AuctionLot,
  XiaoyueSessionPack,
} from '@shared/socialIcebreaker';
import { auctionLotsLlmPayloadSchema, parseXiaoyueSessionPack } from '@shared/socialIcebreaker';
import { selectPermissionLineForTopic } from '@shared/socialIcebreakerYuezaiCopy';
import type { MiniScriptGenre, MiniScriptStyle } from '@shared/miniscriptStoryFramework';
import {
  buildAIGCMeta,
  buildFallbackAIMeta,
  buildLiveAIMeta,
  type AIResponseMeta,
  type AIProvider,
} from '@shared/types/aiMeta';
import { extractJsonPayloadForParse } from './ai/extractLlmJson';
import { getClientForFunction, getDeepseekSelection } from './ai/socialModelRouter';
import { createAiCorrelationId, logAITrace } from './lib/aiTraceLogger';
import {
  buildWarmupTopicsPrompt,
  buildMicroChallengesPrompt,
  buildLieDetectivePrompt,
  buildLieDetectiveV2Prompt,
  LieDetectiveV2ResponseSchema,
  buildXiaoYueCommentPrompt,
  buildRecapSummaryPrompt,
  buildPersonalityDicePrompt,
  buildPersonalityDicePromptV4,
  buildAuctionLotsPrompt,
  buildMiniScriptFrameworkUserMessage,
  buildXiaoyueSessionPackPrompt,
  buildQuipBattlePrompt,
  buildUndercoverWordPrompt,
  buildGroupMirrorPrompt,
  MINISCRIPT_FRAMEWORK_SYSTEM,
  WARMUP_TOPICS_PROMPT_VERSION,
  WARMUP_TOPICS_CHAT_PROMPT_VERSION,
  MICRO_CHALLENGES_PROMPT_VERSION,
  LIE_DETECTIVE_PROMPT_VERSION,
  LIE_DETECTIVE_V2_PROMPT_VERSION,
  RECAP_SUMMARY_PROMPT_VERSION,
  PERSONALITY_DICE_PROMPT_VERSION,
  PERSONALITY_DICE_CHOOSE_PROMPT_VERSION,
  AUCTION_LOTS_PROMPT_VERSION,
  MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION,
  SESSION_PACK_PROMPT_VERSION,
  XIAOYUE_COMMENT_PROMPT_VERSION,
  UNDERCOVER_WORD_PROMPT_VERSION,
  GROUP_MIRROR_PROMPT_VERSION,
} from './ai/socialIcebreakerPrompts';
import { selectMicroChallenges } from '@joyjoin/shared';
import { getRandomQuipBattlePrompts, type QuipBattlePrompt } from '@shared/quipBattle';
import { getFallbackUndercoverPair, type UndercoverWordPair } from '@shared/undercoverWord';
import { buildArchetypeContext } from './lib/contextInjector';
import { getFallbackGroupMirrorQuestions, type GroupMirrorQuestion } from '@shared/groupMirror';
import { getRandomFallbackSet, type LieDetectiveV2FallbackStatement } from '@shared/lieDetectiveFallback';
import { logger } from "./lib/logger";
import { moderateGeneratedContent, type ModerationCheck } from './lib/aiContentModeration';
import { XIAOYUE_PERSONA } from './prompts';
import { validateContentSafe } from './lib/contentSafety';
import { AIServiceResult, fireAndForgetQualityGate } from './socialIcebreakerAICore';

export { fireAndForgetQualityGate } from './socialIcebreakerAICore';
export type { AIServiceResult } from './socialIcebreakerAICore';

/** Re-export for downstream consumers that previously imported from this file. */
export { XIAOYUE_COMMENT_PROMPT_VERSION, MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION };

function normalizeTopicDepthLevel(value: unknown): SocialTopicDepthLevel {
  if (value === 3) return 3;
  if (value === 2) return 2;
  return 1;
}

function normalizeTopicPromptStyle(value: unknown): SocialTopicPromptStyle {
  if (value === 'binary' || value === 'reflective') {
    return value;
  }
  return 'experiential';
}

function normalizeTopicSafety(value: unknown): SocialTopicSafety {
  if (value === 'open' || value === 'reflective') {
    return value;
  }
  return 'gentle';
}

function normalizeSocialTopic(topic: Partial<SocialTopic>, fallbackMood: AtmosphereMood, index: number): SocialTopic {
  const base: SocialTopic = {
    id: topic.id || `topic_${index + 1}`,
    question: topic.question || '分享一件让你会心一笑的小事',
    mood: topic.mood || fallbackMood,
    emoji: topic.emoji || '✨',
    category: topic.category || '轻松开场',
    depthLevel: normalizeTopicDepthLevel(topic.depthLevel),
    promptStyle: normalizeTopicPromptStyle(topic.promptStyle),
    safety: normalizeTopicSafety(topic.safety),
  };
  // 悦仔说 permission whisper — deterministic per topic so every table member
  // sees the identical line (campfire-vault-card-pr1 A2).
  base.permissionLine = selectPermissionLineForTopic({ question: base.question, depthLevel: base.depthLevel });
  if (topic.promptTiers?.opener && topic.promptTiers?.followUp && topic.promptTiers?.reflection) {
    base.promptTiers = {
      opener: String(topic.promptTiers.opener).slice(0, 30),
      followUp: String(topic.promptTiers.followUp).slice(0, 40),
      reflection: String(topic.promptTiers.reflection).slice(0, 50),
    };
  }
  return base;
}

function warmupTopicsChecks(topics: SocialTopic[]): ModerationCheck[] {
  return topics.flatMap((t, i) => {
    const checks: ModerationCheck[] = [
      { field: `topic[${i}].question`, text: t.question },
      { field: `topic[${i}].category`, text: t.category },
    ];
    if (t.promptTiers) {
      checks.push(
        { field: `topic[${i}].promptTiers.opener`, text: t.promptTiers.opener },
        { field: `topic[${i}].promptTiers.followUp`, text: t.promptTiers.followUp },
        { field: `topic[${i}].promptTiers.reflection`, text: t.promptTiers.reflection },
      );
    }
    return checks;
  });
}

/**
 * Brave-but-safe guarantee (campfire-vault-card-pr1 A1).
 *
 * A topic counts as "brave" when it is marked `safety: 'reflective'` — the
 * existing field, no new enum. Brave questions are emotionally vulnerable
 * (jealousy toward a friend, fear of falling behind, pretending to fit in)
 * but must never touch death, abuse, self-harm, or explicit content; the
 * moderation pass below remains the hard gate on that.
 */
export function hasBraveTopic(topics: SocialTopic[]): boolean {
  return topics.some((t) => t.safety === 'reflective');
}

/**
 * Repair an LLM topic set that contains no brave question by replacing the
 * final topic with a curated brave topic for the requested mood. Deterministic:
 * the first curated brave topic for the mood whose question is not already in
 * the set is chosen. Runs BEFORE moderation so the repaired set is what gets
 * checked and persisted.
 */
function ensureBraveTopic(
  topics: SocialTopic[],
  mood: AtmosphereMood,
  aiCorrelationId?: string,
): SocialTopic[] {
  if (hasBraveTopic(topics)) return topics;
  const presentQuestions = new Set(topics.map((t) => t.question));
  const candidate = FALLBACK_WARMUP_TOPICS.find(
    (t) => t.mood === mood && t.safety === 'reflective' && !presentQuestions.has(t.question),
  ) ?? FALLBACK_WARMUP_TOPICS.find((t) => t.safety === 'reflective' && !presentQuestions.has(t.question));
  if (!candidate) return topics;
  const repaired = [...topics];
  const replacementIndex = repaired.length > 0 ? repaired.length - 1 : 0;
  repaired[replacementIndex] = normalizeSocialTopic(candidate, mood, replacementIndex);
  logger.info('[SocialIcebreakerAI] generateWarmupTopics brave guarantee repair: injected curated brave topic', {
    mood,
    replacementQuestion: candidate.question,
    aiCorrelationId,
  });
  return repaired;
}

function microChallengesChecks(challenges: MicroChallenge[]): ModerationCheck[] {
  return challenges.flatMap((c, i) => [
    { field: `challenge[${i}].title`, text: c.title },
    { field: `challenge[${i}].description`, text: c.description },
    { field: `challenge[${i}].completionCTA`, text: c.completionCTA },
    { field: `challenge[${i}].visualHint`, text: c.visualHint },
  ]);
}

function lieDetectiveStatementsChecks(statements: LieDetectiveStatement[]): ModerationCheck[] {
  return statements.map((s, i) => ({ field: `statement[${i}].text`, text: s.text }));
}

function xiaoYueCommentChecks(comment: string): ModerationCheck[] {
  return [{ field: 'comment', text: comment }];
}

function recapChecks(recap: { headline: string; moments: string[]; closingLine: string }): ModerationCheck[] {
  const checks: ModerationCheck[] = [
    { field: 'headline', text: recap.headline },
    { field: 'closingLine', text: recap.closingLine },
  ];
  recap.moments.forEach((moment, i) => checks.push({ field: `moment[${i}]`, text: moment }));
  return checks;
}

function xiaoyueSessionPackChecks(pack: XiaoyueSessionPack): ModerationCheck[] {
  const checks: ModerationCheck[] = [{ field: 'opener', text: pack.opener }];
  for (const [phase, coaching] of Object.entries(pack.phaseCoaching)) {
    checks.push({ field: `phaseCoaching.${phase}.toneLine`, text: coaching.toneLine });
    if (coaching.hostHint) checks.push({ field: `phaseCoaching.${phase}.hostHint`, text: coaching.hostHint });
    if (coaching.energyRescue) checks.push({ field: `phaseCoaching.${phase}.energyRescue`, text: coaching.energyRescue });
  }
  pack.backupPrompts.forEach((prompt, i) => checks.push({ field: `backupPrompts[${i}]`, text: prompt }));
  checks.push({ field: 'recapFraming.open', text: pack.recapFraming.open });
  checks.push({ field: 'recapFraming.highlightTemplate', text: pack.recapFraming.highlightTemplate });
  checks.push({ field: 'recapFraming.close', text: pack.recapFraming.close });
  return checks;
}

function quipBattlePromptsChecks(prompts: QuipBattlePrompt[]): ModerationCheck[] {
  return prompts.flatMap((p, i) => [
    { field: `prompt[${i}].promptText`, text: p.promptText },
    { field: `prompt[${i}].category`, text: p.category },
  ]);
}

function undercoverWordPairChecks(pair: UndercoverWordPair): ModerationCheck[] {
  return [
    { field: 'civilianWord', text: pair.civilianWord },
    { field: 'undercoverWord', text: pair.undercoverWord },
    { field: 'category', text: pair.category },
  ];
}

function groupMirrorQuestionsChecks(questions: GroupMirrorQuestion[]): ModerationCheck[] {
  return questions.map((q, i) => ({ field: `question[${i}].questionText`, text: q.questionText }));
}

function attachAIGC<T>(result: AIServiceResult<T>): AIServiceResult<T> {
  return {
    data: result.data,
    meta: {
      ...result.meta,
      aigc: buildAIGCMeta({ fallbackUsed: result.meta.fallbackUsed, labelType: 'ai-generated' }),
    },
  };
}

function moderateAndAttachAIGC<T>(
  result: AIServiceResult<T>,
  options: {
    provider: AIProvider | null;
    model?: string;
    latencyMs: number;
    promptVersion?: string;
    aiCorrelationId: string;
    feature: string;
    fallbackData: T;
    checks: ModerationCheck[];
  },
): AIServiceResult<T> {
  if (result.meta.fallbackUsed) {
    return attachAIGC(result);
  }
  const moderation = moderateGeneratedContent(options.checks, {
    domain: 'icebreaker',
    feature: options.feature,
    provider: options.provider,
    model: options.model,
    latencyMs: options.latencyMs,
    promptVersion: options.promptVersion,
    traceId: options.aiCorrelationId,
  });
  if (!moderation.safe) {
    return attachAIGC({
      data: options.fallbackData,
      meta: buildFallbackAIMeta('content_safety', options.promptVersion ?? 'unknown', options.aiCorrelationId),
    });
  }
  return attachAIGC(result);
}

// ============ CURATED FALLBACK CONTENT ============

/** Curated warmup fallback bank — exported for contract tests (A1 brave-per-mood coverage). */
export const FALLBACK_WARMUP_TOPICS: SocialTopic[] = [
  { id: 'w1', question: '最近最离谱的一次外卖经历是什么？', mood: 'funny', emoji: '🍜', category: '生活趣事', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w2', question: '如果今天能重来一件事，你会改什么？', mood: 'life', emoji: '🔄', category: '今日状态', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w3', question: '手机里现在最奇怪的一张照片，敢不敢给大家看看？', mood: 'funny', emoji: '📱', category: '轻松破冰', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w4', question: '最近有没有那种"世界真小"的巧合？', mood: 'life', emoji: '🌍', category: '偶遇故事', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w5', question: '你的性格要是道菜，你是什么菜？', mood: 'funny', emoji: '🍽️', category: '自我比喻', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w6', question: '最近一次真正放松是在哪儿？干嘛呢？', mood: 'relaxed', emoji: '😌', category: '舒适感', depthLevel: 2, promptStyle: 'experiential', safety: 'gentle' },
  { id: 'w7', question: '明天要是突然不用上班，第一件事做什么？', mood: 'relaxed', emoji: '🌟', category: '理想日常', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w8', question: '如果能和任何人对坐吃一顿饭，你最想选谁？想聊点什么？', mood: 'emotional', emoji: '💫', category: '重要关系', depthLevel: 3, promptStyle: 'reflective', safety: 'reflective' },
  { id: 'w9', question: '最近有没有一个瞬间，让你突然心里一暖？', mood: 'emotional', emoji: '🥹', category: '感动瞬间', depthLevel: 3, promptStyle: 'reflective', safety: 'reflective' },
  { id: 'w10', question: '你觉得自己哪个优点，其实被身边人低估了？', mood: 'life', emoji: '💡', category: '自我认知', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w11', question: '描述一下你理想的周末，越具体越好', mood: 'relaxed', emoji: '☀️', category: '理想节奏', depthLevel: 2, promptStyle: 'experiential', safety: 'gentle' },
  { id: 'w12', question: '如果能瞬间学会一门技能，你想拿捏什么？', mood: 'funny', emoji: '🎯', category: '愿望清单', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w13', question: '最近有什么让你笑到停不下来的事？', mood: 'funny', emoji: '😂', category: '快乐来源', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w14', question: '小时候最想当什么？现在还这么想吗？', mood: 'life', emoji: '👶', category: '成长轨迹', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w15', question: '给五年前的自己留句话，你会说什么？', mood: 'emotional', emoji: '⏰', category: '自我回望', depthLevel: 3, promptStyle: 'reflective', safety: 'reflective' },
  { id: 'w16', question: '最近尝试了什么新鲜事物，结果真香还是踩雷？', mood: 'life', emoji: '🚀', category: '新鲜体验', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w17', question: '你一般怎么给自己"充电"？', mood: 'relaxed', emoji: '🔋', category: '恢复能量', depthLevel: 2, promptStyle: 'experiential', safety: 'gentle' },
  { id: 'w18', question: '有什么事看起来很难，其实上手发现也就那样？', mood: 'funny', emoji: '🤔', category: '反差观察', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w19', question: '什么样的环境让你瞬间放松下来？', mood: 'relaxed', emoji: '🏡', category: '舒适空间', depthLevel: 2, promptStyle: 'experiential', safety: 'gentle' },
  { id: 'w20', question: '最想去但还没去的地方是哪儿？为什么一直想去？', mood: 'emotional', emoji: '✈️', category: '向往之地', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w21', question: '今晚来这儿，你最期待发生什么？', mood: 'relaxed', emoji: '🎉', category: '现场期待', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w22', question: '用三个词形容下今天的心情呗', mood: 'life', emoji: '💭', category: '情绪快照', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w23', question: '有什么生活习惯，说出来别人会觉得"你也这样？"', mood: 'funny', emoji: '🙈', category: '可爱怪癖', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w24', question: '最近有没有一件事，让你突然改变了想法？', mood: 'emotional', emoji: '🌱', category: '观点变化', depthLevel: 3, promptStyle: 'reflective', safety: 'reflective' },
  { id: 'w25', question: '如果人生是部电影，你现在演到哪个章节了？', mood: 'life', emoji: '🎬', category: '人生叙事', depthLevel: 3, promptStyle: 'reflective', safety: 'reflective' },
  // Brave-but-safe entries (campfire-vault-card-pr1 A1): every mood carries ≥1
  // emotionally vulnerable question marked safety 'reflective' — never death,
  // abuse, self-harm, or explicit content.
  { id: 'w26', question: '有没有哪一刻，你突然觉得自己被落下了？', mood: 'life', emoji: '🍂', category: '情绪共鸣', depthLevel: 3, promptStyle: 'reflective', safety: 'reflective' },
  { id: 'w27', question: '你有没有过跟着大家一起笑，其实没听懂笑点的时候？', mood: 'funny', emoji: '😅', category: '可爱瞬间', depthLevel: 2, promptStyle: 'experiential', safety: 'reflective' },
  { id: 'w28', question: '最近有没有觉得累，却不好意思说出来的时刻？', mood: 'relaxed', emoji: '🌙', category: '情绪安放', depthLevel: 2, promptStyle: 'reflective', safety: 'reflective' },
];

const FALLBACK_MICRO_CHALLENGES: MicroChallenge[] = [
  {
    id: 'c1',
    title: '找3个共同点',
    description: '在座的各位，找出3个你们共有的爱好或经历，越 unexpected 越好',
    durationSeconds: 180,
    completionCTA: '拿捏了！',
    visualHint: '🔍🤝',
  },
  {
    id: 'c2',
    title: '用3个词形容右边的人',
    description: '每人用3个词形容坐在自己右边的人，不准说"挺好的"',
    durationSeconds: 120,
    completionCTA: '说完收工！',
    visualHint: '💬🌟',
  },
  {
    id: 'c3',
    title: '整一个离谱创业点子',
    description: '来，大家一起整一个绝对不会成功的创业idea，脑洞越大越好',
    durationSeconds: 150,
    completionCTA: '这项目我投了！',
    visualHint: '🚀💡',
  },
  {
    id: 'c4',
    title: '哼歌猜曲',
    description: '每人哼一段歌，其他人猜，跑调也没事反而更好猜',
    durationSeconds: 120,
    completionCTA: '这波绝了！',
    visualHint: '🎵🎤',
  },
  {
    id: 'c5',
    title: '30秒不为人知',
    description: '每人30秒，说一个在场没人知道的事，越小众越好',
    durationSeconds: 180,
    completionCTA: '原来你是这样的！',
    visualHint: '⚡👤',
  },
  {
    id: 'c6',
    title: '心灵感应挑战',
    description: '两人背对背同时说同一个数字，看看你们有没有默契',
    durationSeconds: 90,
    completionCTA: '这都能中？',
    visualHint: '🧠✨',
  },
  {
    id: 'c7',
    title: '生日排序',
    description: '所有人按生日月份排成一排，不能说话只能比划，整起来',
    durationSeconds: 120,
    completionCTA: '排对了！',
    visualHint: '🎯👥',
  },
  {
    id: 'c8',
    title: '接力编故事',
    description: '每人接一句话，编个完整故事，结尾必须让人意想不到',
    durationSeconds: 180,
    completionCTA: '编剧实锤！',
    visualHint: '📖🎭',
  },
];

const FALLBACK_LIE_DETECTIVE_STATEMENTS: LieDetectiveStatement[][] = [
  [
    { index: 1, text: '我曾在凌晨三点一个人爬过一座山，就是觉得想去了', isLie: false },
    { index: 2, text: '我会说五种语言，虽然都不是很流利', isLie: true },
    { index: 3, text: '我的第一份工作是在便利店上夜班', isLie: false },
  ],
  [
    { index: 1, text: '我上过电视，虽然只有一个背影镜头', isLie: true },
    { index: 2, text: '我养过一只龟，养了整整十年，比有些恋爱还长', isLie: false },
    { index: 3, text: '我大学时是系里长跑第一名，虽然系里只有三个男生', isLie: false },
  ],
  [
    { index: 1, text: '我在飞机上遇到过一位演员，还聊了两句', isLie: false },
    { index: 2, text: '我曾经做过一段时间职业厨师，主要是切配', isLie: true },
    { index: 3, text: '我第一次坐飞机是二十五岁以后，之前一直坐高铁', isLie: false },
  ],
];

// ============ AI GENERATORS ============

function getTargetTopicCount(vibe?: 'chat' | 'balanced' | 'game'): number {
  switch (vibe) {
    case 'chat': return 6;
    case 'game': return 4;
    case 'balanced':
    default: return 5;
  }
}

function getPromptVersionForVibe(vibe?: 'chat' | 'balanced' | 'game'): string {
  return vibe === 'chat' ? WARMUP_TOPICS_CHAT_PROMPT_VERSION : WARMUP_TOPICS_PROMPT_VERSION;
}

function isWarmupLlmEnabled(): boolean {
  const v = process.env.SOCIAL_WARMUP_LLM_ENABLED;
  if (v === undefined || v === '') return true; // default: AI enabled for backward compat
  return v.toLowerCase() === 'true';
}

export async function generateWarmupTopics(params: {
  mood: AtmosphereMood;
  eventType: string;
  participantCount: number;
  avoidTopics?: string[];
  _refinementHint?: string;
  roster?: Array<{ archetype?: string }>;
  /** Vibe drives card count, depth curve, and tier generation. */
  vibe?: 'chat' | 'balanced' | 'game';
}): Promise<AIServiceResult<SocialTopic[]>> {
  const aiCorrelationId = createAiCorrelationId();
  const promptVersion = getPromptVersionForVibe(params.vibe);

  // If AI is disabled, return curated fallback immediately
  if (!isWarmupLlmEnabled()) {
    const meta = buildFallbackAIMeta('disabled', promptVersion, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateWarmupTopics', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: getFallbackTopics(params.mood, params.vibe), meta });
  }

  let selection: ReturnType<typeof getClientForFunction>;
  try {
    selection = getClientForFunction('generateWarmupTopics');
  } catch (error) {
    logger.error('[SocialIcebreakerAI] generateWarmupTopics provider selection failed; using curated fallback', {
      error: error instanceof Error ? error.message : String(error),
      aiCorrelationId,
    });
    const meta = buildFallbackAIMeta('provider_unavailable', promptVersion, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateWarmupTopics',
      provider: null,
      model: 'n/a',
      latencyMs: 0,
      success: false,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: meta.promptVersion,
      errorCode: meta.evaluatorRejectionReason,
    });
    return attachAIGC({ data: getFallbackTopics(params.mood, params.vibe), meta });
  }

  const { client, model, provider } = selection;
  const t0 = Date.now();

  // 3s timeout for warmup generation (LLM safety)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const sessionContext = params.roster ? buildArchetypeContext(params.roster) : undefined;
    if (sessionContext?.mixText) {
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'contextInjector', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: false, fromCache: false, promptVersion: 'context-injector-v1', extra: { mixText: sessionContext.mixText, diversityScore: sessionContext.diversityScore } });
    }
    const prompt = buildWarmupTopicsPrompt({ ...params, sessionContext });

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: params.vibe === 'chat' ? 1200 : 500,
    }, { signal: controller.signal });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', promptVersion, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateWarmupTopics', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: getFallbackTopics(params.mood, params.vibe), meta });
    }

    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const latencyMs = Date.now() - t0;
      logger.info(`[SocialIcebreakerAI] generateWarmupTopics provider=${provider} latency=${latencyMs}ms vibe=${params.vibe ?? 'balanced'}`);
      const meta = buildLiveAIMeta(provider, promptVersion, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateWarmupTopics', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      fireAndForgetQualityGate(content, 'icebreaker_warmup', aiCorrelationId, 'warmup', params.eventType);
      const targetCount = getTargetTopicCount(params.vibe);
      const normalizedTopics: SocialTopic[] = parsed.slice(0, targetCount + 1).map((topic, index) => normalizeSocialTopic(topic, params.mood, index));
      // Brave-but-safe guarantee: repair before moderation so the checked and
      // persisted set always contains ≥1 brave question (contract A1/A4).
      const liveTopics = ensureBraveTopic(normalizedTopics, params.mood, aiCorrelationId);
      return moderateAndAttachAIGC(
        { data: liveTopics, meta },
        {
          provider,
          model,
          latencyMs,
          promptVersion: meta.promptVersion,
          aiCorrelationId,
          feature: 'generateWarmupTopics',
          fallbackData: getFallbackTopics(params.mood, params.vibe),
          checks: warmupTopicsChecks(liveTopics),
        },
      );
    }
    const latencyMs = Date.now() - t0;
    logger.warn(`[SocialIcebreakerAI] generateWarmupTopics provider=${provider} latency=${latencyMs}ms: invalid response shape, using fallback`);
    const meta = buildFallbackAIMeta('parse_error', promptVersion, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateWarmupTopics', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: getFallbackTopics(params.mood, params.vibe), meta });
  } catch (error) {
    const latencyMs = Date.now() - t0;
    const isTimeout = error instanceof Error && (error.name === 'AbortError' || error.message?.includes('abort'));
    logger.error(`[SocialIcebreakerAI] generateWarmupTopics error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error), isTimeout });
    const meta = buildFallbackAIMeta(isTimeout ? 'timeout' : 'llm_error', promptVersion, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateWarmupTopics', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: getFallbackTopics(params.mood, params.vibe), meta });
  } finally {
    clearTimeout(timeoutId);
  }
}

function getFallbackTopics(mood: AtmosphereMood, vibe?: 'chat' | 'balanced' | 'game'): SocialTopic[] {
  const targetCount = getTargetTopicCount(vibe);
  const filtered = FALLBACK_WARMUP_TOPICS.filter(t => t.mood === mood);
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  // If not enough for this mood, supplement with others
  const topics = shuffled.length < targetCount
    ? [...shuffled, ...FALLBACK_WARMUP_TOPICS.filter(t => t.mood !== mood)
        .sort(() => Math.random() - 0.5)
        .slice(0, targetCount - shuffled.length)]
      .map((topic, index) => normalizeSocialTopic(topic, mood, index))
    : shuffled.slice(0, targetCount).map((topic, index) => normalizeSocialTopic(topic, mood, index));
  // Brave-but-safe guarantee applies to the served fallback set too: shuffle +
  // slice can otherwise drop the mood's only brave topic (contract A1 /
  // Reliability pillar — repair swaps the final card for a curated brave one).
  return ensureBraveTopic(topics, mood);
}

function isMicroChallengeLlmEnabled(): boolean {
  const v = process.env.SOCIAL_MICRO_CHALLENGE_LLM_ENABLED;
  if (v === undefined || v === '') return true; // default: AI enabled for backward compat
  return v.toLowerCase() === 'true';
}

function isLieDetectiveLlmEnabled(): boolean {
  const v = process.env.SOCIAL_LIE_DETECTIVE_LLM_ENABLED;
  if (v === undefined || v === '') return true; // default: AI enabled for backward compat
  return v.toLowerCase() === 'true';
}

function buildSelectorMeta(): AIResponseMeta {
  return {
    generatedAt: new Date().toISOString(),
    fromCache: false,
    provider: null,
    fallbackUsed: false,
    promptVersion: 'selector-v1',
  };
}

function inferSceneFromEventType(eventType: string): 'dinner' | 'bar' | 'both' {
  const t = eventType.toLowerCase();
  if (t.includes('酒') || t.includes('bar') || t.includes('pub')) return 'bar';
  if (t.includes('饭') || t.includes('餐') || t.includes('dinner') || t.includes('lunch')) return 'dinner';
  return 'both';
}

export async function generateMicroChallenges(params: {
  eventType: string;
  participantCount: number;
  completedChallengeIds?: string[];
  /** Deterministic seed for template selector (e.g. session ID). */
  seed?: string;
  _refinementHint?: string;
  roster?: Array<{ archetype?: string }>;
}): Promise<AIServiceResult<MicroChallenge[]>> {
  const aiCorrelationId = createAiCorrelationId();

  // 1. Always build the deterministic selector baseline
  const selectorSeed = params.seed ?? `default-${params.participantCount}-${params.eventType}`;
  let selectorResult = [] as MicroChallenge[];
  try {
    selectorResult = selectMicroChallenges({
      participantCount: params.participantCount,
      completedIds: params.completedChallengeIds,
      seed: selectorSeed,
      scene: inferSceneFromEventType(params.eventType),
      count: 3,
    });
  } catch (selectorErr) {
    logger.warn('[SocialIcebreakerAI] selector fallback unavailable, relying on AI only', {
      error: selectorErr instanceof Error ? selectorErr.message : String(selectorErr),
    });
  }

  // 2. If AI is disabled, return selector result immediately
  if (!isMicroChallengeLlmEnabled()) {
    if (selectorResult.length === 0) {
      throw new Error(`No micro-challenge templates available for ${params.participantCount} players`);
    }
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateMicroChallenges',
      provider: null,
      model: 'selector-v1',
      latencyMs: 0,
      success: true,
      fallbackUsed: false,
      fromCache: false,
      promptVersion: 'selector-v1',
    });
    return attachAIGC({ data: selectorResult, meta: buildSelectorMeta() });
  }

  // 3. AI path (backward-compatible primary)
  const { client, model, provider } = getClientForFunction('generateMicroChallenges');
  const t0 = Date.now();
  try {
    const sessionContext = params.roster ? buildArchetypeContext(params.roster) : undefined;
    if (sessionContext?.mixText) {
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'contextInjector', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: false, fromCache: false, promptVersion: 'context-injector-v1', extra: { mixText: sessionContext.mixText, diversityScore: sessionContext.diversityScore } });
    }
    const prompt = buildMicroChallengesPrompt({ ...params, sessionContext });

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', MICRO_CHALLENGES_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateMicroChallenges', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: selectorResult, meta });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayloadForParse(content));
    } catch {
      const latencyMs = Date.now() - t0;
      logger.warn(`[SocialIcebreakerAI] generateMicroChallenges provider=${provider} latency=${latencyMs}ms: JSON parse failed, using selector fallback`);
      const meta = buildFallbackAIMeta('parse_error', MICRO_CHALLENGES_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateMicroChallenges', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: selectorResult, meta });
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      const latencyMs = Date.now() - t0;
      logger.info(`[SocialIcebreakerAI] generateMicroChallenges provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, MICRO_CHALLENGES_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateMicroChallenges', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      fireAndForgetQualityGate(content, 'icebreaker_micro_challenge', aiCorrelationId, 'micro_challenge', params.eventType);
      const liveChallenges: MicroChallenge[] = parsed.slice(0, 3);
      return moderateAndAttachAIGC(
        { data: liveChallenges, meta },
        {
          provider,
          model,
          latencyMs,
          promptVersion: MICRO_CHALLENGES_PROMPT_VERSION,
          aiCorrelationId,
          feature: 'generateMicroChallenges',
          fallbackData: selectorResult,
          checks: microChallengesChecks(liveChallenges),
        },
      );
    }
    const latencyMs = Date.now() - t0;
    logger.warn(`[SocialIcebreakerAI] generateMicroChallenges provider=${provider} latency=${latencyMs}ms: invalid response shape, using selector fallback`);
    const meta = buildFallbackAIMeta('parse_error', MICRO_CHALLENGES_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateMicroChallenges', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: selectorResult, meta });
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateMicroChallenges error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', MICRO_CHALLENGES_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateMicroChallenges', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    if (selectorResult.length === 0) throw error;
    return attachAIGC({ data: selectorResult, meta });
  }
}

/** Determine the effective lie-detective mode. */
export function getLieDetectiveMode(sessionMode?: 'v1' | 'v2'): 'v1' | 'v2' {
  if (sessionMode) return sessionMode;
  const envMode = process.env.LIE_DETECTIVE_MODE;
  return envMode === 'v2' ? 'v2' : 'v1';
}

/** Compute dynamic difficulty based on reveal history. First 2 rounds always medium. */
export function getDynamicDifficulty(
  history?: Array<{ round: number; correctRate: number }>,
): 'easy' | 'medium' | 'hard' {
  if (!history || history.length < 2) return 'medium';
  const lastTwo = history.slice(-2);
  const avgCorrectRate = lastTwo.reduce((sum, h) => sum + h.correctRate, 0) / lastTwo.length;
  if (avgCorrectRate < 0.4) return 'easy';
  if (avgCorrectRate > 0.6) return 'hard';
  return 'medium';
}

/** Validate user-submitted tags for V2. */
export function validateLieDetectiveV2Tags(tags: unknown): { valid: false; error: string } | { valid: true; tags: [string, string] } {
  if (!Array.isArray(tags) || tags.length !== 2) {
    return { valid: false, error: 'Exactly 2 tags are required' };
  }
  for (const tag of tags) {
    if (typeof tag !== 'string' || tag.length < 2 || tag.length > 20) {
      return { valid: false, error: 'Each tag must be 2–20 characters' };
    }
    const safetyResult = validateContentSafe(tag, 'tag');
    if (!safetyResult.safe) {
      return { valid: false, error: safetyResult.violation?.message || 'Tag contains inappropriate content' };
    }
  }
  return { valid: true, tags: [tags[0].trim(), tags[1].trim()] as [string, string] };
}

/** Build V2 recap data from reveal history. */
export function buildLieDetectiveV2RecapData(
  history: Array<{ round: number; correctRate: number }>,
): { aiWinRate: number; hardestRound: number; fooledEveryone: number } {
  if (history.length === 0) {
    return { aiWinRate: 0, hardestRound: 0, fooledEveryone: 0 };
  }
  const aiWonRounds = history.filter((h) => h.correctRate < 0.5).length;
  const aiWinRate = Math.round((aiWonRounds / history.length) * 100);
  const hardestEntry = history.reduce((min, h) => (h.correctRate < min.correctRate ? h : min), history[0]);
  const fooledEveryone = history.filter((h) => h.correctRate === 0).length;
  return {
    aiWinRate,
    hardestRound: hardestEntry.round,
    fooledEveryone,
  };
}

export async function generateLieDetectiveStatements(params: {
  userId: string;
  displayName: string;
  archetype?: string;
  interests?: string[];
  mode?: 'v1' | 'v2';
  tags?: [string, string];
  difficulty?: 'easy' | 'medium' | 'hard';
  _refinementHint?: string;
}): Promise<AIServiceResult<LieDetectiveStatement[]>> {
  const effectiveMode = params.mode ?? getLieDetectiveMode();

  // If AI is disabled, use deterministic fallback for both V1 and V2
  if (!isLieDetectiveLlmEnabled()) {
    return generateLieDetectiveDisabledFallback(params);
  }

  if (effectiveMode === 'v2' && params.tags) {
    return generateLieDetectiveV2Statements({
      userId: params.userId,
      displayName: params.displayName,
      archetype: params.archetype,
      tags: params.tags,
      difficulty: params.difficulty,
    });
  }

  // V1 path (existing behavior)
  return generateLieDetectiveV1Statements(params);
}

async function generateLieDetectiveV1Statements(params: {
  userId: string;
  displayName: string;
  archetype?: string;
  interests?: string[];
  _refinementHint?: string;
}): Promise<AIServiceResult<LieDetectiveStatement[]>> {
  const aiCorrelationId = createAiCorrelationId();
  const { client, model, provider } = getClientForFunction('generateLieDetectiveStatements');
  const t0 = Date.now();
  try {
    const prompt = buildLieDetectivePrompt(params);

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', LIE_DETECTIVE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveStatements', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: getRandomFallbackStatements(), meta });
    }

    const parsed = JSON.parse(content);
    if (
      Array.isArray(parsed) &&
      parsed.length === 3 &&
      parsed.filter((s: LieDetectiveStatement) => s.isLie).length === 1
    ) {
      const latencyMs = Date.now() - t0;
      logger.info(`[SocialIcebreakerAI] generateLieDetectiveStatements provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, LIE_DETECTIVE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveStatements', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      fireAndForgetQualityGate(content, 'icebreaker_lie_detective', aiCorrelationId, 'lie_detective');
      const liveStatements: LieDetectiveStatement[] = parsed;
      return moderateAndAttachAIGC(
        { data: liveStatements, meta },
        {
          provider,
          model,
          latencyMs,
          promptVersion: LIE_DETECTIVE_PROMPT_VERSION,
          aiCorrelationId,
          feature: 'generateLieDetectiveStatements',
          fallbackData: getRandomFallbackStatements(),
          checks: lieDetectiveStatementsChecks(liveStatements),
        },
      );
    }
    const latencyMs = Date.now() - t0;
    logger.warn(`[SocialIcebreakerAI] generateLieDetectiveStatements provider=${provider} latency=${latencyMs}ms: invalid response shape (expected 3 items with exactly 1 lie), using fallback`);
    const meta = buildFallbackAIMeta('parse_error', LIE_DETECTIVE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveStatements', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: getRandomFallbackStatements(), meta };
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateLieDetectiveStatements error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', LIE_DETECTIVE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveStatements', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: getRandomFallbackStatements(), meta };
  }
}

function getRandomFallbackStatements(): LieDetectiveStatement[] {
  const sets = [...FALLBACK_LIE_DETECTIVE_STATEMENTS].sort(() => Math.random() - 0.5);
  return sets[0];
}

/**
 * Deterministic fallback used when SOCIAL_LIE_DETECTIVE_LLM_ENABLED=false.
 * Ignores tags/AI and returns a shuffled curated statement set.
 */
function generateLieDetectiveDisabledFallback(
  params: {
    userId: string;
    displayName: string;
    archetype?: string;
    tags?: [string, string];
  },
): AIServiceResult<LieDetectiveStatement[]> {
  const aiCorrelationId = createAiCorrelationId();
  const meta = buildFallbackAIMeta('disabled', LIE_DETECTIVE_PROMPT_VERSION, aiCorrelationId);
  logAITrace({
    traceId: aiCorrelationId,
    domain: 'icebreaker',
    feature: 'generateLieDetectiveStatements',
    provider: null,
    model: 'n/a',
    latencyMs: 0,
    success: true,
    fallbackUsed: true,
    fromCache: false,
    promptVersion: meta.promptVersion,
    errorCode: meta.evaluatorRejectionReason,
  });
  const statements = getRandomFallbackStatements();
  // V2 callers expect is_ai/source_tag fields when tags were provided.
  if (params.tags) {
    return attachAIGC({
      data: statements.map((s, index) => ({
        ...s,
        index,
        is_ai: s.isLie,
        source_tag: s.isLie ? undefined : params.tags![index % 2],
      })),
      meta,
    });
  }
  return attachAIGC({ data: statements.map((s, index) => ({ ...s, index })), meta });
}

// ─── Lie Detective V2 ───────────────────────────────────────────────────────

/**
 * 4-tier degrade chain for Lie Detective V2:
 * 1. V2 prompt → buildLieDetectiveV2Prompt() + LieDetectiveV2ResponseSchema.safeParse()
 * 2. V2 fallback sets → getRandomFallbackSet(archetype)
 * 3. V1 prompt → buildLieDetectivePrompt() (AI generates all 3)
 * 4. V1 hardcoded → existing deterministic fallback
 *
 * All tiers are AITraced with fallbackUsed: true.
 */
async function generateLieDetectiveV2Statements(params: {
  userId: string;
  displayName: string;
  archetype?: string;
  interests?: string[];
  tags: [string, string];
  difficulty?: 'easy' | 'medium' | 'hard';
}): Promise<AIServiceResult<LieDetectiveStatement[]>> {
  const aiCorrelationId = createAiCorrelationId();
  const difficulty = params.difficulty ?? 'medium';

  // Tier 1: V2 prompt
  const tier1 = await tryV2Prompt(params, aiCorrelationId, difficulty);
  if (tier1.success) return tier1.result;

  // Tier 2: V2 fallback sets
  const tier2 = tryV2Fallback(params, aiCorrelationId);
  if (tier2.success) return tier2.result;

  // Tier 3: V1 prompt
  const tier3 = await tryV1PromptAsFallback(params, aiCorrelationId);
  if (tier3.success) return tier3.result;

  // Tier 4: V1 hardcoded fallback
  return tier4HardcodedFallback(aiCorrelationId);
}

async function tryV2Prompt(
  params: { displayName: string; archetype?: string; tags: [string, string] },
  aiCorrelationId: string,
  difficulty: 'easy' | 'medium' | 'hard',
): Promise<{ success: true; result: AIServiceResult<LieDetectiveStatement[]> } | { success: false }> {
  const { client, model, provider } = getClientForFunction('generateLieDetectiveStatements');
  const t0 = Date.now();
  try {
    const prompt = buildLieDetectiveV2Prompt({
      displayName: params.displayName,
      tags: params.tags,
      archetype: params.archetype,
      difficulty,
    });

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const latencyMs = Date.now() - t0;
      logger.warn(`[SocialIcebreakerAI] V2 prompt empty response provider=${provider} latency=${latencyMs}ms`);
      const meta = buildFallbackAIMeta('empty_response', LIE_DETECTIVE_V2_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveV2Statements', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { success: false };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      const latencyMs = Date.now() - t0;
      logger.warn(`[SocialIcebreakerAI] V2 prompt JSON parse failed provider=${provider} latency=${latencyMs}ms`);
      const meta = buildFallbackAIMeta('parse_error', LIE_DETECTIVE_V2_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveV2Statements', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { success: false };
    }

    const validation = LieDetectiveV2ResponseSchema.safeParse(parsed);
    if (!validation.success) {
      const latencyMs = Date.now() - t0;
      logger.warn(`[SocialIcebreakerAI] V2 prompt validation failed provider=${provider} latency=${latencyMs}ms: ${validation.error.message}`);
      const meta = buildFallbackAIMeta('parse_error', LIE_DETECTIVE_V2_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveV2Statements', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { success: false };
    }

    // Convert V2 shape to LieDetectiveStatement[] (is_ai → isLie for compatibility)
    const statements: LieDetectiveStatement[] = validation.data.map((s) => ({
      index: s.index,
      text: s.text,
      isLie: s.is_ai,
      is_ai: s.is_ai,
      source_tag: s.source_tag ?? null,
    }));

    const latencyMs = Date.now() - t0;
    logger.info(`[SocialIcebreakerAI] V2 prompt success provider=${provider} latency=${latencyMs}ms`);
    const meta = buildLiveAIMeta(provider, LIE_DETECTIVE_V2_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveV2Statements', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
    fireAndForgetQualityGate(content, 'icebreaker_lie_detective', aiCorrelationId, 'lie_detective');
    return {
      success: true,
      result: moderateAndAttachAIGC(
        { data: statements, meta },
        {
          provider,
          model,
          latencyMs,
          promptVersion: LIE_DETECTIVE_V2_PROMPT_VERSION,
          aiCorrelationId,
          feature: 'generateLieDetectiveV2Statements',
          fallbackData: getRandomFallbackStatements(),
          checks: lieDetectiveStatementsChecks(statements),
        },
      ),
    };
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] V2 prompt error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', LIE_DETECTIVE_V2_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveV2Statements', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { success: false };
  }
}

function tryV2Fallback(
  params: { archetype?: string },
  aiCorrelationId: string,
): { success: true; result: AIServiceResult<LieDetectiveStatement[]> } | { success: false } {
  try {
    const fallbackSet = getRandomFallbackSet(params.archetype);
    const statements: LieDetectiveStatement[] = fallbackSet.statements.map((s: LieDetectiveV2FallbackStatement) => ({
      index: s.index,
      text: s.text,
      isLie: s.is_ai,
      is_ai: s.is_ai,
      source_tag: s.source_tag,
    }));

    const meta = buildFallbackAIMeta('v2_fallback_pool', LIE_DETECTIVE_V2_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveV2Statements', provider: null, model: 'v2-fallback-pool', latencyMs: 0, success: true, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    logger.info('[SocialIcebreakerAI] V2 fallback set used');
    return { success: true, result: attachAIGC({ data: statements, meta }) };
  } catch (error) {
    logger.error('[SocialIcebreakerAI] V2 fallback set error:', { error: error instanceof Error ? error.message : String(error) });
    return { success: false };
  }
}

async function tryV1PromptAsFallback(
  params: { userId: string; displayName: string; archetype?: string; interests?: string[] },
  aiCorrelationId: string,
): Promise<{ success: true; result: AIServiceResult<LieDetectiveStatement[]> } | { success: false }> {
  try {
    const v1Result = await generateLieDetectiveV1Statements(params);
    // Overwrite meta to indicate V1 fallback was used
    const meta: AIResponseMeta = {
      ...v1Result.meta,
      fallbackUsed: true,
      promptVersion: `${v1Result.meta.promptVersion}-v1-degrade`,
    };
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveV2Statements', provider: v1Result.meta.provider, model: 'v1-degrade', latencyMs: 0, success: true, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion });
    return { success: true, result: attachAIGC({ data: v1Result.data, meta }) };
  } catch {
    return { success: false };
  }
}

function tier4HardcodedFallback(aiCorrelationId: string): AIServiceResult<LieDetectiveStatement[]> {
  const statements = getRandomFallbackStatements();
  const meta = buildFallbackAIMeta('v1_hardcoded_fallback', LIE_DETECTIVE_PROMPT_VERSION, aiCorrelationId);
  logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateLieDetectiveV2Statements', provider: null, model: 'v1-hardcoded', latencyMs: 0, success: true, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
  logger.info('[SocialIcebreakerAI] V1 hardcoded fallback used (tier 4)');
  return attachAIGC({ data: statements, meta });
}

export async function generateXiaoYueComment(params: {
  phase: string;
  event: string;
  context?: string;
  playerCount?: number;
  participants?: Array<{ displayName: string; archetype?: string | null; profile?: { archetype?: string | null; industryLabel?: string | null; age?: number | null; city?: string | null; stateLabel?: string | null; gender?: string | null; educationLevel?: string | null; lifeStage?: string | null; bio?: string | null } | null }>;
}): Promise<AIServiceResult<string>> {
  const defaultComments: Record<string, Record<string, string>> = {
    warmup: {
      phase_start: '来，先抽张话题卡，不用紧张 🌅',
      topic_refresh: '换个话题，这个更有意思～ ✨',
      mood_change: '行，换换口味，新话题来了 🎯',
    },
    micro_challenge: {
      phase_start: '话题卡环节差不多了，来点小挑战？⚡',
      timer_warning: '时间不多啦，抓紧 ⚡',
      challenge_complete: '可以啊，大家都完成了 🎉',
    },
    lie_detective: {
      phase_start: '侦探时间，仔细听，找出那个假的 🕵️',
      vote_reveal: '揭晓了，谁最会编？😏',
      generating: '正在准备谎言游戏，稍等...',
    },
    recap: {
      phase_start: '今晚这局差不多到这儿啦 ✨',
    },
  };

  const phaseComments = defaultComments[params.phase];
  if (phaseComments?.[params.event]) {
    const meta = buildFallbackAIMeta('default_comment', XIAOYUE_COMMENT_PROMPT_VERSION);
    return attachAIGC({ data: phaseComments[params.event], meta });
  }

  const aiCorrelationId = createAiCorrelationId();
  const { client, model, provider } = getClientForFunction('generateXiaoYueComment');
  const t0 = Date.now();
  try {
    const prompt = buildXiaoYueCommentPrompt(params);

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: XIAOYUE_PERSONA },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 100,
    });

    const content = response.choices[0]?.message?.content?.trim();
    const latencyMs = Date.now() - t0;
    logger.info(`[SocialIcebreakerAI] generateXiaoYueComment provider=${provider} latency=${latencyMs}ms`);
    if (content) {
      const meta = buildLiveAIMeta(provider, XIAOYUE_COMMENT_PROMPT_VERSION, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generateXiaoYueComment',
        provider,
        model,
        latencyMs,
        success: true,
        fallbackUsed: false,
        fromCache: false,
        promptVersion: XIAOYUE_COMMENT_PROMPT_VERSION,
      });
      return moderateAndAttachAIGC(
        { data: content, meta },
        {
          provider,
          model,
          latencyMs,
          promptVersion: XIAOYUE_COMMENT_PROMPT_VERSION,
          aiCorrelationId,
          feature: 'generateXiaoYueComment',
          fallbackData: '继续加油，破冰进行中！✨',
          checks: xiaoYueCommentChecks(content),
        },
      );
    }
    const metaFb = buildFallbackAIMeta('empty_response', XIAOYUE_COMMENT_PROMPT_VERSION, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateXiaoYueComment',
      provider,
      model,
      latencyMs,
      success: false,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: XIAOYUE_COMMENT_PROMPT_VERSION,
      errorCode: 'empty_response',
    });
    return attachAIGC({ data: '继续加油，破冰进行中！✨', meta: metaFb });
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateXiaoYueComment error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const metaFb = buildFallbackAIMeta('llm_error', XIAOYUE_COMMENT_PROMPT_VERSION, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateXiaoYueComment',
      provider,
      model,
      latencyMs,
      success: false,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: XIAOYUE_COMMENT_PROMPT_VERSION,
      errorCode: 'llm_error',
    });
    return attachAIGC({ data: '继续加油，破冰进行中！✨', meta: metaFb });
  }
}

function isRecapLlmEnabled(): boolean {
  const v = process.env.SOCIAL_RECAP_LLM_ENABLED;
  if (v === undefined || v === '') return true; // default: AI enabled for backward compat
  return v.toLowerCase() === 'true';
}

export async function generateRecapSummary(params: {
  participants: Array<{ displayName: string; archetype?: string }>;
  topicsDiscussed: string[];
  challengesCompleted: number;
  commonGroundCount: number;
  lieDetectiveHighlights?: string[];
  /** Bounded one-liners, e.g. "Name：挑战标题" — max ~6 in caller */
  personalityDiceRecapLines?: string[];
  /** Single bounded line, e.g. premise excerpt */
  miniScriptRecapLine?: string;
  /** Bounded one-liners after auction phase, e.g. lot titles + winners */
  auctionRecapLines?: string[];
  durationMinutes: number;
}): Promise<AIServiceResult<{ headline: string; moments: string[]; closingLine: string }>> {
  const aiCorrelationId = createAiCorrelationId();

  // If AI is disabled, return deterministic default recap immediately
  if (!isRecapLlmEnabled()) {
    const meta = buildFallbackAIMeta('disabled', RECAP_SUMMARY_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateRecapSummary', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: getDefaultRecap(params), meta });
  }

  const { client, model, provider } = getClientForFunction('generateRecapSummary');
  const t0 = Date.now();
  try {
    const sessionContext = buildArchetypeContext(params.participants);
    if (sessionContext?.mixText) {
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'contextInjector', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: false, fromCache: false, promptVersion: 'context-injector-v1', extra: { mixText: sessionContext.mixText, diversityScore: sessionContext.diversityScore } });
    }

    const prompt = buildRecapSummaryPrompt({ ...params, sessionContext });

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', RECAP_SUMMARY_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateRecapSummary', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: getDefaultRecap(params), meta });
    }

    const parsed = JSON.parse(content);
    if (parsed.headline && parsed.moments && parsed.closingLine) {
      const latencyMs = Date.now() - t0;
      logger.info(`[SocialIcebreakerAI] generateRecapSummary provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, RECAP_SUMMARY_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateRecapSummary', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      fireAndForgetQualityGate(content, 'icebreaker_recap', aiCorrelationId, 'recap');
      const liveRecap: { headline: string; moments: string[]; closingLine: string } = parsed;
      return moderateAndAttachAIGC(
        { data: liveRecap, meta },
        {
          provider,
          model,
          latencyMs,
          promptVersion: RECAP_SUMMARY_PROMPT_VERSION,
          aiCorrelationId,
          feature: 'generateRecapSummary',
          fallbackData: getDefaultRecap(params),
          checks: recapChecks(liveRecap),
        },
      );
    }
    const latencyMs = Date.now() - t0;
    logger.warn(`[SocialIcebreakerAI] generateRecapSummary provider=${provider} latency=${latencyMs}ms: invalid response shape, using fallback`);
    const meta = buildFallbackAIMeta('parse_error', RECAP_SUMMARY_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateRecapSummary', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: getDefaultRecap(params), meta });
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateRecapSummary error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', RECAP_SUMMARY_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateRecapSummary', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: getDefaultRecap(params), meta });
  }
}

function getDefaultRecap(params: {
  participants: Array<{ displayName: string }>;
  topicsDiscussed: string[];
  challengesCompleted: number;
  commonGroundCount: number;
  durationMinutes: number;
}): { headline: string; moments: string[]; closingLine: string } {
  const names = params.participants.map(p => p.displayName);
  return {
    headline: `${params.durationMinutes}分钟，这局有点东西`,
    moments: [
      `聊了${params.topicsDiscussed.length}个话题，有几个还挺深的`,
      `完成了${params.challengesCompleted}个挑战，没人掉链子`,
      `发现了${params.commonGroundCount}个共同点，缘分啊`,
      `${names.length}个人，从陌生到能聊到一块`,
    ],
    closingLine: `这局算你们赢，下次继续 ${names.length > 2 ? '（特别是' + names.slice(0, 2).join('和') + '）' : ''}🌟`,
  };
}


// ─── Xiaoyue Session Pack ─────────────────────────────────────────────────────

const FALLBACK_SESSION_PACK: XiaoyueSessionPack = {
  generatedAt: new Date().toISOString(),
  opener: '来了来了，先放松，这局不会尬，我保证。',
  phaseCoaching: {
    warmup: { toneLine: '先抽张话题卡，不用急着交心', hostHint: '没人开口？你先抽一张打个样呗' },
    micro_challenge: { toneLine: '来点小挑战，两分钟的事', energyRescue: '别急，慢慢玩，时间够的' },
    lie_detective: { toneLine: '仔细听，找出那个编的', hostHint: '大胆猜，错了也没人记仇' },
    auction: { toneLine: '虚拟拍卖，脑洞越大越好', energyRescue: '没人出价？自己夸自己也算' },
    personality_dice: { toneLine: '人格骰子，看看敢不敢接', hostHint: '先从简单的来，别一上来就hard模式' },
    mini_script: { toneLine: '迷你剧本杀，今晚重头戏', hostHint: '提醒一下，记住自己的秘密和任务' },
    quip_battle: { toneLine: '填空造句，秀出你的脑洞', hostHint: '越无厘头越好，没有标准答案' },
    undercover_word: { toneLine: '谁是卧底，仔细观察', hostHint: '描述别太明显，也别太模糊' },
    group_mirror: { toneLine: '匿名投票，看看大家眼中的你', hostHint: '轻松投，没有对错' },
    speed_friending: { toneLine: '快速轮转，每人三分钟', hostHint: '铃响就换人，别恋战' },
    phase_selection: { toneLine: '该选下一个环节了，主持人大权在握', hostHint: '挑一个大家状态适合的游戏继续' },
    recap: { toneLine: '差不多了，回顾一下今晚' },
  },
  backupPrompts: [
    '大家突然安静了？试试轮流说一件今天的小事，多小都行。',
    '来个快速二选一：海边还是山里？火锅还是烧烤？',
    '有人还没怎么说话？直接点名，问TA一个简单的问题。',
  ],
  recapFraming: {
    open: '今晚这局，挺有意思的',
    highlightTemplate: '我印象最深的是',
    close: '这局算你们赢，下次继续',
  },
  playerSkillRoles: [],
};

function isSessionPackEnabled(): boolean {
  const v = process.env.SOCIAL_XIAOYUE_SESSION_PACK_ENABLED;
  if (v === undefined || v === '') return true;
  return v.toLowerCase() === 'true';
}

export async function generateXiaoyueSessionPack(params: {
  participants: Array<{ userId: string; displayName: string; archetype?: string }>;
  eventType?: string;
  playerCount: number;
}): Promise<AIServiceResult<XiaoyueSessionPack>> {
  const aiCorrelationId = createAiCorrelationId();
  const t0 = Date.now();

  if (!isSessionPackEnabled()) {
    const meta = buildFallbackAIMeta('disabled', SESSION_PACK_PROMPT_VERSION, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateXiaoyueSessionPack',
      provider: 'deepseek',
      model: 'n/a',
      latencyMs: Date.now() - t0,
      success: true,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: meta.promptVersion,
      errorCode: meta.evaluatorRejectionReason,
    });
    return attachAIGC({ data: FALLBACK_SESSION_PACK, meta });
  }

  const { client, model, provider } = getClientForFunction('generateXiaoyueSessionPack');
  try {
    const prompt = buildXiaoyueSessionPackPrompt({
      participantCount: params.playerCount,
      eventType: params.eventType,
      participants: params.participants,
    });

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', SESSION_PACK_PROMPT_VERSION, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generateXiaoyueSessionPack',
        provider,
        model,
        latencyMs: Date.now() - t0,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: meta.promptVersion,
        errorCode: meta.evaluatorRejectionReason,
      });
      return attachAIGC({ data: FALLBACK_SESSION_PACK, meta });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayloadForParse(content));
    } catch {
      const meta = buildFallbackAIMeta('parse_error', SESSION_PACK_PROMPT_VERSION, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generateXiaoyueSessionPack',
        provider,
        model,
        latencyMs: Date.now() - t0,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: meta.promptVersion,
        errorCode: meta.evaluatorRejectionReason,
      });
      return attachAIGC({ data: FALLBACK_SESSION_PACK, meta });
    }

    try {
      const validated = parseXiaoyueSessionPack(parsed);
      const latencyMs = Date.now() - t0;
      const meta = buildLiveAIMeta(provider, SESSION_PACK_PROMPT_VERSION, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generateXiaoyueSessionPack',
        provider,
        model,
        latencyMs,
        success: true,
        fallbackUsed: false,
        fromCache: false,
        promptVersion: meta.promptVersion,
      });
      const livePack = validated as XiaoyueSessionPack;
      return moderateAndAttachAIGC(
        { data: livePack, meta },
        {
          provider,
          model,
          latencyMs,
          promptVersion: SESSION_PACK_PROMPT_VERSION,
          aiCorrelationId,
          feature: 'generateXiaoyueSessionPack',
          fallbackData: FALLBACK_SESSION_PACK,
          checks: xiaoyueSessionPackChecks(livePack),
        },
      );
    } catch {
      const meta = buildFallbackAIMeta('parse_error', SESSION_PACK_PROMPT_VERSION, aiCorrelationId);
      logAITrace({
        traceId: aiCorrelationId,
        domain: 'icebreaker',
        feature: 'generateXiaoyueSessionPack',
        provider,
        model,
        latencyMs: Date.now() - t0,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: meta.promptVersion,
        errorCode: meta.evaluatorRejectionReason,
      });
      return attachAIGC({ data: FALLBACK_SESSION_PACK, meta });
    }
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateXiaoyueSessionPack error latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', SESSION_PACK_PROMPT_VERSION, aiCorrelationId);
    logAITrace({
      traceId: aiCorrelationId,
      domain: 'icebreaker',
      feature: 'generateXiaoyueSessionPack',
      provider,
      model,
      latencyMs,
      success: false,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: meta.promptVersion,
      errorCode: meta.evaluatorRejectionReason,
    });
    return attachAIGC({ data: FALLBACK_SESSION_PACK, meta });
  }
}



// ─── Quip Battle ─────────────────────────────────────────────────────────────

export const QUIP_BATTLE_PROMPT_VERSION = 'social-quip-battle-v1';

function isQuipBattleLlmEnabled(): boolean {
  const v = process.env.SOCIAL_QUIP_BATTLE_LLM_ENABLED;
  if (v === undefined || v === '') return true; // default: AI enabled for backward compat
  return v.toLowerCase() === 'true';
}

export async function generateQuipBattlePrompts(params: {
  eventType: string;
  participantCount: number;
  participants: Array<{ displayName: string; archetype?: string }>;
  _refinementHint?: string;
  roster?: Array<{ archetype?: string }>;
}): Promise<AIServiceResult<QuipBattlePrompt[]>> {
  const aiCorrelationId = createAiCorrelationId();

  // Always build fallback first
  const fallbackPrompts = getRandomQuipBattlePrompts(3);

  // If AI is disabled, return curated fallback immediately
  if (!isQuipBattleLlmEnabled()) {
    const meta = buildFallbackAIMeta('disabled', QUIP_BATTLE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateQuipBattlePrompts', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallbackPrompts, meta });
  }

  const { client, model, provider } = getClientForFunction('generateQuipBattlePrompts');
  const t0 = Date.now();

  try {
    const sessionContext = params.roster ? buildArchetypeContext(params.roster) : undefined;
    if (sessionContext?.mixText) {
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'contextInjector', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: false, fromCache: false, promptVersion: 'context-injector-v1', extra: { mixText: sessionContext.mixText, diversityScore: sessionContext.diversityScore } });
    }
    const prompt = buildQuipBattlePrompt({ ...params, sessionContext });

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', QUIP_BATTLE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateQuipBattlePrompts', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: fallbackPrompts, meta });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayloadForParse(content));
    } catch {
      const latencyMs = Date.now() - t0;
      logger.warn(`[SocialIcebreakerAI] generateQuipBattlePrompts provider=${provider} latency=${latencyMs}ms: JSON parse failed, using fallback`);
      const meta = buildFallbackAIMeta('parse_error', QUIP_BATTLE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateQuipBattlePrompts', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: fallbackPrompts, meta });
    }

    if (Array.isArray(parsed) && parsed.length >= 3) {
      const latencyMs = Date.now() - t0;
      logger.info(`[SocialIcebreakerAI] generateQuipBattlePrompts provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, QUIP_BATTLE_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateQuipBattlePrompts', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      fireAndForgetQualityGate(content, 'icebreaker_warmup', aiCorrelationId, 'quip_battle', params.eventType);
      const livePrompts: QuipBattlePrompt[] = parsed.slice(0, 3).map((p: QuipBattlePrompt, i: number) => ({
        id: p.id || `qb_${i + 1}`,
        promptText: p.promptText || fallbackPrompts[i].promptText,
        category: p.category || fallbackPrompts[i].category,
      }));
      return moderateAndAttachAIGC(
        { data: livePrompts, meta },
        {
          provider,
          model,
          latencyMs,
          promptVersion: QUIP_BATTLE_PROMPT_VERSION,
          aiCorrelationId,
          feature: 'generateQuipBattlePrompts',
          fallbackData: fallbackPrompts,
          checks: quipBattlePromptsChecks(livePrompts),
        },
      );
    }

    const latencyMs = Date.now() - t0;
    logger.warn(`[SocialIcebreakerAI] generateQuipBattlePrompts provider=${provider} latency=${latencyMs}ms: invalid response shape, using fallback`);
    const meta = buildFallbackAIMeta('parse_error', QUIP_BATTLE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateQuipBattlePrompts', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallbackPrompts, meta });
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateQuipBattlePrompts error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', QUIP_BATTLE_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateQuipBattlePrompts', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallbackPrompts, meta });
  }
}

// ─── Undercover Word ─────────────────────────────────────────────────────────

function isUndercoverWordLlmEnabled(): boolean {
  const v = process.env.SOCIAL_UNDERCOVER_WORD_LLM_ENABLED;
  if (v === undefined || v === '') return true; // default: AI enabled for backward compat
  return v.toLowerCase() === 'true';
}

export async function generateUndercoverWordPair(params: {
  eventType?: string;
  participantCount: number;
  roster?: Array<{ userId: string; displayName: string; archetype?: string }>;
  _refinementHint?: string;
}): Promise<AIServiceResult<UndercoverWordPair>> {
  const aiCorrelationId = createAiCorrelationId();

  const fallback = getFallbackUndercoverPair();

  // If AI is disabled, return curated fallback immediately
  if (!isUndercoverWordLlmEnabled()) {
    const meta = buildFallbackAIMeta('disabled', UNDERCOVER_WORD_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateUndercoverWordPair', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallback, meta });
  }

  const { client, model, provider } = getClientForFunction('generateUndercoverWordPair');
  const t0 = Date.now();

  try {
    const sessionContext = params.roster ? buildArchetypeContext(params.roster) : undefined;
    if (sessionContext?.mixText) {
      logger.info('[SocialIcebreakerAI] Undercover word context injected', {
        aiCorrelationId,
        mixText: sessionContext.mixText,
        diversityScore: sessionContext.diversityScore,
      });
    }
    const prompt = buildUndercoverWordPrompt({
      participantCount: params.participantCount,
      eventType: params.eventType,
      sessionContext,
    });
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', UNDERCOVER_WORD_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateUndercoverWordPair', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: fallback, meta });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayloadForParse(content));
    } catch {
      const meta = buildFallbackAIMeta('parse_error', UNDERCOVER_WORD_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateUndercoverWordPair', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: fallback, meta });
    }

    const pair = parsed as Record<string, unknown>;
    if (pair.civilianWord && pair.undercoverWord && pair.category) {
      const meta = buildLiveAIMeta(provider, UNDERCOVER_WORD_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateUndercoverWordPair', provider, model, latencyMs: Date.now() - t0, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      fireAndForgetQualityGate(content, 'icebreaker_warmup', aiCorrelationId, 'undercover_word', params.eventType);
      const livePair: UndercoverWordPair = {
        civilianWord: String(pair.civilianWord),
        undercoverWord: String(pair.undercoverWord),
        category: String(pair.category),
      };
      return moderateAndAttachAIGC(
        { data: livePair, meta },
        {
          provider,
          model,
          latencyMs: Date.now() - t0,
          promptVersion: meta.promptVersion,
          aiCorrelationId,
          feature: 'generateUndercoverWordPair',
          fallbackData: fallback,
          checks: undercoverWordPairChecks(livePair),
        },
      );
    }

    const meta = buildFallbackAIMeta('parse_error', UNDERCOVER_WORD_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateUndercoverWordPair', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallback, meta });
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateUndercoverWordPair error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', UNDERCOVER_WORD_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateUndercoverWordPair', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallback, meta });
  }
}

// ─── Group Mirror ────────────────────────────────────────────────────────────

function isGroupMirrorLlmEnabled(): boolean {
  const v = process.env.SOCIAL_GROUP_MIRROR_LLM_ENABLED;
  if (v === undefined || v === '') return true; // default: AI enabled for backward compat
  return v.toLowerCase() === 'true';
}

export async function generateGroupMirrorQuestions(params: {
  eventType?: string;
  participantCount: number;
  participantNames: string[];
  roster?: Array<{ userId: string; displayName: string; archetype?: string }>;
  _refinementHint?: string;
}): Promise<AIServiceResult<GroupMirrorQuestion[]>> {
  const aiCorrelationId = createAiCorrelationId();

  const fallback = getFallbackGroupMirrorQuestions(5);

  // If AI is disabled, return curated fallback immediately
  if (!isGroupMirrorLlmEnabled()) {
    const meta = buildFallbackAIMeta('disabled', GROUP_MIRROR_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateGroupMirrorQuestions', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallback, meta });
  }

  const { client, model, provider } = getClientForFunction('generateGroupMirrorQuestions');
  const t0 = Date.now();

  try {
    const sessionContext = params.roster ? buildArchetypeContext(params.roster) : undefined;
    if (sessionContext?.mixText) {
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'contextInjector', provider: null, model: 'n/a', latencyMs: 0, success: true, fallbackUsed: false, fromCache: false, promptVersion: 'context-injector-v1', extra: { mixText: sessionContext.mixText, diversityScore: sessionContext.diversityScore } });
    }
    const prompt = buildGroupMirrorPrompt({ ...params, sessionContext });
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
      max_tokens: 600,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', GROUP_MIRROR_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateGroupMirrorQuestions', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: fallback, meta });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonPayloadForParse(content));
    } catch {
      const meta = buildFallbackAIMeta('parse_error', GROUP_MIRROR_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateGroupMirrorQuestions', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return attachAIGC({ data: fallback, meta });
    }

    if (Array.isArray(parsed) && parsed.length >= 3) {
      const meta = buildLiveAIMeta(provider, GROUP_MIRROR_PROMPT_VERSION, aiCorrelationId);
      logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateGroupMirrorQuestions', provider, model, latencyMs: Date.now() - t0, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      fireAndForgetQualityGate(content, 'icebreaker_warmup', aiCorrelationId, 'group_mirror', params.eventType);
      const liveQuestions: GroupMirrorQuestion[] = parsed.slice(0, 5).map((q: GroupMirrorQuestion, i: number) => ({
        id: q.id || `gm_${i + 1}`,
        questionText: q.questionText || fallback[i]?.questionText || '谁最有趣？',
        category: q.category || 'perception',
      }));
      return moderateAndAttachAIGC(
        { data: liveQuestions, meta },
        {
          provider,
          model,
          latencyMs: Date.now() - t0,
          promptVersion: meta.promptVersion,
          aiCorrelationId,
          feature: 'generateGroupMirrorQuestions',
          fallbackData: fallback,
          checks: groupMirrorQuestionsChecks(liveQuestions),
        },
      );
    }

    const meta = buildFallbackAIMeta('parse_error', GROUP_MIRROR_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateGroupMirrorQuestions', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallback, meta });
  } catch (error) {
    const latencyMs = Date.now() - t0;
    logger.error(`[SocialIcebreakerAI] generateGroupMirrorQuestions error provider=${provider} latency=${latencyMs}ms:`, { error: error instanceof Error ? error.message : String(error) });
    const meta = buildFallbackAIMeta('llm_error', GROUP_MIRROR_PROMPT_VERSION, aiCorrelationId);
    logAITrace({ traceId: aiCorrelationId, domain: 'icebreaker', feature: 'generateGroupMirrorQuestions', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return attachAIGC({ data: fallback, meta });
  }
}

// Re-exports from topical AI modules so downstream consumers can keep importing
// from this file as the public barrel.
export {
  generatePersonalityDiceChallenges,
  generatePersonalityDiceChallengeGroups,
} from './socialIcebreakerPersonalityDiceAI';
export {
  generateAuctionLots,
} from './socialIcebreakerAuctionAI';
export {
  fetchMiniScriptFrameworkModelJson,
} from './socialIcebreakerMiniScriptAI';
